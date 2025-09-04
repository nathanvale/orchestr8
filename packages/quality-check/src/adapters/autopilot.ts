// src/adapters/autopilot.ts

import type { CheckResult, Issue, AutopilotDecision, Classification } from '../types.js'

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
   * Tier 1: Always safe to auto-fix
   * These rules NEVER change code behavior, only style
   */
  private readonly ALWAYS_SAFE = new Set([
    // Formatting - 28 rules (Pure style, no behavior change)
    'prettier/prettier',
    'indent',
    'semi',
    'quotes',
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
    'semi-spacing',
    'arrow-spacing',
    
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
    'arrow-parens',
    'arrow-body-style',
    'object-shorthand',
    'prefer-destructuring',
    'no-useless-rename',
    'no-useless-constructor',
    'prefer-numeric-literals',
    
    // Dead code removal - 5 rules (Safe cleanup)
    'no-empty',
    'no-useless-return',
    'no-useless-catch',
    'no-unused-vars',
    'no-useless-escape',
    
    // Simplification - 6 rules (Equivalent but simpler)
    'no-extra-boolean-cast',
    'no-extra-parens',
    'no-extra-semi',
    'no-unneeded-ternary',
    'yoda',
    'no-else-return'
  ])

  /**
   * Tier 2: Safe in specific contexts
   * Check context before auto-fixing
   */
  private readonly CONTEXT_DEPENDENT = new Set([
    'no-console',            // Safe to remove in production
    'no-debugger',          // Always safe to remove
    'no-alert',             // Safe to remove in Node.js
    '@typescript-eslint/no-explicit-any', // any → unknown
    'no-var',               // var → let/const
  ])

  /**
   * Tier 3: NEVER auto-fix
   * These require human judgment
   */
  private readonly NEVER_AUTO = new Set([
    'no-undef',              // Undefined variables - might be global
    'no-unused-expressions', // Might be intentional
    'complexity',            // Requires refactoring
    'max-lines-per-function', // Requires decomposition
    'max-depth',             // Requires restructuring
    'max-statements',        // Requires splitting
    'security/detect-object-injection', // Security issue
    'security/detect-non-literal-regexp', // Security issue
    '@typescript-eslint/no-unsafe-assignment', // Type safety
    '@typescript-eslint/no-unsafe-call',       // Type safety
    '@typescript-eslint/no-unsafe-member-access', // Type safety
    '@typescript-eslint/no-unused-vars', // Let TypeScript handle this
    'no-unreachable',        // Moved from ALWAYS_SAFE for safety
    '@typescript-eslint/ban-types', // Type safety
  ])

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
    
    // All issues are safely fixable
    if (classification.allAutoFixable && classification.autoFixable.length > 0) {
      return {
        action: 'FIX_SILENTLY',
        fixes: classification.autoFixable,
        confidence: 1.0,
      }
    }
    
    // Mix of fixable and unfixable
    if (classification.hasAutoFixable && classification.hasUnfixable) {
      return {
        action: 'FIX_AND_REPORT',
        fixes: classification.autoFixable,
        issues: classification.unfixable,
        confidence: 0.8,
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
      if (!issue || !issue.rule) {
        unfixable.push(issue)
        continue
      }

      // Skip if not fixable at all
      if (!issue.fixable) {
        unfixable.push(issue)
        continue
      }
      
      // Check which category
      if (this.ALWAYS_SAFE.has(issue.rule)) {
        autoFixable.push(issue)
      } else if (this.CONTEXT_DEPENDENT.has(issue.rule)) {
        const contextDecision = this.checkContext(issue)
        if (contextDecision.safe) {
          autoFixable.push(issue)
        } else {
          unfixable.push(issue)
        }
      } else if (this.NEVER_AUTO.has(issue.rule)) {
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
    const isTestFile = issue.file.includes('.test.') || 
                      issue.file.includes('.spec.') ||
                      issue.file.includes('__tests__')
    
    // Check for development files
    const isDevFile = issue.file.includes('.dev.') ||
                     issue.file.includes('debug') ||
                     issue.file.includes('development')
    
    switch (issue.rule) {
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
        
      case '@typescript-eslint/no-explicit-any':
        // Safe to convert to unknown
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
    // For always-safe rules, no verification needed
    if (this.ALWAYS_SAFE.has(issue.rule)) {
      return true
    }
    
    // For others, could add AST comparison, etc.
    // For now, trust ESLint's fixable flag
    return issue.fixable === true
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
    return filePath.includes('.test.') || 
           filePath.includes('.spec.') ||
           filePath.includes('__tests__')
  }

  isDevFile(filePath: string): boolean {
    if (!filePath) return false
    return filePath.includes('.dev.') ||
           filePath.includes('debug') ||
           filePath.includes('development')
  }

  isUIFile(filePath: string): boolean {
    if (!filePath) return false
    return filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
  }

  // Public method for testing context checking
  checkContextPublic(rule: string, filePath: string): { shouldAutoFix: boolean; reason: string } {
    const issue: Issue = { rule, fixable: true, file: filePath }
    const result = this.checkContext(issue)
    return {
      shouldAutoFix: result.safe,
      reason: result.reason || (result.safe ? 'Safe to auto-fix' : 'Not safe to auto-fix')
    }
  }

  // Public method for testing single rule classification
  classifyRule(rule: string): { ruleId: string; category: string; confidence: number; autoFixable: boolean } {
    let category: string
    let confidence: number
    let autoFixable: boolean

    if (this.ALWAYS_SAFE.has(rule)) {
      category = 'ALWAYS_SAFE'
      confidence = 1.0
      autoFixable = true
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
      autoFixable
    }
  }
}