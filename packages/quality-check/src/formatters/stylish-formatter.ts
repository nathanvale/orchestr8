import * as path from 'node:path'
import type { Issue } from '../types/issue-types'

/**
 * Formats issues in ESLint stylish format
 */
export class StylishFormatter {
  /**
   * Format issues in stylish format (ESLint-style output)
   */
  format(issues: Issue[]): string {
    if (issues.length === 0) {
      return ''
    }

    // Group issues by file
    const fileGroups = this.groupByFile(issues)
    const output: string[] = []

    for (const [file, fileIssues] of fileGroups) {
      // Add file header
      output.push('')
      output.push(this.formatFileHeader(file))

      // Sort issues by line and column
      const sortedIssues = fileIssues.sort((a, b) => {
        if (a.line !== b.line) {
          return a.line - b.line
        }
        return a.col - b.col
      })

      // Add issues for this file
      for (const issue of sortedIssues) {
        output.push(this.formatIssue(issue))
      }
    }

    // Add summary
    output.push('')
    output.push(this.formatSummary(issues))

    return output.join('\n')
  }

  /**
   * Group issues by file
   */
  private groupByFile(issues: Issue[]): Map<string, Issue[]> {
    const groups = new Map<string, Issue[]>()

    for (const issue of issues) {
      const file = issue.file
      if (!groups.has(file)) {
        groups.set(file, [])
      }
      groups.get(file)!.push(issue)
    }

    return groups
  }

  /**
   * Format file header
   */
  private formatFileHeader(filePath: string): string {
    const relativePath = path.relative(process.cwd(), filePath)
    return relativePath
  }

  /**
   * Format a single issue
   */
  private formatIssue(issue: Issue): string {
    const location = `${issue.line}:${issue.col}`
    const severity = this.formatSeverity(issue.severity)
    const message = issue.message
    const rule = issue.ruleId ? ` (${issue.ruleId})` : ''
    const engine = ` [${issue.engine}]`

    return `  ${location.padEnd(8)} ${severity} ${message}${rule}${engine}`
  }

  /**
   * Format severity indicator
   */
  private formatSeverity(severity: Issue['severity']): string {
    switch (severity) {
      case 'error':
        return 'error  '
      case 'warning':
        return 'warning'
      case 'info':
        return 'info   '
      default:
        return '       '
    }
  }

  /**
   * Format summary
   */
  private formatSummary(issues: Issue[]): string {
    const errorCount = issues.filter((i) => i.severity === 'error').length
    const warningCount = issues.filter((i) => i.severity === 'warning').length
    const infoCount = issues.filter((i) => i.severity === 'info').length

    const parts: string[] = []

    if (errorCount > 0) {
      parts.push(`${errorCount} error${errorCount === 1 ? '' : 's'}`)
    }
    if (warningCount > 0) {
      parts.push(`${warningCount} warning${warningCount === 1 ? '' : 's'}`)
    }
    if (infoCount > 0) {
      parts.push(`${infoCount} info`)
    }

    if (parts.length === 0) {
      return '✓ No issues found'
    }

    return `✖ ${parts.join(', ')}`
  }
}
