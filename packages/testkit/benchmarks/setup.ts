/**
 * Benchmark configuration and setup utilities
 */

import { performance, PerformanceObserver } from 'node:perf_hooks'

export interface BenchmarkMetrics {
  ops: number
  opsPerSecond: number
  avgTime: number
  minTime: number
  maxTime: number
  p50: number
  p95: number
  p99: number
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
  }
  gcMetrics?: {
    gcCount: number
    gcTime: number
  }
}

export interface BenchmarkOptions {
  iterations?: number
  warmupIterations?: number
  minSamples?: number
  maxTime?: number
  collectGC?: boolean
}

/**
 * Performance measurement utilities
 */
export class BenchmarkRunner {
  private gcObserver?: PerformanceObserver
  private gcMetrics = { gcCount: 0, gcTime: 0 }

  constructor(private options: BenchmarkOptions = {}) {
    this.options = {
      iterations: 1000,
      warmupIterations: 100,
      minSamples: 5,
      maxTime: 5000, // 5 seconds max
      collectGC: true,
      ...options,
    }
  }

  /**
   * Run a benchmark function and collect metrics
   */
  async run<T>(
    name: string,
    fn: () => Promise<T> | T,
    options?: Partial<BenchmarkOptions>,
  ): Promise<BenchmarkMetrics> {
    const opts = { ...this.options, ...options }

    if (opts.collectGC) {
      this.setupGCObserver()
    }

    // Warmup
    for (let i = 0; i < opts.warmupIterations!; i++) {
      await fn()
    }

    // Force GC before measurement if available
    if (global.gc) {
      global.gc()
    }

    const initialMemory = process.memoryUsage()
    const times: number[] = []
    const startTime = performance.now()

    let iterations = 0
    while (
      iterations < opts.iterations! &&
      performance.now() - startTime < opts.maxTime! &&
      times.length < 10000 // Safety limit
    ) {
      const start = performance.now()
      await fn()
      const end = performance.now()
      times.push(end - start)
      iterations++
    }

    const endTime = performance.now()
    const totalTime = endTime - startTime
    const finalMemory = process.memoryUsage()

    if (this.gcObserver) {
      this.gcObserver.disconnect()
    }

    return this.calculateMetrics(times, totalTime, initialMemory, finalMemory)
  }

  private setupGCObserver(): void {
    if (!PerformanceObserver) return

    this.gcMetrics = { gcCount: 0, gcTime: 0 }
    this.gcObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      for (const entry of entries) {
        if (entry.entryType === 'gc') {
          this.gcMetrics.gcCount++
          this.gcMetrics.gcTime += entry.duration
        }
      }
    })

    this.gcObserver.observe({ entryTypes: ['gc'] })
  }

  private calculateMetrics(
    times: number[],
    totalTime: number,
    initialMemory: NodeJS.MemoryUsage,
    finalMemory: NodeJS.MemoryUsage,
  ): BenchmarkMetrics {
    times.sort((a, b) => a - b)

    const ops = times.length
    const opsPerSecond = (ops / totalTime) * 1000
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length
    const minTime = times[0]
    const maxTime = times[times.length - 1]

    const p50 = this.percentile(times, 0.5)
    const p95 = this.percentile(times, 0.95)
    const p99 = this.percentile(times, 0.99)

    const memoryUsage = {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      external: finalMemory.external - initialMemory.external,
      rss: finalMemory.rss - initialMemory.rss,
    }

    const result: BenchmarkMetrics = {
      ops,
      opsPerSecond,
      avgTime,
      minTime,
      maxTime,
      p50,
      p95,
      p99,
      memoryUsage,
    }

    if (this.options.collectGC && this.gcMetrics.gcCount > 0) {
      result.gcMetrics = { ...this.gcMetrics }
    }

    return result
  }

  private percentile(sortedArray: number[], p: number): number {
    const index = (sortedArray.length - 1) * p
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index % 1

    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1]
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight
  }
}

/**
 * Memory monitoring utilities
 */
export function trackMemoryUsage(): () => NodeJS.MemoryUsage {
  const initial = process.memoryUsage()

  return () => {
    const current = process.memoryUsage()
    return {
      rss: current.rss - initial.rss,
      heapTotal: current.heapTotal - initial.heapTotal,
      heapUsed: current.heapUsed - initial.heapUsed,
      external: current.external - initial.external,
      arrayBuffers: current.arrayBuffers - initial.arrayBuffers,
    }
  }
}

/**
 * Event loop delay monitoring
 */
export function measureEventLoopDelay(): () => number {
  const start = process.hrtime.bigint()

  return () => {
    return Number(process.hrtime.bigint() - start) / 1e6 // Convert to milliseconds
  }
}

/**
 * Create a benchmark function that can be used with vitest bench
 */
export function createBenchmarkSuite(name: string, options?: BenchmarkOptions) {
  const runner = new BenchmarkRunner(options)

  return {
    run: runner.run.bind(runner),
    name,
    options,
  }
}

/**
 * Format benchmark results for reporting
 */
export function formatBenchmarkResults(results: BenchmarkMetrics): string {
  const lines = [
    `Operations: ${results.ops}`,
    `Ops/sec: ${results.opsPerSecond.toFixed(2)}`,
    `Average: ${results.avgTime.toFixed(2)}ms`,
    `Min: ${results.minTime.toFixed(2)}ms`,
    `Max: ${results.maxTime.toFixed(2)}ms`,
    `P50: ${results.p50.toFixed(2)}ms`,
    `P95: ${results.p95.toFixed(2)}ms`,
    `P99: ${results.p99.toFixed(2)}ms`,
    `Memory (heap): ${(results.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
    `Memory (RSS): ${(results.memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`,
  ]

  if (results.gcMetrics) {
    lines.push(
      `GC Count: ${results.gcMetrics.gcCount}`,
      `GC Time: ${results.gcMetrics.gcTime.toFixed(2)}ms`,
    )
  }

  return lines.join('\n')
}
