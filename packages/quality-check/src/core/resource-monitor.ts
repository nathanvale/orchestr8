/**
 * Resource monitoring for quality check operations
 */
export interface ResourceThresholds {
  memoryThresholdMB?: number
  cpuThreshold?: number
  enableBackpressure?: boolean
}

export interface ResourceStatus {
  memoryUsed: number
  memoryTotal: number
  memoryPercent: number
  cpuUsage?: number
  isUnderPressure: boolean
}

/**
 * Monitors system resources during quality check operations
 */
export class ResourceMonitor {
  private startMemory: number
  private thresholds: ResourceThresholds
  private checkInterval: NodeJS.Timeout | null = null
  private memorySnapshots: number[] = []
  private readonly MAX_SNAPSHOTS = 10

  constructor(thresholds: ResourceThresholds = {}) {
    this.thresholds = {
      memoryThresholdMB: thresholds.memoryThresholdMB ?? 500,
      cpuThreshold: thresholds.cpuThreshold ?? 90,
      enableBackpressure: thresholds.enableBackpressure ?? false,
    }
    this.startMemory = process.memoryUsage().heapUsed
  }

  /**
   * Start monitoring resources
   */
  startMonitoring(intervalMs = 100): void {
    if (this.checkInterval) {
      return
    }

    this.checkInterval = setInterval(() => {
      const memUsage = process.memoryUsage().heapUsed
      this.memorySnapshots.push(memUsage)
      if (this.memorySnapshots.length > this.MAX_SNAPSHOTS) {
        this.memorySnapshots.shift()
      }
    }, intervalMs)
  }

  /**
   * Stop monitoring resources
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  /**
   * Get current resource status
   */
  getStatus(): ResourceStatus {
    const memUsage = process.memoryUsage()
    const memoryUsedMB = memUsage.heapUsed / (1024 * 1024)
    const memoryTotalMB = memUsage.heapTotal / (1024 * 1024)
    const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100

    const isUnderPressure =
      this.thresholds.memoryThresholdMB !== undefined &&
      memoryUsedMB > this.thresholds.memoryThresholdMB

    return {
      memoryUsed: memoryUsedMB,
      memoryTotal: memoryTotalMB,
      memoryPercent,
      isUnderPressure,
    }
  }

  /**
   * Check if memory pressure is detected
   */
  isMemoryPressure(): boolean {
    const status = this.getStatus()
    return status.isUnderPressure
  }

  /**
   * Get memory growth rate (MB/s)
   */
  getMemoryGrowthRate(): number {
    if (this.memorySnapshots.length < 2) {
      return 0
    }

    const first = this.memorySnapshots[0]
    const last = this.memorySnapshots[this.memorySnapshots.length - 1]
    const durationMs = this.memorySnapshots.length * 100 // Based on default interval
    const growthBytes = last - first
    const growthMBPerSec = growthBytes / (1024 * 1024) / (durationMs / 1000)

    return growthMBPerSec
  }

  /**
   * Predict if memory will exceed threshold soon
   */
  predictMemoryExhaustion(withinMs = 5000): boolean {
    const growthRate = this.getMemoryGrowthRate()
    if (growthRate <= 0) {
      return false
    }

    const status = this.getStatus()
    const remainingMB = (this.thresholds.memoryThresholdMB ?? 500) - status.memoryUsed
    const timeToExhaustionMs = (remainingMB / growthRate) * 1000

    return timeToExhaustionMs < withinMs
  }

  /**
   * Calculate batch size based on memory pressure
   */
  calculateBatchSize(defaultSize: number, minSize = 1): number {
    if (!this.thresholds.enableBackpressure) {
      return defaultSize
    }

    const status = this.getStatus()

    // If under pressure, reduce batch size
    if (status.isUnderPressure) {
      return Math.max(minSize, Math.floor(defaultSize * 0.25))
    }

    // If memory usage is high but not critical, scale down proportionally
    const memoryPercent = status.memoryPercent
    if (memoryPercent > 70) {
      const scale = (100 - memoryPercent) / 30 // Scale from 1 to 0 as memory goes from 70% to 100%
      return Math.max(minSize, Math.floor(defaultSize * scale))
    }

    return defaultSize
  }

  /**
   * Should skip non-critical operations
   */
  shouldSkipNonCritical(): boolean {
    const status = this.getStatus()
    return status.isUnderPressure || status.memoryPercent > 85
  }

  /**
   * Get memory growth since monitor creation (MB)
   */
  getMemoryGrowthFromStart(): number {
    const currentMemory = process.memoryUsage().heapUsed
    const growthBytes = currentMemory - this.startMemory
    return growthBytes / (1024 * 1024)
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopMonitoring()
    this.memorySnapshots = []
  }
}
