/**
 * Simplified TypeScript checker without TDD dummy generation
 */

import * as path from 'node:path'
import type { CheckerResult } from '../types.js'

interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

export class TypeScriptChecker {
  constructor(
    private readonly filePath: string,
    private readonly projectRoot: string,
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

    this.logger.debug('Starting TypeScript check', { filePath: this.filePath })

    try {
      // Try to dynamically import TypeScript
      const ts = await import('typescript')

      // Find TypeScript config
      const configPath = this.findTsConfig(this.filePath, ts)

      if (!configPath) {
        this.logger.warn('No TypeScript config found, skipping check', { filePath: this.filePath })
        result.warnings = ['No tsconfig.json found - TypeScript checking disabled']
        result.duration = performance.now() - startTime
        return result
      }

      // Check if file exists
      const fileExists = await this.checkFileExists(this.filePath)
      if (!fileExists) {
        result.success = false
        result.errors.push(`File does not exist: ${this.filePath}`)
        result.duration = performance.now() - startTime
        return result
      }

      this.logger.debug('Using TypeScript config', {
        configPath: path.relative(this.projectRoot, configPath),
        filePath: this.filePath,
      })

      // Read and parse TypeScript config
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

      if (configFile.error) {
        result.success = false
        result.errors.push(
          `TypeScript config error: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n')}`,
        )
        result.duration = performance.now() - startTime
        return result
      }

      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath),
      )

      if (parsedConfig.errors.length > 0) {
        result.success = false
        result.errors.push('TypeScript config parsing errors:')
        for (const error of parsedConfig.errors) {
          result.errors.push(`  ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`)
        }
      }

      // Create program and run diagnostics
      const program = ts.createProgram([this.filePath], parsedConfig.options)
      const diagnostics = ts.getPreEmitDiagnostics(program, program.getSourceFile(this.filePath))

      // Process diagnostics
      if (diagnostics.length > 0) {
        result.success = false
        result.errors.push(
          `TypeScript compilation errors in ${path.relative(this.projectRoot, this.filePath)}:`,
        )

        for (const diagnostic of diagnostics) {
          const message = this.formatDiagnostic(diagnostic, ts)
          result.errors.push(`  ${message}`)
          console.error(`❌ ${message}`)
        }
      } else {
        this.logger.info('TypeScript check passed', { filePath: this.filePath })
      }
    } catch (error) {
      // Handle missing TypeScript gracefully
      if (
        error instanceof Error &&
        (error.message.includes('Cannot resolve module') ||
          error.message.includes('MODULE_NOT_FOUND'))
      ) {
        this.logger.warn('TypeScript not found, skipping check', {
          filePath: this.filePath,
          error: error.message,
        })
        result.warnings = ['TypeScript not available - install typescript to enable type checking']
      } else {
        result.success = false
        result.errors.push(
          `TypeScript check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
        this.logger.error('TypeScript check failed', {
          filePath: this.filePath,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    result.duration = performance.now() - startTime
    return result
  }

  private findTsConfig(filePath: string, ts: typeof import('typescript')): string | null {
    const configPath = ts.findConfigFile(path.dirname(filePath), ts.sys.fileExists, 'tsconfig.json')

    return configPath || null
  }

  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      const fs = await import('node:fs/promises')
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private formatDiagnostic(
    diagnostic: import('typescript').Diagnostic,
    ts: typeof import('typescript'),
  ): string {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      const fileName = path.relative(this.projectRoot, diagnostic.file.fileName)
      return `${fileName}:${line + 1}:${character + 1} - ${message} (TS${diagnostic.code})`
    }

    return `${message} (TS${diagnostic.code})`
  }
}
