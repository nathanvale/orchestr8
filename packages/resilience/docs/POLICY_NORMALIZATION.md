# Policy Normalization Guide

This document explains how resilience policies are normalized with default values and how the composition patterns work internally.

## Overview

The resilience adapter normalizes all policies to ensure consistent behavior and fill in default values for optional configuration parameters. This process happens automatically when you call `applyNormalizedPolicy()` or the legacy `applyPolicy()` method.

## Default Values

### Retry Configuration Defaults

```typescript
interface RetryConfig {
  maxAttempts: number // Default: 3
  backoffStrategy: string // Default: 'exponential'
  jitterStrategy: string // Default: 'full'
  initialDelay: number // Default: 100ms
  maxDelay: number // Default: 5000ms
  retryOn?: function // Default: undefined (uses built-in predicate)
}
```

**Default Retry Policy:**

```typescript
const defaultRetry = {
  maxAttempts: 3,
  backoffStrategy: 'exponential',
  jitterStrategy: 'full',
  initialDelay: 100, // 100ms
  maxDelay: 5000, // 5 seconds
  retryOn: undefined, // Uses default: retry all except CircuitBreakerOpenError
}
```

### Circuit Breaker Configuration Defaults

```typescript
interface CircuitBreakerConfig {
  key?: string // Default: undefined (derives from context)
  failureThreshold: number // Default: 5
  recoveryTime: number // Default: 30000ms (30 seconds)
  sampleSize: number // Default: 10
  halfOpenPolicy: string // Default: 'single-probe'
}
```

**Default Circuit Breaker Policy:**

```typescript
const defaultCircuitBreaker = {
  key: undefined, // Will be derived as `${workflowId}:${stepId}`
  failureThreshold: 5, // Open after 5 failures
  recoveryTime: 30000, // Wait 30 seconds before half-open attempt
  sampleSize: 10, // Track last 10 operation outcomes
  halfOpenPolicy: 'single-probe', // Only one probe request in half-open state
}
```

### Timeout Configuration

```typescript
interface TimeoutConfig {
  duration: number // Required - no default
  operationName?: string // Default: undefined
}
```

**Note:** Timeout duration is **required** and has no default value. You must specify a timeout duration explicitly.

## Policy Transformation Logic

### Jitter Strategy Mapping

The normalization process handles legacy jitter strategy names:

```typescript
// Legacy format → Normalized format
'none'        → 'none'
'full-jitter' → 'full'
'full'        → 'full'
undefined     → 'full'   // Default when not specified
```

**Example transformation:**

```typescript
// Input policy
const legacyPolicy = {
  retry: {
    maxAttempts: 5,
    jitterStrategy: 'full-jitter', // Legacy format
  },
}

// Normalized policy
const normalized = {
  retry: {
    maxAttempts: 5,
    backoffStrategy: 'exponential', // Default applied
    jitterStrategy: 'full', // Legacy mapped to new format
    initialDelay: 100, // Default applied
    maxDelay: 5000, // Default applied
  },
}
```

### Timeout Policy Mapping

Timeout policies support both object and number formats:

```typescript
// Number format (legacy)
const policy1 = { timeout: 5000 }

// Object format (preferred)
const policy2 = {
  timeout: {
    duration: 5000,
    operationName: 'fetchUserData',
  },
}

// Both normalize to:
const normalized = {
  timeout: {
    duration: 5000,
    operationName: undefined, // Only set if provided in object format
  },
}
```

## Composition Patterns

The resilience adapter supports two validated composition patterns that determine how patterns are layered:

### retry-cb-timeout Pattern (Recommended)

**Execution Order:** `retry(circuitBreaker(timeout(operation)))`

```
┌─────────┐    ┌──────────────┐    ┌─────────┐    ┌───────────┐
│ Retry   │ -> │ Circuit      │ -> │ Timeout │ -> │ Operation │
│ Wrapper │    │ Breaker      │    │ Wrapper │    │           │
└─────────┘    └──────────────┘    └─────────┘    └───────────┘
```

**Behavior:**

- Each retry attempt goes through the circuit breaker
- Individual operations are bounded by timeout
- Circuit breaker can prevent retries if service is consistently failing
- If circuit is open, retry won't even attempt the operation

**Best for:**

- External service calls
- API requests
- Database operations
- Network I/O operations

**Example:**

```typescript
await adapter.applyNormalizedPolicy(
  fetchUserProfile,
  {
    retry: { maxAttempts: 3, initialDelay: 100 },
    circuitBreaker: { failureThreshold: 5, recoveryTime: 30000 },
    timeout: { duration: 5000 },
  },
  'retry-cb-timeout',
)
```

**Execution Flow:**

1. Retry wrapper starts attempt 1
2. Circuit breaker checks state (closed initially)
3. Timeout wrapper starts 5-second timer
4. Operation executes with timeout
5. If operation fails, circuit breaker records failure
6. Retry wrapper starts attempt 2 (if under maxAttempts)
7. Circuit breaker checks state again (still closed if under threshold)
8. Process repeats until success, circuit opens, or retries exhausted

### timeout-cb-retry Pattern

