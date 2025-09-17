export interface MemorySnapshot {
  label: string
  timestamp: Date
  memory: {
    rss: number // in MB
    heapTotal: number // in MB
    heapUsed: number // in MB
    external: number // in MB
    arrayBuffers: number // in MB
    totalAllocated: number // in MB
  }
}

export interface MemoryDelta {
  rss: number
  heapTotal: number
  heapUsed: number
  external: number
  arrayBuffers: number
  totalAllocated: number
}

export interface MemoryReport {
  snapshots: MemorySnapshot[]
  summary: {
    peakHeapUsed: number
    peakRss: number
    averageHeapUsed: number
    totalSnapshots: number
  }
  timeline: Array<{
    label: string
    timestamp: Date
    heapUsed: number
    rss: number
  }>
  growth?: {
    heapGrowth: number
    rssGrowth: number
    percentGrowth: number
  }
}

export interface LeakDetectionResult {
  potentialLeak: boolean
  reason: string
  growthRate?: number
}

export class MemoryProfiler {
  private snapshots: MemorySnapshot[] = []

  /**
   * Capture a memory snapshot at a specific point
   */
  snapshot(label: string): MemorySnapshot {
    const usage = process.memoryUsage()
    const snapshot: MemorySnapshot = {
      label,
      timestamp: new Date(),
      memory: {
        rss: Math.round((usage.rss / 1024 / 1024) * 100) / 100,
        heapTotal: Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsed: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100,
        external: Math.round((usage.external / 1024 / 1024) * 100) / 100,
        arrayBuffers: Math.round((usage.arrayBuffers / 1024 / 1024) * 100) / 100,
        totalAllocated: 0,
      },
    }

    // Calculate total allocated memory
    snapshot.memory.totalAllocated =
      Math.round(
        (snapshot.memory.rss + snapshot.memory.external + snapshot.memory.arrayBuffers) * 100,
      ) / 100

    this.snapshots.push(snapshot)
    return snapshot
  }

  /**
   * Get all captured snapshots
   */
  getHistory(): MemorySnapshot[] {
    return [...this.snapshots]
  }

  /**
   * Calculate memory delta between two snapshots
   */
  getDelta(fromLabel: string, toLabel: string): MemoryDelta {
    const fromSnapshot = this.snapshots.find((s) => s.label === fromLabel)
    const toSnapshot = this.snapshots.find((s) => s.label === toLabel)

    if (!fromSnapshot) {
      throw new Error(`Snapshot with label "${fromLabel}" not found`)
    }
    if (!toSnapshot) {
      throw new Error(`Snapshot with label "${toLabel}" not found`)
    }

    return {
      rss: Math.round((toSnapshot.memory.rss - fromSnapshot.memory.rss) * 100) / 100,
      heapTotal:
        Math.round((toSnapshot.memory.heapTotal - fromSnapshot.memory.heapTotal) * 100) / 100,
      heapUsed: Math.round((toSnapshot.memory.heapUsed - fromSnapshot.memory.heapUsed) * 100) / 100,
      external: Math.round((toSnapshot.memory.external - fromSnapshot.memory.external) * 100) / 100,
      arrayBuffers:
        Math.round((toSnapshot.memory.arrayBuffers - fromSnapshot.memory.arrayBuffers) * 100) / 100,
      totalAllocated:
        Math.round((toSnapshot.memory.totalAllocated - fromSnapshot.memory.totalAllocated) * 100) /
        100,
    }
  }

  /**
   * Generate a comprehensive memory report
   */
  getReport(): MemoryReport {
    const heapUsedValues = this.snapshots.map((s) => s.memory.heapUsed)
    const rssValues = this.snapshots.map((s) => s.memory.rss)

    const report: MemoryReport = {
      snapshots: [...this.snapshots],
      summary: {
        peakHeapUsed: Math.max(...heapUsedValues),
        peakRss: Math.max(...rssValues),
        averageHeapUsed:
          Math.round(
            (heapUsedValues.reduce((sum, val) => sum + val, 0) / heapUsedValues.length) * 100,
          ) / 100,
        totalSnapshots: this.snapshots.length,
      },
      timeline: this.snapshots.map((s) => ({
        label: s.label,
        timestamp: s.timestamp,
        heapUsed: s.memory.heapUsed,
        rss: s.memory.rss,
      })),
    }

    // Add growth analysis if we have at least 2 snapshots
    if (this.snapshots.length >= 2) {
      const first = this.snapshots[0]
      const last = this.snapshots[this.snapshots.length - 1]

      const heapGrowth = Math.round((last.memory.heapUsed - first.memory.heapUsed) * 100) / 100
      const rssGrowth = Math.round((last.memory.rss - first.memory.rss) * 100) / 100
      const percentGrowth = Math.round((heapGrowth / first.memory.heapUsed) * 100 * 100) / 100

      report.growth = {
        heapGrowth,
        rssGrowth,
        percentGrowth,
      }
    }

    return report
  }

