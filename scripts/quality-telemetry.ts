#!/usr/bin/env tsx
/**
 * Quality Telemetry System - P2.4
 *
 * Collects and tracks ESLint rule violation statistics over time for
 * data-driven quality decisions and threshold calibration.
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import {
  createResult,
  formatOutput,
  parseOutputArgs,
  ProgressIndicator,
  type OutputOptions,
  type OutputResult,
} from './lib/output-formatter'
import { isCI, isGitHubActions } from './lib/workspace-utils'

interface ESLintResult {
  filePath: string
  messages: Array<{
    ruleId: string | null
    severity: number
    message: string
    line: number
    column: number
    nodeType?: string
    messageId?: string
    endLine?: number
    endColumn?: number
  }>
  errorCount: number
  warningCount: number
  fixableErrorCount: number
  fixableWarningCount: number
}

interface RuleViolation {
  ruleId: string
  severity: 'error' | 'warning'
  file: string
  line: number
  message: string
  timestamp: string
}

interface QualityMetrics {
  timestamp: string
  summary: {
    totalFiles: number
    errorCount: number
    warningCount: number
    fixableIssues: number
    duration: number
  }
  ruleViolations: RuleViolation[]
  topOffenders: Array<{
    ruleId: string
    count: number
    files: number
    severity: 'error' | 'warning'
  }>
  fileMetrics: Array<{
    file: string
    errorCount: number
    warningCount: number
    topRules: string[]
  }>
  trends?: {
    previousErrorCount?: number
    previousWarningCount?: number
    trend: 'improving' | 'stable' | 'degrading'
  }
}

/**
 * Run ESLint and collect detailed metrics
 */
