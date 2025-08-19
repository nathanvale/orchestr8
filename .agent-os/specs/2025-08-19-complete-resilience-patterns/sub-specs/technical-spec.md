# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-19-complete-resilience-patterns/spec.md

> Created: 2025-08-19
> Version: 2.0.0
> Updated: 2025-08-19 - Added P0 clarifications and implementation decisions

## P0 Implementation Decisions

### 1. Operation Contract Decision

**Decision**: Keep operation contract minimal - `(signal?: AbortSignal) => Promise<T>`

- Operations remain focused on business logic without resilience context
- Circuit breaker keys derived at adapter layer via:
  - Mandatory `key` in policy config, OR
  - Deterministic `deriveKey(context: ResilienceContext)` function in adapter
- Clean separation between operation logic and resilience infrastructure

### 2. Retry Policy Schema

**Decision**: Precise retry configuration with non-retryable error classification

```typescript
interface RetryConfig {
  maxAttempts: number
  backoffStrategy: 'fixed' | 'exponential'
  jitterStrategy: 'none' | 'full'
  initialDelay: number
  maxDelay: number
  retryOn?: (error: Error) => boolean // Custom retry predicate
}

// Default non-retryable errors:
// - CircuitBreakerOpenError (never retry)
// - TimeoutError from outer timeout (configurable)
// - Custom non-retryable via retryOn predicate
```

### 3. Circuit Breaker Sliding Window

**Decision**: Sliding window with natural displacement

- Window maintains last `sampleSize` outcomes
- Circuit opens when window is full AND failures >= `failureThreshold`
- Successes naturally displace failures in window (no reset logic)
- Window implemented as circular buffer for O(1) operations

### 4. Half-Open Concurrency Control

**Decision**: Single-probe policy with deterministic rejection

- Per-key probe lock prevents concurrent half-open tests
- Rejected requests during probe receive `CircuitBreakerOpenError` with `nextRetryTime`
- Successful probe transitions to closed, failed probe returns to open

### 5. Composition Order Validation

**Decision**: Support only two patterns for MVP

- Supported: `retry-cb-timeout` and `timeout-cb-retry`
- Validation at adapter initialization
- Clear error message for unsupported patterns
- Skip missing patterns while preserving order

### 6. Error Consolidation

**Decision**: Single source of truth in @orchestr8/resilience

- One canonical `CircuitBreakerOpenError` class
- Consistent error properties across all usages
- Remove duplicates from core package

## Type Definitions and API Contracts

### Consolidated Error Types

```typescript
// Single canonical circuit breaker error (in @orchestr8/resilience)
export class CircuitBreakerOpenError extends Error {
  public readonly code = 'CIRCUIT_BREAKER_OPEN'
  public readonly retryAfter: number // milliseconds until retry
  public readonly nextRetryTime: number // absolute timestamp

  constructor(nextRetryTime: number) {
    const retryAfter = nextRetryTime - Date.now()
    super(
      `Circuit breaker is open - service unavailable. Retry after ${retryAfter}ms`,
    )
    this.name = 'CircuitBreakerOpenError'
    this.retryAfter = retryAfter
    this.nextRetryTime = nextRetryTime
  }
}

// Timeout-specific error
export class TimeoutError extends Error {
  public readonly code = 'TIMEOUT_ERROR'
  public readonly duration: number
  public readonly operation?: string

  constructor(duration: number, operation?: string) {
    super(`Operation ${operation || 'unknown'} timed out after ${duration}ms`)
    this.name = 'TimeoutError'
    this.duration = duration
    this.operation = operation
  }
}

// Retry exhausted error
export class RetryExhaustedError extends Error {
  public readonly code = 'RETRY_EXHAUSTED'
  public readonly attempts: number
  public readonly lastError: Error

  constructor(attempts: number, lastError: Error) {
    super(`Retry exhausted after ${attempts} attempts: ${lastError.message}`)
    this.name = 'RetryExhaustedError'
    this.attempts = attempts
    this.lastError = lastError
    // Preserve original stack
    this.stack = lastError.stack
  }
}
```

### Operation Contract

