# Resilience Pattern Composition Order Guide

> Last Updated: 2025-08-20  
> Version: 1.0.0

## Overview

The @orchestr8/resilience package supports two composition orders for combining retry, circuit breaker, and timeout patterns. The order in which these patterns are applied significantly affects the behavior and characteristics of your resilience strategy.

## Supported Composition Orders

### 1. `retry-cb-timeout` (Default)

**Pattern Stack:** `Retry → Circuit Breaker → Timeout → Operation`

Each retry attempt goes through the circuit breaker and timeout individually.

### 2. `timeout-cb-retry`

**Pattern Stack:** `Timeout → Circuit Breaker → Retry → Operation`

A single timeout applies to the entire retry sequence.

## When to Use Each Order

### Use `retry-cb-timeout` When

✅ **Individual timeout per attempt is desired**

- Each retry attempt should have its own timeout boundary
- You want to prevent individual slow operations from consuming excessive time
- Network operations where connection timeouts should be per-attempt

✅ **Circuit breaker should react to each retry**

- Circuit breaker monitors each individual retry attempt
- Faster circuit opening on repeated failures within retry sequences
- Better circuit state accuracy with high-frequency failures

✅ **Default choice for most scenarios**

- Provides balanced behavior for typical microservice interactions
- Good for API calls, database operations, and external service integrations

#### Example Scenarios

```typescript
// API calls with per-request timeouts
const policy = {
  retry: { maxAttempts: 3, initialDelay: 100 },
  circuitBreaker: { failureThreshold: 0.5, recoveryTime: 30000 },
  timeout: 5000, // 5s timeout per attempt
}

// Behavior: attempt1(5s) → retry → attempt2(5s) → retry → attempt3(5s)
// Total possible time: 15s + retry delays
```

### Use `timeout-cb-retry` When

✅ **Strict overall time bounds are required**

- SLA requirements demand total operation completion within X seconds
- Preventing retry storms that could exceed business deadlines
- Critical path operations with hard time constraints

✅ **Batched or bulk operations**

- Operations that naturally take longer and should retry as a unit
- File processing, data migrations, report generation
- Operations where partial progress is expensive to abandon

✅ **Resource-intensive operations**

- Operations with significant startup/setup costs
- Database transactions that are expensive to restart
- Operations that consume limited resources (connection pools, rate limits)

#### Example Scenarios

```typescript
// SLA-critical operations
const policy = {
  retry: { maxAttempts: 5, initialDelay: 200 },
  circuitBreaker: { failureThreshold: 0.7, recoveryTime: 60000 },
  timeout: 10000, // 10s total timeout for all attempts
}

// Behavior: timeout(10s) encompasses all retries
// Total guaranteed time: ≤ 10s regardless of retry count
```

## Behavioral Differences

### Circuit Breaker Interaction

| Aspect                | `retry-cb-timeout`        | `timeout-cb-retry`         |
| --------------------- | ------------------------- | -------------------------- |
| **Circuit checks**    | Per retry attempt         | Once before retry sequence |
| **Failure recording** | Each attempt recorded     | Only final result recorded |
| **Opening speed**     | Faster (more data points) | Slower (fewer data points) |
| **State accuracy**    | Higher for rapid failures | Lower for rapid failures   |

### Timeout Behavior

| Aspect             | `retry-cb-timeout`            | `timeout-cb-retry`            |
| ------------------ | ----------------------------- | ----------------------------- |
| **Scope**          | Per individual attempt        | Entire retry sequence         |
| **Total time**     | `timeout × attempts + delays` | `≤ timeout` always            |
| **Cancellation**   | Individual attempt only       | Entire operation              |
| **Predictability** | Less predictable total time   | Highly predictable total time |

### Retry Characteristics

