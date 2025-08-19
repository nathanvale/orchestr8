# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-19-complete-resilience-patterns/spec.md

> Created: 2025-08-19
> Version: 1.0.0

## Test Coverage

### Unit Tests

**CircuitBreaker Class**

- State transitions (closed → open → half-open → closed)
- Failure threshold detection with sliding window
- Recovery time enforcement
- Half-open probe behavior (single-probe only, gradual is P1)
- Memory cleanup and bounded state management
- Thread safety and race conditions
- Signal cancellation during circuit operations

**RetryStrategy Class**

- Fixed backoff with configurable delay
- Exponential backoff with proper scaling
- Full jitter implementation (0 to max delay)
- Max delay enforcement
- Retry exhaustion behavior
- Early termination on non-retryable errors
- Signal cancellation between retries

**TimeoutWrapper Class**

- Timeout enforcement for operations
- Signal combination with parent signals
- Proper cleanup on success and failure
- Distinction between timeout and cancellation
- Race condition handling

**CompositionEngine Class**

- Middleware stack building from composition order
- Proper layering for retry-cb-timeout
- Proper layering for timeout-cb-retry
- Signal propagation through layers
- Error context preservation

### Integration Tests

**Circuit Breaker Integration**

- Circuit opens after repeated failures across retries
- Circuit breaker prevents retry storms
- Recovery testing with real time delays
- Multi-key circuit isolation
- Concurrent request handling

**Composition Order Tests**

- retry-cb-timeout: Each retry goes through circuit breaker
- timeout-cb-retry: Overall timeout bounds all retries
- Mixed policies with partial configuration
- No-op when patterns not configured
- Order precedence validation

**Error Propagation**

- Original error stack preservation
- Pattern context in error metadata
- Circuit breaker open error handling
- Timeout vs cancellation errors
- Nested error causes

### Feature Tests

**End-to-End Workflow Resilience**

- Workflow with failing step recovers via retry
- Circuit breaker prevents cascade failures
- Timeout prevents hanging workflows
- Proper composition order application
- Fallback execution after resilience failure

**Performance Tests**

- Pattern overhead < 1ms
- Memory usage remains bounded
- Circuit state cleanup under load
- Concurrent workflow execution

### Mocking Requirements

**Time Control (Using Vitest)**

- Use vi.useFakeTimers() for deterministic timing
- Use vi.setSystemTime() for absolute time control
- Use vi.advanceTimersByTime() for fast-forwarding
- Use vi.runAllTimers() for immediate timer execution

**Operation Mocking**

- Configurable failure/success sequences
- Variable execution times
- Cancellation simulation
- Resource cleanup verification

## Test Scenarios

### Circuit Breaker Scenarios

```typescript
describe('Circuit Breaker', () => {
  describe('State Transitions', () => {
    it('should start in closed state')
    it('should open after threshold failures')
    it('should remain closed if failures below threshold')
    it('should transition to half-open after recovery time')
    it('should close from half-open on success')
    it('should reopen from half-open on failure')
  })

  describe('Failure Detection', () => {
    it('should use sliding window for failure counting')
    it('should not open until sample size reached')
    it('should expire old failures from window')
    it('should reset window on success in closed state')
  })

  describe('Half-Open Behavior', () => {
    it('should allow single probe in single-probe mode')
    it('should reject concurrent requests during probe')
    it.skip('should allow gradual traffic in gradual mode') // P1: Post-MVP enhancement
  })

  describe('Memory Management', () => {
    it('should cleanup unused circuits after timeout')
    it('should enforce maximum circuit limit')
    it('should evict LRU circuits when limit exceeded')
  })
})
```

### Composition Order Scenarios

```typescript
describe('Composition Order', () => {
  describe('retry-cb-timeout', () => {
    it('should check circuit for each retry attempt')
    it('should apply timeout to each attempt individually')
    it('should stop retrying if circuit opens')
    it('should record failures in circuit breaker')
  })

  describe('timeout-cb-retry', () => {
    it('should apply single timeout to all retries')
    it('should cancel retries when timeout expires')
    it('should check circuit once before retry sequence')
    it('should fail fast if circuit is open')
  })

  describe('Edge Cases', () => {
    it('should handle partial policy configuration')
    it('should skip missing patterns in composition')
    it('should preserve order with missing patterns')
  })
})
```

