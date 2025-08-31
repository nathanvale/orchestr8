#!/usr/bin/env tsx
/**
 * Turborepo Performance Benchmark Tool
 *
 * Measures build performance and cache hit rates to validate <2s build targets
 * for ADHD-optimized developer experience.
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

interface BenchmarkResult {
  timestamp: string
  scenario: string
  totalDuration: number
  taskResults: Array<{
    task: string
    package: string
    duration: number
    cached: boolean
    cacheType: 'local' | 'remote' | 'miss'
  }>
  cacheStats: {
    hitRate: number
    localHits: number
    remoteHits: number
    misses: number
    total: number
  }
  memoryUsage?: {
    peak: number
    average: number
  }
}

/**
 * Run a turbo command and parse the output for performance metrics
 */
function runTurboBenchmark(
  command: string,
  scenario: string,
  clean: boolean = false,
): BenchmarkResult {
  const startTime = Date.now()

  // Clean build artifacts if requested
  if (clean) {
    console.log(`🧹 Cleaning artifacts for ${scenario}...`)
    try {
      execSync('pnpm run clean:build', { stdio: 'pipe' })
      execSync('turbo run clean', { stdio: 'pipe' })
    } catch {
      // Ignore clean failures
    }
  }

  console.log(`🏃 Running ${scenario}...`)

  try {
    const output = execSync(`${command} --summarize`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const endTime = Date.now()
    const totalDuration = endTime - startTime

    // Parse turbo summary JSON
    const summaryMatch = output.match(/{"id".*?"exitCode":\d+}/s)
    if (!summaryMatch) {
      throw new Error('Could not parse turbo summary output')
    }

    const summary = JSON.parse(summaryMatch[0])
    const tasks = summary.tasks || []

    const taskResults = tasks.map((task: any) => ({
      task: task.taskId?.split('#')[1] || 'unknown',
      package: task.package || 'unknown',
      duration: task.execution?.endTime ? task.execution.endTime - task.execution.startTime : 0,
      cached: task.cache?.status === 'HIT',
      cacheType: task.cache?.status === 'HIT' ? (task.cache.remote ? 'remote' : 'local') : 'miss',
    }))

    // Calculate cache statistics
    const cached = taskResults.filter((t) => t.cached)
    const localHits = taskResults.filter((t) => t.cacheType === 'local').length
    const remoteHits = taskResults.filter((t) => t.cacheType === 'remote').length
    const misses = taskResults.filter((t) => t.cacheType === 'miss').length
    const total = taskResults.length

    return {
      timestamp: new Date().toISOString(),
      scenario,
      totalDuration,
      taskResults,
      cacheStats: {
        hitRate: total > 0 ? Math.round((cached.length / total) * 100) : 0,
        localHits,
        remoteHits,
        misses,
        total,
      },
    }
  } catch (error) {
    console.error(`❌ Failed to run ${scenario}:`, error)
    throw error
  }
}

/**
 * Check system memory usage during builds
 */
function measureMemoryUsage(): Promise<{ peak: number; average: number }> {
  return new Promise((resolve) => {
    const measurements: number[] = []
    let peak = 0

    const interval = setInterval(() => {
      try {
        const memInfo = execSync('ps -o pid,rss,vsz -p $$', { encoding: 'utf-8' })
        const lines = memInfo.trim().split('\n')
        if (lines.length > 1) {
          const [, rss] = lines[1].trim().split(/\s+/)
          const memMB = parseInt(rss) / 1024
          measurements.push(memMB)
          peak = Math.max(peak, memMB)
        }
      } catch {
        // Ignore measurement failures
      }
    }, 500)

    // Stop measuring after 30 seconds
    setTimeout(() => {
      clearInterval(interval)
      const average =
        measurements.length > 0 ? measurements.reduce((a, b) => a + b, 0) / measurements.length : 0
      resolve({ peak, average })
    }, 30000)
  })
}

/**
 * Format benchmark results for display
 */
function formatResults(result: BenchmarkResult): string {
  const lines = [
    `\n📊 Benchmark Results - ${result.scenario}`,
    `🕐 Total Duration: ${(result.totalDuration / 1000).toFixed(2)}s`,
    `🎯 Cache Hit Rate: ${result.cacheStats.hitRate}% (${result.cacheStats.localHits + result.cacheStats.remoteHits}/${result.cacheStats.total})`,
    `   Local: ${result.cacheStats.localHits}, Remote: ${result.cacheStats.remoteHits}, Miss: ${result.cacheStats.misses}`,
    ``,
  ]

  if (result.taskResults.length > 0) {
    lines.push(`📋 Task Breakdown:`)
    result.taskResults.forEach((task) => {
      const cacheIcon = task.cached ? (task.cacheType === 'remote' ? '🌐' : '💾') : '⚡'
      const duration = (task.duration / 1000).toFixed(3)
      lines.push(`   ${cacheIcon} ${task.package}#${task.task}: ${duration}s`)
    })
    lines.push('')
  }

  if (result.memoryUsage) {
    lines.push(`🧠 Memory Usage:`)
    lines.push(`   Peak: ${result.memoryUsage.peak.toFixed(1)}MB`)
    lines.push(`   Average: ${result.memoryUsage.average.toFixed(1)}MB`)
    lines.push('')
  }

  // ADHD Flow State Analysis
  const adhd = analyzeADHDCompatibility(result)
  lines.push(`🧠 ADHD Flow State Analysis:`)
  lines.push(`   Build Speed: ${adhd.buildSpeed}`)
  lines.push(`   Cache Efficiency: ${adhd.cacheEfficiency}`)
  lines.push(`   Overall: ${adhd.overall}`)

  return lines.join('\n')
}

/**
 * Analyze ADHD compatibility of build performance
 */
function analyzeADHDCompatibility(result: BenchmarkResult): {
  buildSpeed: string
  cacheEfficiency: string
  overall: string
} {
  const totalSeconds = result.totalDuration / 1000
  const hitRate = result.cacheStats.hitRate

  const buildSpeed =
    totalSeconds <= 2
      ? '✅ Excellent (<2s)'
      : totalSeconds <= 5
        ? '⚠️ Good (<5s)'
        : totalSeconds <= 10
          ? '🟡 Acceptable (<10s)'
          : '❌ Too Slow (>10s) - Breaks flow state'

  const cacheEfficiency =
    hitRate >= 85
      ? '✅ Excellent (>85%)'
      : hitRate >= 70
        ? '⚠️ Good (>70%)'
        : hitRate >= 50
          ? '🟡 Poor (>50%)'
          : '❌ Very Poor (<50%)'

  const overall =
    totalSeconds <= 2 && hitRate >= 85
      ? '✅ ADHD Optimized'
      : totalSeconds <= 5 && hitRate >= 70
        ? '⚠️ Mostly Good'
        : '❌ Needs Improvement'

  return { buildSpeed, cacheEfficiency, overall }
}

/**
 * Save benchmark results to file for historical tracking
 */
function saveResults(result: BenchmarkResult): void {
  const resultsFile = 'turbo-performance-history.json'
  let history: BenchmarkResult[] = []

  if (existsSync(resultsFile)) {
    try {
      history = JSON.parse(readFileSync(resultsFile, 'utf-8'))
    } catch {
      // Start fresh if file is corrupted
    }
  }

  history.push(result)

  // Keep only last 50 results
  if (history.length > 50) {
    history = history.slice(-50)
  }

  writeFileSync(resultsFile, JSON.stringify(history, null, 2))
  console.log(`💾 Results saved to ${resultsFile}`)
}

/**
 * Main benchmark execution
 */
async function main(): Promise<void> {
  console.log('🚀 Turborepo Performance Benchmark')
  console.log('Testing ADHD-optimized build performance (<2s target)')

  const scenarios = [
    {
      name: 'Cold Build (No Cache)',
      command: 'turbo run build',
      clean: true,
    },
    {
      name: 'Warm Build (With Cache)',
      command: 'turbo run build',
      clean: false,
    },
    {
      name: 'Incremental Build (Change Simulation)',
      command: 'turbo run build',
      clean: false,
      touchFile: 'packages/utils/src/index.ts',
    },
  ]

  const results: BenchmarkResult[] = []

  for (const scenario of scenarios) {
    // Simulate file change for incremental test
    if (scenario.touchFile) {
      console.log(`✏️ Simulating change to ${scenario.touchFile}`)
      try {
        execSync(`touch ${scenario.touchFile}`)
      } catch {
        console.log(`⚠️ Could not touch ${scenario.touchFile}, skipping simulation`)
      }
    }

    try {
      const result = runTurboBenchmark(scenario.command, scenario.name, scenario.clean)

      results.push(result)
      console.log(formatResults(result))
      saveResults(result)

      // Brief pause between scenarios
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`❌ Scenario ${scenario.name} failed:`, error)
    }
  }

  // Summary analysis
  console.log('\n📈 Performance Summary')
  console.log('='.repeat(50))

  results.forEach((result) => {
    const adhd = analyzeADHDCompatibility(result)
    console.log(`${result.scenario}: ${adhd.overall}`)
  })

  // Check if remote cache is connected
  const hasRemoteCache = process.env.TURBO_TOKEN ? 'Connected' : 'Disconnected'
  console.log(`\n🌐 Remote Cache: ${hasRemoteCache}`)

  if (!process.env.TURBO_TOKEN) {
    console.log('\n💡 To enable remote cache for >85% hit rates:')
    console.log('   1. Get token: https://vercel.com/account/tokens')
    console.log('   2. export TURBO_TOKEN="your-token"')
    console.log('   3. export TURBO_TEAM="your-team" (optional)')
  }

  console.log('\n✅ Benchmark complete!')
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { analyzeADHDCompatibility, formatResults, runTurboBenchmark }
