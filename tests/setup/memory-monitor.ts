import { MemoryProfiler } from '../../packages/quality-check/src/utils/memory-profiler.js'
import type { MemorySnapshot } from '../../packages/quality-check/src/utils/memory-profiler.js'

export interface MemoryMonitorConfig {
  maxMemoryMB?: number
  warningThresholdPercent?: number
  enableTracking?: boolean
  enableWarnings?: boolean
  enableTrendReporting?: boolean
}

export interface TestMemoryData {
  before: MemorySnapshot
  after: MemorySnapshot
  delta: {
    heapUsed: number
    rss: number
    heapTotal: number
    external: number
    arrayBuffers: number
  }
}

export interface TestOptions {
  maxMemoryMB?: number
}

export interface TrendReport {
  totalTests: number
  averageMemoryUsage: number
  peakMemoryUsage: number
  memoryGrowthTrend: number
  testsExceedingWarning: string[]
  testsExceedingLimit: string[]
  potentialLeak?: boolean
  leakReason?: string
  memoryGrowthRate?: number
}

export class MemoryMonitor {
  private profiler: MemoryProfiler
  private config: Required<MemoryMonitorConfig>
  private testData: Map<string, TestMemoryData>
  private testOptions: Map<string, TestOptions>
  private debugMode: boolean

  constructor(config: MemoryMonitorConfig = {}) {
    // Only enable memory monitoring when MEMORY_DEBUG is set
    this.debugMode = process.env['MEMORY_DEBUG'] === 'true'

    this.config = {
      maxMemoryMB: config.maxMemoryMB ?? 500,
      warningThresholdPercent: config.warningThresholdPercent ?? 80,
      enableTracking: config.enableTracking ?? this.debugMode,
      enableWarnings: config.enableWarnings ?? this.debugMode,
      enableTrendReporting: config.enableTrendReporting ?? false,
    }
    this.profiler = new MemoryProfiler()
    this.testData = new Map()
    this.testOptions = new Map()
  }

  beforeTest(testName: string, options?: TestOptions): void {
    if (!this.config.enableTracking) return

    if (options) {
      this.testOptions.set(testName, options)
    }

    const snapshot = this.profiler.snapshot(`${testName}-before`)

    if (!this.testData.has(testName)) {
      this.testData.set(testName, {
        before: snapshot,
        after: snapshot, // Will be replaced
        delta: {
          heapUsed: 0,
          rss: 0,
          heapTotal: 0,
          external: 0,
          arrayBuffers: 0,
        },
      })
    }
  }

  afterTest(testName: string): void {
    if (!this.config.enableTracking) return

    const snapshot = this.profiler.snapshot(`${testName}-after`)
    const data = this.testData.get(testName)

    if (data) {
      data.after = snapshot
      data.delta = {
        heapUsed: snapshot.memory.heapUsed - data.before.memory.heapUsed,
        rss: snapshot.memory.rss - data.before.memory.rss,
        heapTotal: snapshot.memory.heapTotal - data.before.memory.heapTotal,
        external: snapshot.memory.external - data.before.memory.external,
        arrayBuffers: snapshot.memory.arrayBuffers - data.before.memory.arrayBuffers,
      }
    }
  }

  getTestSnapshot(testName: string, phase: 'before' | 'after'): MemorySnapshot | undefined {
    const data = this.testData.get(testName)
    return data ? data[phase] : undefined
  }

  getTestData(testName: string): TestMemoryData | undefined {
    return this.testData.get(testName)
  }

  checkMemoryLimit(testName: string): void {
    const data = this.testData.get(testName)
    if (!data) return

    const options = this.testOptions.get(testName)
    const limit = options?.maxMemoryMB ?? this.config.maxMemoryMB
    const currentUsage = data.before.memory.heapUsed

    if (currentUsage > limit) {
      throw new Error(`Memory limit exceeded: ${currentUsage}MB used (limit: ${limit}MB)`)
    }
  }

