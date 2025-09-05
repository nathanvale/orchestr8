/**
 * QualityChecker - Core checking engine
 * Enhanced with structured logging and observability
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { QualityCheckOptions, QualityCheckResult, CheckerResult, FixResult } from '../types.js'
import { ErrorParser } from './error-parser.js'
import { logger, createTimer } from '../utils/logger.js'

interface ESLintMessage {
  severity: number
  message: string
  ruleId: string | null
  line: number
  column: number
}

interface ESLintResult {
  errorCount: number
  warningCount: number
  messages: ESLintMessage[]
  filePath: string
}

export class QualityChecker {
  private errorParser = new ErrorParser()

  /**
   * Execute command with structured logging and timing
   */
  private executeCommand(command: string, args: string[] = []): { stdout: string; stderr: string; exitCode: number; duration: number } {
    const timer = createTimer('command-execution')
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command
    
    logger.debug('Executing command', {
      command,
      args,
      fullCommand,
      phase: 'tool-start'
    })
    
    try {
      const output = execSync(fullCommand, { 
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 30000 // 30 second timeout
      })
      const duration = timer.end()
      
      logger.toolExecution(command, args, duration, 0)
      
      return {
        stdout: output.toString(),
        stderr: '',
        exitCode: 0,
        duration
      }
    } catch (error: unknown) {
      const duration = timer.end()
      const exitCode = (error as any).status || 1
      const stderr = (error as any).stderr?.toString() || (error as Error).message
      
      logger.toolExecution(command, args, duration, exitCode)
      
      return {
        stdout: (error as any).stdout?.toString() || '',
        stderr,
        exitCode,
        duration
      }
    }
  }

  /**
   * Check files for quality issues
   */
  async check(files: string[], options: QualityCheckOptions): Promise<QualityCheckResult> {
    const result: QualityCheckResult = {
      success: true,
      checkers: {},
    }

    // Filter non-existent files
    const existingFiles = files.filter((file) => existsSync(file))
    if (existingFiles.length === 0) {
      return result
    }

    // Run checks in parallel by default
    const runParallel = options.parallel !== false

    if (runParallel) {
      const [eslint, prettier, typescript] = await Promise.all([
        options.eslint !== false ? this.runESLint(existingFiles) : null,
        options.prettier !== false ? this.runPrettier(existingFiles) : null,
        options.typescript !== false ? this.runTypeScript(existingFiles) : null,
      ])

      if (eslint) result.checkers.eslint = eslint
      if (prettier) result.checkers.prettier = prettier
      if (typescript) result.checkers.typescript = typescript
    } else {
      // Sequential execution
      if (options.eslint !== false) {
        result.checkers.eslint = await this.runESLint(existingFiles)
      }
      if (options.prettier !== false) {
        result.checkers.prettier = await this.runPrettier(existingFiles)
      }
      if (options.typescript !== false) {
        result.checkers.typescript = await this.runTypeScript(existingFiles)
      }
    }

    // Determine overall success
    result.success = this.isSuccessful(result)
    return result
  }

  /**
   * Fix quality issues in files
   */
  async fix(files: string[], _options: { safe?: boolean }): Promise<FixResult> {
    const existingFiles = files.filter((file) => existsSync(file))
    if (existingFiles.length === 0) {
      return { success: true, count: 0, fixed: [] }
    }

    let fixCount = 0
    const fixed: string[] = []

    try {
      // Always fix ESLint issues
      try {
        const eslintResult = this.executeCommand('npx eslint', ['--fix', ...existingFiles.map(f => `"${f}"`)])
        if (eslintResult.exitCode === 0) {
          fixed.push('ESLint')
          fixCount++
          logger.debug('ESLint auto-fix successful', { files: existingFiles.length })
        }
      } catch {
        logger.warn('ESLint fix failed', { files: existingFiles.length })
      }

      // Always fix Prettier issues
      try {
        const prettierResult = this.executeCommand('npx prettier', ['--write', ...existingFiles.map(f => `"${f}"`)])
        if (prettierResult.exitCode === 0) {
          fixed.push('Prettier')
          fixCount++
          logger.debug('Prettier auto-fix successful', { files: existingFiles.length })
        }
      } catch {
        logger.warn('Prettier fix failed', { files: existingFiles.length })
      }

      return {
        success: fixCount > 0,
        count: fixCount,
        fixed,
      }
    } catch (error) {
      return {
        success: false,
        count: 0,
        fixed: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Run ESLint check
   */
  private async runESLint(files: string[]): Promise<CheckerResult> {
    try {
      const eslintResult = this.executeCommand('npx eslint', [...files.map(f => `"${f}"`), '--format=json'])
      
      let results: ESLintResult[] = []
      let hasIssues = false
      const errors: string[] = []
      
      // Parse output if available (ESLint may exit with non-zero but still provide JSON)
      if (eslintResult.stdout) {
        try {
          results = JSON.parse(eslintResult.stdout) as ESLintResult[]
        } catch (parseError) {
          logger.warn('Failed to parse ESLint JSON output', { error: (parseError as Error).message })
        }
      }
      
      results.forEach((file: ESLintResult) => {
        // Consider both errors (severity 2) and warnings (severity 1) as issues
        if (file.errorCount > 0 || file.warningCount > 0) {
          hasIssues = true
          file.messages.forEach((msg: ESLintMessage) => {
            // Include both errors and warnings in the errors array
            if (msg.severity === 2 || msg.severity === 1) {
              errors.push(
                `${file.filePath}:${msg.line}:${msg.column} - ${msg.message} (${msg.ruleId})`,
              )
            }
          })
        }
      })
      
      logger.debug('ESLint check completed', {
        files: files.length,
        errors: errors.length,
        warnings: results.reduce((sum, r) => sum + r.warningCount, 0),
        duration: eslintResult.duration,
        exitCode: eslintResult.exitCode,
        component: 'eslint'
      })

      return {
        success: !hasIssues,
        errors: errors.length > 0 ? errors : undefined,
        fixable: true,
      }
    } catch (error) {
      logger.error('ESLint execution failed', error as Error, {
        files: files.length,
        component: 'eslint'
      })
      
      const errorMsg = error instanceof Error ? error.message : 'ESLint check failed'
      return {
        success: false,
        errors: [errorMsg],
        fixable: true,
      }
    }
  }

  /**
   * Run Prettier check
   */
  private async runPrettier(files: string[]): Promise<CheckerResult> {
    try {
      const filesStr = files.map((f) => `"${f}"`).join(' ')
      execSync(`npx prettier --check ${filesStr}`, {
        stdio: 'pipe',
      })

      return {
        success: true,
        fixable: true,
      }
    } catch {
      // Prettier exits with non-zero when formatting needed
      return {
        success: false,
        errors: ['File needs formatting'],
        fixable: true,
      }
    }
  }

  /**
   * Run TypeScript check
   */
  private async runTypeScript(_files: string[]): Promise<CheckerResult> {
    try {
      // Check if tsconfig exists
      if (!existsSync('tsconfig.json')) {
        return { success: true }
      }

      execSync('npx tsc --noEmit', { stdio: 'pipe' })

      return {
        success: true,
        fixable: false,
      }
    } catch (error) {
      // Parse TypeScript errors for better detail
      const errorMsg = error instanceof Error ? error.toString() : 'TypeScript check failed'
      const parsedErrors = this.errorParser.parseTypeScriptErrors(errorMsg)

      const errors =
        parsedErrors.length > 0
          ? parsedErrors.map((err) => this.errorParser.formatError(err))
          : ['TypeScript compilation failed']

      return {
        success: false,
        errors,
        fixable: false,
      }
    }
  }

  /**
   * Determine if all checks passed
   */
  private isSuccessful(result: QualityCheckResult): boolean {
    const checkers = Object.values(result.checkers)
    if (checkers.length === 0) return true
    return checkers.every((checker) => checker?.success !== false)
  }
}
