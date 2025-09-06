/**
 * CLI Facade v2 - Entry point for command-line usage with new engine architecture
 */

import { Autopilot } from '../adapters/autopilot.js'
import { ExitCodes, getExitCode } from '../core/errors.js'
import { QualityCheckerV2 } from '../core/quality-checker-v2.js'
import type { QualityCheckOptions } from '../types.js'
import type { Issue as AutopilotIssue } from '../types.js'
import type { Issue } from '../types/issue-types.js'

interface CLIOptions extends QualityCheckOptions {
  help?: boolean
  autopilot?: boolean
  format?: 'stylish' | 'json'
  typescriptCacheDir?: string
  eslintCacheDir?: string
  since?: string
  staged?: boolean
  timeout?: number
}

export async function runCLI(args: string[]): Promise<void> {
  // Parse command line arguments
  const options = parseArgs(args)

  if (options.help) {
    showHelp()
    return
  }

  if (!options.file && !options.staged && !options.since) {
    console.error('❌ No file, --staged, or --since specified')
    console.error('Usage: quality-check --file <path> [options]')
    process.exit(ExitCodes.ERROR)
  }

  // Create instances
  const checker = new QualityCheckerV2()
  const autopilot = options.autopilot ? new Autopilot() : null

  try {
    // Prepare files array
    const files = options.file ? [options.file] : []

    // Run quality check with new engines
    const result = await checker.check(files, {
      ...options,
      format: options.format,
    })

    if (result.success) {
      if (options.format !== 'json') {
        console.log('✅ All quality checks passed!')
      }
      process.exit(ExitCodes.SUCCESS)
    }

    // If autopilot is enabled, use it to decide what to do
    if (autopilot && options.file) {
      const autopilotIssues = convertToAutopilotIssues(result.issues, options.file)
      const checkResult = {
        filePath: options.file,
        issues: autopilotIssues,
        hasErrors: !result.success,
        hasWarnings: result.issues.some((i) => i.severity === 'warning'),
        fixable: result.issues.some((i) => i.engine === 'eslint' || i.engine === 'prettier'),
      }

      const decision = autopilot.decide(checkResult)

      if (options.format !== 'json') {
        console.log(`🤖 Autopilot: ${decision.action}`)

        if (decision.fixes?.length) {
          console.log(`🔧 Auto-fixing ${decision.fixes.length} issues...`)
        }

        if (decision.issues?.length) {
          console.log(`📋 ${decision.issues.length} issues require manual attention`)
        }

        // Show automation results
        const totalIssues = result.issues.length
        const automatedIssues = decision.fixes?.length || 0
        const manualIssues = decision.issues?.length || 0
        const automationRate = totalIssues > 0 ? (automatedIssues / totalIssues) * 100 : 0

        console.log(`\n📊 Automation Results:`)
        console.log(`   Fixed automatically: ${automatedIssues}`)
        console.log(`   Require manual fix: ${manualIssues}`)
        console.log(`   Automation rate: ${automationRate.toFixed(1)}%`)
      }

      process.exit(decision.action === 'CONTINUE' ? ExitCodes.SUCCESS : ExitCodes.ISSUES_FOUND)
    }

    // Apply fixes if requested
    if (options.fix && !result.success) {
      const fixed = await checker.fix(files, { safe: true })
      if (fixed.count > 0 && options.format !== 'json') {
        console.log(`\n✨ Fixed ${fixed.count} issue${fixed.count > 1 ? 's' : ''}`)
      }
    }

    // Exit with appropriate code based on issues
    const exitCode = result.issues.some((i) => i.severity === 'error')
      ? ExitCodes.ISSUES_FOUND
      : ExitCodes.SUCCESS
    process.exit(exitCode)
  } catch (error) {
    if (options.format !== 'json') {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error))
    }
    process.exit(getExitCode(error))
  }
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--file':
        if (args[i + 1]) {
          options.file = args[++i]
        }
        break

      case '--fix':
        options.fix = true
        break

      case '--autopilot':
        options.autopilot = true
        break

      case '--format':
        if (args[i + 1] === 'json' || args[i + 1] === 'stylish') {
          options.format = args[++i] as 'json' | 'stylish'
        }
        break

      case '--typescript-cache-dir':
        if (args[i + 1]) {
          options.typescriptCacheDir = args[++i]
        }
        break

      case '--eslint-cache-dir':
        if (args[i + 1]) {
          options.eslintCacheDir = args[++i]
        }
        break

      case '--staged':
        options.staged = true
        break

      case '--since':
        if (args[i + 1]) {
          options.since = args[++i]
        }
        break

      case '--timeout':
        if (args[i + 1]) {
          const timeout = parseInt(args[++i], 10)
          if (!isNaN(timeout)) {
            options.timeout = timeout
          }
        }
        break

      case '--no-typescript':
        options.typescript = false
        break

      case '--no-eslint':
        options.eslint = false
        break

      case '--no-prettier':
        options.prettier = false
        break

      case '--help':
      case '-h':
        return { help: true }
    }
  }

  return options
}

function showHelp(): void {
  console.log(`
Quality Check v2 - Fast code quality enforcement with incremental compilation

Usage: quality-check [options]

Options:
  --file <path>              File to check
  --staged                   Check staged files
  --since <ref>              Check files changed since git ref
  --fix                      Auto-fix issues
  --format <stylish|json>    Output format (default: stylish)
  --autopilot                Use autopilot for smart decision making
  --timeout <ms>             Timeout in milliseconds (default: 3000)
  
Cache Options:
  --typescript-cache-dir <path>  TypeScript cache directory
  --eslint-cache-dir <path>      ESLint cache directory
  
Engine Options:
  --no-typescript            Disable TypeScript checking
  --no-eslint                Disable ESLint checking
  --no-prettier              Disable Prettier checking
  
  --help, -h                 Show this help

Examples:
  quality-check --file src/index.ts
  quality-check --staged --fix
  quality-check --since main --format json
  quality-check --file src/app.ts --autopilot --fix

Performance Tips:
  - TypeScript uses incremental compilation for fast warm checks
  - ESLint uses built-in caching for improved performance
  - Median warm check time: ≤300ms for single files
`)
}

/**
 * Convert new Issue format to Autopilot Issue format
 */
function convertToAutopilotIssues(issues: Issue[], filePath: string): AutopilotIssue[] {
  return issues.map((issue) => ({
    rule: issue.ruleId || `${issue.engine}-${issue.severity}`,
    fixable: issue.engine === 'eslint' || issue.engine === 'prettier',
    message: issue.message,
    file: issue.file || filePath,
  }))
}
