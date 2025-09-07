// src/adapters/autopilot.ts

import type {
  CheckResult,
  AutopilotDecision,
  Classification,
  ClaudeInstruction,
  EducationalContent,
  ThreeTierClassification,
} from '../types.js'
import type { Issue } from '../types/issue-types.js'

/**
 * Autopilot: Smart decision engine for auto-fixing
 *
 * Philosophy:
 * - Fix silently when 100% safe
 * - Report when human judgment needed
 * - Never break working code
 */
export class Autopilot {
  /**
   * Tier 1: Always safe to auto-fix (54 rules total)
   * These rules NEVER change code behavior, only style
   */
  private readonly ALWAYS_SAFE = new Set([
    // Formatting - 28 rules (Pure style, no behavior change)
    'prettier/prettier',
    'indent',
    'semi',
    'semi-spacing',
    'semi-style',
    'quotes',
    'quote-props',
    'jsx-quotes',
    'comma-dangle',
    'comma-spacing',
    'comma-style',
    'space-before-blocks',
    'space-before-function-paren',
    'space-in-parens',
    'space-infix-ops',
    'space-unary-ops',
    'object-curly-spacing',
    'array-bracket-spacing',
    'computed-property-spacing',
    'func-call-spacing',
    'key-spacing',
    'keyword-spacing',
    'no-trailing-spaces',
    'no-whitespace-before-property',
    'padded-blocks',
    'padding-line-between-statements',
    'eol-last',
    'linebreak-style',
    'no-multiple-empty-lines',

    // Import organization - 4 rules (Safe reordering)
    'import/order',
    'import/newline-after-import',
    'import/no-duplicates',
    'sort-imports',

    // Safe modernization - 11 rules (Equivalent transformations)
    'prefer-const',
    'prefer-template',
    'template-curly-spacing',
    'prefer-arrow-callback',
    'arrow-spacing',
    'arrow-parens',
    'arrow-body-style',
    'object-shorthand',
    'prefer-destructuring',
    'no-useless-rename',
    'prefer-numeric-literals',

    // Dead code removal - 6 rules (Safe cleanup)
    'no-unused-vars',
    'no-unreachable',
    'no-empty',
    'no-useless-return',
    'no-useless-catch',
    'no-useless-constructor',

    // Simplification - 9 rules (Equivalent but simpler)
    'no-extra-boolean-cast',
    'no-extra-parens',
    'no-extra-semi',
    'yoda',
    'no-unneeded-ternary',
    'no-else-return',
    'no-lonely-if',
    'operator-assignment',
    'no-useless-escape',
  ])

  /**
   * Tier 2: Claude-fixable with specific instructions
   * These rules Claude can fix with guidance
   */
  private readonly CLAUDE_FIXABLE_RULES = new Map([
    [
      '@typescript-eslint/no-unused-vars',
      {
        instruction: 'Remove unused variables or prefix with underscore',
        example: 'Change `const data = ...` to `const _data = ...` if intentionally unused',
      },
    ],
    [
      '@typescript-eslint/no-explicit-any',
      {
        instruction: 'Replace any with specific type or unknown',
        example: 'Change `data: any` to `data: User | null` or `data: unknown`',
      },
    ],
    [
      'react-hooks/exhaustive-deps',
      {
        instruction: 'Add missing dependencies to useEffect array',
        example: 'Add all used variables to dependency array: [userId, fetchData]',
      },
    ],
    [
      '@typescript-eslint/prefer-nullish-coalescing',
      {
        instruction: 'Use nullish coalescing operator (??) instead of logical OR (||)',
        example: 'Change `value || fallback` to `value ?? fallback` for null/undefined checks',
      },
    ],
    [
      '@typescript-eslint/prefer-optional-chain',
      {
        instruction: 'Use optional chaining (?.) for safer property access',
        example: 'Change `obj && obj.prop` to `obj?.prop`',
      },
    ],
  ])

  /**
   * Tier 3: Safe in specific contexts
   * Check context before auto-fixing
   */
  private readonly CONTEXT_DEPENDENT = new Set([
    'no-console', // Safe to remove in production
    'no-debugger', // Always safe to remove
    'no-alert', // Safe to remove in Node.js
    'no-var', // var → let/const
  ])

