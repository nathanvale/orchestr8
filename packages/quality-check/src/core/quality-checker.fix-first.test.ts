/**
 * Comprehensive tests for fix-first QualityChecker behavior
 * Tests the new architecture: File Edit → Fix → Git.add → Check → Report unfixable only
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import type { QualityCheckOptions } from '../types.js'
import type { QualityCheckResult } from '../types/issue-types.js'
import { QualityChecker } from './quality-checker.js'
import { ToolMissingError } from './errors.js'

/**
 * Mock implementations for testing fix-first behavior
 */
class MockESLintEngine {
  async check(config: {
    files: string[]
    fix?: boolean
    format?: string
    cacheDir?: string
    token?: any
  }): Promise<any> {
    if (config.fix) {
      // Simulate fix-first mode - applies fixes and returns only unfixable issues
      return {
        success: true,
        issues: [], // All ESLint issues were fixed
        fixedCount: 5,
        modifiedFiles: ['/src/index.ts', '/src/utils.ts'],
      }
    }

    // Regular check mode - returns all issues
    return {
      success: false,
      issues: [
        {
          engine: 'eslint',
          severity: 'error' as const,
          ruleId: 'no-console',
          file: '/src/index.ts',
          line: 10,
          col: 1,
          message: 'Unexpected console statement',
        },
      ],
      fixedCount: 0,
    }
  }

  clearCache(): void {}

  async generateErrorReport(): Promise<string> {
    return 'ESLint error report'
  }
}

class MockPrettierEngine {
  async check(config: {
    files: string[]
    write?: boolean
    fix?: boolean
    cwd?: string
    token?: any
  }): Promise<any> {
    if (config.fix || config.write) {
      // Simulate fix-first mode - applies formatting and returns only unfixable issues
      return {
        success: true,
        issues: [], // All Prettier issues were fixed
        fixedCount: 3,
        modifiedFiles: ['/src/components.tsx'],
      }
    }

    // Regular check mode - returns formatting issues
    return {
      success: false,
      issues: [
        {
          engine: 'prettier',
          severity: 'error' as const,
          ruleId: 'prettier/prettier',
          file: '/src/components.tsx',
          line: 5,
          col: 1,
          message: 'Code style issues',
        },
      ],
      fixedCount: 0,
    }
  }

  clearCache(): void {}

  async generateErrorReport(): Promise<string> {
    return 'Prettier error report'
  }
}

class MockTypeScriptEngine {
  async check(): Promise<any> {
    // TypeScript has unfixable type errors
    return {
      success: false,
      issues: [
        {
          engine: 'typescript',
          severity: 'error' as const,
          ruleId: 'TS2322',
          file: '/src/types.ts',
          line: 15,
          col: 5,
          message: 'Type string is not assignable to type number',
        },
      ],
    }
  }

  clearCache(): void {}
  getLastDiagnostics(): any[] {
    return []
  }

  async generateErrorReport(): Promise<string> {
    return 'TypeScript error report'
  }
}

class MockGitOperations {
  modifiedFiles: string[] = []

  async stageFiles(files: string[]): Promise<{ success: boolean; stagedFiles: string[] }> {
    this.modifiedFiles.push(...files)
    return {
      success: true,
      stagedFiles: files,
    }
  }

  async detectModifiedFiles(): Promise<string[]> {
    return this.modifiedFiles
  }

  clear(): void {
    this.modifiedFiles = []
  }
}

