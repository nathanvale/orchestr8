# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-20-event-bus-bounded-queue/spec.md

> Created: 2025-08-20
> Version: 1.0.0

## Test Coverage

### Unit Tests

**BoundedEventBus**

- Should create with default configuration
- Should accept custom max queue size
- Should emit events to registered listeners
- Should handle multiple listeners for same event type
- Should remove listeners correctly
- Should return listener count for event types
- Should reject invalid event types (type safety)

**Queue Management**

- Should enqueue events up to max capacity
- Should track current queue size accurately
- Should process events in FIFO order
- Should handle rapid event emission without blocking
- Should calculate memory usage estimates

**Overflow Behavior**

- Should drop oldest event when queue is full
- Should increment dropped count on overflow
- Should track last drop timestamp
- Should calculate drop rate over time window
- Should emit warning on first drop
- Should throttle subsequent warnings to 1 per minute
- Should continue processing newer events after overflow

**Error Handling**

- Should isolate listener errors from other listeners
- Should continue processing after listener error
- Should log listener errors with context
- Should handle errors in async listeners
- Should not lose events when listener throws

### Integration Tests

**ExecutionEngine Integration**

- Should emit workflow.started when execution begins
- Should emit step events for each workflow step
- Should emit workflow.completed on success
- Should emit workflow.failed on error
- Should maintain event order during parallel execution

**Journal Integration**

- Should record all step events in journal
- Should handle high-volume event streams
- Should not lose events during journal writes
- Should maintain correlation IDs across events

**Resilience Pattern Integration**

- Should emit retry.attempted events
- Should emit circuitBreaker.opened when circuit trips
- Should emit timeout.exceeded events
- Should maintain resilience context in events

### Performance Tests

**Throughput Testing**

- Should handle 10,000 events/second
- Should maintain < 1ms emission latency (p95) using queueMicrotask
- Should not degrade with 100 listeners
- Should validate metrics API shape and accuracy

**Memory Testing**

- Should maintain stable memory with continuous events
- Should properly garbage collect dropped events
- Should not leak memory with listener churn

**Stress Testing**

- Should handle burst of 10,000 events
- Should recover from queue overflow gracefully
- Should maintain metrics accuracy under load

### Property-Based Tests

**Queue Invariants**

- Queue size never exceeds max capacity
- FIFO ordering maintained for processed events
- Dropped count + processed count = total emitted
- Memory usage correlates with queue size (when tracking enabled)

**Event Delivery Invariants**

- All listeners receive events in same order
- No events lost without being counted as dropped
- Error objects preserved with stack traces intact

## Mocking Requirements

- **No external mocks needed** - Event bus is self-contained
- **Time mocking**: Use fake timers for drop rate calculations
- **Memory mocking**: Mock process.memoryUsage() for memory tests
- **Microtask mocking**: Use vi.useFakeTimers() with queueMicrotask support

## Test Utilities

```typescript
class EventBusTestHarness {
  // Helper to generate event streams
  generateEventStream(rate: number, duration: number): AsyncGenerator<Event>

  // Helper to verify event ordering
  verifyEventOrder(received: Event[], expected: Event[]): void

  // Helper to simulate listener errors
  createFailingListener(errorRate: number): EventListener

  // Helper to measure emission latency
  measureLatency(eventBus: BoundedEventBus, count: number): LatencyStats

  // Helper to verify metrics shape
  assertMetricsShape(metrics: unknown): asserts metrics is EventBusMetrics

  // Helper to test Error preservation
  createTestError(message: string): Error
}
```

## Coverage Requirements

- **Unit Tests**: 95% coverage of event bus core
- **Integration Tests**: All integration points covered
- **Performance Tests**: Baseline metrics established
- **Overall Target**: 90% coverage for event bus package

## Test Execution Strategy

1. **Unit tests first**: Validate core functionality in isolation
2. **Integration tests**: Verify interactions with orchestration components
3. **Performance tests**: Establish and validate performance baselines
4. **Stress tests**: Ensure stability under extreme conditions
5. **Property tests**: Verify invariants hold across random inputs

## Critical Test Scenarios

### Scenario 1: Event Storm Recovery

```typescript
it('should handle event storm and recover', async () => {
  const eventBus = new BoundedEventBus({ maxQueueSize: 100 })

  // Generate 1000 events rapidly
  for (let i = 0; i < 1000; i++) {
    eventBus.emit({ type: 'test.event', id: i })
  }

  // Verify overflow handled correctly
  const metrics = eventBus.getMetrics()
  expect(metrics.droppedCount).toBe(900)
  expect(metrics.highWaterMark).toBe(100)

  // Verify system still processes new events
  const received = []
  eventBus.on('test.event', (e) => received.push(e))
  eventBus.emit({ type: 'test.event', id: 1001 })

  // Wait for microtask
  await new Promise((resolve) => queueMicrotask(resolve))
  expect(received).toContainEqual({ type: 'test.event', id: 1001 })
})
```

### Scenario 2: Listener Error Isolation

```typescript
it('should isolate listener errors and preserve Error objects', async () => {
  const eventBus = new BoundedEventBus()
  const results = []
  const errors = []

  eventBus.on('test.event', () => {
    throw new Error('Listener 1 failed')
  })

  eventBus.on('test.event', (event) => {
    results.push(event)
  })

  eventBus.on('step.failed', (event) => {
    // Verify Error object preserved
    errors.push(event.error)
  })

  const testError = new Error('Test failure')
  eventBus.emit({ type: 'test.event', data: 'test' })
  eventBus.emit({
    type: 'step.failed',
    stepId: '1',
    error: testError,
    retryable: false,
  })

  await new Promise((resolve) => queueMicrotask(resolve))
  expect(results).toHaveLength(1)
  expect(results[0].data).toBe('test')
  expect(errors[0]).toBe(testError) // Same reference
  expect(errors[0].stack).toBeDefined() // Stack preserved
})
```

### Scenario 3: Memory Bounds Verification

```typescript
it('should respect memory bounds', async () => {
  const eventBus = new BoundedEventBus({
    maxQueueSize: 1000,
    enableMemoryTracking: true,
  })

  // Mock memory usage for consistent testing
  const mockMemoryUsage = vi.spyOn(process, 'memoryUsage')
  mockMemoryUsage.mockReturnValue({
    heapUsed: 1000000, // 1MB baseline
    rss: 0,
    heapTotal: 0,
    external: 0,
    arrayBuffers: 0,
  })

  // Fill queue with large events
  for (let i = 0; i < 2000; i++) {
    eventBus.emit({
      type: 'test.event',
      payload: 'x'.repeat(1000), // 1KB per event
    })
  }

  // Verify queue respected bounds
  const metrics = eventBus.getMetrics()
  expect(metrics.queueSize).toBeLessThanOrEqual(1000)
  expect(metrics.droppedCount).toBe(1000)
})
```
