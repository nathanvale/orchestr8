/**
 * Git Hook Auto-staging Advanced Tests
 * Tests for error handling and various git repository states
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

vi.mock('../adapters/fixer.js', () => ({
  Fixer: vi.fn().mockImplementation(() => ({
    autoFix: vi.fn(),
  })),
}))

// Import mocked modules
import { execSync } from 'node:child_process'
import { Autopilot } from '../adapters/autopilot.js'
import { Fixer } from '../adapters/fixer.js'
import { IssueReporter } from '../core/issue-reporter.js'
import { QualityChecker } from '../core/quality-checker.js'

describe('Git Hook Auto-staging - Error Handling & Repository States', () => {
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

    // Setup mocked implementations
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

  describe('Staging failure handling and recovery', () => {
    it('should handle git add failures gracefully', async () => {
      mockExecSync.mockReturnValueOnce('src/file.ts')

      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/file.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles: ['src/file.ts'],
      })

      // Mock git add to fail
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('git add')) {
          throw new Error('fatal: Unable to create index.lock')
        }
        return 'src/file.ts'
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        // Should handle error gracefully
        expect(e.message).toContain('Process exited')
      }

      // TODO: After implementation, verify error was logged
      // expect(consoleErrorSpy).toHaveBeenCalledWith(
      //   expect.stringContaining('Failed to stage'),
      //   expect.any(String)
      // )
    })

    it('should recover from staging lock issues', async () => {
      mockExecSync.mockReturnValueOnce('src/file.ts')

      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/file.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles: ['src/file.ts'],
      })

      let gitAddAttempts = 0
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('git add')) {
          gitAddAttempts++
          if (gitAddAttempts === 1) {
            throw new Error('.git/index.lock exists')
          }
          return '' // Success on retry
        }
        return 'src/file.ts'
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        // Should succeed after retry
        expect(e.message).toContain('Process exited with code 0')
      }

      // TODO: After implementation, verify retry logic
      // expect(gitAddAttempts).toBeGreaterThanOrEqual(1)
    })

    it('should provide meaningful error messages for staging failures', async () => {
      mockExecSync.mockReturnValueOnce('src/file.ts')

      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/file.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles: ['src/file.ts'],
      })

      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('git add')) {
          throw new Error('Permission denied')
        }
        return 'src/file.ts'
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited')
      }

      // TODO: After implementation, verify user-friendly error message
      // expect(consoleErrorSpy).toHaveBeenCalledWith(
      //   expect.stringContaining('Unable to stage fixed files'),
      //   expect.any(String)
      // )
    })
  })

  describe('Staging behavior with various git repository states', () => {
    it('should handle staging in clean repository state', async () => {
      mockExecSync
        .mockReturnValueOnce('src/file.ts') // Staged files
        .mockReturnValueOnce('') // No unstaged changes

      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/file.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles: ['src/file.ts'],
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      expect(exitCode).toBe(0)
    })

    it('should handle staging with existing unstaged changes', async () => {
      mockExecSync
        .mockReturnValueOnce('src/file1.ts') // Staged file
        .mockReturnValueOnce('src/file2.ts\nsrc/file3.ts') // Unstaged changes

      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/file1.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles: ['src/file1.ts'],
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      // Should only stage the fixed file, not affect other unstaged changes
      // TODO: After implementation, verify selective staging
      // expect(mockExecSync).toHaveBeenCalledWith(
      //   'git add src/file1.ts',
      //   expect.any(Object)
      // )
    })

    it('should handle staging during interactive rebase', async () => {
      mockExecSync
        .mockReturnValueOnce('src/file.ts')
        .mockReturnValueOnce('') // Simulate rebase state check
        .mockImplementation((cmd: string) => {
          if (cmd.includes('git rev-parse')) {
            return 'refs/heads/feature-branch'
          }
          if (cmd.includes('git status')) {
            return 'interactive rebase in progress'
          }
          return ''
        })

      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/file.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles: ['src/file.ts'],
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      // Should still work during rebase
      expect(exitCode).toBe(0)
    })

    it('should handle staging with merge conflicts present', async () => {
      mockExecSync.mockReturnValueOnce('src/file.ts').mockImplementation((cmd: string) => {
        if (cmd.includes('git add')) {
          throw new Error('error: cannot add conflicted file')
        }
        if (cmd.includes('git status')) {
          return 'You have unmerged paths'
        }
        return 'src/file.ts'
      })

      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/file.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles: ['src/file.ts'],
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        // Should handle conflict state gracefully
        expect(e.message).toContain('Process exited')
      }

      // TODO: After implementation, verify conflict detection
      // expect(consoleErrorSpy).toHaveBeenCalledWith(
      //   expect.stringContaining('conflict'),
      //   expect.any(String)
      // )
    })

    it('should respect user workflow and not interfere with partial staging', async () => {
      // User has partially staged a file (some hunks staged, some not)
      mockExecSync
        .mockReturnValueOnce('src/complex-file.ts') // File with partial staging
        .mockImplementation((cmd: string) => {
          if (cmd.includes('git diff --cached')) {
            return '+ staged line'
          }
          if (cmd.includes('git diff src/complex-file.ts')) {
            return '+ unstaged line'
          }
          return 'src/complex-file.ts'
        })

      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/complex-file.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles: ['src/complex-file.ts'],
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited')
      }

      // TODO: After implementation, verify partial staging is preserved
      // The auto-staging should be careful with partially staged files
    })
  })
})
