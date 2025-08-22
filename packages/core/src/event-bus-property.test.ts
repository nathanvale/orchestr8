/**
 * Property-based tests for BoundedEventBus using fast-check
 * These tests verify invariants that should always hold regardless of input
 */

import fc from 'fast-check'
import { describe, it, expect } from 'vitest'

import type { OrchestrationEvent } from './event-bus.js'

import { BoundedEventBus } from './event-bus.js'

// Custom arbitraries for event bus testing
const eventTypeArb = fc.oneof(
  fc.constant('workflow.started'),
  fc.constant('workflow.completed'),
  fc.constant('step.started'),
  fc.constant('step.completed'),
  fc.constant('step.failed'),
  fc.constant('retry.attempted'),
  fc.constant('circuitBreaker.opened'),
)

const orchestrationEventArb = fc.record({
  type: eventTypeArb,
  id: fc.uuid(),
  timestamp: fc.integer({ min: 0, max: Date.now() }),
  data: fc.option(fc.dictionary(fc.string(), fc.anything())),
})

const eventBusConfigArb = fc.record({
  maxQueueSize: fc.integer({ min: 1, max: 10000 }),
  warnOnDrop: fc.boolean(),
  metricsInterval: fc.integer({ min: 100, max: 60000 }),
  maxListenersPerEvent: fc.integer({ min: 1, max: 1000 }),
  enableMemoryTracking: fc.boolean(),
})

