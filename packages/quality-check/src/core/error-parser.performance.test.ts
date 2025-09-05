import { describe, test, expect, beforeEach } from 'vitest'
import { ErrorParser } from './error-parser.js'
import type { ParsedError } from '../types.js'

describe('ErrorParser Performance Tests', () => {
  let parser: ErrorParser

  beforeEach(() => {
    parser = new ErrorParser()
  })

  describe('Parsing overhead measurement', () => {
    test('should_parse_0_errors_with_minimal_overhead', () => {
      // Arrange - Empty stderr
      const stderr = ''

      // Act
      const startTime = performance.now()
      const errors = parser.parseTypeScriptErrors(stderr)
      const duration = performance.now() - startTime

      // Assert
      expect(errors).toHaveLength(0)
      expect(duration).toBeLessThan(2) // Should be very fast for empty input
    })

    test('should_parse_10_errors_within_performance_budget', () => {
      // Arrange - Generate 10 TypeScript errors
      const stderr = generateTypeScriptErrors(10)

      // Act
      const startTime = performance.now()
      const errors = parser.parseTypeScriptErrors(stderr)
      const duration = performance.now() - startTime

      // Assert
      expect(errors).toHaveLength(10)
      expect(duration).toBeLessThan(5) // Should parse 10 errors in under 5ms
    })

    test('should_parse_50_errors_within_performance_budget', () => {
      // Arrange - Generate 50 TypeScript errors
      const stderr = generateTypeScriptErrors(50)

      // Act
      const startTime = performance.now()
      const errors = parser.parseTypeScriptErrors(stderr)
      const duration = performance.now() - startTime

      // Assert
      expect(errors).toHaveLength(50)
      expect(duration).toBeLessThan(10) // Should parse 50 errors in under 10ms
    })

    test('should_respect_max_errors_limit_for_performance', () => {
      // Arrange - Generate 1000 errors but set limit to 50
      const stderr = generateTypeScriptErrors(1000)

      // Act
      const startTime = performance.now()
      const errors = parser.parseTypeScriptErrors(stderr, { maxErrors: 50 })
      const duration = performance.now() - startTime

      // Assert
      expect(errors).toHaveLength(50) // Should stop at 50
      expect(duration).toBeLessThan(10) // Should still be fast due to early exit
    })

    test('should_handle_100_plus_errors_with_limit', () => {
      // Arrange
      const errorCounts = [100, 500, 1000]

      errorCounts.forEach((count) => {
        const stderr = generateTypeScriptErrors(count)

        // Act
        const startTime = performance.now()
        const errors = parser.parseTypeScriptErrors(stderr, { maxErrors: 50 })
        const duration = performance.now() - startTime

        // Assert
        expect(errors).toHaveLength(50)
        expect(duration).toBeLessThan(15) // Should handle large inputs efficiently
      })
    })
  })

  describe('ESLint JSON parsing performance', () => {
    test('should_parse_eslint_json_efficiently', () => {
      // Arrange - Generate ESLint JSON with multiple files and errors
      const eslintJson = generateESLintJSON(10, 5) // 10 files, 5 errors each

      // Act
      const startTime = performance.now()
      const errors = parser.parseESLintErrors(eslintJson)
      const duration = performance.now() - startTime

      // Assert
      expect(errors).toHaveLength(50) // 10 files × 5 errors
      expect(duration).toBeLessThan(5) // JSON parsing should be very fast
    })

    test('should_handle_large_eslint_results_efficiently', () => {
      // Arrange - Large ESLint result set
      const eslintJson = generateESLintJSON(50, 10) // 50 files, 10 errors each

      // Act
      const startTime = performance.now()
      const errors = parser.parseESLintErrors(eslintJson)
      const duration = performance.now() - startTime

      // Assert
      expect(errors).toHaveLength(500)
      expect(duration).toBeLessThan(20) // Should handle 500 errors efficiently
    })
  })

  describe('Error categorization performance', () => {
    test('should_categorize_errors_quickly', () => {
      // Arrange
      const errors: ParsedError[] = Array.from({ length: 100 }, (_, i) => ({
        file: `file${i}.ts`,
        line: i,
        column: 1,
        code: i % 2 === 0 ? 'semi' : 'no-unused-vars',
        message: 'test error',
        severity: 'error',
        source: 'eslint',
        fixable: false,
      }))

      // Act
      const startTime = performance.now()
      const categorized = errors.map((err) => parser.categorizeError(err))
      const duration = performance.now() - startTime

      // Assert
      expect(categorized).toHaveLength(100)
      expect(duration).toBeLessThan(5) // Categorization should be very fast
    })
  })

  describe('Filtering by fixability performance', () => {
    test('should_filter_errors_by_fixability_efficiently', () => {
      // Arrange - Mix of fixable and unfixable errors
      const errors: ParsedError[] = Array.from({ length: 100 }, (_, i) => ({
        file: `file${i}.ts`,
        line: i,
        column: 1,
        code: i % 3 === 0 ? 'semi' : i % 3 === 1 ? 'TS2304' : 'no-unused-vars',
        message: 'test error',
        severity: 'error',
        source: i % 3 === 1 ? 'typescript' : 'eslint',
        fixable: false,
      }))

      // Act
      const startTime = performance.now()
      const { fixable, unfixable } = parser.filterByFixability(errors)
      const duration = performance.now() - startTime

      // Assert
      expect(fixable.length + unfixable.length).toBe(100)
      expect(duration).toBeLessThan(5) // Filtering should be fast
    })
  })

  describe('Overall parsing workflow performance', () => {
    test('should_complete_full_parsing_workflow_under_2_percent_overhead', () => {
      // Arrange - Simulate a real-world scenario
      const baseExecutionTime = 1000 // Assume base execution is 1000ms
      const maxOverheadPercent = 2
      const maxOverheadMs = baseExecutionTime * (maxOverheadPercent / 100)

      // Generate realistic error sets
      const tsErrors = generateTypeScriptErrors(30)
      const eslintJson = generateESLintJSON(5, 10)

      // Act - Measure full parsing workflow
      const startTime = performance.now()

      // Parse TypeScript errors
      const tsResults = parser.parseTypeScriptErrors(tsErrors)

      // Parse ESLint errors
      const eslintResults = parser.parseESLintErrors(eslintJson)

      // Combine and categorize
      const allErrors = [...tsResults, ...eslintResults]
      const categorized = allErrors.map((err) => parser.categorizeError(err))

      // Filter by fixability
      const { fixable, unfixable } = parser.filterByFixability(categorized)

      const duration = performance.now() - startTime

      // Assert
      expect(allErrors.length).toBeGreaterThan(0)
      expect(fixable.length + unfixable.length).toBe(categorized.length)
      expect(duration).toBeLessThan(maxOverheadMs) // Must be under 2% (20ms for 1000ms base)
    })
  })

  describe('Memory efficiency', () => {
    test('should_limit_memory_usage_with_error_volume_limits', () => {
      // Arrange - Generate massive error output
      const hugeStderr = generateTypeScriptErrors(10000)

      // Act - Parse with limit
      const startTime = performance.now()
      const errors = parser.parseTypeScriptErrors(hugeStderr, { maxErrors: 50 })
      const duration = performance.now() - startTime

      // Assert
      expect(errors).toHaveLength(50) // Limited to 50
      expect(duration).toBeLessThan(20) // Should exit early, not process all 10000

      // Verify memory efficiency by checking object size
      const jsonSize = JSON.stringify(errors).length
      expect(jsonSize).toBeLessThan(20000) // ~2KB per error max = ~100KB for 50 errors
    })
  })
})

