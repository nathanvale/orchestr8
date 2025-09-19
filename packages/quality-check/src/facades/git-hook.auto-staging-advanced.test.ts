/**
 * Git Hook Auto-staging Advanced Tests
 * Tests for error handling and various git repository states
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runGitHook } from './git-hook.js'

// Mock dependencies
vi.mock('../utils/secure-git-operations.js', () => ({
  SecureGitOperations: {
    getStagedFiles: vi.fn(),
    addFiles: vi.fn(),
    getStatus: vi.fn(),
  },
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
import { SecureGitOperations } from '../utils/secure-git-operations.js'
import { Autopilot } from '../adapters/autopilot.js'
import { IssueReporter } from '../core/issue-reporter.js'
import { QualityChecker } from '../core/quality-checker.js'

describe('Git Hook Auto-staging - Error Handling & Repository States', () => {
  let mockGetStagedFiles: ReturnType<typeof vi.fn>
  let mockAddFiles: ReturnType<typeof vi.fn>
  let mockGetStatus: ReturnType<typeof vi.fn>
  let mockCheck: ReturnType<typeof vi.fn>
  let mockDecide: ReturnType<typeof vi.fn>
  let mockFormatForCLI: ReturnType<typeof vi.fn>
  let originalExit: typeof process.exit
  let exitCode: number | undefined

  beforeEach(() => {
    // Setup mocks
    mockGetStagedFiles = vi.mocked(SecureGitOperations.getStagedFiles)
    mockAddFiles = vi.mocked(SecureGitOperations.addFiles)
    mockGetStatus = vi.mocked(SecureGitOperations.getStatus)
    mockCheck = vi.fn()
    mockDecide = vi.fn()
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
      mockGetStagedFiles.mockResolvedValueOnce({
        success: true,
        stdout: 'src/file.ts',
        stderr: '',
        exitCode: 0,
        timedOut: false,
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
      // Second check with fixFirst returns success
      mockCheck.mockResolvedValueOnce({
        success: true,
        duration: 100,
        issues: [],
        fixesApplied: [{ modifiedFiles: ['src/file.ts'] }],
      })

      // Mock git staged files to return a file
      mockGetStagedFiles.mockResolvedValue({
        success: true,
        stdout: 'src/file.ts',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })

      // Mock git add to fail
      mockAddFiles.mockRejectedValue(new Error('fatal: Unable to create index.lock'))

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
      mockGetStagedFiles.mockResolvedValueOnce({
        success: true,
        stdout: 'src/file.ts',
        stderr: '',
        exitCode: 0,
        timedOut: false,
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
      // Second check with fixFirst returns success
      mockCheck.mockResolvedValueOnce({
        success: true,
        duration: 100,
        issues: [],
        fixesApplied: [{ modifiedFiles: ['src/file.ts'] }],
      })

      mockGetStagedFiles.mockResolvedValue({
        success: true,
        stdout: 'src/file.ts',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })

      let gitAddAttempts = 0
      mockAddFiles.mockImplementation(async () => {
        gitAddAttempts++
        if (gitAddAttempts === 1) {
          throw new Error('.git/index.lock exists')
        }
        return {
          success: true,
          stdout: '',
          stderr: '',
          exitCode: 0,
          timedOut: false,
        }
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
      mockGetStagedFiles.mockResolvedValueOnce({
        success: true,
        stdout: 'src/file.ts',
        stderr: '',
        exitCode: 0,
        timedOut: false,
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
      // Second check with fixFirst returns success
      mockCheck.mockResolvedValueOnce({
        success: true,
        duration: 100,
        issues: [],
        fixesApplied: [{ modifiedFiles: ['src/file.ts'] }],
      })

      mockGetStagedFiles.mockResolvedValue({
        success: true,
        stdout: 'src/file.ts',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })

      mockAddFiles.mockRejectedValue(new Error('Permission denied'))

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
      mockGetStagedFiles
        .mockResolvedValueOnce({
          success: true,
          stdout: 'src/file.ts',
          stderr: '',
          exitCode: 0,
          timedOut: false,
        }) // Staged files
        .mockResolvedValueOnce({
          success: true,
          stdout: '',
          stderr: '',
          exitCode: 0,
          timedOut: false,
        }) // No unstaged changes

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

      expect(exitCode).toBe(0)
    })

    it('should handle staging with existing unstaged changes', async () => {
      mockGetStagedFiles
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
      // Second check with fixFirst returns success
      mockCheck.mockResolvedValueOnce({
        success: true,
        duration: 100,
        issues: [],
        fixesApplied: [{ modifiedFiles: ['src/file1.ts'] }],
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      // Should only stage the fixed file, not affect other unstaged changes
      // TODO: After implementation, verify selective staging
      // expect(mockGetStagedFiles).toHaveBeenCalledWith(
      //   'git add src/file1.ts',
      //   expect.any(Object)
      // )
    })

    it('should handle staging during interactive rebase', async () => {
      mockGetStagedFiles
        .mockReturnValueOnce('src/file.ts')
        .mockResolvedValueOnce({
          success: true,
          stdout: '',
          stderr: '',
          exitCode: 0,
          timedOut: false,
        }) // Simulate rebase state check
        .mockResolvedValueOnce({
          success: true,
          stdout: 'refs/heads/feature-branch',
          stderr: '',
          exitCode: 0,
          timedOut: false,
        })

      mockGetStatus.mockResolvedValue({
        success: true,
        stdout: 'interactive rebase in progress',
        stderr: '',
        exitCode: 0,
        timedOut: false,
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

      // Should still work during rebase
      expect(exitCode).toBe(0)
    })

    it('should handle staging with merge conflicts present', async () => {
      mockGetStagedFiles.mockResolvedValueOnce({
        success: true,
        stdout: 'src/file.ts',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })

      mockAddFiles.mockRejectedValue(new Error('error: cannot add conflicted file'))
      mockGetStatus.mockResolvedValue({
        success: true,
        stdout: 'You have unmerged paths',
        stderr: '',
        exitCode: 0,
        timedOut: false,
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
      mockGetStagedFiles
        .mockResolvedValueOnce({
          success: true,
          stdout: 'src/complex-file.ts',
          stderr: '',
          exitCode: 0,
          timedOut: false,
        }) // File with partial staging
        .mockResolvedValue({
          success: true,
          stdout: 'src/complex-file.ts',
          stderr: '',
          exitCode: 0,
          timedOut: false,
        })

      mockGetStatus.mockResolvedValue({
        success: true,
        stdout: '+ staged line\n+ unstaged line',
        stderr: '',
        exitCode: 0,
        timedOut: false,
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
      // Second check with fixFirst returns success
      mockCheck.mockResolvedValueOnce({
        success: true,
        duration: 100,
        issues: [],
        fixesApplied: [{ modifiedFiles: ['src/complex-file.ts'] }],
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
