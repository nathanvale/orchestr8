# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-19-resilience-p0-prerequisites/spec.md

> Created: 2025-08-19
> Version: 1.0.0

## Test Coverage

### Unit Tests

**ResilienceAdapter Interface**
- Operation accepts optional AbortSignal parameter
- Context parameter is properly typed and optional
- Backward compatibility with existing tests maintained

**ResilienceInvocationContext**
- All required fields present (workflowId, stepId)
- Optional fields handled correctly (correlationId, metadata)
- Context used for default key derivation

**Error Types**
- TimeoutError includes timeout duration and operation name
- CircuitBreakerOpenError includes retry timing and failure count
- Errors serialize correctly for logging
- Error names are correctly set for instanceof checks

**Policy Types**
- Circuit breaker policy accepts optional key
- Retry policy supports all backoff strategies
- Composition order validates allowed values
- Type guards work for policy discrimination

### Integration Tests

**Signal Propagation**
- Middleware can inject its own signal
- Multiple signals can be combined (timeout + cancellation)
- Signal propagates through middleware chain
- Aborted operations clean up correctly

**Context Flow**
- Context passed from engine to adapter
- Context available in all middleware layers
- Context used for circuit key when no explicit key
- Context preserved across retries

**Engine Integration**
- OrchestrationEngine passes signal-accepting functions
- Existing tests continue to pass
- New signature works with ReferenceResilienceAdapter
- Error mapping from resilience to execution errors

### Regression Tests

**Existing Functionality**
- All current resilience tests still pass
- No breaking changes to public API
- Performance characteristics unchanged
- Memory usage patterns consistent

### Type Safety Tests

**Compile-Time Verification**
- No `any` types introduced
- Strict null checks pass
- Generic constraints properly enforced
- Discriminated unions work correctly

## Test Scenarios

### Scenario 1: Signal Injection
```typescript
it('should allow middleware to inject timeout signal', async () => {
  const operation = vi.fn((signal?: AbortSignal) => 
    new Promise(resolve => {
      if (signal?.aborted) throw new Error('Aborted');
      setTimeout(resolve, 1000);
    })
  );
  
  const adapter = new TestAdapter();
  await expect(
    adapter.execute(operation, { timeout: { ms: 100 } })
  ).rejects.toThrow(TimeoutError);
});
```

### Scenario 2: Context-Based Keys
```typescript
it('should derive circuit key from context', async () => {
  const context: ResilienceInvocationContext = {
    workflowId: 'workflow-1',
    stepId: 'step-1',
    correlationId: 'corr-123'
  };
  
  const expectedKey = 'workflow-1:step-1';
  // Verify key derivation logic
});
```

### Scenario 3: Error Metadata
```typescript
it('should include retry timing in circuit breaker error', () => {
  const error = new CircuitBreakerOpenError(
    'Circuit open',
    'test-key',
    new Date(Date.now() + 5000),
    3
  );
  
  expect(error.retryAfter).toBeInstanceOf(Date);
  expect(error.consecutiveFailures).toBe(3);
});
```

## Mocking Requirements

- **AbortController**: Mock for testing signal combinations
- **Date/Timer**: Use Vitest fake timers for retry timing tests
- **No external service mocks needed**: All changes are internal

## Performance Validation

- Signature change should not add measurable overhead
- Context parameter should not increase memory usage significantly
- Type checking should remain fast in development