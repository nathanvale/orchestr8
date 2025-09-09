import { ESLint } from 'eslint'
import type { Issue, CheckerResult } from '../types/issue-types.js'
import type { ErrorReport } from '../utils/logger.js'
import { ToolMissingError } from '../core/errors.js'
import type { CancellationToken } from '../core/timeout-manager.js'

/**
 * ESLint engine configuration
 */
export interface ESLintEngineConfig {
  /** Files to lint */
  files: string[]

  /** Whether to fix issues */
  fix?: boolean

  /** Output format */
  format?: 'stylish' | 'json'

  /** Cache directory */
  cacheDir?: string

  /** Working directory */
  cwd?: string

  /** Cancellation token */
  token?: CancellationToken
}

/**
 * ESLint v9 engine with flat config support
 */
export class ESLintEngine {
  private eslint: ESLint | undefined

  /**
   * Check files with ESLint
   */
  async check(config: ESLintEngineConfig): Promise<CheckerResult> {
    const startTime = Date.now()

    try {
      // Check if ESLint is available
      if (!ESLint) {
        throw new ToolMissingError('eslint')
      }

      // Initialize ESLint with v9 flat config
      this.eslint = new ESLint({
        cwd: config.cwd ?? process.cwd(),
        fix: config.fix ?? false,
        cache: true,
        cacheLocation: config.cacheDir ?? '.cache/eslint',
        errorOnUnmatchedPattern: false,
        // Flat config is default in v9
      })

      // Check for cancellation
      if (config.token?.isCancellationRequested) {
        return {
          success: true,
          issues: [],
          duration: Date.now() - startTime,
        }
      }

      // Lint files
      const results = await this.eslint.lintFiles(config.files)

      // Check for cancellation
      if (config.token?.isCancellationRequested) {
        return {
          success: true,
          issues: [],
          duration: Date.now() - startTime,
        }
      }

      // Apply fixes if requested
      if (config.fix) {
        await ESLint.outputFixes(results)
      }

      // Convert results to issues
      const issues = this.convertResults(results)

      const duration = Date.now() - startTime

      return {
        success: issues.length === 0,
        issues,
        duration,
        fixable: this.hasFixableIssues(results),
        fixedCount: this.getFixedCount(results),
      }
    } catch (error) {
      if (error instanceof ToolMissingError) {
        throw error
      }

      const duration = Date.now() - startTime
      return {
        success: false,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            file: config.files[0] ?? process.cwd(),
            line: 1,
            col: 1,
            message: error instanceof Error ? error.message : String(error),
          },
        ],
        duration,
        fixable: false,
      }
    }
  }

  /**
   * Format results using ESLint formatters
   */
  async format(
    results: ESLint.LintResult[],
    format: 'stylish' | 'json' = 'stylish',
  ): Promise<string> {
    if (!this.eslint) {
      // If no eslint instance, return proper format
      if (format === 'json') {
        return JSON.stringify(results)
      }
      return ''
    }

    const formatter = await this.eslint.loadFormatter(format)
    return formatter.format(results)
  }

  /**
   * Convert ESLint results to Issues
   */
  private convertResults(results: ESLint.LintResult[]): Issue[] {
    const issues: Issue[] = []

    for (const result of results) {
      for (const message of result.messages) {
        issues.push({
          engine: 'eslint',
          severity: message.severity === 2 ? 'error' : 'warning',
          ruleId: message.ruleId ?? undefined,
          file: result.filePath,
          line: message.line,
          col: message.column,
          endLine: message.endLine ?? undefined,
          endCol: message.endColumn ?? undefined,
          message: message.message,
          suggestion: message.suggestions?.[0]?.desc,
        })
      }
    }

    return issues
  }

  /**
   * Check if results have fixable issues
   */
  private hasFixableIssues(results: ESLint.LintResult[]): boolean {
    return results.some((result) => result.fixableErrorCount > 0 || result.fixableWarningCount > 0)
  }

  /**
   * Get count of fixed issues
   */
  private getFixedCount(results: ESLint.LintResult[]): number {
    // ESLint doesn't directly provide fixed count, but we can estimate
    // from the difference between total and remaining fixable issues
    let fixedCount = 0
    for (const result of results) {
      if (result.output) {
        // If output exists, some fixes were applied
        fixedCount += result.fixableErrorCount + result.fixableWarningCount
      }
    }
    return fixedCount
  }

  /**
   * Check if ESLint is configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      if (!this.eslint) {
        this.eslint = new ESLint({
          cwd: process.cwd(),
          errorOnUnmatchedPattern: false,
        })
      }

      // Try to calculate config for a sample file
      const config = await this.eslint.calculateConfigForFile('test.js')
      return config !== null
    } catch {
      return false
    }
  }

  /**
   * Get ESLint version
   */
  static getVersion(): string | undefined {
    try {
      return ESLint.version
    } catch {
      return undefined
    }
  }

  /**
   * Convert ESLint results to ErrorReport format
   */
  async generateErrorReport(results: ESLint.LintResult[]): Promise<ErrorReport> {
    const issues = this.convertResults(results)
    const totalErrors = issues.filter((i) => i.severity === 'error').length
    const totalWarnings = issues.filter((i) => i.severity === 'warning').length
    const filesAffected = new Set(issues.map((i) => i.file)).size

    // Get raw JSON output for debugging
    const rawOutput = await this.format(results, 'json')

    return {
      timestamp: new Date().toISOString(),
      tool: 'eslint',
      status: totalErrors > 0 ? 'error' : totalWarnings > 0 ? 'warning' : 'success',
      summary: {
        totalErrors,
        totalWarnings,
        filesAffected,
      },
      details: {
        files: this.groupIssuesByFile(issues),
      },
      raw: rawOutput,
    }
  }

  /**
   * Group issues by file for ErrorReport format
   */
  private groupIssuesByFile(issues: Issue[]): Array<{
    path: string
    errors: Array<{
      line: number
      column: number
      message: string
      ruleId?: string
      severity: 'error' | 'warning'
    }>
  }> {
    const fileGroups: Record<string, Issue[]> = {}

    // Filter out 'info' severity issues since ErrorReport only accepts 'error' | 'warning'
    const reportableIssues = issues.filter((issue) => issue.severity !== 'info')

    for (const issue of reportableIssues) {
      if (!fileGroups[issue.file]) {
        fileGroups[issue.file] = []
      }
      fileGroups[issue.file].push(issue)
    }

    return Object.entries(fileGroups).map(([path, fileIssues]) => ({
      path,
      errors: fileIssues.map((issue) => ({
        line: issue.line,
        column: issue.col,
        message: issue.message,
        ruleId: issue.ruleId,
        severity: issue.severity as 'error' | 'warning', // Safe cast since we filtered out 'info'
      })),
    }))
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.eslint = undefined
  }
}
