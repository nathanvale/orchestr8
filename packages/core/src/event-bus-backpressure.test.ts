/**
 * Tests for Event Bus Backpressure and Memory Leak Prevention
 * These tests validate new Task 11 features for high-throughput scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { OrchestrationEvent } from './event-bus.js'

import { BoundedEventBus } from './event-bus.js'

describe('Event Bus Backpressure Tests', () => {
  let eventBus: BoundedEventBus

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Task 11.1: Backpressure Handling', () => {
    it('should apply backpressure when queue utilization exceeds threshold', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 10,
        enableBackpressure: true,
        backpressureThreshold: 0.5, // 50% threshold
        maxBackpressureDelayMs: 100,
      })

      let blockProcessing = true

      // Very slow processing to ensure queue builds up
      eventBus.on('test.backpressure', async () => {
        while (blockProcessing) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      })

      // Emit events in parallel to build up queue rapidly
      const promises = []
      for (let i = 0; i < 7; i++) {
        promises.push(
          eventBus.emitEventAsync({
            type: 'test.backpressure',
            id: i,
          } as OrchestrationEvent),
        )
      }

      // Wait for all emissions - backpressure should kick in as queue builds
      const startTime = Date.now()
      await Promise.all(promises)
      const endTime = Date.now()

      const metrics = eventBus.getMetrics()

      // Should have triggered backpressure due to queue buildup
      expect(metrics.backpressure.triggerCount).toBeGreaterThan(0)
      // Should take longer due to backpressure delays
      expect(endTime - startTime).toBeGreaterThan(50)

      // Allow processing to complete for cleanup
      blockProcessing = false
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    it('should release backpressure when utilization drops', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 10,
        enableBackpressure: true,
        backpressureThreshold: 0.8,
        maxBackpressureDelayMs: 20,
      })

      eventBus.on('test.release', () => {
        // Process event
      })

      // First, trigger backpressure
      for (let i = 0; i < 15; i++) {
        await eventBus.emitEventAsync({
          type: 'test.release',
          id: i,
        } as OrchestrationEvent)
      }

      // Wait for processing to catch up
      await new Promise((resolve) => setTimeout(resolve, 100))

      const metrics = eventBus.getMetrics()
      expect(metrics.backpressure.isActive).toBe(false) // Should be released
      expect(metrics.backpressure.utilization).toBeLessThan(0.8)
    })

    it('should work without backpressure for backward compatibility', () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 5,
        enableBackpressure: false, // Disabled
      })

      eventBus.on('test.no-backpressure', () => {
        // Process event
      })

      // Should work synchronously without delays
      const startTime = Date.now()
      for (let i = 0; i < 10; i++) {
        eventBus.emitEvent({
          type: 'test.no-backpressure',
          id: i,
        } as OrchestrationEvent)
      }
      const endTime = Date.now()

      const metrics = eventBus.getMetrics()
      expect(metrics.backpressure.isActive).toBe(false)
      expect(metrics.backpressure.triggerCount).toBe(0)
      expect(endTime - startTime).toBeLessThan(10) // Should be very fast
    })
  })

  describe('Task 11.2: Bounded Queue Management', () => {
    it('should respect configurable batch sizes', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 100,
        maxBatchSize: 5, // Small batches
        maxProcessingTimeMs: 20,
      })

      eventBus.on('test.batching', () => {
        // Process batch
      })

      // Emit many events
      for (let i = 0; i < 50; i++) {
        eventBus.emitEvent({
          type: 'test.batching',
          id: i,
        } as OrchestrationEvent)
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200))

      const metrics = eventBus.getMetrics()
      expect(metrics.processing.avgBatchSize).toBeLessThanOrEqual(5) // Should respect batch size limit
      expect(metrics.processing.totalCycles).toBeGreaterThan(1) // Should have multiple cycles
    })

    it('should respect processing time limits', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 1000,
        maxBatchSize: 100,
        maxProcessingTimeMs: 2, // Very short processing time
      })

      eventBus.on('test.timing', () => {
        // Process event
      })

      // Emit many events
      for (let i = 0; i < 200; i++) {
        eventBus.emitEvent({
          type: 'test.timing',
          id: i,
        } as OrchestrationEvent)
      }

      await new Promise((resolve) => setTimeout(resolve, 100))

      const metrics = eventBus.getMetrics()
      // Should have many cycles due to time limits
      expect(metrics.processing.totalCycles).toBeGreaterThan(5)
      expect(metrics.processing.avgProcessingTimeMs).toBeLessThan(10) // Should be fast per cycle
    })

    it('should validate configuration boundaries', () => {
      expect(() => {
        new BoundedEventBus({
          backpressureThreshold: 1.5, // Invalid - > 1.0
        })
      }).toThrow('backpressureThreshold must be between 0.0 and 1.0')

      expect(() => {
        new BoundedEventBus({
          backpressureThreshold: -0.1, // Invalid - < 0.0
        })
      }).toThrow('backpressureThreshold must be between 0.0 and 1.0')

      // Valid configurations should work
      expect(() => {
        new BoundedEventBus({
          backpressureThreshold: 0.5,
          maxBackpressureDelayMs: 200,
          maxBatchSize: 20,
          maxProcessingTimeMs: 10,
        })
      }).not.toThrow()
    })
  })

  describe('Task 11.3: Unbounded Growth Prevention', () => {
    it('should prevent queue from growing beyond limits even under extreme load', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 50,
        enableBackpressure: true,
        backpressureThreshold: 0.9,
        maxBackpressureDelayMs: 5, // Small delay
      })

      eventBus.on('test.growth', async () => {
        // Simulate slow processing
        await new Promise((resolve) => setTimeout(resolve, 1))
      })

      // Emit events rapidly
      const emitPromises = []
      for (let i = 0; i < 500; i++) {
        emitPromises.push(
          eventBus.emitEventAsync({
            type: 'test.growth',
            id: i,
          } as OrchestrationEvent),
        )
      }

      await Promise.all(emitPromises)

      const metrics = eventBus.getMetrics()

      // Queue should never exceed the max size
      expect(metrics.queueSize).toBeLessThanOrEqual(50)
      expect(metrics.highWaterMark).toBeLessThanOrEqual(50)

      // Backpressure should have been triggered to prevent unbounded growth
      expect(metrics.backpressure.triggerCount).toBeGreaterThan(0)
    })

    it('should maintain bounded memory usage with large events', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 20,
        enableBackpressure: true,
        enableMemoryTracking: true,
        backpressureThreshold: 0.7,
      })

      // Add a slow listener to prevent immediate processing
      eventBus.on('test.memory', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      // Emit large events rapidly to fill queue
      for (let i = 0; i < 100; i++) {
        eventBus.emitEvent({
          type: 'test.memory',
          id: i,
          largeData: 'x'.repeat(10000), // 10KB per event
        } as OrchestrationEvent)
      }

      // Wait briefly for initial processing
      await new Promise((resolve) => setTimeout(resolve, 50))

      const metrics = eventBus.getMetrics()

      // Should maintain bounded queue size despite large events
      expect(metrics.queueSize).toBeLessThanOrEqual(20)
      expect(metrics.droppedCount).toBeGreaterThan(0) // Should drop events to maintain bounds
    })
  })

  describe('Task 11.4: Monitoring and Alerting', () => {
    it('should provide comprehensive metrics for monitoring', () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 10,
        enableBackpressure: true,
        enableMemoryTracking: true,
      })

      const metrics = eventBus.getMetrics()

      // Should include new backpressure metrics
      expect(metrics.backpressure).toBeDefined()
      expect(typeof metrics.backpressure.isActive).toBe('boolean')
      expect(typeof metrics.backpressure.utilization).toBe('number')
      expect(typeof metrics.backpressure.currentDelayMs).toBe('number')
      expect(typeof metrics.backpressure.triggerCount).toBe('number')

      // Should include processing metrics
      expect(metrics.processing).toBeDefined()
      expect(typeof metrics.processing.avgBatchSize).toBe('number')
      expect(typeof metrics.processing.avgProcessingTimeMs).toBe('number')
      expect(typeof metrics.processing.totalCycles).toBe('number')
      expect(typeof metrics.processing.avgLagMs).toBe('number')
    })

    it('should track processing lag for performance monitoring', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 100,
        maxBatchSize: 5,
      })

      eventBus.on('test.lag', async () => {
        // Add processing delay to create measurable lag
        await new Promise((resolve) => setTimeout(resolve, 20))
      })

      // Emit events with timestamps
      for (let i = 0; i < 20; i++) {
        eventBus.emitEvent({
          type: 'test.lag',
          id: i,
        } as OrchestrationEvent)
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200))

      const metrics = eventBus.getMetrics()

      // Should measure lag between emission and processing
      expect(metrics.processing.avgLagMs).toBeGreaterThan(0)
      expect(metrics.processing.totalCycles).toBeGreaterThan(0)
    })

    it('should provide utilization metrics for alerting', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 10,
        enableBackpressure: true,
        backpressureThreshold: 0.8,
      })

      // Add a slow listener to prevent immediate processing
      eventBus.on('test.utilization', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      // Fill queue partially using sync emission to avoid immediate processing
      for (let i = 0; i < 6; i++) {
        eventBus.emitEvent({
          type: 'test.utilization',
          id: i,
        } as OrchestrationEvent)
      }

      // Check metrics immediately before significant processing occurs
      const metrics = eventBus.getMetrics()

      // Give some time for slow processing to start
      await new Promise((resolve) => setTimeout(resolve, 5))

      // Should accurately report utilization
      expect(metrics.backpressure.utilization).toBe(0.6) // 6/10
      expect(metrics.queueSize).toBe(6)

      // Should not be at backpressure threshold yet
      expect(metrics.backpressure.isActive).toBe(false)
    })
  })
})
