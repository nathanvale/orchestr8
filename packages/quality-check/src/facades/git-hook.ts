/**
 * Git Hook Facade - Entry point for pre-commit hooks
 * ~50 lines
 */

import { execSync } from 'node:child_process'
import { QualityChecker } from '../core/quality-checker.js'
import { IssueReporter } from '../core/issue-reporter.js'

export async function runGitHook(): Promise<void> {
  try {
    // Get list of staged files
    const stagedFiles = getStagedFiles()

    if (stagedFiles.length === 0) {
      console.log('No staged files to check')
      process.exit(0)
    }

    // Filter for checkable files (JS/TS)
    const filesToCheck = stagedFiles.filter((file) => /\.(js|jsx|ts|tsx)$/.test(file))

    if (filesToCheck.length === 0) {
      console.log('No JavaScript/TypeScript files to check')
      process.exit(0)
    }

    console.log(`Checking ${filesToCheck.length} staged file(s)...`)

    // Run quality check
    const checker = new QualityChecker()
    const reporter = new IssueReporter()

    const result = await checker.check(filesToCheck, { fix: false })

    if (!result.success) {
      console.log(reporter.formatForCLI(result))
      console.log('\n❌ Pre-commit check failed. Fix issues and try again.')
      console.log('💡 Run with --fix flag to auto-fix some issues')
      process.exit(1)
    }

    console.log('✅ Pre-commit checks passed')
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