  /**
   * Reset all snapshots
   */
  reset(): void {
    this.snapshots = []
  }

  /**
   * Detect potential memory leaks based on growth patterns
   */
  detectLeaks(): LeakDetectionResult {
    if (this.snapshots.length < 3) {
      return {
        potentialLeak: false,
        reason: 'Insufficient data points for leak detection',
      }
    }

    const heapValues = this.snapshots.map((s) => s.memory.heapUsed)

    // Check for continuous growth
    let continuousGrowth = true
    for (let i = 1; i < heapValues.length; i++) {
      if (heapValues[i] <= heapValues[i - 1]) {
        continuousGrowth = false
        break
      }
    }

    if (continuousGrowth) {
      const first = heapValues[0]
      const last = heapValues[heapValues.length - 1]
      const growthRate = Math.round(((last - first) / first) * 100 * 100) / 100

      return {
        potentialLeak: true,
        reason: `Continuous heap growth detected across ${this.snapshots.length} snapshots`,
        growthRate,
      }
    }

    // Check for overall growth trend (allowing some fluctuation)
    const first = heapValues[0]
    const last = heapValues[heapValues.length - 1]
    const growthPercent = ((last - first) / first) * 100

    if (growthPercent > 50) {
      return {
        potentialLeak: true,
        reason: `Significant memory growth of ${Math.round(growthPercent)}% detected`,
        growthRate: Math.round(growthPercent * 100) / 100,
      }
    }

    return {
      potentialLeak: false,
      reason: 'Memory usage is stable',
    }
  }

  /**
   * Format report as a readable string
   */
  formatReport(): string {
    const report = this.getReport()
    const lines: string[] = [
      '=== Memory Profile Report ===',
      '',
      '📊 Summary:',
      `  Peak Heap Used: ${report.summary.peakHeapUsed.toFixed(2)} MB`,
      `  Peak RSS: ${report.summary.peakRss.toFixed(2)} MB`,
      `  Average Heap Used: ${report.summary.averageHeapUsed.toFixed(2)} MB`,
      `  Total Snapshots: ${report.summary.totalSnapshots}`,
      '',
    ]

    if (report.growth) {
      lines.push('📈 Growth Analysis:')
      lines.push(`  Heap Growth: ${report.growth.heapGrowth.toFixed(2)} MB`)
      lines.push(`  RSS Growth: ${report.growth.rssGrowth.toFixed(2)} MB`)
      lines.push(`  Percent Growth: ${report.growth.percentGrowth.toFixed(2)}%`)
      lines.push('')
    }

    lines.push('📸 Snapshots:')
    report.snapshots.forEach((snapshot) => {
      lines.push(`  ${snapshot.label}:`)
      lines.push(`    Time: ${snapshot.timestamp.toISOString()}`)
      lines.push(`    Heap Used: ${snapshot.memory.heapUsed.toFixed(2)} MB`)
      lines.push(`    RSS: ${snapshot.memory.rss.toFixed(2)} MB`)
      lines.push(`    Total Allocated: ${snapshot.memory.totalAllocated.toFixed(2)} MB`)
    })

    const leakDetection = this.detectLeaks()
    lines.push('')
    lines.push('🔍 Leak Detection:')
    lines.push(`  Potential Leak: ${leakDetection.potentialLeak ? '⚠️ Yes' : '✅ No'}`)
    lines.push(`  Reason: ${leakDetection.reason}`)
    if (leakDetection.growthRate !== undefined) {
      lines.push(`  Growth Rate: ${leakDetection.growthRate.toFixed(2)}%`)
    }

    return lines.join('\n')
  }
}
