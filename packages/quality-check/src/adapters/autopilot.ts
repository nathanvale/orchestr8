/**
 * Autopilot Adapter - Intelligent classification for auto-fixing
 * ~50 lines
 */

import type { QualityCheckResult } from '../types.js'

export type Decision = 'FIX_SILENTLY' | 'REPORT_ISSUES' | 'CONTINUE'

export class Autopilot {
  // Rules that are safe to auto-fix without human review
  private readonly SAFE_RULES = [
    'prettier/prettier',
    'indent',
    'quotes',
    'semi',
    'comma-dangle',
    'trailing-spaces',
    'no-multiple-empty-lines',
    'eol-last',
    'no-trailing-spaces',
    'space-before-function-paren',
    'object-curly-spacing',
    'array-bracket-spacing',
    'arrow-spacing',
    'comma-spacing',
    'keyword-spacing',
    'space-in-parens',
    'space-infix-ops',
    'space-unary-ops',
  ]

  /**
   * Decide what to do with quality check results
   */
  decide(result: QualityCheckResult): Decision {
    if (result.success) {
      return 'CONTINUE'
    }

    const hasOnlySafeErrors = this.hasOnlySafeErrors(result)

    if (hasOnlySafeErrors) {
      return 'FIX_SILENTLY'
    }

    const hasCriticalErrors = this.hasCriticalErrors(result)

    if (hasCriticalErrors) {
      return 'REPORT_ISSUES'
    }

    // Minor issues that don't block
    return 'CONTINUE'
  }

  private hasOnlySafeErrors(result: QualityCheckResult): boolean {
    // Check if all errors are in the safe list
    const allErrors = this.extractAllErrors(result)
    return allErrors.every((error) => this.SAFE_RULES.some((rule) => error.includes(rule)))
  }

  private hasCriticalErrors(result: QualityCheckResult): boolean {
    // TypeScript errors are always critical
    return result.checkers.typescript ? !result.checkers.typescript.success : false
  }

  private extractAllErrors(result: QualityCheckResult): string[] {
    const errors: string[] = []
    Object.values(result.checkers).forEach((checker) => {
      if (checker?.errors) {
        errors.push(...checker.errors)
      }
    })
    return errors
  }
}