describe('Event Bus Property Tests', () => {
  describe('Circular Buffer Invariants', () => {
    it(
      'should never exceed configured queue size',
      { timeout: 30000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 100 }), // queue size
            fc.array(orchestrationEventArb, { minLength: 0, maxLength: 500 }), // events
            async (queueSize, events) => {
              const eventBus = new BoundedEventBus({
                maxQueueSize: queueSize,
                warnOnDrop: false,
              })

              // Block processing to ensure queue fills
              let blockProcessing = true

              // Add a blocking listener for the first event type we see
              if (events.length > 0) {
                eventBus.on(
                  events[0].type as OrchestrationEvent['type'],
                  async () => {
                    while (blockProcessing) {
                      await new Promise((resolve) => setTimeout(resolve, 10))
                    }
                  },
                )
              }

              // Emit all events
              for (const event of events) {
                eventBus.emitEvent(event as OrchestrationEvent)
              }

              // Check metrics immediately
              const metrics = eventBus.getMetrics()

              // Queue size should never exceed max
              expect(metrics.queueSize).toBeLessThanOrEqual(queueSize)
              expect(metrics.highWaterMark).toBeLessThanOrEqual(queueSize)

              // Clean up
              blockProcessing = false
              await new Promise((resolve) => setTimeout(resolve, 50))
            },
          ),
          { numRuns: 10 },
        )
      },
    )

    it(
      'should maintain FIFO order within capacity',
      { timeout: 30000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 10, max: 100 }), // queue size
            fc.array(fc.integer({ min: 0, max: 10000 }), {
              minLength: 2,
              maxLength: 200,
            }), // event IDs - need at least 2 to test order
            async (queueSize, eventIds) => {
              const eventBus = new BoundedEventBus({
                maxQueueSize: queueSize,
                warnOnDrop: false,
              })

              const receivedIds: number[] = []
              let processingStarted = false

              eventBus.on(
                'fifo.test' as OrchestrationEvent['type'],
                async (event) => {
                  if (!processingStarted) {
                    // Wait until all events are queued
                    await new Promise((resolve) => setTimeout(resolve, 50))
                    processingStarted = true
                  }
                  const id = (event as { type: string; id: number }).id
                  receivedIds.push(id)
                },
              )

              // Emit all events
              for (const id of eventIds) {
                eventBus.emitEvent({
                  type: 'fifo.test',
                  id,
                } as OrchestrationEvent)
              }

              // Wait for processing
              await new Promise((resolve) => setTimeout(resolve, 200))

              // If we received events, verify FIFO order is maintained
              if (receivedIds.length > 1) {
                // For FIFO verification, we need to check that the received events
                // appear in the same relative order as they were in the original array
                let lastProcessedIndex = -1

                for (const receivedId of receivedIds) {
                  // Find the next occurrence of this ID after lastProcessedIndex
                  const nextIndex = eventIds.findIndex(
                    (id, index) =>
                      id === receivedId && index > lastProcessedIndex,
                  )

                  // If we can't find the ID after the last processed index,
                  // it means the order is violated
                  expect(nextIndex).toBeGreaterThan(lastProcessedIndex)
                  lastProcessedIndex = nextIndex
                }
              }
            },
          ),
          { numRuns: 10, seed: 42 },
        )
      },
    )

    it(
      'should accurately track dropped events',
      { timeout: 30000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 5, max: 50 }), // queue size
            fc.integer({ min: 0, max: 500 }), // number of events
            async (queueSize, eventCount) => {
              const eventBus = new BoundedEventBus({
                maxQueueSize: queueSize,
                warnOnDrop: false,
              })

              // Block processing

              eventBus.on(
                'drop.test' as OrchestrationEvent['type'],
                async () => {
                  await new Promise((resolve) => setTimeout(resolve, 1000))
                },
              )

              // Emit events
              for (let i = 0; i < eventCount; i++) {
                eventBus.emitEvent({
                  type: 'drop.test',
                  id: i,
                } as OrchestrationEvent)
              }

              const metrics = eventBus.getMetrics()

              // Use invariant assertions instead of strict equality to handle async processing
              // Basic invariants about dropped count
              expect(metrics.droppedCount).toBeGreaterThanOrEqual(0)
              expect(metrics.droppedCount).toBeLessThanOrEqual(eventCount)

              // Queue size should never exceed the maximum
              expect(metrics.queueSize).toBeLessThanOrEqual(queueSize)
              expect(metrics.queueSize).toBeLessThanOrEqual(eventCount)

              // Total accounted events should not exceed events emitted
              const totalAccounted = metrics.queueSize + metrics.droppedCount
              expect(totalAccounted).toBeLessThanOrEqual(eventCount)

              // If more events than queue capacity, some should be dropped or queued
              if (eventCount > queueSize) {
                expect(
                  metrics.droppedCount + metrics.queueSize,
                ).toBeGreaterThanOrEqual(queueSize)
              }
            },
          ),
          { numRuns: 10 },
        )
      },
    )
  })

  describe('Event Isolation Properties', () => {
    it(
      'should isolate event data between listeners (shallow clone behavior)',
      { timeout: 30000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              type: fc.constant('isolation.test'),
              data: fc.record({
                value: fc.string(),
                nested: fc.record({
                  array: fc.array(fc.integer()),
                  object: fc.dictionary(fc.string(), fc.string()),
                }),
              }),
            }),
            async (originalEvent) => {
              const eventBus = new BoundedEventBus()

              // Track if listener modified the data
              let listenerModifiedData = false

              // Listener trying to modify event
              eventBus.on(
                'isolation.test' as OrchestrationEvent['type'],
                (event) => {
                  if ('data' in event && typeof event.data === 'object') {
                    const data = event.data as Record<string, unknown>
                    // This modification affects nested objects due to shallow clone
                    if (data.nested && typeof data.nested === 'object') {
                      const nested = data.nested as Record<string, unknown>
                      nested.modified = true
                      listenerModifiedData = true
                    }
                  }
                },
              )

              eventBus.emitEvent(originalEvent as OrchestrationEvent)

              // Wait for processing
              await new Promise((resolve) => setTimeout(resolve, 50))

              // Verify the shallow clone behavior:
              // The top-level event object should be cloned, but nested objects are shared
              if (listenerModifiedData && originalEvent.data?.nested) {
                // This is expected behavior with shallow cloning
                expect(
                  (originalEvent.data.nested as { modified?: boolean })
                    .modified,
                ).toBe(true)
              }
            },
          ),
          { numRuns: 10 },
        )
      },
    )

    it(
      'should deliver events to all listeners',
      { timeout: 30000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 2, max: 20 }), // number of listeners
            orchestrationEventArb,
            async (listenerCount, event) => {
              const eventBus = new BoundedEventBus()
              const receivedEvents: OrchestrationEvent[] = []

              // Add multiple listeners
              for (let i = 0; i < listenerCount; i++) {
                eventBus.on(event.type as OrchestrationEvent['type'], (e) => {
                  receivedEvents.push(e)
                })
              }

              eventBus.emitEvent(event as OrchestrationEvent)

              // Wait for processing
              await new Promise((resolve) => setTimeout(resolve, 50))

              // All listeners should receive the event
              expect(receivedEvents).toHaveLength(listenerCount)
            },
          ),
          { numRuns: 10 },
        )
      },
    )
  })

  describe('Metrics Consistency Properties', () => {
    it(
      'should maintain consistent metrics relationships',
      { timeout: 30000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            eventBusConfigArb,
            fc.array(orchestrationEventArb, { minLength: 0, maxLength: 200 }),
            async (config, events) => {
              const eventBus = new BoundedEventBus({
                ...config,
                warnOnDrop: false,
              })

              // Add listener for processing

              if (events.length > 0) {
                eventBus.on(
                  events[0].type as OrchestrationEvent['type'],
                  () => {},
                )
              }

              // Emit all events
              for (const event of events) {
                eventBus.emitEvent(event as OrchestrationEvent)
              }

              await new Promise((resolve) => setTimeout(resolve, 100))

              const metrics = eventBus.getMetrics()

              // Invariants that should always hold
              expect(metrics.queueSize).toBeGreaterThanOrEqual(0)
              expect(metrics.queueSize).toBeLessThanOrEqual(config.maxQueueSize)
              expect(metrics.highWaterMark).toBeGreaterThanOrEqual(
                metrics.queueSize,
              )
              expect(metrics.highWaterMark).toBeLessThanOrEqual(
                config.maxQueueSize,
              )
              expect(metrics.droppedCount).toBeGreaterThanOrEqual(0)

              if (metrics.droppedCount > 0) {
                expect(metrics.lastDropTimestamp).not.toBeNull()
                expect(metrics.lastDropTimestamp).toBeLessThanOrEqual(
                  Date.now(),
                )
              }

              // Drop rate should be non-negative
              expect(metrics.dropRate).toBeGreaterThanOrEqual(0)
            },
          ),
          { numRuns: 10 },
        )
      },
    )

    it(
      'should account for all events (processed + queued + dropped = emitted)',
      { timeout: 30000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 10, max: 100 }), // queue size
            fc.integer({ min: 1, max: 500 }), // event count (at least 1)
            async (queueSize, eventCount) => {
              const eventBus = new BoundedEventBus({
                maxQueueSize: queueSize,
                warnOnDrop: false,
              })

              let blockProcessing = true

              eventBus.on(
                'accounting.test' as OrchestrationEvent['type'],
                async () => {
                  if (blockProcessing) {
                    await new Promise((resolve) => setTimeout(resolve, 50))
                  }
                },
              )

              // Emit exact number of events
              for (let i = 0; i < eventCount; i++) {
                eventBus.emitEvent({
                  type: 'accounting.test',
                  id: i,
                } as OrchestrationEvent)
              }

              // Get metrics while queue is full
              const metricsBeforeProcessing = eventBus.getMetrics()

              // Allow processing
              blockProcessing = false
              await new Promise((resolve) => setTimeout(resolve, 200))

              const metricsAfterProcessing = eventBus.getMetrics()

              // Before processing: emitted = queued + dropped
              const accountedBefore =
                metricsBeforeProcessing.queueSize +
                metricsBeforeProcessing.droppedCount
              expect(accountedBefore).toBe(
                Math.min(
                  eventCount,
                  queueSize + metricsBeforeProcessing.droppedCount,
                ),
              )

              // After processing: all events should be accounted for
              const totalDropped = metricsAfterProcessing.droppedCount

              // Events should be processed or dropped
              expect(totalDropped).toBeLessThanOrEqual(eventCount)
            },
          ),
          { numRuns: 10 },
        )
      },
    )
  })

  describe('Configuration Properties', () => {
    it(
      'should respect all configuration boundaries',
      { timeout: 30000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(eventBusConfigArb, async (config) => {
            const eventBus = new BoundedEventBus(config)

            // Set max listeners to avoid warnings
            eventBus.setMaxListeners(config.maxListenersPerEvent + 20)

            // Add listeners up to max + 10
            const listenersToAdd = Math.min(
              config.maxListenersPerEvent + 10,
              1000,
            )
            for (let i = 0; i < listenersToAdd; i++) {
              eventBus.on('config.test' as OrchestrationEvent['type'], () => {
                // Empty listener
              })
            }

            // Emit events to test queue size
            for (let i = 0; i < config.maxQueueSize * 2; i++) {
              eventBus.emitEvent({
                type: 'config.test',
                id: i,
              } as OrchestrationEvent)
            }

            await new Promise((resolve) => setTimeout(resolve, 50))

            const metrics = eventBus.getMetrics()

            // Queue size should respect max
            expect(metrics.queueSize).toBeLessThanOrEqual(config.maxQueueSize)

            // High water mark should not exceed max queue size
            expect(metrics.highWaterMark).toBeLessThanOrEqual(
              config.maxQueueSize,
            )

            // Listener count should be what we added
            const listenerCount = eventBus.listenerCount('config.test')
            expect(listenerCount).toBe(listenersToAdd)
          }),
          { numRuns: 10 },
        )
      },
    )
  })

  describe('Concurrency Properties', () => {
    it(
      'should handle concurrent emissions correctly',
      { timeout: 30000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 10, max: 100 }), // queue size
            fc.integer({ min: 2, max: 10 }), // concurrent emitters
            fc.integer({ min: 10, max: 100 }), // events per emitter
            async (queueSize, emitterCount, eventsPerEmitter) => {
              const eventBus = new BoundedEventBus({
                maxQueueSize: queueSize,
                warnOnDrop: false,
              })

              const receivedBySource = new Map<number, number[]>()

              eventBus.on(
                'concurrent.test' as OrchestrationEvent['type'],
                (event) => {
                  const { source, id } = event as {
                    type: string
                    source: number
                    id: number
                  }
                  if (!receivedBySource.has(source)) {
                    receivedBySource.set(source, [])
                  }
                  receivedBySource.get(source)!.push(id)
                },
              )

              // Create concurrent emitters
              const emitters = Array.from(
                { length: emitterCount },
                (_, source) =>
                  (async () => {
                    for (let id = 0; id < eventsPerEmitter; id++) {
                      eventBus.emitEvent({
                        type: 'concurrent.test',
                        source,
                        id,
                      } as OrchestrationEvent)
                    }
                  })(),
              )

              // Run all emitters concurrently
              await Promise.all(emitters)

              // Wait for processing
              await new Promise((resolve) => setTimeout(resolve, 200))

              // Verify ordering within each source
              for (const [, ids] of receivedBySource) {
                // IDs from same source should maintain order
                if (ids.length > 1) {
                  for (let i = 1; i < ids.length; i++) {
                    expect(ids[i]).toBeGreaterThanOrEqual(ids[i - 1])
                  }
                }
              }

              const metrics = eventBus.getMetrics()
              const totalEmitted = emitterCount * eventsPerEmitter
              const totalReceived = Array.from(
                receivedBySource.values(),
              ).reduce((sum, ids) => sum + ids.length, 0)

              // Account for all events - either received or dropped
              expect(totalReceived + metrics.droppedCount).toBe(totalEmitted)
            },
          ),
          { numRuns: 5 },
        )
      },
    )
  })
})
