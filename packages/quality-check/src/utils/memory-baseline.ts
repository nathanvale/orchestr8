import { MemoryProfiler } from './memory-profiler'

export interface BaselineConfig {
  iterations?: number
  warmupIterations?: number
  delayBetweenRuns?: number
  forceGc?: boolean
}

export interface BaselineResult {
  operation: string
  iterations: number
  warmupIterations: number
  averageHeapUsed: number
  peakHeapUsed: number
  averageTime: number
  medianTime: number
  minTime: number
  maxTime: number
  memoryGrowth: number
  potentialLeak: boolean
}

export class MemoryBaseline {
  private profiler: MemoryProfiler
  private defaultConfig: Required<BaselineConfig> = {
    iterations: 10,
    warmupIterations: 3,
    delayBetweenRuns: 100,
    forceGc: true,
  }

  constructor(config?: BaselineConfig) {
    this.profiler = new MemoryProfiler()
    if (config) {
      this.defaultConfig = { ...this.defaultConfig, ...config }
    }
  }

  /**
   * Measure memory baseline for a specific operation
   */
  async measure<T>(
    operation: string,
    fn: () => T | Promise<T>,
    config?: BaselineConfig,
  ): Promise<BaselineResult> {
    const actualConfig = { ...this.defaultConfig, ...config }
    const timings: number[] = []
    const memoryUsages: number[] = []

    // Reset profiler for fresh measurement
    this.profiler.reset()

    // Warmup iterations
    for (let i = 0; i < actualConfig.warmupIterations; i++) {
      await this.runSingleIteration(fn, actualConfig.forceGc)
      await this.delay(actualConfig.delayBetweenRuns)
    }

    // Force GC before actual measurements
    if (actualConfig.forceGc && global.gc) {
      global.gc()
    }

    // Capture initial memory state
    this.profiler.snapshot('baseline-start')

    // Actual measurement iterations
    for (let i = 0; i < actualConfig.iterations; i++) {
      const startTime = performance.now()
      const startMem = process.memoryUsage().heapUsed

      await this.runSingleIteration(fn, false)

      const endTime = performance.now()
      const endMem = process.memoryUsage().heapUsed

      timings.push(endTime - startTime)
      memoryUsages.push((endMem - startMem) / 1024 / 1024)

      this.profiler.snapshot(`iteration-${i + 1}`)
      await this.delay(actualConfig.delayBetweenRuns)
    }

    // Capture final memory state
    this.profiler.snapshot('baseline-end')

    // Calculate statistics
    const report = this.profiler.getReport()
    const leakDetection = this.profiler.detectLeaks()

    return {
      operation,
      iterations: actualConfig.iterations,
      warmupIterations: actualConfig.warmupIterations,
      averageHeapUsed: report.summary.averageHeapUsed,
      peakHeapUsed: report.summary.peakHeapUsed,
      averageTime: this.calculateAverage(timings),
      medianTime: this.calculateMedian(timings),
      minTime: Math.min(...timings),
      maxTime: Math.max(...timings),
      memoryGrowth: report.growth?.heapGrowth || 0,
      potentialLeak: leakDetection.potentialLeak,
    }
  }

  /**
   * Compare two operations for memory and performance
   */
  async compare<T>(
    operationA: { name: string; fn: () => T | Promise<T> },
    operationB: { name: string; fn: () => T | Promise<T> },
    config?: BaselineConfig,
  ): Promise<{
    resultA: BaselineResult
    resultB: BaselineResult
    comparison: {
      memoryDifference: number
      memoryDifferencePercent: number
      timeDifference: number
      timeDifferencePercent: number
      winner: string
      summary: string
    }
  }> {
    const resultA = await this.measure(operationA.name, operationA.fn, config)

    // Allow memory to settle between tests
    await this.delay(1000)
    if (this.defaultConfig.forceGc && global.gc) {
      global.gc()
    }

    const resultB = await this.measure(operationB.name, operationB.fn, config)

    const memoryDifference = resultB.averageHeapUsed - resultA.averageHeapUsed
    const memoryDifferencePercent = (memoryDifference / resultA.averageHeapUsed) * 100
    const timeDifference = resultB.averageTime - resultA.averageTime
    const timeDifferencePercent = (timeDifference / resultA.averageTime) * 100

    const winner =
      memoryDifference < 0 && timeDifference < 0
        ? operationB.name
        : memoryDifference > 0 && timeDifference > 0
          ? operationA.name
          : Math.abs(memoryDifferencePercent) > Math.abs(timeDifferencePercent)
            ? memoryDifference < 0
              ? operationB.name
              : operationA.name
            : timeDifference < 0
              ? operationB.name
              : operationA.name

    const summary =
      `${winner} is better: ` +
      `${Math.abs(memoryDifferencePercent).toFixed(1)}% ${memoryDifference < 0 ? 'less' : 'more'} memory, ` +
      `${Math.abs(timeDifferencePercent).toFixed(1)}% ${timeDifference < 0 ? 'faster' : 'slower'}`

    return {
      resultA,
      resultB,
      comparison: {
        memoryDifference,
        memoryDifferencePercent,
        timeDifference,
        timeDifferencePercent,
        winner,
        summary,
      },
    }
  }

  /**
   * Generate a human-readable report
   */
  formatResult(result: BaselineResult): string {
    const lines = [
      `📊 Baseline: ${result.operation}`,
      '─'.repeat(40),
      `Iterations: ${result.iterations} (${result.warmupIterations} warmup)`,
      '',
      '⏱️  Performance:',
      `  Average: ${result.averageTime.toFixed(2)}ms`,
      `  Median: ${result.medianTime.toFixed(2)}ms`,
      `  Min: ${result.minTime.toFixed(2)}ms`,
      `  Max: ${result.maxTime.toFixed(2)}ms`,
      '',
      '💾 Memory:',
      `  Average Heap: ${result.averageHeapUsed.toFixed(2)} MB`,
      `  Peak Heap: ${result.peakHeapUsed.toFixed(2)} MB`,
      `  Growth: ${result.memoryGrowth.toFixed(2)} MB`,
      `  Potential Leak: ${result.potentialLeak ? '⚠️ Yes' : '✅ No'}`,
    ]

    return lines.join('\n')
  }

  private async runSingleIteration<T>(fn: () => T | Promise<T>, forceGc: boolean): Promise<void> {
    if (forceGc && global.gc) {
      global.gc()
    }

    const result = fn()
    if (result && typeof (result as unknown as Promise<unknown>).then === 'function') {
      await result
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private calculateAverage(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }
}
