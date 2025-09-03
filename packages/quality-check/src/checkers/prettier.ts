/**
 * Simplified Prettier checker without complex TDD features
 */

import type { CheckerResult } from '../types.js'

interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

export class PrettierChecker {
  constructor(
    private readonly filePath: string,
    projectRoot: string,
    private readonly fix: boolean,
    private readonly logger: Logger,
  ) {
    // projectRoot is available for future use
    void projectRoot
  }

  async check(): Promise<CheckerResult> {
    const startTime = performance.now()
    const result: CheckerResult = {
      success: true,
      errors: [],
      warnings: [],
      autofixes: [],
      duration: 0,
    }

    this.logger.debug('Starting Prettier check', { filePath: this.filePath })

    try {
      // Try to dynamically import Prettier
      const prettier = await import('prettier')

      // Read file content
      const fileContent = await this.readFile(this.filePath)

      // Resolve Prettier configuration
      const prettierConfig = await prettier.resolveConfig(this.filePath)

      // Check if file is already formatted
      const isFormatted = await prettier.check(fileContent, {
        ...prettierConfig,
        filepath: this.filePath,
      })

      if (!isFormatted) {
        result.success = false

        if (this.fix) {
          // Auto-fix formatting if enabled
          try {
            const formatted = await prettier.format(fileContent, {
              ...prettierConfig,
              filepath: this.filePath,
            })

            await this.writeFile(this.filePath, formatted)

            result.success = true
            result.autofixes!.push('Prettier auto-formatted the file')
            this.logger.info('Prettier auto-formatted the file', { filePath: this.filePath })
          } catch (formatError) {
            result.errors.push(
              `Prettier formatting failed: ${formatError instanceof Error ? formatError.message : 'Unknown error'}`,
            )
            this.logger.error('Prettier formatting failed', {
              filePath: this.filePath,
              error: formatError instanceof Error ? formatError.message : 'Unknown error',
            })
          }
        } else {
          // Report formatting issues without auto-fix
          result.errors.push('File is not formatted according to Prettier rules')
          console.error(`❌ ${this.filePath} is not formatted correctly`)
          console.error('Run prettier --write to fix formatting issues')
        }
      } else {
        this.logger.info('Prettier check passed', { filePath: this.filePath })
      }
    } catch (error) {
      // Handle missing Prettier gracefully
      if (
        error instanceof Error &&
        (error.message.includes('Cannot resolve module') ||
          error.message.includes('MODULE_NOT_FOUND'))
      ) {
        this.logger.warn('Prettier not found, skipping check', {
          filePath: this.filePath,
          error: error.message,
        })
        result.warnings = ['Prettier not available - install prettier to enable formatting checks']
      } else {
        result.success = false
        result.errors.push(
          `Prettier check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
        this.logger.error('Prettier check failed', {
          filePath: this.filePath,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    result.duration = performance.now() - startTime
    return result
  }

  private async readFile(filePath: string): Promise<string> {
    const fs = await import('node:fs/promises')
    return fs.readFile(filePath, 'utf8')
  }

  private async writeFile(filePath: string, content: string): Promise<void> {
    const fs = await import('node:fs/promises')
    await fs.writeFile(filePath, content, 'utf8')
  }
}
