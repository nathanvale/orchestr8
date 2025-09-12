/**
 * Git Hook Facade - Entry point for pre-commit hooks
 * Supports both direct usage and lint-staged integration
 * With automatic staging of fixed files for atomic commits
 * Uses fix-first architecture to eliminate separate Fixer adapter
 */

import { execSync } from 'node:child_process'
import { QualityChecker } from '../core/quality-checker.js'
import { IssueReporter } from '../core/issue-reporter.js'
import { Autopilot } from '../adapters/autopilot.js'

interface GitHookOptions {
  fix?: boolean
  files?: string[]
}

export async function runGitHook(options: GitHookOptions = {}): Promise<void> {
  try {
    // Use provided files from lint-staged or get staged files
    const filesToCheck = options.files || getStagedFiles()

    // Filter for checkable files (JS/TS only for git hooks)
    const checkableFiles = filesToCheck.filter((file) => /\.(js|jsx|ts|tsx)$/.test(file))

    if (checkableFiles.length === 0) {
      // Silent success for non-JS/TS files
      process.exit(0)
    }

    // Run quality check
    const checker = new QualityChecker()
    const reporter = new IssueReporter()
    const autopilot = new Autopilot()

    // First run a check to see if there are issues
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
        // Use fix-first mode which automatically fixes and stages files
        const fixFirstResult = await checker.check(checkableFiles, {
          fixFirst: true,
          autoStage: true,
        })

        if (fixFirstResult.success) {
          // Check if any fixes were applied
          const fixesApplied = fixFirstResult.fixesApplied && fixFirstResult.fixesApplied.length > 0
          if (fixesApplied) {
            const totalFiles =
              fixFirstResult.fixesApplied?.reduce(
                (sum, fix) => sum + fix.modifiedFiles.length,
                0,
              ) || 0
            console.log(`✅ Auto-fixed and staged ${totalFiles} file(s)`)
          } else {
            console.log('✅ No fixable issues found')
          }
          process.exit(0)
        }

        // If fix-first still has issues, show them
        if (fixFirstResult.issues && fixFirstResult.issues.length > 0) {
          const output = reporter.formatForCLI(fixFirstResult)
          console.error(output)
          console.error('\n❌ Quality check failed - unfixable issues remain')
          console.error('Fix the issues above and try again')
          process.exit(1)
        }
      }

      // Show detailed errors using the QualityCheckResult format
      const output = reporter.formatForCLI(result)
      console.error(output)
      console.error('\n❌ Quality check failed')
      console.error('Fix the issues above and try again')
      process.exit(1)
    }

    process.exit(0)
  } catch (error) {
    // Don't catch errors from mocked process.exit
    if (error instanceof Error && error.message.startsWith('Process exited with code')) {
      throw error
    }
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
