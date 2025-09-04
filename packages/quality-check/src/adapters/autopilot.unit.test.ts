import { describe, test, expect, beforeEach } from 'vitest'
import { Autopilot } from './autopilot.js'
import type { Issue, CheckResult } from '../types.js'

describe('Autopilot - Three-Tier Classification System', () => {
  let autopilot: Autopilot

  beforeEach(() => {
    autopilot = new Autopilot()
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
            rule: 'prettier/prettier',
            fixable: true,
            message: 'Formatting issue',
            file: '/test/component.ts',
          },
          {
            rule: 'semi',
            fixable: true,
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
        rule: '@typescript-eslint/no-unused-vars',
        fixable: true,
        message: 'Unused variable: event',
        file: '/test/component.ts',
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
        rule: '@typescript-eslint/no-explicit-any',
        fixable: true,
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
        rule: 'react-hooks/exhaustive-deps',
        fixable: true,
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
        rule: 'unknown-claude-rule',
        fixable: true,
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
        rule: 'complexity',
        fixable: false,
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
        rule: 'security/detect-object-injection',
        fixable: false,
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
        rule: '@typescript-eslint/no-unsafe-assignment',
        fixable: false,
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
        rule: 'unknown-complex-rule',
        fixable: false,
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
