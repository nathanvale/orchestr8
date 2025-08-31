#!/usr/bin/env tsx
/**
 * Lint Changed Files Script - P1.5 ADHD Flow Accelerator
 *
 * Provides sub-second ESLint feedback on git-changed files only.
 * Optimized for ADHD flow state - instant feedback loop on current work.
 *
 * Target: <1s execution time for typical change sets
 * Success: Zero cognitive overhead, immediate validation
 */

import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

interface LintMetrics {
  timestamp: string
  success: boolean
  durationMs: number
  fileCount: number
  changedFiles: string[]
  profile: string
  errors?: Array<{
    filePath: string
    line: number
    column: number
    rule: string
    message: string
    severity: string
  }>
}

/**
 * Get git changed files that should be linted
 */
function getChangedFiles(): string[] {
  try {
    // Get all changed files (staged + working directory)
    const staged = execSync('git diff --cached --name-only', { encoding: 'utf-8' }).trim()
    const unstaged = execSync('git diff --name-only', { encoding: 'utf-8' }).trim()

    const changedFiles = [
      ...(staged ? staged.split('\n') : []),
      ...(unstaged ? unstaged.split('\n') : []),
    ]

    // Filter for files that ESLint can process
    const lintableExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])

    return [...new Set(changedFiles)]
      .filter((file) => file.trim() !== '')
      .filter((file) => {
        const ext = path.extname(file)
        return lintableExtensions.has(ext)
      })
      .filter((file) => {
        // Exclude common ignore patterns
        return (
          !file.includes('node_modules/') &&
          !file.includes('dist/') &&
          !file.includes('coverage/') &&
          !file.startsWith('.changeset/') &&
          !file.includes('/.turbo/') &&
          !file.includes('/.next/')
        )
      })
  } catch (error) {
    console.warn('Warning: Could not get git changed files, falling back to empty list')
    return []
  }
}

/**
 * Run ESLint on specific files with performance optimization
 */
function lintFiles(files: string[]): { success: boolean; output: string; duration: number } {
  const startTime = Date.now()

  try {
    // Use ESLINT_PROFILE=dev for faster local feedback (no deep analysis)
    const env = { ...process.env, ESLINT_PROFILE: 'dev' }

    // Build file list, escaping spaces and special characters
    const fileList = files.map((f) => `"${f}"`).join(' ')

    const output = execSync(`pnpm eslint --format=json ${fileList}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    })

    return {
      success: true,
      output,
      duration: Date.now() - startTime,
    }
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout || '',
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Parse ESLint JSON output for metrics
 */
function parseESLintResults(jsonOutput: string): Array<{
  filePath: string
  line: number
  column: number
  rule: string
  message: string
  severity: string
}> {
  try {
    const results = JSON.parse(jsonOutput)
    const errors: Array<{
      filePath: string
      line: number
      column: number
      rule: string
      message: string
      severity: string
    }> = []

    for (const result of results) {
      for (const message of result.messages || []) {
        errors.push({
          filePath: result.filePath,
          line: message.line,
          column: message.column,
          rule: message.ruleId || 'unknown',
          message: message.message,
          severity: message.severity === 2 ? 'error' : 'warning',
        })
      }
    }

    return errors
  } catch {
    return []
  }
}

/**
 * Save lint metrics for dx:status integration
 */
function saveLintMetrics(metrics: LintMetrics): void {
  try {
    writeFileSync('.lint-metrics.json', JSON.stringify(metrics, null, 2))
  } catch (error) {
    console.warn('Warning: Could not save lint metrics:', error)
  }
}

/**
 * Format output for ADHD-friendly consumption
 */
function formatOutput(metrics: LintMetrics): string {
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
  }

  const lines: string[] = []

  // Header with timing
  const icon = metrics.success ? '✓' : '❌'
  const color = metrics.success ? colors.green : colors.red
  const durationText =
    metrics.durationMs < 1000
      ? `${metrics.durationMs}ms`
      : `${(metrics.durationMs / 1000).toFixed(1)}s`

  lines.push(`${icon} ${color}Lint${colors.reset} ${colors.dim}(${durationText})${colors.reset}`)

  // File count
  if (metrics.fileCount === 0) {
    lines.push(`${colors.dim}No changed files to lint${colors.reset}`)
  } else {
    lines.push(`${colors.dim}Checked ${metrics.fileCount} changed files${colors.reset}`)
  }

  // Error summary
  if (metrics.errors && metrics.errors.length > 0) {
    const errorCount = metrics.errors.filter((e) => e.severity === 'error').length
    const warningCount = metrics.errors.filter((e) => e.severity === 'warning').length

    if (errorCount > 0) {
      lines.push(`${colors.red}${errorCount} errors${colors.reset}`)
    }
    if (warningCount > 0) {
      lines.push(`${colors.yellow}${warningCount} warnings${colors.reset}`)
    }

    // Show first few errors for immediate feedback
    const firstErrors = metrics.errors.slice(0, 3)
    for (const error of firstErrors) {
      const relPath = path.relative(process.cwd(), error.filePath)
      const severity = error.severity === 'error' ? colors.red : colors.yellow
      lines.push(
        `  ${severity}${relPath}:${error.line}:${error.column}${colors.reset} ${error.message} ${colors.dim}(${error.rule})${colors.reset}`,
      )
    }

    if (metrics.errors.length > 3) {
      lines.push(`  ${colors.dim}...and ${metrics.errors.length - 3} more issues${colors.reset}`)
    }
  }

  return lines.join('\n')
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const startTime = Date.now()

  // Get changed files
  const changedFiles = getChangedFiles()

  if (changedFiles.length === 0) {
    const metrics: LintMetrics = {
      timestamp: new Date().toISOString(),
      success: true,
      durationMs: Date.now() - startTime,
      fileCount: 0,
      changedFiles: [],
      profile: 'dev',
    }

    saveLintMetrics(metrics)
    console.log(formatOutput(metrics))
    return
  }

  // Run ESLint on changed files
  const result = lintFiles(changedFiles)
  const errors = result.output ? parseESLintResults(result.output) : []

  const metrics: LintMetrics = {
    timestamp: new Date().toISOString(),
    success: result.success && errors.filter((e) => e.severity === 'error').length === 0,
    durationMs: result.duration,
    fileCount: changedFiles.length,
    changedFiles,
    profile: 'dev',
    errors: errors.length > 0 ? errors : undefined,
  }

  saveLintMetrics(metrics)
  console.log(formatOutput(metrics))

  // Exit with appropriate code
  process.exit(metrics.success ? 0 : 1)
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
