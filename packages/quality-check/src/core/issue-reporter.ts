/**
 * IssueReporter - Formats check results for different consumers
 * Enhanced with error parsing and facade-specific formatting
 */

import type { QualityCheckResult, CheckerResult, ParsedError } from '../types.js'
import { ErrorParser } from './error-parser.js'

export interface FormatOptions {
  verbose?: boolean
  summary?: boolean
  maxErrors?: number
}

export class IssueReporter {
  private errorParser = new ErrorParser()
  /**
   * Format results for CLI output with colors and symbols
   */
  formatForCLI(result: QualityCheckResult, options: FormatOptions = {}): string {
    const lines: string[] = []

    if (result.success) {
      lines.push('✅ All quality checks passed')
      return lines.join('\n')
    }

    lines.push('❌ Quality check failed:')
    lines.push('')

    // Parse errors if needed for detailed output
    const parsedErrors = this.lazyParseErrors(result, options)

    // ESLint results
    if (result.checkers.eslint && !result.checkers.eslint.success) {
      lines.push('📝 ESLint issues:')
      const eslintErrors = this.filterErrors(parsedErrors, 'eslint', options.maxErrors)
      if (options.verbose && eslintErrors.length > 0) {
        lines.push(this.formatDetailedErrors(eslintErrors))
      } else {
        lines.push(this.formatCheckerErrors(result.checkers.eslint, options.maxErrors))
      }
    }

    // Prettier results
    if (result.checkers.prettier && !result.checkers.prettier.success) {
      lines.push('🎨 Prettier issues:')
      lines.push(this.formatCheckerErrors(result.checkers.prettier, options.maxErrors))
    }

    // TypeScript results
    if (result.checkers.typescript && !result.checkers.typescript.success) {
      lines.push('🔍 TypeScript issues:')
      const tsErrors = this.filterErrors(parsedErrors, 'typescript', options.maxErrors)
      if (options.verbose && tsErrors.length > 0) {
        lines.push(this.formatDetailedErrors(tsErrors))
      } else {
        lines.push(this.formatCheckerErrors(result.checkers.typescript, options.maxErrors))
      }
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
  formatForClaude(result: QualityCheckResult, options: FormatOptions = {}): string {
    if (result.success) {
      return '' // Silent success
    }

    // Parse errors to determine fixability
    const parsedErrors = this.lazyParseErrors(result, options)
    const { fixable, unfixable } = this.errorParser.filterByFixability(parsedErrors)

    // If summary is requested and we have raw errors (but couldn't parse them)
    if (options.summary && unfixable.length === 0 && this.hasRawErrors(result)) {
      const counts = this.countRawErrorsByType(result)
      const summary = Object.entries(counts)
        .map(([type, count]) => `${count} ${type} errors`)
        .join(', ')
      return `Quality issues: ${summary}`
    }

    // Only show unfixable errors
    if (unfixable.length === 0) {
      return '' // All errors were auto-fixed or fixable
    }

    if (options.summary) {
      const counts = this.countErrorsByType(unfixable)
      const summary = Object.entries(counts)
        .map(([type, count]) => `${count} ${type} errors`)
        .join(', ')
      return `Quality issues: ${summary}`
    }

    const errorMessages = unfixable
      .slice(0, options.maxErrors || 10)
      .map((err) => this.errorParser.formatError(err))

    return `Quality issues require attention:\n${errorMessages.join('\n')}`
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

  private formatCheckerErrors(checker: CheckerResult, maxErrors?: number): string {
    const errors = checker.errors || []
    const displayErrors = maxErrors ? errors.slice(0, maxErrors) : errors
    const formatted = displayErrors.join('\n  ')

    if (maxErrors && errors.length > maxErrors) {
      return `${formatted}\n  ... and ${errors.length - maxErrors} more`
    }

    return formatted || '  Unknown error'
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

  /**
   * Lazily parse errors only when needed for performance
   */
  private lazyParseErrors(result: QualityCheckResult, options: FormatOptions): ParsedError[] {
    // Return cached parsed errors if available
    if (result.parsedErrors) {
      return result.parsedErrors
    }

    // Skip parsing if not needed
    if (!options.verbose && !options.summary) {
      return []
    }

    const allErrors: ParsedError[] = []

    // Parse TypeScript errors
    if (result.checkers.typescript?.errors) {
      const tsErrors = result.checkers.typescript.errors.join('\n')
      const parsed = this.errorParser.parseTypeScriptErrors(tsErrors, {
        maxErrors: options.maxErrors,
      })
      allErrors.push(...parsed)
    }

    // Parse ESLint errors if available in JSON format
    // For now, we'll parse from string format
    if (result.checkers.eslint?.errors) {
      result.checkers.eslint.errors.forEach((error) => {
        // Simple parsing from formatted string
        const match = error.match(/^(.+?):(\d+):(\d+) - (.+) \((.+)\)$/)
        if (match) {
          allErrors.push({
            file: match[1],
            line: parseInt(match[2], 10),
            column: parseInt(match[3], 10),
            message: match[4],
            code: match[5],
            severity: 'error',
            source: 'eslint',
            fixable: this.errorParser.categorizeError({
              code: match[5],
              source: 'eslint',
            } as any).fixable,
          })
        }
      })
    }

    // Cache the parsed errors
    ;(result as any).parsedErrors = allErrors
    return allErrors
  }

  /**
   * Filter errors by source tool
   */
  private filterErrors(errors: ParsedError[], source: string, maxErrors?: number): ParsedError[] {
    const filtered = errors.filter((e) => e.source === source)
    return maxErrors ? filtered.slice(0, maxErrors) : filtered
  }

  /**
   * Format detailed error information
   */
  private formatDetailedErrors(errors: ParsedError[]): string {
    return errors
      .map((err) => {
        const location = `  ${err.file}:${err.line}:${err.column}`
        const details = `    ${err.message} (${err.code})`
        const fixable = err.fixable ? '    💡 Auto-fixable' : ''
        return [location, details, fixable].filter(Boolean).join('\n')
      })
      .join('\n')
  }

  /**
   * Count errors by type for summary
   */
  private countErrorsByType(errors: ParsedError[]): Record<string, number> {
    const counts: Record<string, number> = {}
    errors.forEach((err) => {
      const key =
        err.source === 'typescript' ? 'TypeScript' : err.source === 'eslint' ? 'ESLint' : 'Prettier'
      counts[key] = (counts[key] || 0) + 1
    })
    return counts
  }

  /**
   * Check if there are raw errors in the result
   */
  private hasRawErrors(result: QualityCheckResult): boolean {
    return Object.values(result.checkers).some(
      (checker) => checker && !checker.success && checker.errors && checker.errors.length > 0,
    )
  }

  /**
   * Count raw errors by type when parsing fails
   */
  private countRawErrorsByType(result: QualityCheckResult): Record<string, number> {
    const counts: Record<string, number> = {}

    if (result.checkers.typescript?.errors) {
      counts['TypeScript'] = result.checkers.typescript.errors.length
    }
    if (result.checkers.eslint?.errors) {
      counts['ESLint'] = result.checkers.eslint.errors.length
    }
    if (result.checkers.prettier?.errors) {
      counts['Prettier'] = result.checkers.prettier.errors.length
    }

    return counts
  }
}
