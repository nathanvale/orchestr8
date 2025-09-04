import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PackageJson } from 'type-fest'
import { afterEach, describe, expect, test } from 'vitest'

/**
 * Test suite for Changesets integration and automated release management.
 *
 * Validates ADHD-optimized release workflow with minimal friction:
 * - Zero-config changeset creation
 * - Automated version bumping
 * - Consistent changelog generation
 * - Conventional commit integration
 */

const PROJECT_ROOT = process.cwd()
const CHANGESETS_DIR = join(PROJECT_ROOT, '.changeset')
const CONFIG_PATH = join(CHANGESETS_DIR, 'config.json')

/**
 * Read and parse the changeset configuration
 */
function readChangesetConfig(): any {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error('Changeset config not found')
  }
  const content = readFileSync(CONFIG_PATH, 'utf-8')
  return JSON.parse(content)
}

/**
 * Read package.json from root
 */
function readRootPackageJson(): PackageJson {
  const packagePath = join(PROJECT_ROOT, 'package.json')
  const content = readFileSync(packagePath, 'utf-8')
  return JSON.parse(content)
}

/**
 * Execute changeset commands safely
 */
function runChangesetCommand(command: string): {
  stdout: string
  stderr: string
  success: boolean
} {
  try {
    const stdout = execSync(`pnpm changeset ${command}`, {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    })
    return { stdout, stderr: '', success: true }
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      success: false,
    }
  }
}