### Error Handling Scenarios

```typescript
describe('Error Handling', () => {
  it('should preserve original error stack traces')
  it('should add pattern context to errors')
  it('should distinguish timeout from cancellation')
  it('should handle circuit breaker open errors specially')
  it('should not retry on non-retryable errors')
  it('should provide next retry time in circuit open errors')
})
```

### Concurrency Scenarios

```typescript
describe('Concurrency', () => {
  it('should handle concurrent requests to same circuit')
  it('should isolate circuits by key')
  it('should handle race conditions in state transitions')
  it('should properly cleanup on concurrent cancellations')
  it('should maintain consistency under load')
})
```

## Test Data Builders

### Policy Builder

```typescript
class ResiliencePolicyBuilder {
  private policy: ResiliencePolicy = {}

  withRetry(attempts = 3): this {
    this.policy.retry = {
      maxAttempts: attempts,
      backoffStrategy: 'exponential',
      jitterStrategy: 'full-jitter',
      initialDelay: 100,
      maxDelay: 1000,
    }
    return this
  }

  withCircuitBreaker(threshold = 5): this {
    this.policy.circuitBreaker = {
      failureThreshold: threshold,
      recoveryTime: 1000,
      sampleSize: 10,
      halfOpenPolicy: 'single-probe',
    }
    return this
  }

  withTimeout(ms = 1000): this {
    this.policy.timeout = ms
    return this
  }

  build(): ResiliencePolicy {
    return { ...this.policy }
  }
}
```

### Operation Builder

```typescript
class TestOperationBuilder {
  private behavior: 'success' | 'fail' | 'slow' | 'flaky' = 'success'
  private duration = 0
  private failureRate = 1.0

  thatSucceeds(): this {
    this.behavior = 'success'
    return this
  }

  thatFails(): this {
    this.behavior = 'fail'
    return this
  }

  thatTakes(ms: number): this {
    this.duration = ms
    return this
  }

  thatFailsRandomly(rate: number): this {
    this.behavior = 'flaky'
    this.failureRate = rate
    return this
  }

  build(): () => Promise<string> {
    return async () => {
      if (this.duration > 0) {
        await sleep(this.duration)
      }

      switch (this.behavior) {
        case 'success':
          return 'success'
        case 'fail':
          throw new Error('Operation failed')
        case 'flaky':
          if (Math.random() < this.failureRate) {
            throw new Error('Random failure')
          }
          return 'success'
        default:
          return 'success'
      }
    }
  }
}
```

## Performance Benchmarks

```typescript
describe('Performance', () => {
  it('should add median <1ms, p95 <2ms overhead for pattern application', async () => {
    const operation = async () => 'result'
    const policy = new ResiliencePolicyBuilder()
      .withRetry()
      .withCircuitBreaker()
      .withTimeout()
      .build()

    const direct = await measureTime(operation)
    const withResilience = await measureTime(() =>
      adapter.applyNormalizedPolicy(operation, policy, 'retry-cb-timeout'),
    )

    // Measure multiple runs for percentiles
    const measurements: Array<number> = []
    for (let i = 0; i < 100; i++) {
      const start = performance.now()
      await adapter.applyNormalizedPolicy(operation, policy, 'retry-cb-timeout')
      measurements.push(performance.now() - start)
    }

    measurements.sort((a, b) => a - b)
    const median = measurements[49]
    const p95 = measurements[94]

    expect(median).toBeLessThan(1)
    expect(p95).toBeLessThan(2)
  })

  it('should handle 1000 concurrent operations', async () => {
    const operations = Array(1000)
      .fill(0)
      .map(() =>
        adapter.applyNormalizedPolicy(
          async () => 'result',
          policy,
          'retry-cb-timeout',
        ),
      )

    const start = Date.now()
    await Promise.all(operations)
    const duration = Date.now() - start

    expect(duration).toBeLessThan(2000) // < 2ms per operation average
  })
})
```

## Coverage Requirements

- Unit test coverage: > 95%
- Integration test coverage: > 90%
- Branch coverage: > 90%
- All error paths tested
- All edge cases covered
- Performance benchmarks passing
