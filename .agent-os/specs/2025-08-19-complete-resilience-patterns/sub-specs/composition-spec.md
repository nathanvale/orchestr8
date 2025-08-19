# Composition Order Specification

> Created: 2025-08-19
> Version: 1.0.0

## Overview

Specification for implementing proper composition order of resilience patterns in @orchestr8/resilience.

## Composition Semantics - Clarified

**Important**: We implement Option A (minimal) - the circuit breaker's observation point depends on where it sits in the composition chain.

### retry-cb-timeout

Order: `retry(circuitBreaker(timeout(operation)))`

**Circuit Breaker Behavior**: Sees EACH retry attempt individually

```
┌─────────────────────────────────────┐
│           RETRY LAYER               │
│  ┌─────────────────────────────┐   │
│  │    CIRCUIT BREAKER LAYER    │   │
│  │  ┌───────────────────────┐  │   │
│  │  │    TIMEOUT LAYER      │  │   │
│  │  │  ┌─────────────────┐  │  │   │
│  │  │  │   OPERATION     │  │  │   │
│  │  │  └─────────────────┘  │  │   │
│  │  └───────────────────────┘  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Execution Flow:**

1. Retry wrapper receives request
2. For each retry attempt:
   - Check circuit breaker state (CB sees this attempt)
   - If closed/half-open, apply timeout to operation
   - If timeout or operation fails, CB records this individual failure
   - If circuit breaker opens, subsequent retries fail immediately
3. Continue until success or retry exhaustion

**Key Point**: Each retry attempt is a separate transaction through the circuit breaker. If 3 retries fail, the CB records 3 failures.

**Use Case:** Best for transient failures where you want to retry but prevent overwhelming a failing service.

### timeout-cb-retry

Order: `timeout(circuitBreaker(retry(operation)))`

**Circuit Breaker Behavior**: Sees ONLY the final outcome of the entire retry sequence

```
┌─────────────────────────────────────┐
│         TIMEOUT LAYER               │
│  ┌─────────────────────────────┐   │
│  │    CIRCUIT BREAKER LAYER    │   │
│  │  ┌───────────────────────┐  │   │
│  │  │     RETRY LAYER       │  │   │
│  │  │  ┌─────────────────┐  │  │   │
│  │  │  │   OPERATION     │  │  │   │
│  │  │  └─────────────────┘  │  │   │
│  │  └───────────────────────┘  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Execution Flow:**

1. Timeout wrapper starts timer for entire operation
2. Circuit breaker checks state once
3. If closed/half-open, retry layer executes:
   - Multiple attempts within the overall timeout
   - Individual retry failures are NOT seen by CB
4. CB records success if ANY retry succeeds, failure only if ALL retries fail
5. If timeout expires, entire retry sequence is cancelled and CB records one failure

**Key Point**: The circuit breaker treats the entire retry sequence as a single operation. Even if retries fail 3 times internally, CB only records 1 failure total.

**Use Case:** Best when you have a strict SLA and need the entire operation (including retries) to complete within a time bound.

## Implementation Pattern

### Middleware Approach

```typescript
type Middleware<T> = (next: () => Promise<T>) => () => Promise<T>

class ResilienceComposer {
  compose<T>(
    operation: () => Promise<T>,
    policies: ResiliencePolicy,
    order: CompositionOrder,
    signal?: AbortSignal,
  ): () => Promise<T> {
    const middlewares = this.buildMiddlewareStack(policies, order, signal)

    // Apply middlewares from right to left (innermost to outermost)
    return middlewares.reduceRight(
      (next, middleware) => middleware(next),
      operation,
    )
  }

  private buildMiddlewareStack(
    policies: ResiliencePolicy,
    order: CompositionOrder,
    signal?: AbortSignal,
  ): Middleware<any>[] {
    const stack: Middleware<any>[] = []

    // Parse order string to determine layering
    const layers = this.parseOrder(order)

    // Build middleware stack in reverse order (innermost first)
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]

      switch (layer) {
        case 'retry':
          if (policies.retry) {
            stack.push(this.createRetryMiddleware(policies.retry, signal))
          }
          break

        case 'cb':
          if (policies.circuitBreaker) {
            stack.push(
              this.createCircuitBreakerMiddleware(
                policies.circuitBreaker,
                signal,
              ),
            )
          }
          break

        case 'timeout':
          if (policies.timeout) {
            stack.push(this.createTimeoutMiddleware(policies.timeout, signal))
          }
          break
      }
    }

    return stack
  }

  private parseOrder(order: CompositionOrder): string[] {
    // 'retry-cb-timeout' → ['retry', 'cb', 'timeout']
    return order.split('-')
  }
}
```

## Middleware Implementations

### Retry Middleware

```typescript
private createRetryMiddleware(
  config: RetryConfig,
  signal?: AbortSignal
): Middleware<any> {
  return (next: () => Promise<any>) => {
    return async () => {
      let lastError: Error | undefined

      for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        if (signal?.aborted) {
          throw new Error('Operation cancelled')
        }

        try {
          return await next()
        } catch (error) {
          lastError = error as Error

          // Don't retry on circuit breaker open errors
          if (error instanceof CircuitBreakerOpenError) {
            throw error
          }

          if (attempt < config.maxAttempts) {
            const delay = this.calculateDelay(attempt, config)
            await this.sleep(delay, signal)
          }
        }
      }

      throw lastError || new Error('All retry attempts failed')
    }
  }
}
```

