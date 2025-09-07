import { describe, test, expect, beforeEach } from 'vitest'
import { Autopilot } from './autopilot.js'
import type { CheckResult } from '../types.js'
import type { Issue } from '../types/issue-types.js'

describe('Autopilot - Enhanced Classification with Rich Error Data', () => {
  let autopilot: Autopilot

  beforeEach(() => {
    autopilot = new Autopilot()
  })

  describe('Enhanced Issue Structure Support', () => {
    test('should_handle_new_issue_structure_with_engine_and_severity', () => {
      // Arrange
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2307',
          file: '/src/index.ts',
          line: 10,
          col: 5,
          message: "Cannot find module 'missing-module'",
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'no-console',
          file: '/src/debug.ts',
          line: 20,
          col: 3,
          message: 'Unexpected console statement',
        },
      ]

      const checkResult: CheckResult = {
        filePath: '/src/index.ts',
        issues,
        hasErrors: true,
        hasWarnings: true,
        fixable: false,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert
      expect(decision.action).toBe('REPORT_ONLY')
      expect(decision.issues?.length).toBe(2)
      expect(decision.confidence).toBeGreaterThan(0.5)
    })

    test('should_classify_typescript_errors_by_error_code', () => {
      // Arrange - Various TypeScript error codes
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2307', // Module not found
          file: '/src/imports.ts',
          line: 1,
          col: 1,
          message: "Cannot find module 'missing'",
        },
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2304', // Cannot find name
          file: '/src/vars.ts',
          line: 5,
          col: 10,
          message: "Cannot find name 'undefinedVar'",
        },
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS7006', // Parameter implicitly has 'any' type
          file: '/src/funcs.ts',
          line: 10,
          col: 15,
          message: "Parameter 'x' implicitly has an 'any' type",
        },
      ]

      // Act
      const classifications = issues.map((issue) => autopilot.classifyErrorCode(issue))

      // Assert
      expect(classifications[0]?.category).toBe('import-error')
      expect(classifications[0]?.fixable).toBe(false)
      expect(classifications[1]?.category).toBe('reference-error')
      expect(classifications[1]?.fixable).toBe(false)
      expect(classifications[2]?.category).toBe('implicit-any')
      expect(classifications[2]?.fixable).toBe(true) // Can be fixed by adding type
    })

    test('should_use_severity_for_confidence_scoring', () => {
      // Arrange
      const errorIssue: Issue = {
        engine: 'typescript',
        severity: 'error',
        ruleId: 'TS2307',
        file: '/src/critical.ts',
        line: 1,
        col: 1,
        message: 'Critical error',
      }

      const warningIssue: Issue = {
        engine: 'eslint',
        severity: 'warning',
        ruleId: 'no-unused-vars',
        file: '/src/minor.ts',
        line: 1,
        col: 1,
        message: 'Minor warning',
      }

      const infoIssue: Issue = {
        engine: 'prettier',
        severity: 'info',
        ruleId: 'prettier/prettier',
        file: '/src/style.ts',
        line: 1,
        col: 1,
        message: 'Style issue',
      }

      // Act
      const errorScore = autopilot.calculateConfidenceFromSeverity(errorIssue)
      const warningScore = autopilot.calculateConfidenceFromSeverity(warningIssue)
      const infoScore = autopilot.calculateConfidenceFromSeverity(infoIssue)

      // Assert
      expect(errorScore).toBe(1.0) // High confidence for errors
      expect(warningScore).toBe(0.8) // Medium confidence for warnings
      expect(infoScore).toBe(0.6) // Lower confidence for info
    })

    test('should_leverage_line_column_precision_for_better_targeting', () => {
      // Arrange
      const preciseIssue: Issue = {
        engine: 'eslint',
        severity: 'error',
        ruleId: 'no-unused-vars',
        file: '/src/precise.ts',
        line: 42,
        col: 15,
        endLine: 42,
        endCol: 25,
        message: 'Unused variable with precise location',
      }

      const vagueIssue: Issue = {
        engine: 'eslint',
        severity: 'error',
        ruleId: 'no-unused-vars',
        file: '/src/vague.ts',
        line: 1,
        col: 1,
        message: 'Unused variable with vague location',
      }

      // Act
      const preciseTargeting = autopilot.assessTargetingPrecision(preciseIssue)
      const vagueTargeting = autopilot.assessTargetingPrecision(vagueIssue)

      // Assert
      expect(preciseTargeting.hasPreciseLocation).toBe(true)
      expect(preciseTargeting.confidence).toBeGreaterThan(0.9)
      expect(vagueTargeting.hasPreciseLocation).toBe(false)
      expect(vagueTargeting.confidence).toBeLessThan(0.7)
    })

    test('should_group_issues_by_engine_for_better_decision_making', () => {
      // Arrange
      const mixedIssues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2307',
          file: '/src/ts-error.ts',
          line: 1,
          col: 1,
          message: 'TypeScript error',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'no-console',
          file: '/src/eslint-warn.ts',
          line: 2,
          col: 1,
          message: 'ESLint warning',
        },
        {
          engine: 'prettier',
          severity: 'info',
          ruleId: 'prettier/prettier',
          file: '/src/format.ts',
          line: 3,
          col: 1,
          message: 'Prettier formatting',
        },
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2304',
          file: '/src/ts-error2.ts',
          line: 4,
          col: 1,
          message: 'Another TypeScript error',
        },
      ]

      // Act
      const grouped = autopilot.groupIssuesByEngine(mixedIssues)

      // Assert
      expect(grouped.typescript).toHaveLength(2)
      expect(grouped.eslint).toHaveLength(1)
      expect(grouped.prettier).toHaveLength(1)
      expect(grouped.typescript[0]?.ruleId).toBe('TS2307')
      expect(grouped.typescript[1]?.ruleId).toBe('TS2304')
    })
  })

  describe('TypeScript Error Code Classification', () => {
    test('should_classify_TS2xxx_as_type_errors', () => {
      // Arrange
      const typeErrors = [
        { ruleId: 'TS2307', expected: 'import-error' },
        { ruleId: 'TS2304', expected: 'reference-error' },
        { ruleId: 'TS2322', expected: 'type-mismatch' },
        { ruleId: 'TS2345', expected: 'argument-type-error' },
        { ruleId: 'TS2339', expected: 'property-not-exist' },
      ]

      // Act & Assert
      typeErrors.forEach(({ ruleId, expected }) => {
        const issue: Issue = {
          engine: 'typescript',
          severity: 'error',
          ruleId,
          file: '/test.ts',
          line: 1,
          col: 1,
          message: 'Type error',
        }
        const classification = autopilot.classifyTypeScriptError(issue)
        expect(classification.category).toBe(expected)
        expect(classification.isTypeError).toBe(true)
      })
    })

    test('should_classify_TS7xxx_as_config_errors', () => {
      // Arrange
      const configErrors = [
        { ruleId: 'TS7006', expected: 'implicit-any' },
        { ruleId: 'TS7016', expected: 'no-type-declaration' },
        { ruleId: 'TS7053', expected: 'index-signature' },
      ]

      // Act & Assert
      configErrors.forEach(({ ruleId, expected }) => {
        const issue: Issue = {
          engine: 'typescript',
          severity: 'error',
          ruleId,
          file: '/test.ts',
          line: 1,
          col: 1,
          message: 'Config error',
        }
        const classification = autopilot.classifyTypeScriptError(issue)
        expect(classification.category).toBe(expected)
        expect(classification.isConfigError).toBe(true)
      })
    })
  })

  describe('ESLint Rule Classification with Metadata', () => {
    test('should_use_rule_metadata_for_better_classification', () => {
      // Arrange
      const eslintIssues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: '@typescript-eslint/no-unused-vars',
          file: '/src/unused.ts',
          line: 10,
          col: 5,
          message: 'Variable is defined but never used',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'react-hooks/exhaustive-deps',
          file: '/src/hook.tsx',
          line: 20,
          col: 10,
          message: 'Missing dependency in useEffect',
        },
      ]

      // Act
      const classifications = eslintIssues.map((issue) => autopilot.classifyESLintRule(issue))

      // Assert
      expect(classifications[0]?.plugin).toBe('@typescript-eslint')
      expect(classifications[0]?.rule).toBe('no-unused-vars')
      expect(classifications[0]?.fixable).toBe(true)
      expect(classifications[1]?.plugin).toBe('react-hooks')
      expect(classifications[1]?.rule).toBe('exhaustive-deps')
      expect(classifications[1]?.requiresContext).toBe(true)
    })
  })

  describe('Prettier Formatting Classification', () => {
    test('should_always_classify_prettier_as_safe_to_fix', () => {
      // Arrange
      const prettierIssue: Issue = {
        engine: 'prettier',
        severity: 'info',
        ruleId: 'prettier/prettier',
        file: '/src/format.ts',
        line: 1,
        col: 80,
        message: 'Line exceeds 80 characters',
      }

      // Act
      const classification = autopilot.classifyPrettierIssue(prettierIssue)

      // Assert
      expect(classification.alwaysSafe).toBe(true)
      expect(classification.autoFixable).toBe(true)
      expect(classification.confidence).toBe(1.0)
    })
  })
})

