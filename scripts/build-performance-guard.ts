#!/usr/bin/env tsx
/**
 * Build Performance Guard
 *
 * Validates build performance meets ADHD flow state requirements (<2s incremental builds)
 * Runs as part of CI/CD to prevent performance regressions.
 */

import { execSync } from 'node:child_process'

interface PerformanceThresholds {
  coldBuild: number // Maximum time for cold build (ms)
  warmBuild: number // Maximum time for warm build (ms)
  incrementalBuild: number // Maximum time for incremental build (ms)
  cacheHitRate: number // Minimum cache hit rate (%)
}

// ADHD-optimized thresholds
const THRESHOLDS: PerformanceThresholds = {
  coldBuild: 10000, // 10s for cold builds (acceptable)
  warmBuild: 2000, // 2s for warm builds (maintains flow)
  incrementalBuild: 2000, // 2s for incremental (critical for ADHD)
  cacheHitRate: 85, // 85% minimum cache efficiency
}

/**
 * Run build performance validation
 */
async function validateBuildPerformance(): Promise<{
  success: boolean
  results: {
    test: string
    duration: number
    threshold: number
    passed: boolean
    cacheHitRate?: number
  }[]
}> {
  console.log('🔍 Validating build performance for ADHD flow state...')

  const results = []

  // Test 1: Cold build (clean slate)
  console.log('\n🧹 Testing cold build performance...')
  try {
    execSync('turbo run clean', { stdio: 'pipe' })
    const startTime = Date.now()
    execSync('turbo run build --summarize', { stdio: 'pipe' })
    const duration = Date.now() - startTime

    results.push({
      test: 'Cold Build',
      duration,
      threshold: THRESHOLDS.coldBuild,
      passed: duration <= THRESHOLDS.coldBuild,
    })

    console.log(
      `   Duration: ${(duration / 1000).toFixed(2)}s (threshold: ${THRESHOLDS.coldBuild / 1000}s)`,
    )
  } catch (error) {
    console.error('❌ Cold build failed:', error)
    results.push({
      test: 'Cold Build',
      duration: Infinity,
      threshold: THRESHOLDS.coldBuild,
      passed: false,
    })
  }

  // Test 2: Warm build (should hit cache)
  console.log('\n🔥 Testing warm build performance...')
  try {
    const startTime = Date.now()
    const output = execSync('turbo run build --summarize', { encoding: 'utf-8' })
    const duration = Date.now() - startTime

    // Parse cache hit rate from output
    let cacheHitRate = 0
    try {
      const summaryMatch = /{"id".*?"exitCode":\d+}/s.exec(output)
      if (summaryMatch) {
        const summary = JSON.parse(summaryMatch[0])
        const tasks = summary.tasks || []
        const cached = tasks.filter((t: any) => t.cache?.status === 'HIT').length
        cacheHitRate = tasks.length > 0 ? Math.round((cached / tasks.length) * 100) : 0
      }
    } catch {
      // Ignore parsing errors
    }

    results.push({
      test: 'Warm Build',
      duration,
      threshold: THRESHOLDS.warmBuild,
      passed: duration <= THRESHOLDS.warmBuild && cacheHitRate >= THRESHOLDS.cacheHitRate,
      cacheHitRate,
    })

    console.log(
      `   Duration: ${(duration / 1000).toFixed(2)}s (threshold: ${THRESHOLDS.warmBuild / 1000}s)`,
    )
    console.log(`   Cache Hit Rate: ${cacheHitRate}% (threshold: ${THRESHOLDS.cacheHitRate}%)`)
  } catch (error) {
    console.error('❌ Warm build failed:', error)
    results.push({
      test: 'Warm Build',
      duration: Infinity,
      threshold: THRESHOLDS.warmBuild,
      passed: false,
      cacheHitRate: 0,
    })
  }

  // Test 3: Incremental build (simulate file change)
  console.log('\n⚡ Testing incremental build performance...')
  try {
    // Touch a file to simulate change
    execSync('touch packages/utils/src/index.ts', { stdio: 'pipe' })

    const startTime = Date.now()
    execSync('turbo run build --summarize', { stdio: 'pipe' })
    const duration = Date.now() - startTime

    results.push({
      test: 'Incremental Build',
      duration,
      threshold: THRESHOLDS.incrementalBuild,
      passed: duration <= THRESHOLDS.incrementalBuild,
    })

    console.log(
      `   Duration: ${(duration / 1000).toFixed(2)}s (threshold: ${THRESHOLDS.incrementalBuild / 1000}s)`,
    )
  } catch (error) {
    console.error('❌ Incremental build failed:', error)
    results.push({
      test: 'Incremental Build',
      duration: Infinity,
      threshold: THRESHOLDS.incrementalBuild,
      passed: false,
    })
  }

  const allPassed = results.every((r) => r.passed)

  return {
    success: allPassed,
    results,
  }
}

