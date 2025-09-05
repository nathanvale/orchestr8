import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

export interface MetricsData {
  totalIssues: number
  autoFixedIssues: number
  unfixableIssues: number
  successRate: number
  ruleBreakdown: Record<string, RuleMetrics>
  timestamp: string
  correlationId: string
}

export interface RuleMetrics {
  occurrences: number
  autoFixed: number
  blocked: number
  successRate: number
}

export interface PerformanceMetrics {
  classificationTime: number
  fixingTime: number
  totalTime: number
  fileSize: number
  issueCount: number
}

/**
 * Tracks operational metrics for the Autopilot engine
 */
export class MetricsTracker {
  private static instance: MetricsTracker
  private metricsCache: Map<string, MetricsData> = new Map()
  private performanceMetrics: PerformanceMetrics[] = []
  private metricsFilePath: string

  private constructor() {
    // Store metrics in a persistent location
    const homeDir = os.homedir()
    const metricsDir = path.join(homeDir, '.claude', 'quality-check', 'metrics')
    this.metricsFilePath = path.join(metricsDir, 'autopilot-metrics.json')
  }

  static getInstance(): MetricsTracker {
    if (!MetricsTracker.instance) {
      MetricsTracker.instance = new MetricsTracker()
    }
    return MetricsTracker.instance
  }