describe('Autopilot - Three-Tier Classification System', () => {
  let autopilot: Autopilot

  beforeEach(() => {
    autopilot = new Autopilot()
  })

  describe('Success Metrics Validation', () => {
    test('should_achieve_80_percent_automation_rate_on_common_issues', () => {
      // Arrange - Common distribution of issues
      const commonIssues: Issue[] = [
        // 80 formatting issues (80% of issues)
        ...Array(80)
          .fill(null)
          .map(() => ({
            engine: 'prettier' as const,
            severity: 'info' as const,
            ruleId: 'prettier/prettier',
            file: 'test.ts',
            line: 1,
            col: 1,
            message: 'Formatting issue',
          })),
        // 10 import issues
        ...Array(10)
          .fill(null)
          .map(() => ({
            engine: 'eslint' as const,
            severity: 'warning' as const,
            ruleId: 'import/order',
            file: 'test.ts',
            line: 1,
            col: 1,
            message: 'Import order issue',
          })),
        // 10 complexity issues (unfixable)
        ...Array(10)
          .fill(null)
          .map(() => ({
            engine: 'eslint' as const,
            severity: 'error' as const,
            ruleId: 'complexity',
            file: 'test.ts',
            line: 1,
            col: 1,
            message: 'Complexity issue',
          })),
      ]

      const checkResult: CheckResult = {
        filePath: 'test.ts',
        issues: commonIssues,
        hasErrors: true,
        hasWarnings: false,
        fixable: true,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert
      const automationRate = (decision.fixes?.length || 0) / commonIssues.length
      expect(automationRate).toBeGreaterThanOrEqual(0.8)
      expect(decision.action).toBe('FIX_AND_REPORT')
      expect(decision.fixes?.length).toBe(90)
      expect(decision.issues?.length).toBe(10)
    })

    test('should_have_zero_false_positives_on_risky_issues', () => {
      // Arrange - Issues that should never be auto-fixed
      const riskyIssues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: 'no-undef',
          file: 'test.ts',
          line: 1,
          col: 1,
          message: 'Undefined variable',
        },
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: 'no-unused-expressions',
          file: 'test.ts',
          line: 1,
          col: 1,
          message: 'Unused expression',
        },
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: 'security/detect-object-injection',
          file: 'test.ts',
          line: 1,
          col: 1,
          message: 'Security issue',
        },
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: '@typescript-eslint/no-unsafe-assignment',
          file: 'test.ts',
          line: 1,
          col: 1,
          message: 'Unsafe assignment',
        },
      ]

      const checkResult: CheckResult = {
        filePath: 'test.ts',
        issues: riskyIssues,
        hasErrors: true,
        hasWarnings: false,
        fixable: true,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert - Should not auto-fix any risky issues
      expect(decision.action).toBe('REPORT_ONLY')
      expect(decision.fixes).toBeUndefined()
      expect(decision.issues?.length).toBe(4)
    })
  })

  describe('Auto-fixable rule detection (Tier 1)', () => {
    test('should_classify_prettier_issues_as_auto_fixable', () => {
      // Act
      const classification = autopilot.classifyRule('prettier/prettier')

      // Assert
      expect(classification.category).toBe('ALWAYS_SAFE')
      expect(classification.autoFixable).toBe(true)
      expect(classification.confidence).toBe(1.0)
    })

    test('should_classify_formatting_rules_as_auto_fixable', () => {
      // Arrange
      const formattingRules = [
        'semi',
        'quotes',
        'comma-dangle',
        'indent',
        'no-trailing-spaces',
        'eol-last',
      ]

      formattingRules.forEach((rule) => {
        // Act
        const classification = autopilot.classifyRule(rule)

        // Assert
        expect(classification.category).toBe('ALWAYS_SAFE')
        expect(classification.autoFixable).toBe(true)
        expect(classification.confidence).toBe(1.0)
      })
    })

    test('should_classify_import_organization_as_auto_fixable', () => {
      // Arrange
      const importRules = ['import/order', 'import/newline-after-import', 'sort-imports']

      importRules.forEach((rule) => {
        // Act
        const classification = autopilot.classifyRule(rule)

        // Assert
        expect(classification.category).toBe('ALWAYS_SAFE')
        expect(classification.autoFixable).toBe(true)
        expect(classification.confidence).toBe(1.0)
      })
    })

    test('should_handle_auto_fixable_issues_in_decision_logic', () => {
      // Arrange
      const checkResult: CheckResult = {
        filePath: '/test/component.ts',
        issues: [
          {
            engine: 'prettier',
            severity: 'info',
            ruleId: 'prettier/prettier',
            line: 1,
            col: 1,
            message: 'Formatting issue',
            file: '/test/component.ts',
          },
          {
            engine: 'eslint',
            severity: 'warning',
            ruleId: 'semi',
            line: 1,
            col: 1,
            message: 'Missing semicolon',
            file: '/test/component.ts',
          },
        ],
        hasErrors: true,
        hasWarnings: false,
        fixable: true,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert
      expect(decision.action).toBe('FIX_SILENTLY')
      expect(decision.fixes).toHaveLength(2)
      expect(decision.confidence).toBe(1.0)
    })

    test('should_return_continue_when_no_issues', () => {
      // Arrange
      const checkResult: CheckResult = {
        filePath: '/test/component.ts',
        issues: [],
        hasErrors: false,
        hasWarnings: false,
        fixable: false,
      }

      // Act
      const decision = autopilot.decide(checkResult)

      // Assert
      expect(decision.action).toBe('CONTINUE')
      expect(decision.confidence).toBe(1.0)
    })

    test('should_handle_malformed_check_result_gracefully', () => {
      // Arrange
      const malformedResult = null as any

      // Act
      const decision = autopilot.decide(malformedResult)

      // Assert
      expect(decision.action).toBe('CONTINUE')
      expect(decision.confidence).toBe(0.5)
    })
  })

  describe('Claude-fixable instruction generation (Tier 2)', () => {
    test('should_generate_instructions_for_unused_vars', () => {
      // Arrange
      const issue: Issue = {
        engine: 'eslint',
        severity: 'warning',
        ruleId: '@typescript-eslint/no-unused-vars',
        file: '/test/component.ts',
        line: 1,
        col: 1,
        message: 'Unused variable: event',
      }

      // Act
      const instructions = autopilot.generateClaudeInstructions(issue)

      // Assert
      expect(instructions).toBeDefined()
      expect(instructions.message).toContain(
        'Claude, please fix this @typescript-eslint/no-unused-vars error',
      )
      expect(instructions.instruction).toContain('prefix with underscore')
      expect(instructions.example).toContain('const _data')
      expect(instructions.location).toContain('/test/component.ts')
    })

    test('should_generate_instructions_for_explicit_any', () => {
      // Arrange
      const issue: Issue = {
        engine: 'eslint',
        severity: 'warning',
        ruleId: '@typescript-eslint/no-explicit-any',
        line: 1,
        col: 1,
        message: 'Unexpected any. Specify a different type.',
        file: '/test/service.ts',
      }

      // Act
      const instructions = autopilot.generateClaudeInstructions(issue)

      // Assert
      expect(instructions).toBeDefined()
      expect(instructions.instruction).toContain('Replace any with specific type or unknown')
      expect(instructions.example).toContain('data: User | null')
    })

    test('should_generate_instructions_for_hook_deps', () => {
      // Arrange
      const issue: Issue = {
        engine: 'eslint',
        severity: 'warning',
        ruleId: 'react-hooks/exhaustive-deps',
        line: 1,
        col: 1,
        message: 'React Hook useEffect has missing dependencies',
        file: '/test/hooks.ts',
      }

      // Act
      const instructions = autopilot.generateClaudeInstructions(issue)

      // Assert
      expect(instructions).toBeDefined()
      expect(instructions.instruction).toContain('Add missing dependencies to useEffect array')
      expect(instructions.example).toContain('[userId, fetchData]')
    })

    test('should_return_generic_instruction_for_unknown_claude_fixable_rule', () => {
      // Arrange
      const issue: Issue = {
        engine: 'eslint',
        severity: 'warning',
        ruleId: 'unknown-claude-rule',
        line: 1,
        col: 1,
        message: 'Some issue',
        file: '/test/file.ts',
      }

      // Act
      const instructions = autopilot.generateClaudeInstructions(issue)

      // Assert
      expect(instructions).toBeDefined()
      expect(instructions.message).toContain('Claude, please fix this unknown-claude-rule error')
      expect(instructions.instruction).toContain('Please review and fix this issue')
    })

    test('should_classify_claude_fixable_rules_correctly', () => {
      // Arrange
      const claudeFixableRules = [
        '@typescript-eslint/no-unused-vars',
        '@typescript-eslint/no-explicit-any',
        'react-hooks/exhaustive-deps',
      ]

      claudeFixableRules.forEach((rule) => {
        // Act
        const classification = autopilot.classifyRule(rule)

        // Assert
        expect(classification.category).toBe('CLAUDE_FIXABLE')
        expect(classification.autoFixable).toBe(false) // Requires instructions
        expect(classification.confidence).toBeGreaterThan(0.8)
      })
    })
  })

  describe('Human-required educational content (Tier 3)', () => {
    test('should_provide_educational_content_for_complexity_issues', () => {
      // Arrange
      const issue: Issue = {
        engine: 'eslint',
        severity: 'error',
        ruleId: 'complexity',
        line: 1,
        col: 1,
        message: 'Function has too many branches (15). Maximum allowed is 10.',
        file: '/test/complex-function.ts',
      }

      // Act
      const education = autopilot.generateEducationalContent(issue)

      // Assert
      expect(education).toBeDefined()
      expect(education.explanation).toContain('too complex')
      expect(education.explanation).toContain('smaller functions')
      expect(education.learningPath).toContain('Single Responsibility Principle')
      expect(education.nextSteps).toContain('Extract helper functions')
    })

    test('should_provide_educational_content_for_security_issues', () => {
      // Arrange
      const issue: Issue = {
        engine: 'eslint',
        severity: 'error',
        ruleId: 'security/detect-object-injection',
        line: 1,
        col: 1,
        message: 'Potential object injection vulnerability',
        file: '/test/security-issue.ts',
      }

      // Act
      const education = autopilot.generateEducationalContent(issue)

      // Assert
      expect(education).toBeDefined()
      expect(education.explanation).toContain('security vulnerability')
      expect(education.learningPath).toContain('OWASP security guidelines')
      expect(education.nextSteps).toContain('security team')
    })

    test('should_provide_educational_content_for_type_safety_issues', () => {
      // Arrange
      const issue: Issue = {
        engine: 'eslint',
        severity: 'error',
        ruleId: '@typescript-eslint/no-unsafe-assignment',
        line: 1,
        col: 1,
        message: 'Unsafe assignment of an any value',
        file: '/test/unsafe-types.ts',
      }

      // Act
      const education = autopilot.generateEducationalContent(issue)

      // Assert
      expect(education).toBeDefined()
      expect(education.explanation).toContain('type safety')
      expect(education.learningPath).toContain('TypeScript type guards')
      expect(education.nextSteps).toContain('type checking')
    })

    test('should_classify_human_required_rules_correctly', () => {
      // Arrange
      const humanRequiredRules = [
        'complexity',
        'max-lines-per-function',
        'security/detect-object-injection',
        '@typescript-eslint/no-unsafe-assignment',
      ]

      humanRequiredRules.forEach((rule) => {
        // Act
        const classification = autopilot.classifyRule(rule)

        // Assert
        expect(classification.category).toBe('NEVER_AUTO')
        expect(classification.autoFixable).toBe(false)
        expect(classification.confidence).toBe(1.0)
      })
    })

    test('should_return_generic_education_for_unknown_human_required_rule', () => {
      // Arrange
      const issue: Issue = {
        engine: 'eslint',
        severity: 'error',
        ruleId: 'unknown-complex-rule',
        line: 1,
        col: 1,
        message: 'Some complex issue',
        file: '/test/file.ts',
      }

      // Act
      const education = autopilot.generateEducationalContent(issue)

      // Assert
      expect(education).toBeDefined()
      expect(education.explanation).toContain('requires careful consideration')
      expect(education.learningPath).toContain('best practices')
      expect(education.nextSteps).toContain('team lead')
    })
  })
})