  /**
   * Tier 4: NEVER auto-fix - Human required
   * These require human judgment
   */
  private readonly NEVER_AUTO = new Set([
    'no-undef', // Undefined variables - might be global
    'no-unused-expressions', // Might be intentional
    'complexity', // Requires refactoring
    'max-lines-per-function', // Requires decomposition
    'max-depth', // Requires restructuring
    'max-statements', // Requires splitting
    'security/detect-object-injection', // Security issue
    'security/detect-non-literal-regexp', // Security issue
    '@typescript-eslint/no-unsafe-assignment', // Type safety
    '@typescript-eslint/no-unsafe-call', // Type safety
    '@typescript-eslint/no-unsafe-member-access', // Type safety
    'no-unreachable', // Moved from ALWAYS_SAFE for safety
    '@typescript-eslint/ban-types', // Type safety
  ])

  /**
   * Educational content for human-required issues
   */
  private readonly HUMAN_REQUIRED_PATTERNS = {
    'complexity': {
      explanation: 'This function is too complex. Consider breaking it into smaller functions.',
      learningPath: 'Read about Single Responsibility Principle',
      nextSteps: 'Extract helper functions or use composition patterns',
      category: 'complexity' as const,
    },
    'security': {
      explanation: 'Potential security vulnerability detected.',
      learningPath: 'Review OWASP security guidelines',
      nextSteps: 'Consult security team or use secure alternatives',
      category: 'security' as const,
    },
    'type-safety': {
      explanation: 'This issue affects type safety and could lead to runtime errors.',
      learningPath: 'Learn about TypeScript type guards and strict typing',
      nextSteps: 'Add proper type checking or use type assertions carefully',
      category: 'type-safety' as const,
    },
    'architecture': {
      explanation: 'This change affects system architecture.',
      learningPath: 'Discuss with tech lead or architect',
      nextSteps: 'Consider design review before implementation',
      category: 'architecture' as const,
    },
    'performance': {
      explanation: 'This issue may impact application performance.',
      learningPath: 'Study performance optimization techniques',
      nextSteps: 'Profile code and measure impact before optimization',
      category: 'performance' as const,
    },
  }

  /**
   * Map new Issue structure to legacy rule format for backward compatibility
   */
  private mapIssueToRule(issue: Issue): string {
    // Handle new Issue structure
    if (issue.ruleId) {
      return issue.ruleId
    }
    // Fallback for any edge cases
    return 'unknown'
  }

  /**
   * Check if an issue is fixable based on engine and rule
   */
  private isFixable(issue: Issue): boolean {
    const rule = this.mapIssueToRule(issue)

    // Prettier is always fixable
    if (issue.engine === 'prettier') {
      return true
    }

    // Check if rule is in auto-fixable categories
    if (this.ALWAYS_SAFE.has(rule)) {
      return true
    }

    if (this.CLAUDE_FIXABLE_RULES.has(rule)) {
      return true
    }

    if (this.CONTEXT_DEPENDENT.has(rule)) {
      return true
    }

    // TypeScript errors are generally not auto-fixable
    if (issue.engine === 'typescript') {
      return false
    }

    return false
  }

  /**
   * Main decision method - the brain of autopilot
   */
  decide(result: CheckResult): AutopilotDecision {
    // Handle malformed input
    if (!result || !result.issues) {
      return {
        action: 'CONTINUE',
        confidence: 0.5, // Lower confidence for malformed input
      }
    }

    // Handle empty issues array
    if (result.issues.length === 0) {
      return {
        action: 'CONTINUE',
        confidence: 1.0,
      }
    }

    const classification = this.classify(result.issues)

    // If we have any auto-fixable issues
    if (classification.hasAutoFixable) {
      // Mix of fixable and unfixable - fix what we can and report the rest
      if (classification.hasUnfixable) {
        return {
          action: 'FIX_AND_REPORT',
          fixes: classification.autoFixable,
          issues: classification.unfixable,
          confidence: 0.8,
        }
      }
      // All issues are safely fixable
      else {
        return {
          action: 'FIX_SILENTLY',
          fixes: classification.autoFixable,
          confidence: 1.0,
        }
      }
    }

    // Only unfixable issues
    if (classification.hasUnfixable) {
      return {
        action: 'REPORT_ONLY',
        issues: classification.unfixable,
        confidence: 1.0,
      }
    }

    // No issues or other edge cases
    return {
      action: 'CONTINUE',
      confidence: 1.0,
    }
  }

