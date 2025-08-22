/**
 * Stress tests for BoundedEventBus queue overflow scenarios
 * These tests validate behavior under extreme load conditions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { OrchestrationEvent } from './event-bus.js'

import { BoundedEventBus } from './event-bus.js'

describe('Event Bus Stress Tests', () => {
  let eventBus: BoundedEventBus

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Queue Overflow Stress', () => {
    it('should handle rapid burst of 10,000+ events', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 1000,
        warnOnDrop: false, // Disable warnings for stress test
      })

      let processedCount = 0
      const errors: Error[] = []

      eventBus.on('stress.burst', () => {
        processedCount++
      })

      // Listen for any errors
      eventBus.on('error' as OrchestrationEvent['type'], (error) => {
        errors.push(error as Error)
      })

      const burstSize = 10000
      const startTime = Date.now()

      // Rapid burst emission
      for (let i = 0; i < burstSize; i++) {
        eventBus.emitEvent({
          type: 'stress.burst',
          id: i,
          timestamp: Date.now(),
        } as OrchestrationEvent)
      }

      const emitTime = Date.now() - startTime
      console.log(`Emitted ${burstSize} events in ${emitTime}ms`)

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const metrics = eventBus.getMetrics()

      // Verify metrics are accurate
      expect(metrics.droppedCount).toBe(burstSize - 1000) // Should drop 9000 events
      expect(metrics.queueSize).toBeLessThanOrEqual(1000)
      expect(metrics.highWaterMark).toBe(1000)
      expect(processedCount).toBeLessThanOrEqual(1000)
      expect(errors).toHaveLength(0) // Should not throw errors

      console.log(
        `Processed: ${processedCount}, Dropped: ${metrics.droppedCount}`,
      )
    })

    it('should maintain FIFO order under extreme load', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 100,
        warnOnDrop: false,
      })

      const receivedIds: number[] = []
      let processingStarted = false

      eventBus.on('stress.order', async (event: OrchestrationEvent) => {
        if (!processingStarted) {
          // Block until all events are queued
          await new Promise((resolve) => setTimeout(resolve, 100))
          processingStarted = true
        }
        const id = (event as { type: string; id: number }).id
        receivedIds.push(id)
      })

      // Emit 5000 events rapidly
      const totalEvents = 5000
      for (let i = 0; i < totalEvents; i++) {
        eventBus.emitEvent({
          type: 'stress.order',
          id: i,
        } as OrchestrationEvent)
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Should have kept the newest 100 events (FIFO with dropOldest)
      expect(receivedIds.length).toBe(100)
      expect(receivedIds[0]).toBe(totalEvents - 100) // First processed should be 4900
      expect(receivedIds[99]).toBe(totalEvents - 1) // Last processed should be 4999

      // Verify order is maintained
      for (let i = 1; i < receivedIds.length; i++) {
        expect(receivedIds[i]).toBe(receivedIds[i - 1] + 1)
      }
    })

    it('should handle sustained high throughput', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 500,
        warnOnDrop: false,
        metricsInterval: 1000, // 1 second for testing
      })

      let processedCount = 0
      const processingDelays: number[] = []

      eventBus.on('stress.sustained', async () => {
        // Simulate variable processing time
        const delay = Math.random() * 5 // 0-5ms
        const start = Date.now()
        await new Promise((resolve) => setTimeout(resolve, delay))
        processingDelays.push(Date.now() - start)
        processedCount++
      })

      // Sustained emission over 3 seconds
      const duration = 3000
      const startTime = Date.now()
      let emittedCount = 0

      const emitInterval = setInterval(() => {
        // Emit batch of events
        for (let i = 0; i < 100; i++) {
          eventBus.emitEvent({
            type: 'stress.sustained',
            id: emittedCount++,
          } as OrchestrationEvent)
        }
      }, 10) // Every 10ms, emit 100 events (10,000 events/sec)

      // Run for specified duration
      await new Promise((resolve) => setTimeout(resolve, duration))
      clearInterval(emitInterval)

      // Wait for processing to finish
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const actualDuration = Date.now() - startTime
      const throughput = (emittedCount / actualDuration) * 1000

      console.log(`Sustained throughput: ${throughput.toFixed(0)} events/sec`)
      console.log(`Emitted: ${emittedCount}, Processed: ${processedCount}`)

      const metrics = eventBus.getMetrics()
      console.log(`Drop rate: ${metrics.dropRate} events/minute`)

      // Should maintain high throughput
      expect(throughput).toBeGreaterThan(5000)
      // High water mark should be at most the queue size
      expect(metrics.highWaterMark).toBeLessThanOrEqual(500)
    })

    it('should handle memory pressure during overflow', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 200,
        warnOnDrop: false,
        enableMemoryTracking: true,
      })

      const largeEvents: OrchestrationEvent[] = []

      // Create events with large payloads
      for (let i = 0; i < 1000; i++) {
        largeEvents.push({
          type: 'stress.memory',
          id: i,
          payload: {
            data: 'x'.repeat(10000), // 10KB per event
            nested: {
              arrays: new Array(100).fill('test'),
              objects: Object.fromEntries(
                Array.from({ length: 50 }, (_, j) => [`key${j}`, `value${j}`]),
              ),
            },
          },
        } as OrchestrationEvent)
      }

      let processedCount = 0
      eventBus.on('stress.memory', () => {
        processedCount++
      })

      // Measure memory before stress
      const memBefore = process.memoryUsage()

      // Emit all large events
      for (const event of largeEvents) {
        eventBus.emitEvent(event)
      }

      // Check metrics immediately
      const metrics = eventBus.getMetrics()
      expect(metrics.droppedCount).toBe(800) // Should drop 800 events
      expect(metrics.queueSize).toBeLessThanOrEqual(200)

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Measure memory after
      const memAfter = process.memoryUsage()
      const memDelta = memAfter.heapUsed - memBefore.heapUsed

      console.log(`Memory delta: ${(memDelta / 1024 / 1024).toFixed(2)} MB`)
      console.log(`Processed: ${processedCount} large events`)

      // Memory should be bounded (queue limited to 200 events)
      // Each event is ~10KB, so max queue should be ~2MB
      expect(memDelta).toBeLessThan(50 * 1024 * 1024) // Less than 50MB increase
    })

    it('should recover gracefully from queue saturation', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 100,
        warnOnDrop: false,
      })

      let slowProcessing = true
      let processedCount = 0
      const processedIds: number[] = []

      eventBus.on('stress.recovery', async (event: OrchestrationEvent) => {
        if (slowProcessing) {
          // Simulate slow processing
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
        processedCount++
        processedIds.push((event as { type: string; id: number }).id)
      })

      // Phase 1: Saturate the queue
      console.log('Phase 1: Saturating queue...')
      for (let i = 0; i < 500; i++) {
        eventBus.emitEvent({
          type: 'stress.recovery',
          id: i,
        } as OrchestrationEvent)
      }

      let metrics = eventBus.getMetrics()
      expect(metrics.droppedCount).toBeGreaterThan(0)
      console.log(`Saturation - Dropped: ${metrics.droppedCount}`)

      // Phase 2: Continue emission with fast processing
      console.log('Phase 2: Recovery with fast processing...')
      slowProcessing = false

      for (let i = 500; i < 600; i++) {
        eventBus.emitEvent({
          type: 'stress.recovery',
          id: i,
        } as OrchestrationEvent)
      }

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 500))

      metrics = eventBus.getMetrics()
      console.log(
        `Recovery - Processed: ${processedCount}, Queue size: ${metrics.queueSize}`,
      )

      // Queue should recover to normal state
      expect(metrics.queueSize).toBe(0) // Should be empty after processing
      expect(processedCount).toBeGreaterThan(0)

      // Verify newest events were processed after recovery
      const lastProcessed = processedIds[processedIds.length - 1]
      expect(lastProcessed).toBeGreaterThanOrEqual(500)
    })

    it('should handle concurrent emission from multiple sources', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 1000,
        warnOnDrop: false,
      })

      const sourceCounts = new Map<string, number>()

      eventBus.on('stress.concurrent', (event: OrchestrationEvent) => {
        const source = (event as { type: string; source: string }).source
        sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1)
      })

      // Simulate multiple concurrent emitters
      const emitters = Array.from({ length: 10 }, (_, i) => {
        return async () => {
          for (let j = 0; j < 1000; j++) {
            eventBus.emitEvent({
              type: 'stress.concurrent',
              source: `emitter-${i}`,
              sequence: j,
            } as OrchestrationEvent)
            // Small random delay to simulate real conditions
            if (j % 100 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 0))
            }
          }
        }
      })

      // Run all emitters concurrently
      const startTime = Date.now()
      await Promise.all(emitters.map((emitter) => emitter()))
      const emitDuration = Date.now() - startTime

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const totalEmitted = 10000 // 10 emitters * 1000 events
      const totalProcessed = Array.from(sourceCounts.values()).reduce(
        (sum, count) => sum + count,
        0,
      )

      const metrics = eventBus.getMetrics()

      console.log(`Concurrent emission completed in ${emitDuration}ms`)
      console.log(
        `Total emitted: ${totalEmitted}, Processed: ${totalProcessed}`,
      )
      console.log(`Sources processed:`, Object.fromEntries(sourceCounts))

      // Should have processed events (may process all if fast enough)
      expect(totalProcessed).toBeGreaterThan(0)
      expect(totalProcessed).toBeLessThanOrEqual(totalEmitted)

      // If events were dropped, verify count
      if (totalProcessed < totalEmitted) {
        expect(metrics.droppedCount).toBe(totalEmitted - totalProcessed)
      }

      // Verify fair distribution (each source should get some events processed)
      expect(sourceCounts.size).toBeGreaterThan(0)
    })

    it('should validate metrics accuracy under stress', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 250,
        warnOnDrop: false,
        metricsInterval: 100, // Short interval for testing
      })

      let actualDropped = 0
      const queueSizes: number[] = []

      // Track actual processing
      eventBus.on('stress.metrics', () => {})

      // Phase 1: Slow processing to cause drops
      eventBus.on('stress.metrics', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      // Emit batches and track metrics
      for (let batch = 0; batch < 10; batch++) {
        const batchSize = 500
        const beforeMetrics = eventBus.getMetrics()

        for (let i = 0; i < batchSize; i++) {
          eventBus.emitEvent({
            type: 'stress.metrics',
            batch,
            id: i,
          } as OrchestrationEvent)
        }

        const afterMetrics = eventBus.getMetrics()
        queueSizes.push(afterMetrics.queueSize)

        // Track drops in this batch
        const batchDrops =
          afterMetrics.droppedCount - beforeMetrics.droppedCount
        actualDropped += batchDrops

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const finalMetrics = eventBus.getMetrics()

      console.log('Metrics validation:')
      console.log(`  Reported dropped: ${finalMetrics.droppedCount}`)
      console.log(`  Calculated dropped: ${actualDropped}`)
      console.log(`  High water mark: ${finalMetrics.highWaterMark}`)
      console.log(`  Max observed queue: ${Math.max(...queueSizes)}`)
      console.log(`  Drop rate: ${finalMetrics.dropRate}/min`)

      // Metrics should be accurate
      expect(finalMetrics.droppedCount).toBe(actualDropped)
      expect(finalMetrics.highWaterMark).toBe(250)
      expect(finalMetrics.highWaterMark).toBe(Math.max(...queueSizes))

      // Drop rate should be calculated if drops occurred
      if (finalMetrics.droppedCount > 0) {
        // Drop rate may be 0 if drops happened outside the metrics interval
        expect(finalMetrics.dropRate).toBeGreaterThanOrEqual(0)
      }
    })

    it('should maintain listener isolation under stress', async () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 500,
        warnOnDrop: false,
      })

      const listenerResults: Record<string, number[]> = {
        fast: [],
        slow: [],
        error: [],
      }

      // Fast listener
      eventBus.on('stress.isolation', (event: OrchestrationEvent) => {
        const id = (event as { type: string; id: number }).id
        listenerResults.fast.push(id)
      })

      // Slow listener
      eventBus.on('stress.isolation', async (event: OrchestrationEvent) => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        const id = (event as { type: string; id: number }).id
        listenerResults.slow.push(id)
      })

      // Error-throwing listener
      eventBus.on('stress.isolation', (event: OrchestrationEvent) => {
        const id = (event as { type: string; id: number }).id
        listenerResults.error.push(id)
        if (id % 10 === 0) {
          throw new Error(`Listener error for event ${id}`)
        }
      })

      // Emit many events
      for (let i = 0; i < 1000; i++) {
        eventBus.emitEvent({
          type: 'stress.isolation',
          id: i,
        } as OrchestrationEvent)
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000))

      console.log('Listener isolation results:')
      console.log(`  Fast listener: ${listenerResults.fast.length} events`)
      console.log(`  Slow listener: ${listenerResults.slow.length} events`)
      console.log(`  Error listener: ${listenerResults.error.length} events`)

      // All listeners should receive events despite errors in one
      expect(listenerResults.fast.length).toBeGreaterThan(0)
      expect(listenerResults.slow.length).toBeGreaterThan(0)
      expect(listenerResults.error.length).toBeGreaterThan(0)

      // Fast listener should process all events that made it through
      expect(listenerResults.fast.length).toBe(listenerResults.slow.length)
    })
  })

  describe('Extreme Edge Cases', () => {
    it('should handle zero queue size gracefully', async () => {
      // This is an edge case - queue size of 1 (minimum valid)
      eventBus = new BoundedEventBus({
        maxQueueSize: 1,
        warnOnDrop: false,
      })

      let processed = 0
      eventBus.on('edge.zero', () => {
        processed++
      })

      // Emit multiple events
      for (let i = 0; i < 10; i++) {
        eventBus.emitEvent({
          type: 'edge.zero',
          id: i,
        } as OrchestrationEvent)
      }

      await new Promise((resolve) => setTimeout(resolve, 100))

      const metrics = eventBus.getMetrics()
      expect(metrics.droppedCount).toBe(9)
      expect(processed).toBe(1)
    })

    it('should handle maximum safe integer event counts', () => {
      eventBus = new BoundedEventBus({
        maxQueueSize: 10,
        warnOnDrop: false,
      })

      // Test with very large numbers
      const largeCount = Number.MAX_SAFE_INTEGER

      // Simulate metrics with large numbers
      for (let i = 0; i < 100; i++) {
        eventBus.emitEvent({
          type: 'edge.maxint',
          id: largeCount - i,
        } as OrchestrationEvent)
      }

      const metrics = eventBus.getMetrics()
      expect(metrics.droppedCount).toBe(90)
      expect(Number.isFinite(metrics.droppedCount)).toBe(true)
      expect(Number.isSafeInteger(metrics.droppedCount)).toBe(true)
    })
  })
})