```typescript
// All operations MUST accept an optional AbortSignal
type ResilientOperation<T> = (signal?: AbortSignal) => Promise<T>

// Signal propagation requirements:
// 1. Operations must check signal.aborted at entry
// 2. Operations must handle abort events during execution
// 3. Middleware must combine parent and local signals
// 4. Distinguish timeout from external cancellation:
//    - Timeout: controller.signal.aborted && !parentSignal?.aborted
//    - External: parentSignal?.aborted
```

### Type Conventions

```typescript
// Use Array<T> syntax (not T[])
type RetryDelays = Array<number>
type CircuitStates = Array<CircuitBreakerState>

// Descriptive names following project conventions
type CircuitBreakerState = 'closed' | 'open' | 'half-open'
type BackoffStrategy = 'fixed' | 'exponential'
type JitterStrategy = 'none' | 'full-jitter'

// No semicolons in interface definitions
interface ResilienceContext {
  workflowId: string
  stepId: string
  correlationId: string
  signal?: AbortSignal
}
```

## Technical Requirements

### Circuit Breaker Requirements

- **State Management**: Maintain circuit state (closed/open/half-open) per operation key
- **Failure Tracking**: Track failures within a rolling window or sample size
- **Threshold Detection**: Open circuit when failure rate exceeds configured threshold
- **Recovery Testing**: Periodically transition to half-open state to test recovery
- **Request Blocking**: Immediately fail requests when circuit is open
- **Thread Safety**: Ensure state transitions are atomic and thread-safe

### Composition Order Requirements

- **Layered Execution**: Properly nest pattern execution according to composition order
- **Error Propagation**: Maintain error context through composition layers
- **Signal Handling**: Propagate AbortSignal through all layers correctly
- **State Isolation**: Each pattern maintains independent state

### Performance Requirements

- **Target**: Median <1ms, P95 <2ms overhead for pattern application
- **Measurement Method**:
  - Warm execution (after JIT compilation)
  - Node.js 20+ on GitHub Actions ubuntu-latest runners
  - Measured as difference between direct operation and wrapped operation
  - Baseline established without any resilience patterns
- **Tolerance**: P99 <5ms acceptable for complex compositions
- **Memory**: Bounded memory usage for circuit breaker state (max 1000 circuits)
- **CPU**: Minimal CPU overhead for state checks and updates
- **Benchmark Validation**: Performance tests must pass on CI infrastructure

## Approach Options

### Circuit Breaker Implementation

**Option A: Simple State Machine**

- Pros: Easy to understand, minimal dependencies, predictable behavior
- Cons: Less sophisticated failure detection, no gradual recovery

**Option B: Sliding Window with Percentiles** (Selected)

- Pros: More accurate failure detection, configurable windows, better for bursty traffic
- Cons: More complex implementation, slightly higher memory usage

**Rationale:** Option B provides better production characteristics and aligns with industry standards like Netflix Hystrix and resilience4j.

### Composition Architecture

**Option A: Nested Function Calls**

- Pros: Simple to implement, clear execution flow
- Cons: Harder to debug, stack depth concerns

**Option B: Middleware Chain Pattern** (Selected)

- Pros: Composable, testable, clear separation of concerns, easier debugging
- Cons: Slightly more complex initial setup

**Rationale:** Middleware pattern provides better maintainability and allows future extension with additional patterns.

## Implementation Design

### Circuit Breaker with Sliding Window

