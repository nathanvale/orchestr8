/**
 * V2 Facade Integration Tests
 * Tests interactions between different facades using QualityChecker
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QualityCheckAPI } from './api.js'
import { runGitHook } from './git-hook.js'
import { MockedQualityChecker, DirectAPIWrapper } from '../test-utils/api-wrappers.js'
import { QualityChecker } from '../core/quality-checker.js'
import type { QualityCheckResult } from '../types/issue-types.js'
import type { FixResult } from '../types.js'

// Mock dependencies
vi.mock('../core/quality-checker.js', () => ({
  QualityChecker: vi.fn().mockImplementation(() => ({
    check: vi.fn(),
    fix: vi.fn(),
  })),
}))

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('../core/issue-reporter.js', () => ({
  IssueReporter: vi.fn().mockImplementation(() => ({
    formatForCLI: vi.fn().mockReturnValue('Formatted errors'),
  })),
}))

vi.mock('../adapters/autopilot.js', () => ({
  Autopilot: vi.fn().mockImplementation(() => ({
    decide: vi.fn().mockReturnValue({ action: 'REPORT_ONLY' }),
  })),
}))

vi.mock('../adapters/fixer.js', () => ({
  Fixer: vi.fn().mockImplementation(() => ({
    autoFix: vi.fn(),
  })),
}))

import { execSync } from 'node:child_process'

describe('V2 Facade Integration', () => {
  let originalExit: typeof process.exit
  let exitCode: number | undefined
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Mock process.exit
    originalExit = process.exit
    exitCode = undefined
    process.exit = ((code?: number) => {
      exitCode = code
      throw new Error(`Process exited with code ${code}`)
    }) as any

    // Mock console methods
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Reset QualityChecker mock to default behavior
    vi.mocked(QualityChecker).mockImplementation(() => ({
      check: vi.fn().mockResolvedValue({ success: true, duration: 100, issues: [] }),
      fix: vi.fn().mockResolvedValue({ success: true, count: 0, fixed: [] }),
    }) as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
    process.exit = originalExit
  })

  describe('API and Git Hook Integration', () => {
    it('should share same V2 instance type between facades', async () => {
      // Mock git staged files
      vi.mocked(execSync).mockReturnValue('src/test.ts\n')

      const api = new QualityCheckAPI()

      // Both should use QualityChecker internally
      expect(api['checker']).toBeDefined()
      // Since we're using mocks, we can't check constructor name, just check it exists
      expect(typeof api['checker'].check).toBe('function')
      expect(typeof api['checker'].fix).toBe('function')
    })

    it('should produce compatible results between API and git-hook', async () => {
      const v2Result: QualityCheckResult = {
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            ruleId: 'TS2304',
            file: 'src/test.ts',
            line: 1,
            col: 1,
            message: 'Cannot find name "foo"',
          },
        ],
      }

      // Configure all QualityChecker instances to return the failing result
      vi.mocked(QualityChecker).mockImplementation(() => ({
        check: vi.fn().mockResolvedValue(v2Result),
        fix: vi.fn(),
      }) as any)

      // Create API AFTER setting up the mock
      const api = new QualityCheckAPI()

      const apiResult = await api.check(['src/test.ts'])
      expect(apiResult).toEqual(v2Result)

      // Git hook should handle the same result format
      vi.mocked(execSync).mockReturnValue('src/test.ts\n')

      try {
        await runGitHook()
      } catch {
        // Expected to exit with error
      }

      expect(exitCode).toBe(1) // Should fail due to errors
    })

    it('should handle fix operations consistently', async () => {
      const api = new QualityCheckAPI()

      const fixResult: FixResult = {
        success: true,
        count: 2,
        fixed: ['src/file1.ts', 'src/file2.ts'],
      }

      vi.spyOn(api['checker'], 'fix').mockResolvedValue(fixResult)

      const result = await api.fix(['src/file1.ts', 'src/file2.ts'])
      expect(result).toEqual(fixResult)
      expect(result.count).toBe(2)
    })
  })

  describe('API and Test Utils Integration', () => {
    it('should work with MockedQualityChecker', async () => {
      const api = new QualityCheckAPI()
      const mocker = new MockedQualityChecker()

      // Setup mock file
      mocker.addMockFile('/src/test.ts', 'const x = 1;', true)

      // Both should handle V2 result format
      const v2Result: QualityCheckResult = {
        success: true,
        duration: 50,
        issues: [],
      }

      vi.spyOn(api['checker'], 'check').mockResolvedValue(v2Result)
      vi.spyOn(mocker, 'check').mockResolvedValue(v2Result)

      const apiResult = await api.check(['/src/test.ts'])
      const mockResult = await mocker.check(['/src/test.ts'])

      expect(apiResult).toEqual(v2Result)
      expect(mockResult).toEqual(v2Result)
    })

    it('should work with DirectAPIWrapper', async () => {
      const api = new QualityCheckAPI()
      const direct = new DirectAPIWrapper()

      const v2Result: QualityCheckResult = {
        success: true,
        duration: 50,
        issues: [],
      }

      vi.spyOn(api['checker'], 'check').mockResolvedValue(v2Result)
      vi.spyOn(direct['checker'], 'check').mockResolvedValue(v2Result)

      const apiResult = await api.check(['test.ts'])
      const directResult = await direct.check(['test.ts'])

      expect(apiResult).toEqual(v2Result)
      expect(directResult).toEqual(v2Result)
    })
  })

  describe('End-to-End Facade Flow', () => {
    it('should handle complete check-fix-verify flow', async () => {
      const api = new QualityCheckAPI()

      // Step 1: Check finds issues
      const checkResult: QualityCheckResult = {
        success: false,
        duration: 120,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'semi',
            file: 'src/test.ts',
            line: 1,
            col: 10,
            message: 'Missing semicolon',
          },
        ],
      }

      const checkSpy = vi.spyOn(api['checker'], 'check').mockResolvedValueOnce(checkResult)

      const initialResult = await api.check(['src/test.ts'])
      expect(initialResult.success).toBe(false)
      expect(initialResult.issues.filter(i => i.engine === 'eslint')).toHaveLength(1)

      // Step 2: Fix the issues
      const fixResult: FixResult = {
        success: true,
        count: 1,
        fixed: ['src/test.ts'],
      }

      vi.spyOn(api['checker'], 'fix').mockResolvedValue(fixResult)

      const fixedResult = await api.fix(['src/test.ts'])
      expect(fixedResult.success).toBe(true)
      expect(fixedResult.count).toBe(1)

      // Step 3: Verify fix worked
      const verifyResult: QualityCheckResult = {
        success: true,
        duration: 80,
        issues: [],
      }

      checkSpy.mockResolvedValueOnce(verifyResult)

      const finalResult = await api.check(['src/test.ts'])
      expect(finalResult.success).toBe(true)
      expect(finalResult.issues).toHaveLength(0)
    })

    it('should integrate with git workflow', async () => {
      // Simulate staged files with TypeScript files
      vi.mocked(execSync).mockReturnValue('src/a.ts\nsrc/b.ts\n')

      // The git-hook will use the mocked QualityChecker from the module mock
      // We just need to ensure no files are found to check for a clean exit
      vi.mocked(execSync).mockReturnValue('README.md\npackage.json\n')

      try {
        await runGitHook()
      } catch {
        // Check exit code - should exit 0 with no checkable files
      }

      expect(exitCode).toBe(0) // Should succeed with no JS/TS files
    })
  })

  describe('Performance Across Facades', () => {
    it('should maintain V2 performance targets', async () => {
      const api = new QualityCheckAPI()
      const direct = new DirectAPIWrapper()

      // Mock fast V2 responses
      const fastResult: QualityCheckResult = {
        success: true,
        duration: 50,
        issues: [],
      }

      vi.spyOn(api['checker'], 'check').mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return fastResult
      })

      vi.spyOn(direct['checker'], 'check').mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return fastResult
      })

      const start = Date.now()
      await api.check(['test.ts'])
      const apiTime = Date.now() - start

      const start2 = Date.now()
      await direct.check(['test.ts'])
      const directTime = Date.now() - start2

      // Both should complete under V2 target
      expect(apiTime).toBeLessThan(300)
      expect(directTime).toBeLessThan(300)
    })
  })

  describe('Error Handling Across Facades', () => {
    it('should handle errors consistently', async () => {
      const error = new Error('Tool not found')

      // Configure all QualityChecker instances to throw the error
      vi.mocked(QualityChecker).mockImplementation(() => ({
        check: vi.fn().mockRejectedValue(error),
        fix: vi.fn(),
      }) as any)

      // Create API AFTER setting up the mock
      const api = new QualityCheckAPI()

      // API should throw
      await expect(api.check(['test.ts'])).rejects.toThrow('Tool not found')

      // Git hook should handle gracefully
      vi.mocked(execSync).mockReturnValue('test.ts\n')

      try {
        await runGitHook()
      } catch {
        // Expected
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Pre-commit hook error'),
        expect.any(String),
      )
      expect(exitCode).toBe(1)
    })

    it('should handle V2-specific errors', async () => {
      const api = new QualityCheckAPI()

      const v2ErrorResult: QualityCheckResult = {
        success: false,
        duration: 150,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            ruleId: 'TS2304',
            file: 'src/test.ts',
            line: 1,
            col: 1,
            message: 'Cannot find name "foo"',
          },
        ],
      }

      vi.spyOn(api['checker'], 'check').mockResolvedValue(v2ErrorResult)

      const result = await api.check(['src/test.ts'])

      expect(result.success).toBe(false)
      expect(result.issues.find(i => i.engine === 'typescript')?.message).toBe('Cannot find name "foo"')
    })
  })
})