**Execution Order:** `timeout(circuitBreaker(retry(operation)))`

```
┌─────────┐    ┌──────────────┐    ┌─────────┐    ┌───────────┐
│ Timeout │ -> │ Circuit      │ -> │ Retry   │ -> │ Operation │
│ Wrapper │    │ Breaker      │    │ Wrapper │    │           │
└─────────┘    └──────────────┘    └─────────┘    └───────────┘
```

**Behavior:**

- Entire retry sequence is bounded by a single timeout
- Circuit breaker wraps the complete retry logic
- All retry attempts must complete within the timeout duration
- Circuit breaker state is checked once before starting retry sequence

**Best for:**

- Batch operations
- Background processing tasks
- Operations where total execution time is more important than individual attempt time
- Scenarios where you want to limit total time spent on an operation

**Example:**

```typescript
await adapter.applyNormalizedPolicy(
  processBatchJob,
  {
    timeout: { duration: 30000 }, // 30 seconds total
    circuitBreaker: { failureThreshold: 3, recoveryTime: 60000 },
    retry: { maxAttempts: 5, initialDelay: 1000 },
  },
  'timeout-cb-retry',
)
```

**Execution Flow:**

1. Timeout wrapper starts 30-second timer for entire operation
2. Circuit breaker checks state (must be closed to proceed)
3. Retry wrapper starts attempt 1
4. Operation executes (no individual timeout)
5. If operation fails, retry wrapper waits and tries again
6. All retry attempts must complete within the 30-second timeout
7. Circuit breaker records final outcome (success or failure)

## Jitter Strategies

Jitter prevents the "thundering herd" problem where multiple clients retry simultaneously.

### 'none' Strategy

No jitter is applied - delays are used exactly as calculated:

```typescript
function applyJitter(delay: number, jitterStrategy: 'none'): number {
  return delay // No modification
}
```

**Example:**

```typescript
// With exponential backoff and no jitter
const delays = [100, 200, 400, 800, 1600] // Predictable progression
```

**Use when:**

- Testing scenarios where you need predictable timing
- Single-client scenarios where thundering herd isn't a concern
- Debugging retry behavior

### 'full' Strategy (Recommended)

Full jitter randomizes the delay between 0 and the calculated delay:

```typescript
function applyJitter(delay: number, jitterStrategy: 'full'): number {
  return Math.random() * delay // Random value between 0 and delay
}
```

**Mathematical Formula:**

```
actualDelay = random(0, calculatedDelay)
where random(0, n) returns a uniform random number between 0 and n
```

**Example:**

```typescript
// With exponential backoff and full jitter
const calculatedDelays = [100, 200, 400, 800, 1600]
const actualDelays = [67, 156, 89, 234, 1203] // Randomized
```

**Benefits:**

- Spreads retry attempts across time
- Reduces server load spikes during outages
- Prevents synchronized retry storms
- Maintains exponential backoff benefits while adding randomness

**Use when:**

- Multiple clients might be retrying simultaneously
- Production environments (recommended default)
- High-traffic scenarios

## Backoff Calculations

Backoff strategies determine how delays increase between retry attempts.

### Fixed Backoff

Uses the same delay for all retry attempts:

```typescript
function calculateDelay(attempt: number, config: RetryConfig): number {
  return config.initialDelay // Always the same
}
```

**Formula:**

```
delay = initialDelay (for all attempts)
```

**Example:**

```typescript
const config = {
  backoffStrategy: 'fixed',
  initialDelay: 500,
  maxDelay: 5000,
}

// Delays for attempts 1, 2, 3, 4, 5
const delays = [500, 500, 500, 500, 500] // Constant
```

**Use when:**

- Simple, predictable retry behavior is desired
- The failure cause is unlikely to be load-related
- Testing scenarios

### Exponential Backoff (Recommended)

Doubles the delay with each attempt (exponential growth):

```typescript
function calculateExponentialDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
): number {
  const exponentialDelay = initialDelay * Math.pow(2, attempt - 1)
  return Math.min(exponentialDelay, maxDelay)
}
```

**Mathematical Formula:**

```
delay = min(initialDelay * 2^(attempt-1), maxDelay)

Where:
- attempt starts at 1 for the first retry
- 2^(attempt-1) creates the exponential progression
- min() caps the delay at maxDelay
```

**Example:**

```typescript
const config = {
  backoffStrategy: 'exponential',
  initialDelay: 100,
  maxDelay: 5000,
}

// Delays for attempts 1, 2, 3, 4, 5, 6, 7
const delays = [100, 200, 400, 800, 1600, 3200, 5000]
//                                            ^^^^ capped at maxDelay
```

**Progression Visualization:**

```
Attempt 1: 100ms  = 100 * 2^0 = 100 * 1
Attempt 2: 200ms  = 100 * 2^1 = 100 * 2
Attempt 3: 400ms  = 100 * 2^2 = 100 * 4
Attempt 4: 800ms  = 100 * 2^3 = 100 * 8
Attempt 5: 1600ms = 100 * 2^4 = 100 * 16
Attempt 6: 3200ms = 100 * 2^5 = 100 * 32
Attempt 7: 5000ms = min(100 * 2^6, 5000) = min(6400, 5000) = 5000
```