async function collectQualityMetrics(progress?: ProgressIndicator): Promise<QualityMetrics> {
  progress?.update({ message: 'Running ESLint analysis...' })

  const startTime = Date.now()
  let eslintResults: ESLintResult[] = []

  try {
    // Run ESLint with JSON output to capture detailed results
    const output = execSync('npx eslint "**/*.{ts,tsx}" --format json ', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'], // Capture stderr too
    })

    eslintResults = JSON.parse(output)
  } catch (error: any) {
    // ESLint returns non-zero exit code for violations, but output might still be valid JSON
    if (error.stdout) {
      try {
        eslintResults = JSON.parse(error.stdout)
      } catch {
        throw new Error('Failed to parse ESLint output')
      }
    } else {
      throw new Error(`ESLint execution failed: ${error.message}`)
    }
  }

  const duration = Date.now() - startTime
  const timestamp = new Date().toISOString()

  // Process results into structured metrics
  const ruleViolations: RuleViolation[] = []
  const ruleCountMap = new Map<
    string,
    { count: number; files: Set<string>; severity: 'error' | 'warning' }
  >()

  let totalErrors = 0
  let totalWarnings = 0
  let totalFixable = 0

  for (const result of eslintResults) {
    totalErrors += result.errorCount
    totalWarnings += result.warningCount
    totalFixable += result.fixableErrorCount + result.fixableWarningCount

    for (const message of result.messages) {
      if (!message.ruleId) continue

      const severity = message.severity === 2 ? 'error' : 'warning'

      ruleViolations.push({
        ruleId: message.ruleId,
        severity,
        file: result.filePath,
        line: message.line,
        message: message.message,
        timestamp,
      })

      // Track rule frequency
      const existing = ruleCountMap.get(message.ruleId)
      if (existing) {
        existing.count++
        existing.files.add(result.filePath)
      } else {
        ruleCountMap.set(message.ruleId, {
          count: 1,
          files: new Set([result.filePath]),
          severity,
        })
      }
    }
  }

  // Generate top offenders list
  const topOffenders = Array.from(ruleCountMap.entries())
    .map(([ruleId, stats]) => ({
      ruleId,
      count: stats.count,
      files: stats.files.size,
      severity: stats.severity,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // File-level metrics
  const fileMetrics = eslintResults
    .filter((result) => result.errorCount > 0 || result.warningCount > 0)
    .map((result) => {
      const ruleIds = result.messages.map((m) => m.ruleId).filter(Boolean) as string[]
      const uniqueRules = [...new Set(ruleIds)]

      return {
        file: result.filePath.replace(process.cwd() + '/', ''),
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        topRules: uniqueRules.slice(0, 5),
      }
    })
    .sort((a, b) => b.errorCount + b.warningCount - (a.errorCount + a.warningCount))

  // Load previous metrics for trend analysis
  const trends = loadPreviousMetrics(totalErrors, totalWarnings)

  return {
    timestamp,
    summary: {
      totalFiles: eslintResults.length,
      errorCount: totalErrors,
      warningCount: totalWarnings,
      fixableIssues: totalFixable,
      duration,
    },
    ruleViolations,
    topOffenders,
    fileMetrics,
    trends,
  }
}

/**
 * Load previous metrics for trend analysis
 */
function loadPreviousMetrics(currentErrors: number, currentWarnings: number) {
  const metricsFile = '.lint-metrics.json'

  if (!existsSync(metricsFile)) {
    return undefined
  }

  try {
    const previous = JSON.parse(readFileSync(metricsFile, 'utf-8'))
    const prevErrors = previous.summary?.errorCount ?? 0
    const prevWarnings = previous.summary?.warningCount ?? 0

    const totalPrev = prevErrors + prevWarnings
    const totalCurrent = currentErrors + currentWarnings

    let trend: 'improving' | 'stable' | 'degrading' = 'stable'
    if (totalCurrent < totalPrev) trend = 'improving'
    else if (totalCurrent > totalPrev) trend = 'degrading'

    return {
      previousErrorCount: prevErrors,
      previousWarningCount: prevWarnings,
      trend,
    }
  } catch {
    return undefined
  }
}

/**
 * Save metrics to file for future trend analysis
 */
function saveMetrics(metrics: QualityMetrics): void {
  writeFileSync('.lint-metrics.json', JSON.stringify(metrics, null, 2))
}

/**
 * Format metrics for text output
 */
function formatMetricsText(metrics: QualityMetrics, options: OutputOptions): string {
  const colors = {
    reset: options.color === false ? '' : '\x1b[0m',
    bold: options.color === false ? '' : '\x1b[1m',
    dim: options.color === false ? '' : '\x1b[2m',
    red: options.color === false ? '' : '\x1b[31m',
    green: options.color === false ? '' : '\x1b[32m',
    yellow: options.color === false ? '' : '\x1b[33m',
    cyan: options.color === false ? '' : '\x1b[36m',
  }

  const lines: string[] = [
    '',
    `${colors.bold}${colors.cyan}📊 Quality Telemetry Report${colors.reset}`,
    `${colors.dim}${metrics.timestamp}${colors.reset}`,
    '',
  ]

  // Summary
  const { summary } = metrics
  const errorColor = summary.errorCount > 0 ? colors.red : colors.green
  const warningColor = summary.warningCount > 0 ? colors.yellow : colors.green

  lines.push(`${colors.bold}Summary:${colors.reset}`)
  lines.push(`  Files analyzed: ${colors.cyan}${summary.totalFiles}${colors.reset}`)
  lines.push(`  Errors: ${errorColor}${summary.errorCount}${colors.reset}`)
  lines.push(`  Warnings: ${warningColor}${summary.warningCount}${colors.reset}`)
  lines.push(`  Fixable issues: ${colors.green}${summary.fixableIssues}${colors.reset}`)
  lines.push(`  Duration: ${colors.dim}${summary.duration}ms${colors.reset}`)

  // Trends
  if (metrics.trends) {
    const trendColor =
      metrics.trends.trend === 'improving'
        ? colors.green
        : metrics.trends.trend === 'degrading'
          ? colors.red
          : colors.yellow
    const trendIcon =
      metrics.trends.trend === 'improving'
        ? '📈'
        : metrics.trends.trend === 'degrading'
          ? '📉'
          : '📊'

    lines.push(`  Trend: ${trendIcon} ${trendColor}${metrics.trends.trend}${colors.reset}`)
  }

  lines.push('')

  // Top offenders
  if (metrics.topOffenders.length > 0) {
    lines.push(`${colors.bold}Top Rule Violations:${colors.reset}`)

    for (const offender of metrics.topOffenders.slice(0, 10)) {
      const severityColor = offender.severity === 'error' ? colors.red : colors.yellow
      const icon = offender.severity === 'error' ? '❌' : '⚠️'

      lines.push(
        `  ${icon} ${severityColor}${offender.ruleId}${colors.reset}: ${offender.count} violations in ${offender.files} files`,
      )
    }

    lines.push('')
  }

  // Problem files
  if (metrics.fileMetrics.length > 0) {
    lines.push(`${colors.bold}Files Needing Attention:${colors.reset}`)

    for (const file of metrics.fileMetrics.slice(0, 10)) {
      const totalIssues = file.errorCount + file.warningCount
      const issueColor = file.errorCount > 0 ? colors.red : colors.yellow

      lines.push(`  ${issueColor}${file.file}${colors.reset}: ${totalIssues} issues`)

      if (options.verbose && file.topRules.length > 0) {
        lines.push(`    Rules: ${colors.dim}${file.topRules.join(', ')}${colors.reset}`)
      }
    }

    lines.push('')
  }

  // Recommendations
  if (summary.errorCount === 0 && summary.warningCount === 0) {
    lines.push(`${colors.green}✨ Excellent code quality! No violations found.${colors.reset}`)
    lines.push(
      `${colors.dim}Consider tightening rules for even stricter quality standards.${colors.reset}`,
    )
  } else {
    lines.push(`${colors.bold}Recommendations:${colors.reset}`)

    if (summary.fixableIssues > 0) {
      lines.push(
        `  • Run ${colors.cyan}pnpm lint --fix${colors.reset} to auto-fix ${summary.fixableIssues} issues`,
      )
    }

    if (metrics.topOffenders.length > 0) {
      const topRule = metrics.topOffenders[0]
      lines.push(
        `  • Focus on ${colors.yellow}${topRule.ruleId}${colors.reset} rule (${topRule.count} violations)`,
      )
    }
  }

  return lines.join('\n')
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const startTime = Date.now()
  const options = parseOutputArgs()

  const progress = !options.quiet && !isCI() ? new ProgressIndicator(options) : undefined

  try {
    progress?.start('Collecting quality telemetry')

    const metrics = await collectQualityMetrics(progress)

    progress?.update({ message: 'Saving metrics...' })
    saveMetrics(metrics)

    progress?.stop('Quality telemetry collection complete')

    const result: OutputResult = createResult(true, 'Quality telemetry collected', metrics)
    result.metadata!.duration = Date.now() - startTime

    // Add warnings for CI
    if (metrics.summary.errorCount > 0) {
      result.warnings = result.warnings || []
      result.warnings.push({
        code: 'QUALITY_ERRORS',
        message: `Found ${metrics.summary.errorCount} ESLint errors`,
        details: metrics.topOffenders.filter((o) => o.severity === 'error').slice(0, 5),
      })
    }

    console.log(formatOutput(result, options))

    // Text format additional output
    if (options.format !== 'json') {
      console.log(formatMetricsText(metrics, options))
    }

    // GitHub annotations
    if (isGitHubActions()) {
      for (const offender of metrics.topOffenders.slice(0, 3)) {
        if (offender.severity === 'error') {
          console.log(
            `::error::ESLint rule ${offender.ruleId} has ${offender.count} violations across ${offender.files} files`,
          )
        }
      }
    }
  } catch (error) {
    progress?.error('Quality telemetry collection failed')

    const result = createResult(false, 'Quality telemetry failed')
    result.errors = [
      {
        code: 'TELEMETRY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
    ]

    console.error(formatOutput(result, options))
    process.exit(1)
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
