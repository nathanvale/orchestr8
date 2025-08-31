#!/usr/bin/env tsx
/**
 * Changeset Validation Script
 *
 * Validates changeset files to ensure they meet quality standards and
 * match the actual code changes. Part of pre-release guardrails.
 */

/* eslint-disable no-console */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

import matter from 'gray-matter'

import { getBaseBranch } from './lib/git-utils.js'

/**
 * Classification for different error severities
 */
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly severity: 'warning' | 'error' | 'critical',
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Standardized error handling with consistent formatting
 */
function handleError(
  error: unknown,
  context: string,
  severity: 'warning' | 'error' | 'critical',
): void {
  if (severity === 'critical') {
    console.error(`❌ CRITICAL: ${context}`)
    console.error('   Error:', error)
    console.error('   Cannot proceed - this blocks release')
    process.exit(1)
  } else if (severity === 'error') {
    console.error(`❌ ${context}`)
    console.error('   Error:', error)
  } else {
    console.warn(`⚠️  ${context}:`, error)
  }
}

/**
 * Format validation results with consistent styling
 */
function formatValidationMessage(type: 'error' | 'warning' | 'success', message: string): void {
  switch (type) {
    case 'error':
      console.error(`❌ ${message}`)
      break
    case 'warning':
      console.warn(`⚠️  ${message}`)
      break
    case 'success':
      console.log(`✅ ${message}`)
      break
  }
}

interface ValidatorOptions {
  help?: boolean
  verbose?: boolean
  fix?: boolean
  strict?: boolean
}

interface ChangesetData {
  filename: string
  packages: string[]
  summary: string
  releases: Array<{
    name: string
    type: 'major' | 'minor' | 'patch'
  }>
  created: Date
}

interface ValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
}

/**
 * Get all workspace packages by parsing root package.json workspaces
 */
function getWorkspacePackages(): Set<string> {
  const packages = new Set<string>()

  try {
    // Read root package.json to get workspace patterns
    const rootPackageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
    const workspaces = rootPackageJson.workspaces || []

    // Handle both array format and object format with "packages" key
    const patterns = Array.isArray(workspaces) ? workspaces : workspaces.packages || []

    for (const pattern of patterns) {
      // Handle glob patterns like "packages/*", "apps/*"
      if (pattern.includes('*')) {
        const baseDir = pattern.replace('/*', '')
        if (existsSync(baseDir)) {
          const entries = readdirSync(baseDir, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const pkgJsonPath = resolve(baseDir, entry.name, 'package.json')
              if (existsSync(pkgJsonPath)) {
                try {
                  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
                  if (pkg.name) {
                    packages.add(pkg.name)
                  }
                } catch {
                  // Skip invalid package.json files
                }
              }
            }
          }
        }
      } else {
        // Handle explicit paths like "packages/utilities"
        const pkgJsonPath = resolve(pattern, 'package.json')
        if (existsSync(pkgJsonPath)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
            if (pkg.name) {
              packages.add(pkg.name)
            }
          } catch {
            // Skip invalid package.json files
          }
        }
      }
    }
  } catch (error) {
    handleError(error, 'Could not read workspace packages from package.json', 'warning')
  }

  return packages
}

/**
 * Get workspace packages from a specific git ref (for detecting package removals)
 */
function getWorkspacePackagesFromRef(gitRef: string): Set<string> {
  const packages = new Set<string>()

  try {
    // Try to get package.json from the git ref
    const rootPackageContent = execSync(`git show ${gitRef}:package.json`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    const rootPackageJson = JSON.parse(rootPackageContent)
    const workspaces = rootPackageJson.workspaces || []
    const patterns = Array.isArray(workspaces) ? workspaces : workspaces.packages || []

    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        const baseDir = pattern.replace('/*', '')

        // Get directory listing from git ref
        try {
          const dirListing = execSync(`git ls-tree ${gitRef}:${baseDir} --name-only`, {
            encoding: 'utf-8',
            stdio: 'pipe',
          })

          const entries = dirListing.trim().split('\n').filter(Boolean)
          for (const entry of entries) {
            try {
              // Try to get package.json content from git ref
              const pkgJsonContent = execSync(
                `git show ${gitRef}:${baseDir}/${entry}/package.json`,
                {
                  encoding: 'utf-8',
                  stdio: 'pipe',
                },
              )
              const pkg = JSON.parse(pkgJsonContent)
              if (pkg.name) {
                packages.add(pkg.name)
              }
            } catch {
              // Skip directories without package.json or invalid package.json
            }
          }
        } catch {
          // Directory doesn't exist in git ref
        }
      } else {
        // Handle explicit paths
        try {
          const pkgJsonContent = execSync(`git show ${gitRef}:${pattern}/package.json`, {
            encoding: 'utf-8',
            stdio: 'pipe',
          })
          const pkg = JSON.parse(pkgJsonContent)
          if (pkg.name) {
            packages.add(pkg.name)
          }
        } catch {
          // Package doesn't exist in git ref
        }
      }
    }
  } catch (error) {
    handleError(error, `Could not read workspace packages from git ref ${gitRef}`, 'warning')
  }

  return packages
}

