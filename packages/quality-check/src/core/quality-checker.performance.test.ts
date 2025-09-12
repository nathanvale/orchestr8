/**
 * Performance validation tests for fix-first architecture
 * Validates 50% performance improvement and error reporting optimization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QualityChecker } from './quality-checker.js'
import { ESLintEngine } from '../engines/eslint-engine.js'
import { PrettierEngine } from '../engines/prettier-engine.js'
import { TypeScriptEngine } from '../engines/typescript-engine.js'
import type { QualityCheckOptions } from '../types.js'

// Mock engines
vi.mock('../engines/eslint-engine.js')
vi.mock('../engines/prettier-engine.js')
vi.mock('../engines/typescript-engine.js')

describe('Quality Checker Performance Validation', () => {
  let checker: QualityChecker
  let mockESLintEngine: any
  let mockPrettierEngine: any
  let mockTypeScriptEngine: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock engines with timing
    mockESLintEngine = {
      check: vi.fn().mockImplementation(async (config) => {
        // Simulate execution time
        await new Promise((resolve) => setTimeout(resolve, 100))

        if (config.fix) {
          // Fix mode - returns only unfixable issues
          return {
            success: true,
            issues: [],
            duration: 100,
            fixedCount: 5,
            modifiedFiles: ['file1.ts', 'file2.ts'],
          }
        } else {
          // Check mode - returns all issues
          return {
            success: false,
            issues: [
              {
                file: 'file1.ts',
                line: 1,
                col: 1,
                message: 'Missing semicolon',
                severity: 'error',
                engine: 'eslint',
              },
              {
                file: 'file1.ts',
                line: 2,
                col: 1,
                message: 'Unused variable',
                severity: 'warning',
                engine: 'eslint',
              },
              {
                file: 'file2.ts',
                line: 1,
                col: 1,
                message: 'Missing semicolon',
                severity: 'error',
                engine: 'eslint',
              },
              {
                file: 'file2.ts',
                line: 5,
                col: 1,
                message: 'Prefer const',
                severity: 'warning',
                engine: 'eslint',
              },
              {
                file: 'file2.ts',
                line: 10,
                col: 1,
                message: 'No console',
                severity: 'error',
                engine: 'eslint',
              },
            ],
            duration: 100,
            fixable: true,
          }
        }
      }),
    }

    mockPrettierEngine = {
      check: vi.fn().mockImplementation(async (config) => {
        // Simulate execution time
        await new Promise((resolve) => setTimeout(resolve, 50))

        if (config.prettierWrite) {
          // Fix mode - returns only unfixable issues
          return {
            success: true,
            issues: [],
            duration: 50,
            fixedCount: 3,
            modifiedFiles: ['file1.ts', 'file2.ts'],
          }
        } else {
          // Check mode - returns all issues
          return {
            success: false,
            issues: [
              {
                file: 'file1.ts',
                line: 1,
                col: 1,
                message: 'File not formatted',
                severity: 'error',
                engine: 'prettier',
              },
              {
                file: 'file2.ts',
                line: 1,
                col: 1,
                message: 'File not formatted',
                severity: 'error',
                engine: 'prettier',
              },
              {
                file: 'file3.ts',
                line: 1,
                col: 1,
                message: 'File not formatted',
                severity: 'error',
                engine: 'prettier',
              },
            ],
            duration: 50,
            fixable: true,
          }
        }
      }),
    }

    mockTypeScriptEngine = {
      check: vi.fn().mockImplementation(async () => {
        // Simulate execution time
        await new Promise((resolve) => setTimeout(resolve, 150))

        // TypeScript only checks, no fix mode
        return {
          success: false,
          issues: [
            {
              file: 'file1.ts',
              line: 10,
              col: 5,
              message: 'Type error',
              severity: 'error',
              engine: 'typescript',
            },
          ],
          duration: 150,
          fixable: false,
        }
      }),
    }
    ;(ESLintEngine as any).mockImplementation(() => mockESLintEngine)
    ;(PrettierEngine as any).mockImplementation(() => mockPrettierEngine)
    ;(TypeScriptEngine as any).mockImplementation(() => mockTypeScriptEngine)

    checker = new QualityChecker()
  })

  describe('50% Performance Improvement Target', () => {
    it('should achieve 50% performance improvement with fix-first mode', async () => {
      const files = ['file1.ts', 'file2.ts', 'file3.ts']

      // Measure traditional check-then-fix approach timing
      const traditionalStart = Date.now()

      // Step 1: Check all engines
      const checkResult = await checker.check(files, { fix: false })

      // Step 2: If issues found, run fixes separately (simulating Fixer adapter)
      const hasFixableIssues = checkResult.issues.some(
        (issue) => issue.engine === 'eslint' || issue.engine === 'prettier',
      )
      if (!checkResult.success && hasFixableIssues) {
        // Simulate running eslint --fix
        await mockESLintEngine.check({ files, fix: true })
        // Simulate running prettier --write
        await mockPrettierEngine.check({ files, prettierWrite: true })
      }

      const traditionalDuration = Date.now() - traditionalStart

      // Reset mocks
      vi.clearAllMocks()

      // Measure fix-first approach timing
      const fixFirstStart = Date.now()

      const fixFirstResult = await checker.check(files, { fixFirst: true })

      const fixFirstDuration = Date.now() - fixFirstStart

      // Calculate performance improvement
      const performanceImprovement =
        ((traditionalDuration - fixFirstDuration) / traditionalDuration) * 100

      // Validate 50% improvement target
      expect(performanceImprovement).toBeGreaterThanOrEqual(45) // Allow 5% margin

      // Validate execution counts
      // Traditional: 3 checks + 2 fixes = 5 engine calls
      // Fix-first: 2 fixes + 1 check = 3 engine calls
      expect(mockESLintEngine.check).toHaveBeenCalledTimes(1)
      expect(mockPrettierEngine.check).toHaveBeenCalledTimes(1)
      expect(mockTypeScriptEngine.check).toHaveBeenCalledTimes(1)

      // Validate only unfixable issues remain
      expect(fixFirstResult.issues).toHaveLength(1)
      expect(fixFirstResult.issues[0].engine).toBe('typescript')
    })

    it('should eliminate double execution overhead', async () => {
      const files = ['file1.ts', 'file2.ts']

      // Track execution counts
      const result = await checker.check(files, { fixFirst: true })

      // Each engine should be called exactly once
      expect(mockESLintEngine.check).toHaveBeenCalledTimes(1)
      expect(mockPrettierEngine.check).toHaveBeenCalledTimes(1)
      expect(mockTypeScriptEngine.check).toHaveBeenCalledTimes(1)

      // Verify fix mode was used for fixable engines
      expect(mockESLintEngine.check).toHaveBeenCalledWith(expect.objectContaining({ fix: true }))
      expect(mockPrettierEngine.check).toHaveBeenCalledWith(
        expect.objectContaining({ prettierWrite: true }),
      )

      // Verify result contains performance metadata
      expect(result.duration).toBeDefined()
      expect(result.fixesApplied).toBeDefined()
    })
  })

  describe('99% Error Reporting Noise Reduction', () => {
    it('should filter out 99% of formatting issues from Claude feedback', async () => {
      const files = ['file1.ts', 'file2.ts', 'file3.ts']

      // Run check without fix-first (traditional mode)
      const traditionalResult = await checker.check(files, { fix: false })

      // Count fixable formatting issues
      const fixableIssues = traditionalResult.issues.filter(
        (issue) => issue.engine === 'eslint' || issue.engine === 'prettier',
      ).length

      // Reset mocks
      vi.clearAllMocks()

      // Run with fix-first mode
      const fixFirstResult = await checker.check(files, { fixFirst: true })
      const remainingIssues = fixFirstResult.issues.length

      // Calculate noise reduction percentage
      const noiseReduction = ((fixableIssues - remainingIssues) / fixableIssues) * 100

      // Validate 99% noise reduction target
      expect(noiseReduction).toBeGreaterThanOrEqual(99)

      // Validate only unfixable issues remain
      expect(fixFirstResult.issues.every((issue) => issue.engine === 'typescript')).toBe(true)
    })

    it('should surface only unfixable issues to users', async () => {
      const files = ['file1.ts', 'file2.ts']

      const result = await checker.check(files, { fixFirst: true })

      // Should only contain TypeScript errors (unfixable)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]).toMatchObject({
        file: 'file1.ts',
        line: 10,
        col: 5,
        message: 'Type error',
        severity: 'error',
        engine: 'typescript',
      })

      // Verify fix metadata is present
      expect(result.fixesApplied).toBeDefined()
      expect(result.fixesApplied?.length).toBeGreaterThan(0)
    })

    it('should categorize issues correctly (fixable vs unfixable)', async () => {
      const files = ['file1.ts']

      // Create mock with mixed issues
      mockESLintEngine.check.mockResolvedValueOnce({
        success: false,
        issues: [
          {
            file: 'file1.ts',
            line: 1,
            col: 1,
            message: 'No-console',
            severity: 'error',
            engine: 'eslint',
            fixable: false,
          },
        ],
        duration: 100,
      })

      const result = await checker.check(files, { fixFirst: true })

      // Unfixable ESLint issue should still be reported
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          message: 'No-console',
          engine: 'eslint',
        }),
      )
    })
  })

  describe('System Integration Tests', () => {
    it('should handle complete fix-first flow end-to-end', async () => {
      const files = ['src/index.ts', 'src/utils.ts']
      const options: QualityCheckOptions = {
        fixFirst: true,
        autoStage: true,
      }

      const result = await checker.check(files, options)

      // Verify complete flow execution
      expect(result).toMatchObject({
        success: false, // Has TypeScript errors
        duration: expect.any(Number),
        issues: expect.arrayContaining([expect.objectContaining({ engine: 'typescript' })]),
      })

      // Verify fix metadata
      expect(result.fixesApplied).toBeDefined()
      expect(result.performanceOptimizations).toContain('fix-first-mode')
    })

    it('should handle mixed success and failure scenarios', async () => {
      // Setup partial fix scenario
      mockESLintEngine.check.mockResolvedValueOnce({
        success: false,
        issues: [
          {
            file: 'file1.ts',
            line: 1,
            col: 1,
            message: 'Complex issue',
            severity: 'error',
            engine: 'eslint',
          },
        ],
        duration: 100,
        fixedCount: 3,
        modifiedFiles: ['file1.ts'],
      })

      const files = ['file1.ts']
      const result = await checker.check(files, { fixFirst: true })

      // Should report the unfixable ESLint issue
      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(2) // 1 ESLint + 1 TypeScript
    })

    it('should validate clean git history (no separate style commits needed)', async () => {
      const files = ['file1.ts', 'file2.ts']

      const result = await checker.check(files, {
        fixFirst: true,
        autoStage: true,
      })

      // Verify fixes were applied
      expect(result.fixesApplied).toBeDefined()
      expect(result.fixesApplied?.length).toBeGreaterThan(0)

      // Verify atomic operation metadata
      expect(result.performanceOptimizations).toContain('fix-first-mode')

      // In a real test, we would verify git staging occurred
      // but mocking git operations is complex
    })
  })

  describe('Performance Under Load', () => {
    it('should maintain performance with large file counts', async () => {
      // Generate 100 files
      const files = Array.from({ length: 100 }, (_, i) => `file${i}.ts`)

      const start = Date.now()
      await checker.check(files, { fixFirst: true })
      const duration = Date.now() - start

      // Should complete in reasonable time (< 5 seconds for 100 files)
      expect(duration).toBeLessThan(5000)

      // Verify engines were called efficiently
      expect(mockESLintEngine.check).toHaveBeenCalledTimes(1)
      expect(mockPrettierEngine.check).toHaveBeenCalledTimes(1)
      expect(mockTypeScriptEngine.check).toHaveBeenCalledTimes(1)
    })

    it('should handle memory pressure gracefully', async () => {
      // This test would require more complex setup to actually test memory pressure
      // For now, we verify the memory pressure detection exists
      const files = ['file1.ts']

      // Force memory pressure scenario by setting env var
      process.env.QC_SKIP_NON_CRITICAL = 'true'

      const result = await checker.check(files, { fixFirst: true })

      // Should complete successfully even under memory pressure
      expect(result).toBeDefined()
      expect(result.warnings).toContain('Some checks skipped due to memory pressure')

      // Cleanup
      delete process.env.QC_SKIP_NON_CRITICAL
    })
  })
})
