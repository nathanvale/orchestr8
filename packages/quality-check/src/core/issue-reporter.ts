/**
 * IssueReporter - Formats check results for different consumers
 * Enhanced with error parsing and facade-specific formatting
 */

import type { Issue, QualityCheckResult } from '../types/issue-types.js'
import { ExitCodes } from './exit-codes.js'
import { ClaudeFormatter } from '../formatters/claude-formatter.js'

export interface FormatOptions {
  verbose?: boolean
  summary?: boolean
  maxErrors?: number
}

export class IssueReporter {
  private claudeFormatter = new ClaudeFormatter()
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

    // Group issues by engine
    const issuesByEngine = {
      eslint: result.issues.filter((issue) => issue.engine === 'eslint'),
      prettier: result.issues.filter((issue) => issue.engine === 'prettier'),
      typescript: result.issues.filter((issue) => issue.engine === 'typescript'),
    }

    // ESLint results
    if (issuesByEngine.eslint.length > 0) {
      lines.push('📝 ESLint issues:')
      const displayIssues = options.maxErrors
        ? issuesByEngine.eslint.slice(0, options.maxErrors)
        : issuesByEngine.eslint
      if (options.verbose) {
        lines.push(this.formatDetailedIssues(displayIssues))
      } else {
        lines.push(this.formatIssuesSummary(displayIssues))
      }
      if (options.maxErrors && issuesByEngine.eslint.length > options.maxErrors) {
        lines.push(`  ... and ${issuesByEngine.eslint.length - options.maxErrors} more`)
      }
    }

    // Prettier results
    if (issuesByEngine.prettier.length > 0) {
      lines.push('🎨 Prettier issues:')
      const displayIssues = options.maxErrors
        ? issuesByEngine.prettier.slice(0, options.maxErrors)
        : issuesByEngine.prettier
      if (options.verbose) {
        lines.push(this.formatDetailedIssues(displayIssues))
      } else {
        lines.push(this.formatIssuesSummary(displayIssues))
      }
      if (options.maxErrors && issuesByEngine.prettier.length > options.maxErrors) {
        lines.push(`  ... and ${issuesByEngine.prettier.length - options.maxErrors} more`)
      }
    }

    // TypeScript results
    if (issuesByEngine.typescript.length > 0) {
      lines.push('🔍 TypeScript issues:')
      const displayIssues = options.maxErrors
        ? issuesByEngine.typescript.slice(0, options.maxErrors)
        : issuesByEngine.typescript
      if (options.verbose) {
        lines.push(this.formatDetailedIssues(displayIssues))
      } else {
        lines.push(this.formatIssuesSummary(displayIssues))
      }
      if (options.maxErrors && issuesByEngine.typescript.length > options.maxErrors) {
        lines.push(`  ... and ${issuesByEngine.typescript.length - options.maxErrors} more`)
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
   * Format Issues for Claude using ClaudeFormatter
   */
  formatForClaude(issues: Issue[], options?: FormatOptions): string

  /**
   * Format QualityCheckResult for Claude using ClaudeFormatter
   */
  formatForClaude(result: QualityCheckResult, options?: FormatOptions): string

  /**
   * Format results for Claude hook with comprehensive output
   * This output goes to stderr with exit code 2, so Claude will see it
   */
  formatForClaude(
    resultOrIssues: QualityCheckResult | Issue[],
    options: FormatOptions = {},
  ): string {
    // Handle different input types
    if (Array.isArray(resultOrIssues)) {
      // Issue[] format
      return this.formatIssuesForClaude(resultOrIssues, options)
    } else {
      // QualityCheckResult format
      if (resultOrIssues.success || resultOrIssues.issues.length === 0) {
        return '' // Silent success
      }
      return this.formatIssuesForClaude(resultOrIssues.issues, options)
    }
  }

  /**
   * Format Issues using ClaudeFormatter
   */
  private formatIssuesForClaude(issues: Issue[], options: FormatOptions = {}): string {
    if (!issues || issues.length === 0) {
      return '' // Silent success
    }

    // Handle different output modes
    if (options.summary) {
      return this.claudeFormatter.formatSummary(issues)
    } else if (options.verbose) {
      return this.claudeFormatter.formatDetailed(issues)
    } else {
      // Default XML format for Claude
      return this.claudeFormatter.format(issues)
    }
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
    const hasIssues = result.issues.length > 0

    return hasIssues ? ExitCodes.QUALITY_ISSUES : ExitCodes.SUCCESS
  }

  private formatIssuesSummary(issues: Issue[]): string {
    return (
      issues
        .map((issue) => `  ${issue.file}:${issue.line}:${issue.col} - ${issue.message}${issue.ruleId ? ` (${issue.ruleId})` : ''}`)
        .join('\n') || '  No issues'
    )
  }

  private formatDetailedIssues(issues: Issue[]): string {
    return issues
      .map((issue) => {
        const location = `  ${issue.file}:${issue.line}:${issue.col}`
        const details = `    ${issue.message}${issue.ruleId ? ` (${issue.ruleId})` : ''}`
        return [location, details].join('\n')
      })
      .join('\n')
  }
}