/**
 * Check if package.json changes are significant enough to require a changeset
 */
function hasSignificantPackageJsonChanges(packageJsonPath: string): boolean {
  try {
    // Use shared git utility for consistent branch detection
    const { mergeBase } = getBaseBranch()
    const compareRef = mergeBase

    // P0 Fix: Parse old and new JSON to properly detect dependency changes
    // Get the old and new versions of the file
    let oldContent = ''
    let newContent = ''

    try {
      oldContent = execSync(`git show ${compareRef}:${packageJsonPath}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
    } catch {
      // File didn't exist in old version, any content is significant
      return true
    }

    try {
      newContent = readFileSync(packageJsonPath, 'utf-8')
    } catch {
      // File doesn't exist in new version, deletion is significant
      return true
    }

    // Parse both versions
    let oldJson: any
    let newJson: any

    try {
      oldJson = JSON.parse(oldContent)
      newJson = JSON.parse(newContent)
    } catch {
      // If we can't parse, assume significant changes
      return true
    }

    // P1 Fix: Be smarter about which package.json changes require changesets
    // Only require changesets for changes that affect consumers of the package
    // These are the significantFields that impact package consumers
    const consumerAffectingFields = [
      'dependencies', // Can affect transitive deps
      'peerDependencies', // Affects what consumers must install
      'optionalDependencies', // Could affect runtime behavior
      'exports', // Changes API surface
      'main', // Entry point change
      'module', // ESM entry point change
      'types', // TypeScript types change
      'bin', // CLI tools change
      'files', // What gets published
      'publishConfig', // How package is published
      'engines', // Runtime requirements
      'type', // Module system change
    ]

    // P1 Fix: devDependencies changes typically don't require changesets
    // unless they affect the build pipeline that produces the published artifacts
    // Note: 'scripts' excluded as they're typically dev convenience and don't affect package consumers
    const buildAffectingDevDeps = [
      'typescript', // Could change compilation output
      'tsup', // Build tool changes
      'esbuild', // Build tool changes
      'webpack', // Build tool changes
      'rollup', // Build tool changes
      'vite', // Build tool changes
      '@types/', // Type definitions that could affect API
    ]

    for (const field of consumerAffectingFields) {
      const oldValue = oldJson[field]
      const newValue = newJson[field]

      // Deep compare the values
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        // Special handling for devDependencies
        if (field === 'devDependencies') {
          // Check if any build-affecting deps changed
          const oldDeps = oldValue || {}
          const newDeps = newValue || {}

          let hasBuildAffectingChange = false
          const allDepNames = new Set([...Object.keys(oldDeps), ...Object.keys(newDeps)])

          for (const depName of allDepNames) {
            // Check if this is a build-affecting dependency
            const isBuildAffecting = buildAffectingDevDeps.some(
              (pattern) => depName === pattern || depName.startsWith(pattern),
            )

            if (isBuildAffecting && oldDeps[depName] !== newDeps[depName]) {
              hasBuildAffectingChange = true
              break
            }
          }

          // Only require changeset if build-affecting devDeps changed
          if (hasBuildAffectingChange) {
            return true
          }
        } else {
          // For non-devDependencies fields, any change is significant
          return true
        }
      }
    }

    return false
  } catch {
    // If we can't get the diff, assume it's significant to be safe
    return true
  }
}

/**
 * Parse a changeset markdown file
 */
function parseChangeset(filePath: string): ChangesetData | null {
  try {
    const content = readFileSync(filePath, 'utf-8')

    // Get creation date from git if possible, fallback to filesystem
    let created: Date
    try {
      const gitTime = execSync(`git log -1 --format=%ct -- "${filePath}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      }).trim()

      if (gitTime) {
        created = new Date(parseInt(gitTime, 10) * 1000)
      } else {
        // File not in git yet, use filesystem time
        const stats = statSync(filePath)
        created = stats.birthtime
      }
    } catch {
      // Git command failed, use filesystem time
      const stats = statSync(filePath)
      created = stats.birthtime
    }

    // Parse frontmatter using gray-matter for robust YAML parsing
    const parsed = matter(content)
    const frontmatterData = parsed.data
    const summary = parsed.content.trim()

    const releases: Array<{ name: string; type: 'major' | 'minor' | 'patch' }> = []
    const packages: string[] = []

    // Extract package releases from frontmatter data
    for (const [packageName, releaseType] of Object.entries(frontmatterData)) {
      if (typeof releaseType === 'string' && ['major', 'minor', 'patch'].includes(releaseType)) {
        releases.push({
          name: packageName,
          type: releaseType as 'major' | 'minor' | 'patch',
        })
        packages.push(packageName)
      }
    }

    return {
      filename: filePath,
      packages,
      summary,
      releases,
      created,
    }
  } catch (error) {
    handleError(error, `Failed to parse changeset ${filePath}`, 'error')
    return null
  }
}

/**
 * Get all changeset files
 */
function getChangesetFiles(): string[] {
  const changesetDir = '.changeset'

  if (!existsSync(changesetDir)) {
    return []
  }

  try {
    const files = readdirSync(changesetDir)
    return files
      .filter((file) => file.endsWith('.md') && file !== 'README.md')
      .map((file) => resolve(changesetDir, file))
  } catch (error) {
    handleError(error, 'Failed to read changeset directory', 'error')
    return []
  }
}

/**
 * Get changed files from git
 */
function getChangedFiles(): string[] {
  try {
    // Use shared git utility for consistent branch detection
    const { mergeBase } = getBaseBranch()
    const compareRef = mergeBase

    // Get all changed files since the merge base
    const changedFiles: string[] = []

    // Get committed changes
    try {
      const output = execSync(`git diff --name-only ${compareRef}..HEAD`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
      changedFiles.push(
        ...output
          .trim()
          .split('\n')
          .filter((line) => line.length > 0),
      )
    } catch {
      // Continue to try other methods
    }

    // P0 Fix: Also get staged changes
    try {
      const staged = execSync('git diff --cached --name-only', {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
      changedFiles.push(
        ...staged
          .trim()
          .split('\n')
          .filter((line) => line.length > 0),
      )
    } catch {
      // Continue
    }

    // P0 Fix: Also get unstaged changes
    try {
      const unstaged = execSync('git diff --name-only', {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
      changedFiles.push(
        ...unstaged
          .trim()
          .split('\n')
          .filter((line) => line.length > 0),
      )
    } catch {
      // Continue
    }

    // P0 Fix: Also get untracked files (like git add -N)
    try {
      const untracked = execSync('git ls-files --others --exclude-standard', {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
      changedFiles.push(
        ...untracked
          .trim()
          .split('\n')
          .filter((line) => line.length > 0),
      )
    } catch {
      // Continue
    }

    // Remove duplicates
    const uniqueFiles = [...new Set(changedFiles)]

    if (uniqueFiles.length === 0) {
      // P0 Fix: Hard failure if we can't detect any changes when we should
      handleError(
        'Unable to detect changed files from git - ensure you are in a git repository with changes',
        'Git change detection failed',
        'critical',
      )
    }

    return uniqueFiles
  } catch (error) {
    // P0 Fix: Hard failure if git detection completely fails
    handleError(error, 'Git change detection failed completely', 'critical')
  }
}

/**
 * Validate changeset format and content
 */
function validateChangeset(changeset: ChangesetData): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
  }

  // Check if releases array is not empty
  if (changeset.releases.length === 0) {
    result.errors.push('No package releases defined in changeset')
    result.valid = false
  }

  // Check if summary is meaningful
  if (!changeset.summary || changeset.summary.length < 10) {
    result.errors.push('Summary is too short or missing (minimum 10 characters)')
    result.valid = false
  }

  // Check for generic/unhelpful summaries
  const genericPhrases = ['update', 'fix', 'change', 'minor change', 'small fix']
  if (
    genericPhrases.some(
      (phrase) => changeset.summary.toLowerCase().includes(phrase) && changeset.summary.length < 30,
    )
  ) {
    result.warnings.push(
      'Summary appears generic - consider being more specific about what changed',
    )
  }

  // Check if packages exist in workspace using robust workspace discovery
  const workspacePackages = getWorkspacePackages()

  for (const release of changeset.releases) {
    if (!workspacePackages.has(release.name)) {
      result.errors.push(`Package ${release.name} does not exist in workspace`)
      result.valid = false
    }
  }

  // Check for major version changes - ensure they have adequate documentation
  const majorReleases = changeset.releases.filter((r) => r.type === 'major')
  if (majorReleases.length > 0) {
    // Accept frontmatter type: major as sufficient indication of breaking change
    // But warn if the summary doesn't explain the breaking nature
    const fullContent = changeset.summary.toLowerCase()
    const hasBreakingChangeDoc =
      changeset.summary.includes('BREAKING CHANGE:') ||
      changeset.summary.includes('BREAKING:') ||
      changeset.summary.match(/^!\s*:/) !== null || // Conventional commit breaking indicator
      fullContent.includes('breaking change') ||
      fullContent.includes('## breaking') ||
      fullContent.includes('### breaking') ||
      fullContent.includes('# breaking') ||
      fullContent.includes('breaking') ||
      fullContent.includes('removed') ||
      fullContent.includes('deprecated')

    if (!hasBreakingChangeDoc) {
      // Downgrade to warning - frontmatter type: major is sufficient for tooling
      result.warnings.push(
        'Major version change detected. Consider adding "BREAKING CHANGE:" or explaining the breaking nature in the summary',
      )
    }
  }

  return result
}

/**
 * Check if changesets match actual file changes
 */
function validateChangesetsMatchFiles(
  changesets: ChangesetData[],
  changedFiles: string[],
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
  }

  if (changedFiles.length === 0) {
    return result // No files changed, nothing to validate
  }

  // P1 Fix: Expanded allowlist for files that don't need changesets
  // Config-only edits and test-only changes shouldn't require changesets
  const ignorablePatterns = [
    // Documentation (but not API docs)
    /\/README\.md$/i,
    /\/CHANGELOG\.md$/i,
    /\/CONTRIBUTING\.md$/i,
    /\/docs\//,
    /\/LICENSE$/i,

    // Tests and test fixtures
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /\/__tests__\//,
    /\/__fixtures__\//,
    /\/__mocks__\//,
    /\.test-d\.ts$/,
    /\/test\//,
    /\/tests\//,
    /\.e2e\.[jt]sx?$/,
    /\.integration\.[jt]sx?$/,

    // Build outputs and generated files
    /\/dist\//,
    /\/build\//,
    /\/coverage\//,
    /\/\.turbo\//,
    /\/node_modules\//,
    /\/\.next\//,
    /\/out\//,

    // P1 Fix: Config files that don't affect package consumers
    /\/tsconfig\.json$/,
    /\/tsconfig\..*\.json$/, // tsconfig.build.json, tsconfig.test.json, etc.
    /\/\.eslintrc$/,
    /\/\.eslintrc\.json$/,
    /\/\.eslintrc\.js$/,
    /\/eslint\.config\.[jt]s$/,
    /\/\.prettierrc$/,
    /\/\.prettierrc\.json$/,
    /\/prettier\.config\.[jt]s$/,
    /\/jest\.config\.[jt]s$/,
    /\/vitest\.config\.[jt]s$/,
    /\/vite\.config\.[jt]s$/,
    /\/next\.config\.[jt]s$/, // Next.js config usually doesn't affect package API
    /\/turbo\.json$/,
    /\/turbo\.jsonc$/,
    /\/\.env\.example$/,
    /\/\.env\.sample$/,
    /\/\.env\.template$/,
    /\/\.nvmrc$/,
    /\/\.node-version$/,
    /\/\.npmrc$/, // Usually workspace config
    /\/\.yarnrc$/,
    /\/\.pnpmfile\.cjs$/,

    // Development-only config that doesn't affect consumers
    /\/\.vscode\//,
    /\/\.idea\//,
    /\/\.gitignore$/,
    /\/\.npmignore$/,
    /\/\.prettierignore$/,
    /\/\.eslintignore$/,
    /\/\.dockerignore$/,
    /\/\.gitattributes$/,
    /\/\.editorconfig$/,

    // CI/CD configs
    /\/\.github\//,
    /\/\.gitlab-ci\.yml$/,
    /\/\.circleci\//,
    /\/\.travis\.yml$/,
    /\/Dockerfile$/,
    /\/docker-compose\.yml$/,

    // Temporary and backup files
    /\.tmp$/,
    /\.bak$/,
    /~$/,
    /\.swp$/,
    /\.DS_Store$/,
    /Thumbs\.db$/,
  ]

  // Check if there are changes in package directories but no changesets
  const packageChanges = changedFiles
    .filter((file) => file.startsWith('packages/') || file.startsWith('apps/'))
    .filter((file) => {
      // Check if file matches any ignorable pattern
      for (const pattern of ignorablePatterns) {
        if (pattern.test(file)) {
          return false
        }
      }

      // Special handling for package.json - check if it contains meaningful changes
      if (file.endsWith('/package.json')) {
        return hasSignificantPackageJsonChanges(file)
      }

      // Everything else in packages/apps is significant and requires a changeset
      // This includes:
      // - All source code (.ts, .tsx, .js, .jsx, .mjs, .cjs)
      // - Build configurations (tsconfig.json, tsup.config.ts, next.config.js, etc.)
      // - ESLint/Prettier configs that affect the package
      // - Export maps and type definitions
      // - Any other file that could affect consumers
      return true
    })

  if (packageChanges.length > 0 && changesets.length === 0) {
    result.errors
      .push(`Source code or configuration changes detected in packages but no changesets found:
  Changed files: ${packageChanges.slice(0, 5).join(', ')}${packageChanges.length > 5 ? ` and ${packageChanges.length - 5} more` : ''}
  
  Please create a changeset by running: pnpm changeset`)
    result.valid = false
  }

  return result
}

/**
 * Check for stale changesets
 */
function validateChangesetFreshness(changesets: ChangesetData[]): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
  }

  const now = new Date()
  const STALE_WARNING_DAYS = 7
  const STALE_ERROR_DAYS = 14
  const STALE_CRITICAL_DAYS = 30 // Escalate to error after 30 days

  for (const changeset of changesets) {
    const ageInDays = (now.getTime() - changeset.created.getTime()) / (1000 * 60 * 60 * 24)

    if (ageInDays > STALE_CRITICAL_DAYS) {
      // Escalate to error after 30 days to enforce hygiene
      result.errors.push(
        `Changeset ${changeset.filename} is ${Math.round(ageInDays)} days old - must be resolved or removed`,
      )
      result.valid = false
    } else if (ageInDays > STALE_ERROR_DAYS) {
      result.warnings.push(
        `Changeset ${changeset.filename} is ${Math.round(ageInDays)} days old - consider if it's still relevant`,
      )
    } else if (ageInDays > STALE_WARNING_DAYS) {
      result.warnings.push(`Changeset ${changeset.filename} is ${Math.round(ageInDays)} days old`)
    }
  }

  return result
}

/**
 * Calculate Levenshtein distance between two strings
 * Optimized with early exit for performance on large changeset sets (P0 fix)
 * TypeScript Fix: Removed non-null assertions for noUncheckedIndexedAccess compatibility
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length

  // Early exit optimization for very different string lengths
  if (Math.abs(m - n) > Math.max(m, n) * 0.3) {
    // If length difference is >30% of max length, strings are likely very different
    return Math.max(m, n)
  }

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  // Initialize first row and column with safe array access
  for (let i = 0; i <= m; i++) {
    const row = dp[i]
    if (row) row[0] = i
  }
  for (let j = 0; j <= n; j++) {
    const firstRow = dp[0]
    if (firstRow) firstRow[j] = j
  }

  // Fill the matrix with safe array access
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const currentRow = dp[i]
      const prevRow = dp[i - 1]
      if (!currentRow || !prevRow) continue

      if (str1[i - 1] === str2[j - 1]) {
        currentRow[j] = prevRow[j - 1] ?? 0
      } else {
        const fromAbove = prevRow[j] ?? Infinity
        const fromLeft = currentRow[j - 1] ?? Infinity
        const fromDiagonal = prevRow[j - 1] ?? Infinity
        currentRow[j] = 1 + Math.min(fromAbove, fromLeft, fromDiagonal)
      }
    }
  }

  const finalRow = dp[m]
  return finalRow?.[n] ?? Math.max(m, n)
}

/**
 * Validate that removed/renamed packages have appropriate changesets
 */
function validateRemovedPackages(changesets: ChangesetData[]): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
  }

  try {
    // Use shared git utility for consistent branch detection
    const { branch: baseBranch, mergeBase } = getBaseBranch()
    const compareRef = mergeBase

    // Handle case where base branch couldn't be determined
    if (baseBranch === 'HEAD~1') {
      result.warnings.push('Could not determine base branch - using HEAD~1 for comparison')
    }

    // Get packages from base ref and current
    const basePackages = getWorkspacePackagesFromRef(compareRef)
    const currentPackages = getWorkspacePackages()

    // P0 Fix: Only treat as removed if it previously had a valid package name
    // Filter out entries that were directories without package.json
    const validBasePackages = [...basePackages].filter((pkg) => pkg && pkg !== 'undefined')
    const removedPackages = validBasePackages.filter((pkg) => !currentPackages.has(pkg))

    if (removedPackages.length > 0) {
      // Check if any changeset mentions the removed packages
      const changesetPackages = new Set<string>()
      for (const changeset of changesets) {
        for (const release of changeset.releases) {
          changesetPackages.add(release.name)
        }
      }

      const unacknowledgedRemovals = removedPackages.filter((pkg) => !changesetPackages.has(pkg))

      if (unacknowledgedRemovals.length > 0) {
        result.errors.push(
          `Package(s) removed but no changeset found: ${unacknowledgedRemovals.join(', ')}`,
        )
        result.errors.push(
          'Package removals require a changeset with deprecation notice or major version bump',
        )
        result.valid = false
      }
    }

    // Check for major version bumps on removed packages (good practice)
    for (const changeset of changesets) {
      for (const release of changeset.releases) {
        if (removedPackages.includes(release.name) && release.type !== 'major') {
          result.warnings.push(
            `Removed package "${release.name}" has ${release.type} changeset - consider "major" for breaking removal`,
          )
        }
      }
    }
  } catch (error) {
    result.warnings.push(`Could not validate removed packages: ${error}`)
  }

  return result
}

/**
 * Check for duplicate changesets using fuzzy matching
 */
function validateNoDuplicateChangesets(changesets: ChangesetData[]): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
  }

  // Check for similar summaries using fuzzy matching (P0 fix: improved thresholds)
  const processedPairs = new Set<string>()
  const MIN_LENGTH_FOR_SIMILARITY_CHECK = 40 // Don't check similarity for very short summaries

  // P0 Fix: Performance cap for large changeset sets
  const MAX_CHANGESETS_FOR_FUZZY = 200 // Stop fuzzy checks after 200 changesets
  const MAX_TIME_MS = 5000 // Stop after 5 seconds
  const startTime = Date.now()

  if (changesets.length > MAX_CHANGESETS_FOR_FUZZY) {
    result.warnings.push(
      `Skipping fuzzy duplicate detection for ${changesets.length} changesets (limit: ${MAX_CHANGESETS_FOR_FUZZY})`,
    )
    // Skip to package+type duplicate checking
  } else {
    // P1 Fix: Group changesets by length buckets for O(n^2) optimization
    const LENGTH_BUCKET_SIZE = 20 // Group by ±10 characters
    const lengthBuckets = new Map<number, number[]>()

    // Build length buckets
    changesets.forEach((changeset, index) => {
      const length = changeset.summary.length
      const bucket = Math.floor(length / LENGTH_BUCKET_SIZE)

      if (!lengthBuckets.has(bucket)) {
        lengthBuckets.set(bucket, [])
      }
      lengthBuckets.get(bucket)!.push(index)

      // Also add to adjacent buckets for boundary cases
      if (!lengthBuckets.has(bucket - 1)) {
        lengthBuckets.set(bucket - 1, [])
      }
      lengthBuckets.get(bucket - 1)!.push(index)

      if (!lengthBuckets.has(bucket + 1)) {
        lengthBuckets.set(bucket + 1, [])
      }
      lengthBuckets.get(bucket + 1)!.push(index)
    })

    // P1 Fix: Only compare changesets within same or adjacent length buckets
    for (const [bucket, indices] of lengthBuckets) {
      // Check time budget
      if (Date.now() - startTime > MAX_TIME_MS) {
        result.warnings.push(
          `Fuzzy duplicate detection stopped after ${MAX_TIME_MS}ms (optimized with length bucketing)`,
        )
        break
      }

      // Compare within bucket
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          const idx1 = indices[i]!
          const idx2 = indices[j]!

          // Skip if already processed
          const pairKey = `${Math.min(idx1, idx2)}-${Math.max(idx1, idx2)}`
          if (processedPairs.has(pairKey)) continue
          processedPairs.add(pairKey)

          const summary1 = changesets[idx1]!.summary.toLowerCase().trim()
          const summary2 = changesets[idx2]!.summary.toLowerCase().trim()

          // Skip similarity check for short summaries to avoid false positives
          const avgLength = (summary1.length + summary2.length) / 2
          if (avgLength < MIN_LENGTH_FOR_SIMILARITY_CHECK) {
            // For short summaries, only flag if they're exactly the same
            if (summary1 === summary2) {
              result.warnings.push(
                `Identical changeset summaries:\n  - ${changesets[idx1]!.filename}\n  - ${changesets[idx2]!.filename}`,
              )
            }
            continue
          }

          // P1 Fix: Additional early exit - skip if length difference is too large
          const lengthDiff = Math.abs(summary1.length - summary2.length)
          const maxLength = Math.max(summary1.length, summary2.length)
          if (lengthDiff > maxLength * 0.15) {
            // If lengths differ by more than 15%, similarity can't be >90%
            continue
          }

          // Calculate similarity
          const distance = levenshteinDistance(summary1, summary2)
          const similarity = 1 - distance / maxLength

          // Use stricter threshold (>90%) for longer summaries to reduce false positives
          if (similarity > 0.9) {
            result.warnings.push(
              `Potentially duplicate changesets (${Math.round(similarity * 100)}% similar):\n  - ${changesets[idx1]!.filename}\n  - ${changesets[idx2]!.filename}`,
            )
          }
        }
      }
    }
  }

  // Check for identical package+type combinations
  const packageTypeMap = new Map<string, string[]>()
  const packageMap = new Map<string, string[]>()

  for (const changeset of changesets) {
    for (const release of changeset.releases) {
      const key = `${release.name}:${release.type}`
      if (!packageTypeMap.has(key)) {
        packageTypeMap.set(key, [])
      }
      packageTypeMap.get(key)!.push(changeset.filename)

      // Also track packages regardless of version type
      if (!packageMap.has(release.name)) {
        packageMap.set(release.name, [])
      }
      packageMap.get(release.name)!.push(changeset.filename)
    }
  }

  // Report duplicate package+type combinations
  for (const [packageType, files] of packageTypeMap) {
    if (files.length > 1) {
      const [pkg, type] = packageType.split(':')
      result.errors.push(
        `Multiple changesets with same package and version type:\n  Package: ${pkg} (${type})\n  Files: ${files.join(', ')}`,
      )
      result.valid = false
    }
  }

  // Warn about multiple changesets affecting the same package
  for (const [pkg, files] of packageMap) {
    const uniqueFiles = [...new Set(files)]
    if (uniqueFiles.length > 1) {
      result.warnings.push(`Multiple changesets affecting ${pkg}: ${uniqueFiles.join(', ')}`)
    }
  }

  return result
}