  checkMemoryWarning(testName: string): void {
    if (!this.config.enableWarnings) return

    const data = this.testData.get(testName)
    if (!data) return

    const options = this.testOptions.get(testName)
    const limit = options?.maxMemoryMB ?? this.config.maxMemoryMB
    const threshold = this.config.warningThresholdPercent / 100
    const currentUsage = data.before.memory.heapUsed
    const percentage = (currentUsage / limit) * 100

    if (currentUsage > limit * threshold && this.debugMode) {
      console.warn(
        `Memory usage warning: ${currentUsage}MB (${Math.round(percentage)}% of ${limit}MB limit)`,
      )
    }
  }

  generateTrendReport(): TrendReport {
    const tests = Array.from(this.testData.values())
    const heapUsages = tests.map((t) => t.after.memory.heapUsed)
    const limit = this.config.maxMemoryMB
    const warningThreshold = limit * (this.config.warningThresholdPercent / 100)

    const testsExceedingWarning: string[] = []
    const testsExceedingLimit: string[] = []

    this.testData.forEach((data, testName) => {
      if (data.after.memory.heapUsed > limit) {
        testsExceedingLimit.push(testName)
      } else if (data.after.memory.heapUsed > warningThreshold) {
        testsExceedingWarning.push(testName)
      }
    })

    // Check for memory leaks
    const snapshots = this.profiler.getHistory()
    let potentialLeak = false
    let leakReason = ''
    let growthRate = 0

    if (snapshots.length >= 3) {
      const heapValues = snapshots.map((s) => s.memory.heapUsed)
      let continuousGrowth = true

      for (let i = 1; i < heapValues.length; i++) {
        const current = heapValues[i]
        const previous = heapValues[i - 1]
        if (current !== undefined && previous !== undefined && current <= previous) {
          continuousGrowth = false
          break
        }
      }

      if (continuousGrowth && heapValues.length > 0) {
        potentialLeak = true
        leakReason = 'Continuous memory growth detected'
        const first = heapValues[0]
        const last = heapValues[heapValues.length - 1]
        if (first !== undefined && last !== undefined && first > 0) {
          growthRate = ((last - first) / first) * 100
        }
      }
    }

    // Calculate average memory usage, handling empty arrays
    const averageMemoryUsage =
      heapUsages.length > 0 ? heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length : 0

    // Calculate peak memory usage, handling empty arrays
    const peakMemoryUsage = heapUsages.length > 0 ? Math.max(...heapUsages) : 0

    // Calculate memory growth trend, handling empty arrays
    let memoryGrowthTrend = 0
    if (tests.length > 1) {
      const firstTest = tests[0]
      const lastTest = tests[tests.length - 1]
      if (firstTest && lastTest) {
        memoryGrowthTrend = lastTest.after.memory.heapUsed - firstTest.before.memory.heapUsed
      }
    }

    return {
      totalTests: tests.length,
      averageMemoryUsage,
      peakMemoryUsage,
      memoryGrowthTrend,
      testsExceedingWarning,
      testsExceedingLimit,
      potentialLeak,
      leakReason,
      memoryGrowthRate: growthRate,
    }
  }

  async exportTrendReport(filePath: string): Promise<void> {
    if (!this.debugMode) return // Skip report generation unless debugging
    const report = this.generateTrendReport()
    const fs = await import('fs/promises')
    await fs.writeFile(filePath, JSON.stringify(report, null, 2))
  }

  detectMemoryLeaks() {
    return this.profiler.detectLeaks()
  }

  getProfiler(): MemoryProfiler {
    return this.profiler
  }

  getTestCount(): number {
    return this.testData.size
  }

  cleanup(): void {
    try {
      this.testData.clear()
      this.testOptions.clear()
      this.profiler.reset()
    } catch (error) {
      console.error('Error during memory monitor cleanup:', error)
    }
  }
}