/**
 * Format performance report for CI/CD output
 */
function formatReport(validation: {
  success: boolean
  results: {
    test: string
    duration: number
    threshold: number
    passed: boolean
    cacheHitRate?: number
  }[]
}): string {
  const lines = ['\n📊 Build Performance Report', '='.repeat(40), '']

  for (const result of validation.results) {
    const status = result.passed ? '✅' : '❌'
    const duration = isFinite(result.duration)
      ? `${(result.duration / 1000).toFixed(2)}s`
      : 'FAILED'
    const threshold = `${(result.threshold / 1000).toFixed(1)}s`

    lines.push(`${status} ${result.test}: ${duration} (max: ${threshold})`)

    if (result.cacheHitRate !== undefined) {
      lines.push(`   Cache Hit Rate: ${result.cacheHitRate}% (min: ${THRESHOLDS.cacheHitRate}%)`)
    }
  }

  lines.push('')

  if (validation.success) {
    lines.push('🧠 ✅ All tests passed - ADHD flow state maintained!')
  } else {
    lines.push('🧠 ❌ Performance regression detected - ADHD flow state at risk!')
    lines.push('')
    lines.push('💡 Optimization suggestions:')

    for (const result of validation.results) {
      if (!result.passed) {
        if (
          result.test.includes('Cache') &&
          result.cacheHitRate !== undefined &&
          result.cacheHitRate < THRESHOLDS.cacheHitRate
        ) {
          lines.push(`   • Improve cache hit rate for ${result.test}`)
          lines.push(`     - Check input/output patterns in turbo.json`)
          lines.push(`     - Verify remote cache connection (TURBO_TOKEN)`)
        }

        if (result.duration > result.threshold) {
          lines.push(`   • Optimize ${result.test} performance`)
          lines.push(`     - Profile slow tasks with --profile`)
          lines.push(`     - Consider parallel execution optimization`)
        }
      }
    }
  }

  return lines.join('\n')
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const isCI = process.env.CI === 'true'
  const strictMode = process.argv.includes('--strict')

  try {
    const validation = await validateBuildPerformance()
    const report = formatReport(validation)

    console.log(report)

    // Exit with appropriate code
    if (!validation.success) {
      if (strictMode || isCI) {
        console.error('\n💥 Performance validation failed in strict mode')
        process.exit(1)
      } else {
        console.warn('\n⚠️ Performance validation failed (warning only)')
        process.exit(0)
      }
    }

    console.log('\n🚀 Performance validation passed!')
  } catch (error) {
    console.error('❌ Performance validation error:', error)
    process.exit(1)
  }
}

// CLI argument parsing
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Build Performance Guard

Validates build performance meets ADHD flow state requirements.

Usage:
  tsx scripts/build-performance-guard.ts [options]

Options:
  --strict     Exit with error code if performance thresholds are not met
  --help, -h   Show this help message

Environment:
  CI=true      Automatically enables strict mode in CI environments

Thresholds:
  Cold Build:       ${THRESHOLDS.coldBuild / 1000}s
  Warm Build:       ${THRESHOLDS.warmBuild / 1000}s  
  Incremental:      ${THRESHOLDS.incrementalBuild / 1000}s
  Cache Hit Rate:   ${THRESHOLDS.cacheHitRate}%
`)
  process.exit(0)
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
