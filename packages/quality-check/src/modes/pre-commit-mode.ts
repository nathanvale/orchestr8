/**
 * Pre-commit mode for quality-check
 * Checks all staged files before commit
 */

import { execSync } from 'node:child_process'
import { extname } from 'node:path'

import type { Logger } from '@orchestr8/logger'

import type { QualityCheckOptions, QualityCheckResult } from '../types.js'

import { fileMode } from './file-mode.js'

// Supported file extensions
const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

/**
 * Get list of staged files from git
 */
function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    })

    return output
      .split('\n')
      .filter(Boolean)
      .filter((file) => SUPPORTED_EXTENSIONS.has(extname(file)))
  } catch {
    return []
  }
}

/**
 * Pre-commit mode - check all staged files
 */
export async function preCommitMode(
  options: QualityCheckOptions,
  logger: Logger,
): Promise<QualityCheckResult> {
  const startTime = performance.now()

  // Get staged files
  const stagedFiles = getStagedFiles()

  if (stagedFiles.length === 0) {
    console.log('✅ No staged files to check')
    return {
      success: true,
      errors: [],
      warnings: [],
      autofixes: [],
      correlationId: options.correlationId || 'pre-commit',
      duration: performance.now() - startTime,
      checkers: {},
    }
  }

  console.log(`🔍 Checking ${stagedFiles.length} staged file(s)...`)
  logger.debug('Staged files to check', { files: stagedFiles })

  // Check each file
  const results: QualityCheckResult[] = []
  let hasErrors = false

  for (const file of stagedFiles) {
    const result = await fileMode(file, options, logger)
    results.push(result)

    if (!result.success) {
      hasErrors = true
      console.error(`❌ ${file}`)
      if (result.checkers.eslint?.errors?.length) {
        result.checkers.eslint.errors.forEach((err) => console.error(`  ESLint: ${err}`))
      }
      if (result.checkers.prettier?.errors?.length) {
        result.checkers.prettier.errors.forEach((err) => console.error(`  Prettier: ${err}`))
      }
      if (result.checkers.typescript?.errors?.length) {
        result.checkers.typescript.errors.forEach((err) => console.error(`  TypeScript: ${err}`))
      }
    } else {
      console.log(`✅ ${file}`)
    }
  }

  const duration = performance.now() - startTime

  if (hasErrors) {
    console.error('\n❌ Pre-commit checks failed')
    console.error('Fix the issues above and try again')
  } else {
    console.log(`\n✅ All staged files passed quality checks (${duration.toFixed(0)}ms)`)
  }

  // Aggregate results
  const aggregatedResult: QualityCheckResult = {
    success: !hasErrors,
    errors: results.flatMap((r) => r.errors),
    warnings: results.flatMap((r) => r.warnings),
    autofixes: results.flatMap((r) => r.autofixes),
    correlationId: options.correlationId || 'pre-commit',
    duration,
    checkers: {
      eslint: {
        success: !results.some((r) => !r.checkers.eslint?.success),
        duration: results.reduce((sum, r) => sum + (r.checkers.eslint?.duration ?? 0), 0),
        errors: results.flatMap((r) => r.checkers.eslint?.errors ?? []),
        warnings: results.flatMap((r) => r.checkers.eslint?.warnings ?? []),
      },
      prettier: {
        success: !results.some((r) => !r.checkers.prettier?.success),
        duration: results.reduce((sum, r) => sum + (r.checkers.prettier?.duration ?? 0), 0),
        errors: results.flatMap((r) => r.checkers.prettier?.errors ?? []),
      },
      typescript: {
        success: !results.some((r) => !r.checkers.typescript?.success),
        duration: results.reduce((sum, r) => sum + (r.checkers.typescript?.duration ?? 0), 0),
        errors: results.flatMap((r) => r.checkers.typescript?.errors ?? []),
        warnings: results.flatMap((r) => r.checkers.typescript?.warnings ?? []),
      },
    },
  }

  return aggregatedResult
}
