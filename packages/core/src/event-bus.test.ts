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

      eventBus.on('test.event' as OrchestrationEvent['type'], () => results.push(1))
      eventBus.on('test.event' as OrchestrationEvent['type'], () => {
        throw new Error('Error in listener 2')
      })
      eventBus.on('test.event' as OrchestrationEvent['type'], () => results.push(3))

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

      eventBus.on('test.event' as OrchestrationEvent['type'], (event: OrchestrationEvent) => {
        receivedEvents.push((event as any).id)
      })

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
})
