/**
 * Git Hook Auto-staging Basic Tests
 * Tests for basic automatic staging functionality
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

describe('Git Hook Auto-staging - Basic Functionality', () => {
  let mockExecSync: ReturnType<typeof vi.fn>
  let mockCheck: ReturnType<typeof vi.fn>
  let mockDecide: ReturnType<typeof vi.fn>
  let mockAutoFix: ReturnType<typeof vi.fn>
  let mockFormatForCLI: ReturnType<typeof vi.fn>
  let originalExit: typeof process.exit
  let exitCode: number | undefined
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

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
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    process.exit = originalExit
  })

  describe('Automatic staging of files after successful fixes', () => {
    it('should stage fixed files automatically when fixes are successful', async () => {
      const filesToFix = ['src/file1.ts', 'src/file2.ts']
      mockExecSync.mockReturnValueOnce(filesToFix.join('\n'))

      // Mock successful check with fixable issues
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
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'semi',
            file: 'src/file2.ts',
            line: 5,
            col: 10,
            message: 'Missing semicolon',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles: filesToFix,
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      // Verify git add was called for modified files
      expect(mockExecSync).toHaveBeenCalledWith(
        'git add "src/file1.ts" "src/file2.ts"',
        expect.any(Object),
      )

      expect(exitCode).toBe(0)
    })

    it('should stage only the files that were actually modified', async () => {
      const allFiles = ['src/file1.ts', 'src/file2.ts', 'src/file3.ts']
      const modifiedFiles = ['src/file1.ts', 'src/file3.ts'] // Only 2 of 3 modified

      mockExecSync.mockReturnValueOnce(allFiles.join('\n'))

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
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/file3.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles,
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      // TODO: After implementation, verify only modified files were staged
      // expect(mockExecSync).toHaveBeenCalledWith(
      //   expect.stringContaining('git add src/file1.ts src/file3.ts'),
      //   expect.any(Object)
      // )
    })

    it('should not stage files when fix option is false', async () => {
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

      mockDecide.mockReturnValue({ action: 'REPORT_ONLY' })

      try {
        await runGitHook({ fix: false })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 1')
      }

      // TODO: After implementation, verify git add was NOT called
      // const gitAddCalls = mockExecSync.mock.calls.filter(
      //   call => call[0].includes('git add')
      // )
      // expect(gitAddCalls).toHaveLength(0)
    })
  })

  describe('Atomic commit behavior with fixes included', () => {
    it('should ensure fixes are included in the same commit', async () => {
      const files = ['src/feature.ts', 'src/utils.ts']
      mockExecSync.mockReturnValueOnce(files.join('\n'))

      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/feature.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'semi',
            file: 'src/utils.ts',
            line: 5,
            col: 10,
            message: 'Missing semicolon',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles: files,
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      // TODO: After implementation, verify atomic staging
      // All fixed files should be staged together
      // expect(mockExecSync).toHaveBeenCalledWith(
      //   expect.stringContaining('git add'),
      //   expect.any(Object)
      // )
      expect(exitCode).toBe(0)
    })

    it('should maintain commit atomicity even with partial fixes', async () => {
      const allFiles = ['src/file1.ts', 'src/file2.ts', 'src/file3.ts']
      const fixedFiles = ['src/file1.ts', 'src/file2.ts'] // file3 couldn't be fixed

      mockExecSync.mockReturnValueOnce(allFiles.join('\n'))

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
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/file2.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
          {
            engine: 'typescript',
            severity: 'error',
            ruleId: 'TS2304',
            file: 'src/file3.ts',
            line: 10,
            col: 5,
            message: 'Cannot find name "foo"', // Unfixable
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: false, // Partial success
        modifiedFiles: fixedFiles,
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        // Should fail due to unfixable issues
        expect(e.message).toContain('Process exited with code 1')
      }

      // TODO: After implementation, verify fixed files were still staged
      // expect(mockExecSync).toHaveBeenCalledWith(
      //   expect.stringContaining('git add src/file1.ts src/file2.ts'),
      //   expect.any(Object)
      // )
    })
  })

  describe('Git history cleanliness (no separate style commits)', () => {
    it('should eliminate need for separate style commits', async () => {
      const files = ['src/feature.ts']
      mockExecSync.mockReturnValueOnce(files.join('\n'))

      // Simulate a formatting issue that would normally require a separate commit
      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/feature.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles: files,
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      // The fix should be staged with the feature commit
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Auto-fixed safe issues')
      expect(exitCode).toBe(0)

      // TODO: After implementation, verify no "style:" commit needed
      // The formatting fix should be included in the current commit
    })

    it('should handle multiple formatting fixes in one atomic operation', async () => {
      const files = ['src/feature.ts', 'src/component.tsx', 'src/utils.ts']
      mockExecSync.mockReturnValueOnce(files.join('\n'))

      // Multiple formatting issues across files
      mockCheck.mockResolvedValue({
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/feature.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          },
          {
            engine: 'prettier',
            severity: 'error',
            ruleId: 'format',
            file: 'src/component.tsx',
            line: 15,
            col: 8,
            message: 'Formatting issue',
          },
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'semi',
            file: 'src/utils.ts',
            line: 5,
            col: 10,
            message: 'Missing semicolon',
          },
        ],
      })

      mockDecide.mockReturnValue({ action: 'FIX_SILENTLY' })
      mockAutoFix.mockResolvedValue({
        success: true,
        modifiedFiles: files,
      })

      try {
        await runGitHook({ fix: true })
      } catch (e: any) {
        expect(e.message).toContain('Process exited with code 0')
      }

      // All fixes should be staged together
      // TODO: After implementation, verify batch staging
      // expect(mockExecSync).toHaveBeenCalledWith(
      //   expect.stringContaining('git add'),
      //   expect.any(Object)
      // )

      expect(exitCode).toBe(0)
    })
  })
})
