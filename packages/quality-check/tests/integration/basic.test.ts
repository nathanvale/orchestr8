/**
 * Basic integration test for @template/quality-check
 */

import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'

import { createLogger } from '@orchestr8/logger'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { QualityChecker } from '../../src/core/quality-checker.js'
import { GitIntegration } from '../../src/git/git-integration.js'
import { fileMode } from '../../src/modes/file-mode.js'
import type { QualityCheckOptions } from '../../src/types.js'

describe('Quality Check Integration', () => {
  let testDir: string
  let testFile: string
  let logger: any

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = path.join(tmpdir(), `qc-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })

    // Create a test TypeScript file
    testFile = path.join(testDir, 'test.ts')
    await fs.writeFile(
      testFile,
      `
// Test file for quality checking
export function hello(name: string): string {
  return \`Hello, \${name}!\`
}

export function add(a: number, b: number): number {
  return a + b
}
`,
    )

    // Create logger
    logger = await createLogger({
      name: 'test',
      level: 'error', // Keep tests quiet
    })
  })

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true, force: true })
    }
  })

  test('should successfully check a valid TypeScript file', async () => {
    const options: QualityCheckOptions = {
      eslint: false, // Skip ESLint for basic test
      prettier: false, // Skip Prettier for basic test
      typescript: true,
      fix: false,
      parallel: true,
      respectGitignore: false,
      timeout: 5000,
      correlationId: 'test-123',
    }

    const result = await fileMode(testFile, options, logger)

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.correlationId).toBe('test-123')
    expect(result.errors).toHaveLength(0)
    expect(result.duration).toBeGreaterThan(0)
    expect(result.duration).toBeLessThan(2000) // Should complete in under 2s
  })

  test('should handle missing file gracefully', async () => {
    const missingFile = path.join(testDir, 'missing.ts')

    const options: QualityCheckOptions = {
      eslint: false,
      prettier: false,
      typescript: true,
      fix: false,
      parallel: true,
      respectGitignore: false,
      timeout: 5000,
      correlationId: 'test-456',
    }

    const result = await fileMode(missingFile, options, logger)

    expect(result).toBeDefined()
    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('no such file')
  })

  test('performance: should complete all checks in under 2 seconds', async () => {
    const options: QualityCheckOptions = {
      eslint: true,
      prettier: true,
      typescript: true,
      fix: false,
      parallel: true, // Enable parallel execution
      respectGitignore: false,
      timeout: 5000,
      correlationId: 'perf-test',
    }

    const startTime = performance.now()
    const result = await fileMode(testFile, options, logger)
    const endTime = performance.now()
    const totalDuration = endTime - startTime

    expect(result).toBeDefined()
    expect(totalDuration).toBeLessThan(2000) // Total should be under 2s
    expect(result.duration).toBeLessThan(2000) // Reported duration should also be under 2s

    console.log(`Performance test completed in ${totalDuration.toFixed(2)}ms`)
  })

  test('should create QualityChecker instance directly', async () => {
    const checker = new QualityChecker(
      testFile,
      {
        eslint: false,
        prettier: false,
        typescript: true,
        fix: false,
        parallel: true,
        respectGitignore: false,
        timeout: 5000,
        correlationId: 'direct-test',
      },
      logger,
    )

    const result = await checker.check()

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.correlationId).toBe('direct-test')
  })

  describe('Git Integration', () => {
    test('should handle git repository detection', async () => {
      const gitIntegration = new GitIntegration(testDir, logger)
      const gitInfo = await gitIntegration.getGitInfo()

      // In a temporary directory, there should be no git repository
      expect(gitInfo.isGitRepository).toBe(false)
      expect(gitInfo.hasGitignore).toBe(false)
    })

    test('should handle gitignore patterns with respect option', async () => {
      const options: QualityCheckOptions = {
        eslint: false,
        prettier: false,
        typescript: true,
        fix: false,
        parallel: true,
        respectGitignore: true,
        timeout: 5000,
        correlationId: 'git-test',
      }

      // Without git repository, should process file normally
      const result = await fileMode(testFile, options, logger)

      expect(result.success).toBe(true)
      expect(result.correlationId).toBe('git-test')
    })

    test('should detect non-git repository gracefully', async () => {
      const isGitRepo = await GitIntegration.isInGitRepository(testDir)
      expect(isGitRepo).toBe(false)

      const gitRoot = await GitIntegration.findGitRoot(testDir)
      expect(gitRoot).toBe(null)
    })

    test('should handle gitignore filtering when respectGitignore is false', async () => {
      const options: QualityCheckOptions = {
        eslint: false,
        prettier: false,
        typescript: true,
        fix: false,
        parallel: true,
        respectGitignore: false, // Explicitly disabled
        timeout: 5000,
        correlationId: 'no-git-test',
      }

      const result = await fileMode(testFile, options, logger)

      expect(result.success).toBe(true)
      expect(result.correlationId).toBe('no-git-test')
      expect(result.errors).toHaveLength(0)
    })

    test('should handle pre-commit mode in non-git repository', async () => {
      const options: QualityCheckOptions = {
        eslint: false,
        prettier: false,
        typescript: true,
        fix: false,
        parallel: true,
        preCommit: true, // Pre-commit mode
        respectGitignore: false,
        timeout: 5000,
        correlationId: 'precommit-test',
      }

      const result = await fileMode(testFile, options, logger)

      // In non-git repo, pre-commit mode should still work but warn
      expect(result.success).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some((w) => w.includes('not staged'))).toBe(true)
    })

    test('GitIntegration should initialize without errors', async () => {
      const gitIntegration = new GitIntegration(testDir, logger)

      // Test basic methods don't throw
      expect(() => gitIntegration).not.toThrow()

      const gitInfo = await gitIntegration.initialize()
      expect(gitInfo).toBeDefined()
      expect(gitInfo.isGitRepository).toBe(false)
    })

    test('should handle file filtering correctly', async () => {
      const gitIntegration = new GitIntegration(testDir, logger)

      const files = [testFile]
      const filtered = await gitIntegration.filterFiles(files, {
        respectGitignore: false,
        preCommitMode: false,
      })

      // No filtering should occur without git repo
      expect(filtered).toEqual(files)
    })

    test('should handle staged files in non-git repository', async () => {
      const gitIntegration = new GitIntegration(testDir, logger)

      const stagedFiles = await gitIntegration.getStagedFiles()
      expect(stagedFiles).toEqual([]) // No staged files in non-git repo
    })

    test('should not ignore files when respectGitignore is disabled', async () => {
      const gitIntegration = new GitIntegration(testDir, logger)

      const shouldIgnore = await gitIntegration.shouldIgnoreFile(testFile, {
        respectGitignore: false,
      })

      expect(shouldIgnore).toBe(false)
    })
  })
})
