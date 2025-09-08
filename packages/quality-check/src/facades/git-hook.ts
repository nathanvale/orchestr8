/**
 * Git Hook Facade - Entry point for pre-commit hooks
 * Supports both direct usage and lint-staged integration
 * ~60 lines
 */

import { execSync } from 'node:child_process'
import { QualityCheckerV2 } from '../core/quality-checker-v2.js'
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
    const checker = new QualityCheckerV2()
    const reporter = new IssueReporter()
    const autopilot = new Autopilot()
    const fixer = new Fixer()

    const result = await checker.check(checkableFiles, { fix: false })

    if (!result.success) {
      // V2 already provides issues array
      const checkResult = {
        filePath: checkableFiles[0],
        issues: result.issues || [],
        hasErrors: true,
        hasWarnings: result.issues?.length > 0,
        fixable:
          result.issues?.some((i) => i.engine === 'eslint' || i.engine === 'prettier') || false,
      }

      // Let autopilot decide if we should fix automatically
      const decision = autopilot.decide(checkResult)

      if (options.fix && decision.action === 'FIX_SILENTLY') {
        // Apply safe fixes - convert V2 result to expected format
        const fixerResult = {
          success: result.success,
          checkers: {
            eslint: {
              success: !result.issues?.some((i) => i.engine === 'eslint'),
              errors:
                result.issues
                  ?.filter((i) => i.engine === 'eslint' && i.severity === 'error')
                  .map((i) => i.message) || [],
              warnings:
                result.issues
                  ?.filter((i) => i.engine === 'eslint' && i.severity === 'warning')
                  .map((i) => i.message) || [],
            },
            typescript: {
              success: !result.issues?.some((i) => i.engine === 'typescript'),
              errors:
                result.issues
                  ?.filter((i) => i.engine === 'typescript' && i.severity === 'error')
                  .map((i) => i.message) || [],
              warnings:
                result.issues
                  ?.filter((i) => i.engine === 'typescript' && i.severity === 'warning')
                  .map((i) => i.message) || [],
            },
            prettier: {
              success: !result.issues?.some((i) => i.engine === 'prettier'),
              errors:
                result.issues
                  ?.filter((i) => i.engine === 'prettier' && i.severity === 'error')
                  .map((i) => i.message) || [],
              warnings:
                result.issues
                  ?.filter((i) => i.engine === 'prettier' && i.severity === 'warning')
                  .map((i) => i.message) || [],
            },
          },
        }
        const fixResult = await fixer.autoFix(checkableFiles[0], fixerResult)
        if (fixResult.success) {
          console.log('✅ Auto-fixed safe issues')
          process.exit(0)
        }
      }

      // Show detailed errors - convert V2 result to expected format for reporter
      const reporterResult = {
        success: result.success,
        checkers: {
          eslint: {
            success: !result.issues?.some((i) => i.engine === 'eslint'),
            errors:
              result.issues
                ?.filter((i) => i.engine === 'eslint' && i.severity === 'error')
                .map((i) => i.message) || [],
            warnings:
              result.issues
                ?.filter((i) => i.engine === 'eslint' && i.severity === 'warning')
                .map((i) => i.message) || [],
          },
          typescript: {
            success: !result.issues?.some((i) => i.engine === 'typescript'),
            errors:
              result.issues
                ?.filter((i) => i.engine === 'typescript' && i.severity === 'error')
                .map((i) => i.message) || [],
            warnings:
              result.issues
                ?.filter((i) => i.engine === 'typescript' && i.severity === 'warning')
                .map((i) => i.message) || [],
          },
          prettier: {
            success: !result.issues?.some((i) => i.engine === 'prettier'),
            errors:
              result.issues
                ?.filter((i) => i.engine === 'prettier' && i.severity === 'error')
                .map((i) => i.message) || [],
            warnings:
              result.issues
                ?.filter((i) => i.engine === 'prettier' && i.severity === 'warning')
                .map((i) => i.message) || [],
          },
        },
      }
      const output = reporter.formatForCLI(reporterResult)
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
