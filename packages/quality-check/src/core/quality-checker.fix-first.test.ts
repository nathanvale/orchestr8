import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { QualityChecker } from './quality-checker'
import { ESLintEngine } from '../engines/eslint-engine'
import { PrettierEngine } from '../engines/prettier-engine'
import { TypeScriptEngine } from '../engines/typescript-engine'
import { ConfigLoader } from './config-loader'
import { FileMatcher } from './file-matcher'
import type { QualityCheckOptions } from '../types'

// Mock the engines and dependencies
vi.mock('../engines/eslint-engine')
vi.mock('../engines/prettier-engine')
vi.mock('../engines/typescript-engine')
vi.mock('./config-loader')
vi.mock('./file-matcher')
vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createTimer: vi.fn(() => ({ end: vi.fn(() => 100) })),
  EnhancedLogger: vi.fn(() => ({
    logErrorReport: vi.fn(),
    ensureLogDirectories: vi.fn(),
    config: { file: true, console: true },
  })),
}))

describe('QualityChecker - Fix-First Architecture', () => {
  let qualityChecker: QualityChecker
  let mockESLintCheck: Mock
  let mockPrettierCheck: Mock
  let mockTypeScriptCheck: Mock

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()

    // Set up mock implementations
    mockESLintCheck = vi.fn().mockResolvedValue({ success: true, issues: [] })
    mockPrettierCheck = vi.fn().mockResolvedValue({ success: true, issues: [] })
    mockTypeScriptCheck = vi.fn().mockResolvedValue({ success: true, issues: [] })

    // Apply mocks to engine classes
    ;(ESLintEngine as any).mockImplementation(() => ({
      check: mockESLintCheck,
      generateErrorReport: vi.fn((issues) => {
        // Return a proper error report structure
        return Promise.resolve({
          errors: issues || [],
          summary: {
            totalErrors: issues?.length || 0,
            totalWarnings: 0,
            fixableErrors: 0,
            fixableWarnings: 0,
          },
        })
      }),
      clearCache: vi.fn(),
    }))
    ;(PrettierEngine as any).mockImplementation(() => ({
      check: mockPrettierCheck,
      generateErrorReport: vi.fn().mockResolvedValue({ errors: [] }),
    }))
    ;(TypeScriptEngine as any).mockImplementation(() => ({
      check: mockTypeScriptCheck,
      generateErrorReport: vi.fn().mockResolvedValue({ errors: [] }),
      getLastDiagnostics: vi.fn().mockReturnValue([]),
      clearCache: vi.fn(),
    }))

    // Mock ConfigLoader and FileMatcher
    ;(ConfigLoader as any).mockImplementation(() => ({
      load: vi.fn().mockImplementation((options) =>
        Promise.resolve({
          files: options.files || ['src/test.ts'],
          engines: {
            typescript: options.engines?.typescript !== false,
            eslint: options.engines?.eslint !== false,
            prettier: options.engines?.prettier !== false,
          },
          fix: options.fix || false,
          format: options.format || 'stylish',
          staged: false,
          since: undefined,
          typescriptCacheDir: '.tscache',
          eslintCacheDir: '.eslintcache',
          prettierWrite: false,
          timeoutMs: 30000,
        }),
      ),
      clearCache: vi.fn(),
    }))
    ;(FileMatcher as any).mockImplementation(() => ({
      resolveFiles: vi.fn().mockResolvedValue(['src/test.ts']),
    }))

    // Initialize QualityChecker
    qualityChecker = new QualityChecker()
  })

  describe('Fix-First Execution Flow', () => {
    it('should execute fixable engines with fix enabled when fix option is true', async () => {
      // Setup mock returns
      mockESLintCheck.mockResolvedValue({
        success: true,
        issues: [],
      })
      mockPrettierCheck.mockResolvedValue({
        success: true,
        issues: [],
      })
      mockTypeScriptCheck.mockResolvedValue({
        success: true,
        issues: [],
      })

      const options: QualityCheckOptions = {
        fix: true,
        eslint: true,
        prettier: true,
        typescript: true,
      }

      // Note: This test will fail initially as check() expects files array, not options
      // This is expected in TDD - we're defining the desired API
      const result = await (qualityChecker as any).checkFixFirst(['src/test.ts'], options)

      // Verify ESLint was called with fix enabled
      expect(mockESLintCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          fix: true,
        }),
      )

      // Verify Prettier was called with write enabled
      expect(mockPrettierCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          write: true,
        }),
      )

      // TypeScript doesn't support fixing
      expect(mockTypeScriptCheck).toHaveBeenCalled()

      expect(result.success).toBe(true)
    })

    it('should only report unfixable issues after applying fixes', async () => {
      // ESLint fixes all its issues
      mockESLintCheck.mockResolvedValue({
        success: true,
        issues: [],
      })

      // Prettier fixes all its issues
      mockPrettierCheck.mockResolvedValue({
        success: true,
        issues: [],
      })

      // TypeScript has unfixable issues
      mockTypeScriptCheck.mockResolvedValue({
        success: false,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            file: 'src/test.ts',
            line: 10,
            col: 5,
            message: 'Type error: cannot assign string to number',
          },
        ],
      })

      const options: QualityCheckOptions = {
        fix: true,
        eslint: true,
        prettier: true,
        typescript: true,
      }

      // Note: This will fail initially - expected for TDD
      const result = await (qualityChecker as any).checkFixFirst(['src/test.ts'], options)

      // Should only contain the TypeScript error
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].engine).toBe('typescript')
      expect(result.success).toBe(false)
    })

    it('should track modified files during fix operations', async () => {
      mockESLintCheck.mockResolvedValue({
        success: true,
        issues: [],
        modifiedFiles: ['src/test.ts', 'src/other.js'],
      })

      mockPrettierCheck.mockResolvedValue({
        success: true,
        issues: [],
        modifiedFiles: ['src/other.js'],
      })

      mockTypeScriptCheck.mockResolvedValue({
        success: true,
        issues: [],
      })

      const options: QualityCheckOptions = {
        fix: true,
        eslint: true,
        prettier: true,
        typescript: true,
      }

      // Note: This will fail initially - expected for TDD
      const result = await (qualityChecker as any).checkFixFirst(
        ['src/test.ts', 'src/other.js'],
        options,
      )

      // Should track all unique modified files
      expect((result as any).modifiedFiles).toBeDefined()
      expect((result as any).modifiedFiles).toContain('src/test.ts')
      expect((result as any).modifiedFiles).toContain('src/other.js')
    })
  })

  describe('Performance Optimization', () => {
    it('should only call each engine once in fix-first mode', async () => {
      mockESLintCheck.mockResolvedValue({
        success: true,
        issues: [],
      })
      mockPrettierCheck.mockResolvedValue({
        success: true,
        issues: [],
      })
      mockTypeScriptCheck.mockResolvedValue({
        success: true,
        issues: [],
      })

      const options: QualityCheckOptions = {
        fix: true,
        eslint: true,
        prettier: true,
        typescript: true,
      }

      // Note: This will fail initially - expected for TDD
      await (qualityChecker as any).checkFixFirst(['src/test.ts'], options)

      // Each engine should only be called once
      expect(mockESLintCheck).toHaveBeenCalledTimes(1)
      expect(mockPrettierCheck).toHaveBeenCalledTimes(1)
      expect(mockTypeScriptCheck).toHaveBeenCalledTimes(1)
    })

    it('should maintain check-only behavior when fix is false', async () => {
      mockESLintCheck.mockResolvedValue({
        success: false,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            file: 'src/test.ts',
            line: 5,
            col: 10,
            message: 'Unused variable',
          },
        ],
      })

      const options: QualityCheckOptions = {
        fix: false,
        eslint: true,
        prettier: false,
        typescript: false,
      }

      // This should use the existing check method
      const result = await qualityChecker.check(['src/test.ts'], options)

      // Should be called without fix
      expect(mockESLintCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          fix: false,
        }),
      )

      // Should report the issue
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].message).toContain('Unused variable')
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain existing API when using standard check method', async () => {
      mockESLintCheck.mockResolvedValue({
        success: true,
        issues: [],
      })
      mockPrettierCheck.mockResolvedValue({
        success: true,
        issues: [],
      })
      mockTypeScriptCheck.mockResolvedValue({
        success: true,
        issues: [],
      })

      const options: QualityCheckOptions = {
        eslint: true,
        prettier: true,
        typescript: true,
      }

      // Should work with existing API
      const result = await qualityChecker.check(['src/test.ts'], options)

      expect(result.success).toBe(true)
      expect(result.issues).toEqual([])
    })
  })
})
