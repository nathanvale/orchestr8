import type { CancellationToken } from './timeout-manager.js'
import { ResourceMonitor } from './resource-monitor.js'

export interface BatchProcessorOptions {
  batchSize?: number
  baseTimeout?: number
  timeoutPerFile?: number
  memoryThresholdMB?: number
  enableBackpressure?: boolean
  continueOnTimeout?: boolean
}

export interface BatchResult<T> {
  results: T[]
  errors: Error[]
  skipped: number
  processed: number
}

/**
 * Processes files in batches with resource management
 */
export class FileBatchProcessor {
  private resourceMonitor: ResourceMonitor

  constructor(private options: BatchProcessorOptions = {}) {
    this.resourceMonitor = new ResourceMonitor({
      memoryThresholdMB: options.memoryThresholdMB,
      enableBackpressure: options.enableBackpressure,
    })
  }

  /**
   * Process files in batches with adaptive sizing
   */
  async processBatches<T>(
    files: string[],
    processor: (batch: string[], token?: CancellationToken) => Promise<T>,
    token?: CancellationToken,
  ): Promise<BatchResult<T>> {
    const results: T[] = []
    const errors: Error[] = []
    let processed = 0
    let skipped = 0

    // Start resource monitoring
    this.resourceMonitor.startMonitoring()

    try {
      const defaultBatchSize = this.options.batchSize ?? 100
      let currentIndex = 0

      while (currentIndex < files.length) {
        // Check for cancellation
        if (token?.isCancellationRequested) {
          skipped = files.length - currentIndex
          break
        }

        // Calculate adaptive batch size based on memory pressure
        const batchSize = this.resourceMonitor.calculateBatchSize(defaultBatchSize)
        const batch = files.slice(currentIndex, currentIndex + batchSize)

        try {
          // Process batch
          const result = await processor(batch, token)
          results.push(result)
          processed += batch.length
        } catch (error) {
          errors.push(error as Error)

          if (!this.options.continueOnTimeout) {
            skipped = files.length - (currentIndex + batch.length)
            break
          }
        }

        currentIndex += batchSize

        // Apply backpressure if memory pressure detected
        if (this.resourceMonitor.isMemoryPressure()) {
          // Add delay to allow garbage collection
          await this.delay(100)
        }
      }
    } finally {
      this.resourceMonitor.cleanup()
    }

    return {
      results,
      errors,
      skipped,
      processed,
    }
  }

  /**
   * Calculate dynamic timeout based on file count
   */
  calculateTimeout(fileCount: number): number {
    const baseTimeout = this.options.baseTimeout ?? 1000
    const timeoutPerFile = this.options.timeoutPerFile ?? 10
    return baseTimeout + fileCount * timeoutPerFile
  }

  /**
   * Split files into optimal batches
   */
  splitIntoBatches(files: string[], maxBatchSize?: number): string[][] {
    const batchSize = maxBatchSize ?? this.options.batchSize ?? 100
    const batches: string[][] = []

    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize))
    }

    return batches
  }

  /**
   * Process files with priority (critical first)
   */
  async processWithPriority<T>(
    criticalFiles: string[],
    nonCriticalFiles: string[],
    processor: (batch: string[], critical: boolean, token?: CancellationToken) => Promise<T>,
    token?: CancellationToken,
  ): Promise<BatchResult<T>> {
    const results: T[] = []
    const errors: Error[] = []
    let processed = 0
    let skipped = 0

    // Process critical files first
    const criticalResult = await this.processBatches(
      criticalFiles,
      (batch, t) => processor(batch, true, t),
      token,
    )

    results.push(...criticalResult.results)
    errors.push(...criticalResult.errors)
    processed += criticalResult.processed
    skipped += criticalResult.skipped

    // Check if we should skip non-critical files due to resource pressure
    if (!this.resourceMonitor.shouldSkipNonCritical() && !token?.isCancellationRequested) {
      const nonCriticalResult = await this.processBatches(
        nonCriticalFiles,
        (batch, t) => processor(batch, false, t),
        token,
      )

      results.push(...nonCriticalResult.results)
      errors.push(...nonCriticalResult.errors)
      processed += nonCriticalResult.processed
      skipped += nonCriticalResult.skipped
    } else {
      skipped += nonCriticalFiles.length
    }

    return {
      results,
      errors,
      skipped,
      processed,
    }
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get resource status
   */
  getResourceStatus() {
    return this.resourceMonitor.getStatus()
  }
}
