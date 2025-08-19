# Circuit Breaker Specification

> Created: 2025-08-19
> Version: 1.0.0

## Overview

Detailed specification for the circuit breaker pattern implementation in @orchestr8/resilience.

## State Transitions

### States

1. **CLOSED** (Normal Operation)
   - All requests pass through to the protected operation
   - Failures are counted against threshold
   - Successes reset or reduce failure count
   - Transitions to OPEN when failure threshold exceeded

2. **OPEN** (Blocking Requests)
   - All requests immediately fail with CircuitBreakerOpenError
   - No requests reach the protected operation
   - Waits for recovery time before transitioning to HALF-OPEN
   - Provides next retry time in error for client awareness

3. **HALF-OPEN** (Testing Recovery)
   - Allows limited probe requests through
   - Success transitions back to CLOSED
   - Failure transitions back to OPEN
   - Implements configurable probe strategies

### State Transition Diagram

```
     [CLOSED]
        |
        | failures >= threshold
        ↓
     [OPEN] ←─────────┐
        |             |
        | after       | probe
        | recovery    | fails
        | time        |
        ↓             |
    [HALF-OPEN] ──────┘
        |
        | probe succeeds
        ↓
     [CLOSED]
```

## Circuit Key Derivation

### Default Key Strategy

```typescript
// Keys are derived from workflow step context
function deriveCircuitKey(context: ResilienceContext): string {
  // Default: per-step isolation
  return `${context.workflowId}:${context.stepId}`
}

// Example keys:
// 'order-processing:validate-payment'
// 'user-sync:fetch-profile'
// 'data-pipeline:transform-records'
```

### Custom Key Support

```typescript
interface CircuitBreakerConfig {
  // ... existing fields ...

  // Optional custom key for circuit isolation
  key?: string
}

// Usage examples:
{
  circuitBreaker: {
    key: 'api.github.com/repos',  // Group by API endpoint
    failureThreshold: 5,
    recoveryTime: 30000
  }
}

{
  circuitBreaker: {
    key: 'database-pool',  // Share circuit across all DB operations
    failureThreshold: 10,
    recoveryTime: 60000
  }
}
```

### Key Hygiene Patterns

```typescript
// GOOD: Bounded, predictable keys
const goodKeys = [
  'service:user-api', // Per service
  'endpoint:GET:/api/users', // Per endpoint
  'workflow:order:step:payment', // Per workflow step
]

// BAD: Unbounded, high-cardinality keys
const badKeys = [
  `user:${userId}`, // Per user = millions of circuits
  `request:${requestId}`, // Per request = infinite circuits
  `timestamp:${Date.now()}`, // Time-based = constant growth
]

// Key limits enforced:
// - Maximum 1000 unique circuit keys
// - LRU eviction when limit exceeded
// - Only CLOSED circuits with zero failures eligible for eviction
// - OPEN and HALF-OPEN circuits never evicted
```

## Configuration

### Required Parameters

```typescript
interface CircuitBreakerConfig {
  // Failure threshold to open circuit
  failureThreshold: number // e.g., 5

  // Time in ms before attempting recovery
  recoveryTime: number // e.g., 30000 (30 seconds)

  // Window size for failure tracking
  sampleSize: number // e.g., 10

  // Strategy for half-open state
  halfOpenPolicy: 'single-probe' | 'gradual'
}
```

### Default Values

```typescript
const defaults = {
  failureThreshold: 5,
  recoveryTime: 30000,
  sampleSize: 10,
  halfOpenPolicy: 'single-probe',
}
```

## Failure Detection Algorithms

### Sliding Window

Track last N requests (sampleSize) and calculate failure rate:

```typescript
class SlidingWindow {
  private window: boolean[] = [] // true = success, false = failure

  record(success: boolean) {
    this.window.push(success)
    if (this.window.length > this.sampleSize) {
      this.window.shift()
    }
  }

  getFailureCount(): number {
    return this.window.filter((s) => !s).length
  }

  shouldOpen(threshold: number): boolean {
    if (this.window.length < this.sampleSize) {
      // Not enough samples yet
      return false
    }
    return this.getFailureCount() >= threshold
  }
}
```

### Time-Based Window

Alternative: Track failures within time window (not implemented in MVP):

```typescript
class TimeWindow {
  private failures: number[] = [] // timestamps

  record(failed: boolean) {
    if (failed) {
      this.failures.push(Date.now())
    }
    this.cleanup()
  }

  private cleanup() {
    const cutoff = Date.now() - this.windowMs
    this.failures = this.failures.filter((t) => t > cutoff)
  }
}
```

## Half-Open Policies

