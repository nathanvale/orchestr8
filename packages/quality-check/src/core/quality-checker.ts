/**
 * QualityChecker - Core checking engine
 * ~200 lines - stateless, no side effects
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { QualityCheckOptions, QualityCheckResult, CheckerResult, FixResult } from '../types.js'
import { ErrorParser } from './error-parser.js'

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
        const filesStr = existingFiles.map((f) => `"${f}"`).join(' ')
        execSync(`npx eslint --fix ${filesStr}`, { stdio: 'pipe' })
        fixed.push('ESLint')
        fixCount++
      } catch {
        // ESLint fix failed, continue
      }

      // Always fix Prettier issues
      try {
        const filesStr = existingFiles.map((f) => `"${f}"`).join(' ')
        execSync(`npx prettier --write ${filesStr}`, { stdio: 'pipe' })
        fixed.push('Prettier')
        fixCount++
      } catch {
        // Prettier fix failed, continue
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
      const filesStr = files.map((f) => `"${f}"`).join(' ')
      const output = execSync(`npx eslint ${filesStr} --format=json`, {
        stdio: 'pipe',
        encoding: 'utf8',
      })

      const results = JSON.parse(output) as ESLintResult[]
      const errors: string[] = []
      let hasErrors = false

      results.forEach((file: ESLintResult) => {
        if (file.errorCount > 0) {
          hasErrors = true
          file.messages.forEach((msg: ESLintMessage) => {
            if (msg.severity === 2) {
              errors.push(
                `${file.filePath}:${msg.line}:${msg.column} - ${msg.message} (${msg.ruleId})`,
              )
            }
          })
        }
      })

      return {
        success: !hasErrors,
        errors: errors.length > 0 ? errors : undefined,
        fixable: true,
      }
    } catch (error) {
      // ESLint exits with non-zero on errors
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
