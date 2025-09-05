/**
 * IssueReporter - Formats check results for different consumers
 * Enhanced with error parsing and facade-specific formatting
 */

import type { QualityCheckResult, CheckerResult, ParsedError, Issue } from '../types.js'
import { ExitCodes } from './exit-codes.js'
import { ErrorParser } from './error-parser.js'
import { Autopilot } from '../adapters/autopilot.js'

export interface FormatOptions {
  verbose?: boolean
  summary?: boolean
  maxErrors?: number
}

export class IssueReporter {
  private errorParser = new ErrorParser()
  private autopilot = new Autopilot()
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
   * Format results for Claude hook with comprehensive output
   * This output goes to stderr with exit code 2, so Claude will see it
   */
  formatForClaude(result: QualityCheckResult, options: FormatOptions = {}): string {
    if (result.success) {
      return '' // Silent success
    }

    // If summary is requested, provide minimal output
    if (options.summary) {
      const errorCount = this.getTotalErrorCount(result)
      if (errorCount > 0) {
        // Find which checker has the most errors
        const checkerNames = []
        if (result.checkers.typescript?.errors?.length) {
          checkerNames.push(`${result.checkers.typescript.errors.length} TypeScript errors`)
        }
        if (result.checkers.eslint?.errors?.length) {
          checkerNames.push(`${result.checkers.eslint.errors.length} ESLint errors`)
        }
        if (result.checkers.prettier?.errors?.length) {
          checkerNames.push(`${result.checkers.prettier.errors.length} Prettier errors`)
        }
        return checkerNames.join(', ')
      }
    }

    // Convert errors to Issues for Autopilot classification
    const issues = this.convertToIssues(result)

    // Use Autopilot to classify which errors are fixable
    const classification = this.autopilot.decide({
      filePath: 'unknown',
      issues,
      hasErrors: true,
      hasWarnings: false,
      fixable: true,
    })

    // If all issues are auto-fixable, return empty string
    if (classification.action === 'FIX_SILENTLY') {
      return ''
    }

    // Only show unfixable errors to Claude
    const unfixableIssues = classification.issues || []
    if (unfixableIssues.length === 0 && classification.action !== 'REPORT_ONLY') {
      return '' // All errors are fixable
    }

    const lines: string[] = []
    lines.push('Quality issues require attention:')
    lines.push('')

    // Filter and show only unfixable issues
    if (result.checkers.eslint && !result.checkers.eslint.success) {
      const unfixableEslintErrors = this.filterUnfixableErrors(
        result.checkers.eslint,
        unfixableIssues,
      )
      if (unfixableEslintErrors.length > 0) {
        lines.push('📝 ESLint issues:')
        lines.push(unfixableEslintErrors.join('\n  '))
      }
    }

    if (result.checkers.prettier && !result.checkers.prettier.success) {
      const unfixablePrettierErrors = this.filterUnfixableErrors(
        result.checkers.prettier,
        unfixableIssues,
      )
      if (unfixablePrettierErrors.length > 0) {
        lines.push('🎨 Prettier issues:')
        lines.push(unfixablePrettierErrors.join('\n  '))
      }
    }

    if (result.checkers.typescript && !result.checkers.typescript.success) {
      const unfixableTypeScriptErrors = this.filterUnfixableErrors(
        result.checkers.typescript,
        unfixableIssues,
      )
      if (unfixableTypeScriptErrors.length > 0) {
        lines.push('🔍 TypeScript issues:')
        lines.push(unfixableTypeScriptErrors.join('\n  '))
      }
    }

    return lines.join('\n')
  }

  /**
   * Get appropriate exit code based on results
   */
  getExitCode(result: QualityCheckResult): number {
    // Success - all checks passed
    if (result.success) return ExitCodes.SUCCESS

    // Any quality issues should return QUALITY_ISSUES (2)
    // We don't distinguish between different types for exit codes
    // as Claude Code only needs to know "there are issues to fix"
    const hasIssues =
      (result.checkers.eslint && !result.checkers.eslint.success) ||
      (result.checkers.prettier && !result.checkers.prettier.success) ||
      (result.checkers.typescript && !result.checkers.typescript.success)

    return hasIssues ? ExitCodes.QUALITY_ISSUES : ExitCodes.SUCCESS
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
              file: '',
              line: 0,
              column: 0,
              message: '',
              severity: 'error',
              fixable: false,
            }).fixable,
          })
        }
      })
    }

    // Cache the parsed errors
    // Type assertion to add parsedErrors to result
    const mutableResult = result as QualityCheckResult & { parsedErrors?: ParsedError[] }
    mutableResult.parsedErrors = allErrors
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
   * Get total error count across all checkers
   */
  private getTotalErrorCount(result: QualityCheckResult): number {
    let count = 0
    if (result.checkers.typescript?.errors) {
      count += result.checkers.typescript.errors.length
    }
    if (result.checkers.eslint?.errors) {
      count += result.checkers.eslint.errors.length
    }
    if (result.checkers.prettier?.errors) {
      count += result.checkers.prettier.errors.length
    }
    return count
  }

  /**
   * Convert QualityCheckResult errors to Issues for Autopilot
   */
  private convertToIssues(result: QualityCheckResult): Issue[] {
    const issues: Issue[] = []

    // Convert ESLint errors
    if (result.checkers.eslint?.errors) {
      result.checkers.eslint.errors.forEach((error) => {
        const match = error.match(/^(.+?):(\d+):(\d+) - (.+) \((.+)\)$/)
        if (match) {
          issues.push({
            rule: match[5],
            fixable: result.checkers.eslint?.fixable || false,
            file: match[1],
            message: `${match[1]}:${match[2]}:${match[3]} - ${match[4]}`,
          })
        }
      })
    }

    // Convert Prettier errors
    if (result.checkers.prettier?.errors) {
      result.checkers.prettier.errors.forEach(() => {
        issues.push({
          rule: 'prettier/prettier',
          fixable: true,
          file: 'unknown',
          message: 'File needs formatting',
        })
      })
    }

    // Convert TypeScript errors
    if (result.checkers.typescript?.errors) {
      result.checkers.typescript.errors.forEach((error) => {
        // Try to parse TypeScript error format
        const match =
          error.match(/^(.+?):(\d+):(\d+) - (.+) \((TS\d+)\)$/) ||
          error.match(/^(.+)\((\d+),(\d+)\): .+ (TS\d+): (.+)$/)
        if (match) {
          const code = match[5] || match[4]
          issues.push({
            rule: code,
            fixable: false, // TypeScript errors are generally not auto-fixable
            file: match[1],
            message: error,
          })
        } else {
          // Fallback for unparseable TypeScript errors
          issues.push({
            rule: 'typescript-error',
            fixable: false,
            file: 'unknown',
            message: error,
          })
        }
      })
    }

    return issues
  }

  /**
   * Filter checker errors to only show unfixable ones
   */
  private filterUnfixableErrors(checker: CheckerResult, unfixableIssues: Issue[]): string[] {
    if (!checker.errors) return []

    // If this checker is marked as fixable (like Prettier), don't show any errors
    if (checker.fixable) {
      return []
    }

    // Filter errors to only show those that match unfixable issues
    return checker.errors.filter((error) => {
      // Check if this error corresponds to an unfixable issue
      return unfixableIssues.some((issue) => {
        // Check if the error message contains the issue's message or rule
        return (
          (issue.message && error.includes(issue.message.split(' - ')[1])) ||
          error.includes(issue.rule)
        )
      })
    })
  }
}
