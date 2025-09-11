import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { QualityChecker } from './quality-checker'
import { execSync } from 'child_process'
import type { QualityCheckOptions } from '../types'

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

// Mock the engines
vi.mock('../engines/eslint-engine', () => ({
  ESLintEngine: vi.fn().mockImplementation(() => ({
    check: vi.fn().mockResolvedValue({
      success: true,
      issues: [],
      fixedCount: 1,
    }),
    generateErrorReport: vi.fn().mockResolvedValue({ errors: [] }),
    clearCache: vi.fn(),
  })),
}))

vi.mock('../engines/prettier-engine', () => ({
  PrettierEngine: vi.fn().mockImplementation(() => ({
    check: vi.fn().mockResolvedValue({
      success: true,
      issues: [],
      fixedCount: 1,
    }),
    generateErrorReport: vi.fn().mockResolvedValue({ errors: [] }),
  })),
}))

vi.mock('../engines/typescript-engine', () => ({
  TypeScriptEngine: vi.fn().mockImplementation(() => ({
    check: vi.fn().mockResolvedValue({
      success: true,
      issues: [],
    }),
    generateErrorReport: vi.fn().mockResolvedValue({ errors: [] }),
    getLastDiagnostics: vi.fn().mockReturnValue([]),
    clearCache: vi.fn(),
  })),
}))

describe('QualityChecker - Auto-staging Integration', () => {
  let qualityChecker: QualityChecker
  let mockExecSync: Mock

  beforeEach(() => {
    vi.clearAllMocks()
    mockExecSync = execSync as Mock
    qualityChecker = new QualityChecker()
  })

  describe('Git Auto-staging', () => {
    it('should automatically stage files after successful fixes', async () => {
      const modifiedFiles = ['src/test.ts', 'src/other.js']

      // Mock that will be implemented with checkFixFirst
      const options: QualityCheckOptions & { autoStage?: boolean } = {
        fix: true,
        autoStage: true,
        eslint: true,
        prettier: true,
      }

      // This test defines expected behavior for auto-staging
      // It will fail initially (TDD approach)
      const result = await (qualityChecker as any).checkFixFirst(modifiedFiles, options)

      // Should attempt to stage the modified files
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git add'),
        expect.any(Object),
      )

      // Should include the specific files
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('src/test.ts'),
        expect.any(Object),
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('src/other.js'),
        expect.any(Object),
      )

      expect(result.success).toBe(true)
    })

    it('should handle git staging failures gracefully', async () => {
      // Simulate git add failure
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: not a git repository')
      })

      const options: QualityCheckOptions & { autoStage?: boolean } = {
        fix: true,
        autoStage: true,
        eslint: true,
      }

      // Should not throw even if git staging fails
      const result = await (qualityChecker as any).checkFixFirst(['src/test.ts'], options)

      // Should capture the staging error
      expect((result as any).stagingError).toBeDefined()
      expect((result as any).stagingError).toContain('not a git repository')

      // But fixes should still be applied
      expect(result.success).toBeDefined()
    })

    it('should not attempt staging when autoStage is false', async () => {
      const options: QualityCheckOptions & { autoStage?: boolean } = {
        fix: true,
        autoStage: false,
        eslint: true,
      }

      await (qualityChecker as any).checkFixFirst(['src/test.ts'], options)

      // Git add should not be called
      expect(mockExecSync).not.toHaveBeenCalled()
    })

    it('should not attempt staging when no files were modified', async () => {
      const options: QualityCheckOptions & { autoStage?: boolean } = {
        fix: true,
        autoStage: true,
        eslint: true,
      }

      // Mock no files modified scenario
      const result = await (qualityChecker as any).checkFixFirst([], options)

      // Git add should not be called when no files to stage
      expect(mockExecSync).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    it('should stage files atomically in a single git add command', async () => {
      const modifiedFiles = ['src/file1.ts', 'src/file2.ts', 'src/file3.ts']

      const options: QualityCheckOptions & { autoStage?: boolean } = {
        fix: true,
        autoStage: true,
        eslint: true,
      }

      await (qualityChecker as any).checkFixFirst(modifiedFiles, options)

      // Should call git add once with all files
      expect(mockExecSync).toHaveBeenCalledTimes(1)
      // The implementation uses absolute paths
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringMatching(/git add.*file1\.ts.*file2\.ts.*file3\.ts/),
        expect.any(Object),
      )
    })

    it('should respect the working directory when staging files', async () => {
      const customCwd = '/custom/project/path'
      const options: QualityCheckOptions & { autoStage?: boolean; cwd?: string } = {
        fix: true,
        autoStage: true,
        eslint: true,
        cwd: customCwd,
      }

      await (qualityChecker as any).checkFixFirst(['src/test.ts'], options)

      // Should pass the correct cwd to git command
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git add'),
        expect.objectContaining({ cwd: customCwd }),
      )
    })
  })
})