| Aspect                | `retry-cb-timeout`          | `timeout-cb-retry`           |
| --------------------- | --------------------------- | ---------------------------- |
| **Attempt isolation** | High (each has own timeout) | Low (shared timeout budget)  |
| **Retry budget**      | May use all attempts        | May be cut short by timeout  |
| **Backoff respect**   | Always honors delays        | May skip delays near timeout |
| **Resource usage**    | Potentially higher          | Bounded by timeout           |

## Performance Considerations

### Latency Patterns

**`retry-cb-timeout`:**

```
Attempt 1: ████████░░ (timeout)
Delay:     ██
Attempt 2: ████████░░ (timeout)
Delay:     ████
Attempt 3: ████████░░ (timeout)
Total:     ██████████████████████
```

**`timeout-cb-retry`:**

```
Timeout:   ██████████ (covers all)
Attempt 1: ████████░░ (timeout kills all)
Result:    ██████████ (bounded)
```

### Resource Consumption

| Resource                | `retry-cb-timeout`          | `timeout-cb-retry`     |
| ----------------------- | --------------------------- | ---------------------- |
| **Memory**              | Higher (multiple timeouts)  | Lower (single timeout) |
| **Timers**              | Multiple active timers      | Single timer           |
| **Network connections** | Longer-lived                | Shorter-lived          |
| **CPU**                 | Higher (more orchestration) | Lower (simpler flow)   |

## Anti-Patterns and Common Mistakes

### ❌ Anti-Pattern 1: Wrong Order for SLA Requirements

```typescript
// WRONG: For 5-second SLA requirement
const policy = {
  retry: { maxAttempts: 10, initialDelay: 1000 },
  circuitBreaker: { failureThreshold: 0.5 },
  timeout: 2000
}
const order = 'retry-cb-timeout' // Could take 20+ seconds!

// CORRECT:
const order = 'timeout-cb-retry'
const policy = { timeout: 5000, ... } // Guarantees ≤ 5s
```

### ❌ Anti-Pattern 2: Wrong Order for Fast Failure Detection

```typescript
// WRONG: For rapid circuit breaker response
const policy = {
  retry: { maxAttempts: 20, initialDelay: 50 },
  circuitBreaker: { failureThreshold: 0.3, sampleSize: 10 },
}
const order = 'timeout-cb-retry' // CB sees fewer data points

// CORRECT:
const order = 'retry-cb-timeout' // CB sees all 20 attempts
```

### ❌ Anti-Pattern 3: Inappropriate Timeout Scope

```typescript
// WRONG: Database transaction with per-attempt timeout
const policy = {
  retry: { maxAttempts: 3 },
  timeout: 100, // Too short for DB transaction setup
}
const order = 'retry-cb-timeout' // Wastes transaction setup time

// CORRECT:
const order = 'timeout-cb-retry' // Single transaction, bounded time
const policy = { timeout: 5000 } // Reasonable for transaction
```

## Decision Matrix

Use this matrix to choose the appropriate composition order:

| Scenario           | Time Bounds | Failure Sensitivity | Resource Cost | Recommended Order  |
| ------------------ | ----------- | ------------------- | ------------- | ------------------ |
| API Gateway        | Moderate    | High                | Low           | `retry-cb-timeout` |
| Database Query     | Flexible    | Medium              | Medium        | `retry-cb-timeout` |
| File Upload        | Strict      | Low                 | High          | `timeout-cb-retry` |
| Payment Processing | Strict      | High                | High          | `timeout-cb-retry` |
| Health Check       | Moderate    | High                | Low           | `retry-cb-timeout` |
| Report Generation  | Strict      | Low                 | High          | `timeout-cb-retry` |
| Cache Lookup       | Flexible    | High                | Low           | `retry-cb-timeout` |
| Message Publishing | Moderate    | Medium              | Medium        | `retry-cb-timeout` |

## Configuration Examples

### High-Frequency, Low-Latency Operations