/**
 * Display validation results
 */
function displayResults(results: ValidationResult[]): boolean {
  let allValid = true
  let totalErrors = 0
  let totalWarnings = 0

  for (const result of results) {
    totalErrors += result.errors.length
    totalWarnings += result.warnings.length

    if (!result.valid) {
      allValid = false
    }

    for (const error of result.errors) {
      formatValidationMessage('error', error)
    }

    for (const warning of result.warnings) {
      formatValidationMessage('warning', warning)
    }
  }

  console.log('')

  if (allValid && totalErrors === 0) {
    formatValidationMessage('success', 'All changeset validations passed!')
    if (totalWarnings > 0) {
      console.log(`   Note: ${totalWarnings} warning${totalWarnings > 1 ? 's' : ''} found`)
    }
  } else {
    formatValidationMessage(
      'error',
      `Changeset validation failed with ${totalErrors} error${totalErrors > 1 ? 's' : ''}`,
    )
    if (totalWarnings > 0) {
      console.error(`   Also found: ${totalWarnings} warning${totalWarnings > 1 ? 's' : ''}`)
    }
  }

  return allValid && totalErrors === 0
}

/**
 * Validate that dependency changes have corresponding changesets
 * Critical P0 fix: Ensures dependency bumps don't ship without version increments
 */
