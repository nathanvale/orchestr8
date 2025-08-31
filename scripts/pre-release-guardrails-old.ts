#!/usr/bin/env tsx
/**
 * Pre-Release Guardrails Script
 *
 * Comprehensive pre-release validation including changeset validation,
 * security scanning, export map linting, and more. Orchestrates all
 * guardrails in a single command for CI/CD integration.
 */

/* eslint-disable no-console */

import { exec } from 'node:child_process'
import { existsSync } from 'node:fs'
import { parseArgs, promisify } from 'node:util'

const execAsync = promisify(exec)

interface GuardrailResult {
  name: string
  status: 'pass' | 'warn' | 'fail' | 'skip'
  message: string
  duration: number
  details?: string[]
}

interface GuardrailOptions {
  quick?: boolean // Skip slow checks for fast feedback
  verbose?: boolean // Show detailed output
  skipSecurity?: boolean // Skip security scans
  skipExportMaps?: boolean // Skip export map validation
  skipChangesets?: boolean // Skip changeset validation
  warnOnly?: boolean // Convert failures to warnings
}

/**
 * Run a single guardrail with proper error handling - actually parallel
 */
async function runGuardrail(
  name: string,
  command: string,
  options: GuardrailOptions,
): Promise<GuardrailResult> {
  const startTime = Date.now()

  // Skip if file doesn't exist
  const scriptFile = command.split(' ')[1]
  if (scriptFile && !existsSync(scriptFile)) {
    return {
      name,
      status: 'skip',
      message: `Script ${scriptFile} not found`,
      duration: 0,
    }
  }

  try {
    if (options.verbose) {
      console.log(`\n🔍 Running ${name}...`)
    }

    const { stdout, stderr } = await execAsync(command, {
      encoding: 'utf-8',
      timeout: options.quick ? 30000 : 120000, // 30s quick, 2min full
      maxBuffer: 1024 * 1024 * 16, // 16MB buffer for large outputs
    })

    if (options.verbose && stdout) {
      console.log(stdout)
    }
    if (options.verbose && stderr) {
      console.error(stderr)
    }

    const duration = Date.now() - startTime

    return {
      name,
      status: 'pass',
      message: 'Check passed',
      duration,
    }
  } catch (error: any) {
    const duration = Date.now() - startTime

    // Handle buffer overflow specifically
    if (error.code === 'ENOBUFS') {
      return {
        name,
        status: options.warnOnly ? 'warn' : 'fail',
        message: 'Output too large - increase maxBuffer or reduce output',
        duration,
      }
    }

    // In warn-only mode, convert failures to warnings
    if (options.warnOnly) {
      return {
        name,
        status: 'warn',
        message: error.message || 'Check failed (warning only)',
        duration,
      }
    }

    return {
      name,
      status: 'fail',
      message: error.message || 'Check failed',
      duration,
    }
  }
}

/**
 * Run all guardrails with proper orchestration
 */
async function runAllGuardrails(options: GuardrailOptions): Promise<GuardrailResult[]> {
  const results: GuardrailResult[] = []
  const guardrails: Array<{ name: string; command: string; skip?: boolean }> = []

  // Define guardrails to run
  if (!options.skipChangesets) {
    guardrails.push({
      name: 'Changeset Validation',
      command: 'tsx scripts/changeset-validator.ts',
      skip: !existsSync('.changeset'),
    })
  }

  if (!options.skipSecurity && !options.quick) {
    guardrails.push({
      name: 'Security Scan',
      command: 'tsx scripts/security-scan.ts',
    })
  }

  if (!options.skipExportMaps) {
    guardrails.push({
      name: 'Export Map Linting',
      command: 'tsx scripts/export-map-linter.ts',
    })
  }

  // Always run governance checks
  guardrails.push({
    name: 'Governance Check',
    command: 'tsx scripts/governance-check.ts',
  })

  // Filter out skipped guardrails
  const activeGuardrails = guardrails.filter((g) => !g.skip)

  if (activeGuardrails.length === 0) {
    console.log('⚠️  No guardrails to run')
    return []
  }

  console.log(
    `🛡️  Running ${activeGuardrails.length} guardrails${options.quick ? ' (quick mode)' : ''}`,
  )
  console.log('   ' + activeGuardrails.map((g) => g.name).join(', '))
  console.log('')

  // Run guardrails in parallel for better performance
  const promises = activeGuardrails.map((guardrail) =>
    runGuardrail(guardrail.name, guardrail.command, options),
  )

  const parallelResults = await Promise.all(promises)
  results.push(...parallelResults)

  return results
}

