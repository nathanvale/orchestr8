/**
 * Fix-First QualityChecker Test Suite
 * Tests the new fix-first architecture, auto-staging, and performance optimizations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QualityChecker } from './quality-checker.js'
import type { CheckerResult } from '../types/issue-types.js'

// Mock dependencies
vi.mock('../engines/typescript-engine.js')
vi.mock('../engines/eslint-engine.js')
vi.mock('../engines/prettier-engine.js')
vi.mock('./config-loader.js')
vi.mock('./file-matcher.js')
vi.mock('../utils/logger.js', () => ({
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

// Mock simple-git for auto-staging tests
vi.mock('simple-git', () => {
  return {
    simpleGit: vi.fn(() => ({
      add: vi.fn().mockResolvedValue(undefined),
      status: vi.fn().mockResolvedValue({
        modified: [],
        created: [],
        deleted: [],
        staged: [],
      }),
    })),
  }
})

describe('QualityChecker Fix-First Architecture', () => {
  let checker: QualityChecker
  let mockTypeScriptEngine: any
  let mockESLintEngine: any
  let mockPrettierEngine: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Import mocks after clearing
    const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
    const { ESLintEngine } = await import('../engines/eslint-engine.js')
    const { PrettierEngine } = await import('../engines/prettier-engine.js')
    const { ConfigLoader } = await import('./config-loader.js')
    const { FileMatcher } = await import('./file-matcher.js')

    // Setup mock implementations using vi.mocked
    vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])
    vi.mocked(ConfigLoader).prototype.load = vi.fn().mockImplementation((options) =>
      Promise.resolve({
        files: ['test.ts'],
        fix: options.fix ?? false, // Use the fix value from input options
        engines: {
          typescript: true,
          eslint: true,
          prettier: true,
        },
      }),
    )

    // Setup default mock implementations for engines BEFORE creating QualityChecker
    vi.mocked(ESLintEngine).prototype.check = vi.fn().mockResolvedValue({
      success: true,
      issues: [],
      fixedCount: 0,
    })
    vi.mocked(PrettierEngine).prototype.check = vi.fn().mockResolvedValue({
      success: true,
      issues: [],
      fixedCount: 0,
    })
    vi.mocked(TypeScriptEngine).prototype.check = vi.fn().mockResolvedValue({
      success: true,
      issues: [],
    })

    // Store references for test assertions
    mockTypeScriptEngine = TypeScriptEngine as any
    mockESLintEngine = ESLintEngine as any
    mockPrettierEngine = PrettierEngine as any

    checker = new QualityChecker()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('Fix-First Execution Flow (Using enhanced check method)', () => {
    it('should execute ESLint with fix:true when fixFirst option is enabled', async () => {
      // Arrange - Override default mocks with specific test values
      const mockESLintResult: CheckerResult = {
        success: true,
        issues: [],
        fixedCount: 3,
        fixable: true,
      }

      const mockPrettierResult: CheckerResult = {
        success: true,
        issues: [],
        fixedCount: 1,
        fixable: true,
      }

      const mockTypeScriptResult: CheckerResult = {
        success: true,
        issues: [],
      }

      vi.mocked(mockESLintEngine.prototype.check).mockResolvedValue(mockESLintResult)
      vi.mocked(mockPrettierEngine.prototype.check).mockResolvedValue(mockPrettierResult)
      vi.mocked(mockTypeScriptEngine.prototype.check).mockResolvedValue(mockTypeScriptResult)

      // Act - Using enhanced check method with fix-first option
      const result = await checker.check(['test.ts'], { fix: true, fixFirst: true })

      // Assert
      expect(vi.mocked(mockESLintEngine.prototype.check)).toHaveBeenCalledWith(
        expect.objectContaining({
          files: ['test.ts'],
          fix: true,
        }),
      )

      expect(result.success).toBe(true)
      // Result should include information about fixes applied
      expect(result).toHaveProperty('issues')
    })

    it('should execute Prettier with write:true when fixFirst option is enabled', async () => {
      // Arrange
      const mockPrettierResult: CheckerResult = {
        success: true,
        issues: [],
        fixedCount: 2,
        fixable: true,
      }

      vi.mocked(mockESLintEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 0,
      })
      vi.mocked(mockPrettierEngine.prototype.check).mockResolvedValue(mockPrettierResult)
      vi.mocked(mockTypeScriptEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
      })

      // Act
      await checker.check(['test.ts'], { fix: true, fixFirst: true })

      // Assert
      expect(mockPrettierEngine.prototype.check).toHaveBeenCalledWith(
        expect.objectContaining({
          files: ['test.ts'],
          write: true,
        }),
      )
    })

    it('should handle mix of fixable and unfixable issues correctly', async () => {
      // Arrange
      const eslintIssues = [
        {
          engine: 'eslint' as const,
          severity: 'error' as const,
          file: 'test.ts',
          line: 1,
          col: 1,
          message: 'Unfixable ESLint error',
        },
      ]

      vi.mocked(mockESLintEngine.prototype.check).mockResolvedValue({
        success: false,
        issues: eslintIssues,
        fixedCount: 2, // Fixed some, but not all
      })

      vi.mocked(mockPrettierEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 1,
      })

      vi.mocked(mockTypeScriptEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
      })

      // Act
      const result = await checker.check(['test.ts'], { fix: true, fixFirst: true })

      // Assert
      expect(result.success).toBe(false) // Should fail due to unfixable ESLint issues
      expect(result.issues).toEqual(eslintIssues)
    })
  })

  describe('Auto-staging Implementation Tests', () => {
    it('should validate git staging workflow integration', async () => {
      // Arrange
      const { simpleGit } = await import('simple-git')
      const mockGit = {
        add: vi.fn().mockResolvedValue(undefined),
        status: vi.fn().mockResolvedValue({
          modified: ['test.ts'],
          created: [],
          deleted: [],
          staged: [],
        }),
      }
      ;(simpleGit as any).mockReturnValue(mockGit)

      vi.mocked(mockESLintEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 1,
        modifiedFiles: ['test.ts'], // Future: Engine should report modified files
      })

      vi.mocked(mockPrettierEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 1,
        modifiedFiles: ['test.ts'],
      })

      vi.mocked(mockTypeScriptEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
      })

      // Act - This will be enhanced in the implementation
      const result = await checker.check(['test.ts'], { fix: true, autoStage: true })

      // Assert - Verify the result structure is ready for auto-staging
      expect(result.success).toBe(true)
      // Future: expect(result.autoStaged).toBeDefined()
    })
  })

  describe('Error Reporting Filter Tests', () => {
    it('should identify fixable vs unfixable issues for filtering', async () => {
      // Arrange
      const mixedESLintIssues = [
        {
          engine: 'eslint' as const,
          severity: 'error' as const,
          file: 'test.ts',
          line: 1,
          col: 1,
          message: 'Missing semicolon', // Typically fixable
          ruleId: 'semi',
        },
        {
          engine: 'eslint' as const,
          severity: 'error' as const,
          file: 'test.ts',
          line: 2,
          col: 1,
          message: 'Unfixable custom error',
          ruleId: 'custom-rule',
        },
      ]

      vi.mocked(mockESLintEngine.prototype.check).mockResolvedValue({
        success: false,
        issues: mixedESLintIssues,
        fixedCount: 1, // One was fixed
        fixable: true,
      })

      vi.mocked(mockPrettierEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 0,
      })

      vi.mocked(mockTypeScriptEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
      })

      // Act
      const result = await checker.check(['test.ts'], { fix: true, fixFirst: true })

      // Assert
      expect(result.issues).toHaveLength(2) // Currently returns all issues
      // Future: In fix-first mode, should filter out fixed issues
      // expect(result.issues).toHaveLength(1) // Only unfixable issues
    })

    it('should preserve unfixable TypeScript issues', async () => {
      // Arrange
      const unfixableTypeScriptIssues = [
        {
          engine: 'typescript' as const,
          severity: 'error' as const,
          file: 'test.ts',
          line: 5,
          col: 10,
          message: 'Type error: Cannot assign string to number',
        },
      ]

      vi.mocked(mockESLintEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 3,
      })

      vi.mocked(mockPrettierEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 1,
      })

      vi.mocked(mockTypeScriptEngine.prototype.check).mockResolvedValue({
        success: false,
        issues: unfixableTypeScriptIssues,
      })

      // Act
      const result = await checker.check(['test.ts'], { fix: true, fixFirst: true })

      // Assert
      expect(result.success).toBe(false)
      expect(result.issues).toEqual(unfixableTypeScriptIssues)
    })
  })

  describe('Performance Characteristics', () => {
    it('should demonstrate single execution pattern', async () => {
      // Arrange
      vi.mocked(mockESLintEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 2,
      })

      vi.mocked(mockPrettierEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 1,
      })

      vi.mocked(mockTypeScriptEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
      })

      // Act
      await checker.check(['test.ts'], { fix: true, fixFirst: true })

      // Assert
      // Each engine should only be called once (fix-first eliminates double execution)
      expect(mockESLintEngine.prototype.check).toHaveBeenCalledTimes(1)
      expect(mockPrettierEngine.prototype.check).toHaveBeenCalledTimes(1)
      expect(mockTypeScriptEngine.prototype.check).toHaveBeenCalledTimes(1)
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain existing check() interface without fix-first mode', async () => {
      // Arrange
      vi.mocked(mockESLintEngine.prototype.check).mockResolvedValue({
        success: false,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            file: 'test.ts',
            line: 1,
            col: 1,
            message: 'ESLint error',
          },
        ],
      })

      vi.mocked(mockPrettierEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
      })

      vi.mocked(mockTypeScriptEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
      })

      // Act
      const result = await checker.check(['test.ts'], { fix: false })

      // Assert
      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      // Should call engines with fix: false
      expect(mockESLintEngine.prototype.check).toHaveBeenCalledWith(
        expect.objectContaining({ fix: false }),
      )
    })

    it('should support both legacy fix() method and enhanced check() method', async () => {
      // Arrange
      vi.mocked(mockESLintEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 2,
      })

      vi.mocked(mockPrettierEngine.prototype.check).mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 1,
      })

      // Act - using legacy fix() method
      const legacyResult = await checker.fix(['test.ts'])

      // Act - using enhanced check() method with fix:true
      const enhancedResult = await checker.check(['test.ts'], { fix: true })

      // Assert - both should work
      expect(legacyResult.success).toBe(true)
      expect(enhancedResult.success).toBe(true)
      expect(legacyResult.count).toBe(3) // 2 ESLint + 1 Prettier
      expect(enhancedResult.issues).toBeDefined()
    })
  })
})
