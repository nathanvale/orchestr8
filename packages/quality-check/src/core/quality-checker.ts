/**
 * QualityChecker - Core checking engine with modern architecture
 * Uses TypeScript, ESLint, and Prettier engines with incremental compilation
 */

import type { QualityCheckOptions, FixResult } from '../types.js'
import type { QualityCheckResult, CheckerResult } from '../types/issue-types'
import { TypeScriptEngine } from '../engines/typescript-engine.js'
import { ESLintEngine } from '../engines/eslint-engine.js'
import { PrettierEngine } from '../engines/prettier-engine.js'
import { ResultAggregator } from '../formatters/aggregator.js'
import { StylishFormatter } from '../formatters/stylish-formatter.js'
import { JsonFormatter } from '../formatters/json-formatter.js'
import { ConfigLoader, type ResolvedConfig } from './config-loader.js'
import { FileMatcher } from './file-matcher.js'
import {
  TimeoutManager,
  CancellationTokenSource,
  type CancellationToken,
} from './timeout-manager.js'
import { logger, createTimer } from '../utils/logger.js'
import { ToolMissingError } from './errors.js'

/**
 * Quality checker using modern engine architecture
 */
export class QualityChecker {
  private typescriptEngine: TypeScriptEngine
  private eslintEngine: ESLintEngine
  private prettierEngine: PrettierEngine
  private aggregator: ResultAggregator
  private configLoader: ConfigLoader
  private fileMatcher: FileMatcher
  private timeoutManager: TimeoutManager
  private stylishFormatter: StylishFormatter
  private jsonFormatter: JsonFormatter

  constructor() {
    this.typescriptEngine = new TypeScriptEngine()
    this.eslintEngine = new ESLintEngine()
    this.prettierEngine = new PrettierEngine()
    this.aggregator = new ResultAggregator()
    this.configLoader = new ConfigLoader()
    this.fileMatcher = new FileMatcher()
    this.timeoutManager = new TimeoutManager()
    this.stylishFormatter = new StylishFormatter()
    this.jsonFormatter = new JsonFormatter()
  }

