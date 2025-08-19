# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-19-complete-resilience-patterns/spec.md

> Created: 2025-08-19
> Updated: 2025-08-19 - Restructured based on P0 implementation decisions
> Status: Ready for Implementation

## Tasks (Based on P0 Decisions)

### Phase 1: Foundation

- [ ] 1. Error Type Consolidation
  - [ ] 1.1 Write tests for error types in resilience package
  - [ ] 1.2 Create CircuitBreakerOpenError with code, retryAfter, nextRetryTime
  - [ ] 1.3 Create TimeoutError with duration and operation
  - [ ] 1.4 Create RetryExhaustedError with attempts and lastError
  - [ ] 1.5 Export all error types from resilience index
  - [ ] 1.6 Remove duplicate errors from core package

- [ ] 2. Define Core Interfaces
  - [ ] 2.1 Write tests for config validation
  - [ ] 2.2 Define RetryConfig with backoff, jitter, retryOn predicate
  - [ ] 2.3 Define CircuitBreakerConfig with sliding window params
  - [ ] 2.4 Define ResilienceContext with workflowId, stepId, correlationId
  - [ ] 2.5 Update ResilienceAdapter interface with new types
  - [ ] 2.6 Verify all interface tests pass

### Phase 2: Circuit Breaker Implementation

- [ ] 3. Sliding Window State Machine
  - [ ] 3.1 Write tests for sliding window behavior
  - [ ] 3.2 Implement circular buffer for outcome tracking
  - [ ] 3.3 Add per-key state management with Map
  - [ ] 3.4 Implement state transitions (closed/open/half-open)
  - [ ] 3.5 Add probe locking for half-open concurrency
  - [ ] 3.6 Verify window fills before opening circuit

- [ ] 4. Retry with Backoff/Jitter
  - [ ] 4.1 Write tests for retry strategies
  - [ ] 4.2 Implement exponential and fixed backoff
  - [ ] 4.3 Add full jitter calculation
  - [ ] 4.4 Implement CircuitBreakerOpenError detection (never retry)
  - [ ] 4.5 Add custom retry predicate support
  - [ ] 4.6 Verify retry exhaustion error handling

### Phase 3: Composition Engine

- [ ] 5. Pattern Composition with Validation
  - [ ] 5.1 Write tests for composition validation
  - [ ] 5.2 Implement middleware chain pattern
  - [ ] 5.3 Validate only retry-cb-timeout and timeout-cb-retry
  - [ ] 5.4 Error on unsupported composition patterns
  - [ ] 5.5 Skip missing patterns while preserving order
  - [ ] 5.6 Verify composition order behavior

- [ ] 6. Context and Key Derivation
  - [ ] 6.1 Write tests for key derivation
  - [ ] 6.2 Implement deriveKey from ResilienceContext
  - [ ] 6.3 Support explicit key in circuit breaker config
  - [ ] 6.4 Pass context through middleware layers
  - [ ] 6.5 Propagate AbortSignal correctly
  - [ ] 6.6 Preserve error stack traces

### Phase 4: Integration and Polish

- [ ] 7. Production Resilience Adapter
  - [ ] 7.1 Write adapter integration tests
  - [ ] 7.2 Implement adapter using new composition engine
  - [ ] 7.3 Add policy normalization with defaults
  - [ ] 7.4 Handle both legacy and new interfaces
  - [ ] 7.5 Add proper error handling
  - [ ] 7.6 Verify all adapter tests pass

- [ ] 8. Performance and Production Readiness
  - [ ] 8.1 Write performance benchmarks
  - [ ] 8.2 Optimize Map lookups (O(1))
  - [ ] 8.3 Implement bounded state maps (max 1000 circuits)
  - [ ] 8.4 Add lazy cleanup for expired circuits
  - [ ] 8.5 Verify < 1ms median overhead
  - [ ] 8.6 Run full test suite with pnpm check

## Success Criteria

- [ ] Circuit breaker properly manages state transitions
- [ ] Composition orders behave according to specification
- [ ] All existing tests continue to pass
- [ ] New test coverage exceeds 95%
- [ ] Performance overhead less than 1ms
- [ ] Memory usage remains bounded under load
- [ ] Clear documentation and examples provided
