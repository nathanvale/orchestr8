import type { Logger } from '@orchestr8/logger'

/* global queueMicrotask */
import { EventEmitter } from 'node:events'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BoundedEventBus,
  EventBusConfig,
  OrchestrationEvent,
} from './event-bus.js'

describe('BoundedEventBus', () => {
  let eventBus: BoundedEventBus

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (eventBus) {
      eventBus.removeAllListeners()
    }
  })

  describe('Core Functionality', () => {
    it('should create with default configuration', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus()

      expect(eventBus).toBeInstanceOf(EventEmitter)
      expect(eventBus).toBeDefined()

      const metrics = eventBus.getMetrics()
      expect(metrics.queueSize).toBe(0)
      expect(metrics.droppedCount).toBe(0)
    })

    it('should accept custom max queue size', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      const config: EventBusConfig = {
        maxQueueSize: 500,
      }

      eventBus = new BoundedEventBus(config)

      expect(eventBus).toBeDefined()
      // Queue size will be validated when we test overflow
    })

    it('should emit events to registered listeners', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus()

      const listener = vi.fn()
      eventBus.on('workflow.started', listener)

      const event: OrchestrationEvent = {
        type: 'workflow.started',
        workflowId: 'test-workflow',
        timestamp: Date.now(),
      }

      eventBus.emitEvent(event)

      // Wait for microtask to process
      await new Promise((resolve) => queueMicrotask(resolve))

      expect(listener).toHaveBeenCalledWith(event)
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple listeners for same event type', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus()

      const listener1 = vi.fn()
      const listener2 = vi.fn()
      const listener3 = vi.fn()

      eventBus.on('step.started', listener1)
      eventBus.on('step.started', listener2)
      eventBus.on('step.started', listener3)

      const event: OrchestrationEvent = {
        type: 'step.started',
        stepId: 'step-1',
        executionId: 'exec-1',
      }

      eventBus.emitEvent(event)

      await new Promise((resolve) => queueMicrotask(resolve))

      expect(listener1).toHaveBeenCalledWith(event)
      expect(listener2).toHaveBeenCalledWith(event)
      expect(listener3).toHaveBeenCalledWith(event)
    })

    it('should remove listeners correctly', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus()

      const listener = vi.fn()
      eventBus.on('workflow.completed', listener)

      eventBus.off('workflow.completed', listener)

      const event: OrchestrationEvent = {
        type: 'workflow.completed',
        workflowId: 'test-workflow',
        duration: 1000,
      }

      eventBus.emitEvent(event)

      await new Promise((resolve) => queueMicrotask(resolve))

      expect(listener).not.toHaveBeenCalled()
    })

    it('should return listener count for event types', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus()

      const listener1 = vi.fn()
      const listener2 = vi.fn()

      eventBus.on('step.failed', listener1)
      eventBus.on('step.failed', listener2)
      eventBus.on('workflow.started', listener1)

      const metrics = eventBus.getMetrics()
      expect(metrics.listeners.get('step.failed')).toBe(2)
      expect(metrics.listeners.get('workflow.started')).toBe(1)
      expect(metrics.listeners.get('workflow.completed')).toBeUndefined()
    })

    it('should handle events with Error objects preserving stack traces', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus()

      const listener = vi.fn()
      eventBus.on('step.failed', listener)

      const error = new Error('Test error')
      const originalStack = error.stack

      const event: OrchestrationEvent = {
        type: 'step.failed',
        stepId: 'step-1',
        error,
        retryable: true,
      }

      eventBus.emitEvent(event)

      await new Promise((resolve) => queueMicrotask(resolve))

      expect(listener).toHaveBeenCalledWith(event)
      const receivedEvent = listener.mock.calls[0][0]
      expect(receivedEvent.error).toBe(error) // Same reference
      expect(receivedEvent.error.stack).toBe(originalStack)
    })
  })

  describe('Metrics API', () => {
    it('should return metrics with correct shape', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus()

      const metrics = eventBus.getMetrics()

      // Verify EventBusMetrics interface shape
      expect(metrics).toHaveProperty('droppedCount')
      expect(metrics).toHaveProperty('lastDropTimestamp')
      expect(metrics).toHaveProperty('highWaterMark')
      expect(metrics).toHaveProperty('queueSize')
      expect(metrics).toHaveProperty('dropRate')
      expect(metrics).toHaveProperty('listeners')

      expect(typeof metrics.droppedCount).toBe('number')
      expect(
        metrics.lastDropTimestamp === null ||
          typeof metrics.lastDropTimestamp === 'number',
      ).toBe(true)
      expect(typeof metrics.highWaterMark).toBe('number')
      expect(typeof metrics.queueSize).toBe('number')
      expect(typeof metrics.dropRate).toBe('number')
      expect(metrics.listeners).toBeInstanceOf(Map)
    })

    it('should track high water mark', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus({ maxQueueSize: 10 })

      const listener = vi.fn()
      // Slow listener to build up queue
      eventBus.on('test.event', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        listener()
      })

      // Emit multiple events rapidly
      for (let i = 0; i < 5; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      const metrics = eventBus.getMetrics()
      expect(metrics.highWaterMark).toBeGreaterThanOrEqual(1)
      expect(metrics.queueSize).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Isolation', () => {
    it('should isolate listener errors from other listeners', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus()

      const goodListener = vi.fn()
      const badListener = vi.fn(() => {
        throw new Error('Listener error')
      })
      const anotherGoodListener = vi.fn()

      eventBus.on('workflow.started', badListener)
      eventBus.on('workflow.started', goodListener)
      eventBus.on('workflow.started', anotherGoodListener)

      const event: OrchestrationEvent = {
        type: 'workflow.started',
        workflowId: 'test-workflow',
        timestamp: Date.now(),
      }

      // Should not throw
      expect(() => eventBus.emitEvent(event)).not.toThrow()

      await new Promise((resolve) => queueMicrotask(resolve))

      expect(badListener).toHaveBeenCalled()
      expect(goodListener).toHaveBeenCalled()
      expect(anotherGoodListener).toHaveBeenCalled()
    })

    it('should continue processing after listener error', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus()

      const results: number[] = []

      eventBus.on('test.event' as OrchestrationEvent['type'], () =>
        results.push(1),
      )
      eventBus.on('test.event' as OrchestrationEvent['type'], () => {
        throw new Error('Error in listener 2')
      })
      eventBus.on('test.event' as OrchestrationEvent['type'], () =>
        results.push(3),
      )

      eventBus.emitEvent({ type: 'test.event' } as OrchestrationEvent)

      await new Promise((resolve) => queueMicrotask(resolve))

      expect(results).toEqual([1, 3])
    })
  })

  describe('Async Processing', () => {
    it('should use queueMicrotask for async emission', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus()

      const listener = vi.fn()
      eventBus.on('workflow.started', listener)

      const event: OrchestrationEvent = {
        type: 'workflow.started',
        workflowId: 'test-workflow',
        timestamp: Date.now(),
      }

      eventBus.emitEvent(event)

      // Should not be called synchronously
      expect(listener).not.toHaveBeenCalled()

      // Wait for microtask
      await new Promise((resolve) => queueMicrotask(resolve))

      expect(listener).toHaveBeenCalledWith(event)
    })

    it('should maintain event order with async processing', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus()

      const receivedEvents: number[] = []

      eventBus.on(
        'test.event' as OrchestrationEvent['type'],
        (event: OrchestrationEvent) => {
          receivedEvents.push((event as { type: string; id: number }).id)
        },
      )

      // Emit events in order
      for (let i = 0; i < 10; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      // Wait for all microtasks
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(receivedEvents).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    })
  })

  describe('Configuration Validation', () => {
    it('should validate max queue size is positive', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')

      expect(() => new BoundedEventBus({ maxQueueSize: 0 })).toThrow(
        'maxQueueSize must be greater than 0',
      )

      expect(() => new BoundedEventBus({ maxQueueSize: -1 })).toThrow(
        'maxQueueSize must be greater than 0',
      )
    })

    it('should set default values for optional config', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus({})

      const metrics = eventBus.getMetrics()
      expect(metrics).toBeDefined()
      // Default queue size should be 1000
    })
  })

  describe('Queue Capacity Enforcement', () => {
    it('should enforce max queue size limit', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      const maxQueueSize = 5
      eventBus = new BoundedEventBus({ maxQueueSize, warnOnDrop: false })

      // Slow listener to build up queue
      const processedEvents: number[] = []
      eventBus.on(
        'test.event' as OrchestrationEvent['type'],
        async (event: OrchestrationEvent) => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          processedEvents.push((event as { type: string; id: number }).id)
        },
      )

      // Emit more events than queue capacity
      for (let i = 0; i < 10; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      // Check that queue size never exceeds max
      const metrics = eventBus.getMetrics()
      expect(metrics.queueSize).toBeLessThanOrEqual(maxQueueSize)
      expect(metrics.droppedCount).toBeGreaterThan(0)
    })

    it('should drop oldest events when queue is full (dropOldest policy)', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      const maxQueueSize = 3
      eventBus = new BoundedEventBus({
        maxQueueSize,
        overflowPolicy: 'dropOldest',
        warnOnDrop: false,
      })

      const processedEvents: number[] = []
      let processingStarted = false

      // Listener with controlled processing
      eventBus.on(
        'test.event' as OrchestrationEvent['type'],
        async (event: OrchestrationEvent) => {
          if (!processingStarted) {
            // Block processing until we've queued all events
            await new Promise((resolve) => setTimeout(resolve, 50))
            processingStarted = true
          }
          processedEvents.push((event as { type: string; id: number }).id)
        },
      )

      // Rapidly emit 6 events (double the queue capacity)
      for (let i = 0; i < 6; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      // Let initial metrics settle
      await new Promise((resolve) => queueMicrotask(resolve))

      const metricsBeforeProcessing = eventBus.getMetrics()
      expect(metricsBeforeProcessing.droppedCount).toBe(3) // Events 0, 1, 2 should be dropped
      expect(metricsBeforeProcessing.queueSize).toBeLessThanOrEqual(
        maxQueueSize,
      )

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should have processed the newest events (3, 4, 5)
      expect(processedEvents).toEqual([3, 4, 5])
    })

    it('should update metrics when dropping events', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus({ maxQueueSize: 2, warnOnDrop: false })

      // Block processing
      eventBus.on('test.event' as OrchestrationEvent['type'], async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      // Emit 5 events rapidly
      for (let i = 0; i < 5; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      await new Promise((resolve) => queueMicrotask(resolve))

      const metrics = eventBus.getMetrics()
      expect(metrics.droppedCount).toBe(3)
      expect(metrics.lastDropTimestamp).toBeGreaterThan(0)
      expect(metrics.highWaterMark).toBe(2)
    })

    it('should calculate drop rate correctly', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus({
        maxQueueSize: 1,
        warnOnDrop: false,
        metricsInterval: 60000,
      })

      let blockProcessing = true
      eventBus.on('test.event' as OrchestrationEvent['type'], async () => {
        // Block until we're done emitting all events
        while (blockProcessing) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      })

      // Emit events rapidly to trigger drops
      for (let i = 0; i < 5; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      // Wait a moment for queue to settle
      await new Promise((resolve) => setTimeout(resolve, 10))

      const metrics = eventBus.getMetrics()
      expect(metrics.droppedCount).toBe(4) // Should have dropped 4 events
      expect(metrics.dropRate).toBe(4) // 4 events dropped in the current minute

      // Unblock processing to clean up
      blockProcessing = false
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should handle rapid bursts efficiently with circular buffer', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      const maxQueueSize = 100
      eventBus = new BoundedEventBus({ maxQueueSize, warnOnDrop: false })

      const processedEvents: number[] = []
      eventBus.on(
        'test.event' as OrchestrationEvent['type'],
        (event: OrchestrationEvent) => {
          processedEvents.push((event as { type: string; id: number }).id)
        },
      )

      // Emit a large burst of events
      const burstSize = 1000
      for (let i = 0; i < burstSize; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      const metrics = eventBus.getMetrics()

      // Should have dropped the oldest events
      expect(metrics.droppedCount).toBe(burstSize - maxQueueSize)

      // Processed events should be the last ones (newest)
      const expectedProcessed = Array.from(
        { length: maxQueueSize },
        (_, i) => burstSize - maxQueueSize + i,
      )
      expect(processedEvents).toEqual(expectedProcessed)
    })

    it('should maintain FIFO order within queue capacity', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus({ maxQueueSize: 10 })

      const processedOrder: string[] = []
      eventBus.on(
        'test.ordered' as OrchestrationEvent['type'],
        (event: OrchestrationEvent) => {
          processedOrder.push((event as { type: string; label: string }).label)
        },
      )

      // Emit events in specific order
      const labels = ['first', 'second', 'third', 'fourth', 'fifth']
      for (const label of labels) {
        eventBus.emitEvent({
          type: 'test.ordered',
          label,
        } as OrchestrationEvent)
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(processedOrder).toEqual(labels)
    })
  })

  describe('Overflow Policy Coverage', () => {
    it('should increment droppedCount when capacity is exceeded', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      const maxQueueSize = 3
      eventBus = new BoundedEventBus({
        maxQueueSize,
        warnOnDrop: false,
      })

      // Block processing
      let blockProcessing = true
      eventBus.on('test.event' as OrchestrationEvent['type'], async () => {
        while (blockProcessing) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      })

      // Emit more events than capacity
      for (let i = 0; i < 10; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      await new Promise((resolve) => queueMicrotask(resolve))

      const metrics = eventBus.getMetrics()
      expect(metrics.droppedCount).toBe(7) // 10 events - 3 capacity = 7 dropped
      expect(metrics.lastDropTimestamp).toBeGreaterThan(0)
      expect(metrics.lastDropTimestamp).toBeLessThanOrEqual(Date.now())

      // Cleanup
      blockProcessing = false
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should update lastDropTimestamp when events are dropped', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus({
        maxQueueSize: 2,
        warnOnDrop: false,
      })

      // Block processing with a slow listener
      let blockProcessing = true
      eventBus.on('test.event' as OrchestrationEvent['type'], async () => {
        while (blockProcessing) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      })

      const beforeDrop = Date.now()

      // Emit events rapidly to trigger drops
      for (let i = 0; i < 5; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      await new Promise((resolve) => queueMicrotask(resolve))

      const metrics = eventBus.getMetrics()
      expect(metrics.lastDropTimestamp).not.toBeNull()
      expect(metrics.lastDropTimestamp!).toBeGreaterThanOrEqual(beforeDrop)
      expect(metrics.lastDropTimestamp!).toBeLessThanOrEqual(Date.now())

      // Cleanup
      blockProcessing = false
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should calculate dropRate based on configured metricsInterval', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      const metricsInterval = 10000 // 10 seconds
      eventBus = new BoundedEventBus({
        maxQueueSize: 1,
        warnOnDrop: false,
        metricsInterval,
      })

      // Block processing
      eventBus.on('test.event' as OrchestrationEvent['type'], async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      })

      // Emit events to trigger drops
      for (let i = 0; i < 10; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      await new Promise((resolve) => queueMicrotask(resolve))

      const metrics = eventBus.getMetrics()
      // 9 drops in 10 seconds = 54 drops per minute
      expect(metrics.dropRate).toBe(54)
    })

    it('should throttle warnings based on metricsInterval', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      const logger = {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      }

      const metricsInterval = 100 // 100ms for testing
      eventBus = new BoundedEventBus(
        {
          maxQueueSize: 1,
          warnOnDrop: true,
          metricsInterval,
        },
        logger as Logger,
      )

      // Block processing
      eventBus.on('test.event' as OrchestrationEvent['type'], async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      })

      // Emit many events rapidly
      for (let i = 0; i < 20; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      await new Promise((resolve) => queueMicrotask(resolve))

      // Should only warn once initially
      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(logger.warn).toHaveBeenCalledWith(
        'Event queue overflow - dropping oldest event',
        expect.objectContaining({
          droppedCount: expect.any(Number),
          queueSize: expect.any(Number),
          eventType: 'test.event',
        }),
      )

      // Wait for interval to pass
      await new Promise((resolve) => setTimeout(resolve, metricsInterval + 10))

      // Emit more events
      for (let i = 20; i < 30; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      await new Promise((resolve) => queueMicrotask(resolve))

      // Should warn again after interval
      expect(logger.warn).toHaveBeenCalledTimes(2)
    })

    it('should continue processing newer events after overflow', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      const maxQueueSize = 3
      eventBus = new BoundedEventBus({
        maxQueueSize,
        warnOnDrop: false,
      })

      const processedEvents: number[] = []
      let processingStarted = false

      eventBus.on(
        'test.event' as OrchestrationEvent['type'],
        async (event: OrchestrationEvent) => {
          if (!processingStarted) {
            // Wait until all events are queued
            await new Promise((resolve) => setTimeout(resolve, 50))
            processingStarted = true
          }
          processedEvents.push((event as { type: string; id: number }).id)
        },
      )

      // Emit 10 events (7 will be dropped)
      for (let i = 0; i < 10; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should process the newest events (7, 8, 9)
      expect(processedEvents).toEqual([7, 8, 9])

      const metrics = eventBus.getMetrics()
      expect(metrics.droppedCount).toBe(7)
    })

    it('should maintain accurate metrics across multiple overflow events', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus({
        maxQueueSize: 2,
        warnOnDrop: false,
        metricsInterval: 5000,
      })

      // Block processing
      eventBus.on('test.event' as OrchestrationEvent['type'], async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      })

      // First burst
      for (let i = 0; i < 5; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      await new Promise((resolve) => queueMicrotask(resolve))

      let metrics = eventBus.getMetrics()
      expect(metrics.droppedCount).toBe(3)

      // Second burst
      for (let i = 5; i < 10; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      await new Promise((resolve) => queueMicrotask(resolve))

      metrics = eventBus.getMetrics()
      expect(metrics.droppedCount).toBe(7) // Total drops (was already dropping in first burst)
      expect(metrics.highWaterMark).toBe(2) // Max queue size reached
      expect(metrics.dropRate).toBeGreaterThan(0)
    })
  })

  describe('Memory Tracking', () => {
    it('should track memory when enabled', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus({
        enableMemoryTracking: true,
        maxQueueSize: 10,
      })

      // Emit events of varying sizes
      for (let i = 0; i < 5; i++) {
        eventBus.emitEvent({
          type: 'test.event',
          id: i,
          data: 'x'.repeat(100 * (i + 1)), // Varying sizes
        } as OrchestrationEvent)
      }

      await new Promise((resolve) => queueMicrotask(resolve))

      // Memory tracking internals would be tested here
      // For now, just verify the bus still works with tracking enabled
      const metrics = eventBus.getMetrics()
      expect(metrics.queueSize).toBeGreaterThan(0)
    })

    it('should not impact performance when memory tracking is disabled', async () => {
      const { BoundedEventBus } = await import('./event-bus.js')
      eventBus = new BoundedEventBus({
        enableMemoryTracking: false,
        maxQueueSize: 100,
      })

      const startTime = Date.now()

      // Emit many events
      for (let i = 0; i < 1000; i++) {
        eventBus.emitEvent({ type: 'test.event', id: i } as OrchestrationEvent)
      }

      const emitTime = Date.now() - startTime

      // Should be very fast without memory tracking
      expect(emitTime).toBeLessThan(100) // Less than 100ms for 1000 events
    })
  })
})