```typescript
// Web API calls, cache operations, health checks
const config = {
  retry: {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    initialDelay: 100,
    maxDelay: 500,
    jitterStrategy: 'full',
  },
  circuitBreaker: {
    failureThreshold: 0.5,
    recoveryTime: 30000,
    sampleSize: 20,
    halfOpenPolicy: 'single-probe',
  },
  timeout: 2000,
}
const order = 'retry-cb-timeout'
```

### SLA-Critical Operations

```typescript
// Payment processing, order fulfillment, critical workflows
const config = {
  retry: {
    maxAttempts: 5,
    backoffStrategy: 'exponential',
    initialDelay: 200,
    maxDelay: 1000,
    jitterStrategy: 'full',
  },
  circuitBreaker: {
    failureThreshold: 0.7,
    recoveryTime: 60000,
    sampleSize: 10,
    halfOpenPolicy: 'single-probe',
  },
  timeout: 10000, // Hard 10s SLA limit
}
const order = 'timeout-cb-retry'
```

### Bulk/Batch Operations

```typescript
// File processing, data synchronization, report generation
const config = {
  retry: {
    maxAttempts: 3,
    backoffStrategy: 'fixed',
    initialDelay: 1000,
    maxDelay: 1000,
    jitterStrategy: 'none',
  },
  circuitBreaker: {
    failureThreshold: 0.8,
    recoveryTime: 120000,
    sampleSize: 5,
    halfOpenPolicy: 'single-probe',
  },
  timeout: 300000, // 5 minute limit for batch job
}
const order = 'timeout-cb-retry'
```

## Migration Between Orders

When changing composition orders in existing systems:

1. **Measure Current Behavior**
   - Monitor P95/P99 latencies
   - Track circuit breaker state changes
   - Measure failure rates and recovery times

2. **Gradual Rollout**
   - Use feature flags to control composition order
   - Start with low-traffic services
   - Monitor metrics for regressions

3. **Update Monitoring**
   - Adjust alerting thresholds for new timeout behavior
   - Update dashboards for new latency patterns
   - Verify circuit breaker metrics remain meaningful

## Best Practices

### ✅ Configuration Guidelines

1. **Set appropriate timeouts for your order**
   - `retry-cb-timeout`: Set per-attempt timeout based on normal operation time
   - `timeout-cb-retry`: Set total timeout based on SLA requirements

2. **Align circuit breaker thresholds**
   - `retry-cb-timeout`: Lower thresholds for faster failure detection
   - `timeout-cb-retry`: Higher thresholds to account for fewer data points

3. **Consider retry delays**
   - `retry-cb-timeout`: Shorter delays since each attempt is bounded
   - `timeout-cb-retry`: Be mindful that delays consume timeout budget

### ✅ Monitoring and Observability

1. **Track composition-specific metrics**
   - Total operation time vs. attempt times
   - Circuit breaker state transition frequency
   - Timeout vs. retry exhaustion rates

2. **Use composition-aware alerts**
   - Different alert thresholds for each composition order
   - Monitor for composition order-specific anti-patterns

3. **Document your choice**
   - Include composition order rationale in service documentation
   - Update runbooks with order-specific troubleshooting steps

## Troubleshooting

### Common Issues by Composition Order

**`retry-cb-timeout` Issues:**

- Operations taking longer than expected (multiple timeouts)
- Circuit breaker opening too aggressively
- Resource exhaustion from concurrent timeouts

**`timeout-cb-retry` Issues:**

- Retries being cut short by timeout
- Circuit breaker not opening when expected
- SLA violations due to insufficient timeout budget

### Debug Checklist

1. **Verify composition order is as intended**
2. **Check timeout values match composition strategy**
3. **Ensure circuit breaker thresholds align with pattern frequency**
4. **Monitor actual vs. expected timing behavior**
5. **Validate retry delays don't exceed timeout budget (timeout-cb-retry)**

---

**Need Help?**

- Check the test files for working examples of both composition orders
- Review the `composition.test.ts` file for behavioral differences
- See `production-adapter.test.ts` for real-world usage patterns