// Helper functions for generating test data
function generateTypeScriptErrors(count: number): string {
  const errors: string[] = []
  for (let i = 0; i < count; i++) {
    const file = `src/file${i % 10}.ts`
    const line = Math.floor(Math.random() * 100) + 1
    const col = Math.floor(Math.random() * 80) + 1
    const errorCode = `TS${2300 + (i % 100)}`
    const message = `Test error ${i}: Cannot find name 'variable${i}'`
    errors.push(`${file}(${line},${col}): error ${errorCode}: ${message}.`)
  }
  return errors.join('\n')
}

function generateESLintJSON(fileCount: number, errorsPerFile: number): string {
  const results = []
  for (let f = 0; f < fileCount; f++) {
    const messages = []
    for (let e = 0; e < errorsPerFile; e++) {
      messages.push({
        ruleId: e % 2 === 0 ? 'semi' : 'no-unused-vars',
        severity: 2,
        message: `Error ${e} in file ${f}`,
        line: Math.floor(Math.random() * 100) + 1,
        column: Math.floor(Math.random() * 80) + 1,
        fix: e % 3 === 0 ? { range: [0, 1], text: ';' } : undefined,
      })
    }
    results.push({
      filePath: `/project/src/file${f}.ts`,
      messages,
      errorCount: messages.length,
      warningCount: 0,
    })
  }
  return JSON.stringify(results)
}
