#!/usr/bin/env tsx
/**
 * CI Quality Reporting - P2.5
 *
 * Generates automated lint statistics and "top offenders" reports for CI,
 * helping focus refactoring efforts on the highest-impact quality improvements.
 */

import { existsSync, readFileSync } from 'node:fs'
import {
  createResult,
  emitGitHubAnnotation,
  formatOutput,
  parseOutputArgs,
  type OutputOptions,
  type OutputResult,
} from './lib/output-formatter'
import { isGitHubActions } from './lib/workspace-utils'

interface QualityReport {
  timestamp: string
  summary: {
    totalIssues: number
    errorCount: number
    warningCount: number
    fixableCount: number
    filesWithIssues: number
    qualityScore: number // 0-100 based on violations per file
  }
  trends: {
    trend: 'improving' | 'stable' | 'degrading'
    changeFromPrevious: number
    daysTracked: number
  }
  topOffenders: Array<{
    rule: string
    count: number
    severity: 'error' | 'warning'
    impact: 'high' | 'medium' | 'low'
    recommendation: string
  }>
  problematicFiles: Array<{
    file: string
    issueCount: number
    topRules: string[]
    priority: 'critical' | 'high' | 'medium' | 'low'
  }>
  recommendations: {
    immediate: string[]
    shortTerm: string[]
    longTerm: string[]
  }
}

/**
 * Load quality metrics from telemetry file
 */
function loadQualityMetrics(): any {
  const metricsFile = '.lint-metrics.json'

  if (!existsSync(metricsFile)) {
    throw new Error('No quality metrics found. Run `pnpm quality:telemetry` first.')
  }

  try {
    return JSON.parse(readFileSync(metricsFile, 'utf-8'))
  } catch (error) {
    throw new Error(`Failed to parse quality metrics: ${error}`)
  }
}

/**
 * Calculate quality score (0-100) based on violations per file
 */
function calculateQualityScore(totalIssues: number, totalFiles: number): number {
  if (totalFiles === 0) return 100

  const issuesPerFile = totalIssues / totalFiles

  // Quality score formula: 100 - (issues_per_file * 10), clamped to 0-100
  const score = Math.max(0, Math.min(100, 100 - issuesPerFile * 10))
  return Math.round(score)
}

/**
 * Determine impact level of a rule based on violation count and severity
 */
function determineRuleImpact(
  count: number,
  severity: 'error' | 'warning',
): 'high' | 'medium' | 'low' {
  if (severity === 'error') {
    if (count >= 10) return 'high'
    if (count >= 3) return 'medium'
    return 'low'
  } else {
    if (count >= 20) return 'high'
    if (count >= 10) return 'medium'
    return 'low'
  }
}

/**
 * Get recommendation for a rule based on its pattern
 */
function getRuleRecommendation(ruleId: string): string {
  const recommendations: Record<string, string> = {
    'complexity': 'Break down complex functions into smaller, focused units',
    'max-lines-per-function': 'Extract helper functions to reduce function size',
    'sonarjs/cognitive-complexity': 'Simplify conditional logic and reduce nesting',
    'max-depth': 'Use early returns to reduce nesting depth',
    '@typescript-eslint/no-explicit-any': 'Add proper TypeScript types instead of any',
    '@typescript-eslint/no-floating-promises': 'Handle promises with await or .catch()',
    'sonarjs/no-duplicate-string': 'Extract repeated strings to constants',
    'security/detect-object-injection': 'Validate object keys before accessing dynamic properties',
    'no-console': 'Use proper logging framework instead of console statements',
  }

  return recommendations[ruleId] || 'Review and fix this violation according to ESLint docs'
}

/**
 * Generate comprehensive quality report
 */
