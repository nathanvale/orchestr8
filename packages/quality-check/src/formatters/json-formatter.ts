import type { Issue } from '../types/issue-types'

/**
 * Formats issues as JSON
 */
export class JsonFormatter {
  /**
   * Format issues as JSON
   */
  format(issues: Issue[]): string {
    return JSON.stringify(issues, null, 2)
  }

  /**
   * Format issues as compact JSON (single line)
   */
  formatCompact(issues: Issue[]): string {
    return JSON.stringify(issues)
  }

  /**
   * Format with metadata
   */
  formatWithMetadata(
    issues: Issue[],
    metadata: {
      timestamp?: string
      duration?: number
      fileCount?: number
      correlationId?: string
    },
  ): string {
    const result = {
      ...metadata,
      issueCount: issues.length,
      errorCount: issues.filter((i) => i.severity === 'error').length,
      warningCount: issues.filter((i) => i.severity === 'warning').length,
      infoCount: issues.filter((i) => i.severity === 'info').length,
      issues,
    }

    return JSON.stringify(result, null, 2)
  }
}
