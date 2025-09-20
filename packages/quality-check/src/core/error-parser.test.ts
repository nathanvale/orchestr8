import { describe, it, expect } from 'vitest'
import { ErrorParser } from './error-parser.js'

describe('ErrorParser', () => {
  const parser = new ErrorParser()

  describe('TypeScript error parsing', () => {
    it('should_parse_basic_typescript_error_when_given_standard_format', () => {
      // Arrange
      const stderr = "src/app.ts(10,5): error TS2304: Cannot find name 'unknownVariable'."

      // Act
      const errors = parser.parseTypeScriptErrors(stderr)

      // Assert
      expect(errors).toEqual([
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
      ])
    })

    it('should_parse_multiple_typescript_errors_when_given_multiline_output', () => {
      // Arrange
      const stderr = `src/app.ts(10,5): error TS2304: Cannot find name 'unknownVariable'.
src/app.ts(15,10): error TS2322: Type 'string' is not assignable to type 'number'.
src/utils.ts(3,1): error TS1005: ';' expected.`

      // Act
      const errors = parser.parseTypeScriptErrors(stderr)

      // Assert
      expect(errors).toHaveLength(3)
      expect(errors[0].code).toBe('TS2304')
      expect(errors[1].code).toBe('TS2322')
      expect(errors[2].code).toBe('TS1005')
    })

    it('should_ignore_non_error_lines_when_parsing_typescript_output', () => {
      // Arrange
      const stderr = `Found 2 errors in 1 file.

Errors in src/app.ts:10:5
src/app.ts(10,5): error TS2304: Cannot find name 'unknownVariable'.

Build failed`

      // Act
      const errors = parser.parseTypeScriptErrors(stderr)

      // Assert
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe("Cannot find name 'unknownVariable'")
    })

    it('should_handle_empty_stderr_when_no_typescript_errors', () => {
      // Arrange
      const stderr = ''

      // Act
      const errors = parser.parseTypeScriptErrors(stderr)

      // Assert
      expect(errors).toEqual([])
    })

    it('should_parse_typescript_error_with_multiline_message_when_encountered', () => {
      // Arrange
      const stderr = `src/app.ts(25,3): error TS2345: Argument of type '{ id: number; name: string; invalid: boolean; }' is not assignable to parameter of type 'User'.
  Object literal may only specify known properties, and 'invalid' does not exist in type 'User'.`

      // Act
      const errors = parser.parseTypeScriptErrors(stderr)

      // Assert
      expect(errors).toHaveLength(1)
      expect(errors[0].code).toBe('TS2345')
      expect(errors[0].message).toContain('Argument of type')
    })
  })

  describe('Error categorization', () => {
    it('should_categorize_eslint_errors_as_fixable_when_rule_is_auto_fixable', () => {
      // Arrange
      const error = {
        file: 'src/app.ts',
        line: 10,
        column: 5,
        code: 'semi',
        message: 'Missing semicolon',
        severity: 'error' as const,
        source: 'eslint' as const,
        fixable: false,
      }

      // Act
      const categorized = parser.categorizeError(error)

      // Assert
      expect(categorized.fixable).toBe(true)
    })

    it('should_categorize_prettier_errors_as_fixable_when_formatting_issue', () => {
      // Arrange
      const error = {
        file: 'src/app.ts',
        line: 0,
        column: 0,
        code: 'prettier',
        message: 'File needs formatting',
        severity: 'error' as const,
        source: 'prettier' as const,
        fixable: false,
      }

      // Act
      const categorized = parser.categorizeError(error)

      // Assert
      expect(categorized.fixable).toBe(true)
    })

    it('should_categorize_typescript_errors_as_unfixable_when_compilation_error', () => {
      // Arrange
      const error = {
        file: 'src/app.ts',
        line: 10,
        column: 5,
        code: 'TS2304',
        message: "Cannot find name 'unknownVariable'",
        severity: 'error' as const,
        source: 'typescript' as const,
        fixable: false,
      }

      // Act
      const categorized = parser.categorizeError(error)

      // Assert
      expect(categorized.fixable).toBe(false)
    })

    it('should_identify_complexity_errors_when_eslint_rule_is_complexity_related', () => {
      // Arrange
      const error = {
        file: 'src/app.ts',
        line: 50,
        column: 1,
        code: 'complexity',
        message: 'Function has a complexity of 15',
        severity: 'error' as const,
        source: 'eslint' as const,
        fixable: false,
      }

      // Act
      const categorized = parser.categorizeError(error)

      // Assert
      expect(categorized.fixable).toBe(false)
      expect(categorized.category).toBe('complexity')
    })
  })

  describe('Performance', () => {
    it('should_parse_50_errors_within_performance_budget_when_given_large_output', () => {
      // Arrange
      const lines = []
      for (let i = 1; i <= 50; i++) {
        lines.push(`src/file${i}.ts(${i},5): error TS2304: Cannot find name 'var${i}'.`)
      }
      const stderr = lines.join('\n')

      // Act
      const startTime = Date.now()
      const errors = parser.parseTypeScriptErrors(stderr)
      const duration = Date.now() - startTime

      // Assert
      expect(errors).toHaveLength(50)
      expect(duration).toBeLessThan(100) // Should parse in under 100ms
    })

    it('should_limit_errors_when_exceeding_max_threshold', () => {
      // Arrange
      const lines = []
      for (let i = 1; i <= 100; i++) {
        lines.push(`src/file${i}.ts(${i},5): error TS2304: Cannot find name 'var${i}'.`)
      }
      const stderr = lines.join('\n')

      // Act
      const errors = parser.parseTypeScriptErrors(stderr, { maxErrors: 50 })

      // Assert
      expect(errors).toHaveLength(50)
    })
  })
})