function generateQualityReport(metrics: any): QualityReport {
  const { summary, topOffenders, fileMetrics, trends } = metrics

  const qualityScore = calculateQualityScore(
    summary.errorCount + summary.warningCount,
    summary.totalFiles,
  )

  // Process top offenders with impact analysis
  const processedOffenders = topOffenders.slice(0, 10).map((offender: any) => ({
    rule: offender.ruleId,
    count: offender.count,
    severity: offender.severity,
    impact: determineRuleImpact(offender.count, offender.severity),
    recommendation: getRuleRecommendation(offender.ruleId),
  }))

  // Process problematic files with priority
  const problematicFiles = fileMetrics.slice(0, 15).map((file: any) => {
    const totalIssues = file.errorCount + file.warningCount
    let priority: 'critical' | 'high' | 'medium' | 'low' = 'low'

    if (file.errorCount >= 5) priority = 'critical'
    else if (file.errorCount >= 2 || totalIssues >= 10) priority = 'high'
    else if (totalIssues >= 5) priority = 'medium'

    return {
      file: file.file,
      issueCount: totalIssues,
      topRules: file.topRules,
      priority,
    }
  })

  // Generate actionable recommendations
  const recommendations = generateRecommendations(
    processedOffenders,
    problematicFiles,
    qualityScore,
  )

  // Calculate trend information
  const trendInfo = {
    trend: trends?.trend || 'stable',
    changeFromPrevious: trends
      ? summary.errorCount +
        summary.warningCount -
        (trends.previousErrorCount + trends.previousWarningCount)
      : 0,
    daysTracked: 1, // Could be enhanced to track across multiple runs
  }

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: summary.errorCount + summary.warningCount,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
      fixableCount: summary.fixableIssues,
      filesWithIssues: fileMetrics.length,
      qualityScore,
    },
    trends: trendInfo,
    topOffenders: processedOffenders,
    problematicFiles,
    recommendations,
  }
}

/**
 * Generate actionable recommendations based on analysis
 */
function generateRecommendations(
  offenders: any[],
  files: any[],
  qualityScore: number,
): { immediate: string[]; shortTerm: string[]; longTerm: string[] } {
  const immediate: string[] = []
  const shortTerm: string[] = []
  const longTerm: string[] = []

  // Immediate actions for critical issues
  const criticalFiles = files.filter((f) => f.priority === 'critical')
  if (criticalFiles.length > 0) {
    immediate.push(`Fix ${criticalFiles.length} critical files with 5+ errors each`)
  }

  const highImpactErrors = offenders.filter((o) => o.severity === 'error' && o.impact === 'high')
  if (highImpactErrors.length > 0) {
    immediate.push(
      `Address ${highImpactErrors[0].rule} rule (${highImpactErrors[0].count} violations)`,
    )
  }

  // Short-term quality improvements
  if (qualityScore < 90) {
    shortTerm.push('Target quality score of 90+ by addressing top 3 rule violations')
  }

  const fixableCount = offenders.reduce((sum, o) => sum + o.count, 0)
  if (fixableCount > 10) {
    shortTerm.push('Run `pnpm lint --fix` to auto-resolve fixable issues')
  }

  // Long-term strategic improvements
  if (qualityScore >= 95) {
    longTerm.push('Consider tightening ESLint rules for even stricter quality standards')
  } else if (qualityScore < 80) {
    longTerm.push('Implement quality gates to prevent new violations')
  }

  const complexityOffenders = offenders.filter(
    (o) => o.rule.includes('complexity') || o.rule.includes('max-lines'),
  )
  if (complexityOffenders.length > 0) {
    longTerm.push('Refactor complex functions to improve maintainability')
  }

  return { immediate, shortTerm, longTerm }
}

/**
 * Format quality report for text output
 */