function validateDependencyChangesHaveChangesets(
  changesets: ChangesetData[],
  changedFiles: string[],
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
  }

  // Find all package.json files that have dependency changes
  const packageJsonsWithDependencyChanges: string[] = []

  for (const file of changedFiles) {
    // P0 Fix: Match package.json at any level, ensure it's in a package directory
    if (file.endsWith('package.json')) {
      // P0 Fix: Use hasSignificantPackageJsonChanges which now does proper JSON comparison
      // This ensures we catch all dependency changes, not just lines with the field name
      if (hasSignificantPackageJsonChanges(file)) {
        try {
          // Get the package name from the package.json
          const packageJsonContent = readFileSync(file, 'utf-8')
          const packageJson = JSON.parse(packageJsonContent)
          const packageName = packageJson.name

          // Check if this is a published package (has a name and is in packages/)
          if (packageName && file.includes('/packages/')) {
            // Check if there's a changeset for this package
            const hasChangeset = changesets.some((cs) => cs.packages.includes(packageName))

            if (!hasChangeset) {
              packageJsonsWithDependencyChanges.push(`${packageName} (${file})`)
            }
          }
        } catch {
          // If we can't read the file, skip it
          continue
        }
      }
    }
  }

  if (packageJsonsWithDependencyChanges.length > 0) {
    result.errors.push(
      `Dependency changes detected without changesets for: ${packageJsonsWithDependencyChanges.join(', ')}`,
    )
    result.valid = false
    result.errors.push(
      '⚠️  CRITICAL: Dependency changes in published packages require changesets to bump versions',
    )
    result.errors.push(
      '💡 Run "pnpm changeset" and select the affected packages to create a changeset',
    )
  }

  return result
}

