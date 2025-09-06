/**
 * Performance monitoring and reporting system
 */

import { performance } from 'node:perf_hooks'
import { logger } from '../utils/logger.js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'

export interface PerformanceMetric {
  engine: string
  operation: string
  duration: number
  timestamp: number
  fileCount?: number
  cacheHit?: boolean
  success: boolean
}

export interface PerformanceReport {
  summary: {
    totalDuration: number
    avgDuration: number
    medianDuration: number
    minDuration: number
    maxDuration: number
    successRate: number
    cacheHitRate?: number
  }
  byEngine: Record<
    string,
    {
      count: number
      avgDuration: number
      medianDuration: number
      successRate: number
    }
  >
  metrics: PerformanceMetric[]
  recommendations?: string[]
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private startTime: number = 0
  private cacheDir: string

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(tmpdir(), 'quality-check-perf')
  }

  /**
   * Start monitoring a new session
   */
  startSession(): void {
    this.metrics = []
    this.startTime = performance.now()
    logger.debug('Performance monitoring session started', {
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
    }

    this.metrics.push(fullMetric)

    logger.debug('Performance metric recorded', {
      engine: metric.engine,
      operation: metric.operation,
      duration: metric.duration,
      success: metric.success,
    })
  }

  /**
   * Track an operation with automatic timing
   */
  async trackOperation<T>(
    engine: string,
    operation: string,
    fn: () => Promise<T>,
    options?: { fileCount?: number; cacheHit?: boolean },
  ): Promise<T> {
    const start = performance.now()
    let success = true

    try {
      const result = await fn()
      return result
    } catch (error) {
      success = false
      throw error
    } finally {
      const duration = performance.now() - start
      this.recordMetric({
        engine,
        operation,
        duration,
        success,
        ...options,
      })
    }
  }

  /**
   * Generate a performance report
   */
  generateReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return {
        summary: {
          totalDuration: 0,
          avgDuration: 0,
          medianDuration: 0,
          minDuration: 0,
          maxDuration: 0,
          successRate: 0,
        },
        byEngine: {},
        metrics: [],
      }
    }

    const durations = this.metrics.map((m) => m.duration).sort((a, b) => a - b)
    const totalDuration = performance.now() - this.startTime
    const successCount = this.metrics.filter((m) => m.success).length
    const cacheHits = this.metrics.filter((m) => m.cacheHit === true).length
    const cacheTotal = this.metrics.filter((m) => m.cacheHit !== undefined).length

    // Group metrics by engine
    const byEngine: Record<string, PerformanceMetric[]> = {}
    for (const metric of this.metrics) {
      if (!byEngine[metric.engine]) {
        byEngine[metric.engine] = []
      }
      byEngine[metric.engine].push(metric)
    }

    // Calculate per-engine statistics
    const engineStats: PerformanceReport['byEngine'] = {}
    for (const [engine, metrics] of Object.entries(byEngine)) {
      const engineDurations = metrics.map((m) => m.duration).sort((a, b) => a - b)
      const engineSuccess = metrics.filter((m) => m.success).length

      const median =
        engineDurations.length % 2 === 0
          ? (engineDurations[engineDurations.length / 2 - 1] +
              engineDurations[engineDurations.length / 2]) /
            2
          : engineDurations[Math.floor(engineDurations.length / 2)]

      engineStats[engine] = {
        count: metrics.length,
        avgDuration: engineDurations.reduce((a, b) => a + b, 0) / engineDurations.length,
        medianDuration: median,
        successRate: (engineSuccess / metrics.length) * 100,
      }
    }

    const overallMedian =
      durations.length % 2 === 0
        ? (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2
        : durations[Math.floor(durations.length / 2)]

    const report: PerformanceReport = {
      summary: {
        totalDuration,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        medianDuration: overallMedian,
        minDuration: durations[0],
        maxDuration: durations[durations.length - 1],
        successRate: (successCount / this.metrics.length) * 100,
        ...(cacheTotal > 0 && { cacheHitRate: (cacheHits / cacheTotal) * 100 }),
      },
      byEngine: engineStats,
      metrics: this.metrics,
    }

    // Add recommendations based on performance
    report.recommendations = this.generateRecommendations(report)

    return report
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(report: PerformanceReport): string[] {
    const recommendations: string[] = []

    // Check median duration
    if (report.summary.medianDuration > 300) {
      recommendations.push(
        `Median duration (${report.summary.medianDuration.toFixed(0)}ms) exceeds 300ms target. Consider:`,
        '  - Enabling TypeScript incremental compilation',
        '  - Using ESLint and Prettier caching',
        '  - Checking fewer files per run',
      )
    }

    // Check cache hit rate
    if (report.summary.cacheHitRate !== undefined && report.summary.cacheHitRate < 50) {
      recommendations.push(
        `Low cache hit rate (${report.summary.cacheHitRate.toFixed(1)}%). Consider:`,
        '  - Ensuring cache directories are persistent',
        '  - Checking cache configuration',
      )
    }

    // Check engine-specific performance
    for (const [engine, stats] of Object.entries(report.byEngine)) {
      if (stats.avgDuration > 500) {
        recommendations.push(
          `${engine} average duration (${stats.avgDuration.toFixed(0)}ms) is high. Consider:`,
          `  - Optimizing ${engine} configuration`,
          '  - Reducing scope of checks',
        )
      }

      if (stats.successRate < 90) {
        recommendations.push(
          `${engine} has low success rate (${stats.successRate.toFixed(1)}%). Check for:`,
          '  - Configuration issues',
          '  - Missing dependencies',
        )
      }
    }

    // Check for outliers
    const outlierThreshold = report.summary.avgDuration * 3
    const outliers = report.metrics.filter((m) => m.duration > outlierThreshold)
    if (outliers.length > 0) {
      recommendations.push(
        `Found ${outliers.length} performance outliers. Investigate:`,
        ...outliers
          .slice(0, 3)
          .map((o) => `  - ${o.engine}:${o.operation} took ${o.duration.toFixed(0)}ms`),
      )
    }

    return recommendations
  }

  /**
   * Save performance report to file
   */
  async saveReport(report: PerformanceReport, filename?: string): Promise<string> {
    await fs.mkdir(this.cacheDir, { recursive: true })

    const reportFile = filename || `perf-report-${Date.now()}.json`
    const reportPath = path.join(this.cacheDir, reportFile)

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))

    logger.info('Performance report saved', {
      path: reportPath,
      totalDuration: report.summary.totalDuration.toFixed(2),
      medianDuration: report.summary.medianDuration.toFixed(2),
    })

    return reportPath
  }

  /**
   * Load historical performance reports
   */
  async loadHistoricalReports(limit = 10): Promise<PerformanceReport[]> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
      const files = await fs.readdir(this.cacheDir)
      const reportFiles = files
        .filter((f) => f.startsWith('perf-report-') && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit)

      const reports: PerformanceReport[] = []
      for (const file of reportFiles) {
        const content = await fs.readFile(path.join(this.cacheDir, file), 'utf-8')
        reports.push(JSON.parse(content))
      }

      return reports
    } catch (error) {
      logger.warn('Failed to load historical reports', { error })
      return []
    }
  }

  /**
   * Analyze performance trends
   */
  async analyzeTrends(): Promise<{
    trend: 'improving' | 'degrading' | 'stable'
    avgChange: number
    details: string[]
  }> {
    const reports = await this.loadHistoricalReports(5)

    if (reports.length < 2) {
      return {
        trend: 'stable',
        avgChange: 0,
        details: ['Insufficient historical data for trend analysis'],
      }
    }

    // Compare recent medians
    const recentMedians = reports.map((r) => r.summary.medianDuration)
    const avgRecent = recentMedians.slice(0, 2).reduce((a, b) => a + b, 0) / 2
    const avgOlder = recentMedians.slice(-2).reduce((a, b) => a + b, 0) / 2
    const change = ((avgRecent - avgOlder) / avgOlder) * 100

    let trend: 'improving' | 'degrading' | 'stable'
    const details: string[] = []

    if (Math.abs(change) < 5) {
      trend = 'stable'
      details.push('Performance is stable over recent runs')
    } else if (change < 0) {
      trend = 'improving'
      details.push(`Performance improved by ${Math.abs(change).toFixed(1)}%`)
    } else {
      trend = 'degrading'
      details.push(`Performance degraded by ${change.toFixed(1)}%`)
    }

    // Check cache hit trends
    const cacheRates = reports
      .map((r) => r.summary.cacheHitRate)
      .filter((r) => r !== undefined) as number[]

    if (cacheRates.length >= 2) {
      const recentCache = cacheRates[0]
      const olderCache = cacheRates[cacheRates.length - 1]
      const cacheChange = recentCache - olderCache

      if (Math.abs(cacheChange) > 10) {
        details.push(
          cacheChange > 0
            ? `Cache hit rate improved by ${cacheChange.toFixed(1)}%`
            : `Cache hit rate decreased by ${Math.abs(cacheChange).toFixed(1)}%`,
        )
      }
    }

    return { trend, avgChange: change, details }
  }

  /**
   * Print a formatted performance summary
   */
  printSummary(report: PerformanceReport): void {
    console.log('\n=== Performance Report ===\n')

    console.log('Summary:')
    console.log(`  Total Duration: ${report.summary.totalDuration.toFixed(2)}ms`)
    console.log(`  Median Duration: ${report.summary.medianDuration.toFixed(2)}ms`)
    console.log(`  Average Duration: ${report.summary.avgDuration.toFixed(2)}ms`)
    console.log(
      `  Min/Max: ${report.summary.minDuration.toFixed(2)}ms / ${report.summary.maxDuration.toFixed(2)}ms`,
    )
    console.log(`  Success Rate: ${report.summary.successRate.toFixed(1)}%`)

    if (report.summary.cacheHitRate !== undefined) {
      console.log(`  Cache Hit Rate: ${report.summary.cacheHitRate.toFixed(1)}%`)
    }

    if (Object.keys(report.byEngine).length > 0) {
      console.log('\nBy Engine:')
      for (const [engine, stats] of Object.entries(report.byEngine)) {
        console.log(`  ${engine}:`)
        console.log(`    Operations: ${stats.count}`)
        console.log(`    Avg Duration: ${stats.avgDuration.toFixed(2)}ms`)
        console.log(`    Median Duration: ${stats.medianDuration.toFixed(2)}ms`)
        console.log(`    Success Rate: ${stats.successRate.toFixed(1)}%`)
      }
    }

    if (report.recommendations && report.recommendations.length > 0) {
      console.log('\nRecommendations:')
      for (const rec of report.recommendations) {
        console.log(`  ${rec}`)
      }
    }

    console.log('\n=========================\n')
  }
}
