#!/usr/bin/env tsx
/**
 * Pre-Release Validation Orchestrator
 *
 * Composite script that ensures proper sequencing of build → test → guardrails → publish gate.
 * This prevents CI timing issues and ensures all validations run in correct order.
 */

/* eslint-disable no-console */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { parseArgs } from 'node:util'

interface ValidationOptions {
  quick?: boolean
  verbose?: boolean
  skipBuild?: boolean
  skipTests?: boolean
  skipGuardrails?: boolean
  warnOnly?: boolean
}

interface ValidationStep {
  name: string
  command: string
  required: boolean
  condition?: () => boolean
}

/**
 * Execute a validation step with proper error handling
 */
async function executeStep(step: ValidationStep, options: ValidationOptions): Promise<boolean> {
  const startTime = Date.now()

  // Check condition if provided
  if (step.condition && !step.condition()) {
    console.log(`⏭️  Skipping ${step.name} (condition not met)`)
    return true
  }

  console.log(`\n🔄 Running ${step.name}...`)

  try {
    execSync(step.command, {
      stdio: options.verbose ? 'inherit' : 'pipe',
      encoding: 'utf-8',
      timeout: 300000, // 5 minute timeout per step
    })

    const duration = Date.now() - startTime
    console.log(`✅ ${step.name} completed (${duration}ms)`)
    return true
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`❌ ${step.name} failed (${duration}ms)`)

    if (options.verbose) {
      console.error('Error details:', error.message)
      if (error.stdout) console.error('STDOUT:', error.stdout)
      if (error.stderr) console.error('STDERR:', error.stderr)
    }

    if (step.required && !options.warnOnly) {
      console.error(`\n💥 ${step.name} is required - stopping validation pipeline`)
      return false
    } else {
      console.warn(
        `⚠️  ${step.name} failed but continuing (${step.required ? 'warn-only mode' : 'optional step'})`,
      )
      return true
    }
  }
}

/**
 * Main validation pipeline
 */
async function runValidationPipeline(options: ValidationOptions): Promise<boolean> {
  console.log('🚀 Pre-Release Validation Pipeline')
  console.log('   Ensuring proper build → test → guardrails sequence...\n')

  const steps: ValidationStep[] = []

  // Step 1: Build (ensures artifacts exist for export map validation)
  if (!options.skipBuild) {
    steps.push({
      name: 'Build All Packages',
      command: 'pnpm build:all',
      required: true,
      condition: () => existsSync('package.json'), // Only if this is a package-based project
    })
  }

  // Step 2: Test with Coverage (ensures code quality baseline)
  if (!options.skipTests) {
    steps.push({
      name: 'Test Suite with Coverage',
      command: options.quick ? 'pnpm test --run' : 'pnpm test --coverage',
      required: true,
    })
  }

  // Step 3: Guardrails (now that build artifacts exist)
  if (!options.skipGuardrails) {
    const guardrailFlags = []
    if (options.quick) guardrailFlags.push('--quick')
    if (options.verbose) guardrailFlags.push('--verbose')
    if (options.warnOnly) guardrailFlags.push('--warn-only')

    steps.push({
      name: 'Pre-Release Guardrails',
      command: `tsx scripts/pre-release-guardrails.ts ${guardrailFlags.join(' ')}`,
      required: true,
    })
  }

  // Step 4: Final Publish Gate (ensures everything is ready)
  steps.push({
    name: 'Publish Readiness Check',
    command: 'pnpm changeset status',
    required: false, // Optional - just informational
  })

  // Execute pipeline
  let success = true
  for (const step of steps) {
    const stepResult = await executeStep(step, options)
    if (!stepResult) {
      success = false
      break
    }
  }

  return success
}

/**
 * Parse CLI arguments
 */
function parseCliArgs(): ValidationOptions {
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
      'skip-build': {
        type: 'boolean',
        default: false,
      },
      'skip-tests': {
        type: 'boolean',
        default: false,
      },
      'skip-guardrails': {
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
    skipBuild: values['skip-build'] as boolean,
    skipTests: values['skip-tests'] as boolean,
    skipGuardrails: values['skip-guardrails'] as boolean,
    warnOnly: values['warn-only'] as boolean,
  }
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(`
🚀 Pre-Release Validation Pipeline

Ensures proper sequencing: build → test → guardrails → publish gate
Prevents CI timing issues and export map validation failures.

Usage:
  pnpm validate:pre-release [options]

Options:
  -q, --quick              Quick mode (faster tests, quick guardrails)
  -v, --verbose            Show detailed output from each step
  -w, --warn-only          Continue on failures (development mode)
  --skip-build             Skip build step (use existing artifacts)
  --skip-tests             Skip test execution
  --skip-guardrails        Skip guardrail validation
  -h, --help               Show this help message

Examples:
  pnpm validate:pre-release              # Full validation pipeline
  pnpm validate:pre-release --quick      # Fast validation
  pnpm validate:pre-release --warn-only  # Development mode
  pnpm validate:pre-release --skip-build # Skip build (CI post-build)

Sequencing Benefits:
  • Build artifacts exist before export map linting
  • Test coverage available for quality gates
  • All validations run even if some fail (diagnostic mode)
  • Clear pipeline progression with timing
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

  try {
    const success = await runValidationPipeline(options)

    if (success) {
      console.log('\n🎉 All pre-release validations passed!')
      console.log('   Ready for publish or deployment')
    } else {
      console.error('\n💥 Pre-release validation failed!')
      console.log('   Fix issues before releasing')
      process.exit(1)
    }
  } catch (error) {
    console.error('\n❌ Validation pipeline error:', error)
    process.exit(1)
  }
}

// Run if this script is executed directly
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}
