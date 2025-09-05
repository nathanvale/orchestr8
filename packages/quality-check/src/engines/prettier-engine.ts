import * as prettier from 'prettier'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Issue, CheckerResult } from '../types/issue-types'
import { ToolMissingError, FileError } from '../core/errors'
import type { CancellationToken } from '../core/timeout-manager'

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
      const config = await prettier.resolveConfig(this.cwd)
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
}
