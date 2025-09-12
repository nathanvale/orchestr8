/**
 * Git Hook Facade - Entry point for pre-commit hooks
 * Supports both direct usage and lint-staged integration
 * With automatic staging of fixed files for atomic commits
 */

import { execSync } from 'node:child_process'
import { QualityChecker } from '../core/quality-checker.js'
import { IssueReporter } from '../core/issue-reporter.js'
import { Autopilot } from '../adapters/autopilot.js'
import { Fixer } from '../adapters/fixer.js'
import { GitOperations } from '../utils/git-operations.js'

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

    // Initialize git operations for auto-staging
    const gitOps = new GitOperations()

    // Run quality check
    const checker = new QualityChecker()
    const reporter = new IssueReporter()
    const autopilot = new Autopilot()
    const fixer = new Fixer()

    // Initialize git operations for potential auto-staging

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
        // Apply safe fixes using the QualityCheckResult format
        const fixResult = await fixer.autoFix(checkableFiles[0], result)
        if (fixResult.success) {
          // Detect which files were actually modified by the fixes
          const modifiedFilesResult = await gitOps.detectModifiedFiles()

          if (modifiedFilesResult.modifiedFiles.length > 0) {
            // Auto-stage the fixed files for atomic commit
            const stagingResult = await gitOps.stageFiles(modifiedFilesResult.modifiedFiles)

            if (!stagingResult.success) {
              console.warn(`⚠️  Fixed files but couldn't stage them: ${stagingResult.error}`)
              console.warn('You may need to manually stage the fixed files')
            } else {
              console.log(
                `✅ Auto-fixed and staged ${modifiedFilesResult.modifiedFiles.length} file(s)`,
              )
            }
          } else {
            console.log('✅ Auto-fixed safe issues')
          }

          process.exit(0)
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
