import { ESLint } from 'eslint'
import type { Issue, CheckerResult } from '../types/issue-types.js'
import type { ErrorReport } from '../utils/logger.js'
import { ToolMissingError } from '../core/errors.js'
import type { CancellationToken } from '../core/timeout-manager.js'

/**
 * ESLint fix types for controlling which fixes are applied
 */
export type ESLintFixType = 'directive' | 'problem' | 'suggestion' | 'layout'

/**
 * ESLint fix modes for safety control
 */
export type ESLintFixMode = 'safe' | 'full'

/**
 * ESLint engine configuration
 */
export interface ESLintEngineConfig {
  /** Files to lint */
  files: string[]

  /** Whether to fix issues */
  fix?: boolean

  /** Fix mode - controls which types of fixes are applied */
  fixMode?: ESLintFixMode

  /** Specific fix types to apply (overrides fixMode) */
  fixTypes?: ESLintFixType[]

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
  private lastConfig:
    | {
        cwd: string
        fix: boolean
        fixTypes: ESLintFixType[] | undefined
        cacheLocation: string
      }
    | undefined

  /**
   * Check files with ESLint
   */
  async check(config: ESLintEngineConfig): Promise<CheckerResult> {
    const startTime = Date.now()
    const modifiedFiles: string[] = []

    try {
      // Check if ESLint is available
      if (!ESLint) {
        throw new ToolMissingError('eslint')
      }

      // Prepare configuration
      const eslintConfig = {
        cwd: config.cwd ?? process.cwd(),
        fix: config.fix ?? false,
        fixTypes: this.getFixTypes(config),
        // ESLint expects a file path for cacheLocation, not a directory
        cacheLocation: config.cacheDir ? `${config.cacheDir}/.eslintcache` : '.cache/eslint',
      }

      // Only create new ESLint instance if configuration changed or doesn't exist
      if (
        !this.eslint ||
        !this.lastConfig ||
        this.lastConfig.cwd !== eslintConfig.cwd ||
        this.lastConfig.fix !== eslintConfig.fix ||
        !this.areFixTypesEqual(this.lastConfig.fixTypes, eslintConfig.fixTypes) ||
        this.lastConfig.cacheLocation !== eslintConfig.cacheLocation
      ) {
        try {
          this.eslint = new ESLint({
            ...eslintConfig,
            cache: true,
            errorOnUnmatchedPattern: false,
            // Flat config is default in v9
          })
        } catch (parserError) {
          // Graceful degradation: retry without cache if TypeScript parser service fails
          // This handles cases where projectService initialization fails in edge cases
          // (e.g., circular project references, version mismatches, missing tsconfig)
          if (parserError instanceof Error && parserError.message.includes('fileExists')) {
            try {
              this.eslint = new ESLint({
                ...eslintConfig,
                cache: false, // Disable cache to avoid corrupted cache state
                errorOnUnmatchedPattern: false,
              })
            } catch (fallbackError) {
              // If fallback still fails, mark it and let outer catch handle it
              throw new Error(
                `ESLint initialization failed (parser service fallback also failed): ${
                  fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                }`,
              )
            }
          } else {
            // Re-throw if it's a different kind of error
            throw parserError
          }
        }
        this.lastConfig = eslintConfig
      }

      // Check for cancellation
      if (config.token?.isCancellationRequested) {
        return {
          success: true,
          issues: [],
          duration: Date.now() - startTime,
          modifiedFiles,
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
          modifiedFiles,
        }
      }

      // Apply fixes if requested
      if (config.fix) {
        await ESLint.outputFixes(results)
        // Collect files that were modified during fix operation
        for (const result of results) {
          if (result.output) {
            modifiedFiles.push(result.filePath)
          }
        }

        // Re-lint to get only unfixed issues after applying fixes
        const postFixResults = await this.eslint.lintFiles(config.files)
        // Convert only remaining issues after fixes
        const issues = this.convertResults(postFixResults)

        const duration = Date.now() - startTime

        return {
          success: issues.length === 0,
          issues,
          duration,
          fixable: this.hasFixableIssues(postFixResults),
          fixedCount: this.getFixedCount(results),
          modifiedFiles,
        }
      }

      // Convert results to issues (no fix mode)
      const issues = this.convertResults(results)

      const duration = Date.now() - startTime

      return {
        success: issues.length === 0,
        issues,
        duration,
        fixable: this.hasFixableIssues(results),
        fixedCount: this.getFixedCount(results),
        modifiedFiles,
      }
    } catch (error) {
      if (error instanceof ToolMissingError) {
        throw error
      }

      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Layer 3: Enhanced error handling for parser service failures
      // Provide actionable feedback when TypeScript parser initialization fails
      const isParserServiceError = errorMessage.includes('fileExists')

      return {
        success: false,
        issues: [
          {
            engine: 'eslint',
            severity: isParserServiceError ? 'warning' : 'error',
            file: config.files[0] ?? process.cwd(),
            line: 1,
            col: 1,
            message: isParserServiceError
              ? `TypeScript parser service initialization failed. ESLint will continue with basic linting. If issues persist, try: (1) Ensure all tsconfig.json files are valid, (2) Check for circular project references, (3) Disable type-aware linting for this file with \`projectService: false\` in eslint.config.mjs`
              : errorMessage,
          },
        ],
        duration,
        fixable: false,
        modifiedFiles,
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
   * Clear cache and dispose resources
   */
  clearCache(): void {
    this.eslint = undefined
    this.lastConfig = undefined

    // Force garbage collection of potentially large ESLint objects
    if (global.gc) {
      global.gc()
    }
  }

  /**
   * Dispose of ESLint instance and clear AST caches
   */
  dispose(): void {
    this.clearCache()
  }

  /**
   * Get fix types based on configuration
   */
  private getFixTypes(config: ESLintEngineConfig): ESLintFixType[] | undefined {
    // If specific fixTypes are provided, use them directly
    if (config.fixTypes) {
      return config.fixTypes
    }

    // If fixMode is specified, convert to appropriate fixTypes
    if (config.fixMode === 'safe') {
      // Safe mode: only layout and suggestion fixes (no behavior-changing fixes)
      return ['layout', 'suggestion']
    }

    if (config.fixMode === 'full') {
      // Full mode: all fix types
      return ['directive', 'problem', 'suggestion', 'layout']
    }

    // If neither fixTypes nor fixMode is specified, use ESLint default (all types)
    return undefined
  }

  /**
   * Compare two fixTypes arrays for equality
   */
  private areFixTypesEqual(
    a: ESLintFixType[] | undefined,
    b: ESLintFixType[] | undefined,
  ): boolean {
    // If both are undefined, they are equal
    if (a === undefined && b === undefined) {
      return true
    }

    // If one is undefined and the other is not, they are not equal
    if (a === undefined || b === undefined) {
      return false
    }

    // If arrays have different lengths, they are not equal
    if (a.length !== b.length) {
      return false
    }

    // Sort both arrays and compare element by element
    const sortedA = [...a].sort()
    const sortedB = [...b].sort()

    for (let i = 0; i < sortedA.length; i++) {
      if (sortedA[i] !== sortedB[i]) {
        return false
      }
    }

    return true
  }

  /**
   * Clear ESLint internal cache directory
   */
  async clearCacheDirectory(cacheDir?: string): Promise<void> {
    if (!cacheDir) {
      cacheDir = '.cache/eslint'
    }

    try {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')

      const fullCacheDir = path.resolve(cacheDir)

      // Check if cache directory exists
      try {
        await fs.access(fullCacheDir)
        // Remove cache directory and all its contents
        await fs.rm(fullCacheDir, { recursive: true, force: true })
      } catch {
        // Cache directory doesn't exist, nothing to clean
      }
    } catch (error) {
      // Log error but don't throw - cache clearing is not critical
      console.warn(
        `Failed to clear ESLint cache directory: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Get memory usage statistics for ESLint operations
   */
  getMemoryUsage(): { used: number; total: number } | undefined {
    try {
      const usage = process.memoryUsage()
      return {
        used: usage.heapUsed,
        total: usage.heapTotal,
      }
    } catch {
      return undefined
    }
  }
}