  /**
   * Check files for quality issues
   */
  async check(
    files: string[],
    options: QualityCheckOptions & { format?: 'stylish' | 'json' },
  ): Promise<QualityCheckResult> {
    const timer = createTimer('quality-check')
    const correlationId = this.generateCorrelationId()

    // Input validation
    if (!files || !Array.isArray(files)) {
      return {
        success: false,
        duration: 0,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            file: process.cwd(),
            line: 1,
            col: 1,
            message: 'Invalid input: files must be an array',
          },
        ],
        correlationId,
      }
    }

    logger.debug('Starting quality check', {
      files: files.length,
      options,
      correlationId,
      phase: 'check-start',
    })

    try {
      // Load configuration
      const config = await this.configLoader.load({
        files,
        fix: options.fix,
        format: options.format,
        engines: {
          typescript: options.typescript !== false,
          eslint: options.eslint !== false,
          prettier: options.prettier !== false,
        },
      })

      // Resolve files
      const targetFiles = await this.fileMatcher.resolveFiles({
        files: config.files,
        staged: config.staged,
        since: config.since,
      })

      if (targetFiles.length === 0) {
        return {
          success: true,
          duration: 0,
          issues: [],
          correlationId,
        }
      }

      // Run checks with timeout
      const results = await this.runChecks(targetFiles, config, correlationId)

      // Aggregate results
      const duration = timer.end()
      const aggregated = this.aggregator.aggregate(results, {
        duration,
        correlationId,
        trackMetrics: process.env.QC_TRACK_METRICS === 'true',
      })

      // Format output if needed
      if (config.format === 'json') {
        const output = this.jsonFormatter.format(aggregated.issues)
        process.stdout.write(output + '\n')
      } else if (aggregated.issues.length > 0) {
        const output = this.stylishFormatter.format(aggregated.issues)
        process.stderr.write(output + '\n')
      }

      logger.debug('Quality check completed', {
        success: aggregated.success,
        issueCount: aggregated.issues.length,
        duration,
        correlationId,
        phase: 'check-complete',
      })

      return aggregated
    } catch (error) {
      const duration = timer.end()

      logger.error('Quality check failed', error as Error, {
        files: files.length,
        duration,
        correlationId,
      })

      return {
        success: false,
        duration,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            file: files[0] ?? process.cwd(),
            line: 1,
            col: 1,
            message: error instanceof Error ? error.message : String(error),
          },
        ],
        correlationId,
      }
    }
  }

  /**
   * Fix quality issues in files
   */
  async fix(files: string[], options: { safe?: boolean } = {}): Promise<FixResult> {
    const timer = createTimer('quality-fix')
    const correlationId = this.generateCorrelationId()

    // Input validation
    if (!files || !Array.isArray(files)) {
      return {
        success: false,
        count: 0,
        fixed: [],
      }
    }

    logger.debug('Starting quality fix', {
      files: files.length,
      options,
      correlationId,
      phase: 'fix-start',
    })

    try {
      // Load configuration with fix enabled
      const config = await this.configLoader.load({
        files,
        fix: true,
        prettierWrite: true,
      })

      // Resolve files
      const targetFiles = await this.fileMatcher.resolveFiles({
        files: config.files,
        staged: config.staged,
        since: config.since,
      })

      if (targetFiles.length === 0) {
        return {
          success: true,
          count: 0,
          fixed: [],
        }
      }

      let fixCount = 0
      const fixed: string[] = []

      // Run ESLint fix
      if (config.engines.eslint) {
        try {
          const result = await this.eslintEngine.check({
            files: targetFiles,
            fix: true,
          })

          if (result.fixedCount && result.fixedCount > 0) {
            fixed.push('ESLint')
            fixCount += result.fixedCount
          }
        } catch (error) {
          if (!(error instanceof ToolMissingError)) {
            logger.warn('ESLint fix failed', { error: (error as Error).message })
          }
        }
      }

      // Run Prettier fix
      if (config.engines.prettier) {
        try {
          const result = await this.prettierEngine.check({
            files: targetFiles,
            write: true,
          })

          if (result.fixedCount && result.fixedCount > 0) {
            fixed.push('Prettier')
            fixCount += result.fixedCount
          }
        } catch (error) {
          if (!(error instanceof ToolMissingError)) {
            logger.warn('Prettier fix failed', { error: (error as Error).message })
          }
        }
      }

      const duration = timer.end()

      logger.debug('Quality fix completed', {
        success: fixCount > 0,
        fixCount,
        fixed,
        duration,
        correlationId,
        phase: 'fix-complete',
      })

      return {
        success: fixCount > 0,
        count: fixCount,
        fixed,
      }
    } catch (error) {
      const duration = timer.end()

      logger.error('Quality fix failed', error as Error, {
        files: files.length,
        duration,
        correlationId,
      })

      return {
        success: false,
        count: 0,
        fixed: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Run checks with the enabled engines
   */
  private async runChecks(
    files: string[],
    config: ResolvedConfig,
    correlationId: string,
  ): Promise<Map<string, CheckerResult>> {
    const results = new Map<string, CheckerResult>()
    const source = new CancellationTokenSource()

    try {
      // Run checks with timeout
      await this.timeoutManager.runWithTimeout(
        async (token) => {
          const checks: Promise<void>[] = []

          // TypeScript check
          if (config.engines.typescript) {
            checks.push(
              this.runTypeScriptCheck(files, config, token).then((result) => {
                results.set('typescript', result)
              }),
            )
          }

          // ESLint check
          if (config.engines.eslint) {
            checks.push(
              this.runESLintCheck(files, config, token).then((result) => {
                results.set('eslint', result)
              }),
            )
          }

          // Prettier check
          if (config.engines.prettier) {
            checks.push(
              this.runPrettierCheck(files, config, token).then((result) => {
                results.set('prettier', result)
              }),
            )
          }

          // Wait for all checks to complete
          await Promise.all(checks)
        },
        config.timeoutMs,
        'quality-check',
      )
    } catch (error) {
      // Handle timeout or other errors
      logger.warn('Quality check timeout or error', {
        error: (error as Error).message,
        correlationId,
      })
    } finally {
      source.cancel()
    }

    return results
  }

  /**
   * Run TypeScript check
   */
  private async runTypeScriptCheck(
    files: string[],
    config: ResolvedConfig,
    token: CancellationToken,
  ): Promise<CheckerResult> {
    try {
      return await this.typescriptEngine.check({
        files,
        cacheDir: config.typescriptCacheDir,
        token,
      })
    } catch (error) {
      if (error instanceof ToolMissingError) {
        logger.warn('TypeScript not available', { skipping: true })
        // For check operations, missing tools should fail
        return {
          success: false,
          issues: [
            {
              engine: 'typescript',
              severity: 'error',
              file: files[0] ?? process.cwd(),
              line: 1,
              col: 1,
              message: `TypeScript is not available: ${error.message}`,
            },
          ],
        }
      }
      throw error
    }
  }

  /**
   * Run ESLint check
   */
  private async runESLintCheck(
    files: string[],
    config: ResolvedConfig,
    token: CancellationToken,
  ): Promise<CheckerResult> {
    try {
      return await this.eslintEngine.check({
        files,
        fix: config.fix,
        format: config.format,
        cacheDir: config.eslintCacheDir,
        token,
      })
    } catch (error) {
      if (error instanceof ToolMissingError) {
        logger.warn('ESLint not available', { skipping: true })
        // For check operations, missing tools should fail
        return {
          success: false,
          issues: [
            {
              engine: 'eslint',
              severity: 'error',
              file: files[0] ?? process.cwd(),
              line: 1,
              col: 1,
              message: `ESLint is not available: ${error.message}`,
            },
          ],
        }
      }
      throw error
    }
  }

  /**
   * Run Prettier check
   */
  private async runPrettierCheck(
    files: string[],
    config: ResolvedConfig,
    token: CancellationToken,
  ): Promise<CheckerResult> {
    try {
      return await this.prettierEngine.check({
        files,
        write: config.prettierWrite,
        token,
      })
    } catch (error) {
      if (error instanceof ToolMissingError) {
        logger.warn('Prettier not available', { skipping: true })
        // For check operations, missing tools should fail
        return {
          success: false,
          issues: [
            {
              engine: 'prettier',
              severity: 'error',
              file: files[0] ?? process.cwd(),
              line: 1,
              col: 1,
              message: `Prettier is not available: ${error.message}`,
            },
          ],
        }
      }
      throw error
    }
  }

  /**
   * Generate correlation ID for tracking
   */
  private generateCorrelationId(): string {
    return `qc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.typescriptEngine.clearCache()
    this.eslintEngine.clearCache()
    this.configLoader.clearCache()
    this.timeoutManager.clearAll()
  }
}