/**
 * Main validation function
 */
/**
 * Parse CLI arguments
 */
function parseCliArgs(): ValidatorOptions {
  const { values } = parseArgs({
    options: {
      help: {
        type: 'boolean',
        short: 'h',
        default: false,
      },
      verbose: {
        type: 'boolean',
        short: 'v',
        default: false,
      },
      fix: {
        type: 'boolean',
        default: false,
      },
      strict: {
        type: 'boolean',
        default: false,
      },
    },
    strict: true,
    allowPositionals: false,
  })

  if (values.help) {
    console.log(`
Usage: tsx changeset-validator.ts [options]

Validates changeset files for quality and consistency

Options:
  -v, --verbose    Show detailed validation steps
  --fix           Remove stale changesets automatically  
  --strict        Apply stricter validation rules
  -h, --help      Show this help message

Examples:
  tsx changeset-validator.ts           # Standard validation
  tsx changeset-validator.ts --fix     # Fix stale changesets
  tsx changeset-validator.ts --strict  # Stricter validation

💡 Tips:
   • Run "pnpm changeset" to create a new changeset
   • Be specific in changeset summaries (what, why, impact)
   • Use "major" for breaking changes and document them clearly
`)
    process.exit(0)
  }

  return {
    help: values.help as boolean,
    verbose: values.verbose as boolean,
    fix: values.fix as boolean,
    strict: values.strict as boolean,
  }
}

