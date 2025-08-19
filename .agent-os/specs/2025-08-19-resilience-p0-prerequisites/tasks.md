# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-19-resilience-p0-prerequisites/spec.md

> Created: 2025-08-19
> Status: Ready for Implementation

## Tasks

- [ ] 1. Update Schema Package Types
  - [ ] 1.1 Write tests for new ResilienceInvocationContext type
  - [ ] 1.2 Add ResilienceInvocationContext interface to @orchestr8/schema
  - [ ] 1.3 Write tests for updated ResilienceAdapter signature
  - [ ] 1.4 Update ResilienceAdapter interface with signal and context parameters
  - [ ] 1.5 Write tests for extended policy types
  - [ ] 1.6 Add CircuitBreakerPolicy with optional key field
  - [ ] 1.7 Extend RetryPolicy with backoff and jitter strategies
  - [ ] 1.8 Add CompositionOrder type with allowed values
  - [ ] 1.9 Export all new types from schema index
  - [ ] 1.10 Verify all schema tests pass

- [ ] 2. Create Error Types in Resilience Package
  - [ ] 2.1 Write tests for TimeoutError class
  - [ ] 2.2 Implement TimeoutError with required metadata
  - [ ] 2.3 Write tests for CircuitBreakerOpenError class
  - [ ] 2.4 Implement CircuitBreakerOpenError with retry timing
  - [ ] 2.5 Add error type guards and serialization helpers
  - [ ] 2.6 Export error types from resilience package index
  - [ ] 2.7 Verify error handling tests pass

- [ ] 3. Update Reference Resilience Adapter
  - [ ] 3.1 Write tests for new execute signature with signal parameter
  - [ ] 3.2 Update ReferenceResilienceAdapter.execute to accept signal-accepting operations
  - [ ] 3.3 Write tests for context parameter handling
  - [ ] 3.4 Add context parameter support to execute method
  - [ ] 3.5 Ensure backward compatibility with existing tests
  - [ ] 3.6 Verify all adapter tests pass

- [ ] 4. Update Orchestration Engine
  - [ ] 4.1 Write tests for signal-accepting operation passing
  - [ ] 4.2 Modify executeStep to pass operations as (signal?) => Promise functions
  - [ ] 4.3 Write tests for context creation and propagation
  - [ ] 4.4 Create ResilienceInvocationContext from execution context
  - [ ] 4.5 Pass context to resilience adapter calls
  - [ ] 4.6 Update error mapping for new error types
  - [ ] 4.7 Verify all engine tests pass

- [ ] 5. Integration and Validation
  - [ ] 5.1 Run full test suite across all packages
  - [ ] 5.2 Verify type checking passes with no errors
  - [ ] 5.3 Run build to ensure proper compilation
  - [ ] 5.4 Check that no `any` types were introduced
  - [ ] 5.5 Validate that existing functionality is preserved
  - [ ] 5.6 Run pnpm check for format, lint, and type issues