**Benefits:**

- Gives transient issues time to resolve
- Reduces load on struggling services
- Balances quick recovery with system protection
- Industry standard approach

**Combined with Jitter:**

```typescript
// Full example with exponential backoff + full jitter
function calculateDelayWithJitter(
  attempt: number,
  config: RetryConfig,
): number {
  // Calculate base exponential delay
  const baseDelay = Math.min(
    config.initialDelay * Math.pow(2, attempt - 1),
    config.maxDelay,
  )

  // Apply jitter
  if (config.jitterStrategy === 'full') {
    return Math.random() * baseDelay
  }

  return baseDelay
}

// Example results for attempt 3:
// Base delay: 400ms
// With full jitter: anywhere from 0ms to 400ms (e.g., 237ms)
```

## Error Handling During Normalization

### Invalid Configuration Detection

The normalization process validates configuration values:

```typescript
// These would be rejected during validation (if implemented)
const invalidConfigs = [
  { retry: { maxAttempts: 0 } }, // Must be > 0
  { retry: { initialDelay: -100 } }, // Must be >= 0
  { circuitBreaker: { failureThreshold: 0 } }, // Must be > 0
  { timeout: { duration: 0 } }, // Must be > 0
]
```

### Legacy Format Handling

The normalization gracefully handles legacy formats:

```typescript
// These legacy formats are automatically converted
const legacyFormats = {
  // String timeout (legacy) → object timeout (normalized)
  timeout: 5000,

  // Old jitter name → new jitter name
  retry: { jitterStrategy: 'full-jitter' },
}
```

## Best Practices

### 1. Choose Appropriate Defaults

For most use cases, the defaults provide good production behavior:

```typescript
// Minimal configuration - relies on defaults
const minimalPolicy = {
  retry: { maxAttempts: 3 },
  circuitBreaker: { failureThreshold: 5 },
  timeout: { duration: 5000 }, // Only required field
}
```

### 2. Tune for Your Use Case

Adjust based on your service characteristics:

```typescript
// High-frequency, low-latency service
const highFrequencyPolicy = {
  retry: {
    maxAttempts: 2, // Fewer retries
    initialDelay: 50, // Shorter delays
    maxDelay: 500,
  },
  circuitBreaker: {
    failureThreshold: 3, // Open faster
    recoveryTime: 10000, // Recover faster
  },
  timeout: { duration: 1000 }, // Short timeout
}

// Batch processing service
const batchPolicy = {
  retry: {
    maxAttempts: 5, // More retries
    initialDelay: 1000, // Longer delays
    maxDelay: 30000,
  },
  circuitBreaker: {
    failureThreshold: 10, // More tolerant
    recoveryTime: 60000, // Longer recovery
  },
  timeout: { duration: 300000 }, // 5 minute timeout
}
```

### 3. Monitor Circuit Breaker Keys

Understand how circuit breaker keys are derived:

```typescript
// Explicit key (recommended for shared services)
const explicitKey = {
  circuitBreaker: {
    key: 'user-service', // All calls to user service share this circuit
    failureThreshold: 5,
  },
}

// Derived key (default behavior)
// Key will be: `${context.workflowId}:${context.stepId}`
const derivedKey = {
  circuitBreaker: {
    failureThreshold: 5, // Circuit per workflow step
  },
}
```

## Configuration Examples

### Web API Gateway

```typescript
const gatewayPolicy = {
  retry: {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    jitterStrategy: 'full',
    initialDelay: 100,
    maxDelay: 2000,
    retryOn: (error) => {
      // Don't retry client errors (4xx), only server errors (5xx)
      return error.status >= 500
    },
  },
  circuitBreaker: {
    key: 'downstream-api',
    failureThreshold: 5,
    recoveryTime: 30000,
    sampleSize: 20,
    halfOpenPolicy: 'single-probe',
  },
  timeout: {
    duration: 5000,
    operationName: 'downstream-api-call',
  },
}
```

### Background Job Processor

```typescript
const jobPolicy = {
  retry: {
    maxAttempts: 5,
    backoffStrategy: 'exponential',
    jitterStrategy: 'full',
    initialDelay: 1000,
    maxDelay: 60000,
  },
  circuitBreaker: {
    key: 'job-processor',
    failureThreshold: 10,
    recoveryTime: 120000,
    sampleSize: 50,
    halfOpenPolicy: 'single-probe',
  },
  timeout: {
    duration: 600000, // 10 minutes
    operationName: 'process-job',
  },
}
```

### Database Connection

```typescript
const dbPolicy = {
  retry: {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    jitterStrategy: 'full',
    initialDelay: 200,
    maxDelay: 5000,
    retryOn: (error) => {
      // Retry connection errors, not constraint violations
      return error.code !== 'CONSTRAINT_VIOLATION'
    },
  },
  circuitBreaker: {
    key: 'database',
    failureThreshold: 3,
    recoveryTime: 15000,
    sampleSize: 10,
    halfOpenPolicy: 'single-probe',
  },
  timeout: {
    duration: 10000,
    operationName: 'database-query',
  },
}
```
