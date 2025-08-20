# @orchestr8/resilience

Production-ready resilience patterns for the @orchestr8 orchestration platform. Provides retry, circuit breaker, and timeout patterns with flexible composition strategies.

## Features

- 🔄 **Retry** - Exponential/fixed backoff with jitter and custom retry predicates
- ⚡ **Circuit Breaker** - Sliding window failure detection with half-open recovery
- ⏰ **Timeout** - Configurable operation timeouts with clean cancellation
- 🔧 **Composition** - Flexible pattern ordering (retry-cb-timeout, timeout-cb-retry)
- 📊 **Observability** - Comprehensive telemetry and structured logging
- 🎯 **Type Safety** - Full TypeScript support with strict typing
- ⚡ **Performance** - <1ms median overhead, optimized for production use

## Installation

```bash
pnpm add @orchestr8/resilience
```

## Quick Start

```typescript
import { ProductionResilienceAdapter } from '@orchestr8/resilience'
import type { ResiliencePolicy } from '@orchestr8/schema'

// Create adapter instance
const adapter = new ProductionResilienceAdapter()

// Define your operation
const fetchUserData = async (signal?: AbortSignal) => {
  const response = await fetch('/api/user', { signal })
  return response.json()
}

// Configure resilience policy
const policy: ResiliencePolicy = {
  retry: {
    maxAttempts: 3,
    initialDelay: 100,
    maxDelay: 1000,
    backoffStrategy: 'exponential',
    jitterStrategy: 'full',
  },
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTime: 30000,
    sampleSize: 10,
    halfOpenPolicy: 'single-probe',
  },
  timeout: {
    duration: 5000,
    operationName: 'fetchUserData',
  },
}

// Apply resilience patterns
try {
  const userData = await adapter.applyNormalizedPolicy(
    fetchUserData,
    policy,
    'retry-cb-timeout', // Composition order
  )
  console.log('User data:', userData)
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    console.log(`Circuit open, retry after: ${error.retryAfter}ms`)
  } else if (error instanceof TimeoutError) {
    console.log(`Operation timed out after ${error.duration}ms`)
  } else if (error instanceof RetryExhaustedError) {
    console.log(`All ${error.attempts} retry attempts failed`)
  }
}
```

## Configuration

### Retry Configuration

```typescript
interface RetryConfig {
  maxAttempts: number // Maximum retry attempts (1-10)
  backoffStrategy: 'fixed' | 'exponential'
  jitterStrategy: 'none' | 'full'
  initialDelay: number // Initial delay in milliseconds
  maxDelay: number // Maximum delay cap
  retryOn?: (error: unknown) => boolean // Custom retry predicate
}
```

**Example: Exponential backoff with jitter**

```typescript
const retryConfig = {
  maxAttempts: 5,
  backoffStrategy: 'exponential',
  jitterStrategy: 'full',
  initialDelay: 100, // Start with 100ms
  maxDelay: 5000, // Cap at 5 seconds
  retryOn: (error) => {
    // Don't retry on authentication errors
    return !(error instanceof AuthenticationError)
  },
}
```

### Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  key?: string // Optional explicit key for circuit isolation
  failureThreshold: number // Number of failures to open circuit
  recoveryTime: number // Time before attempting recovery (ms)
  sampleSize: number // Size of sliding window
  halfOpenPolicy: 'single-probe' | 'gradual'
}
```

**Example: Service-specific circuit breaker**

```typescript
const circuitConfig = {
  key: 'user-service', // Explicit key for isolation
  failureThreshold: 3, // Open after 3 failures
  recoveryTime: 30000, // Wait 30s before recovery attempt
  sampleSize: 10, // Track last 10 outcomes
  halfOpenPolicy: 'single-probe', // Only one recovery test at a time
}
```

### Timeout Configuration

```typescript
interface TimeoutConfig {
  duration: number // Timeout in milliseconds
  operationName?: string // Name for error messages and telemetry
}
```

## Composition Orders

The package supports two composition patterns that determine how resilience patterns are layered:

### retry-cb-timeout (Recommended)

**Pattern:** `retry(circuitBreaker(timeout(operation)))`

- Each retry attempt goes through the circuit breaker
- Individual operations are bounded by timeout
- Circuit breaker can prevent retries if service is failing

```typescript
// Good for: External service calls, API requests
await adapter.applyNormalizedPolicy(operation, policy, 'retry-cb-timeout')
```

### timeout-cb-retry

**Pattern:** `timeout(circuitBreaker(retry(operation)))`

- Entire retry sequence is bounded by a single timeout
- Circuit breaker wraps the complete retry logic
- Useful when you want overall operation timeout

```typescript
// Good for: Batch operations, background tasks
await adapter.applyNormalizedPolicy(operation, policy, 'timeout-cb-retry')
```

## Error Types

The package provides specific error types for different failure scenarios:

```typescript
import {
  CircuitBreakerOpenError,
  RetryExhaustedError,
  TimeoutError,
  isCircuitBreakerOpenError,
} from '@orchestr8/resilience'

