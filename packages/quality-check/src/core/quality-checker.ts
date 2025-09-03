/**
 * Core quality checker that coordinates ESLint, Prettier, and TypeScript checks
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'

import type { Logger } from '@orchestr8/logger'

import { GitIntegration } from '../git/git-integration.js'
import type { CheckerResult, QualityCheckOptions, QualityCheckResult } from '../types.js'
import { SafeFileOperations } from '../utils/safe-file-operations.js'

export class QualityChecker {
  private readonly safeOps: SafeFileOperations
  private readonly gitIntegration: GitIntegration

  constructor(
    private readonly filePath: string,
    private readonly options: QualityCheckOptions,
    private readonly logger: Logger,
  ) {
    this.safeOps = new SafeFileOperations(process.cwd(), this.logger)
    this.gitIntegration = new GitIntegration(process.cwd(), this.logger)
  }

  async check(): Promise<QualityCheckResult> {
    const startTime = performance.now()
    const correlationId = this.options.correlationId ?? 'quality-check'

    this.logger.debug('Starting quality checks', {
      correlationId,
      filePath: path.relative(process.cwd(), this.filePath),
      parallel: this.options.parallel,
      checkers: {
        eslint: this.options.eslint,
        prettier: this.options.prettier,
        typescript: this.options.typescript,
      },
    })

    const result: QualityCheckResult = {
      success: true,
      errors: [],
      warnings: [],
      autofixes: [],
      correlationId,
      duration: 0,
      checkers: {},
    }

    try {
      // Check if file should be ignored via git integration
      const respectGitignore = this.options.respectGitignore ?? true
      if (respectGitignore) {
        const shouldIgnore = await this.gitIntegration.shouldIgnoreFile(this.filePath, {
          respectGitignore,
          preCommitMode: this.options.preCommit,
        })

        if (shouldIgnore) {
          this.logger.debug('File ignored by git integration, skipping checks', {
            correlationId,
            filePath: path.relative(process.cwd(), this.filePath),
          })

          const duration = performance.now() - startTime
          result.duration = Math.round(duration)
          result.warnings.push('File ignored by .gitignore')
          return result
        }
      }

      // In pre-commit mode, verify file is staged
      if (this.options.preCommit) {
        const stagedFiles = await this.gitIntegration.getStagedFiles()
        const isStaged = stagedFiles.some((f) => path.resolve(f) === path.resolve(this.filePath))

        if (!isStaged) {
          this.logger.debug('File not staged, skipping in pre-commit mode', {
            correlationId,
            filePath: path.relative(process.cwd(), this.filePath),
          })

          const duration = performance.now() - startTime
          result.duration = Math.round(duration)
          result.warnings.push('File not staged - skipping in pre-commit mode')
          return result
        }
      }

      // Run checkers based on options
      const checkerPromises: Array<Promise<void>> = []

      if (this.options.eslint !== false) {
        const checkerPromise = this.runChecker('eslint', () => this.runESLintCheck())
        if (this.options.parallel) {
          checkerPromises.push(checkerPromise)
        } else {
          await checkerPromise
        }
      }

      if (this.options.prettier !== false) {
        const checkerPromise = this.runChecker('prettier', () => this.runPrettierCheck())
        if (this.options.parallel) {
          checkerPromises.push(checkerPromise)
        } else {
          await checkerPromise
        }
      }

      if (this.options.typescript !== false) {
        const checkerPromise = this.runChecker('typescript', () => this.runTypeScriptCheck())
        if (this.options.parallel) {
          checkerPromises.push(checkerPromise)
        } else {
          await checkerPromise
        }
      }

      // Wait for parallel execution to complete
      if (this.options.parallel && checkerPromises.length > 0) {
        await Promise.all(checkerPromises)
      }

      // Aggregate results
      this.aggregateResults(result)

      const duration = performance.now() - startTime
      result.duration = Math.round(duration)

      this.logger.debug('Quality checks completed', {
        correlationId,
        duration: result.duration,
        success: result.success,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        autofixCount: result.autofixes.length,
      })

      return result
    } catch (error) {
      const duration = performance.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.logger.error('Quality check failed', {
        correlationId,
        error: errorMessage,
        duration: Math.round(duration),
      })

      return {
        success: false,
        errors: [`Quality check failed: ${errorMessage}`],
        warnings: [],
        autofixes: [],
        correlationId,
        duration: Math.round(duration),
        checkers: {},
      }
    } finally {
      // Clean up any temporary files
      await this.safeOps.cleanup()
    }
  }

  private async runChecker(
    name: 'eslint' | 'prettier' | 'typescript',
    checker: () => Promise<CheckerResult>,
  ): Promise<void> {
    try {
      this.logger.debug(`Starting ${name} check`)
      const result = await checker()
      this.setCheckerResult(name, result)
      this.logger.debug(`${name} check completed`, {
        success: result.success,
        errorCount: result.errors.length,
        duration: result.duration,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`${name} check failed`, { error: errorMessage })

      this.setCheckerResult(name, {
        success: false,
        errors: [`${name} check failed: ${errorMessage}`],
        warnings: [],
        autofixes: [],
        duration: 0,
      })
    }
  }

  private checkerResults: Record<string, CheckerResult> = {}

  private setCheckerResult(name: string, result: CheckerResult): void {
    this.checkerResults[name] = result
  }

  private aggregateResults(result: QualityCheckResult): void {
    result.checkers = { ...this.checkerResults }

    // Aggregate all errors, warnings, and autofixes
    for (const checkerResult of Object.values(this.checkerResults)) {
      result.errors.push(...checkerResult.errors)
      if (checkerResult.warnings) {
        result.warnings.push(...checkerResult.warnings)
      }
      if (checkerResult.autofixes) {
        result.autofixes.push(...checkerResult.autofixes)
      }

      // Overall success is false if any checker failed
      if (!checkerResult.success) {
        result.success = false
      }
    }
  }

  private async runESLintCheck(): Promise<CheckerResult> {
    const startTime = performance.now()

    try {
      // Try to load ESLint
      const ESLintModule = await import('eslint').catch(() => null)
      if (!ESLintModule) {
        return {
          success: true, // Not having ESLint is not an error
          errors: [],
          warnings: ['ESLint not found - skipping ESLint checks'],
          autofixes: [],
          duration: Math.round(performance.now() - startTime),
        }
      }

      const { ESLint } = ESLintModule
      const eslint = new ESLint({
        fix: this.options.fix,
        cwd: process.cwd(),
      })

      const results = await eslint.lintFiles([this.filePath])
      const result = results[0]

      if (!result) {
        return {
          success: false,
          errors: ['ESLint returned no results'],
          warnings: [],
          autofixes: [],
          duration: Math.round(performance.now() - startTime),
        }
      }

      const errors: string[] = []
      const warnings: string[] = []
      const autofixes: string[] = []

      if (result.errorCount > 0 || result.warningCount > 0) {
        if (this.options.fix && result.output) {
          // Apply fixes
          await this.safeOps.safeWrite(this.filePath, result.output)
          autofixes.push(
            `ESLint auto-fixed ${result.fixableErrorCount + result.fixableWarningCount} issues`,
          )

          // Re-check after fixes
          const reResults = await eslint.lintFiles([this.filePath])
          const reResult = reResults[0]

          if (reResult && (reResult.errorCount > 0 || reResult.warningCount > 0)) {
            errors.push(
              `ESLint found ${reResult.errorCount} errors and ${reResult.warningCount} warnings after auto-fix`,
            )
          }
        } else {
          errors.push(
            `ESLint found ${result.errorCount} errors and ${result.warningCount} warnings`,
          )

          // Format errors for display
          const formatter = await eslint.loadFormatter('stylish')
          const output = await formatter.format(results)
          console.error(output)
        }
      }

      return {
        success: result.errorCount === 0,
        errors,
        warnings,
        autofixes,
        duration: Math.round(performance.now() - startTime),
      }
    } catch (error) {
      return {
        success: false,
        errors: [`ESLint error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
        autofixes: [],
        duration: Math.round(performance.now() - startTime),
      }
    }
  }

  private async runPrettierCheck(): Promise<CheckerResult> {
    const startTime = performance.now()

    try {
      // Try to load Prettier
      const prettierModule = await import('prettier').catch(() => null)
      if (!prettierModule) {
        return {
          success: true, // Not having Prettier is not an error
          errors: [],
          warnings: ['Prettier not found - skipping Prettier checks'],
          autofixes: [],
          duration: Math.round(performance.now() - startTime),
        }
      }

      const fileContent = await fs.readFile(this.filePath, 'utf-8')
      const prettierConfig = await prettierModule.resolveConfig(this.filePath)

      const isFormatted = await prettierModule.check(fileContent, {
        ...prettierConfig,
        filepath: this.filePath,
      })

      if (!isFormatted) {
        if (this.options.fix) {
          // Apply formatting
          const formatted = await prettierModule.format(fileContent, {
            ...prettierConfig,
            filepath: this.filePath,
          })

          await this.safeOps.safeWrite(this.filePath, formatted)

          return {
            success: true,
            errors: [],
            warnings: [],
            autofixes: ['Prettier auto-formatted the file'],
            duration: Math.round(performance.now() - startTime),
          }
        } else {
          return {
            success: false,
            errors: ['File is not properly formatted according to Prettier'],
            warnings: [],
            autofixes: [],
            duration: Math.round(performance.now() - startTime),
          }
        }
      }

      return {
        success: true,
        errors: [],
        warnings: [],
        autofixes: [],
        duration: Math.round(performance.now() - startTime),
      }
    } catch (error) {
      return {
        success: false,
        errors: [`Prettier error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
        autofixes: [],
        duration: Math.round(performance.now() - startTime),
      }
    }
  }

  private async runTypeScriptCheck(): Promise<CheckerResult> {
    const startTime = performance.now()

    try {
      // Skip TypeScript checks for non-TypeScript files
      const ext = path.extname(this.filePath)
      if (!['.ts', '.tsx'].includes(ext)) {
        return {
          success: true,
          errors: [],
          warnings: [`Skipping TypeScript check for ${ext} file`],
          autofixes: [],
          duration: Math.round(performance.now() - startTime),
        }
      }

      // Try to load TypeScript
      const tsModule = await import('typescript').catch(() => null)
      if (!tsModule) {
        return {
          success: true, // Not having TypeScript is not an error
          errors: [],
          warnings: ['TypeScript not found - skipping TypeScript checks'],
          autofixes: [],
          duration: Math.round(performance.now() - startTime),
        }
      }

      // Find tsconfig.json
      const tsconfigPath = this.findTsConfig()
      if (!tsconfigPath) {
        return {
          success: true,
          errors: [],
          warnings: ['No tsconfig.json found - skipping TypeScript checks'],
          autofixes: [],
          duration: Math.round(performance.now() - startTime),
        }
      }

      // Read and parse TypeScript configuration
      const configFile = tsModule.readConfigFile(tsconfigPath, tsModule.sys.readFile)
      if (configFile.error) {
        return {
          success: false,
          errors: [
            `TypeScript config error: ${tsModule.flattenDiagnosticMessageText(configFile.error.messageText, '\n')}`,
          ],
          warnings: [],
          autofixes: [],
          duration: Math.round(performance.now() - startTime),
        }
      }

      const parsedConfig = tsModule.parseJsonConfigFileContent(
        configFile.config,
        tsModule.sys,
        path.dirname(tsconfigPath),
      )

      // Create program and check diagnostics
      const program = tsModule.createProgram([this.filePath], parsedConfig.options)
      const diagnostics = tsModule.getPreEmitDiagnostics(program)

      // Filter diagnostics for just the target file
      const fileDiagnostics = diagnostics.filter((d) => d.file?.fileName === this.filePath)

      if (fileDiagnostics.length > 0) {
        const errors = fileDiagnostics.map((diagnostic) => {
          const message = tsModule.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
          if (diagnostic.file && diagnostic.start != null) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
              diagnostic.start,
            )
            return `Line ${line + 1}:${character + 1} - ${message}`
          }
          return message
        })

        return {
          success: false,
          errors: [`TypeScript compilation errors:`, ...errors],
          warnings: [],
          autofixes: [],
          duration: Math.round(performance.now() - startTime),
        }
      }

      return {
        success: true,
        errors: [],
        warnings: [],
        autofixes: [],
        duration: Math.round(performance.now() - startTime),
      }
    } catch (error) {
      return {
        success: false,
        errors: [`TypeScript error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
        autofixes: [],
        duration: Math.round(performance.now() - startTime),
      }
    }
  }

  private findTsConfig(): string | null {
    let dir = path.dirname(this.filePath)
    const root = path.parse(dir).root

    while (dir !== root) {
      const tsconfigPath = path.join(dir, 'tsconfig.json')
      try {
        // Check if tsconfig.json exists
        require('fs').statSync(tsconfigPath)
        return tsconfigPath
      } catch {
        // Continue searching up the directory tree
      }
      dir = path.dirname(dir)
    }

    return null
  }
}
