/**
 * Git Hook Facade - Entry point for pre-commit hooks
 * Supports both direct usage and lint-staged integration
 * ~60 lines
 */

import { execSync } from 'node:child_process'
import { QualityChecker } from '../core/quality-checker.js'
import { IssueReporter } from '../core/issue-reporter.js'
import { Autopilot } from '../adapters/autopilot.js'
import { Fixer } from '../adapters/fixer.js'

interface GitHookOptions {
  fix?: boolean
  files?: string[]
}

export async function runGitHook(options: GitHookOptions = {}): Promise<void> {
  try {
    // Use provided files from lint-staged or get staged files
    const filesToCheck = options.files || getStagedFiles()

    // Filter for checkable files (JS/TS)
    const checkableFiles = filesToCheck.filter((file) => /\.(js|jsx|ts|tsx)$/.test(file))

    if (checkableFiles.length === 0) {
      // Silent success for non-JS/TS files
      process.exit(0)
    }

    // Run quality check
    const checker = new QualityChecker()
    const reporter = new IssueReporter()
    const autopilot = new Autopilot()
    const fixer = new Fixer()

    const result = await checker.check(checkableFiles, { fix: false })

    if (!result.success) {
      // Convert to CheckResult format for autopilot
      const issues: import('../types/issue-types.js').Issue[] = []
      if (result.checkers.eslint?.errors) {
        issues.push(
          ...result.checkers.eslint.errors.map((e) => ({
            engine: 'eslint' as const,
            severity: 'error' as const,
            ruleId: 'eslint-error',
            file: checkableFiles[0],
            line: 1,
            col: 1,
            message: e,
          })),
        )
      }
      if (result.checkers.typescript?.errors) {
        issues.push(
          ...result.checkers.typescript.errors.map((e) => ({
            engine: 'typescript' as const,
            severity: 'error' as const,
            ruleId: 'typescript-error',
            file: checkableFiles[0],
            line: 1,
            col: 1,
            message: e,
          })),
        )
      }

      const checkResult = {
        filePath: checkableFiles[0],
        issues,
        hasErrors: true,
        hasWarnings: issues.length > 0,
        fixable: issues.some((i) => i.engine === 'eslint' || i.engine === 'prettier'),
      }

      // Let autopilot decide if we should fix automatically
      const decision = autopilot.decide(checkResult)

      if (options.fix && decision.action === 'FIX_SILENTLY') {
        // Apply safe fixes
        const fixResult = await fixer.autoFix(checkableFiles[0], result)
        if (fixResult.success) {
          console.log('✅ Auto-fixed safe issues')
          process.exit(0)
        }
      }

      // Show detailed errors
      const output = reporter.formatForCLI(result)
      console.error(output)
      console.error('\n❌ Quality check failed')
      console.error('Fix the issues above and try again')
      process.exit(1)
    }

    process.exit(0)
  } catch (error) {
    console.error(
      '❌ Pre-commit hook error:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
    })
    return output.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}
