/**
 * Simplified ESLint checker without TDD dummy generation
 */

import type { CheckerResult } from '../types.js'

interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

export class ESLintChecker {
  constructor(
    private readonly filePath: string,
    private readonly projectRoot: string,
    private readonly fix: boolean,
    private readonly logger: Logger,
  ) {}

  async check(): Promise<CheckerResult> {
    const startTime = performance.now()
    const result: CheckerResult = {
      success: true,
      errors: [],
      warnings: [],
      autofixes: [],
      duration: 0,
    }

    this.logger.debug('Starting ESLint check', { filePath: this.filePath })

    try {
      // Try to dynamically import ESLint
      const { ESLint } = await import('eslint')

      const eslint = new ESLint({
        fix: this.fix,
        cwd: this.projectRoot,
      })

      // Run ESLint on the file
      const lintResults = await eslint.lintFiles([this.filePath])
      const lintResult = lintResults[0]

      if (!lintResult) {
        this.logger.warn('No ESLint results returned', { filePath: this.filePath })
        result.duration = performance.now() - startTime
        return result
      }

      // Process ESLint messages
      if (lintResult.errorCount > 0 || lintResult.warningCount > 0) {
        result.success = false

        // Handle auto-fix if enabled and fixes are available
        if (this.fix && lintResult.output) {
          await this.writeFile(this.filePath, lintResult.output)

          // Re-run ESLint to check if issues remain
          const recheckResults = await eslint.lintFiles([this.filePath])
          const recheckResult = recheckResults[0]

          if (recheckResult && recheckResult.errorCount === 0 && recheckResult.warningCount === 0) {
            result.success = true
            result.autofixes!.push('ESLint auto-fixed formatting and style issues')
            this.logger.info('ESLint auto-fixed all issues')
          } else {
            result.errors.push('ESLint found issues that could not be auto-fixed')
            await this.logESLintOutput(eslint, recheckResults)
          }
        } else {
          // No auto-fix or no fixes available
          result.errors.push(
            `ESLint found ${lintResult.errorCount} error(s) and ${lintResult.warningCount} warning(s)`,
          )
          await this.logESLintOutput(eslint, lintResults)
        }

        // Extract warnings for separate reporting
        const warningMessages = lintResult.messages
          .filter((msg) => msg.severity === 1)
          .map((msg) => `Line ${msg.line}: ${msg.message}`)

        result.warnings = warningMessages
      } else {
        this.logger.info('ESLint check passed', { filePath: this.filePath })
      }
    } catch (error) {
      // Handle missing ESLint gracefully
      if (error instanceof Error && error.message.includes('Cannot resolve module')) {
        this.logger.warn('ESLint not found, skipping check', {
          filePath: this.filePath,
          error: error.message,
        })
        result.warnings = ['ESLint not available - install eslint to enable checking']
      } else {
        result.success = false
        result.errors.push(
          `ESLint check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
        this.logger.error('ESLint check failed', {
          filePath: this.filePath,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    result.duration = performance.now() - startTime
    return result
  }

  private async logESLintOutput(
    eslint: InstanceType<typeof import('eslint').ESLint>,
    results: Array<import('eslint').ESLint.LintResult>,
  ): Promise<void> {
    try {
      const formatter = await eslint.loadFormatter('stylish')
      const output = await formatter.format(results)
      console.error(output)
    } catch (error) {
      this.logger.error('Failed to format ESLint output', { error })
    }
  }

  private async writeFile(filePath: string, content: string): Promise<void> {
    const fs = await import('node:fs/promises')
    await fs.writeFile(filePath, content, 'utf8')
  }
}
