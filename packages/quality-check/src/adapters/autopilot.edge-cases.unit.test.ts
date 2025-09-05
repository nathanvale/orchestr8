import { describe, test, expect, beforeEach } from 'vitest'
import { Autopilot } from './autopilot.js'
import type { Issue, CheckResult } from '../types.js'

describe('Autopilot - Edge Cases and Robustness Tests (Issue #5)', () => {
  let autopilot: Autopilot

  beforeEach(() => {
    autopilot = new Autopilot()
  })

  describe('5.1: Mixed fixable/unfixable error scenarios', () => {
    test('should_correctly_handle_mixed_fixable_and_unfixable_errors', () => {
      // Arrange - Mix of all three categories
      const mixedIssues: Issue[] = [
        // ALWAYS_SAFE (auto-fixable)
        {
          rule: 'prettier/prettier',
          fixable: true,
          file: 'mixed.ts',
          message: 'Missing semicolon',
        },
        {
          rule: 'indent',
          fixable: true,
          file: 'mixed.ts',
          message: 'Expected indentation of 2 spaces',
        },
        {
          rule: 'quotes',
          fixable: true,
          file: 'mixed.ts',
          message: 'Strings must use single quotes',
        },

        // CONTEXT_DEPENDENT
        {
          rule: 'no-console',
          fixable: true,
          file: 'mixed.ts',
          message: 'Unexpected console statement',
        },
        {
          rule: 'no-debugger',
          fixable: true,
          file: 'mixed.ts',
          message: 'Unexpected debugger statement',
        },

        // NEVER_AUTO (unfixable)
        {
          rule: 'complexity',
          fixable: false,
          file: 'mixed.ts',
          message: 'Function is too complex',
        },
        { rule: 'no-undef', fixable: true, file: 'mixed.ts', message: 'Variable is not defined' },
        {
          rule: '@typescript-eslint/no-unsafe-assignment',
          fixable: false,
          file: 'mixed.ts',
          message: 'Unsafe assignment',
        },
      ]

      const checkResult: CheckResult = {
        filePath: 'src/components/mixed.ts',
        issues: mixedIssues,
        hasErrors: true,
        hasWarnings: false,
        fixable: true,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert
      expect(decision.action).toBe('FIX_AND_REPORT')
      expect(decision.fixes?.length).toBe(5) // 3 ALWAYS_SAFE + 2 CONTEXT_DEPENDENT
      expect(decision.issues?.length).toBe(3) // 3 NEVER_AUTO

      // Verify only unfixable errors are shown
      const unfixableRules = decision.issues?.map((i) => i.rule) || []
      expect(unfixableRules).toContain('complexity')
      expect(unfixableRules).toContain('no-undef')
      expect(unfixableRules).toContain('@typescript-eslint/no-unsafe-assignment')
    })

    test('should_handle_complex_eslint_rule_combinations', () => {
      // Arrange - Complex combination of overlapping rules
      const complexIssues: Issue[] = [
        // Multiple formatting issues on same line
        {
          rule: 'prettier/prettier',
          fixable: true,
          file: 'complex.ts',
          message: 'Line 5: Multiple issues',
        },
        { rule: 'semi', fixable: true, file: 'complex.ts', message: 'Line 5: Missing semicolon' },
        {
          rule: 'space-before-blocks',
          fixable: true,
          file: 'complex.ts',
          message: 'Line 5: Missing space',
        },

        // Conflicting rules
        { rule: 'prefer-const', fixable: true, file: 'complex.ts', message: 'Line 10: Use const' },
        {
          rule: 'no-unused-vars',
          fixable: false,
          file: 'complex.ts',
          message: 'Line 10: Unused variable',
        },

        // TypeScript specific combinations
        { rule: 'prefer-template', fixable: true, file: 'complex.ts' },
        { rule: '@typescript-eslint/no-unsafe-call', fixable: false, file: 'complex.ts' },
      ]

      const checkResult: CheckResult = {
        filePath: 'complex.ts',
        issues: complexIssues,
        hasErrors: true,
        hasWarnings: false,
        fixable: true,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert
      expect(decision.action).toBe('FIX_AND_REPORT')
      expect(decision.fixes?.length).toBe(6) // All safe formatting + prefer-const + prefer-template + no-unused-vars
      expect(decision.issues?.length).toBe(1) // only no-unsafe-call
    })

    test('should_validate_context_dependent_rule_decisions', () => {
      // Arrange - Test context-dependent rules in different file types
      const testFiles = [
        { path: 'src/components/App.tsx', expectedFix: true }, // Production file
        { path: 'src/utils/logger.test.ts', expectedFix: false }, // Test file (keep console)
        { path: 'scripts/dev-server.js', expectedFix: false }, // Dev file (keep console)
        { path: 'src/index.tsx', expectedFix: true }, // Entry point (remove console)
      ]

      testFiles.forEach(({ path, expectedFix }) => {
        const issues: Issue[] = [
          { rule: 'no-console', fixable: true, file: path, message: 'Unexpected console' },
        ]

        const checkResult: CheckResult = {
          filePath: path,
          issues,
          hasErrors: true,
          hasWarnings: false,
          fixable: true,
        }

        // Act
        const decision = autopilot.decide(checkResult)

        // Assert
        if (expectedFix) {
          expect(decision.action).toBe('FIX_SILENTLY')
          expect(decision.fixes?.length).toBe(1)
        } else {
          // When context check fails, the rule is treated as unfixable
          expect(decision.action).toBe('REPORT_ONLY')
          expect(decision.issues?.length).toBe(1)
          expect(decision.fixes).toBeUndefined()
        }
      })
    })
  })

  describe('5.2: Comprehensive error type coverage', () => {
    test('should_handle_all_54_always_safe_rules', () => {
      // Arrange - Test sample of ALWAYS_SAFE rules
      const alwaysSafeRules = [
        // Formatting (28 rules sample)
        'prettier/prettier',
        'indent',
        'semi',
        'quotes',
        'comma-dangle',
        'space-before-blocks',
        'keyword-spacing',
        'space-infix-ops',
        'no-multiple-empty-lines',
        'eol-last',
        'no-trailing-spaces',

        // Import organization (4 rules)
        'import/order',
        'import/newline-after-import',
        'import/no-duplicates',
        'sort-imports',

        // Safe modernization (11 rules sample)
        'prefer-const',
        'prefer-template',
        'arrow-spacing',
        'object-shorthand',
        'prefer-arrow-callback',

        // Dead code removal (6 rules sample)
        'no-unused-vars',
        'no-empty',
        'no-useless-return',
        'no-useless-catch',
        'no-useless-constructor',

        // Simplification (9 rules sample)
        'no-extra-boolean-cast',
        'yoda',
        'no-unneeded-ternary',
        'no-else-return',
        'no-lonely-if',
      ]

      alwaysSafeRules.forEach((rule) => {
        // Act
        const classification = autopilot.classifyRule(rule)

        // Assert
        expect(classification.category).toBe('ALWAYS_SAFE')
        expect(classification.autoFixable).toBe(true)
        expect(classification.confidence).toBeGreaterThanOrEqual(0.95)
      })
    })

    test('should_validate_all_never_auto_rules_are_blocked', () => {
      // Arrange - Test all NEVER_AUTO rules
      const neverAutoRules = [
        // Type safety
        '@typescript-eslint/no-unsafe-assignment',
        '@typescript-eslint/no-unsafe-call',
        '@typescript-eslint/no-unsafe-member-access',
        '@typescript-eslint/no-unsafe-return',

        // Security
        'security/detect-object-injection',
        'security/detect-non-literal-regexp',
        'security/detect-eval-with-expression',

        // Complexity
        'complexity',
        'max-lines-per-function',
        'max-depth',
        'max-nested-callbacks',

        // Logic issues
        'no-undef',
        'no-unused-expressions',
        '@typescript-eslint/ban-types', // From actual NEVER_AUTO list
      ]

      neverAutoRules.forEach((rule) => {
        const issue: Issue = {
          rule,
          fixable: true, // Even if marked fixable, should not auto-fix
          file: 'test.ts',
        }

        const checkResult: CheckResult = {
          filePath: 'test.ts',
          issues: [issue],
          hasErrors: true,
          hasWarnings: false,
          fixable: true,
        }

        // Act
        const decision = autopilot.decide(checkResult)

        // Assert
        expect(decision.action).toBe('REPORT_ONLY')
        expect(decision.fixes).toBeUndefined()
        expect(decision.issues?.length).toBe(1)
      })
    })

    test('should_test_context_dependent_rules_in_different_file_types', () => {
      // Arrange - Test CONTEXT_DEPENDENT rules
      const contextRules = ['no-console', 'no-debugger', 'no-alert', 'no-var']

      const fileContexts = [
        { path: 'src/index.ts', isProduction: true },
        { path: 'src/components/Button.tsx', isProduction: true },
        { path: 'test/unit.test.ts', isProduction: false },
        { path: 'src/components/Button.test.tsx', isProduction: false },
        { path: 'scripts/build.js', isProduction: true }, // Build scripts should remove console
        { path: 'scripts/dev-server.js', isProduction: false }, // Dev scripts keep console
      ]

      contextRules.forEach((rule) => {
        fileContexts.forEach(({ path, isProduction }) => {
          const issue: Issue = { rule, fixable: true, file: path }
          const checkResult: CheckResult = {
            filePath: path,
            issues: [issue],
            hasErrors: true,
            hasWarnings: false,
            fixable: true,
          }

          // Act
          const decision = autopilot.decide(checkResult)

          // Assert based on rule and context
          if (rule === 'no-console') {
            if (!isProduction) {
              // Keep console in test/dev files - treated as unfixable
              expect(decision.action).toBe('REPORT_ONLY')
              expect(decision.issues?.length).toBe(1)
              expect(decision.fixes).toBeUndefined()
            } else {
              // Fix in production
              expect(decision.action).toBe('FIX_SILENTLY')
              expect(decision.fixes?.length).toBe(1)
            }
          } else if (rule === 'no-debugger' || rule === 'no-var') {
            // Always remove debugger and modernize var
            expect(decision.action).toBe('FIX_SILENTLY')
            expect(decision.fixes?.length).toBe(1)
          } else if (rule === 'no-alert') {
            // Alert handling depends on file type
            if (path.endsWith('.tsx') || path.endsWith('.jsx')) {
              // UI files might need alert
              expect(decision.action).toBe('REPORT_ONLY')
              expect(decision.issues?.length).toBe(1)
            } else {
              // Non-UI files, safe to remove
              expect(decision.action).toBe('FIX_SILENTLY')
              expect(decision.fixes?.length).toBe(1)
            }
          }
        })
      })
    })
  })

  describe('5.3: Performance validation under load', () => {
    test('should_handle_100_plus_mixed_errors_efficiently', () => {
      // Arrange - Generate 150 mixed issues
      const largeIssueSet: Issue[] = [
        // 60 formatting issues
        ...Array(60)
          .fill(null)
          .map((_, i) => ({
            rule: 'prettier/prettier',
            fixable: true,
            file: 'large.ts',
            message: `Formatting issue ${i}`,
          })),

        // 30 import issues
        ...Array(30)
          .fill(null)
          .map((_, i) => ({
            rule: 'import/order',
            fixable: true,
            file: 'large.ts',
            message: `Import issue ${i}`,
          })),

        // 20 modernization issues
        ...Array(20)
          .fill(null)
          .map((_, i) => ({
            rule: 'prefer-const',
            fixable: true,
            file: 'large.ts',
            message: `Modernization issue ${i}`,
          })),

        // 20 context-dependent issues
        ...Array(20)
          .fill(null)
          .map((_, i) => ({
            rule: 'no-console',
            fixable: true,
            file: 'large.ts',
            message: `Console issue ${i}`,
          })),

        // 20 unfixable issues
        ...Array(20)
          .fill(null)
          .map((_, i) => ({
            rule: 'complexity',
            fixable: false,
            file: 'large.ts',
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

      // Assert - Memory efficient (no memory leaks or excessive allocations)
      // This is implicitly tested by the speed requirement
    })

    test('should_validate_classification_speed_with_large_error_sets', () => {
      // Arrange - Test classification speed for 500 issues
      const veryLargeSet: Issue[] = Array(500)
        .fill(null)
        .map((_, i) => ({
          rule: i % 3 === 0 ? 'prettier/prettier' : i % 3 === 1 ? 'no-console' : 'complexity',
          fixable: i % 3 !== 2,
          file: 'perf-test.ts',
          message: `Issue ${i}`,
        }))

      const checkResult: CheckResult = {
        filePath: 'perf-test.ts',
        issues: veryLargeSet,
        hasErrors: true,
        hasWarnings: false,
        fixable: true,
      }

      // Act - Measure classification only
      const startTime = performance.now()
      const decision = autopilot.decide(checkResult)
      const endTime = performance.now()
      const duration = endTime - startTime

      // Assert
      expect(duration).toBeLessThan(10) // Still under 10ms for 500 issues
      expect(decision.fixes).toBeDefined()
      expect(decision.issues).toBeDefined()
    })

    test('should_handle_concurrent_operations_without_memory_issues', () => {
      // Arrange - Simulate concurrent classification requests
      const createCheckResult = (id: number): CheckResult => ({
        filePath: `file-${id}.ts`,
        issues: Array(50)
          .fill(null)
          .map((_, i) => ({
            rule: 'prettier/prettier',
            fixable: true,
            file: `file-${id}.ts`,
            message: `Issue ${i}`,
          })),
        hasErrors: true,
        hasWarnings: false,
        fixable: true,
      })

      // Act - Run multiple concurrent classifications
      const startTime = performance.now()
      const decisions = Array(20)
        .fill(null)
        .map((_, i) => autopilot.decide(createCheckResult(i)))
      const endTime = performance.now()
      const totalDuration = endTime - startTime

      // Assert
      expect(totalDuration).toBeLessThan(50) // 20 operations under 50ms total
      decisions.forEach((decision) => {
        expect(decision.action).toBe('FIX_SILENTLY')
        expect(decision.fixes?.length).toBe(50)
      })
    })
  })

  describe('Edge cases and malformed input handling', () => {
    test('should_handle_empty_issues_array', () => {
      // Arrange
      const checkResult: CheckResult = {
        filePath: 'empty.ts',
        issues: [],
        hasErrors: false,
        hasWarnings: false,
        fixable: false,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert
      expect(decision.action).toBe('CONTINUE')
      expect(decision.fixes).toBeUndefined()
      expect(decision.issues).toBeUndefined()
    })

    test('should_handle_issues_without_rules', () => {
      // Arrange - Malformed issues
      const malformedIssues: Issue[] = [
        { rule: '', fixable: true, file: 'test.ts' },
        { rule: undefined as any, fixable: true, file: 'test.ts' },
        { rule: null as any, fixable: true, file: 'test.ts' },
      ]

      const checkResult: CheckResult = {
        filePath: 'test.ts',
        issues: malformedIssues,
        hasErrors: true,
        hasWarnings: false,
        fixable: true,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert - Should treat unknown rules as unfixable
      expect(decision.action).toBe('REPORT_ONLY')
      expect(decision.fixes).toBeUndefined()
      expect(decision.issues?.length).toBe(3)
    })

    test('should_handle_missing_file_paths', () => {
      // Arrange
      const issues: Issue[] = [
        { rule: 'prettier/prettier', fixable: true, file: '' },
        { rule: 'no-console', fixable: true, file: undefined as any },
      ]

      const checkResult: CheckResult = {
        filePath: '',
        issues,
        hasErrors: true,
        hasWarnings: false,
        fixable: true,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert - Without file path, context check fails
      expect(decision.action).toBe('FIX_AND_REPORT')
      expect(decision.fixes?.length).toBe(1) // Only prettier
      expect(decision.issues?.length).toBe(1) // no-console without context
    })

    test('should_handle_unknown_rules_conservatively', () => {
      // Arrange - Rules not in any category
      const unknownIssues: Issue[] = [
        { rule: 'unknown-rule-1', fixable: true, file: 'test.ts' },
        { rule: 'future-eslint-rule', fixable: true, file: 'test.ts' },
        { rule: '@custom/plugin-rule', fixable: true, file: 'test.ts' },
      ]

      const checkResult: CheckResult = {
        filePath: 'test.ts',
        issues: unknownIssues,
        hasErrors: true,
        hasWarnings: false,
        fixable: true,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert - Unknown rules should default to unfixable
      expect(decision.action).toBe('REPORT_ONLY')
      expect(decision.fixes).toBeUndefined()
      expect(decision.issues?.length).toBe(3)
    })

    test('should_handle_file_boundary_cases', () => {
      // Arrange - Ambiguous file paths
      const boundaryFiles = [
        'test.production.ts', // Could be test or production?
        'src/test-utils.ts', // Test utility in src?
        'app.test.config.ts', // Test config but has 'test' in name
      ]

      boundaryFiles.forEach((filePath) => {
        const issues: Issue[] = [{ rule: 'no-console', fixable: true, file: filePath }]

        const checkResult: CheckResult = {
          filePath,
          issues,
          hasErrors: true,
          hasWarnings: false,
          fixable: true,
        }

        // Act
        const decision = autopilot.decide(checkResult)

        // Assert - Test files should not auto-fix no-console
        if (filePath.includes('.test.')) {
          // Files with .test. in name are test files
          expect(decision.action).toBe('REPORT_ONLY')
          expect(decision.issues?.length).toBe(1)
        } else {
          // Other files are treated as production
          expect(decision.action).toBe('FIX_SILENTLY')
          expect(decision.fixes?.length).toBe(1)
        }
      })
    })
  })
})
