/**
 * CLI Facade - Entry point for command-line usage
 * ~50 lines
 */

import { QualityChecker } from '../core/quality-checker.js'
import { IssueReporter } from '../core/issue-reporter.js'
import type { QualityCheckOptions } from '../types.js'

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

  try {
    // Run quality check
    const result = await checker.check([options.file], options)

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
    process.exit(1)
  }
}

function parseArgs(args: string[]): QualityCheckOptions & { help?: boolean } {
  const options: QualityCheckOptions = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      options.file = args[++i]
    } else if (args[i] === '--fix') {
      options.fix = true
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
  --file <path>  File to check
  --fix          Auto-fix issues
  --help         Show this help
`)
}
