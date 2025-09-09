/**
 * OutputFormatter Service for ANSI Console Output
 * Provides colored and formatted console output for quality check results
 */

import pc from 'picocolors'
import type { ErrorReport } from '../utils/logger'

// Configuration options for output formatting
export interface OutputOptions {
  silent?: boolean
  colored?: boolean
}

/**
 * OutputFormatter class for creating ANSI-colored console output
 */
export class OutputFormatter {
  /**
   * Format error summary with colors and structure
   */
  static formatErrorSummary(report: ErrorReport, options?: OutputOptions): string {
    if (options?.silent) return ''
    if (report.status === 'success') return ''

    const { totalErrors, totalWarnings, filesAffected } = report.summary
    const parts: string[] = []

    // Build summary string
    if (totalErrors > 0) {
      const errorText = `${totalErrors} error${totalErrors === 1 ? '' : 's'}`
      parts.push(options?.colored !== false ? pc.red(errorText) : errorText)
    }

    if (totalWarnings > 0) {
      const warningText = `${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}`
      parts.push(options?.colored !== false ? pc.yellow(warningText) : warningText)
    }

    if (filesAffected > 0) {
      const filesText = `${filesAffected} file${filesAffected === 1 ? '' : 's'}`
      parts.push(filesText)
    }

    return parts.join(', ')
  }

  /**
   * Format success summary with green color
   */
  static formatSuccessSummary(report: ErrorReport, options?: OutputOptions): string {
    if (options?.silent) return ''
    if (report.status !== 'success') return ''

    const toolNameMap: Record<string, string> = {
      eslint: 'ESLint',
      typescript: 'TypeScript',
      prettier: 'Prettier',
    }

    const toolName = toolNameMap[report.tool] || report.tool
    const message = `✓ ${toolName}: No issues found`

    return options?.colored !== false ? pc.green(message) : message
  }

  /**
   * Format file list with proper indentation and bullets
   */
  static formatFileList(
    files: string[],
    maxFiles = 10,
    options?: OutputOptions
  ): string {
    if (options?.silent) return ''
    if (files.length === 0) return ''

    const lines: string[] = []
    const filesToShow = files.slice(0, maxFiles)

    filesToShow.forEach((file) => {
      lines.push(`  • ${file}`)
    })

    if (files.length > maxFiles) {
      const remaining = files.length - maxFiles
      lines.push(`  ...and ${remaining} more file${remaining === 1 ? '' : 's'}`)
    }

    return lines.join('\n')
  }

  /**
   * Apply color to text based on severity
   */
  static colorize(
    text: string,
    color: 'red' | 'yellow' | 'green' | 'blue' | 'cyan' | 'magenta' | 'gray',
    options?: OutputOptions
  ): string {
    if (options?.colored === false) return text

    const colorMap = {
      red: pc.red,
      yellow: pc.yellow,
      green: pc.green,
      blue: pc.blue,
      cyan: pc.cyan,
      magenta: pc.magenta,
      gray: pc.gray,
    }

    const colorFn = colorMap[color]
    return colorFn ? colorFn(text) : text
  }

  /**
   * Get complete console summary for an error report
   */
  static getConsoleSummary(report: ErrorReport, options?: OutputOptions): string {
    if (options?.silent) return ''

    const toolNameMap: Record<string, string> = {
      eslint: 'ESLint',
      typescript: 'TypeScript',
      prettier: 'Prettier',
    }

    const toolName = toolNameMap[report.tool] || report.tool

    if (report.status === 'success') {
      return this.formatSuccessSummary(report, options)
    }

    const lines: string[] = []

    // Add header - TypeScript uses "Compilation" instead of "Check"
    const header = toolName === 'TypeScript' 
      ? `${toolName} Compilation Failed`
      : `${toolName} Check Failed`
    lines.push(options?.colored !== false ? pc.red(pc.bold(header)) : header)

    // Add summary stats
    const { totalErrors, totalWarnings, filesAffected } = report.summary

    if (totalErrors > 0) {
      const errorLine = `  ${totalErrors} error${totalErrors === 1 ? '' : 's'}`
      lines.push(options?.colored !== false ? pc.red(errorLine) : errorLine)
    }

    if (totalWarnings > 0) {
      const warningLine = `  ${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}`
      lines.push(options?.colored !== false ? pc.yellow(warningLine) : warningLine)
    }

    const filesLine = `  ${filesAffected} file${filesAffected === 1 ? '' : 's'} affected`
    lines.push(filesLine)

    return lines.join('\n')
  }

  /**
   * Format a single error detail for console output
   */
  static formatErrorDetail(
    file: string,
    line: number,
    column: number,
    message: string,
    severity: 'error' | 'warning',
    ruleId?: string,
    options?: OutputOptions
  ): string {
    if (options?.silent) return ''

    const location = `${file}:${line}:${column}`
    const severityColor = severity === 'error' ? 'red' : 'yellow'
    const severityText = options?.colored !== false 
      ? this.colorize(severity, severityColor, options)
      : severity

    const rule = ruleId ? ` (${ruleId})` : ''
    
    return `  ${location} ${severityText}: ${message}${rule}`
  }

  /**
   * Format full error details for multiple files
   */
  static formatFullDetails(report: ErrorReport, options?: OutputOptions): string {
    if (options?.silent) return ''
    if (report.details.files.length === 0) return ''

    const lines: string[] = []

    report.details.files.forEach((file) => {
      if (file.errors.length === 0) return

      lines.push('')
      lines.push(options?.colored !== false ? pc.underline(file.path) : file.path)

      file.errors.forEach((error) => {
        lines.push(
          this.formatErrorDetail(
            file.path,
            error.line,
            error.column,
            error.message,
            error.severity,
            error.ruleId,
            options
          )
        )
      })
    })

    return lines.join('\n')
  }

  /**
   * Create a compact summary suitable for CI/CD environments
   */
  static getCompactSummary(report: ErrorReport): string {
    const { totalErrors, totalWarnings, filesAffected } = report.summary
    const status = report.status === 'success' ? 'PASS' : 'FAIL'
    
    return `[${report.tool.toUpperCase()}] ${status} - Errors: ${totalErrors}, Warnings: ${totalWarnings}, Files: ${filesAffected}`
  }
}