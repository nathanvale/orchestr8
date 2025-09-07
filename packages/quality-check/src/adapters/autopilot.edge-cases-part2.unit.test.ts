import { describe, test, expect, beforeEach } from 'vitest'
import { Autopilot } from './autopilot.js'
import type { Issue, CheckResult } from '../types.js'

describe('Autopilot - Edge Cases Part 2: Performance & Edge Cases', () => {
  let autopilot: Autopilot

  beforeEach(() => {
    autopilot = new Autopilot()
  })

  describe('5.3: Performance validation under load', () => {
    test('should_handle_100_plus_mixed_errors_efficiently', () => {
      // Arrange - Generate 150 mixed issues
      const largeIssueSet: Issue[] = [
        // 60 formatting issues
        ...Array(60)
          .fill(null)
          .map((_, i) => ({
            engine: 'eslint' as const,
            severity: 'warning' as const,
            ruleId: 'prettier/prettier',
            file: 'large.ts',
            line: i + 1,
            col: 1,
            message: `Formatting issue ${i}`,
          })),

        // 30 import issues
        ...Array(30)
          .fill(null)
          .map((_, i) => ({
            engine: 'eslint' as const,
            severity: 'warning' as const,
            ruleId: 'import/order',
            file: 'large.ts',
            line: i + 100,
            col: 1,
            message: `Import issue ${i}`,
          })),

        // 20 modernization issues
        ...Array(20)
          .fill(null)
          .map((_, i) => ({
            engine: 'eslint' as const,
            severity: 'warning' as const,
            ruleId: 'prefer-const',
            file: 'large.ts',
            line: i + 200,
            col: 1,
            message: `Modernization issue ${i}`,
          })),

        // 20 context-dependent issues
        ...Array(20)
          .fill(null)
          .map((_, i) => ({
            engine: 'eslint' as const,
            severity: 'warning' as const,
            ruleId: 'no-console',
            file: 'large.ts',
            line: i + 300,
            col: 1,
            message: `Console issue ${i}`,
          })),

        // 20 unfixable issues
        ...Array(20)
          .fill(null)
          .map((_, i) => ({
            engine: 'eslint' as const,
            severity: 'error' as const,
            ruleId: 'complexity',
            file: 'large.ts',
            line: i + 400,
            col: 1,
            message: `Complexity issue ${i}`,
          })),
      ]

      const checkResult: CheckResult = {
        filePath: 'src/large.ts',
        issues: largeIssueSet,
        hasErrors: true,
        hasWarnings: false,
        fixable: true,
      }

      // Act & measure performance
      const startTime = performance.now()
      const decision = autopilot.decide(checkResult)
      const endTime = performance.now()
      const duration = endTime - startTime

      // Assert - Performance requirements
      expect(duration).toBeLessThan(10) // Must be under 10ms

      // Assert - Correct classification
      expect(decision.action).toBe('FIX_AND_REPORT')
      expect(decision.fixes?.length).toBe(130) // 60 + 30 + 20 + 20 context
      expect(decision.issues?.length).toBe(20) // Only unfixable
    })

    test('should_validate_classification_speed_with_large_error_sets', () => {
      // Generate 1000 issues for stress testing
      const veryLargeSet: Issue[] = Array(1000)
        .fill(null)
        .map(
          (_, i) =>
            ({
              engine: 'eslint',
              severity: i % 3 === 0 ? 'error' : 'warning',
              ruleId: i % 3 === 0 ? 'prettier/prettier' : i % 3 === 1 ? 'no-console' : 'complexity',
              file: `file${i}.ts`,
              line: (i % 100) + 1,
              col: 1,
              message: `Issue ${i}`,
            }) as Issue,
        )

      const checkResult: CheckResult = {
        filePath: 'stress-test.ts',
        issues: veryLargeSet,
        hasErrors: true,
        hasWarnings: true,
        fixable: true,
      }

      // Act & measure
      const startTime = performance.now()
      const decision = autopilot.decide(checkResult)
      const duration = performance.now() - startTime

      // Assert
      expect(duration).toBeLessThan(50) // Even 1000 issues should be under 50ms
      expect(decision).toBeDefined()
      expect(decision.action).toBeDefined()
    })

    test('should_handle_concurrent_operations_without_memory_issues', () => {
      // Simulate concurrent calls
      const results = []

      for (let batch = 0; batch < 10; batch++) {
        const issues: Issue[] = Array(50)
          .fill(null)
          .map((_, i) => ({
            engine: 'eslint' as const,
            severity: 'warning' as const,
            ruleId: 'prettier/prettier',
            file: `batch${batch}-file${i}.ts`,
            line: i + 1,
            col: 1,
            message: `Batch ${batch} Issue ${i}`,
          }))

        const checkResult: CheckResult = {
          filePath: `batch${batch}.ts`,
          issues,
          hasErrors: false,
          hasWarnings: true,
          fixable: true,
        }

        const decision = autopilot.decide(checkResult)
        results.push(decision)
      }

      // Assert all batches processed correctly
      expect(results).toHaveLength(10)
      results.forEach((decision) => {
        expect(decision.action).toBe('FIX_SILENTLY')
        expect(decision.fixes?.length).toBe(50)
      })
    })
  })

  describe('Edge cases and malformed input handling', () => {
    test('should_handle_empty_issues_array', () => {
      const checkResult: CheckResult = {
        filePath: 'test.ts',
        issues: [],
        hasErrors: false,
        hasWarnings: false,
        fixable: false,
      }

      const decision = autopilot.decide(checkResult)
      expect(decision.action).toBe('CONTINUE')
      expect(decision.confidence).toBe(1.0)
    })

    test('should_handle_issues_without_rules', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'warning',
          file: 'test.ts',
          line: 1,
          col: 1,
          message: 'Some issue',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          file: 'test.ts',
          line: 2,
          col: 1,
          message: 'Another issue',
        },
      ]

      const checkResult: CheckResult = {
        filePath: 'test.ts',
        issues,
        hasErrors: false,
        hasWarnings: true,
        fixable: true,
      }

      const decision = autopilot.decide(checkResult)
      expect(decision.action).toBe('REPORT_ONLY')
      expect(decision.issues?.length).toBe(2)
    })

    test('should_handle_missing_file_paths', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'prettier/prettier',
          file: '',
          line: 1,
          col: 1,
          message: 'Missing file path',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'no-console',
          file: '',
          line: 1,
          col: 1,
          message: 'Another missing path',
        },
      ]

      const checkResult: CheckResult = {
        filePath: '',
        issues,
        hasErrors: false,
        hasWarnings: true,
        fixable: true,
      }

      const decision = autopilot.decide(checkResult)
      // Without file path, context-dependent rules are unfixable
      expect(decision.action).toBe('FIX_AND_REPORT')
      expect(decision.fixes?.length).toBe(1) // Only prettier
      expect(decision.issues?.length).toBe(1) // no-console can't be fixed without context
    })

    test('should_handle_unknown_rules_conservatively', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'unknown-rule-1',
          file: 'test.ts',
          line: 1,
          col: 1,
          message: 'Unknown rule 1',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'future-eslint-rule',
          file: 'test.ts',
          line: 2,
          col: 1,
          message: 'Future rule',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: '@custom/plugin-rule',
          file: 'test.ts',
          line: 3,
          col: 1,
          message: 'Custom plugin rule',
        },
      ]

      const checkResult: CheckResult = {
        filePath: 'test.ts',
        issues,
        hasErrors: false,
        hasWarnings: true,
        fixable: true,
      }

      const decision = autopilot.decide(checkResult)
      // Unknown rules should be treated conservatively (not auto-fixed)
      expect(decision.action).toBe('REPORT_ONLY')
      expect(decision.issues?.length).toBe(3)
      expect(decision.fixes).toBeUndefined()
    })

    test('should_handle_file_boundary_cases', () => {
      const boundaries = [
        '.test.ts',
        '.spec.js',
        '__tests__/file.ts',
        'src/debug.ts',
        'development.js',
        'dev-server.ts',
      ]

      boundaries.forEach((filePath) => {
        const issues: Issue[] = [
          {
            engine: 'eslint',
            severity: 'warning',
            ruleId: 'no-console',
            file: filePath,
            line: 1,
            col: 1,
            message: 'Console in boundary file',
          },
        ]

        const checkResult: CheckResult = {
          filePath,
          issues,
          hasErrors: false,
          hasWarnings: true,
          fixable: true,
        }

        const decision = autopilot.decide(checkResult)

        // Test and dev files should not auto-fix console
        if (
          filePath.includes('test') ||
          filePath.includes('spec') ||
          filePath.includes('dev') ||
          filePath.includes('debug')
        ) {
          expect(decision.action).toBe('REPORT_ONLY')
        } else {
          expect(decision.action).toBe('FIX_SILENTLY')
        }
      })
    })
  })
})
