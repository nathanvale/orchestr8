#!/usr/bin/env node
/**
 * Main entry point for @template/quality-check
 * Supports both CLI and programmatic usage
 */

import { isatty } from 'node:tty'

import { createLogger, generateCorrelationId } from '@orchestr8/logger'

import type { QualityCheckOptions, QualityCheckResult } from './types.js'

import { fileMode } from './modes/file-mode.js'
import { hookMode } from './modes/hook-mode.js'
import { preCommitMode } from './modes/pre-commit-mode.js'

// Check if running as CLI (npx or direct execution)
const isCliMode = import.meta.url === `file://${process.argv[1]}`

if (isCliMode) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}

async function main(): Promise<void> {
  const logger = await createLogger({
    name: 'quality-check',
    level: process.env.DEBUG ? 'debug' : 'info',
  })

  // Check Node.js version
  const nodeVersion = parseInt(process.versions.node.split('.')[0] ?? '0', 10)
  if (nodeVersion < 18) {
    console.error('❌ Node.js 18+ required')
    process.exit(1)
  }

  const args = process.argv.slice(2)
  const options = parseArgs(args)

  // Generate correlation ID if not provided
  if (!options.correlationId) {
    options.correlationId = generateCorrelationId('qc')
  }

  logger.debug('Starting quality check', { options, correlationId: options.correlationId })

  try {
    // Check for help first, before any other processing
    if (args.includes('--help') || args.includes('-h')) {
      showHelp()
      return
    }

    // Handle pre-commit mode first
    if (options.preCommit) {
      logger.debug('Running in pre-commit mode')
      const result = await preCommitMode(options, logger)
      handleResult(result)
      return
    }

    // Auto-detect hook mode when stdin is available and not a TTY
    const stdinAvailable = !isatty(0)

    if (stdinAvailable && !options.file) {
      // Hook mode - reading from stdin (Claude Code PostToolUse)
      logger.debug('Detected hook mode via stdin')
      const result = await hookMode(options, logger)
      handleResult(result)
    } else if (options.file) {
      // Direct file mode
      logger.debug('Running in file mode', { file: options.file })
      const result = await fileMode(options.file, options, logger)
      handleResult(result)
    } else {
      // Default behavior - try to read from stdin if available
      if (stdinAvailable) {
        const result = await hookMode(options, logger)
        handleResult(result)
      } else {
        console.error('❌ No file specified and no stdin input detected')
        console.error('Usage: npx @template/quality-check --file <path>')
        console.error(
          '   or: echo \'{"tool":"Write","path":"file.ts"}\' | npx @template/quality-check',
        )
        process.exit(1)
      }
    }
  } catch (error) {
    logger.error('Quality check failed', { error })
    console.error(
      '❌ Quality check failed:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

function parseArgs(args: string[]): QualityCheckOptions {
  const options: QualityCheckOptions = {
    eslint: true,
    prettier: true,
    typescript: true,
    fix: false,
    parallel: true,
    respectGitignore: true,
    timeout: 5000,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

    switch (arg) {
      case '--file':
      case '-f':
        if (nextArg) {
          options.file = nextArg
          i++
        }
        break
      case '--fix':
        options.fix = true
        break
      case '--no-eslint':
        options.eslint = false
        break
      case '--no-prettier':
        options.prettier = false
        break
      case '--no-typescript':
        options.typescript = false
        break
      case '--debug':
        options.debug = true
        break
      case '--silent':
        options.silent = true
        break
      case '--sequential':
        options.parallel = false
        break
      case '--timeout':
        if (nextArg) {
          options.timeout = parseInt(nextArg, 10)
          i++
        }
        break
      case '--pre-commit':
        options.preCommit = true
        break
    }
  }

  return options
}

function handleResult(result: QualityCheckResult): void {
  // Exit codes based on result
  // 0 = success
  // 1 = general error
  // 2 = ESLint errors
  // 3 = Prettier errors
  // 4 = TypeScript errors
  // 5 = Multiple checker errors
  // 124 = timeout

  if (result.success) {
    process.exit(0)
  }

  let exitCode = 1
  const failedCheckers = []

  if (result.checkers.eslint && !result.checkers.eslint.success) {
    failedCheckers.push('eslint')
  }
  if (result.checkers.prettier && !result.checkers.prettier.success) {
    failedCheckers.push('prettier')
  }
  if (result.checkers.typescript && !result.checkers.typescript.success) {
    failedCheckers.push('typescript')
  }

  if (failedCheckers.length === 1) {
    switch (failedCheckers[0]) {
      case 'eslint':
        exitCode = 2
        break
      case 'prettier':
        exitCode = 3
        break
      case 'typescript':
        exitCode = 4
        break
    }
  } else if (failedCheckers.length > 1) {
    exitCode = 5
  }

  process.exit(exitCode)
}

function showHelp(): void {
  console.log(`
@template/quality-check - Fast quality checks for ESLint, Prettier, and TypeScript

Usage:
  npx @template/quality-check --file <path>        Check a specific file
  npx @template/quality-check --pre-commit         Check all staged files
  echo '{"tool":"Write","path":"file.ts"}' | npx @template/quality-check   Hook mode

Options:
  --file, -f <path>    Check a specific file
  --pre-commit         Check all staged files (for git pre-commit hooks)
  --fix                Enable auto-fix for ESLint and Prettier
  --no-eslint          Skip ESLint checks
  --no-prettier        Skip Prettier checks
  --no-typescript      Skip TypeScript checks
  --debug              Enable debug logging
  --silent             Suppress output
  --sequential         Run checks sequentially instead of in parallel
  --timeout <ms>       Set timeout in milliseconds (default: 5000)
  --help, -h           Show this help message

Exit Codes:
  0 - Success
  1 - General error
  2 - ESLint errors
  3 - Prettier errors
  4 - TypeScript errors
  5 - Multiple checker errors
  124 - Timeout

Examples:
  # Check a single file
  npx @template/quality-check --file src/index.ts

  # Check with auto-fix
  npx @template/quality-check --file src/index.ts --fix

  # Check staged files in pre-commit hook
  npx @template/quality-check --pre-commit

  # Use as Claude Code PostToolUse hook
  echo '{"tool":"Write","path":"src/index.ts"}' | npx @template/quality-check
`)
  process.exit(0)
}

// Export for programmatic use
export { QualityChecker } from './core/quality-checker.js'
export type * from './types.js'
export { SafeFileOperations } from './utils/safe-file-operations.js'
