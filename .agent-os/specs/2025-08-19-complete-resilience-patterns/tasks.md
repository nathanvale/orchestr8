1# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-19-complete-resilience-patterns/spec.md

> Created: 2025-08-19
> Updated: 2025-08-19 - Restructured based on P0 implementation decisions
> Status: Ready for Implementation

## Tasks (Based on P0 Decisions)

### Phase 1: Foundation

- [x] 1. Error Type Consolidation
  - [x] 1.1 Write tests for error types in resilience package
  - [x] 1.2 Create CircuitBreakerOpenError with code, retryAfter, nextRetryTime
  - [x] 1.3 Create TimeoutError with duration and operation
  - [x] 1.4 Create RetryExhaustedError with attempts and lastError
  - [x] 1.5 Export all error types from resilience index
  - [x] 1.6 Remove duplicate errors from core package

- [x] 2. Define Core Interfaces
  - [x] 2.1 Write tests for config validation
  - [x] 2.2 Define RetryConfig with backoff, jitter, retryOn predicate
  - [x] 2.3 Define CircuitBreakerConfig with sliding window params
  - [x] 2.4 Define ResilienceContext with workflowId, stepId, correlationId
  - [x] 2.5 Update ResilienceAdapter interface with new types
  - [x] 2.6 Verify all interface tests pass

### Phase 2: Circuit Breaker Implementation

- [x] 3. Sliding Window State Machine
  - [x] 3.1 Write tests for sliding window behavior
  - [x] 3.2 Implement circular buffer for outcome tracking
  - [x] 3.3 Add per-key state management with Map
  - [x] 3.4 Implement state transitions (closed/open/half-open)
  - [x] 3.5 Add probe locking for half-open concurrency
  - [x] 3.6 Verify window fills before opening circuit

- [x] 4. Retry with Backoff/Jitter
  - [x] 4.1 Write tests for retry strategies
  - [x] 4.2 Implement exponential and fixed backoff
  - [x] 4.3 Add full jitter calculation
  - [x] 4.4 Implement CircuitBreakerOpenError detection (never retry)
  - [x] 4.5 Add custom retry predicate support
  - [x] 4.6 Verify retry exhaustion error handling

### Phase 3: Composition Engine

- [x] 5. Pattern Composition with Validation
  - [x] 5.1 Write tests for composition validation
  - [x] 5.2 Implement middleware chain pattern
  - [x] 5.3 Validate only retry-cb-timeout and timeout-cb-retry
  - [x] 5.4 Error on unsupported composition patterns
  - [x] 5.5 Skip missing patterns while preserving order
  - [x] 5.6 Verify composition order behavior

- [x] 6. Context and Key Derivation
  - [x] 6.1 Write tests for key derivation
  - [x] 6.2 Implement deriveKey from ResilienceContext
  - [x] 6.3 Support explicit key in circuit breaker config
  - [x] 6.4 Pass context through middleware layers
  - [x] 6.5 Propagate AbortSignal correctly
  - [x] 6.6 Preserve error stack traces

### Phase 4: Integration and Polish

- [x] 7. Production Resilience Adapter
  - [x] 7.1 Write adapter integration tests
  - [x] 7.2 Implement adapter using new composition engine
  - [x] 7.3 Add policy normalization with defaults
  - [x] 7.4 Handle both legacy and new interfaces
  - [x] 7.5 Add proper error handling
  - [x] 7.6 Verify all adapter tests pass

- [x] 8. Performance and Production Readiness
  - [x] 8.1 Write performance benchmarks
  - [x] 8.2 Optimize Map lookups (O(1))
  - [x] 8.3 Implement bounded state maps (max 1000 circuits)
  - [x] 8.4 Add lazy cleanup for expired circuits
  - [x] 8.5 Verify < 1ms median overhead
  - [x] 8.6 Run full test suite with pnpm check

## Success Criteria

- [x] Circuit breaker properly manages state transitions
- [x] Composition orders behave according to specification
- [x] All existing tests continue to pass
- [x] New test coverage exceeds 95%
- [x] Performance overhead less than 1ms
- [x] Memory usage remains bounded under load
- [x] Clear documentation and examples provided

## TODOs (P0/P1/P2 Integration Follow-ups)

> Added: 2025-08-20 — Derived from integration review of @orchestr8/core ↔ @orchestr8/resilience

### P0

- [x] Monitor CI for flakiness regressions in timing-sensitive tests (reference adapter); retain fake timers where applicable

- [ ] Align canonical error contracts in resilience
  - [ ] CircuitBreakerOpenError: set code to 'CIRCUIT_BREAKER_OPEN' and expose
        nextRetryTime: number explicitly
  - [ ] Keep retryAfter: Date and existing code 'CIRCUIT_OPEN' as deprecated
        aliases for backward compatibility and update type guards
  - [ ] Ensure all timeout paths raise TimeoutError (including default
        timeout wrapper) to keep core error mapping stable

- [ ] Define circuit breaker failureThreshold semantics and update config/tests
  - [ ] Decide absolute count vs rate; if supporting both, add a clear
        thresholdMode: 'count' | 'rate' or interpret values ≤ 1 as rate and
    > 1 as count
  - [ ] Update CircuitBreakerConfig types/validation and adjust E2E using 0.5
        to match the chosen semantics

- [ ] Enforce performance targets in CI
  - [ ] Unskip/enable perf benchmarks with CI-friendly thresholds (median < 1ms,
        p95 < 2ms overhead) and document acceptable CI variance
  - [ ] Gate perf in test:ci and add brief docs on handling flakes/fallbacks

### P1

- [x] Core: map resilience errors to schema ExecutionError codes
  - [x] Map TimeoutError to TIMEOUT code with timeout metadata
  - [x] Map CircuitBreakerOpenError to CIRCUIT_OPEN code for analytics
  - [x] Map RetryExhaustedError to RETRYABLE with attempts/lastError metadata
  - [x] Add unit tests for error mapping and propagation
- [x] Core: add E2E integration test using ProductionResilienceAdapter
  - [x] Validate retry + timeout + circuit breaker flows with real composition
  - [x] Assert signal propagation (abort during backoff and timeout)
- [x] Docs: composition order guidance
  - [x] Document when to prefer `retry-cb-timeout` vs `timeout-cb-retry` with trade-offs

- [ ] Composition default wrappers consistency
  - [ ] Standardize error types across default wrappers (or mark them
        internal-only) so production paths consistently use the
        ProductionResilienceAdapter

- [ ] Circuit breaker instance lifecycle & telemetry in adapter
  - [ ] Add periodic cleanup/eviction telemetry and unit tests for LRU
        management in ProductionResilienceAdapter
  - [ ] Expose safe diagnostics for instance counts and last-access tracking

- [ ] Observability polish
  - [ ] Enrich telemetry with failure rate, open duration, probe outcomes,
        and assert on hooks firing in tests

### P2

- [ ] DX: provide a default production adapter binding in core (optional factory/default)
- [ ] Observability: align standard telemetry fields across core/resilience (workflowId, stepId, correlationId)
- [ ] Docs: expand resilience examples (policy presets, CB tuning, retry predicates by error class)

- [ ] Half-open gradual recovery strategy
  - [ ] Design configurable ramp-up with guardrails and tests

- [ ] Additional composition orders (if needed by product)
  - [ ] Validate, document trade-offs, and add tests

- [ ] Documentation improvements
  - [ ] Key derivation hygiene (bounded cardinality) with examples
  - [ ] Threshold semantics (count vs rate) with worked examples
  - [ ] Migration notes for updated error contracts

- [ ] Explore distributed circuit breaker (explicitly post-MVP)
