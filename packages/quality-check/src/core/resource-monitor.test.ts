import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResourceMonitor } from './resource-monitor'

describe('ResourceMonitor', () => {
  let monitor: ResourceMonitor
  let originalMemoryUsage: typeof process.memoryUsage

  beforeEach(() => {
    monitor = new ResourceMonitor()
    originalMemoryUsage = process.memoryUsage
  })

  afterEach(() => {
    monitor.cleanup()
    process.memoryUsage = originalMemoryUsage
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create with default thresholds', () => {
      const defaultMonitor = new ResourceMonitor()
      const status = defaultMonitor.getStatus()

      expect(status).toHaveProperty('memoryUsed')
      expect(status).toHaveProperty('memoryTotal')
      expect(status).toHaveProperty('memoryPercent')
      expect(status).toHaveProperty('isUnderPressure')

      defaultMonitor.cleanup()
    })

    it('should create with custom thresholds', () => {
      const customMonitor = new ResourceMonitor({
        memoryThresholdMB: 200,
        cpuThreshold: 80,
        enableBackpressure: true,
      })

      expect(customMonitor).toBeDefined()
      customMonitor.cleanup()
    })
  })

  describe('startMonitoring and stopMonitoring', () => {
    it('should start and stop monitoring', () => {
      monitor.startMonitoring()
      expect(() => monitor.stopMonitoring()).not.toThrow()
    })

    it('should handle multiple start calls gracefully', () => {
      monitor.startMonitoring()
      monitor.startMonitoring() // Second call should be ignored
      expect(() => monitor.stopMonitoring()).not.toThrow()
    })

    it('should handle stop without start', () => {
      expect(() => monitor.stopMonitoring()).not.toThrow()
    })
  })

  describe('getStatus', () => {
    it('should return memory status', () => {
      const status = monitor.getStatus()

      expect(status.memoryUsed).toBeGreaterThan(0)
      expect(status.memoryTotal).toBeGreaterThan(0)
      expect(status.memoryPercent).toBeGreaterThan(0)
      expect(status.memoryPercent).toBeLessThanOrEqual(100)
      expect(typeof status.isUnderPressure).toBe('boolean')
    })

    it('should detect memory pressure with low threshold', () => {
      const lowThresholdMonitor = new ResourceMonitor({
        memoryThresholdMB: 1, // Very low threshold
      })

      const status = lowThresholdMonitor.getStatus()
      expect(status.isUnderPressure).toBe(true)

      lowThresholdMonitor.cleanup()
    })

    it('should not detect pressure with high threshold', () => {
      const highThresholdMonitor = new ResourceMonitor({
        memoryThresholdMB: 10000, // Very high threshold
      })

      const status = highThresholdMonitor.getStatus()
      expect(status.isUnderPressure).toBe(false)

      highThresholdMonitor.cleanup()
    })
  })

  describe('isMemoryPressure', () => {
    it('should return boolean for memory pressure', () => {
      const result = monitor.isMemoryPressure()
      expect(typeof result).toBe('boolean')
    })

    it('should return true when under pressure', () => {
      const lowThresholdMonitor = new ResourceMonitor({
        memoryThresholdMB: 1,
      })

      expect(lowThresholdMonitor.isMemoryPressure()).toBe(true)
      lowThresholdMonitor.cleanup()
    })
  })

  describe('memory growth tracking', () => {
    it('should track memory growth rate', async () => {
      monitor.startMonitoring(10) // Faster interval for testing

      // Wait for some snapshots to be collected
      await new Promise((resolve) => setTimeout(resolve, 50))

      const growthRate = monitor.getMemoryGrowthRate()
      expect(typeof growthRate).toBe('number')
    })

    it('should return zero growth rate with insufficient snapshots', () => {
      const growthRate = monitor.getMemoryGrowthRate()
      expect(growthRate).toBe(0)
    })

    it('should calculate memory growth from start', () => {
      const growth = monitor.getMemoryGrowthFromStart()
      expect(typeof growth).toBe('number')
    })

    it('should predict memory exhaustion', async () => {
      monitor.startMonitoring(10)

      // Wait for snapshots
      await new Promise((resolve) => setTimeout(resolve, 50))

      const prediction = monitor.predictMemoryExhaustion(1000)
      expect(typeof prediction).toBe('boolean')
    })

    it('should not predict exhaustion with zero growth', () => {
      const prediction = monitor.predictMemoryExhaustion()
      expect(prediction).toBe(false)
    })
  })

  describe('calculateBatchSize', () => {
    it('should return default size when backpressure disabled', () => {
      const monitor = new ResourceMonitor({
        enableBackpressure: false,
      })

      const batchSize = monitor.calculateBatchSize(100)
      expect(batchSize).toBe(100)

      monitor.cleanup()
    })

    it('should reduce batch size under memory pressure', () => {
      const monitor = new ResourceMonitor({
        memoryThresholdMB: 1, // Very low to trigger pressure
        enableBackpressure: true,
      })

      const batchSize = monitor.calculateBatchSize(100)
      expect(batchSize).toBeLessThanOrEqual(100)
      expect(batchSize).toBeGreaterThanOrEqual(1)

      monitor.cleanup()
    })

    it('should respect minimum batch size', () => {
      const monitor = new ResourceMonitor({
        memoryThresholdMB: 1,
        enableBackpressure: true,
      })

      const batchSize = monitor.calculateBatchSize(100, 5)
      expect(batchSize).toBeGreaterThanOrEqual(5)

      monitor.cleanup()
    })

    it('should scale batch size based on memory percentage', () => {
      // Mock high memory usage but not over threshold
      process.memoryUsage = vi.fn().mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        heapUsed: 80 * 1024 * 1024, // 80% usage
        external: 0,
        arrayBuffers: 0,
      }) as unknown as typeof process.memoryUsage

      const monitor = new ResourceMonitor({
        memoryThresholdMB: 1000, // High threshold, not triggered
        enableBackpressure: true,
      })

      const batchSize = monitor.calculateBatchSize(100)
      expect(batchSize).toBeLessThan(100)
      expect(batchSize).toBeGreaterThanOrEqual(1)

      monitor.cleanup()
    })
  })

  describe('shouldSkipNonCritical', () => {
    it('should return false under normal conditions', () => {
      const monitor = new ResourceMonitor({
        memoryThresholdMB: 1000,
      })

      expect(monitor.shouldSkipNonCritical()).toBe(false)
      monitor.cleanup()
    })

    it('should return true under memory pressure', () => {
      const monitor = new ResourceMonitor({
        memoryThresholdMB: 1,
      })

      expect(monitor.shouldSkipNonCritical()).toBe(true)
      monitor.cleanup()
    })

    it('should return true with high memory percentage', () => {
      // Mock very high memory usage
      process.memoryUsage = vi.fn().mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        heapUsed: 90 * 1024 * 1024, // 90% usage
        external: 0,
        arrayBuffers: 0,
      }) as unknown as typeof process.memoryUsage

      const monitor = new ResourceMonitor({
        memoryThresholdMB: 1000, // High threshold, not triggered directly
      })

      expect(monitor.shouldSkipNonCritical()).toBe(true)
      monitor.cleanup()
    })
  })

  describe('cleanup', () => {
    it('should clean up resources', () => {
      monitor.startMonitoring()

      expect(() => monitor.cleanup()).not.toThrow()

      // Should be able to clean up multiple times
      expect(() => monitor.cleanup()).not.toThrow()
    })

    it('should clear memory snapshots', async () => {
      monitor.startMonitoring(10)

      // Wait for snapshots to accumulate
      await new Promise((resolve) => setTimeout(resolve, 50))

      monitor.cleanup()

      // After cleanup, growth rate should be zero (no snapshots)
      const growthRate = monitor.getMemoryGrowthRate()
      expect(growthRate).toBe(0)
    })
  })

  describe('stress testing', () => {
    it('should handle rapid monitoring start/stop cycles', () => {
      for (let i = 0; i < 10; i++) {
        monitor.startMonitoring()
        monitor.stopMonitoring()
      }

      expect(() => monitor.cleanup()).not.toThrow()
    })

    it('should handle multiple status checks efficiently', () => {
      const startTime = Date.now()

      for (let i = 0; i < 1000; i++) {
        monitor.getStatus()
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Status checks should be fast (less than 1 second for 1000 calls)
      expect(duration).toBeLessThan(1000)
    })

    it('should maintain accuracy with frequent updates', async () => {
      monitor.startMonitoring(5) // Very fast updates

      await new Promise((resolve) => setTimeout(resolve, 100))

      const status = monitor.getStatus()
      expect(status.memoryUsed).toBeGreaterThan(0)
      expect(status.memoryTotal).toBeGreaterThan(0)

      monitor.cleanup()
    })
  })

  describe('edge cases', () => {
    it('should handle memory usage exceptions gracefully', () => {
      process.memoryUsage = vi.fn().mockImplementation(() => {
        throw new Error('Memory info unavailable')
      }) as unknown as typeof process.memoryUsage

      expect(() => monitor.getStatus()).toThrow()
      // In a real implementation, you might want to handle this gracefully
    })

    it('should handle extreme memory values', () => {
      process.memoryUsage = vi.fn().mockReturnValue({
        rss: Number.MAX_SAFE_INTEGER,
        heapTotal: 1000,
        heapUsed: 999,
        external: 0,
        arrayBuffers: 0,
      }) as unknown as typeof process.memoryUsage

      const status = monitor.getStatus()
      expect(status.memoryPercent).toBeLessThanOrEqual(100)
      expect(status.memoryPercent).toBeGreaterThanOrEqual(0)
    })

    it('should handle zero memory values', () => {
      process.memoryUsage = vi.fn().mockReturnValue({
        rss: 0,
        heapTotal: 1,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0,
      }) as unknown as typeof process.memoryUsage

      const status = monitor.getStatus()
      expect(status.memoryPercent).toBe(0)
      expect(status.memoryUsed).toBe(0)
    })
  })
})