function formatReportText(report: QualityReport, options: OutputOptions): string {
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
    `${colors.bold}${colors.cyan}📊 Quality Report${colors.reset}`,
    `${colors.dim}${report.timestamp}${colors.reset}`,
    '',
  ]

  // Quality Score
  const scoreColor =
    report.summary.qualityScore >= 90
      ? colors.green
      : report.summary.qualityScore >= 70
        ? colors.yellow
        : colors.red

  lines.push(
    `${colors.bold}Quality Score: ${scoreColor}${report.summary.qualityScore}/100${colors.reset}`,
  )

  // Summary
  lines.push('')
  lines.push(`${colors.bold}Summary:${colors.reset}`)
  lines.push(`  Total Issues: ${report.summary.totalIssues}`)
  lines.push(`  Errors: ${colors.red}${report.summary.errorCount}${colors.reset}`)
  lines.push(`  Warnings: ${colors.yellow}${report.summary.warningCount}${colors.reset}`)
  lines.push(`  Fixable: ${colors.green}${report.summary.fixableCount}${colors.reset}`)
  lines.push(`  Files with Issues: ${report.summary.filesWithIssues}`)

  // Trends
  if (report.trends.changeFromPrevious !== 0) {
    const trendColor =
      report.trends.trend === 'improving'
        ? colors.green
        : report.trends.trend === 'degrading'
          ? colors.red
          : colors.yellow
    const trendIcon =
      report.trends.trend === 'improving' ? '📈' : report.trends.trend === 'degrading' ? '📉' : '📊'

    const change = report.trends.changeFromPrevious > 0 ? '+' : ''
    lines.push(
      `  Trend: ${trendIcon} ${trendColor}${report.trends.trend} (${change}${report.trends.changeFromPrevious})${colors.reset}`,
    )
  }

  lines.push('')

  // Top Offenders
  if (report.topOffenders.length > 0) {
    lines.push(`${colors.bold}Top Rule Violations:${colors.reset}`)

    for (const offender of report.topOffenders.slice(0, 5)) {
      const severityColor = offender.severity === 'error' ? colors.red : colors.yellow
      const impactIcon =
        offender.impact === 'high' ? '🔥' : offender.impact === 'medium' ? '⚠️' : '💡'

      lines.push(
        `  ${impactIcon} ${severityColor}${offender.rule}${colors.reset}: ${offender.count} violations`,
      )

      if (options.verbose) {
        lines.push(`     ${colors.dim}${offender.recommendation}${colors.reset}`)
      }
    }

    lines.push('')
  }

  // Problematic Files
  if (report.problematicFiles.length > 0) {
    lines.push(`${colors.bold}Files Needing Attention:${colors.reset}`)

    for (const file of report.problematicFiles.slice(0, 8)) {
      const priorityColor =
        file.priority === 'critical'
          ? colors.red
          : file.priority === 'high'
            ? colors.yellow
            : colors.dim
      const priorityIcon =
        file.priority === 'critical' ? '🚨' : file.priority === 'high' ? '⚠️' : '💡'

      lines.push(
        `  ${priorityIcon} ${priorityColor}${file.file}${colors.reset}: ${file.issueCount} issues`,
      )
    }

    lines.push('')
  }

  // Recommendations
  lines.push(`${colors.bold}Recommendations:${colors.reset}`)

  if (report.recommendations.immediate.length > 0) {
    lines.push(`  ${colors.red}🚨 Immediate:${colors.reset}`)
    for (const rec of report.recommendations.immediate) {
      lines.push(`    • ${rec}`)
    }
  }

  if (report.recommendations.shortTerm.length > 0) {
    lines.push(`  ${colors.yellow}⏳ Short-term:${colors.reset}`)
    for (const rec of report.recommendations.shortTerm) {
      lines.push(`    • ${rec}`)
    }
  }

  if (report.recommendations.longTerm.length > 0) {
    lines.push(`  ${colors.cyan}🎯 Long-term:${colors.reset}`)
    for (const rec of report.recommendations.longTerm) {
      lines.push(`    • ${rec}`)
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

  try {
    // Load quality metrics from telemetry
    const metrics = loadQualityMetrics()
    const report = generateQualityReport(metrics)

    const result: OutputResult = createResult(true, 'Quality report generated', report)
    result.metadata!.duration = Date.now() - startTime

    // Add warnings for CI based on quality score
    if (report.summary.qualityScore < 80) {
      result.warnings = result.warnings || []
      result.warnings.push({
        code: 'LOW_QUALITY_SCORE',
        message: `Quality score is ${report.summary.qualityScore}/100 (below 80 threshold)`,
        details: {
          errorCount: report.summary.errorCount,
          warningCount: report.summary.warningCount,
          topOffenders: report.topOffenders.slice(0, 3).map((o) => o.rule),
        },
      })
    }

    console.log(formatOutput(result, options))

    // Text format additional output
    if (options.format !== 'json') {
      console.log(formatReportText(report, options))
    }

    // GitHub annotations for CI
    if (isGitHubActions()) {
      // Annotate critical files
      for (const file of report.problematicFiles
        .filter((f) => f.priority === 'critical')
        .slice(0, 3)) {
        emitGitHubAnnotation(
          'error',
          `${file.file} has ${file.issueCount} quality issues and needs immediate attention`,
          file.file,
        )
      }

      // Annotate top high-impact rules
      for (const offender of report.topOffenders.filter((o) => o.impact === 'high').slice(0, 2)) {
        emitGitHubAnnotation(
          'warning',
          `Rule ${offender.rule} has ${offender.count} violations - ${offender.recommendation}`,
        )
      }

      // Quality score annotation
      if (report.summary.qualityScore < 80) {
        emitGitHubAnnotation(
          'error',
          `Quality score ${report.summary.qualityScore}/100 is below threshold (80)`,
        )
      } else if (report.summary.qualityScore < 90) {
        emitGitHubAnnotation(
          'warning',
          `Quality score ${report.summary.qualityScore}/100 could be improved`,
        )
      }
    }

    // Exit with appropriate code based on quality score
    const exitCode = report.summary.qualityScore < 70 ? 1 : 0
    process.exit(exitCode)
  } catch (error) {
    const result = createResult(false, 'Quality report generation failed')
    result.errors = [
      {
        code: 'REPORT_ERROR',
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