describe('QualityChecker Fix-First Architecture', () => {
  let qualityChecker: QualityChecker
  let mockESLint: MockESLintEngine
  let mockPrettier: MockPrettierEngine
  let mockTypeScript: MockTypeScriptEngine
  let mockGit: MockGitOperations

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock instances
    mockESLint = new MockESLintEngine()
    mockPrettier = new MockPrettierEngine()
    mockTypeScript = new MockTypeScriptEngine()
    mockGit = new MockGitOperations()

    // Create QualityChecker instance
    qualityChecker = new QualityChecker()

    // Mock the internal engines (this will be implemented when we modify QualityChecker)
    // @ts-expect-error - Accessing private property for testing
    qualityChecker.eslintEngine = mockESLint
    // @ts-expect-error - Accessing private property for testing
    qualityChecker.prettierEngine = mockPrettier
    // @ts-expect-error - Accessing private property for testing
    qualityChecker.typescriptEngine = mockTypeScript
    // @ts-expect-error - Accessing private property for testing
    qualityChecker.gitOperations = mockGit
  })

  afterEach(() => {
    qualityChecker.clearCaches()
    mockGit.clear()
    vi.restoreAllMocks()
  })

  describe('Fix-First Execution Flow', () => {
    test('should_execute_fixable_engines_with_fix_flag_enabled', async () => {
      // Arrange
      const files = ['/src/index.ts', '/src/utils.ts', '/src/components.tsx']
      const options: QualityCheckOptions = { fixFirst: true }

      const eslintSpy = vi.spyOn(mockESLint, 'check')
      const prettierSpy = vi.spyOn(mockPrettier, 'check')

      // Act
      await qualityChecker.check(files, options)

      // Assert - Fixable engines should be called with fix enabled
      expect(eslintSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          files,
          fix: true,
        }),
      )
      expect(prettierSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          files,
          write: true,
        }),
      )
    })

    test('should_auto_stage_successfully_fixed_files', async () => {
      // Arrange
      const files = ['/src/index.ts', '/src/components.tsx']
      const options: QualityCheckOptions = { fixFirst: true }

      const gitStageSpy = vi.spyOn(mockGit, 'stageFiles')

      // Act
      await qualityChecker.check(files, options)

      // Assert - Auto-staging should occur for modified files
      expect(gitStageSpy).toHaveBeenCalledWith([
        '/src/index.ts',
        '/src/utils.ts',
        '/src/components.tsx',
      ])
    })

    test('should_execute_engines_in_correct_order_fix_first_then_check_only', async () => {
      // Arrange
      const files = ['/src/index.ts']
      const options: QualityCheckOptions = { fixFirst: true }

      const callOrder: string[] = []

      vi.spyOn(mockESLint, 'check').mockImplementation(async (config) => {
        callOrder.push(`eslint-${config.fix ? 'fix' : 'check'}`)
        return { success: true, issues: [], fixedCount: config.fix ? 2 : 0 }
      })

      vi.spyOn(mockPrettier, 'check').mockImplementation(async (config) => {
        callOrder.push(`prettier-${config.fix || config.write ? 'fix' : 'check'}`)
        return { success: true, issues: [], fixedCount: config.fix ? 1 : 0 }
      })

      vi.spyOn(mockTypeScript, 'check').mockImplementation(async () => {
        callOrder.push('typescript-check')
        return { success: true, issues: [] }
      })

      // Act
      await qualityChecker.check(files, options)

      // Assert - Fix-capable engines should run first with fix enabled, then check-only engines
      expect(callOrder).toEqual([
        'eslint-fix',
        'prettier-fix',
        'typescript-check', // TypeScript runs after fixes applied
      ])
    })
  })

  describe('Error Reporting Optimization', () => {
    test('should_filter_out_successfully_fixed_issues_from_final_report', async () => {
      // Arrange
      const files = ['/src/index.ts']
      const options: QualityCheckOptions = { fixFirst: true }

      // Act
      const result: QualityCheckResult = await qualityChecker.check(files, options)

      // Assert - Only unfixable issues should be reported (TypeScript errors in this case)
      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]).toMatchObject({
        engine: 'typescript',
        severity: 'error',
        ruleId: 'TS2322',
        message: 'Type string is not assignable to type number',
      })

      // ESLint and Prettier issues should not be in the final report since they were fixed
      expect(result.issues.some((issue) => issue.engine === 'eslint')).toBe(false)
      expect(result.issues.some((issue) => issue.engine === 'prettier')).toBe(false)
    })

    test('should_preserve_unfixable_issues_for_user_attention', async () => {
      // Arrange
      const files = ['/src/index.ts']
      const options: QualityCheckOptions = { fixFirst: true }

      // Mock ESLint to return some unfixable issues
      vi.spyOn(mockESLint, 'check').mockResolvedValue({
        success: false,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'no-undef',
            file: '/src/index.ts',
            line: 5,
            col: 1,
            message: 'undefined_variable is not defined',
          },
        ],
        fixedCount: 3, // Some were fixed, but not all
        modifiedFiles: ['/src/index.ts'],
      })

      // Act
      const result: QualityCheckResult = await qualityChecker.check(files, options)

      // Assert - Unfixable issues should be preserved in report
      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(2) // 1 ESLint unfixable + 1 TypeScript

      const eslintIssue = result.issues.find((issue) => issue.engine === 'eslint')
      expect(eslintIssue).toMatchObject({
        ruleId: 'no-undef',
        message: 'undefined_variable is not defined',
      })
    })

    test('should_track_fixed_vs_unfixed_issues_in_result_metadata', async () => {
      // Arrange
      const files = ['/src/index.ts']
      const options: QualityCheckOptions = { fixFirst: true }

      // Act
      const result: QualityCheckResult = await qualityChecker.check(files, options)

      // Assert - Result should include metadata about fixes applied
      expect(result.fixesApplied).toEqual([
        {
          engine: 'eslint',
          fixedCount: 5,
          modifiedFiles: ['/src/index.ts', '/src/utils.ts'],
        },
        {
          engine: 'prettier',
          fixedCount: 3,
          modifiedFiles: ['/src/components.tsx'],
        },
      ])
    })
  })

  describe('Performance Characteristics', () => {
    test('should_avoid_double_execution_of_fixable_engines', async () => {
      // Arrange
      const files = ['/src/index.ts']
      const options: QualityCheckOptions = { fixFirst: true }

      const eslintSpy = vi.spyOn(mockESLint, 'check')
      const prettierSpy = vi.spyOn(mockPrettier, 'check')

      // Act
      await qualityChecker.check(files, options)

      // Assert - Each fixable engine should only be called once (in fix mode)
      expect(eslintSpy).toHaveBeenCalledTimes(1)
      expect(prettierSpy).toHaveBeenCalledTimes(1)

      // Verify they were called with fix enabled
      expect(eslintSpy).toHaveBeenCalledWith(expect.objectContaining({ fix: true }))
      expect(prettierSpy).toHaveBeenCalledWith(expect.objectContaining({ write: true }))
    })

    test('should_complete_significantly_faster_than_check_then_fix_approach', async () => {
      // Arrange
      const files = ['/src/index.ts']
      const options: QualityCheckOptions = { fixFirst: true }

      // Act
      const result = await qualityChecker.check(files, options)

      // Assert
      expect(result.duration).toBeDefined()
      expect(result.duration).toBeLessThan(1000) // Should complete quickly in fix-first mode

      // Performance improvement should be documented in result metadata
      expect(result.performanceOptimizations).toContain('fix-first-single-execution')
    })
  })

  describe('Backward Compatibility', () => {
    test('should_maintain_existing_interface_contracts', async () => {
      // Arrange
      const files = ['/src/index.ts']
      const legacyOptions: QualityCheckOptions = {
        fix: false, // Legacy check-only mode
        typescript: true,
        eslint: true,
        prettier: true,
      }

      // Act
      const result = await qualityChecker.check(files, legacyOptions)

      // Assert - Should work in legacy mode without fix-first behavior
      expect(result).toMatchObject({
        success: expect.any(Boolean),
        duration: expect.any(Number),
        issues: expect.any(Array),
        correlationId: expect.any(String),
      })
    })

    test('should_support_fallback_to_check_then_fix_for_edge_cases', async () => {
      // Arrange
      const files = ['/src/index.ts']
      const options: QualityCheckOptions = {
        fixFirst: true,
        fallbackToCheckThenFix: true, // Edge case handling
      }

      // Mock engine failure in fix mode
      vi.spyOn(mockESLint, 'check').mockImplementation(async (config) => {
        if (config.fix) {
          throw new Error('Fix mode failed')
        }
        return { success: false, issues: [], fixedCount: 0 }
      })

      // Act
      const result = await qualityChecker.check(files, options)

      // Assert - Should fallback gracefully without crashing
      expect(result.success).toBeDefined()
      expect(result.fallbackUsed).toBe(true)
    })
  })

  describe('Git Integration and Auto-staging', () => {
    test('should_detect_which_files_were_modified_by_fix_operations', async () => {
      // Arrange
      const files = ['/src/index.ts', '/src/components.tsx']
      const options: QualityCheckOptions = { fixFirst: true }

      const detectSpy = vi.spyOn(mockGit, 'detectModifiedFiles')

      // Act
      await qualityChecker.check(files, options)

      // Assert - Should detect modifications from fix operations
      expect(detectSpy).toHaveBeenCalled()
    })

    test('should_handle_git_staging_failures_gracefully', async () => {
      // Arrange
      const files = ['/src/index.ts']
      const options: QualityCheckOptions = { fixFirst: true }

      // Mock git staging failure
      vi.spyOn(mockGit, 'stageFiles').mockResolvedValue({
        success: false,
        stagedFiles: [],
      })

      // Act
      const result = await qualityChecker.check(files, options)

      // Assert - Should continue execution and report the staging failure
      expect(result.success).toBeDefined()
      expect(result.warnings).toContain('Auto-staging failed for some files')
    })

    test('should_ensure_staging_only_occurs_after_successful_fixes', async () => {
      // Arrange
      const files = ['/src/index.ts']
      const options: QualityCheckOptions = { fixFirst: true }

      // Mock ESLint fix failure
      vi.spyOn(mockESLint, 'check').mockResolvedValue({
        success: false,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            file: '/src/index.ts',
            line: 1,
            col: 1,
            message: 'Fix failed',
          },
        ],
        fixedCount: 0,
        modifiedFiles: [],
      })

      const stageSpy = vi.spyOn(mockGit, 'stageFiles')

      // Act
      await qualityChecker.check(files, options)

      // Assert - No staging should occur if no files were successfully fixed
      expect(stageSpy).toHaveBeenCalledWith(['/src/components.tsx']) // Only Prettier fixes succeeded
    })
  })

  describe('Error Handling', () => {
    test('should_handle_missing_tools_gracefully_in_fix_first_mode', async () => {
      // Arrange
      const files = ['/src/index.ts']
      const options: QualityCheckOptions = { fixFirst: true }

      // Mock ESLint tool missing
      vi.spyOn(mockESLint, 'check').mockRejectedValue(
        new ToolMissingError('eslint', 'ESLint binary not found'),
      )

      // Act
      const result = await qualityChecker.check(files, options)

      // Assert - Should continue with other engines and report missing tool
      expect(result.success).toBeDefined()
      expect(result.issues.some((issue) => issue.message.includes('ESLint is not available'))).toBe(
        true,
      )
    })

    test('should_aggregate_results_from_successful_engines_when_some_fail', async () => {
      // Arrange
      const files = ['/src/index.ts']
      const options: QualityCheckOptions = { fixFirst: true }

      // Mock one engine failure
      vi.spyOn(mockESLint, 'check').mockRejectedValue(new Error('ESLint crashed'))

      // Act
      const result = await qualityChecker.check(files, options)

      // Assert - Should aggregate results from successful engines
      expect(result.fixesApplied).toBeDefined()
      expect(result.fixesApplied).toHaveLength(1) // Only Prettier succeeded
      expect(result.fixesApplied![0].engine).toBe('prettier')
      expect(result.issues.some((issue) => issue.engine === 'typescript')).toBe(true)
    })
  })
})
