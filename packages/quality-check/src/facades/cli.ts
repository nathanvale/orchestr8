/**
 * CLI Facade - Entry point for command-line usage
 * ~50 lines
 */

import { Autopilot } from '../adapters/autopilot.js'
import { ExitCodes } from '../core/exit-codes.js'
import { IssueReporter } from '../core/issue-reporter.js'
import { QualityChecker } from '../core/quality-checker.js'
import type { QualityCheckOptions, Issue, QualityCheckResult } from '../types.js'

export async function runCLI(args: string[]): Promise<void> {
  // Parse command line arguments
  const options = parseArgs(args)

  if (options.help) {
    showHelp()
    return
  }

  if (!options.file) {
    console.error('❌ No file specified')
    console.error('Usage: quality-check --file <path>')
    process.exit(1)
  }

  // Create instances
  const checker = new QualityChecker()
  const reporter = new IssueReporter()
  const autopilot = options.autopilot ? new Autopilot() : null

  try {
    // Run quality check
    const result = await checker.check([options.file], options)

    if (result.success) {
      console.log('✅ All quality checks passed!')
      process.exit(ExitCodes.SUCCESS)
    }

    // If autopilot is enabled, use it to decide what to do
    if (autopilot) {
      // Convert QualityCheckResult to CheckResult format
      const issues = extractIssuesFromQualityResult(result, options.file)
      const checkResult = {
        filePath: options.file,
        issues,
        hasErrors: !result.success,
        hasWarnings: issues.length > 0,
        fixable: issues.some((issue) => issue.fixable),
      }

      const decision = autopilot.decide(checkResult)
      console.log(`🤖 Autopilot: ${decision.action}`)

      if (decision.fixes?.length) {
        console.log(`🔧 Auto-fixing ${decision.fixes.length} issues...`)
      }

      if (decision.issues?.length) {
        console.log(`📋 ${decision.issues.length} issues require manual attention`)
      }

      // Show automation results
      const totalIssues = issues.length
      const automatedIssues = decision.fixes?.length || 0
      const manualIssues = decision.issues?.length || 0
      const automationRate = totalIssues > 0 ? (automatedIssues / totalIssues) * 100 : 0

      console.log(`\n📊 Automation Results:`)
      console.log(`   Fixed automatically: ${automatedIssues}`)
      console.log(`   Require manual fix: ${manualIssues}`)
      console.log(`   Automation rate: ${automationRate.toFixed(1)}%`)

      process.exit(decision.action === 'CONTINUE' ? ExitCodes.SUCCESS : ExitCodes.QUALITY_ISSUES)
    }

    // Format and display results
    const output = reporter.formatForCLI(result)
    if (output) console.log(output)

    // Apply fixes if requested
    if (options.fix && !result.success) {
      const fixed = await checker.fix([options.file], { safe: true })
      if (fixed.count > 0) {
        console.log(`\n✨ Fixed ${fixed.count} issue${fixed.count > 1 ? 's' : ''}`)
      }
    }

    // Exit with appropriate code
    process.exit(reporter.getExitCode(result))
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error))
    process.exit(ExitCodes.HOOK_ERROR) // System/hook error, not quality issue
  }
}

function parseArgs(args: string[]): QualityCheckOptions & { help?: boolean; autopilot?: boolean } {
  const options: QualityCheckOptions & { autopilot?: boolean } = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      options.file = args[++i]
    } else if (args[i] === '--fix') {
      options.fix = true
    } else if (args[i] === '--autopilot') {
      options.autopilot = true
    } else if (args[i] === '--help') {
      return { help: true }
    }
  }

  return options
}

function showHelp(): void {
  console.log(`
Quality Check - Fast code quality enforcement

Usage: quality-check --file <path> [options]

Options:
  --file <path>     File to check
  --fix             Auto-fix issues
  --autopilot       Use autopilot for smart decision making
  --help            Show this help
`)
}

/**
 * Extract issues from QualityCheckResult and convert to Autopilot Issue format
 */
function extractIssuesFromQualityResult(result: QualityCheckResult, filePath: string): Issue[] {
  const issues: Issue[] = []

  // Extract ESLint issues
  if (result.checkers.eslint && result.checkers.eslint.errors) {
    for (const error of result.checkers.eslint.errors) {
      // Parse ESLint error format to extract rule
      const ruleMatch = error.match(/\(([^)]+)\)$/)
      const rule = ruleMatch ? ruleMatch[1] : 'eslint-error'

      issues.push({
        rule,
        fixable: true, // Most ESLint rules are fixable
        message: error,
        file: filePath,
      })
    }
  }

  // Extract TypeScript issues
  if (result.checkers.typescript && result.checkers.typescript.errors) {
    for (const error of result.checkers.typescript.errors) {
      issues.push({
        rule: 'typescript-error',
        fixable: false, // TypeScript errors usually require human intervention
        message: error,
        file: filePath,
      })
    }
  }

  // Extract Prettier issues
  if (result.checkers.prettier && result.checkers.prettier.errors) {
    for (const error of result.checkers.prettier.errors) {
      issues.push({
        rule: 'prettier/prettier',
        fixable: true, // Prettier issues are always auto-fixable
        message: error,
        file: filePath,
      })
    }
  }

  return issues
}
