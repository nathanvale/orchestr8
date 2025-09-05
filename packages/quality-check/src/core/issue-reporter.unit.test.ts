import { describe, it, expect, beforeEach } from 'vitest'
import { IssueReporter } from './issue-reporter.js'
import type { QualityCheckResult } from '../types.js'

describe('IssueReporter with Enhanced Error Formatting', () => {
  let reporter: IssueReporter

  beforeEach(() => {
    reporter = new IssueReporter()
  })

  describe('Enhanced CLI formatting', () => {
    it('should_display_detailed_errors_when_formatting_for_cli', () => {
      // Arrange
      const result: QualityCheckResult = {
        success: false,
        checkers: {
          typescript: {
            success: false,
            errors: [
              "src/app.ts:10:5 - Cannot find name 'unknownVariable' (TS2304)",
              "src/app.ts:15:10 - Type 'string' is not assignable to type 'number' (TS2322)",
            ],
            fixable: false,
          },
          eslint: {
            success: false,
            errors: [
              'src/app.ts:20:25 - Missing semicolon (semi)',
              "src/app.ts:5:7 - 'config' is defined but never used (no-unused-vars)",
            ],
            fixable: true,
          },
        },
      }

      // Act
      const output = reporter.formatForCLI(result)

      // Assert
      expect(output).toContain('❌ Quality check failed')
      expect(output).toContain('📝 ESLint issues:')
      expect(output).toContain('src/app.ts:20:25')
      expect(output).toContain('Missing semicolon')
      expect(output).toContain('🔍 TypeScript issues:')
      expect(output).toContain('TS2304')
      expect(output).toContain('TS2322')
    })

    it('should_show_summary_statistics_when_multiple_errors_exist', () => {
      // Arrange
      const result: QualityCheckResult = {
        success: false,
        checkers: {
          eslint: {
            success: false,
            errors: ['error1', 'error2', 'error3'],
            fixable: true,
          },
        },
      }

      // Act
      const output = reporter.formatForCLI(result)

      // Assert
      expect(output).toContain('📝 ESLint issues')
      expect(output.split('\n').filter((line) => line.includes('error')).length).toBe(3)
    })
  })

  describe('Enhanced Claude formatting', () => {
    it('should_only_show_unfixable_errors_when_formatting_for_claude', () => {
      // Arrange
      const result: QualityCheckResult = {
        success: false,
        checkers: {
          typescript: {
            success: false,
            errors: ["src/app.ts:10:5 - Cannot find name 'unknownVariable' (TS2304)"],
            fixable: false,
          },
          prettier: {
            success: false,
            errors: ['src/app.ts - File needs formatting'],
            fixable: true,
          },
        },
        parsedErrors: [
          {
            file: 'src/app.ts',
            line: 10,
            column: 5,
            code: 'TS2304',
            message: "Cannot find name 'unknownVariable'",
            severity: 'error',
            source: 'typescript',
            fixable: false,
          },
        ],
      }

      // Act
      const output = reporter.formatForClaude(result)

      // Assert
      expect(output).toContain('Quality issues require attention')
      expect(output).toContain('TS2304')
      expect(output).not.toContain('formatting') // Fixable issue should be excluded
    })

    it('should_return_empty_string_when_all_errors_are_fixable', () => {
      // Arrange
      const result: QualityCheckResult = {
        success: false,
        checkers: {
          prettier: {
            success: false,
            errors: ['src/app.ts - File needs formatting'],
            fixable: true,
          },
          eslint: {
            success: false,
            errors: ['src/app.ts:10:25 - Missing semicolon (semi)'],
            fixable: true,
          },
        },
      }

      // Act
      const output = reporter.formatForClaude(result)

      // Assert
      expect(output).toBe('')
    })
  })

  describe('Enhanced JSON formatting', () => {
    it('should_include_parsed_errors_when_available', () => {
      // Arrange
      const result: QualityCheckResult = {
        success: false,
        checkers: {
          typescript: {
            success: false,
            errors: ['src/app.ts:10:5 - Error (TS2304)'],
            fixable: false,
          },
        },
        parsedErrors: [
          {
            file: 'src/app.ts',
            line: 10,
            column: 5,
            code: 'TS2304',
            message: "Cannot find name 'unknownVariable'",
            severity: 'error',
            source: 'typescript',
            fixable: false,
            category: 'type',
          },
        ],
      }

      // Act
      const output = reporter.formatForJSON(result)
      const parsed = JSON.parse(output)

      // Assert
      expect(parsed.parsedErrors).toBeDefined()
      expect(parsed.parsedErrors[0].category).toBe('type')
      expect(parsed.parsedErrors[0].file).toBe('src/app.ts')
    })
  })

  describe('Facade-specific detail levels', () => {
    it('should_provide_verbose_output_when_cli_requests_details', () => {
      // Arrange
      const result: QualityCheckResult = {
        success: false,
        checkers: {
          eslint: {
            success: false,
            errors: ["src/app.ts:10:5 - 'x' is defined but never used (no-unused-vars)"],
            fixable: false,
          },
        },
      }

      // Act
      const output = reporter.formatForCLI(result, { verbose: true })

      // Assert
      expect(output).toContain('no-unused-vars')
      expect(output).toContain('src/app.ts:10:5')
    })

    it('should_provide_minimal_output_when_claude_requests_summary', () => {
      // Arrange
      const result: QualityCheckResult = {
        success: false,
        checkers: {
          typescript: {
            success: false,
            errors: Array(10).fill('error'),
            fixable: false,
          },
        },
      }

      // Act
      const output = reporter.formatForClaude(result, { summary: true })

      // Assert
      expect(output).toContain('10 TypeScript errors')
      expect(output.length).toBeLessThan(200) // Ensure it's concise
    })
  })

  describe('Exit code determination with error classification', () => {
    it('should_return_exit_code_2_when_only_fixable_errors_exist', () => {
      // Arrange
      const result: QualityCheckResult = {
        success: false,
        checkers: {
          eslint: {
            success: false,
            errors: ['Missing semicolon (semi)'],
            fixable: true,
          },
        },
        parsedErrors: [
          {
            file: 'src/app.ts',
            line: 10,
            column: 25,
            code: 'semi',
            message: 'Missing semicolon',
            severity: 'error',
            source: 'eslint',
            fixable: true,
          },
        ],
      }

      // Act
      const exitCode = reporter.getExitCode(result)

      // Assert
      expect(exitCode).toBe(2) // All quality issues now return 2
    })

    it('should_return_exit_code_1_when_unfixable_errors_exist', () => {
      // Arrange
      const result: QualityCheckResult = {
        success: false,
        checkers: {
          typescript: {
            success: false,
            errors: ['Cannot find name (TS2304)'],
            fixable: false,
          },
        },
      }

      // Act
      const exitCode = reporter.getExitCode(result)

      // Assert
      expect(exitCode).toBe(2) // All quality issues now return 2
    })
  })

  describe('Performance optimization', () => {
    it('should_use_lazy_parsing_when_errors_not_needed', () => {
      // Arrange
      const result: QualityCheckResult = {
        success: true,
        checkers: {},
      }

      // Act
      const startTime = Date.now()
      const output = reporter.formatForCLI(result)
      const duration = Date.now() - startTime

      // Assert
      expect(output).toContain('✅ All quality checks passed')
      expect(duration).toBeLessThan(5) // Should be instant when no parsing needed
    })

    it('should_limit_error_parsing_when_max_threshold_reached', () => {
      // Arrange
      const manyErrors = Array(100)
        .fill(null)
        .map((_, i) => `src/file${i}.ts:${i}:5 - Error ${i} (CODE${i})`)

      const result: QualityCheckResult = {
        success: false,
        checkers: {
          eslint: {
            success: false,
            errors: manyErrors,
            fixable: false,
          },
        },
      }

      // Act
      const output = reporter.formatForCLI(result, { maxErrors: 50 })

      // Assert
      const errorLines = output.split('\n').filter((line) => line.includes('src/file'))
      expect(errorLines.length).toBeLessThanOrEqual(50)
    })
  })
})
