#!/usr/bin/env bun
/**
 * Performance Baseline Recording Script
 *
 * Records cache hit rates, build times, and bundle sizes for regression detection.
 * Run after major configuration changes to establish new performance baselines.
 */

/* eslint-disable no-console */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface TurboTask {
  cache?: {
    status?: string
  }
}

interface TurboDryRunResult {
  tasks?: TurboTask[]
}

const TURBO_BUILD_COMMAND = 'bunx turbo run build'

interface PerformanceMetrics {
  timestamp: string
  turborepoVersion: string
  bunVersion: string
  cacheHitRate: number
  buildTimeMs: number
  bundleSizeBytes: number
  testSuiteTimeMs: number
  dockerImageSizeMB?: number
  gitCommit: string
  configHash: string
}

/**
 * Get current Git commit hash
 */
function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Calculate hash of critical config files
 */
function getConfigHash(): string {
  try {
    const configFiles = ['turbo.jsonc', 'package.json', 'vitest.config.ts', 'tsconfig.json']
    let combined = ''
    for (const file of configFiles) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Safe: iterating over hardcoded config files
      if (existsSync(file)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- Safe: iterating over hardcoded config files
        combined += readFileSync(file, 'utf8')
      }
    }
    // Simple hash - in production, use crypto.createHash
    return Buffer.from(combined).toString('base64').slice(0, 12)
  } catch {
    return 'unknown'
  }
}

/**
 * Measure Turborepo cache hit rate
 */
function measureCacheHitRate(): number {
  try {
    console.log('📊 Measuring cache hit rate...')

    // First build to populate cache
    execSync(TURBO_BUILD_COMMAND, { stdio: 'pipe' })

    // Second build to measure cache hits
    const output = execSync('bunx turbo run build --dry-run=json', { encoding: 'utf8' })
    const result = JSON.parse(output) as TurboDryRunResult

    if (!result.tasks || result.tasks.length === 0) {
      console.log('⚠️  No tasks found in turbo output')
      return 0
    }

    const hits = result.tasks.filter((t: TurboTask) => t.cache?.status === 'HIT').length
    const hitRate = hits / result.tasks.length

    console.log(
      `   Cache hits: ${hits.toString()}/${result.tasks.length.toString()} (${(hitRate * 100).toFixed(1)}%)`,
    )
    return hitRate
  } catch (error) {
    console.log('⚠️  Could not measure cache hit rate:', (error as Error).message)
    return 0
  }
}

/**
 * Measure build time
 */
function measureBuildTime(): number {
  try {
    console.log('⏱️  Measuring build time...')

    // Clean build for accurate timing
    execSync('bunx turbo run clean', { stdio: 'pipe' })

    const start = Date.now()
    execSync(TURBO_BUILD_COMMAND, { stdio: 'pipe' })
    const buildTime = Date.now() - start

    console.log(`   Build time: ${buildTime.toString()}ms`)
    return buildTime
  } catch (error) {
    console.log('⚠️  Could not measure build time:', (error as Error).message)
    return 0
  }
}

/**
 * Measure bundle size
 */
function measureBundleSize(): number {
  try {
    console.log('📦 Measuring bundle size...')

    const distIndexPath = join('dist', 'index.js')
    if (!existsSync(distIndexPath)) {
      console.log('⚠️  dist/index.js not found, running build first')
      execSync(TURBO_BUILD_COMMAND, { stdio: 'pipe' })
    }

    if (existsSync(distIndexPath)) {
      const stats = execSync(`ls -la ${distIndexPath}`, { encoding: 'utf8' })
      const sizeMatch = /\s+(\d+)\s+/.exec(stats)
      const size = sizeMatch ? parseInt(sizeMatch[1]!, 10) : 0

      console.log(`   Bundle size: ${size.toString()} bytes (${(size / 1024).toFixed(1)} KB)`)
      return size
    }

    return 0
  } catch (error) {
    console.log('⚠️  Could not measure bundle size:', (error as Error).message)
    return 0
  }
}

/**
 * Measure test suite execution time
 */
function measureTestTime(): number {
  try {
    console.log('🧪 Measuring test suite time...')

    const start = Date.now()
    execSync('bun test', { stdio: 'pipe' })
    const testTime = Date.now() - start

    console.log(`   Test time: ${testTime.toString()}ms`)
    return testTime
  } catch (error) {
    console.log('⚠️  Could not measure test time:', (error as Error).message)
    return 0
  }
}

/**
 * Get tool versions
 */
function getVersions(): { turborepoVersion: string; bunVersion: string } {
  let turborepoVersion = 'unknown'
  let bunVersion = 'unknown'

  try {
    turborepoVersion = execSync('bunx turbo --version', { encoding: 'utf8' }).trim()
  } catch {
    // Turbo not available
  }

  try {
    bunVersion = execSync('bun --version', { encoding: 'utf8' }).trim()
  } catch {
    // Bun not available
  }

  return { turborepoVersion, bunVersion }
}

