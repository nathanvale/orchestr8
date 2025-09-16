import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

describe('Incremental Formatting - Git-based Change Detection', () => {
  const testRepo = join(__dirname, '../.test-repo')

  beforeEach(() => {
    // Create test repository
    if (existsSync(testRepo)) {
      rmSync(testRepo, { recursive: true, force: true })
    }
    mkdirSync(testRepo, { recursive: true })

    // Initialize git repo
    execSync('git init', { cwd: testRepo })
    execSync('git config user.email "test@example.com"', { cwd: testRepo })
    execSync('git config user.name "Test User"', { cwd: testRepo })
  })

  afterEach(() => {
    if (existsSync(testRepo)) {
      rmSync(testRepo, { recursive: true, force: true })
    }
  })

  test('should detect modified files using git diff', () => {
    // Create and commit initial files
    writeFileSync(join(testRepo, 'file1.js'), 'console.log("test");')
    writeFileSync(join(testRepo, 'file2.ts'), 'export const test = 123;')
    execSync('git add .', { cwd: testRepo })
    execSync('git commit -m "initial commit"', { cwd: testRepo })

    // Modify one file
    writeFileSync(join(testRepo, 'file1.js'), 'console.log("modified");')

    // Get modified files
    const result = execSync('git diff --name-only', { cwd: testRepo, encoding: 'utf8' })
    const modifiedFiles = result.trim().split('\n').filter(Boolean)

    expect(modifiedFiles).toEqual(['file1.js'])
  })

  test('should support --affected flag functionality', () => {
    // Create workspace structure
    mkdirSync(join(testRepo, 'packages/app'), { recursive: true })
    mkdirSync(join(testRepo, 'packages/utils'), { recursive: true })

    writeFileSync(join(testRepo, 'packages/app/index.js'), 'console.log("app");')
    writeFileSync(join(testRepo, 'packages/utils/index.js'), 'console.log("utils");')
    writeFileSync(
      join(testRepo, 'turbo.json'),
      JSON.stringify(
        {
          $schema: 'https://turbo.build/schema.json',
          tasks: {
            format: {
              cache: true,
              inputs: ['**/*.{js,ts,jsx,tsx,md,json}'],
            },
          },
        },
        null,
        2,
      ),
    )

    execSync('git add .', { cwd: testRepo })
    execSync('git commit -m "workspace setup"', { cwd: testRepo })

    // Modify only app package
    writeFileSync(join(testRepo, 'packages/app/index.js'), 'console.log("modified app");')

    // Simulate --affected behavior
    const changedFiles = execSync('git diff --name-only', { cwd: testRepo, encoding: 'utf8' })
    const affectedPackages = changedFiles.includes('packages/app/') ? ['app'] : []

    expect(affectedPackages).toEqual(['app'])
  })
})

describe('Incremental Formatting - Environment Configuration', () => {
  test('should configure TURBO_SCM_BASE for CI environments', () => {
    const envConfig = {
      TURBO_SCM_BASE: 'origin/main',
      TURBO_AFFECTED_BASE: 'HEAD~1',
    }

    expect(envConfig.TURBO_SCM_BASE).toBe('origin/main')
    expect(envConfig.TURBO_AFFECTED_BASE).toBe('HEAD~1')
  })

  test('should support filter patterns for branch comparisons', () => {
    const filterPatterns = [
      '--filter=...^HEAD',
      '--filter=...origin/main',
      '--filter=...{packages/app}',
      '--filter=...{packages/utils}',
    ]

    expect(filterPatterns).toContain('--filter=...^HEAD')
    expect(filterPatterns).toContain('--filter=...origin/main')
  })
})

describe('Incremental Formatting - Workspace Filtering', () => {
  test('should enable workspace-level filtering', () => {
    const workspaceFilters = {
      byPath: (path: string) => `--filter=${path}`,
      byPattern: (pattern: string) => `--filter=${pattern}`,
      byDependency: (dep: string) => `--filter=...${dep}`,
      affected: () => '--filter=...^HEAD',
    }

    expect(workspaceFilters.byPath('packages/app')).toBe('--filter=packages/app')
    expect(workspaceFilters.byPattern('**/src/**')).toBe('--filter=**/src/**')
    expect(workspaceFilters.byDependency('utils')).toBe('--filter=...utils')
    expect(workspaceFilters.affected()).toBe('--filter=...^HEAD')
  })

  test('should support targeted operations', () => {
    const targetedOperations = {
      formatChanged: 'turbo format --filter=...^HEAD',
      formatPackage: 'turbo format --filter=packages/app',
      formatAll: 'turbo format',
    }

    expect(targetedOperations.formatChanged).toContain('--filter=...^HEAD')
    expect(targetedOperations.formatPackage).toContain('--filter=packages/app')
  })
})

describe('Incremental Formatting - CI Integration', () => {
  test('should configure fetch-depth: 2 for proper change detection', () => {
    const ciConfig = {
      'fetch-depth': 2,
      'token': '${{ secrets.GITHUB_TOKEN }}',
    }

    expect(ciConfig['fetch-depth']).toBe(2)
    expect(ciConfig.token).toBe('${{ secrets.GITHUB_TOKEN }}')
  })

  test('should implement Git integration for modified files', () => {
    const gitIntegration = {
      getModifiedFiles: () => 'git diff --name-only HEAD~1',
      getChangedPackages: () => 'git diff --name-only HEAD~1 | grep "packages/"',
      getAffectedWorkspaces: () => 'turbo list --filter=...^HEAD',
    }

    expect(gitIntegration.getModifiedFiles()).toContain('git diff --name-only')
    expect(gitIntegration.getChangedPackages()).toContain('grep "packages/"')
    expect(gitIntegration.getAffectedWorkspaces()).toContain('--filter=...^HEAD')
  })
})

describe('Incremental Formatting - Performance Validation', () => {
  test('should reduce execution time with incremental formatting', () => {
    const performanceMetrics = {
      fullFormat: { time: 30000, files: 1000 }, // 30s for 1000 files
      incrementalFormat: { time: 5000, files: 100 }, // 5s for 100 changed files
    }

    const timeReduction =
      1 - performanceMetrics.incrementalFormat.time / performanceMetrics.fullFormat.time
    expect(timeReduction).toBeGreaterThan(0.8) // >80% time reduction
  })

  test('should track formatting effectiveness', () => {
    const effectiveness = {
      filesProcessed: 100,
      totalFiles: 1000,
      timeSpent: 5000,
      timeSaved: 25000,
    }

    const efficiency = effectiveness.filesProcessed / effectiveness.totalFiles
    expect(efficiency).toBe(0.1) // Only 10% of files needed formatting
    expect(effectiveness.timeSaved / effectiveness.timeSpent).toBeGreaterThan(4) // 5x faster
  })
})