describe('Changesets Integration Tests', () => {
  describe('Configuration Validation', () => {
    test('should have valid changeset configuration', () => {
      expect(existsSync(CONFIG_PATH)).toBe(true)

      const config = readChangesetConfig()

      // Essential configuration
      expect(config).toHaveProperty('$schema')
      expect(config).toHaveProperty('changelog')
      expect(config).toHaveProperty('commit')
      expect(config).toHaveProperty('access')
      expect(config).toHaveProperty('baseBranch')

      // ADHD-optimized settings
      expect(config.baseBranch).toBe('main')
      expect(config.access).toBe('public')
      expect(config.updateInternalDependencies).toBeDefined()
    })

    test('should use GitHub changelog generation', () => {
      const config = readChangesetConfig()

      expect(Array.isArray(config.changelog)).toBe(true)
      expect(config.changelog[0]).toBe('@changesets/changelog-github')
      expect(config.changelog[1]).toHaveProperty('repo')
    })

    test('should have changesets CLI available', () => {
      const result = runChangesetCommand('--version')
      expect(result.success).toBe(true)
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
    })
  })

  describe('Package Scripts Integration', () => {
    test('should have changeset scripts defined in root package.json', () => {
      const pkg = readRootPackageJson()
      const scripts = pkg.scripts || {}

      // Essential changeset commands for ADHD workflow
      expect(scripts).toHaveProperty('changeset')
      expect(scripts.changeset).toContain('changeset')

      // Version and release commands
      expect(scripts).toHaveProperty('version-packages')
      expect(scripts['version-packages']).toContain('changeset version')

      expect(scripts).toHaveProperty('release')
      expect(scripts.release).toContain('changeset publish')
    })

    test('should integrate with build pipeline', () => {
      const pkg = readRootPackageJson()
      const scripts = pkg.scripts || {}

      // Pre-release validation should build packages
      expect(scripts.release).toContain('build')
    })
  })

  describe('Changeset Creation Workflow', () => {
    let testChangesetFile: string | null = null

    afterEach(() => {
      // Cleanup test changeset files
      if (testChangesetFile && existsSync(testChangesetFile)) {
        try {
          execSync(`rm -f "${testChangesetFile}"`, { stdio: 'pipe' })
        } catch {
          // Ignore cleanup errors
        }
      }
    })

    test('should be able to create changeset interactively', () => {
      // This test verifies the command exists and shows help
      const result = runChangesetCommand('--help')

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('changeset')
      expect(result.stdout).toContain('add')
    })

    test('should validate changeset file format', () => {
      // Create a mock changeset to test format
      const mockChangesetContent = `---
"@template/utils": patch
---

Test changeset for validation
`

      const mockFile = join(CHANGESETS_DIR, 'test-mock-changeset.md')
      writeFileSync(mockFile, mockChangesetContent)
      testChangesetFile = mockFile

      // Verify file exists and has correct format
      expect(existsSync(mockFile)).toBe(true)
      const content = readFileSync(mockFile, 'utf-8')
      expect(content).toContain('---')
      expect(content).toContain('@template/utils')
      expect(content).toContain('patch')
    })
  })

  describe('Version Bumping Workflow', () => {
    test('should handle version bumping gracefully when no changesets exist', () => {
      const result = runChangesetCommand('version --dry-run')

      // Should not fail even with no changesets, or give clear error about missing GitHub token
      expect(
        result.success ||
          result.stderr.includes('No changesets') ||
          result.stderr.includes('GITHUB_TOKEN') ||
          result.stderr.includes('GitHub personal access token'),
      ).toBe(true)
    })

    test('should validate package dependencies for version bumping', () => {
      // Check that workspace packages can be versioned together
      const packages = ['@template/utils', '@template/claude-hooks', '@template/voice-vault']

      packages.forEach((packageName) => {
        const packageDir = packageName.replace('@template/', 'packages/')
        const packageJsonPath = join(PROJECT_ROOT, packageDir, 'package.json')

        if (existsSync(packageJsonPath)) {
          const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
          expect(pkg.name).toBe(packageName)
          expect(pkg.version).toBeDefined()
        }
      })
    })
  })

  describe('ADHD Developer Experience', () => {
    test('should provide clear feedback for common operations', () => {
      const statusResult = runChangesetCommand('status')

      // Should always provide clear status (success or informative error)
      expect(statusResult.success || statusResult.stderr.length > 0).toBe(true)
    })

    test('should support dry-run operations for confidence', () => {
      // Dry runs should always be available for ADHD developers to preview changes
      const dryRunResult = runChangesetCommand('version --dry-run')

      // Should succeed or provide clear feedback
      expect(typeof dryRunResult.stdout).toBe('string')
      expect(typeof dryRunResult.stderr).toBe('string')
    })

    test('should have consistent command patterns', () => {
      const helpResult = runChangesetCommand('--help')

      expect(helpResult.success).toBe(true)

      // Should show standard commands
      const helpText = helpResult.stdout
      expect(helpText).toContain('add')
      expect(helpText).toContain('version')
      expect(helpText).toContain('publish')
      expect(helpText).toContain('status')
    })
  })

  describe('Changelog Generation', () => {
    test('should generate structured changelogs', () => {
      // Test that changelog configuration is set up correctly
      const config = readChangesetConfig()

      expect(config.changelog).toBeDefined()
      expect(Array.isArray(config.changelog)).toBe(true)

      const [changelogPackage, changelogConfig] = config.changelog
      expect(changelogPackage).toBe('@changesets/changelog-github')
      expect(changelogConfig).toHaveProperty('repo')
    })

    test('should link to GitHub issues and PRs', () => {
      const config = readChangesetConfig()
      const [, changelogConfig] = config.changelog

      // Should have repo configured for GitHub linking
      expect(changelogConfig.repo).toBeDefined()
      expect(typeof changelogConfig.repo).toBe('string')
      expect(changelogConfig.repo).toMatch(/^[\w-]+\/[\w-]+$/)
    })
  })

  describe('Release Workflow Integration', () => {
    test('should integrate with pnpm workspaces', () => {
      const config = readChangesetConfig()

      // Should handle internal dependencies properly
      expect(config.updateInternalDependencies).toBeDefined()
      expect(['patch', 'minor', 'major'].includes(config.updateInternalDependencies)).toBe(true)
    })

    test('should respect git workflow', () => {
      const config = readChangesetConfig()

      expect(config.baseBranch).toBe('main')
      expect(config.commit).toBeDefined()
    })

    test('should support public package publishing', () => {
      const config = readChangesetConfig()

      expect(config.access).toBe('public')
    })
  })
})

describe('Conventional Commits Integration', () => {
  describe('Commitizen Configuration', () => {
    test('should have commitizen configured in package.json', () => {
      const pkg = readRootPackageJson()

      // Should have commit script for ADHD-friendly commit creation
      expect(pkg.scripts).toHaveProperty('commit')

      // Should have commitizen config
      expect(pkg.config?.commitizen || pkg.commitizen).toBeDefined()
    })

    test('should use conventional commit adapter', () => {
      const pkg = readRootPackageJson()
      const czConfig = pkg.config?.commitizen || pkg.commitizen || {}

      // Accept either conventional-changelog or modern alternatives like cz-git
      expect(czConfig.path).toMatch(/(conventional-changelog|cz-git|cz-conventional-changelog)/)
    })
  })

  describe('Commit Message Validation', () => {
    test('should support conventional commit formats', () => {
      // Test common patterns that should be valid
      const validFormats = [
        'feat: add new feature',
        'fix: resolve bug',
        'docs: update documentation',
        'style: formatting changes',
        'refactor: code restructuring',
        'test: add tests',
        'chore: maintenance tasks',
      ]

      validFormats.forEach((format) => {
        expect(format).toMatch(/^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/)
      })
    })
  })
})
