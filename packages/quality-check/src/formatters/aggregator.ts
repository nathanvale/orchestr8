import type { Issue, CheckerResult, QualityCheckResult, PerfMetrics } from '../types/issue-types'

/**
 * Aggregates results from multiple engines
 */
export class ResultAggregator {
  /**
   * Aggregate results from multiple engines
   */
  aggregate(
    results: Map<string, CheckerResult>,
    options?: {
      duration?: number
      correlationId?: string
      trackMetrics?: boolean
    },
  ): QualityCheckResult {
    const allIssues: Issue[] = []
    let totalDuration = 0
    let allSuccess = true

    // Collect all issues
    for (const [_engine, result] of results) {
      allIssues.push(...result.issues)

      if (result.duration) {
        totalDuration += result.duration
      }

      if (!result.success) {
        allSuccess = false
      }
    }

    // Build result
    const result: QualityCheckResult = {
      success: allSuccess,
      duration: options?.duration ?? totalDuration,
      issues: allIssues,
      correlationId: options?.correlationId,
    }

    // Add metrics if requested
    if (options?.trackMetrics) {
      result.metrics = this.buildMetrics(results, result.duration)
    }

    return result
  }

  /**
   * Build performance metrics
   */
  private buildMetrics(results: Map<string, CheckerResult>, totalDuration: number): PerfMetrics {
    const timestamp = new Date().toISOString()
    const isWarm = process.env.QC_WARM_RUN === 'true'

    const metrics: PerfMetrics = {
      timestamp,
      type: isWarm ? 'warm' : 'cold',
      durationMs: totalDuration,
      engines: {},
      issueCount: 0,
    }

    // Add engine-specific metrics
    for (const [engine, result] of results) {
      const engineKey = engine.toLowerCase() as 'typescript' | 'eslint' | 'prettier'

      metrics.engines![engineKey] = {
        enabled: true,
        durationMs: result.duration ?? 0,
        issueCount: result.issues.length,
      }

      metrics.issueCount! += result.issues.length
    }

    return metrics
  }

  /**
   * Merge multiple quality check results
   */
  mergeResults(results: QualityCheckResult[]): QualityCheckResult {
    const allIssues: Issue[] = []
    let totalDuration = 0
    let allSuccess = true

    for (const result of results) {
      allIssues.push(...result.issues)
      totalDuration += result.duration

      if (!result.success) {
        allSuccess = false
      }
    }

    return {
      success: allSuccess,
      duration: totalDuration,
      issues: allIssues,
    }
  }

  /**
   * Deduplicate issues
   */
  deduplicateIssues(issues: Issue[]): Issue[] {
    const seen = new Set<string>()
    const unique: Issue[] = []

    for (const issue of issues) {
      const key = `${issue.engine}:${issue.file}:${issue.line}:${issue.col}:${issue.ruleId ?? 'norule'}`

      if (!seen.has(key)) {
        seen.add(key)
        unique.push(issue)
      }
    }

    return unique
  }

  /**
   * Sort issues by severity and location
   */
  sortIssues(issues: Issue[]): Issue[] {
    return [...issues].sort((a, b) => {
      // Sort by severity first (error > warning > info)
      const severityOrder = { error: 0, warning: 1, info: 2 }
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) {
        return severityDiff
      }

      // Then by file
      const fileDiff = a.file.localeCompare(b.file)
      if (fileDiff !== 0) {
        return fileDiff
      }

      // Then by line
      const lineDiff = a.line - b.line
      if (lineDiff !== 0) {
        return lineDiff
      }

      // Finally by column
      return a.col - b.col
    })
  }

  /**
   * Filter issues by severity
   */
  filterBySeverity(issues: Issue[], severities: Array<Issue['severity']>): Issue[] {
    const severitySet = new Set(severities)
    return issues.filter((issue) => severitySet.has(issue.severity))
  }

  /**
   * Get statistics about issues
   */
  getStatistics(issues: Issue[]): {
    total: number
    byEngine: Record<string, number>
    bySeverity: Record<Issue['severity'], number>
    byFile: Map<string, number>
  } {
    const byEngine: Record<string, number> = {}
    const bySeverity: Record<Issue['severity'], number> = {
      error: 0,
      warning: 0,
      info: 0,
    }
    const byFile = new Map<string, number>()

    for (const issue of issues) {
      // By engine
      byEngine[issue.engine] = (byEngine[issue.engine] ?? 0) + 1

      // By severity
      bySeverity[issue.severity]++

      // By file
      byFile.set(issue.file, (byFile.get(issue.file) ?? 0) + 1)
    }

    return {
      total: issues.length,
      byEngine,
      bySeverity,
      byFile,
    }
  }
}