### Circuit Breaker Middleware

```typescript
private createCircuitBreakerMiddleware(
  config: CircuitBreakerConfig,
  signal?: AbortSignal
): Middleware<any> {
  return (next: () => Promise<any>) => {
    return async () => {
      const state = this.circuitBreaker.getState(config.key)

      // Check if circuit is open
      if (state.status === 'open') {
        if (Date.now() >= state.nextHalfOpenTime) {
          this.circuitBreaker.transitionToHalfOpen(config.key)
        } else {
          throw new CircuitBreakerOpenError(state.nextHalfOpenTime)
        }
      }

      // Check if half-open and already probing
      if (state.status === 'half-open' && state.probing) {
        throw new CircuitBreakerOpenError(state.nextHalfOpenTime)
      }

      try {
        const result = await next()
        this.circuitBreaker.recordSuccess(config.key)
        return result
      } catch (error) {
        this.circuitBreaker.recordFailure(config.key)
        throw error
      }
    }
  }
}
```

### Timeout Middleware

```typescript
private createTimeoutMiddleware(
  timeoutMs: number,
  signal?: AbortSignal
): Middleware<any> {
  return (next: () => Promise<any>) => {
    return async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        timeoutMs
      )

      // Combine with parent signal if provided
      const combinedSignal = signal
        ? this.combineSignals([signal, controller.signal])
        : controller.signal

      try {
        // Pass abort signal down the chain
        const result = await Promise.race([
          next(),
          this.createTimeoutPromise(timeoutMs, combinedSignal)
        ])

        clearTimeout(timeoutId)
        return result
      } catch (error) {
        clearTimeout(timeoutId)

        if (controller.signal.aborted && !signal?.aborted) {
          throw new TimeoutError(`Operation timed out after ${timeoutMs}ms`)
        }
        throw error
      }
    }
  }
}
```

## Signal Propagation

### Combining Abort Signals

```typescript
private combineSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort()
      break
    }

    signal.addEventListener('abort', () => {
      controller.abort()
    }, { once: true })
  }

  return controller.signal
}
```

### Passing Signals Through Layers

Each middleware must:

1. Check for cancellation at entry
2. Pass signal to next layer
3. Clean up on cancellation
4. Distinguish timeout from external cancellation

## Error Context Preservation

### Error Wrapping

```typescript
class ResilienceError extends Error {
  constructor(
    message: string,
    public readonly cause: Error,
    public readonly pattern: string,
    public readonly attempt?: number
  ) {
    super(message)
    this.name = 'ResilienceError'
    this.stack = cause.stack // Preserve original stack
  }
}

// In retry middleware
catch (error) {
  if (attempt === config.maxAttempts) {
    throw new ResilienceError(
      `Retry exhausted after ${attempt} attempts`,
      error as Error,
      'retry',
      attempt
    )
  }
}
```

## Testing Composition Order

### Verify Execution Order

```typescript
it('should execute retry-cb-timeout with CB seeing each attempt', async () => {
  const executionOrder: Array<string> = []
  const cbFailureCount = { count: 0 }

  const operation = vi.fn().mockImplementation(async () => {
    executionOrder.push('operation')
    throw new Error('fail')
  })

  const adapter = new ResilienceAdapter({
    onRetryAttempt: () => executionOrder.push('retry'),
    onCircuitCheck: () => executionOrder.push('circuit'),
    onTimeoutStart: () => executionOrder.push('timeout'),
  })

  const policy: ResiliencePolicy = {
    retry: { maxAttempts: 2 },
    circuitBreaker: { failureThreshold: 5 },
    timeout: 1000,
  }

  await expect(
    adapter.applyNormalizedPolicy(operation, policy, 'retry-cb-timeout'),
  ).rejects.toThrow()

  expect(executionOrder).toEqual([
    'retry', // First retry attempt
    'circuit', // CB checks state and records attempt
    'timeout', // Apply timeout
    'operation', // Execute operation
    'circuit-record-failure', // CB records this failure
    'retry', // Second retry attempt
    'circuit', // CB checks state and records attempt
    'timeout', // Apply timeout
    'operation', // Execute operation
    'circuit-record-failure', // CB records this failure
  ])
})
```

### Verify Different Behaviors

```typescript
it('should behave differently with timeout-cb-retry order', async () => {
  let operationCount = 0
  const cbFailureCount = { count: 0 }

  const slowOperation = async () => {
    operationCount++
    await sleep(100)
    throw new Error('fail')
  }

  // Circuit breaker mock that counts failures
  const mockCB = {
    onFailure: () => cbFailureCount.count++,
  }

  const policy: ResiliencePolicy = {
    retry: { maxAttempts: 10 },
    timeout: 150, // Only allows ~1 retry within timeout
  }

  await expect(
    adapter.applyNormalizedPolicy(slowOperation, policy, 'timeout-cb-retry'),
  ).rejects.toThrow(TimeoutError)

  // With timeout wrapping retry, only 1-2 attempts possible
  expect(operationCount).toBeLessThanOrEqual(2)

  // CB only sees final failure of entire retry sequence
  expect(cbFailureCount.count).toBe(1) // Only 1 failure recorded by CB
})
```