/**
 * Save metrics to file system
 */
function saveMetrics(metrics: PerformanceMetrics, allMetrics: PerformanceMetrics[]): string {
  // Ensure metrics directory exists
  if (!existsSync('docs')) {
    mkdirSync('docs', { recursive: true })
  }

  const metricsPath = join('docs', 'performance-metrics.json')

  // Add new metrics and keep only last 50 measurements
  allMetrics.push(metrics)
  if (allMetrics.length > 50) {
    allMetrics = allMetrics.slice(-50)
  }

  writeFileSync(metricsPath, JSON.stringify(allMetrics, null, 2))
  return metricsPath
}

/**
 * Load existing metrics from file
 */
function loadExistingMetrics(): PerformanceMetrics[] {
  const metricsPath = join('docs', 'performance-metrics.json')

  if (existsSync(metricsPath)) {
    try {
      return JSON.parse(readFileSync(metricsPath, 'utf8')) as PerformanceMetrics[]
    } catch {
      console.log('⚠️  Could not parse existing metrics, starting fresh')
    }
  }

  return []
}

/**
 * Print performance summary
 */
function printSummary(metrics: PerformanceMetrics, metricsPath: string): void {
  console.log('')
  console.log('📈 Performance Summary:')
  console.log(`   Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`)
  console.log(`   Build Time: ${metrics.buildTimeMs.toString()}ms`)
  console.log(`   Bundle Size: ${(metrics.bundleSizeBytes / 1024).toFixed(1)} KB`)
  console.log(`   Test Time: ${metrics.testSuiteTimeMs.toString()}ms`)
  console.log(`   Turbo Version: ${metrics.turborepoVersion}`)
  console.log(`   Bun Version: ${metrics.bunVersion}`)
  console.log('')
  console.log(`📄 Metrics saved to: ${metricsPath}`)
}

/**
 * Check for regressions compared to previous run
 */
function checkRegressions(metrics: PerformanceMetrics, allMetrics: PerformanceMetrics[]): void {
  if (allMetrics.length < 2) return

  const previous = allMetrics[allMetrics.length - 2]
  console.log('')
  console.log('🔍 Change Detection:')

  const cacheRateChange = (metrics.cacheHitRate - previous!.cacheHitRate) * 100
  const buildTimeChange =
    ((metrics.buildTimeMs - previous!.buildTimeMs) / previous!.buildTimeMs) * 100
  const bundleSizeChange =
    ((metrics.bundleSizeBytes - previous!.bundleSizeBytes) / previous!.bundleSizeBytes) * 100

  if (Math.abs(cacheRateChange) > 5) {
    console.log(`   Cache Rate: ${cacheRateChange > 0 ? '+' : ''}${cacheRateChange.toFixed(1)}%`)
  }
  if (Math.abs(buildTimeChange) > 10) {
    console.log(`   Build Time: ${buildTimeChange > 0 ? '+' : ''}${buildTimeChange.toFixed(1)}%`)
  }
  if (Math.abs(bundleSizeChange) > 5) {
    console.log(`   Bundle Size: ${bundleSizeChange > 0 ? '+' : ''}${bundleSizeChange.toFixed(1)}%`)
  }
}

/**
 * Record all performance metrics
 */
function recordBaselines(): void {
  console.log('🎯 Recording Performance Baselines')
  console.log('='.repeat(50))

  const { turborepoVersion, bunVersion } = getVersions()

  const metrics: PerformanceMetrics = {
    timestamp: new Date().toISOString(),
    turborepoVersion,
    bunVersion,
    cacheHitRate: measureCacheHitRate(),
    buildTimeMs: measureBuildTime(),
    bundleSizeBytes: measureBundleSize(),
    testSuiteTimeMs: measureTestTime(),
    gitCommit: getGitCommit(),
    configHash: getConfigHash(),
  }

  const allMetrics = loadExistingMetrics()
  const metricsPath = saveMetrics(metrics, allMetrics)

  printSummary(metrics, metricsPath)
  checkRegressions(metrics, allMetrics)
}

/**
 * Main execution
 */
function main(): void {
  const args = process.argv.slice(2)

  if (args.includes('--help')) {
    console.log('Performance Baseline Recording Script')
    console.log('')
    console.log('Usage: bun run record:baselines [options]')
    console.log('')
    console.log('Records performance metrics for regression detection:')
    console.log('  - Turborepo cache hit rates')
    console.log('  - Build and test execution times')
    console.log('  - Bundle sizes')
    console.log('  - Tool versions')
    console.log('')
    console.log('Metrics are saved to docs/performance-metrics.json')
    return
  }

  recordBaselines()
}

// Only run if this script is executed directly
if (import.meta.main) {
  main()
}