```typescript
interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open'
  slidingWindow: Array<boolean> // true = success, false = failure
  windowIndex: number // Current position in circular buffer
  windowSize: number // Number of valid entries in window
  lastFailureTime?: number
  nextHalfOpenTime?: number
  probeInProgress: boolean // Lock for half-open state
}

interface CircuitBreakerConfig {
  sampleSize: number // Size of sliding window
  failureThreshold: number // Number of failures to open circuit
  resetTimeout: number // Time before trying half-open
  key?: string // Optional explicit key
}

class CircuitBreaker {
  private states: Map<string, CircuitBreakerState>

  async execute<T>(
    operation: ResilientOperation<T>,
    config: CircuitBreakerConfig,
    context: ResilienceContext,
  ): Promise<T> {
    const key = config.key || this.deriveKey(context)
    const state = this.getOrCreateState(key, config)

    // Check circuit state
    if (state.status === 'open') {
      if (Date.now() >= state.nextHalfOpenTime) {
        // Try to transition to half-open
        if (!state.probeInProgress) {
          state.probeInProgress = true
          state.status = 'half-open'
        } else {
          // Another probe is in progress, reject
          throw new CircuitBreakerOpenError(state.nextHalfOpenTime)
        }
      } else {
        throw new CircuitBreakerOpenError(state.nextHalfOpenTime)
      }
    } else if (state.status === 'half-open' && state.probeInProgress) {
      // Reject concurrent requests during probe
      throw new CircuitBreakerOpenError(state.nextHalfOpenTime)
    }

    try {
      const result = await operation(context.signal)
      this.recordSuccess(key, state, config)
      return result
    } catch (error) {
      this.recordFailure(key, state, config)
      throw error
    }
  }

  private recordSuccess(
    key: string,
    state: CircuitBreakerState,
    config: CircuitBreakerConfig,
  ): void {
    // Add success to sliding window
    state.slidingWindow[state.windowIndex] = true
    state.windowIndex = (state.windowIndex + 1) % config.sampleSize
    state.windowSize = Math.min(state.windowSize + 1, config.sampleSize)

    if (state.status === 'half-open') {
      state.status = 'closed'
      state.probeInProgress = false
    }
  }

  private recordFailure(
    key: string,
    state: CircuitBreakerState,
    config: CircuitBreakerConfig,
  ): void {
    // Add failure to sliding window
    state.slidingWindow[state.windowIndex] = false
    state.windowIndex = (state.windowIndex + 1) % config.sampleSize
    state.windowSize = Math.min(state.windowSize + 1, config.sampleSize)

    // Check if we should open the circuit
    if (state.windowSize === config.sampleSize) {
      const failures = state.slidingWindow.filter((outcome) => !outcome).length
      if (failures >= config.failureThreshold) {
        state.status = 'open'
        state.nextHalfOpenTime = Date.now() + config.resetTimeout
        state.lastFailureTime = Date.now()
      }
    }

    if (state.status === 'half-open') {
      // Failed probe, return to open
      state.status = 'open'
      state.nextHalfOpenTime = Date.now() + config.resetTimeout
      state.probeInProgress = false
    }
  }

  private deriveKey(context: ResilienceContext): string {
    return `${context.workflowId}:${context.stepId}`
  }
}
```

### Composition with Validated Patterns

```typescript
type ResilienceMiddleware<T> = (
  next: ResilientOperation<T>,
) => ResilientOperation<T>

type CompositionOrder = 'retry-cb-timeout' | 'timeout-cb-retry' // Only supported patterns

class CompositionEngine {
  private readonly SUPPORTED_PATTERNS = ['retry-cb-timeout', 'timeout-cb-retry']

  composePatterns<T>(
    operation: ResilientOperation<T>,
    policies: ResiliencePolicy,
    order: CompositionOrder,
    context: ResilienceContext,
  ): ResilientOperation<T> {
    // Validate composition order
    if (!this.SUPPORTED_PATTERNS.includes(order)) {
      throw new Error(
        `Unsupported composition order: ${order}. ` +
          `Supported patterns: ${this.SUPPORTED_PATTERNS.join(', ')}`,
      )
    }

    const middlewares = this.createMiddlewares(policies, order, context)

    // Apply middlewares in reverse order (innermost first)
    return middlewares.reduceRight(
      (next, middleware) => middleware(next),
      operation,
    )
  }

  private createMiddlewares(
    policies: ResiliencePolicy,
    order: CompositionOrder,
    context: ResilienceContext,
  ): Array<ResilienceMiddleware<any>> {
    const patterns = order.split('-') // ['retry', 'cb', 'timeout']
    const middlewares: Array<ResilienceMiddleware<any>> = []

    for (const pattern of patterns) {
      switch (pattern) {
        case 'retry':
          if (policies.retry) {
            middlewares.push(this.createRetryMiddleware(policies.retry))
          }
          break
        case 'cb':
          if (policies.circuitBreaker) {
            middlewares.push(
              this.createCircuitBreakerMiddleware(
                policies.circuitBreaker,
                context,
              ),
            )
          }
          break
        case 'timeout':
          if (policies.timeout) {
            middlewares.push(this.createTimeoutMiddleware(policies.timeout))
          }
          break
        default:
          // Skip unknown patterns (forward compatibility)
          break
      }
    }

    return middlewares
  }

  private createRetryMiddleware(
    config: RetryConfig,
  ): ResilienceMiddleware<any> {
    return (next: ResilientOperation<any>) => {
      return async (signal?: AbortSignal) => {
        let lastError: Error

        for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
          try {
            return await next(signal)
          } catch (error) {
            lastError = error as Error

            // Check if error is retryable
            if (error instanceof CircuitBreakerOpenError) {
              throw error // Never retry circuit breaker open
            }

            if (config.retryOn && !config.retryOn(error as Error)) {
              throw error // Custom predicate says don't retry
            }

            if (attempt === config.maxAttempts) {
              throw new RetryExhaustedError(attempt, lastError)
            }

            // Calculate delay with backoff and jitter
            const delay = this.calculateDelay(attempt, config)
            await this.sleep(delay, signal)
          }
        }

        throw new RetryExhaustedError(config.maxAttempts, lastError!)
      }
    }
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.initialDelay

    if (config.backoffStrategy === 'exponential') {
      delay = Math.min(
        config.initialDelay * Math.pow(2, attempt - 1),
        config.maxDelay,
      )
    }

    if (config.jitterStrategy === 'full') {
      delay = Math.random() * delay
    }

    return delay
  }
}
```

