#!/usr/bin/env tsx
/**
 * Structured output formatter for CI/CD and local development
 * Provides consistent JSON output, color control, and progress indicators
 */

import { isCI, isGitHubActions } from './workspace-utils'

export interface OutputOptions {
  format?: 'json' | 'text' | 'auto'
  color?: boolean | 'auto'
  verbose?: boolean
  quiet?: boolean
  ci?: boolean
}

export interface OutputResult {
  success: boolean
  message?: string
  data?: unknown
  errors?: Array<{ code: string; message: string; details?: unknown }>
  warnings?: Array<{ code: string; message: string; details?: unknown }>
  metadata?: {
    timestamp: string
    duration?: number
    version?: string
  }
}

export interface ProgressOptions {
  total?: number
  current?: number
  message?: string
  showSpinner?: boolean
}

/**
 * Determine if colors should be used based on environment
 */
export function shouldUseColor(options: OutputOptions = {}): boolean {
  if (options.color === true) return true
  if (options.color === false) return false

  // Auto-detect based on environment
  if (options.ci || isCI()) {
    // GitHub Actions supports colors
    return isGitHubActions()
  }

  // Check if stdout is TTY
  return process.stdout.isTTY ?? false
}

/**
 * Format output based on options
 */
export function formatOutput(result: OutputResult, options: OutputOptions = {}): string {
  const format = options.format ?? (isCI() ? 'json' : 'text')

  if (format === 'json') {
    return JSON.stringify(result, null, 2)
  }

  // Text format with optional colors
  const useColor = shouldUseColor(options)
  const colors = getColors(useColor)

  let output = ''

  // Status line
  if (result.success) {
    output += `${colors.green}✓ SUCCESS${colors.reset}`
  } else {
    output += `${colors.red}✗ FAILURE${colors.reset}`
  }

  if (result.message) {
    output += `: ${result.message}`
  }
  output += '\n'

  // Warnings
  if (result.warnings?.length) {
    output += `\n${colors.yellow}⚠ Warnings:${colors.reset}\n`
    for (const warning of result.warnings) {
      output += `  - [${warning.code}] ${warning.message}\n`
      if (options.verbose && warning.details) {
        output += `    ${JSON.stringify(warning.details, null, 2).replace(/\n/g, '\n    ')}\n`
      }
    }
  }

  // Errors
  if (result.errors?.length) {
    output += `\n${colors.red}✗ Errors:${colors.reset}\n`
    for (const error of result.errors) {
      output += `  - [${error.code}] ${error.message}\n`
      if (options.verbose && error.details) {
        output += `    ${JSON.stringify(error.details, null, 2).replace(/\n/g, '\n    ')}\n`
      }
    }
  }

  // Data (in verbose mode)
  if (options.verbose && result.data) {
    output += `\n${colors.cyan}📊 Data:${colors.reset}\n`
    output += JSON.stringify(result.data, null, 2) + '\n'
  }

  // Metadata
  if (result.metadata && !options.quiet) {
    output += `\n${colors.dim}`
    if (result.metadata.duration) {
      output += `Duration: ${formatDuration(result.metadata.duration)} | `
    }
    output += `Time: ${result.metadata.timestamp}`
    if (result.metadata.version) {
      output += ` | Version: ${result.metadata.version}`
    }
    output += colors.reset + '\n'
  }

  return output
}

/**
 * Get color codes based on color support
 */