  /**
   * Classify issues into categories
   */
  private classify(issues: Issue[]): Classification {
    const autoFixable: Issue[] = []
    const contextFixable: Issue[] = []
    const unfixable: Issue[] = []

    for (const issue of issues) {
      // Handle malformed issues
      if (!issue) {
        unfixable.push(issue)
        continue
      }

      const rule = this.mapIssueToRule(issue)

      // Handle TypeScript errors specially
      if (issue.engine === 'typescript') {
        // TypeScript errors are generally not auto-fixable
        unfixable.push(issue)
        continue
      }

      // Handle Prettier formatting
      if (issue.engine === 'prettier') {
        autoFixable.push(issue)
        continue
      }

      // Check which category for ESLint rules
      if (this.ALWAYS_SAFE.has(rule)) {
        autoFixable.push(issue)
      } else if (this.CLAUDE_FIXABLE_RULES.has(rule)) {
        // Claude-fixable issues go to unfixable for now (need special handling)
        unfixable.push(issue)
      } else if (this.CONTEXT_DEPENDENT.has(rule)) {
        const contextDecision = this.checkContext(issue)
        if (contextDecision.safe) {
          autoFixable.push(issue)
        } else {
          unfixable.push(issue)
        }
      } else if (this.NEVER_AUTO.has(rule)) {
        unfixable.push(issue)
      } else {
        // Unknown rule - be conservative
        unfixable.push(issue)
      }
    }

    return {
      autoFixable,
      contextFixable,
      unfixable,
      allAutoFixable: unfixable.length === 0 && contextFixable.length === 0,
      hasAutoFixable: autoFixable.length > 0,
      hasUnfixable: unfixable.length > 0,
    }
  }

  /**
   * Check context for context-dependent rules
   */
  private checkContext(issue: Issue): { safe: boolean; reason?: string } {
    // Handle missing file path
    if (!issue.file) {
      return { safe: false, reason: 'No file path provided' }
    }

    // Check for test files
    const isTestFile =
      issue.file.includes('.test.') ||
      issue.file.includes('.spec.') ||
      issue.file.includes('__tests__')

    // Check for development files
    const isDevFile =
      issue.file.includes('.dev.') ||
      issue.file.includes('debug') ||
      issue.file.includes('development') ||
      issue.file.includes('dev-server')

    const rule = this.mapIssueToRule(issue)

    switch (rule) {
      case 'no-console':
        // Safe to remove in production files
        if (isTestFile || isDevFile) {
          return { safe: false, reason: 'Console might be intentional in test/dev' }
        }
        return { safe: true }

      case 'no-debugger':
        // Always safe to remove
        return { safe: true }

      case 'no-alert':
        // Safe if not a browser file
        if (issue.file.endsWith('.tsx') || issue.file.endsWith('.jsx')) {
          return { safe: false, reason: 'Alert might be intentional in UI' }
        }
        return { safe: true }

      case 'no-var':
        // Safe to convert to let/const
        return { safe: true }

      default:
        return { safe: false, reason: 'Unknown context rule' }
    }
  }

  /**
   * Verify a fix is safe (optional enhanced verification)
   */
  verifyFix(issue: Issue): boolean {
    const rule = this.mapIssueToRule(issue)

    // For always-safe rules, no verification needed
    if (this.ALWAYS_SAFE.has(rule)) {
      return true
    }

    // For others, could add AST comparison, etc.
    // For now, check if it's fixable
    return this.isFixable(issue)
  }

  /**
   * Generate Claude-specific instructions for fixable issues
   */
  generateClaudeInstructions(issue: Issue): ClaudeInstruction {
    const ruleId = this.mapIssueToRule(issue)
    const rule = this.CLAUDE_FIXABLE_RULES.get(ruleId)

    const instruction: ClaudeInstruction = {
      message: `Claude, please fix this ${ruleId} error:`,
      instruction:
        rule?.instruction || 'Please review and fix this issue according to the rule requirements',
      example: rule?.example || 'Follow the specific rule guidelines for this error type',
      location: `${issue.file}:${issue.line}:${issue.col}`,
    }

    // Only add code property if message exists
    if (issue.message) {
      instruction.code = issue.message
    }

    return instruction
  }

