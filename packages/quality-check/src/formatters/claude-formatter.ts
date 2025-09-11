/**
 * ClaudeFormatter - XML-based formatter optimized for Claude's understanding
 * Provides structured output that Claude can easily parse and act upon
 */

import type { Issue } from '../types/issue-types.js'

/**
 * Formats issues in XML structure optimized for Claude
 */
export class ClaudeFormatter {
  /**
   * Format issues into XML structure for Claude
   */
  format(issues: Issue[]): string {
    if (!issues || issues.length === 0) {
      return ''
    }

    const groupedByEngine = this.groupByEngine(issues)
    const sections: string[] = ['<quality-check-result>']

    // TypeScript section
    if (groupedByEngine.typescript.length > 0) {
      sections.push(this.formatEngineSection('typescript', groupedByEngine.typescript))
    }

    // ESLint section
    if (groupedByEngine.eslint.length > 0) {
      sections.push(this.formatEngineSection('eslint', groupedByEngine.eslint))
    }

    // Prettier section
    if (groupedByEngine.prettier.length > 0) {
      sections.push(this.formatEngineSection('prettier', groupedByEngine.prettier))
    }

    sections.push('</quality-check-result>')
    return sections.join('\n')
  }

  /**
   * Format issues for a specific engine
   */
  private formatEngineSection(engine: string, issues: Issue[]): string {
    const lines: string[] = [`  <${engine}>`]

    for (const issue of issues) {
      lines.push(this.formatIssue(issue))
    }

    lines.push(`  </${engine}>`)
    return lines.join('\n')
  }

  /**
   * Format a single issue
   */
  private formatIssue(issue: Issue): string {
    const attrs: string[] = []

    // Required attributes
    attrs.push(`file="${this.escapeXml(issue.file)}"`)
    attrs.push(`line="${issue.line}"`)
    attrs.push(`column="${issue.col}"`)

    // Optional attributes
    if (issue.ruleId) {
      attrs.push(`code="${this.escapeXml(issue.ruleId)}"`)
    }

    if (issue.endLine) {
      attrs.push(`endLine="${issue.endLine}"`)
    }

    if (issue.endCol) {
      attrs.push(`endColumn="${issue.endCol}"`)
    }

    const tag =
      issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info'

    const message = this.escapeXml(issue.message)
    const suggestion = issue.suggestion
      ? `\n      SUGGESTION: ${this.escapeXml(issue.suggestion)}`
      : ''

    return `    <${tag} ${attrs.join(' ')}>\n      ${message}${suggestion}\n    </${tag}>`
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

  /**
   * Format issues with summary mode
   */
  formatSummary(issues: Issue[]): string {
    if (!issues || issues.length === 0) {
      return 'No quality issues found.'
    }

    const grouped = this.groupByEngine(issues)
    const summary: string[] = []

    // Use the format expected by tests - engine-specific error counts
    if (grouped.typescript.length > 0) {
      const errors = grouped.typescript.filter((i) => i.severity === 'error').length
      if (errors > 0) {
        summary.push(`${errors} TypeScript error${errors === 1 ? '' : 's'}`)
      }
    }
    
    if (grouped.eslint.length > 0) {
      const errors = grouped.eslint.filter((i) => i.severity === 'error').length
      if (errors > 0) {
        summary.push(`${errors} ESLint error${errors === 1 ? '' : 's'}`)
      }
    }
    
    if (grouped.prettier.length > 0) {
      const errors = grouped.prettier.filter((i) => i.severity === 'error').length
      if (errors > 0) {
        summary.push(`${errors} Prettier error${errors === 1 ? '' : 's'}`)
      }
    }

    return summary.join(', ')
  }

  /**
   * Format issues with detailed mode (human-readable)
   */
  formatDetailed(issues: Issue[]): string {
    if (!issues || issues.length === 0) {
      return 'No quality issues found.'
    }

    const lines: string[] = []
    const grouped = this.groupByEngine(issues)

    // TypeScript issues
    if (grouped.typescript.length > 0) {
      lines.push('TypeScript Errors:')
      for (const issue of grouped.typescript) {
        lines.push(this.formatDetailedIssue(issue))
      }
      lines.push('')
    }

    // ESLint issues
    if (grouped.eslint.length > 0) {
      lines.push('ESLint Issues:')
      for (const issue of grouped.eslint) {
        lines.push(this.formatDetailedIssue(issue))
      }
      lines.push('')
    }

    // Prettier issues
    if (grouped.prettier.length > 0) {
      lines.push('Prettier Formatting:')
      for (const issue of grouped.prettier) {
        lines.push(this.formatDetailedIssue(issue))
      }
      lines.push('')
    }

    return lines.join('\n').trim()
  }

  /**
   * Format a single issue in detailed mode
   */
  private formatDetailedIssue(issue: Issue): string {
    const location = `${issue.file}:${issue.line}:${issue.col}`
    const code = issue.ruleId ? ` (${issue.ruleId})` : ''
    const severity = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'

    let result = `  ${severity} ${location}${code}: ${issue.message}`

    if (issue.suggestion) {
      result += `\n     💡 ${issue.suggestion}`
    }

    return result
  }
}
