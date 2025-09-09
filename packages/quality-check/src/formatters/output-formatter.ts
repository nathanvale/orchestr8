/**
 * Unified error output formatting pipeline
 * Centralizes all output formatting logic with configurable modes
 */

import type { Issue } from '../types/issue-types.js'
import { ClaudeFormatter } from './claude-formatter.js'

export enum OutputMode {
  XML = 'xml',
  PLAIN_TEXT = 'plain',
  JSON = 'json',
}

export interface FormatOptions {
  mode?: OutputMode
  context?: string
  includeSummary?: boolean
  verbose?: boolean
  groupByFile?: boolean
}

/**
 * Centralized output formatter for all quality check results
 */
export class OutputFormatter {
  private claudeFormatter: ClaudeFormatter

  constructor() {
    this.claudeFormatter = new ClaudeFormatter()
  }

  /**
   * Central method to format issues for output
   */
  formatIssuesForOutput(issues: Issue[], options: FormatOptions = {}): string {
    if (!issues || issues.length === 0) {
      return ''
    }

    const mode = this.getOutputMode(options)

    switch (mode) {
      case OutputMode.XML:
        return this.formatXML(issues, options)
      case OutputMode.JSON:
        return this.formatJSON(issues, options)
      case OutputMode.PLAIN_TEXT:
      default:
        return this.formatPlainText(issues, options)
    }
  }

  /**
   * Format issues as XML
   */
  private formatXML(issues: Issue[], options: FormatOptions): string {
    let output = this.claudeFormatter.format(issues)

    // Add context if provided
    if (options.context && output) {
      const lines = output.split('\n')
      lines.splice(1, 0, `  <context>${this.escapeXml(options.context)}</context>`)
      output = lines.join('\n')
    }

    return output
  }

  /**
   * Format issues as JSON
   */
  private formatJSON(issues: Issue[], options: FormatOptions): string {
    interface JSONOutput {
      issues: Array<{
        engine: string
        severity: string
        ruleId?: string
        file: string
        line: number
        column: number
        endLine?: number
        endColumn?: number
        message: string
        suggestion?: string
      }>
      context?: string
      summary?: {
        total: number
        byEngine: {
          typescript: number
          eslint: number
          prettier: number
        }
        bySeverity: {
          error: number
          warning: number
          info: number
        }
      }
    }

    const result: JSONOutput = {
      issues: issues.map((issue) => ({
        engine: issue.engine,
        severity: issue.severity,
        ruleId: issue.ruleId,
        file: issue.file,
        line: issue.line,
        column: issue.col,
        endLine: issue.endLine,
        endColumn: issue.endCol,
        message: issue.message,
        suggestion: issue.suggestion,
      })),
    }

    if (options.context) {
      result.context = options.context
    }

    if (options.includeSummary) {
      result.summary = this.generateSummary(issues)
    }

    return JSON.stringify(result, null, 2)
  }

  /**
   * Format issues as plain text
   */
  private formatPlainText(issues: Issue[], options: FormatOptions): string {
    const lines: string[] = []

    if (options.includeSummary) {
      lines.push(this.formatSummaryOnly(issues))
      lines.push('')
    }

    if (options.groupByFile) {
      return this.formatGroupedByFile(issues, options)
    }

    if (options.verbose) {
      // Use formatDetailed for verbose output which includes suggestions
      const detailed = this.claudeFormatter.formatDetailed(issues)
      // Replace the Claude formatter's suggestion format to use SUGGESTION:
      lines.push(detailed.replace(/💡 /g, '💡 SUGGESTION: '))
    } else {
      // Group by engine for concise output
      const grouped = this.groupByEngine(issues)

      if (grouped.typescript.length > 0) {
        lines.push('TypeScript Errors:')
        for (const issue of grouped.typescript) {
          lines.push(this.formatConciseIssue(issue))
        }
        lines.push('')
      }

      if (grouped.eslint.length > 0) {
        lines.push('ESLint Issues:')
        for (const issue of grouped.eslint) {
          lines.push(this.formatConciseIssue(issue))
        }
        lines.push('')
      }

      if (grouped.prettier.length > 0) {
        lines.push('Prettier Formatting:')
        for (const issue of grouped.prettier) {
          lines.push(this.formatConciseIssue(issue))
        }
        lines.push('')
      }
    }

    return lines.join('\n').trim()
  }

  /**
   * Format issues grouped by file
   */
  private formatGroupedByFile(issues: Issue[], options: FormatOptions): string {
    const byFile: Record<string, Issue[]> = {}

    for (const issue of issues) {
      if (!byFile[issue.file]) {
        byFile[issue.file] = []
      }
      byFile[issue.file].push(issue)
    }

    const lines: string[] = []

    for (const [file, fileIssues] of Object.entries(byFile)) {
      lines.push(`${file}:`)
      for (const issue of fileIssues) {
        if (options.verbose) {
          lines.push(this.formatDetailedIssue(issue))
        } else {
          lines.push(this.formatConciseIssue(issue))
        }
      }
      lines.push('')
    }

    return lines.join('\n').trim()
  }

  /**
   * Format a single issue concisely
   */
  private formatConciseIssue(issue: Issue): string {
    const location = `${issue.file}:${issue.line}:${issue.col}`
    const code = issue.ruleId ? ` (${issue.ruleId})` : ''
    return `  ${location}${code}: ${issue.message}`
  }

  /**
   * Format a single issue with details
   */
  private formatDetailedIssue(issue: Issue): string {
    const location = `${issue.file}:${issue.line}:${issue.col}`
    const code = issue.ruleId ? ` (${issue.ruleId})` : ''
    const severity = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'

    let result = `  ${severity} ${location}${code}: ${issue.message}`

    if (issue.suggestion) {
      result += `\n     💡 SUGGESTION: ${issue.suggestion}`
    }

    return result
  }