function getColors(useColor: boolean) {
  if (!useColor) {
    return {
      reset: '',
      red: '',
      green: '',
      yellow: '',
      cyan: '',
      dim: '',
      bold: '',
    }
  }

  return {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
  }
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}m ${seconds}s`
}

/**
 * Simple progress indicator for CI environments
 */
export class ProgressIndicator {
  private startTime: number
  private lastUpdate: number = 0
  private spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  private spinnerIndex = 0
  private interval?: NodeJS.Timeout
  private useColor: boolean
  private isCI: boolean

  constructor(private options: OutputOptions = {}) {
    this.startTime = Date.now()
    this.useColor = shouldUseColor(options)
    this.isCI = options.ci ?? isCI()
  }

  start(message?: string): void {
    if (this.options.quiet) return

    if (this.isCI) {
      // Simple message for CI
      console.log(`⏳ ${message ?? 'Processing...'}`)
    } else {
      // Spinner for interactive terminals
      this.interval = setInterval(() => {
        this.update({ message })
      }, 100)
    }
  }

  update(progress: ProgressOptions): void {
    if (this.options.quiet) return

    const now = Date.now()

    // Throttle updates in CI (every 5 seconds)
    if (this.isCI && now - this.lastUpdate < 5000) {
      return
    }

    this.lastUpdate = now
    const elapsed = now - this.startTime

    if (this.isCI) {
      // Simple progress for CI
      let output = `⏳ ${progress.message ?? 'Processing'}`
      if (progress.total && progress.current) {
        const percent = Math.round((progress.current / progress.total) * 100)
        output += ` [${progress.current}/${progress.total}] ${percent}%`
      }
      output += ` (${formatDuration(elapsed)})`
      console.log(output)
    } else {
      // Interactive progress with spinner
      const colors = getColors(this.useColor)
      const spinner = this.spinner[this.spinnerIndex]
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinner.length

      let output = `\r${colors.cyan}${spinner}${colors.reset} ${progress.message ?? 'Processing'}`

      if (progress.total && progress.current) {
        const percent = Math.round((progress.current / progress.total) * 100)
        const barWidth = 20
        const filled = Math.round((progress.current / progress.total) * barWidth)
        const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled)
        output += ` ${colors.dim}[${colors.reset}${colors.green}${bar}${colors.reset}${colors.dim}]${colors.reset} ${percent}%`
      }

      output += ` ${colors.dim}(${formatDuration(elapsed)})${colors.reset}`
      process.stdout.write(output)
    }
  }

  stop(message?: string): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = undefined
    }

    if (!this.options.quiet) {
      const elapsed = Date.now() - this.startTime
      const colors = getColors(this.useColor)

      if (this.isCI) {
        console.log(`✓ ${message ?? 'Complete'} (${formatDuration(elapsed)})`)
      } else {
        // Clear the line and show completion
        process.stdout.write('\r' + ' '.repeat(80) + '\r')
        console.log(
          `${colors.green}✓${colors.reset} ${message ?? 'Complete'} ${colors.dim}(${formatDuration(elapsed)})${colors.reset}`,
        )
      }
    }
  }

  error(message: string): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = undefined
    }

    if (!this.options.quiet) {
      const colors = getColors(this.useColor)

      if (!this.isCI) {
        // Clear the line
        process.stdout.write('\r' + ' '.repeat(80) + '\r')
      }

      console.error(`${colors.red}✗${colors.reset} ${message}`)
    }
  }
}

/**
 * GitHub Actions annotation support
 */
export function emitGitHubAnnotation(
  level: 'error' | 'warning' | 'notice',
  message: string,
  file?: string,
  line?: number,
  column?: number,
): void {
  if (!isGitHubActions()) return

  let annotation = `:${level}`

  if (file) {
    annotation += ` file=${file}`
    if (line) {
      annotation += `,line=${line}`
      if (column) {
        annotation += `,col=${column}`
      }
    }
  }

  annotation += `::${message}`
  console.log(annotation)
}

/**
 * Create a structured result object
 */
export function createResult(success: boolean, message?: string, data?: unknown): OutputResult {
  return {
    success,
    message,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  }
}

/**
 * Parse command line arguments for output options
 */
export function parseOutputArgs(args: string[] = process.argv.slice(2)): OutputOptions {
  const options: OutputOptions = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--json':
        options.format = 'json'
        break
      case '--no-color':
        options.color = false
        break
      case '--color':
        options.color = true
        break
      case '--verbose':
      case '-v':
        options.verbose = true
        break
      case '--quiet':
      case '-q':
        options.quiet = true
        break
      case '--ci':
        options.ci = true
        break
    }
  }

  return options
}

export default {
  formatOutput,
  shouldUseColor,
  formatDuration,
  ProgressIndicator,
  emitGitHubAnnotation,
  createResult,
  parseOutputArgs,
}
