/**
 * Autopilot Adapter Tests - Comprehensive test suite for smart classification
 */

import { describe, expect, test, beforeEach } from 'vitest'

import { Autopilot } from '../src/adapters/autopilot.js'
import type { CheckResult } from '../src/types.js'

describe('Autopilot Core Implementation', () => {
  let autopilot: Autopilot

  beforeEach(() => {
    autopilot = new Autopilot()
  })

  describe('Rule Classification', () => {
    test('should have 54 ALWAYS_SAFE rules', () => {
      const alwaysSafeRules = autopilot.getAlwaysSafeRules()
      expect(alwaysSafeRules.size).toBe(54)
      
      // Verify it's a Set for O(1) lookup performance
      expect(alwaysSafeRules).toBeInstanceOf(Set)
    })

    test('should include formatting rules in ALWAYS_SAFE', () => {
      const alwaysSafeRules = autopilot.getAlwaysSafeRules()
      
      // Formatting rules
      expect(alwaysSafeRules.has('prettier/prettier')).toBe(true)
      expect(alwaysSafeRules.has('semi')).toBe(true)
      expect(alwaysSafeRules.has('quotes')).toBe(true)
      expect(alwaysSafeRules.has('indent')).toBe(true)
      expect(alwaysSafeRules.has('comma-dangle')).toBe(true)
    })

    test('should include import organization rules in ALWAYS_SAFE', () => {
      const alwaysSafeRules = autopilot.getAlwaysSafeRules()
      
      expect(alwaysSafeRules.has('import/order')).toBe(true)
      expect(alwaysSafeRules.has('import/newline-after-import')).toBe(true)
      expect(alwaysSafeRules.has('import/no-duplicates')).toBe(true)
    })

    test('should have 5 CONTEXT_DEPENDENT rules', () => {
      const contextRules = autopilot.getContextDependentRules()
      expect(contextRules.size).toBe(5)
      expect(contextRules).toBeInstanceOf(Set)
    })

    test('should include context rules in CONTEXT_DEPENDENT', () => {
      const contextRules = autopilot.getContextDependentRules()
      
      expect(contextRules.has('no-console')).toBe(true)
      expect(contextRules.has('no-debugger')).toBe(true)
      expect(contextRules.has('no-alert')).toBe(true)
      expect(contextRules.has('@typescript-eslint/no-explicit-any')).toBe(true)
      expect(contextRules.has('no-var')).toBe(true)
    })

    test('should have 11+ NEVER_AUTO rules', () => {
      const neverAutoRules = autopilot.getNeverAutoRules()
      expect(neverAutoRules.size).toBeGreaterThanOrEqual(11)
      expect(neverAutoRules).toBeInstanceOf(Set)
    })

    test('should include security rules in NEVER_AUTO', () => {
      const neverAutoRules = autopilot.getNeverAutoRules()
      
      expect(neverAutoRules.has('no-undef')).toBe(true)
      expect(neverAutoRules.has('@typescript-eslint/no-unused-vars')).toBe(true)
      expect(neverAutoRules.has('no-unreachable')).toBe(true)
      expect(neverAutoRules.has('@typescript-eslint/ban-types')).toBe(true)
    })

    test('should classify known safe rules correctly', () => {
      const classification = autopilot.classifyRule('prettier/prettier')
      expect(classification).toEqual({
        ruleId: 'prettier/prettier',
        category: 'ALWAYS_SAFE',
        confidence: 1.0,
        autoFixable: true
      })
    })

    test('should classify context-dependent rules correctly', () => {
      const classification = autopilot.classifyRule('no-console')
      expect(classification).toEqual({
        ruleId: 'no-console',
        category: 'CONTEXT_DEPENDENT',
        confidence: 0.8,
        autoFixable: false // Requires context analysis
      })
    })

    test('should classify never-auto rules correctly', () => {
      const classification = autopilot.classifyRule('no-undef')
      expect(classification).toEqual({
        ruleId: 'no-undef',
        category: 'NEVER_AUTO',
        confidence: 1.0,
        autoFixable: false
      })
    })

    test('should default unknown rules to NEVER_AUTO', () => {
      const classification = autopilot.classifyRule('unknown-custom-rule')
      expect(classification).toEqual({
        ruleId: 'unknown-custom-rule',
        category: 'NEVER_AUTO',
        confidence: 0.5, // Lower confidence for unknown rules
        autoFixable: false
      })
    })
  })

  describe('Context Analysis', () => {
    test('should detect test files correctly', () => {
      expect(autopilot.isTestFile('src/component.test.ts')).toBe(true)
      expect(autopilot.isTestFile('src/component.spec.js')).toBe(true)
      expect(autopilot.isTestFile('__tests__/component.ts')).toBe(true)
      expect(autopilot.isTestFile('tests/integration/api.test.ts')).toBe(true)
    })

    test('should detect dev files correctly', () => {
      expect(autopilot.isDevFile('config.dev.js')).toBe(true)
      expect(autopilot.isDevFile('src/debug/helper.ts')).toBe(true)
      expect(autopilot.isDevFile('development.config.ts')).toBe(true)
      expect(autopilot.isDevFile('src/handler.ts')).toBe(false) // production
    })

    test('should detect UI files correctly', () => {
      expect(autopilot.isUIFile('src/Component.tsx')).toBe(true)
      expect(autopilot.isUIFile('components/Button.jsx')).toBe(true)
      expect(autopilot.isUIFile('src/api/handler.ts')).toBe(false) // not UI
    })

    test('should handle context-dependent rules based on file type', () => {
      // no-console should NOT be auto-fixed in test files
      const testContext = autopilot.checkContextPublic('no-console', 'src/component.test.ts')
      expect(testContext.shouldAutoFix).toBe(false)
      expect(testContext.reason).toContain('test')

      // no-console SHOULD be auto-fixed in production files
      const prodContext = autopilot.checkContextPublic('no-console', 'src/handler.ts')
      expect(prodContext.shouldAutoFix).toBe(true)

      // no-debugger should ALWAYS be auto-fixed
      const debuggerContext = autopilot.checkContextPublic('no-debugger', 'src/component.test.ts')
      expect(debuggerContext.shouldAutoFix).toBe(true)
    })
  })

  describe('Decision Engine', () => {
    test('should return CONTINUE for no issues', () => {
      const successResult: CheckResult = {
        filePath: 'src/clean.ts',
        issues: [],
        hasErrors: false,
        hasWarnings: false,
        fixable: false
      }

      const decision = autopilot.decide(successResult)
      expect(decision.action).toBe('CONTINUE')
      expect(decision.confidence).toBe(1.0)
    })

    test('should return FIX_SILENTLY for all safe issues', () => {
      const safeIssuesResult: CheckResult = {
        filePath: 'src/utils.ts',
        issues: [
          { rule: 'prettier/prettier', fixable: true, message: 'Format issue', file: 'src/utils.ts' },
          { rule: 'semi', fixable: true, message: 'Missing semicolon', file: 'src/utils.ts' },
          { rule: 'quotes', fixable: true, message: 'Quote style', file: 'src/utils.ts' }
        ],
        hasErrors: false,
        hasWarnings: true,
        fixable: true
      }

      const decision = autopilot.decide(safeIssuesResult)
      expect(decision.action).toBe('FIX_SILENTLY')
      expect(decision.confidence).toBe(1.0)
      expect(decision.fixes).toHaveLength(3)
    })

    test('should return FIX_AND_REPORT for mixed safe and context-dependent issues', () => {
      const mixedResult: CheckResult = {
        filePath: 'src/handler.ts',
        issues: [
          { rule: 'prettier/prettier', fixable: true, message: 'Format issue', file: 'src/handler.ts' },
          { rule: 'no-console', fixable: true, message: 'Console statement', file: 'src/handler.ts' }
        ],
        hasErrors: false,
        hasWarnings: true,
        fixable: true
      }

      const decision = autopilot.decide(mixedResult)
      expect(decision.action).toBe('FIX_SILENTLY') // Both are safe to auto-fix in production files
      expect(decision.fixes).toHaveLength(2)
    })

    test('should return REPORT_ONLY for unfixable issues', () => {
      const unsafeResult: CheckResult = {
        filePath: 'src/broken.ts',
        issues: [
          { rule: 'no-undef', fixable: false, message: 'Undefined variable', file: 'src/broken.ts' },
          { rule: '@typescript-eslint/no-unused-vars', fixable: false, message: 'Unused variable', file: 'src/broken.ts' }
        ],
        hasErrors: true,
        hasWarnings: false,
        fixable: false
      }

      const decision = autopilot.decide(unsafeResult)
      expect(decision.action).toBe('REPORT_ONLY')
      expect(decision.confidence).toBe(1.0)
      expect(decision.issues).toHaveLength(2)
    })

    test('should handle empty issues array', () => {
      const emptyResult: CheckResult = {
        filePath: 'src/empty.ts',
        issues: [],
        hasErrors: false,
        hasWarnings: false,
        fixable: false
      }

      const decision = autopilot.decide(emptyResult)
      expect(decision.action).toBe('CONTINUE')
      expect(decision.confidence).toBe(1.0)
    })

    test('should handle mixed fixable and unfixable issues', () => {
      const mixedResult: CheckResult = {
        filePath: 'src/mixed.ts',
        issues: [
          { rule: 'prettier/prettier', fixable: true, message: 'Format issue', file: 'src/mixed.ts' },
          { rule: 'no-undef', fixable: false, message: 'Undefined variable', file: 'src/mixed.ts' },
          { rule: 'semi', fixable: true, message: 'Missing semicolon', file: 'src/mixed.ts' }
        ],
        hasErrors: true,
        hasWarnings: true,
        fixable: true
      }

      const decision = autopilot.decide(mixedResult)
      expect(decision.action).toBe('FIX_AND_REPORT')
      expect(decision.fixes).toHaveLength(2)
      expect(decision.issues).toHaveLength(1)
    })
  })

  describe('Performance Requirements', () => {
    test('should classify single issue in <10ms', () => {
      const start = performance.now()
      autopilot.classify('prettier/prettier')
      const end = performance.now()

      expect(end - start).toBeLessThan(10)
    })

    test('should decide on 10 issues in <10ms', () => {
      const issuesResult: CheckResult = {
        filePath: 'src/many-issues.ts',
        issues: Array(10).fill(0).map((_, i) => ({
          rule: 'prettier/prettier',
          fixable: true,
          message: `Issue ${i}`,
          file: 'src/many-issues.ts'
        })),
        hasErrors: false,
        hasWarnings: true,
        fixable: true
      }

      const start = performance.now()
      const decision = autopilot.decide(issuesResult)
      const end = performance.now()

      expect(end - start).toBeLessThan(10)
      expect(decision.action).toBe('FIX_SILENTLY')
    })

    test('should use Set.has() for O(1) rule lookup performance', () => {
      // Verify Set usage for performance
      const alwaysSafeRules = autopilot.getAlwaysSafeRules()
      const contextRules = autopilot.getContextDependentRules()
      const neverAutoRules = autopilot.getNeverAutoRules()

      expect(alwaysSafeRules.has).toBeDefined()
      expect(contextRules.has).toBeDefined()
      expect(neverAutoRules.has).toBeDefined()

      // Performance test with large rule sets
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        alwaysSafeRules.has('prettier/prettier')
      }
      const end = performance.now()

      expect(end - start).toBeLessThan(5) // Should be very fast
    })
  })

  describe('Error Handling', () => {
    test('should handle malformed CheckResult gracefully', () => {
      const malformedResult = {} as CheckResult

      expect(() => autopilot.decide(malformedResult)).not.toThrow()
      const decision = autopilot.decide(malformedResult)
      expect(decision.action).toBe('CONTINUE')
      expect(decision.confidence).toBeLessThan(1.0) // Reduced confidence
    })

    test('should handle null/undefined file paths in context analysis', () => {
      expect(() => autopilot.isTestFile('')).not.toThrow()
      expect(() => autopilot.isDevFile(null as any)).not.toThrow()
      expect(() => autopilot.isUIFile(undefined as any)).not.toThrow()

      expect(autopilot.isTestFile('')).toBe(false)
      expect(autopilot.isDevFile(null as any)).toBe(false)
      expect(autopilot.isUIFile(undefined as any)).toBe(false)
    })

    test('should handle issues without ruleId', () => {
      const malformedIssue: CheckResult = {
        filePath: 'src/test.ts',
        issues: [
          { rule: undefined as any, fixable: true, message: 'No rule ID', file: 'src/test.ts' }
        ],
        hasErrors: false,
        hasWarnings: true,
        fixable: true
      }

      const decision = autopilot.decide(malformedIssue)
      expect(decision.action).toBe('REPORT_ONLY') // Conservative approach
      expect(decision.issues).toHaveLength(1)
    })

    test('should never crash on any input', () => {
      const testCases = [
        null,
        undefined,
        {},
        { success: 'not-boolean' },
        { success: true, issues: 'not-array' },
        { success: false, issues: [null, undefined, {}] }
      ]

      testCases.forEach((testCase) => {
        expect(() => autopilot.decide(testCase as any)).not.toThrow()
      })
    })
  })
})