## External Dependencies

- **None required** - Implementation uses only Node.js built-in APIs
- **Justification:** Keeping the implementation dependency-free ensures maximum compatibility and reduces supply chain risks

## Migration Strategy

1. Implement new patterns alongside existing reference adapter
2. Add feature flag to switch between implementations
3. Gradually migrate tests to new implementation
4. Remove reference adapter once stable

## Error Handling

### Circuit Breaker Errors

```typescript
class CircuitBreakerOpenError extends Error {
  code = 'CIRCUIT_BREAKER_OPEN'
  constructor(public readonly nextRetryTime: number) {
    super('Circuit breaker is open')
  }
}
```

### Composition Errors

- Preserve original error stack traces
- Add pattern context to error metadata
- Ensure errors bubble through composition correctly

## Performance Optimizations

- Use Map for O(1) circuit state lookups
- Implement lazy state cleanup for expired circuits
- Use optimized sliding window algorithm for failure tracking
- Cache composed middleware chains for repeated use

## Implementation Phases

### Phase 1: Foundation (Immediate)

1. **Error Type Consolidation**
   - Create canonical error classes in @orchestr8/resilience
   - Remove duplicates from @orchestr8/core
   - Export from resilience package index

2. **Core Interfaces**
   - Define `RetryConfig` with all fields
   - Define `CircuitBreakerConfig` with sliding window params
   - Create `ResilienceContext` type
   - Update `ResilienceAdapter` interface

### Phase 2: Circuit Breaker Implementation

3. **Sliding Window State Machine**
   - Implement circular buffer for outcome tracking
   - Add per-key state management with Map
   - Implement state transitions (closed/open/half-open)
   - Add probe locking for half-open concurrency control

4. **Retry with Backoff/Jitter**
   - Implement exponential and fixed backoff strategies
   - Add full jitter calculation
   - Implement non-retryable error detection
   - Add custom retry predicates

### Phase 3: Composition Engine

5. **Pattern Composition**
   - Implement middleware chain pattern
   - Validate composition orders at initialization
   - Support retry-cb-timeout and timeout-cb-retry
   - Skip missing patterns while preserving order

6. **Context Integration**
   - Pass ResilienceContext through layers
   - Derive circuit breaker keys from context
   - Propagate AbortSignal correctly
   - Preserve error stack traces

### Phase 4: Testing & Validation

7. **Comprehensive Test Suite**
   - Unit tests for each pattern
   - Integration tests for compositions
   - Edge case testing (probe races, window boundaries)
   - Performance benchmarks

8. **Production Readiness**
   - Memory leak prevention (bounded state maps)
   - Graceful degradation patterns
   - Clear error messages
   - Documentation and examples