### Single Probe

Only one request attempts during half-open state:

```typescript
if (state.status === 'half-open') {
  if (state.probing) {
    throw new CircuitBreakerOpenError()
  }
  state.probing = true

  try {
    const result = await operation()
    this.transitionToClosed(key)
    return result
  } catch (error) {
    this.transitionToOpen(key)
    throw error
  } finally {
    state.probing = false
  }
}
```

### Gradual Recovery (P1 - Post-MVP Enhancement)

**Status**: This is a P1 enhancement planned for after MVP release.

Allow increasing requests during half-open (future enhancement):

```typescript
if (state.status === 'half-open') {
  const allowedRequests = Math.min(
    state.successCount + 1,
    this.maxGradualRequests,
  )

  if (state.currentRequests >= allowedRequests) {
    throw new CircuitBreakerOpenError()
  }

  // Proceed with gradual increase
}
```

## Memory Management

### State Cleanup

Prevent unbounded growth of circuit state:

```typescript
class CircuitBreakerManager {
  private circuits = new Map<string, CircuitBreakerState>()
  private lastCleanup = Date.now()

  private maybeCleanup() {
    if (Date.now() - this.lastCleanup > 60000) {
      // Every minute
      this.cleanup()
    }
  }

  private cleanup() {
    const now = Date.now()
    const expired = now - 3600000 // 1 hour

    for (const [key, state] of this.circuits) {
      if (
        state.lastAccessTime < expired &&
        state.status === 'closed' &&
        state.failures === 0
      ) {
        this.circuits.delete(key)
      }
    }

    // Enforce max circuits
    if (this.circuits.size > 1000) {
      const sorted = Array.from(this.circuits.entries()).sort(
        ([, a], [, b]) => a.lastAccessTime - b.lastAccessTime,
      )

      // Remove oldest 10%
      const toRemove = Math.floor(this.circuits.size * 0.1)
      sorted.slice(0, toRemove).forEach(([key]) => {
        this.circuits.delete(key)
      })
    }

    this.lastCleanup = now
  }
}
```

## Error Handling

### Circuit Breaker Specific Errors

```typescript
export class CircuitBreakerOpenError extends Error {
  public readonly code = 'CIRCUIT_BREAKER_OPEN'
  public readonly retryAfter: number

  constructor(nextRetryTime: number) {
    super('Circuit breaker is open - service unavailable')
    this.name = 'CircuitBreakerOpenError'
    this.retryAfter = nextRetryTime - Date.now()
  }
}

export class CircuitBreakerHalfOpenError extends Error {
  public readonly code = 'CIRCUIT_BREAKER_HALF_OPEN'

  constructor() {
    super('Circuit breaker is half-open - probe in progress')
    this.name = 'CircuitBreakerHalfOpenError'
  }
}
```

## Observability Hooks

### State Change Events

```typescript
interface CircuitBreakerEvents {
  onStateChange?: (key: string, from: State, to: State) => void
  onOpen?: (key: string, failures: number) => void
  onClose?: (key: string) => void
  onHalfOpen?: (key: string) => void
}
```

### Metrics Collection

```typescript
interface CircuitBreakerMetrics {
  getTotalRequests(key: string): number
  getFailureRate(key: string): number
  getCurrentState(key: string): State
  getOpenCircuits(): string[]
}
```

## Thread Safety

### Atomic Operations

Ensure state transitions are atomic:

```typescript
class CircuitBreaker {
  private async atomicTransition(
    key: string,
    from: State,
    to: State,
  ): Promise<boolean> {
    const state = this.circuits.get(key)

    if (state?.status !== from) {
      return false // State changed, abort transition
    }

    // Atomic update
    state.status = to
    state.transitionTime = Date.now()

    if (to === 'open') {
      state.nextHalfOpenTime = Date.now() + this.config.recoveryTime
    }

    return true
  }
}
```

## Testing Considerations

### Time Control

Allow injection of time provider for testing:

```typescript
// With Vitest, time control is built-in
class CircuitBreaker {
  constructor() {
    // No need for TimeProvider with vi.useFakeTimers()
  }

  private now(): number {
    return Date.now() // Vitest controls this when using fake timers
  }
}
```

### Deterministic Testing

```typescript
describe('Circuit Breaker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should open after threshold failures', async () => {
    const cb = new CircuitBreaker()

    // Simulate failures
    for (let i = 0; i < 5; i++) {
      await expect(cb.execute(failingOp)).rejects.toThrow()
    }

    // Circuit should be open
    await expect(cb.execute(operation)).rejects.toThrow(CircuitBreakerOpenError)
  })
})
```
