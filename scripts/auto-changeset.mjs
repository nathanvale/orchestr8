#!/usr/bin/env node

/**
 * Auto-Changeset Generator for @orchestr8 Monorepo
 * 
 * Automatically generates changeset files from conventional commit messages.
 * Maps commit types to version bumps: feat → minor, fix → patch, BREAKING → major
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
// We'll use a simple regex parser instead of the complex conventional-commits-parser

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

class AutoChangeset {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false
    this.verbose = options.verbose || false
    this.commitMsgFile = options.commitMsgFile || null
    this.skipTypes = new Set(['chore', 'docs', 'style', 'test', 'build', 'ci'])
  }

  /**
   * Main entry point for auto-changeset generation
   */
  async generate() {
    try {
      const commitMessage = this.getCommitMessage()
      if (!commitMessage) {
        this.log('No commit message found, skipping changeset generation')
        return
      }

      const parsed = this.parseConventionalCommit(commitMessage)
      if (!parsed) {
        this.log('Not a conventional commit, skipping changeset generation')
        return
      }

      if (this.shouldSkipCommit(parsed.type)) {
        this.log(`Skipping changeset for commit type: ${parsed.type}`)
        return
      }

      const affectedPackages = this.detectAffectedPackages()
      if (affectedPackages.length === 0) {
        this.log('No packages affected, skipping changeset generation')
        return
      }

      const changesetData = this.buildChangesetData(parsed, affectedPackages)
      await this.generateChangeset(changesetData)

      this.log(`Generated changeset for ${affectedPackages.length} package(s): ${affectedPackages.join(', ')}`)
    } catch (error) {
      console.error('Error generating changeset:', error.message)
      if (this.verbose) {
        console.error(error.stack)
      }
      // Don't fail the commit, just warn
      process.exit(0)
    }
  }

  /**
   * Get the commit message from git or specified file
   */
  getCommitMessage() {
    // Use provided commit message file path, or default to git's COMMIT_EDITMSG
    const commitMsgFile = this.commitMsgFile || join(rootDir, '.git', 'COMMIT_EDITMSG')
    if (existsSync(commitMsgFile)) {
      return readFileSync(commitMsgFile, 'utf-8').trim()
    }
    return null
  }

  /**
   * Parse conventional commit message using regex
   */
  parseConventionalCommit(message) {
    try {
      // Match: type(scope): subject
      // Also handles: type(scope)!: subject (breaking)
      const headerPattern = /^(\w+)(?:\(([^)]*)\))?(!?):\s*(.+)$/
      const lines = message.split('\n')
      const header = lines[0]
      
      const match = header.match(headerPattern)
      if (!match) {
        return null
      }

      const [, type, scope, breakingMarker, subject] = match
      
      // Get body and extract footer
      const body = lines.slice(1).join('\n').trim()
      
      // Extract footer (everything after blank line, typically contains BREAKING CHANGE details)
      let footer = null
      const bodyLines = body.split('\n')
      const blankLineIndex = bodyLines.findIndex(line => line.trim() === '')
      if (blankLineIndex !== -1 && blankLineIndex < bodyLines.length - 1) {
        footer = bodyLines.slice(blankLineIndex + 1).join('\n').trim()
      }
      
      // Check for breaking changes
      const hasBreakingChange = 
        breakingMarker === '!' ||
        message.includes('BREAKING CHANGE:') ||
        message.includes('BREAKING-CHANGE:')

      return {
        type: type.toLowerCase(),
        scope: scope || null,
        subject: subject.trim(),
        body: body || null,
        footer: footer || null,
        breaking: hasBreakingChange,
        raw: message
      }
    } catch (error) {
      this.log(`Failed to parse commit message: ${error.message}`)
      return null
    }
  }

  /**
   * Check if commit type should be skipped
   */
  shouldSkipCommit(type) {
    return this.skipTypes.has(type)
  }

  /**
   * Detect which packages are affected by the current changes
   */
  detectAffectedPackages() {
    try {
      // Get staged files
      const stagedFiles = execSync('git diff --cached --name-only', { 
        encoding: 'utf-8',
        cwd: rootDir 
      }).trim().split('\n').filter(Boolean)

      const packages = this.getWorkspacePackages()
      const affectedPackages = new Set()

      for (const file of stagedFiles) {
        // Check if file is in a package directory
        for (const pkg of packages) {
          if (file.startsWith(`packages/${pkg.name}/src/`) || 
              file.startsWith(`packages/${pkg.name}/package.json`)) {
            affectedPackages.add(pkg.packageName)
          }
        }

        // Root level changes might affect core packages
        if (file.startsWith('packages/') === false && !file.startsWith('.')) {
          // For root changes, conservatively include core packages
          const corePackages = packages.filter(p => 
            ['core', 'schema', 'logger'].includes(p.name)
          )
          corePackages.forEach(pkg => affectedPackages.add(pkg.packageName))
        }
      }

      return Array.from(affectedPackages)
    } catch (error) {
      this.log(`Error detecting affected packages: ${error.message}`)
      return []
    }
  }

  /**
   * Get all workspace packages
   */
  getWorkspacePackages() {
    const packagesDir = join(rootDir, 'packages')
    const packages = []

    try {
      const dirs = readdirSync(packagesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)

      for (const dir of dirs) {
        const packageJsonPath = join(packagesDir, dir, 'package.json')
        if (existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
          packages.push({
            name: dir,
            packageName: packageJson.name,
            version: packageJson.version,
            private: packageJson.private
          })
        }
      }
    } catch (error) {
      this.log(`Error reading packages: ${error.message}`)
    }

    return packages
  }

  /**
   * Build changeset data structure
   */
  buildChangesetData(parsed, affectedPackages) {
    // Determine version bump type
    let bump = 'patch'
    if (parsed.breaking) {
      bump = 'major'
    } else if (parsed.type === 'feat') {
      bump = 'minor'
    }

    // Build changeset content
    const scope = parsed.scope ? `(${parsed.scope})` : ''
    const summary = `${parsed.type}${scope}: ${parsed.subject}`
    
    let description = summary
    if (parsed.body) {
      description += `\n\n${parsed.body}`
    }
    if (parsed.breaking && parsed.footer) {
      description += `\n\n${parsed.footer}`
    }

    return {
      bump,
      packages: affectedPackages,
      summary,
      description,
      breaking: parsed.breaking
    }
  }

  /**
   * Generate changeset file
   */
  async generateChangeset(changesetData) {
    const changesetDir = join(rootDir, '.changeset')
    const changesetId = this.generateChangesetId(changesetData.summary)
    const changesetPath = join(changesetDir, `${changesetId}.md`)

    // Build changeset content
    const packageLines = changesetData.packages
      .map(pkg => `"${pkg}": ${changesetData.bump}`)
      .join('\n')

    const content = `---
${packageLines}
---

${changesetData.description}
`

    if (this.dryRun) {
      console.log(`[DRY RUN] Would create changeset: ${changesetId}.md`)
      console.log('Content:')
      console.log(content)
      return
    }

    try {
      writeFileSync(changesetPath, content, 'utf-8')
      
      // Stage the changeset file
      execSync(`git add "${changesetPath}"`, { cwd: rootDir })
      
      this.log(`Created changeset: ${changesetId}.md`)
    } catch (error) {
      throw new Error(`Failed to create changeset: ${error.message}`)
    }
  }

  /**
   * Generate a unique changeset ID based on the commit summary
   */
  generateChangesetId(summary) {
    const words = summary
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .slice(0, 3)
      .join('-')
    
    const timestamp = Date.now().toString(36)
    return `${words}-${timestamp}`
  }

  /**
   * Log message if verbose mode is enabled
   */
  log(message) {
    if (this.verbose || this.dryRun) {
      console.log(`[auto-changeset] ${message}`)
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  
  // Parse commit message file argument
  let commitMsgFile = null
  const commitMsgFileIndex = args.indexOf('--commit-msg-file')
  if (commitMsgFileIndex !== -1 && commitMsgFileIndex < args.length - 1) {
    commitMsgFile = args[commitMsgFileIndex + 1]
  }
  
  const options = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    commitMsgFile: commitMsgFile
  }

  const autoChangeset = new AutoChangeset(options)
  await autoChangeset.generate()
}

export { AutoChangeset }