/**
 * IssueReporter - Formats check results for different consumers
 * ~80 lines total
 */

import type { QualityCheckResult, CheckerResult } from '../types.js'

export class IssueReporter {
  /**
   * Format results for CLI output with colors and symbols
   */
  formatForCLI(result: QualityCheckResult): string {
    const lines: string[] = []

    if (result.success) {
      lines.push('✅ All quality checks passed')
      return lines.join('\n')
    }

    lines.push('❌ Quality check failed:')
    lines.push('')

    // ESLint results
    if (result.checkers.eslint && !result.checkers.eslint.success) {
      lines.push('📝 ESLint issues:')
      lines.push(this.formatCheckerErrors(result.checkers.eslint))
    }

    // Prettier results
    if (result.checkers.prettier && !result.checkers.prettier.success) {
      lines.push('🎨 Prettier issues:')
      lines.push(this.formatCheckerErrors(result.checkers.prettier))
    }

    // TypeScript results
    if (result.checkers.typescript && !result.checkers.typescript.success) {
      lines.push('🔍 TypeScript issues:')
      lines.push(this.formatCheckerErrors(result.checkers.typescript))
    }

    return lines.join('\n')
  }

  /**
   * Format results as JSON for programmatic consumption
   */
  formatForJSON(result: QualityCheckResult): string {
    return JSON.stringify(result, null, 2)
  }

  /**
   * Format results for Claude hook with minimal output
   */
  formatForClaude(result: QualityCheckResult): string {
    if (result.success) {
      return '' // Silent success
    }

    // Only show unfixable errors
    const unfixableErrors = this.getUnfixableErrors(result)
    if (unfixableErrors.length === 0) {
      return '' // All errors were fixed
    }

    return `Quality issues require attention:\n${unfixableErrors.join('\n')}`
  }

  /**
   * Get appropriate exit code based on results
   */
  getExitCode(result: QualityCheckResult): number {
    if (result.success) return 0

    const failed = []
    if (result.checkers.eslint && !result.checkers.eslint.success) failed.push('eslint')
    if (result.checkers.prettier && !result.checkers.prettier.success) failed.push('prettier')
    if (result.checkers.typescript && !result.checkers.typescript.success) failed.push('typescript')

    if (failed.length === 1) {
      return failed[0] === 'eslint' ? 2 : failed[0] === 'prettier' ? 3 : 4
    }
    return failed.length > 1 ? 5 : 1
  }

  private formatCheckerErrors(checker: CheckerResult): string {
    return checker.errors?.join('\n  ') || '  Unknown error'
  }

  private getUnfixableErrors(result: QualityCheckResult): string[] {
    const errors: string[] = []
    // Extract only critical unfixable errors
    Object.values(result.checkers).forEach((checker) => {
      if (checker && !checker.success && checker.errors) {
        errors.push(...checker.errors.filter((e) => !e.includes('fixable')))
      }
    })
    return errors
  }
}
