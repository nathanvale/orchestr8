/**
 * Git Hook Facade Current Compatibility Tests
 * Tests for runGitHook using QualityChecker implementation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

// Import mocked modules
import { execSync } from 'node:child_process'
import { Autopilot } from '../adapters/autopilot.js'
import { IssueReporter } from '../core/issue-reporter.js'
import { QualityChecker } from '../core/quality-checker.js'

describe('Git Hook with Current Implementation', () => {
  let mockExecSync: ReturnType<typeof vi.fn>
  let mockCheck: ReturnType<typeof vi.fn>
  let mockDecide: ReturnType<typeof vi.fn>
  let mockFormatForCLI: ReturnType<typeof vi.fn>
  let originalExit: typeof process.exit
  let exitCode: number | undefined

  beforeEach(() => {
    // Setup mocks
    mockExecSync = vi.mocked(execSync)
    mockCheck = vi.fn()
    mockDecide = vi.fn()
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

      // Expected Current format that formatForCLI receives
      const expectedCurrentFormat = {
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            ruleId: 'typescript-error',
            file: 'src/file.ts',
            line: 10,
            col: 1,
            message: 'Type error at line 10',
          },
        ],
      }

      try {
        await runGitHook()
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 1')
      }

      expect(mockFormatForCLI).toHaveBeenCalledWith(expectedCurrentFormat)
      expect(console.error).toHaveBeenCalledWith('Formatted errors')
      expect(console.error).toHaveBeenCalledWith('\n❌ Quality check failed')
      expect(exitCode).toBe(1)
    })
  })

  describe('Auto-fix Integration', () => {
    it('should apply fixes when autopilot decides FIX_SILENTLY', async () => {
      mockExecSync.mockReturnValue('src/file.ts\n')
      // First check returns issues
      mockCheck.mockResolvedValueOnce({
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
      // Second check with fixFirst returns success
      mockCheck.mockResolvedValueOnce({
        success: true,
        duration: 100,
        issues: [],
        fixesApplied: [{ modifiedFiles: ['src/file.ts'] }],
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      // Verify check was called twice - once without fix, once with fixFirst
      expect(mockCheck).toHaveBeenCalledTimes(2)
      expect(mockCheck).toHaveBeenNthCalledWith(1, ['src/file.ts'], { fix: false })
      expect(mockCheck).toHaveBeenNthCalledWith(2, ['src/file.ts'], {
        fixFirst: true,
        autoStage: true,
      })
      expect(console.log).toHaveBeenCalledWith('✅ Auto-fixed and staged 1 file(s)')
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
      // First check returns issues
      mockCheck.mockResolvedValueOnce(failResult)
      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      // Second check with fixFirst still returns issues (unfixable)
      mockCheck.mockResolvedValueOnce(failResult)

      // Expected Current format that formatForCLI receives
      const expectedCurrentFormat = {
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'complex',
            file: 'src/file.ts',
            line: 1,
            col: 1,
            message: 'Complex error',
          },
        ],
      }

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 1')
      }

      // Verify check was called twice
      expect(mockCheck).toHaveBeenCalledTimes(2)
      expect(mockCheck).toHaveBeenNthCalledWith(1, ['src/file.ts'], { fix: false })
      expect(mockCheck).toHaveBeenNthCalledWith(2, ['src/file.ts'], {
        fixFirst: true,
        autoStage: true,
      })
      expect(mockFormatForCLI).toHaveBeenCalledWith(expectedCurrentFormat)
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

      // Should only call check once without fixFirst
      expect(mockCheck).toHaveBeenCalledTimes(1)
      expect(mockCheck).toHaveBeenCalledWith(['src/file.ts'], { fix: false })
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
      // First check returns issues
      mockCheck.mockResolvedValue(failResult)
      mockDecide.mockReturnValue({ action: 'FIX_AND_REPORT' })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        // FIX_AND_REPORT is not handled in the current implementation, so it should fail
        expect(e.message).toContain('Process exited with code 1')
      }

      // Should call decide but not attempt fix since FIX_AND_REPORT isn't implemented
      expect(mockDecide).toHaveBeenCalled()
      expect(mockCheck).toHaveBeenCalledTimes(1)
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

      // Should only call check once, no fix attempt
      expect(mockCheck).toHaveBeenCalledTimes(1)
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

  describe('Current Compatibility', () => {
    it('should work with Current QualityChecker instance', async () => {
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

    it('should handle Current-specific error formats', async () => {
      mockExecSync.mockReturnValue('src/file.ts\n')
      const currentResult = {
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
      mockCheck.mockResolvedValue(currentResult)
      mockDecide.mockReturnValue({ action: 'REPORT_ONLY' })

      // Expected Current format that formatForCLI receives
      const expectedCurrentFormat = {
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            ruleId: 'TS2304',
            file: 'src/file.ts',
            line: 10,
            col: 5,
            message: 'Cannot find name "foo"',
          },
        ],
      }

      try {
        await runGitHook()
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 1')
      }

      expect(mockFormatForCLI).toHaveBeenCalledWith(expectedCurrentFormat)
      expect(exitCode).toBe(1)
    })
  })
})
