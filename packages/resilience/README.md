# @orchestr8/resilience

Production-ready resilience patterns for the @orchestr8 orchestration platform. Provides retry, circuit breaker, and timeout patterns with flexible composition strategies.

## Features

- 🔄 **Retry** - Exponential/fixed backoff with jitter and custom retry predicates
- ⚡ **Circuit Breaker** - Sliding window failure detection with half-open recovery
- ⏰ **Timeout** - Configurable operation timeouts with clean cancellation
- 🔧 **Composition** - Flexible pattern ordering (retry-cb-timeout, timeout-cb-retry)
- 📊 **Observability** - Performance metrics, telemetry events, and structured logging
- 🛡️ **Enhanced Error Types** - Specialized errors with backward compatibility
- ✅ **Configuration Validation** - Runtime validation with detailed error messages
- 🧠 **Memory Management** - Deterministic LRU eviction and async cleanup
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
  failureThreshold: number // Failure count (≥1) or rate (0-1) to open circuit
  recoveryTime: number // Time before attempting recovery (ms)
  sampleSize: number // Size of sliding window (minimum: 10)
  halfOpenPolicy: 'single-probe' | 'gradual'
}
```

**Example: Service-specific circuit breaker**

```typescript
const circuitConfig = {
  key: 'user-service', // Explicit key for isolation
  failureThreshold: 0.5, // Open at 50% failure rate (or 5 if using count)
  recoveryTime: 30000, // Wait 30s before recovery attempt
  sampleSize: 10, // Track last 10 outcomes (minimum enforced)
  halfOpenPolicy: 'single-probe', // Only one recovery test at a time
}
```

> **Note**: `sampleSize` must be at least 10 for statistical significance. Configuration is validated at runtime using Zod schemas.

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

The package provides enhanced error types for different failure scenarios with full backward compatibility:

```typescript
import {
  CircuitBreakerOpenError,
  CircuitBreakerTimeoutError,
  CircuitBreakerThresholdError,
  CircuitBreakerRecoveryError,
  RetryExhaustedError,
  TimeoutError,
  isCircuitBreakerOpenError,
} from '@orchestr8/resilience'

// Circuit breaker is open
if (isCircuitBreakerOpenError(error)) {
  console.log(`Retry after: ${error.retryAfter}ms`)
  console.log(`Consecutive failures: ${error.consecutiveFailures}`)
}

// Circuit opened due to threshold exceeded (enhanced error)
if (error instanceof CircuitBreakerThresholdError) {
  console.log(
    `Threshold exceeded: ${error.failures}/${error.sampleSize} failures`,
  )
  console.log(`Failure rate: ${(error.failureRate * 100).toFixed(1)}%`)
  console.log(`Threshold: ${error.threshold}`)
}

// Circuit breaker timeout during recovery
if (error instanceof CircuitBreakerTimeoutError) {
  console.log(`Circuit breaker timed out during recovery attempt`)
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

### Enhanced Error Features

- **Backward Compatibility**: All existing error handling code continues to work
- **Detailed Context**: Enhanced errors provide failure rates, thresholds, and sample sizes
- **Type Safety**: Proper inheritance with TypeScript support
- **Debugging**: Rich error messages with operational context

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

### Performance Metrics and Observability

The enhanced circuit breaker provides comprehensive performance tracking:

```typescript
import { CircuitBreaker } from '@orchestr8/resilience'

const circuitBreaker = new CircuitBreaker(config, observer, telemetry)

// Get performance metrics for a specific circuit
const metrics = circuitBreaker.getPerformanceMetrics('user-service')
if (metrics) {
  console.log(`Operations: ${metrics.totalOperations}`)
  console.log(`Average duration: ${metrics.averageDuration}ms`)
  console.log(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`)
  console.log(`Failures: ${metrics.failures}`)
}

// Get all performance metrics
const allMetrics = circuitBreaker.getAllPerformanceMetrics()
for (const [key, metrics] of allMetrics) {
  console.log(`Circuit ${key}: ${metrics.successRate * 100}% success`)
}
```

### Configuration Validation

Runtime validation ensures configuration correctness:

```typescript
import { validateCircuitBreakerConfig } from '@orchestr8/resilience'

try {
  const config = {
    sampleSize: 5, // Too small!
    failureThreshold: 2.5, // Invalid for count-based
    recoveryTime: -1000, // Negative!
  }

  const validatedConfig = validateCircuitBreakerConfig(config)
} catch (error) {
  console.log('Configuration errors:', error.message)
  // Output: Invalid sampleSize: must be at least 10
}
```

### Standalone Pattern Usage

You can also use individual patterns directly:

```typescript
import { CircuitBreaker, RetryWrapper } from '@orchestr8/resilience'

// Direct circuit breaker usage with validation
const circuitBreaker = new CircuitBreaker(
  { failureThreshold: 0.5, recoveryTime: 30000, sampleSize: 10 }, // Auto-validated
  observer,
  telemetry,
)

const result = await circuitBreaker.execute('my-service', async () => {
  return await fetch('/api/data')
})

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
- **Cleanup**: Deterministic LRU eviction with async cleanup (60s intervals)
- **Metrics**: Low-overhead performance tracking with minimal memory impact
- **Validation**: Runtime config validation with <0.1ms overhead

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
- Minimum 10 samples required for statistical significance
- Supports both count-based (≥1) and rate-based (0-1) thresholds

### Half-Open State Management

- Single-probe policy prevents thundering herd
- Concurrent requests during probe are rejected
- Successful probe closes circuit immediately
- Failed probe returns to open state

### Memory Management

Advanced memory management prevents resource leaks:

- **Deterministic LRU Eviction**: Oldest unused circuits removed when limit reached
- **Async Cleanup**: Non-blocking cleanup every 60 seconds using chunked processing
- **Bounded State**: Maximum 1000 circuit instances prevent memory exhaustion
- **Access Tracking**: Automatic lastAccessTime updates for intelligent eviction
- **Expired Circuit Removal**: Circuits unused for 10x recoveryTime are cleaned up

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