  /**
   * Track auto-fix success/failure metrics
   */
  async trackAutoFix(data: {
    correlationId: string
    totalIssues: number
    autoFixedIssues: number
    unfixableIssues: number
    ruleBreakdown: Record<string, { fixed: number; blocked: number }>
  }): Promise<void> {
    const metrics: MetricsData = {
      totalIssues: data.totalIssues,
      autoFixedIssues: data.autoFixedIssues,
      unfixableIssues: data.unfixableIssues,
      successRate: data.totalIssues > 0 ? data.autoFixedIssues / data.totalIssues : 0,
      ruleBreakdown: this.calculateRuleMetrics(data.ruleBreakdown),
      timestamp: new Date().toISOString(),
      correlationId: data.correlationId,
    }

    this.metricsCache.set(data.correlationId, metrics)
    await this.persistMetrics()
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metrics: PerformanceMetrics): void {
    this.performanceMetrics.push(metrics)

    // Keep only last 1000 performance entries to prevent memory bloat
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000)
    }
  }

  /**
   * Calculate metrics for individual rules
   */
  private calculateRuleMetrics(
    ruleBreakdown: Record<string, { fixed: number; blocked: number }>,
  ): Record<string, RuleMetrics> {
    const result: Record<string, RuleMetrics> = {}

    for (const [rule, data] of Object.entries(ruleBreakdown)) {
      const total = data.fixed + data.blocked
      result[rule] = {
        occurrences: total,
        autoFixed: data.fixed,
        blocked: data.blocked,
        successRate: total > 0 ? data.fixed / total : 0,
      }
    }

    return result
  }

  /**
   * Get aggregated metrics for reporting
   */
  async getAggregatedMetrics(): Promise<{
    overall: {
      totalRuns: number
      averageSuccessRate: number
      totalIssuesProcessed: number
      totalIssuesFixed: number
    }
    byRule: Record<
      string,
      {
        totalOccurrences: number
        totalFixed: number
        totalBlocked: number
        averageSuccessRate: number
      }
    >
    performance: {
      averageClassificationTime: number
      averageFixingTime: number
      p95ClassificationTime: number
      p95FixingTime: number
    }
  }> {
    await this.loadPersistedMetrics()

    const allMetrics = Array.from(this.metricsCache.values())

    // Calculate overall metrics
    const totalRuns = allMetrics.length
    const totalIssuesProcessed = allMetrics.reduce((sum, m) => sum + m.totalIssues, 0)
    const totalIssuesFixed = allMetrics.reduce((sum, m) => sum + m.autoFixedIssues, 0)
    const averageSuccessRate =
      totalIssuesProcessed > 0 ? totalIssuesFixed / totalIssuesProcessed : 0

    // Calculate by-rule metrics
    const ruleAggregates: Record<
      string,
      {
        totalOccurrences: number
        totalFixed: number
        totalBlocked: number
      }
    > = {}

    for (const metrics of allMetrics) {
      for (const [rule, ruleMetrics] of Object.entries(metrics.ruleBreakdown)) {
        if (!ruleAggregates[rule]) {
          ruleAggregates[rule] = {
            totalOccurrences: 0,
            totalFixed: 0,
            totalBlocked: 0,
          }
        }
        ruleAggregates[rule].totalOccurrences += ruleMetrics.occurrences
        ruleAggregates[rule].totalFixed += ruleMetrics.autoFixed
        ruleAggregates[rule].totalBlocked += ruleMetrics.blocked
      }
    }

    const byRule = Object.entries(ruleAggregates).reduce(
      (acc, [rule, data]) => {
        acc[rule] = {
          ...data,
          averageSuccessRate:
            data.totalOccurrences > 0 ? data.totalFixed / data.totalOccurrences : 0,
        }
        return acc
      },
      {} as Record<
        string,
        {
          totalOccurrences: number
          totalFixed: number
          totalBlocked: number
          averageSuccessRate: number
        }
      >,
    )

    // Calculate performance metrics
    const classificationTimes = this.performanceMetrics
      .map((m) => m.classificationTime)
      .sort((a, b) => a - b)
    const fixingTimes = this.performanceMetrics.map((m) => m.fixingTime).sort((a, b) => a - b)

    const p95Index = Math.floor(this.performanceMetrics.length * 0.95)

    return {
      overall: {
        totalRuns,
        averageSuccessRate,
        totalIssuesProcessed,
        totalIssuesFixed,
      },
      byRule,
      performance: {
        averageClassificationTime: this.average(classificationTimes),
        averageFixingTime: this.average(fixingTimes),
        p95ClassificationTime: classificationTimes[p95Index] || 0,
        p95FixingTime: fixingTimes[p95Index] || 0,
      },
    }
  }

  /**
   * Log edge cases for future rule refinement
   */
  async logEdgeCase(data: {
    correlationId: string
    rule: string
    context: string
    decision: string
    reason: string
  }): Promise<void> {
    const edgeCasesFile = path.join(path.dirname(this.metricsFilePath), 'edge-cases.jsonl')

    const entry = {
      ...data,
      timestamp: new Date().toISOString(),
    }

    try {
      await fs.mkdir(path.dirname(edgeCasesFile), { recursive: true })
      await fs.appendFile(edgeCasesFile, JSON.stringify(entry) + '\n')
    } catch (error) {
      // Log to console if file writing fails
      console.error('Failed to log edge case:', error)
    }
  }

  /**
   * Persist metrics to disk
   */
  private async persistMetrics(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.metricsFilePath), { recursive: true })

      const metricsArray = Array.from(this.metricsCache.entries()).map(([id, data]) => ({
        id,
        ...data,
      }))

      await fs.writeFile(this.metricsFilePath, JSON.stringify(metricsArray, null, 2))
    } catch (error) {
      // Don't fail the process if metrics can't be saved
      console.error('Failed to persist metrics:', error)
    }
  }

  /**
   * Load persisted metrics from disk
   */
  private async loadPersistedMetrics(): Promise<void> {
    try {
      const data = await fs.readFile(this.metricsFilePath, 'utf-8')
      const metricsArray = JSON.parse(data) as Array<MetricsData & { id: string }>

      this.metricsCache.clear()
      for (const entry of metricsArray) {
        const { id, ...metrics } = entry
        this.metricsCache.set(id, metrics)
      }
    } catch {
      // File might not exist yet, that's okay
    }
  }

  /**
   * Calculate average of an array of numbers
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length
  }

  /**
   * Generate a summary report
   */
  async generateReport(): Promise<string> {
    const metrics = await this.getAggregatedMetrics()

    const report = `
# Autopilot Engine Metrics Report
Generated: ${new Date().toISOString()}

## Overall Performance
- Total Runs: ${metrics.overall.totalRuns}
- Total Issues Processed: ${metrics.overall.totalIssuesProcessed}
- Total Issues Auto-Fixed: ${metrics.overall.totalIssuesFixed}
- Average Success Rate: ${(metrics.overall.averageSuccessRate * 100).toFixed(2)}%

## Top Rules by Frequency
${Object.entries(metrics.byRule)
  .sort((a, b) => b[1].totalOccurrences - a[1].totalOccurrences)
  .slice(0, 10)
  .map(
    ([rule, data]) =>
      `- ${rule}: ${data.totalOccurrences} occurrences, ${(data.averageSuccessRate * 100).toFixed(2)}% auto-fix rate`,
  )
  .join('\n')}

## Performance Metrics
- Average Classification Time: ${metrics.performance.averageClassificationTime.toFixed(2)}ms
- P95 Classification Time: ${metrics.performance.p95ClassificationTime.toFixed(2)}ms
- Average Fixing Time: ${metrics.performance.averageFixingTime.toFixed(2)}ms
- P95 Fixing Time: ${metrics.performance.p95FixingTime.toFixed(2)}ms
`

    return report
  }
}
