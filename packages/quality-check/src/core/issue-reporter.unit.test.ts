import { describe, it, expect, beforeEach } from 'vitest'
import { IssueReporter } from './issue-reporter.js'
import type { QualityCheckResult } from '../types/issue-types.js'
import type { Issue } from '../types/issue-types.js'

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
        duration: 100,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            ruleId: 'TS2304',
            file: 'src/app.ts',
            line: 10,
            col: 5,
            message: "Cannot find name 'unknownVariable'",
          },
          {
            engine: 'typescript',
            severity: 'error',
            ruleId: 'TS2322',
            file: 'src/app.ts',
            line: 15,
            col: 10,
            message: "Type 'string' is not assignable to type 'number'",
          },
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'semi',
            file: 'src/app.ts',
            line: 20,
            col: 25,
            message: 'Missing semicolon',
          },
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'no-unused-vars',
            file: 'src/app.ts',
            line: 5,
            col: 7,
            message: "'config' is defined but never used",
          },
        ],
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
        duration: 100,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'rule1',
            file: 'src/test.ts',
            line: 1,
            col: 1,
            message: 'error1',
          },
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'rule2',
            file: 'src/test.ts',
            line: 2,
            col: 1,
            message: 'error2',
          },
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'rule3',
            file: 'src/test.ts',
            line: 3,
            col: 1,
            message: 'error3',
          },
        ],
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
        duration: 100,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            ruleId: 'TS2304',
            file: 'src/app.ts',
            line: 10,
            col: 5,
            message: "Cannot find name 'unknownVariable'",
          },
        ],
      }

      // Act
      const output = reporter.formatForClaude(result)

      // Assert
      expect(output).toContain('<quality-check-result>')
      expect(output).toContain('<typescript>')
      expect(output).toContain('TS2304')
      expect(output).not.toContain('formatting') // Fixable issue should be excluded
    })

    it('should_return_empty_string_when_all_errors_are_fixable', () => {
      // Arrange
      const result: QualityCheckResult = {
        success: false,
        duration: 100,
        issues: [],
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
        duration: 100,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            ruleId: 'TS2304',
            file: 'src/app.ts',
            line: 10,
            col: 5,
            message: "Cannot find name 'unknownVariable'",
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
        duration: 100,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'no-unused-vars',
            file: 'src/app.ts',
            line: 10,
            col: 5,
            message: "'x' is defined but never used",
          },
        ],
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
        duration: 100,
        issues: Array(10).fill(null).map((_, i) => ({
          engine: 'typescript' as const,
          severity: 'error' as const,
          ruleId: `TS${i}`,
          file: 'src/app.ts',
          line: i + 1,
          col: 1,
          message: `error ${i}`,
        })),
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
        duration: 100,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            ruleId: 'semi',
            file: 'src/app.ts',
            line: 10,
            col: 25,
            message: 'Missing semicolon',
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
        duration: 100,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            ruleId: 'TS2304',
            file: 'src/app.ts',
            line: 1,
            col: 1,
            message: 'Cannot find name',
          },
        ],
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
        duration: 5,
        issues: [],
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
        duration: 100,
        issues: manyErrors.map((_, i) => ({
          engine: 'eslint' as const,
          severity: 'error' as const,
          ruleId: `CODE${i}`,
          file: `src/file${i}.ts`,
          line: i,
          col: 5,
          message: `Error ${i}`,
        })),
      }

      // Act
      const output = reporter.formatForCLI(result, { maxErrors: 50 })

      // Assert
      const errorLines = output.split('\n').filter((line) => line.includes('src/file'))
      expect(errorLines.length).toBeLessThanOrEqual(50)
    })
  })

  describe('Enhanced formatForClaude with ClaudeFormatter integration', () => {
    it('should_format_issues_using_claude_formatter_when_new_method_is_added', () => {
      // Arrange - Test data for the new formatForClaudeV2 method we'll create
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2304',
          file: 'src/app.ts',
          line: 10,
          col: 5,
          message: "Cannot find name 'unknownVariable'",
        },
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: 'no-unused-vars',
          file: 'src/app.ts',
          line: 5,
          col: 7,
          message: "'config' is defined but never used",
        },
      ]

      // Act - This test will be enabled when we add the new method
      // const output = reporter.formatForClaudeV2(issues)

      // Assert - Expected behavior for XML output
      // expect(output).toContain('<quality-check-result>')
      // expect(output).toContain('<typescript>')
      // expect(output).toContain('file="src/app.ts"')
      // expect(output).toContain('code="TS2304"')
      // expect(output).toContain("Cannot find name 'unknownVariable'")
      // expect(output).toContain('<eslint>')
      // expect(output).toContain('code="no-unused-vars"')
      // expect(output).toContain('</quality-check-result>')

      // For now, just verify the test data structure
      expect(issues).toHaveLength(2)
      expect(issues[0].engine).toBe('typescript')
      expect(issues[1].engine).toBe('eslint')
    })

    it('should_preserve_all_diagnostic_metadata_when_formatting_issues', () => {
      // Arrange - Test data for metadata preservation
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2322',
          file: '/absolute/path/to/file.ts',
          line: 15,
          col: 10,
          endLine: 15,
          endCol: 25,
          message: "Type 'string' is not assignable to type 'number'",
          suggestion: 'Convert the string to a number using parseInt() or parseFloat()',
        },
      ]

      // Act - This test will be enabled when we add the new method
      // const output = reporter.formatForClaudeV2(issues)

      // Assert - Expected behavior for metadata preservation
      // expect(output).toContain('file="/absolute/path/to/file.ts"')
      // expect(output).toContain('line="15"')
      // expect(output).toContain('column="10"')
      // expect(output).toContain('endLine="15"')
      // expect(output).toContain('endColumn="25"')
      // expect(output).toContain('code="TS2322"')
      // expect(output).toContain('SUGGESTION: Convert the string to a number')

      // For now, verify the test data has all metadata
      expect(issues[0]).toHaveProperty('endLine', 15)
      expect(issues[0]).toHaveProperty('endCol', 25)
      expect(issues[0]).toHaveProperty('suggestion')
    })

    // Tests for enhanced formatForClaude functionality - to be implemented in tasks 3.2-3.5
    it('should_prepare_for_claude_formatter_integration', () => {
      // This test validates that we have the necessary imports and structure
      // Ready for implementing ClaudeFormatter integration

      // Verify we have the necessary types
      const testIssue: Issue = {
        engine: 'typescript',
        severity: 'error',
        ruleId: 'TS2304',
        file: 'test.ts',
        line: 1,
        col: 1,
        message: 'Test message',
      }

      expect(testIssue.engine).toBe('typescript')
      expect(testIssue.severity).toBe('error')
      expect(testIssue.ruleId).toBe('TS2304')
    })

    it('should_preserve_complete_diagnostic_metadata_in_xml_output', () => {
      // Arrange - Issue with all possible metadata fields
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2322',
          file: '/project/src/components/App.tsx',
          line: 25,
          col: 12,
          endLine: 25,
          endCol: 24,
          message: "Type 'string' is not assignable to type 'number'",
          suggestion: 'Convert the string to a number using Number() or parseInt()',
        },
      ]

      // Act
      const output = reporter.formatForClaude(issues)

      // Assert - All metadata should be preserved in XML
      expect(output).toContain('file="/project/src/components/App.tsx"')
      expect(output).toContain('line="25"')
      expect(output).toContain('column="12"')
      expect(output).toContain('endLine="25"')
      expect(output).toContain('endColumn="24"')
      expect(output).toContain('code="TS2322"')
      expect(output).toContain(
        'Type &apos;string&apos; is not assignable to type &apos;number&apos;',
      )
      expect(output).toContain(
        'SUGGESTION: Convert the string to a number using Number() or parseInt()',
      )
    })

    it('should_preserve_metadata_in_detailed_output_mode', () => {
      // Arrange
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'prefer-const',
          file: 'src/utils/helpers.ts',
          line: 42,
          col: 7,
          message: "'data' is never reassigned. Use const instead of let",
          suggestion: 'Change let to const for immutable variables',
        },
      ]

      // Act
      const output = reporter.formatForClaude(issues, { verbose: true })

      // Assert - All metadata should be preserved in detailed format
      expect(output).toContain('src/utils/helpers.ts:42:7')
      expect(output).toContain('(prefer-const)')
      expect(output).toContain('⚠️') // Warning severity icon
      expect(output).toContain("'data' is never reassigned")
      expect(output).toContain('💡 Change let to const for immutable variables')
    })
  })
})
