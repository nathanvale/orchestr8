/**
 * Git Hook Facade V2 Compatibility Tests
 * Tests for runGitHook using QualityChecker implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runGitHook } from './git-hook.js'

// Mock dependencies
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('../core/quality-checker.js', () => ({
  QualityChecker: vi.fn(),
}))

vi.mock('../core/issue-reporter.js', () => ({
  IssueReporter: vi.fn().mockImplementation(() => ({
    formatForCLI: vi.fn().mockReturnValue('Formatted errors'),
  })),
}))

vi.mock('../adapters/autopilot.js', () => ({
  Autopilot: vi.fn().mockImplementation(() => ({
    decide: vi.fn(),
  })),
}))

vi.mock('../adapters/fixer.js', () => ({
  Fixer: vi.fn().mockImplementation(() => ({
    autoFix: vi.fn(),
  })),
}))

// Import mocked modules
import { execSync } from 'node:child_process'
import { QualityChecker } from '../core/quality-checker.js'
import { IssueReporter } from '../core/issue-reporter.js'
import { Autopilot } from '../adapters/autopilot.js'
import { Fixer } from '../adapters/fixer.js'

describe('Git Hook with V2 Implementation', () => {
  let mockExecSync: ReturnType<typeof vi.fn>
  let mockCheck: ReturnType<typeof vi.fn>
  let mockDecide: ReturnType<typeof vi.fn>
  let mockAutoFix: ReturnType<typeof vi.fn>
  let mockFormatForCLI: ReturnType<typeof vi.fn>
  let originalExit: typeof process.exit
  let exitCode: number | undefined

  beforeEach(() => {
    // Setup mocks
    mockExecSync = vi.mocked(execSync)
    mockCheck = vi.fn()
    mockDecide = vi.fn()
    mockAutoFix = vi.fn()
    mockFormatForCLI = vi.fn().mockReturnValue('Formatted errors')

    // Mocks are already configured in vi.mock() calls above
    // Just update the mock function references
    ;(QualityChecker as any).mockImplementation(() => ({
      check: mockCheck,
      fix: vi.fn(),
    }))
    ;(IssueReporter as any).mockImplementation(() => ({
      formatForCLI: mockFormatForCLI,
    }))
    ;(Autopilot as any).mockImplementation(() => ({
      decide: mockDecide,
    }))
    ;(Fixer as any).mockImplementation(() => ({
      autoFix: mockAutoFix,
    }))

    // Mock process.exit
    originalExit = process.exit
    exitCode = undefined
    process.exit = ((code?: number) => {
      exitCode = code
      throw new Error(`Process exited with code ${code}`)
    }) as any

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    process.exit = originalExit
  })

  describe('Staged Files Detection', () => {
    it('should get staged files from git when no files provided', async () => {
      mockExecSync.mockReturnValue('src/file1.ts\nsrc/file2.js\n')
      mockCheck.mockResolvedValue({ success: true, duration: 100, issues: [] })

      try {
        await runGitHook()
      } catch {
        // Expected to throw due to process.exit mock
      }

      expect(mockExecSync).toHaveBeenCalledWith('git diff --cached --name-only --diff-filter=ACM', {
        encoding: 'utf-8',
      })
      expect(mockCheck).toHaveBeenCalledWith(['src/file1.ts', 'src/file2.js'], { fix: false })
    })

    it('should use provided files instead of git diff', async () => {
      const files = ['src/test1.ts', 'src/test2.ts']
      mockCheck.mockResolvedValue({ success: true, duration: 100, issues: [] })

      try {
        await runGitHook({ files })
      } catch {
        // Expected to throw due to process.exit mock
      }

      expect(mockExecSync).not.toHaveBeenCalled()
      expect(mockCheck).toHaveBeenCalledWith(files, { fix: false })
    })

    it('should filter for JS/TS files only', async () => {
      mockExecSync.mockReturnValue('src/file.ts\nREADME.md\npackage.json\nsrc/test.js\n')
      mockCheck.mockResolvedValue({ success: true, duration: 100, issues: [] })

      try {
        await runGitHook()
      } catch {
        // Expected to throw due to process.exit mock
      }

      expect(mockCheck).toHaveBeenCalledWith(['src/file.ts', 'src/test.js'], { fix: false })
    })

    it('should exit silently when no checkable files', async () => {
      mockExecSync.mockReturnValue('README.md\npackage.json\n')

      try {
        await runGitHook()
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      expect(mockCheck).not.toHaveBeenCalled()
      expect(exitCode).toBe(0)
    })
  })

  describe('Quality Check Integration', () => {
    it('should pass when QualityChecker returns success', async () => {
      mockExecSync.mockReturnValue('src/file.ts\n')
      mockCheck.mockResolvedValue({
        success: true,
        duration: 100,
        issues: [],
      })

      try {
        await runGitHook()
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      expect(exitCode).toBe(0)
      expect(mockFormatForCLI).not.toHaveBeenCalled()
    })

    it('should fail and show errors when QualityChecker finds issues', async () => {
      mockExecSync.mockReturnValue('src/file.ts\n')
      const failResult = {
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'typescript' as const,
            severity: 'error' as const,
            ruleId: 'typescript-error',
            file: 'src/file.ts',
            line: 10,
            col: 1,
            message: 'Type error at line 10',
          },
        ],
      }
      mockCheck.mockResolvedValue(failResult)
      mockDecide.mockReturnValue({ action: 'REPORT_ONLY' })

      try {
        await runGitHook()
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 1')
      }

      expect(mockFormatForCLI).toHaveBeenCalledWith(failResult)
      expect(console.error).toHaveBeenCalledWith('Formatted errors')
      expect(console.error).toHaveBeenCalledWith('\n❌ Quality check failed')
      expect(exitCode).toBe(1)
    })
  })

  describe('Auto-fix Integration', () => {
    it('should apply fixes when autopilot decides FIX_SILENTLY', async () => {
      mockExecSync.mockReturnValue('src/file.ts\n')
      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'eslint' as const,
            severity: 'error' as const,
            ruleId: 'semi',
            file: 'src/file.ts',
            line: 1,
            col: 1,
            message: 'Missing semicolon',
          },
        ],
      })
      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({ success: true })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      expect(mockAutoFix).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('✅ Auto-fixed safe issues')
      expect(exitCode).toBe(0)
    })

    it('should report errors when auto-fix fails', async () => {
      mockExecSync.mockReturnValue('src/file.ts\n')
      const failResult = {
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'eslint' as const,
            severity: 'error' as const,
            ruleId: 'complex',
            file: 'src/file.ts',
            line: 1,
            col: 1,
            message: 'Complex error',
          },
        ],
      }
      mockCheck.mockResolvedValue(failResult)
      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({ success: false })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 1')
      }

      expect(mockAutoFix).toHaveBeenCalled()
      expect(mockFormatForCLI).toHaveBeenCalledWith(failResult)
      expect(exitCode).toBe(1)
    })

    it('should not attempt fix when fix option is false', async () => {
      mockExecSync.mockReturnValue('src/file.ts\n')
      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'eslint' as const,
            severity: 'error' as const,
            ruleId: 'error',
            file: 'src/file.ts',
            line: 1,
            col: 1,
            message: 'Error',
          },
        ],
      })
      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })

      try {
        await runGitHook({ fix: false })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 1')
      }

      expect(mockAutoFix).not.toHaveBeenCalled()
      expect(exitCode).toBe(1)
    })
  })

  describe('Autopilot Decision Making', () => {
    it('should respect FIX_AND_REPORT decision', async () => {
      mockExecSync.mockReturnValue('src/file.ts\n')
      const failResult = {
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'eslint' as const,
            severity: 'error' as const,
            ruleId: 'error',
            file: 'src/file.ts',
            line: 1,
            col: 1,
            message: 'Error',
          },
        ],
      }
      mockCheck.mockResolvedValue(failResult)
      mockDecide.mockReturnValue({ action: 'FIX_AND_REPORT' })
      mockAutoFix.mockResolvedValue({ success: true })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        // Even with successful fix, FIX_AND_REPORT might still exit 0
        expect(e.message).toContain('Process exited with code')
      }

      // Should attempt fix for FIX_AND_REPORT with fix option
      expect(mockDecide).toHaveBeenCalled()
    })

    it('should handle CONTINUE decision', async () => {
      mockExecSync.mockReturnValue('src/file.ts\n')
      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'prettier' as const,
            severity: 'error' as const,
            ruleId: 'format',
            file: 'src/file.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
        ],
      })
      mockDecide.mockReturnValue({ action: 'CONTINUE' })

      try {
        await runGitHook()
      } catch (e: any) {
        // CONTINUE should still fail the hook
        expect(e.message).toContain('Process exited with code 1')
      }

      expect(mockAutoFix).not.toHaveBeenCalled()
      expect(exitCode).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle check errors gracefully', async () => {
      mockExecSync.mockReturnValue('src/file.ts\n')
      mockCheck.mockRejectedValue(new Error('Check failed'))

      try {
        await runGitHook()
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 1')
      }

      expect(console.error).toHaveBeenCalledWith('❌ Pre-commit hook error:', 'Check failed')
      expect(exitCode).toBe(1)
    })

    it('should handle git command failures', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Git command failed')
      })

      try {
        await runGitHook()
      } catch (e: any) {
        // With no staged files, should exit 0
        expect(e.message).toContain('Process exited with code 0')
      }

      expect(mockCheck).not.toHaveBeenCalled()
      expect(exitCode).toBe(0)
    })
  })

  describe('V2 Compatibility', () => {
    it('should work with V2 QualityChecker instance', async () => {
      mockExecSync.mockReturnValue('src/file.ts\n')
      mockCheck.mockResolvedValue({ success: true, duration: 100, issues: [] })

      try {
        await runGitHook()
      } catch {
        // Expected
      }

      // Verify QualityChecker was instantiated
      expect(QualityChecker).toHaveBeenCalled()
      expect(mockCheck).toHaveBeenCalled()
    })

    it('should handle V2-specific error formats', async () => {
      mockExecSync.mockReturnValue('src/file.ts\n')
      const v2Result = {
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'typescript' as const,
            severity: 'error' as const,
            ruleId: 'TS2304',
            file: 'src/file.ts',
            line: 10,
            col: 5,
            message: 'Cannot find name "foo"',
          },
        ],
      }
      mockCheck.mockResolvedValue(v2Result)
      mockDecide.mockReturnValue({ action: 'REPORT_ONLY' })

      try {
        await runGitHook()
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 1')
      }

      expect(mockFormatForCLI).toHaveBeenCalledWith(v2Result)
      expect(exitCode).toBe(1)
    })
  })
})
