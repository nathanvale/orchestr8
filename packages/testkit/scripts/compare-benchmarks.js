#!/usr/bin/env node

/**
 * Benchmark comparison script
 *
 * Compares current benchmark results against baseline and detects regressions
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const BASELINE_PATH = resolve('benchmarks/baseline.json')
const CURRENT_PATH = resolve('bench-results.json')

// Regression thresholds (from baseline.json)
const REGRESSION_THRESHOLDS = {
  ops_per_second_decrease: 0.1, // 10% decrease is a regression
  avg_time_increase: 0.15, // 15% increase is a regression
  memory_increase: 0.2, // 20% increase is a regression
}

const ACCEPTABLE_VARIANCE = {
  ops_per_second: 0.05, // 5% variance is acceptable
  avg_time: 0.08, // 8% variance is acceptable
  memory: 0.1, // 10% variance is acceptable
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    console.warn('⚠️  No baseline file found. Run `pnpm bench:baseline` to create one.')
    return null
  }

  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
  } catch (error) {
    console.error('❌ Failed to load baseline:', error.message)
    return null
  }
}

function loadCurrentResults() {
  if (!existsSync(CURRENT_PATH)) {
    console.error('❌ No current benchmark results found. Run `pnpm bench:ci` first.')
    process.exit(1)
  }

  try {
    return JSON.parse(readFileSync(CURRENT_PATH, 'utf-8'))
  } catch (error) {
    console.error('❌ Failed to load current results:', error.message)
    process.exit(1)
  }
}

function extractMetricsFromVitest(vitestResults) {
  const metrics = {}

  if (!vitestResults.testResults) {
    console.warn('⚠️  No test results found in benchmark output')
    return metrics
  }

  for (const testFile of vitestResults.testResults) {
    const fileName = testFile.name.replace(/.*\//, '').replace('.bench.ts', '')

    if (!testFile.result?.benchmark) {
      continue
    }

    metrics[fileName] = {}

    for (const benchmark of testFile.result.benchmark) {
      const suiteName = benchmark.name
      metrics[fileName][suiteName] = {}

      for (const result of benchmark.result) {
        const testName = result.name

        // Convert vitest benchmark data to our format
        metrics[fileName][suiteName][testName] = {
          ops_per_second: result.hz || 0,
          avg_time_ms: result.mean || 0,
          p95_ms: result.p95 || 0,
          memory_mb: (result.mem?.mean || 0) / 1024 / 1024, // Convert bytes to MB
        }
      }
    }
  }

  return metrics
}

function compareMetric(current, baseline, metricName) {
  if (!baseline || baseline === 0) {
    return { status: 'new', change: 0, message: 'New benchmark' }
  }

  const change = (current - baseline) / baseline

  // Determine if this is a regression based on metric type
  let isRegression = false
  let isImprovement = false

  switch (metricName) {
    case 'ops_per_second':
      isRegression = change < -REGRESSION_THRESHOLDS.ops_per_second_decrease
      isImprovement = change > ACCEPTABLE_VARIANCE.ops_per_second
      break
    case 'avg_time_ms':
    case 'p95_ms':
      isRegression = change > REGRESSION_THRESHOLDS.avg_time_increase
      isImprovement = change < -ACCEPTABLE_VARIANCE.avg_time
      break
    case 'memory_mb':
      isRegression = change > REGRESSION_THRESHOLDS.memory_increase
      isImprovement = change < -ACCEPTABLE_VARIANCE.memory
      break
  }

  let status = 'stable'
  if (isRegression) {
    status = 'regression'
  } else if (isImprovement) {
    status = 'improvement'
  }

  const percentage = (change * 100).toFixed(1)
  const sign = change >= 0 ? '+' : ''

  return {
    status,
    change,
    message: `${sign}${percentage}%`,
  }
}

function generateReport(currentMetrics, baselineMetrics) {
  const report = {
    summary: {
      total: 0,
      regressions: 0,
      improvements: 0,
      stable: 0,
      new: 0,
    },
    details: {},
    regressions: [],
  }

  function compareRecursively(current, baseline, path = []) {
    for (const [key, value] of Object.entries(current)) {
      const currentPath = [...path, key]

      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        // Recurse into nested objects
        const baselineValue = baseline?.[key] || {}
        compareRecursively(value, baselineValue, currentPath)
      } else if (
        (typeof value === 'number' && key.endsWith('_ms')) ||
        key.endsWith('_second') ||
        key.endsWith('_mb')
      ) {
        // This is a metric we want to compare
        const baselineValue = baseline?.[key]
        const comparison = compareMetric(value, baselineValue, key)

        report.summary.total++
        report.summary[comparison.status]++

        // Store detailed comparison
        const pathString = currentPath.join('.')
        if (!report.details[pathString]) {
          report.details[pathString] = {}
        }
        report.details[pathString][key] = {
          current: value,
          baseline: baselineValue,
          ...comparison,
        }

        // Track regressions
        if (comparison.status === 'regression') {
          report.regressions.push({
            path: pathString,
            metric: key,
            current: value,
            baseline: baselineValue,
            change: comparison.change,
            message: comparison.message,
          })
        }
      }
    }
  }

  compareRecursively(currentMetrics, baselineMetrics?.benchmarks || {})
  return report
}

function printReport(report) {
  console.log('📊 Benchmark Comparison Report')
  console.log('================================')
  console.log()

  // Summary
  console.log('📈 Summary:')
  console.log(`  Total benchmarks: ${report.summary.total}`)
  console.log(`  🔴 Regressions: ${report.summary.regressions}`)
  console.log(`  🟢 Improvements: ${report.summary.improvements}`)
  console.log(`  🟡 Stable: ${report.summary.stable}`)
  console.log(`  🆕 New: ${report.summary.new}`)
  console.log()

  // Regressions (if any)
  if (report.regressions.length > 0) {
    console.log('🚨 Performance Regressions Detected:')
    console.log('=====================================')

    for (const regression of report.regressions) {
      console.log(`❌ ${regression.path} - ${regression.metric}`)
      console.log(`   Current: ${regression.current.toFixed(3)}`)
      console.log(`   Baseline: ${regression.baseline.toFixed(3)}`)
      console.log(`   Change: ${regression.message}`)
      console.log()
    }
  }

  // Overall result
  if (report.regressions.length > 0) {
    console.log('❌ BENCHMARK REGRESSION DETECTED')
    console.log('Consider investigating performance issues before merging.')
    return false
  } else {
    console.log('✅ All benchmarks within acceptable thresholds')
    if (report.summary.improvements > 0) {
      console.log('🎉 Some performance improvements detected!')
    }
    return true
  }
}

function main() {
  console.log('🔍 Loading benchmark results...')

  const baseline = loadBaseline()
  const current = loadCurrentResults()

  if (!baseline) {
    console.log('ℹ️  No baseline available for comparison. Results will be used as reference.')
    process.exit(0)
  }

  console.log('📊 Extracting metrics from Vitest results...')
  const currentMetrics = extractMetricsFromVitest(current)

  console.log('📈 Comparing against baseline...')
  const report = generateReport(currentMetrics, baseline)

  console.log()
  const success = printReport(report)

  // Exit with error code if regressions detected (for CI)
  process.exit(success ? 0 : 1)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
