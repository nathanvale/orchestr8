# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-19-resilience-p0-prerequisites/spec.md

> Created: 2025-08-19
> Version: 1.0.0

## Technical Requirements

### Operation Signature Changes

The core requirement is changing how operations are passed through the resilience adapter:

**Current (Problematic)**:
```typescript
// Operation has already chosen its signal
execute<T>(operation: () => Promise<T>, policy?: ResiliencePolicy): Promise<T>
```

**Required (Flexible)**:
```typescript
// Operation accepts a signal, allowing middleware to inject combined signals
execute<T>(
  operation: (signal?: AbortSignal) => Promise<T>, 
  policy?: ResiliencePolicy,
  context?: ResilienceInvocationContext
): Promise<T>
```

### Invocation Context Structure

```typescript
interface ResilienceInvocationContext {
  workflowId: string;
  stepId: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}
```

This context enables:
- Default circuit key derivation: `${workflowId}:${stepId}`
- Correlation tracking across retries
- Custom metadata for observability

### Policy Type Extensions

```typescript
interface CircuitBreakerPolicy {
  key?: string;                    // Optional explicit key
  threshold: number;                // Failure threshold  
  timeout: number;                  // Window duration
  resetTimeout: number;             // Time before half-open
  halfOpenMaxAttempts?: number;     // Probes in half-open
}

interface RetryPolicy {
  maxAttempts: number;
  delayMs: number;
  maxDelayMs?: number;
  backoffStrategy?: 'fixed' | 'exponential' | 'linear';
  jitterStrategy?: 'none' | 'full' | 'decorrelated';
}

type CompositionOrder = 'retry-first' | 'circuit-first';
```

### Error Types

```typescript
class TimeoutError extends Error {
  readonly name = 'TimeoutError';
  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly operationName?: string
  ) {
    super(message);
  }
}

class CircuitBreakerOpenError extends Error {
  readonly name = 'CircuitBreakerOpenError';
  constructor(
    message: string,
    public readonly circuitKey: string,
    public readonly retryAfter: Date,
    public readonly consecutiveFailures: number
  ) {
    super(message);
  }
}
```

## Approach Options

### Option A: Minimal Changes (Selected)
- Only change operation signature and add context
- Keep all other interfaces stable
- Pros: Low risk, fast implementation, backward compatible with tests
- Cons: May need another pass for full feature support

### Option B: Complete Overhaul
- Redesign entire adapter interface
- Add streaming, metrics, callbacks in one go
- Pros: Future-proof, cleaner design
- Cons: High risk, longer implementation, breaks existing code

**Rationale**: Option A allows immediate unblocking of resilience work while maintaining stability. We can enhance incrementally after the MVP ships.

## Implementation Strategy

### Phase 1: Schema Updates
1. Update types in @orchestr8/schema/src/resilience.ts
2. Add error classes to @orchestr8/resilience/src/errors.ts
3. Export new types from package indices

### Phase 2: Core Engine Updates
1. Modify OrchestrationEngine.executeStep to pass signal-accepting functions
2. Update context propagation through execution
3. Ensure backward compatibility with existing tests

### Phase 3: Adapter Updates
1. Update ReferenceResilienceAdapter to new signature
2. Add context parameter handling
3. Maintain existing behavior for migration

## Migration Path

1. **Add new signature alongside old**: Support both for one release
2. **Deprecate old signature**: Mark with @deprecated JSDoc
3. **Update all usages**: Migrate tests and implementations
4. **Remove old signature**: In next major version

## External Dependencies

None required for this spec. All changes are to existing types and interfaces.