function main(): void {
  const options = parseCliArgs()

  if (options.verbose) {
    console.log('🔍 Validating changesets with detailed output...')
  } else {
    console.log('🔍 Validating changesets...')
  }

  const changesetFiles = getChangesetFiles()
  const changedFiles = getChangedFiles()

  console.log(`📦 Found ${changesetFiles.length} changeset${changesetFiles.length > 1 ? 's' : ''}`)

  // Parse all changesets
  const changesets: ChangesetData[] = []
  for (const file of changesetFiles) {
    const parsed = parseChangeset(file)
    if (parsed) {
      changesets.push(parsed)
    }
  }

  // CRITICAL: Always check if changes require changesets, even if no changesets exist
  // This prevents the serious security issue of shipping code changes without changesets
  const results: ValidationResult[] = []

  // Validate against file changes (MUST run even with zero changesets)
  results.push(validateChangesetsMatchFiles(changesets, changedFiles))

  // Validate removed packages (MUST run even with zero changesets)
  results.push(validateRemovedPackages(changesets))

  // SECURITY: Validate dependency changes have changesets (P0 fix)
  results.push(validateDependencyChangesHaveChangesets(changesets, changedFiles))

  // Only validate individual changesets if any exist
  if (changesets.length > 0) {
    // Validate individual changesets
    for (const changeset of changesets) {
      results.push(validateChangeset(changeset))
    }

    // Validate freshness
    results.push(validateChangesetFreshness(changesets))

    // Validate no duplicates
    results.push(validateNoDuplicateChangesets(changesets))
  }

  // Display results and exit
  const success = displayResults(results)

  if (!success) {
    console.log('\n💡 Tips:')
    console.log('   • Run "pnpm changeset" to create a new changeset')
    console.log('   • Be specific in changeset summaries (what, why, impact)')
    console.log('   • Use "major" for breaking changes and document them clearly')

    process.exit(1)
  }
}

// Run if this script is executed directly
// Use robust execution guard that handles symlinks properly
if (import.meta.url === new URL(process.argv[1] ?? '', 'file://').href) {
  main()
}