/**
 * Display results summary
 */
function displayResults(results: GuardrailResult[], options: GuardrailOptions): boolean {
  const passed = results.filter((r) => r.status === 'pass')
  const warned = results.filter((r) => r.status === 'warn')
  const failed = results.filter((r) => r.status === 'fail')
  const skipped = results.filter((r) => r.status === 'skip')

  console.log('\n📊 Guardrail Results')
  console.log('='.repeat(50))

  for (const result of results) {
    const icon = {
      pass: '✅',
      warn: '⚠️',
      fail: '❌',
      skip: '⏭️',
    }[result.status]

    const timing = result.duration ? ` (${result.duration}ms)` : ''
    console.log(`${icon} ${result.name}: ${result.message}${timing}`)

    if (result.details && result.details.length > 0) {
      for (const detail of result.details) {
        console.log(`   ${detail}`)
      }
    }
  }

  console.log('='.repeat(50))

  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0)
  console.log(
    `📈 Summary: ${passed.length} passed, ${warned.length} warnings, ${failed.length} failed, ${skipped.length} skipped`,
  )
  console.log(`⏱️  Total time: ${(totalDuration / 1000).toFixed(1)}s`)

  if (failed.length > 0 && !options.warnOnly) {
    console.error('\n❌ Pre-release guardrails failed!')
    console.log('\n💡 Next steps:')
    console.log('   • Fix the issues above before releasing')
    console.log('   • Run with --verbose for detailed output')
    console.log('   • Use --warn-only for development')
    return false
  } else if (warned.length > 0) {
    console.log('\n⚠️  Pre-release guardrails passed with warnings')
    if (!options.warnOnly) {
      console.log('   Consider addressing warnings before release')
    }
    return true
  } else {
    console.log('\n✅ All pre-release guardrails passed!')
    return true
  }
}

/**
 * Parse CLI arguments
 */
function parseCliArgs(): GuardrailOptions & { help?: boolean } {
  const { values } = parseArgs({
    options: {
      'quick': {
        type: 'boolean',
        short: 'q',
        default: false,
      },
      'verbose': {
        type: 'boolean',
        short: 'v',
        default: false,
      },
      'skip-security': {
        type: 'boolean',
        default: false,
      },
      'skip-export-maps': {
        type: 'boolean',
        default: false,
      },
      'skip-changesets': {
        type: 'boolean',
        default: false,
      },
      'warn-only': {
        type: 'boolean',
        short: 'w',
        default: false,
      },
      'help': {
        type: 'boolean',
        short: 'h',
        default: false,
      },
    },
    strict: true,
    allowPositionals: false,
  })

  return {
    quick: values.quick as boolean,
    verbose: values.verbose as boolean,
    skipSecurity: values['skip-security'] as boolean,
    skipExportMaps: values['skip-export-maps'] as boolean,
    skipChangesets: values['skip-changesets'] as boolean,
    warnOnly: values['warn-only'] as boolean,
    help: values.help as boolean,
  }
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(`
🛡️  Pre-Release Guardrails

Comprehensive pre-release validation for Node.js + pnpm monorepo

Usage:
  pnpm run guardrails [options]

Options:
  -q, --quick              Skip slow checks for fast feedback (<30s)
  -v, --verbose            Show detailed output from each check
  -w, --warn-only          Convert failures to warnings (development mode)
  --skip-security          Skip security scans
  --skip-export-maps       Skip export map validation
  --skip-changesets        Skip changeset validation
  -h, --help               Show this help message

Examples:
  pnpm run guardrails              # Full validation
  pnpm run guardrails --quick      # Quick checks only
  pnpm run guardrails --warn-only  # Development mode
  pnpm run guardrails -qw          # Quick dev checks

ADHD-Optimized Features:
  • Quick mode provides <30s feedback
  • Parallel execution for minimal wait time
  • Clear visual indicators with emojis
  • Actionable error messages
  • Development-friendly warn-only mode
`)
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const options = parseCliArgs()

  if (options.help) {
    displayHelp()
    process.exit(0)
  }

  console.log('🚀 Pre-Release Guardrails')
  console.log('   Validating code quality and security...\n')

  try {
    const results = await runAllGuardrails(options)

    if (results.length === 0) {
      console.log('⚠️  No guardrails were executed')
      process.exit(0)
    }

    const success = displayResults(results, options)

    if (!success) {
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

// Run if this is the main module
if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}
