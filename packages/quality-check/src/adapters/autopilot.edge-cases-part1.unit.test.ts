import { describe, test, expect, beforeEach } from 'vitest'
import { Autopilot } from './autopilot.js'
import type { Issue, CheckResult } from '../types.js'

describe('Autopilot - Edge Cases Part 1: Mixed Scenarios & Coverage', () => {
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
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'prettier/prettier',
          file: 'mixed.ts',
          line: 1,
          col: 1,
          message: 'Missing semicolon',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'indent',
          file: 'mixed.ts',
          line: 2,
          col: 1,
          message: 'Expected indentation of 2 spaces',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'quotes',
          file: 'mixed.ts',
          line: 3,
          col: 1,
          message: 'Strings must use single quotes',
        },

        // CONTEXT_DEPENDENT
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'no-console',
          file: 'mixed.ts',
          line: 4,
          col: 1,
          message: 'Unexpected console statement',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'no-debugger',
          file: 'mixed.ts',
          line: 5,
          col: 1,
          message: 'Unexpected debugger statement',
        },

        // NEVER_AUTO (unfixable)
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: 'complexity',
          file: 'mixed.ts',
          line: 6,
          col: 1,
          message: 'Function is too complex',
        },
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: 'no-undef',
          file: 'mixed.ts',
          line: 7,
          col: 1,
          message: 'Variable is not defined',
        },
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: '@typescript-eslint/no-unsafe-assignment',
          file: 'mixed.ts',
          line: 8,
          col: 1,
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
      const unfixableRules = decision.issues?.map((i) => i.ruleId) || []
      expect(unfixableRules).toContain('complexity')
      expect(unfixableRules).toContain('no-undef')
      expect(unfixableRules).toContain('@typescript-eslint/no-unsafe-assignment')
    })

    test('should_handle_complex_eslint_rule_combinations', () => {
      // Arrange - Complex combination of overlapping rules
      const complexIssues: Issue[] = [
        // Multiple formatting issues on same line
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'prettier/prettier',
          file: 'complex.ts',
          line: 5,
          col: 1,
          message: 'Line 5: Multiple issues',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'semi',
          file: 'complex.ts',
          line: 5,
          col: 10,
          message: 'Line 5: Missing semicolon',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'space-before-blocks',
          file: 'complex.ts',
          line: 5,
          col: 20,
          message: 'Line 5: Missing space',
        },

        // Conflicting rules
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'prefer-const',
          file: 'complex.ts',
          line: 10,
          col: 1,
          message: 'Line 10: Use const',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'no-unused-vars',
          file: 'complex.ts',
          line: 10,
          col: 7,
          message: 'Line 10: Unused variable',
        },

        // TypeScript specific combinations
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'prefer-template',
          file: 'complex.ts',
          line: 15,
          col: 1,
          message: 'Use template literals',
        },
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: '@typescript-eslint/no-unsafe-call',
          file: 'complex.ts',
          line: 20,
          col: 1,
          message: 'Unsafe call',
        },
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
      expect(decision.fixes?.length).toBe(6) // prettier/prettier + semi + space-before-blocks + prefer-const + no-unused-vars + prefer-template
      expect(decision.issues?.length).toBe(1) // @typescript-eslint/no-unsafe-call
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
          {
            engine: 'eslint',
            severity: 'warning',
            ruleId: 'no-console',
            file: path,
            line: 1,
            col: 1,
            message: 'Unexpected console',
          },
        ]

        const checkResult: CheckResult = {
          filePath: path,
          issues,
          hasErrors: false,
          hasWarnings: true,
          fixable: true,
        }

        // Act
        const decision = autopilot.decide(checkResult)

        // Assert based on expected context decision
        if (expectedFix) {
          expect(decision.action).toBe('FIX_SILENTLY')
          expect(decision.fixes?.length).toBe(1)
        } else {
          expect(decision.action).toBe('REPORT_ONLY')
          expect(decision.issues?.length).toBe(1)
        }
      })
    })
  })

  describe('5.2: Comprehensive error type coverage', () => {
    test('should_handle_all_54_always_safe_rules', () => {
      // Test a representative sample of ALWAYS_SAFE rules
      const alwaysSafeRules = [
        'prettier/prettier',
        'indent',
        'semi',
        'quotes',
        'comma-dangle',
        'import/order',
        'prefer-const',
        'prefer-template',
        'no-unused-vars',
        'no-extra-semi',
      ]

      const issues: Issue[] = alwaysSafeRules.map((ruleId, i) => ({
        engine: 'eslint' as const,
        severity: 'warning' as const,
        ruleId,
        file: 'test.ts',
        line: i + 1,
        col: 1,
        message: `Issue from ${ruleId}`,
      }))

      const checkResult: CheckResult = {
        filePath: 'test.ts',
        issues,
        hasErrors: false,
        hasWarnings: true,
        fixable: true,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert
      expect(decision.action).toBe('FIX_SILENTLY')
      expect(decision.fixes?.length).toBe(issues.length)
      expect(decision.issues).toBeUndefined()
    })

    test('should_validate_all_never_auto_rules_are_blocked', () => {
      // Test NEVER_AUTO rules
      const neverAutoRules = [
        'no-undef',
        'complexity',
        'max-lines-per-function',
        '@typescript-eslint/no-unsafe-assignment',
        'security/detect-object-injection',
      ]

      const issues: Issue[] = neverAutoRules.map((ruleId, i) => ({
        engine: 'eslint' as const,
        severity: 'error' as const,
        ruleId,
        file: 'test.ts',
        line: i + 1,
        col: 1,
        message: `Issue from ${ruleId}`,
      }))

      const checkResult: CheckResult = {
        filePath: 'test.ts',
        issues,
        hasErrors: true,
        hasWarnings: false,
        fixable: false,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert
      expect(decision.action).toBe('REPORT_ONLY')
      expect(decision.issues?.length).toBe(issues.length)
      expect(decision.fixes).toBeUndefined()
    })

    test('should_test_context_dependent_rules_in_different_file_types', () => {
      // Context-dependent rules in test file
      const testFileIssue: Issue = {
        engine: 'eslint',
        severity: 'warning',
        ruleId: 'no-console',
        file: 'src/utils/logger.test.ts',
        line: 10,
        col: 5,
        message: 'Unexpected console',
      }

      const testFileResult: CheckResult = {
        filePath: 'src/utils/logger.test.ts',
        issues: [testFileIssue],
        hasErrors: false,
        hasWarnings: true,
        fixable: true,
      }

      // Act - Test file should NOT auto-fix console
      const testDecision = autopilot.decide(testFileResult)

      // Assert
      expect(testDecision.action).toBe('REPORT_ONLY')
      expect(testDecision.issues?.length).toBe(1)

      // Production file
      const prodFileIssue: Issue = {
        engine: 'eslint',
        severity: 'warning',
        ruleId: 'no-console',
        file: 'src/components/Button.tsx',
        line: 15,
        col: 3,
        message: 'Unexpected console',
      }

      const prodFileResult: CheckResult = {
        filePath: 'src/components/Button.tsx',
        issues: [prodFileIssue],
        hasErrors: false,
        hasWarnings: true,
        fixable: true,
      }

      // Act - Production file SHOULD auto-fix console
      const prodDecision = autopilot.decide(prodFileResult)

      // Assert
      expect(prodDecision.action).toBe('FIX_SILENTLY')
      expect(prodDecision.fixes?.length).toBe(1)
    })
  })
})