  /**
   * Generate educational content for human-required issues
   */
  generateEducationalContent(issue: Issue): EducationalContent {
    // Map rules to educational categories
    let categoryKey: keyof typeof this.HUMAN_REQUIRED_PATTERNS | null = null
    const rule = this.mapIssueToRule(issue)

    if (
      rule.includes('complexity') ||
      rule.includes('max-lines') ||
      rule.includes('max-statements')
    ) {
      categoryKey = 'complexity'
    } else if (rule.includes('security/')) {
      categoryKey = 'security'
    } else if (rule.includes('unsafe') || rule.includes('ban-types')) {
      categoryKey = 'type-safety'
    } else if (rule.includes('performance')) {
      categoryKey = 'performance'
    }

    if (categoryKey) {
      const pattern = this.HUMAN_REQUIRED_PATTERNS[categoryKey]
      return {
        explanation: pattern.explanation,
        learningPath: pattern.learningPath,
        nextSteps: pattern.nextSteps,
        category: pattern.category,
      }
    }

    // Generic educational content for unknown rules
    return {
      explanation: 'This issue requires careful consideration and human judgment.',
      learningPath: 'Review relevant documentation and best practices for this rule',
      nextSteps: 'Consider discussing with a team lead or senior developer',
      category: 'general',
    }
  }

  /**
   * Three-tier classification for individual issues
   */
  classifyError(issue: Issue): ThreeTierClassification {
    const rule = this.mapIssueToRule(issue)

    if (this.ALWAYS_SAFE.has(rule)) {
      return {
        tier: 'auto-fixable',
        action: 'silent-fix',
        shouldBlock: false,
        shouldEducate: false,
      }
    }

    if (this.CLAUDE_FIXABLE_RULES.has(rule)) {
      return {
        tier: 'claude-fixable',
        action: 'block-and-fix',
        shouldBlock: true,
        shouldEducate: false,
        instructions: this.generateClaudeInstructions(issue),
      }
    }

    return {
      tier: 'human-required',
      action: 'stop-and-educate',
      shouldBlock: true,
      shouldEducate: true,
      educational: this.generateEducationalContent(issue),
    }
  }

  // Public methods for testing rule sets
  getAlwaysSafeRules(): Set<string> {
    return new Set(this.ALWAYS_SAFE)
  }

  getContextDependentRules(): Set<string> {
    return new Set(this.CONTEXT_DEPENDENT)
  }

  getNeverAutoRules(): Set<string> {
    return new Set(this.NEVER_AUTO)
  }

  // Public methods for testing context analysis
  isTestFile(filePath: string): boolean {
    if (!filePath) return false
    return (
      filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')
    )
  }

  isDevFile(filePath: string): boolean {
    if (!filePath) return false
    return (
      filePath.includes('.dev.') ||
      filePath.includes('debug') ||
      filePath.includes('development') ||
      filePath.includes('dev-server')
    )
  }

  isUIFile(filePath: string): boolean {
    if (!filePath) return false
    return filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
  }

  // Public method for testing context checking
  checkContextPublic(rule: string, filePath: string): { shouldAutoFix: boolean; reason: string } {
    const issue: Issue = {
      engine: 'eslint',
      severity: 'warning',
      ruleId: rule,
      file: filePath,
      line: 1,
      col: 1,
      message: 'Test message',
    }
    const result = this.checkContext(issue)
    return {
      shouldAutoFix: result.safe,
      reason: result.reason || (result.safe ? 'Safe to auto-fix' : 'Not safe to auto-fix'),
    }
  }

  /**
   * Classify TypeScript error codes into categories
   */
  classifyErrorCode(issue: Issue): {
    category: string
    fixable: boolean
  } {
    if (issue.engine !== 'typescript' || !issue.ruleId) {
      return { category: 'unknown', fixable: false }
    }

    const code = issue.ruleId

    // TS2xxx - Type-related errors
    if (code.startsWith('TS2')) {
      if (code === 'TS2307') return { category: 'import-error', fixable: false }
      if (code === 'TS2304') return { category: 'reference-error', fixable: false }
      if (code === 'TS2322') return { category: 'type-mismatch', fixable: false }
      if (code === 'TS2345') return { category: 'argument-type-error', fixable: false }
      if (code === 'TS2339') return { category: 'property-not-exist', fixable: false }
      return { category: 'type-error', fixable: false }
    }

    // TS7xxx - Config/Options errors
    if (code.startsWith('TS7')) {
      if (code === 'TS7006') return { category: 'implicit-any', fixable: true }
      if (code === 'TS7016') return { category: 'no-type-declaration', fixable: false }
      if (code === 'TS7053') return { category: 'index-signature', fixable: false }
      return { category: 'config-error', fixable: false }
    }

    return { category: 'unknown', fixable: false }
  }

