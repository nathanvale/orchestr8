/**
 * Shared CLI utilities for consistent guardrails script interfaces
 */

import { parseArgs } from 'node:util'

export interface CommonCliOptions {
  help?: boolean
  verbose?: boolean
  quick?: boolean
}

export interface CliOption {
  type: 'boolean' | 'string'
  short?: string
  default?: boolean | string
  description: string
}

export interface CliConfig<T = Record<string, CliOption>> {
  title: string
  description: string
  usage: string
  options: T
  examples: Array<{ command: string; description: string }>
  additionalHelp?: string
}

/**
 * Parse CLI arguments with consistent error handling and help display
 */
export function parseCliArgs<T extends Record<string, CliOption>>(
  config: CliConfig<T>,
): Record<keyof T, boolean | string> & { help?: boolean } {
  const parseArgsOptions: Record<string, any> = {}

  // Build parseArgs options from config
  for (const [key, option] of Object.entries(config.options)) {
    parseArgsOptions[key] = {
      type: option.type,
      default: option.default ?? (option.type === 'boolean' ? false : undefined),
    }
    if (option.short) {
      parseArgsOptions[key].short = option.short
    }
  }

  // Always include help option
  parseArgsOptions.help = {
    type: 'boolean',
    short: 'h',
    default: false,
  }

  try {
    const { values } = parseArgs({
      options: parseArgsOptions,
      strict: true,
      allowPositionals: false,
    })

    // Show help if requested
    if (values.help) {
      displayHelp(config)
      process.exit(0)
    }

    return values as Record<keyof T, boolean | string> & { help?: boolean }
  } catch (error) {
    console.error(`❌ CLI Error: ${error.message}`)
    console.error(`\nRun with --help to see available options.`)
    process.exit(1)
  }
}

/**
 * Display standardized help text
 */
export function displayHelp<T extends Record<string, CliOption>>(config: CliConfig<T>): void {
  console.log(`
${config.title}

${config.description}

Usage:
  ${config.usage}

Options:`)

  // Display options with aligned descriptions
  const maxOptionLength = Math.max(
    ...Object.entries(config.options).map(([key, option]) => {
      const shortFlag = option.short ? `-${option.short}, ` : '    '
      return `${shortFlag}--${key}`.length
    }),
    '  -h, --help'.length,
  )

  for (const [key, option] of Object.entries(config.options)) {
    const shortFlag = option.short ? `-${option.short}, ` : '    '
    const fullFlag = `${shortFlag}--${key}`
    const padding = ' '.repeat(Math.max(0, maxOptionLength - fullFlag.length + 2))
    console.log(`  ${fullFlag}${padding}${option.description}`)
  }

  // Always show help option
  const helpPadding = ' '.repeat(Math.max(0, maxOptionLength - '  -h, --help'.length + 2))
  console.log(`  -h, --help${helpPadding}Show this help message`)

  if (config.examples.length > 0) {
    console.log(`\nExamples:`)
    for (const example of config.examples) {
      console.log(`  ${example.command.padEnd(30)} # ${example.description}`)
    }
  }

  if (config.additionalHelp) {
    console.log(`\n${config.additionalHelp}`)
  }

  console.log() // Empty line at end
}

/**
 * Standard exit with error message
 */
export function exitWithError(message: string, exitCode: number = 1): never {
  console.error(`❌ ${message}`)
  process.exit(exitCode)
}

/**
 * Standard success message with optional emoji
 */
export function logSuccess(message: string, emoji: string = '✅'): void {
  console.log(`${emoji} ${message}`)
}

/**
 * Standard warning message
 */
export function logWarning(message: string): void {
  console.warn(`⚠️  ${message}`)
}

/**
 * Standard info message
 */
export function logInfo(message: string): void {
  console.log(`ℹ️  ${message}`)
}

/**
 * Verbose-only logging
 */
export function logVerbose(message: string, verbose: boolean): void {
  if (verbose) {
    console.log(`   ${message}`)
  }
}

/**
 * Create a consistent CLI configuration for common guardrails patterns
 */
export function createGuardrailsCliConfig(
  title: string,
  description: string,
  scriptName: string,
  additionalOptions: Record<string, CliOption> = {},
  customExamples: Array<{ command: string; description: string }> = [],
): CliConfig {
  const baseOptions: Record<string, CliOption> = {
    verbose: {
      type: 'boolean',
      short: 'v',
      default: false,
      description: 'Show detailed output',
    },
    quick: {
      type: 'boolean',
      short: 'q',
      default: false,
      description: 'Skip time-intensive checks for faster feedback',
    },
  }

  const baseExamples = [
    { command: `tsx ${scriptName}`, description: 'Run full validation' },
    { command: `tsx ${scriptName} --quick`, description: 'Quick validation only' },
    { command: `tsx ${scriptName} --verbose`, description: 'Detailed output' },
    ...customExamples,
  ]

  return {
    title,
    description,
    usage: `tsx ${scriptName} [options]`,
    options: { ...baseOptions, ...additionalOptions },
    examples: baseExamples,
  }
}
