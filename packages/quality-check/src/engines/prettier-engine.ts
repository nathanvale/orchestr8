import * as prettier from 'prettier'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Issue, CheckerResult } from '../types/issue-types.js'
import { ToolMissingError, FileError } from '../core/errors.js'
import type { CancellationToken } from '../core/timeout-manager.js'
import type { ErrorReport } from '../utils/logger.js'

/**
 * Prettier engine configuration
 */
export interface PrettierEngineConfig {
  /** Files to check/format */
  files: string[]

  /** Whether to write fixes */
  write?: boolean

  /** Working directory */
  cwd?: string

  /** Cancellation token */
  token?: CancellationToken
}

/**
 * Prettier engine with Node API integration
 */
export class PrettierEngine {
  private readonly cwd: string

  constructor(cwd?: string) {
    this.cwd = cwd ?? process.cwd()
  }

  /**
   * Check files with Prettier
   */
  async check(config: PrettierEngineConfig): Promise<CheckerResult> {
    const startTime = Date.now()
    const issues: Issue[] = []
    let fixedCount = 0

    try {
      // Check if Prettier is available
      if (!prettier) {
        throw new ToolMissingError('prettier')
      }

      for (const file of config.files) {
        // Check for cancellation
        if (config.token?.isCancellationRequested) {
          break
        }

        try {
          // Check if file should be ignored
          const fileInfo = await prettier.getFileInfo(file, {
            ignorePath: path.join(this.cwd, '.prettierignore'),
          })

          if (fileInfo.ignored || !fileInfo.inferredParser) {
            // Skip ignored files or files without a parser
            continue
          }

          // Read file content
          const content = await fs.readFile(file, 'utf-8')

          // Resolve Prettier config for this file
          const options = await prettier.resolveConfig(file)

          // Check if file is formatted
          const isFormatted = await prettier.check(content, {
            ...options,
            filepath: file,
          })

          if (!isFormatted) {
            if (config.write) {
              // Format and write the file
              const formatted = await prettier.format(content, {
                ...options,
                filepath: file,
              })

              await this.safeWriteFile(file, formatted)
              fixedCount++
            } else {
              // Add issue for unformatted file
              issues.push({
                engine: 'prettier',
                severity: 'warning',
                ruleId: 'format',
                file,
                line: 1,
                col: 1,
                message: 'File is not formatted with Prettier',
                suggestion: 'Run prettier --write to format this file',
              })
            }
          }
        } catch (error) {
          // Handle parse errors or other file-specific errors
          if (
            error instanceof SyntaxError ||
            (error instanceof Error && error.message.includes('parse'))
          ) {
            issues.push({
              engine: 'prettier',
              severity: 'error',
              file,
              line: 1,
              col: 1,
              message: `Prettier parsing error: ${error.message}`,
            })
          } else {
            // Re-throw unexpected errors
            throw error
          }
        }
      }

      const duration = Date.now() - startTime

      return {
        success: issues.length === 0,
        issues,
        duration,
        fixable: issues.length > 0,
        fixedCount,
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
            engine: 'prettier',
            severity: 'error',
            file: config.files[0] ?? this.cwd,
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
   * Format a single file
   */
  async formatFile(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8')
    const options = await prettier.resolveConfig(filePath)

    return prettier.format(content, {
      ...options,
      filepath: filePath,
    })
  }

  /**
   * Safely write file with atomic operation
   */
  private async safeWriteFile(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp`

    try {
      // Write to temporary file
      await fs.writeFile(tempPath, content, 'utf-8')

      // Rename temporary file to target (atomic operation)
      await fs.rename(tempPath, filePath)
    } catch (error) {
      // Clean up temporary file if it exists
      try {
        await fs.unlink(tempPath)
      } catch {
        // Ignore cleanup errors
      }

      throw new FileError(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
      )
    }
  }

  /**
   * Check if Prettier is configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      // Check for a sample JS file in the cwd
      const testPath = path.join(this.cwd, 'test.js')
      const config = await prettier.resolveConfig(testPath)
      return config !== null
    } catch {
      return false
    }
  }

  /**
   * Get Prettier version
   */
  static getVersion(): string | undefined {
    try {
      return prettier.version
    } catch {
      return undefined
    }
  }

  /**
   * Get supported file extensions
   */
  static getSupportedExtensions(): string[] {
    return ['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.scss', '.md', '.html', '.yaml', '.yml']
  }

  /**
   * Generate ErrorReport from Prettier issues
   */
  async generateErrorReport(issues: Issue[]): Promise<ErrorReport> {
    const totalErrors = issues.filter((i) => i.severity === 'error').length
    const totalWarnings = issues.filter((i) => i.severity === 'warning').length
    const filesAffected = new Set(issues.map((i) => i.file)).size

    // Format raw output similar to prettier CLI output
    const rawOutput = issues
      .map((issue) => {
        return `${issue.file}:${issue.line}:${issue.col} ${issue.severity}: ${issue.message}`
      })
      .join('\n')

    return {
      timestamp: new Date().toISOString(),
      tool: 'prettier',
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
}