  /**
   * Get the output mode from options or environment
   */
  getOutputMode(options: FormatOptions = {}): OutputMode {
    if (options.mode) {
      return options.mode
    }

    const envMode = process.env.QUALITY_CHECK_OUTPUT_MODE?.toLowerCase()

    switch (envMode) {
      case 'json':
        return OutputMode.JSON
      case 'plain':
      case 'text':
        return OutputMode.PLAIN_TEXT
      case 'xml':
      default:
        return OutputMode.XML
    }
  }

  /**
   * Format for blocking output (used by Claude hook)
   */
  formatForBlockingOutput(issues: Issue[], options: FormatOptions = {}): string {
    const formattedIssues = this.formatIssuesForOutput(issues, {
      ...options,
      mode: options.mode || OutputMode.XML,
    })

    // In silent mode, only return the XML without the aggressive blocking text
    if (process.env.CLAUDE_HOOK_SILENT_OUTPUT === 'true') {
      return formattedIssues
    }

    const lines: string[] = []
    lines.push('')
    lines.push('🚫 BLOCKING: You MUST employ the quality check fixer IMMEDIATELY:')
    lines.push('')
    lines.push(formattedIssues)
    lines.push('')
    lines.push('❌ DO NOT PROCEED until these issues are resolved.')
    lines.push('')

    if (options.context) {
      lines.push(`CONTEXT: ${options.context}`)
      lines.push('')
    }

    lines.push('Employ the quality check fixer IMMEDIATELY to address this issue.')
    lines.push('')

    return lines.join('\n')
  }

  /**
   * Format summary only
   */
  formatSummaryOnly(issues: Issue[]): string {
    if (!issues || issues.length === 0) {
      return 'No quality issues found.'
    }

    const grouped = this.groupByEngine(issues)
    const summary: string[] = []

    // Count by severity
    const errorCount = issues.filter((i) => i.severity === 'error').length
    const warningCount = issues.filter((i) => i.severity === 'warning').length
    const infoCount = issues.filter((i) => i.severity === 'info').length

    summary.push(`Found ${issues.length} issue${issues.length === 1 ? '' : 's'}:`)

    if (errorCount > 0) {
      summary.push(`  - ${errorCount} error${errorCount === 1 ? '' : 's'}`)
    }
    if (warningCount > 0) {
      summary.push(`  - ${warningCount} warning${warningCount === 1 ? '' : 's'}`)
    }
    if (infoCount > 0) {
      summary.push(`  - ${infoCount} info message${infoCount === 1 ? '' : 's'}`)
    }

    summary.push('')
    summary.push('By engine:')

    if (grouped.typescript.length > 0) {
      summary.push(
        `  - TypeScript: ${grouped.typescript.length} issue${grouped.typescript.length === 1 ? '' : 's'}`,
      )
    }
    if (grouped.eslint.length > 0) {
      summary.push(
        `  - ESLint: ${grouped.eslint.length} issue${grouped.eslint.length === 1 ? '' : 's'}`,
      )
    }
    if (grouped.prettier.length > 0) {
      summary.push(
        `  - Prettier: ${grouped.prettier.length} issue${grouped.prettier.length === 1 ? '' : 's'}`,
      )
    }

    return summary.join('\n')
  }

  /**
   * Validate output format
   */
  validateOutput(output: string, mode: OutputMode): boolean {
    if (!output) {
      return true // Empty output is valid
    }

    switch (mode) {
      case OutputMode.JSON: {
        try {
          JSON.parse(output)
          return true
        } catch {
          return false
        }
      }

      case OutputMode.XML: {
        // Basic XML validation - check for matching open/close tags
        try {
          // Simple check: must start with < and end with >
          if (!output.trim().startsWith('<') || !output.trim().endsWith('>')) {
            return false
          }

          // Extract tag names from opening and closing tags, excluding self-closing tags
          const tagMatches = output.match(/<\/?([^>\s/]+)[^>]*>/g) || []
          const stack: string[] = []

          for (const match of tagMatches) {
            // Skip self-closing tags
            if (match.endsWith('/>')) continue

            // Extract tag name
            const tagName = match.match(/<\/?([^>\s]+)/)?.[1]
            if (!tagName) continue

            if (match.startsWith('</')) {
              // Closing tag
              const expected = stack.pop()
              if (expected !== tagName) {
                return false
              }
            } else {
              // Opening tag
              stack.push(tagName)
            }
          }

          return stack.length === 0
        } catch {
          return false
        }
      }

      case OutputMode.PLAIN_TEXT:
      default:
        return true // Plain text is always valid
    }
  }

  /**
   * Generate summary data
   */
  private generateSummary(issues: Issue[]) {
    const grouped = this.groupByEngine(issues)

    return {
      total: issues.length,
      byEngine: {
        typescript: grouped.typescript.length,
        eslint: grouped.eslint.length,
        prettier: grouped.prettier.length,
      },
      bySeverity: {
        error: issues.filter((i) => i.severity === 'error').length,
        warning: issues.filter((i) => i.severity === 'warning').length,
        info: issues.filter((i) => i.severity === 'info').length,
      },
    }
  }

  /**
   * Group issues by engine
   */
  private groupByEngine(issues: Issue[]): Record<string, Issue[]> {
    const grouped: Record<string, Issue[]> = {
      typescript: [],
      eslint: [],
      prettier: [],
    }

    for (const issue of issues) {
      if (grouped[issue.engine]) {
        grouped[issue.engine].push(issue)
      }
    }

    return grouped
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
}