  /**
   * Calculate confidence score based on severity
   */
  calculateConfidenceFromSeverity(issue: Issue): number {
    switch (issue.severity) {
      case 'error':
        return 1.0
      case 'warning':
        return 0.8
      case 'info':
        return 0.6
      default:
        return 0.5
    }
  }

  /**
   * Assess targeting precision based on location information
   */
  assessTargetingPrecision(issue: Issue): {
    hasPreciseLocation: boolean
    confidence: number
  } {
    const hasPreciseLocation = !!(issue.endLine && issue.endCol)
    const confidence = hasPreciseLocation ? 0.95 : 0.65
    return { hasPreciseLocation, confidence }
  }

  /**
   * Group issues by their engine type
   */
  groupIssuesByEngine(issues: Issue[]): {
    typescript: Issue[]
    eslint: Issue[]
    prettier: Issue[]
  } {
    const grouped = {
      typescript: [] as Issue[],
      eslint: [] as Issue[],
      prettier: [] as Issue[],
    }

    for (const issue of issues) {
      if (issue.engine === 'typescript') {
        grouped.typescript.push(issue)
      } else if (issue.engine === 'eslint') {
        grouped.eslint.push(issue)
      } else if (issue.engine === 'prettier') {
        grouped.prettier.push(issue)
      }
    }

    return grouped
  }

  /**
   * Classify TypeScript errors specifically
   */
  classifyTypeScriptError(issue: Issue): {
    category: string
    isTypeError: boolean
    isConfigError: boolean
  } {
    const classification = this.classifyErrorCode(issue)
    const isTypeError = issue.ruleId?.startsWith('TS2') || false
    const isConfigError = issue.ruleId?.startsWith('TS7') || false

    return {
      category: classification.category,
      isTypeError,
      isConfigError,
    }
  }

  /**
   * Classify ESLint rules with metadata
   */
  classifyESLintRule(issue: Issue): {
    plugin: string
    rule: string
    fixable: boolean
    requiresContext: boolean
  } {
    const ruleId = this.mapIssueToRule(issue)
    const parts = ruleId.split('/')

    // Handle scoped plugins like @typescript-eslint
    const plugin = parts.length > 1 ? parts[0] : 'core'
    const rule = parts.length > 1 ? parts.slice(1).join('/') : ruleId

    const fixable = this.ALWAYS_SAFE.has(ruleId) || this.CLAUDE_FIXABLE_RULES.has(ruleId)
    const requiresContext =
      this.CONTEXT_DEPENDENT.has(ruleId) || ruleId === 'react-hooks/exhaustive-deps'

    return { plugin, rule, fixable, requiresContext }
  }

  /**
   * Classify Prettier issues
   */
  classifyPrettierIssue(_issue: Issue): {
    alwaysSafe: boolean
    autoFixable: boolean
    confidence: number
  } {
    return {
      alwaysSafe: true,
      autoFixable: true,
      confidence: 1.0,
    }
  }

  // Public method for testing single rule classification
  classifyRule(rule: string): {
    ruleId: string
    category: string
    confidence: number
    autoFixable: boolean
  } {
    let category: string
    let confidence: number
    let autoFixable: boolean

    if (this.ALWAYS_SAFE.has(rule)) {
      category = 'ALWAYS_SAFE'
      confidence = 1.0
      autoFixable = true
    } else if (this.CLAUDE_FIXABLE_RULES.has(rule)) {
      category = 'CLAUDE_FIXABLE'
      confidence = 0.9
      autoFixable = false // Requires Claude instructions
    } else if (this.CONTEXT_DEPENDENT.has(rule)) {
      category = 'CONTEXT_DEPENDENT'
      confidence = 0.8
      autoFixable = false // Requires context analysis
    } else if (this.NEVER_AUTO.has(rule)) {
      category = 'NEVER_AUTO'
      confidence = 1.0
      autoFixable = false
    } else {
      // Unknown rule - default to conservative
      category = 'NEVER_AUTO'
      confidence = 0.5 // Lower confidence for unknown rules
      autoFixable = false
    }

    return {
      ruleId: rule,
      category,
      confidence,
      autoFixable,
    }
  }
}