// Circuit breaker is open
if (isCircuitBreakerOpenError(error)) {
  console.log(`Retry after: ${error.retryAfter}ms`)
  console.log(`Next retry time: ${new Date(error.nextRetryTime)}`)
}

// All retries failed
if (error instanceof RetryExhaustedError) {
  console.log(`Failed after ${error.attempts} attempts`)
  console.log(`Last error:`, error.lastError)
}

// Operation timed out
if (error instanceof TimeoutError) {
  console.log(`${error.operation} timed out after ${error.duration}ms`)
}
```

## Advanced Usage

### Custom Circuit Breaker Observer

```typescript
import type { CircuitBreakerObserver } from '@orchestr8/resilience'

const observer: CircuitBreakerObserver = {
  onStateChange: (key, oldState, newState, reason) => {
    console.log(`Circuit ${key}: ${oldState} → ${newState} (${reason})`)

    if (newState === 'open') {
      // Alert monitoring system
      alerting.sendAlert(`Circuit breaker opened for ${key}`)
    }
  },
}

const adapter = new ProductionResilienceAdapter({
  circuitObserver: observer,
})
```

### Custom Telemetry Integration

```typescript
import { createResilienceTelemetry } from '@orchestr8/resilience'
import { createLogger } from '@orchestr8/logger'

const logger = createLogger('resilience')
const telemetry = createResilienceTelemetry(logger)

const adapter = new ProductionResilienceAdapter({
  telemetry,
})
```

### Standalone Pattern Usage

You can also use individual patterns directly:

```typescript
import { CircuitBreaker, RetryWrapper } from '@orchestr8/resilience'

// Direct circuit breaker usage
const circuitBreaker = new CircuitBreaker()
const result = await circuitBreaker.execute(
  myOperation,
  { failureThreshold: 3, recoveryTime: 30000, sampleSize: 10 },
  { workflowId: 'test', stepId: 'step1' },
)

// Direct retry usage
const retryWrapper = new RetryWrapper()
const retryResult = await retryWrapper.execute(myOperation, {
  maxAttempts: 3,
  initialDelay: 100,
  backoffStrategy: 'exponential',
})
```

## Performance

The resilience patterns are optimized for production use:

- **Overhead**: <1ms median, <2ms P95
- **Memory**: Bounded circuit breaker state (max 1000 instances)
- **CPU**: O(1) operations for state checks and updates
- **Cleanup**: Automatic LRU eviction of inactive circuits

### Benchmarks

```bash
# Run performance benchmarks
pnpm benchmark

# With performance gating (CI)
PERF=1 pnpm benchmark
```

## Testing

The package includes comprehensive test coverage:

```bash
# Run tests
pnpm test

# Run tests in CI mode
pnpm test:ci

# Check coverage (target: >95%)
pnpm test:ci --coverage
```

## Key Design Decisions

### Non-Retryable Errors

By default, these errors are never retried:

- `CircuitBreakerOpenError` - Circuit is protecting downstream service
- Custom errors via `retryOn` predicate

### Circuit Breaker Sliding Window

- Uses circular buffer for O(1) operations
- Window fills naturally, no manual reset
- Failures displace successes over time
- Full window + threshold triggers opening

### Half-Open State Management

- Single-probe policy prevents thundering herd
- Concurrent requests during probe are rejected
- Successful probe closes circuit immediately
- Failed probe returns to open state

### Context Propagation

Circuit breaker keys are derived from context:

- Default: `${workflowId}:${stepId}`
- Custom: Explicit `key` in configuration
- Isolation: Each key maintains independent state

## Integration with @orchestr8/core

This package is designed to integrate seamlessly with the orchestration engine:

```typescript
// In workflow execution
const stepResult = await resilienceAdapter.applyNormalizedPolicy(
  stepOperation,
  workflow.resilience,
  workflow.compositionOrder,
  executionContext.signal,
  {
    workflowId: execution.id,
    stepId: step.id,
    correlationId: execution.correlationId,
  },
)
```

## Contributing

See the main [@orchestr8 repository](../../README.md) for development guidelines.

## License

MIT - See [LICENSE](../../LICENSE) for details.
