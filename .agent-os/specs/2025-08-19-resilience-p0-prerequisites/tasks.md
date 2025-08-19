# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-19-resilience-p0-prerequisites/spec.md

> Created: 2025-08-19
> Status: Ready for Implementation

## Tasks

- [x] 1. Update Schema Package Types
  - [x] 1.1 Write tests for new ResilienceInvocationContext type
  - [x] 1.2 Add ResilienceInvocationContext interface to @orchestr8/schema
  - [x] 1.3 Write tests for updated ResilienceAdapter signature
  - [x] 1.4 Update ResilienceAdapter interface with signal and context parameters
  - [x] 1.5 Write tests for extended policy types
  - [x] 1.6 Add CircuitBreakerPolicy with optional key field
  - [x] 1.7 Extend RetryPolicy with backoff and jitter strategies
  - [x] 1.8 Add CompositionOrder type with allowed values
  - [x] 1.9 Export all new types from schema index
  - [x] 1.10 Verify all schema tests pass

- [x] 2. Create Error Types in Resilience Package
  - [x] 2.1 Write tests for TimeoutError class
  - [x] 2.2 Implement TimeoutError with required metadata
  - [x] 2.3 Write tests for CircuitBreakerOpenError class
  - [x] 2.4 Implement CircuitBreakerOpenError with retry timing
  - [x] 2.5 Add error type guards and serialization helpers
  - [x] 2.6 Export error types from resilience package index
  - [x] 2.7 Verify error handling tests pass

- [x] 3. Update Reference Resilience Adapter
  - [x] 3.1 Write tests for new execute signature with signal parameter
  - [x] 3.2 Update ReferenceResilienceAdapter.execute to accept signal-accepting operations
  - [x] 3.3 Write tests for context parameter handling
  - [x] 3.4 Add context parameter support to execute method
  - [x] 3.5 Ensure backward compatibility with existing tests
  - [x] 3.6 Verify all adapter tests pass

- [x] 4. Update Orchestration Engine
  - [x] 4.1 Write tests for signal-accepting operation passing
  - [x] 4.2 Modify executeStep to pass operations as (signal?) => Promise functions
  - [x] 4.3 Write tests for context creation and propagation
  - [x] 4.4 Create ResilienceInvocationContext from execution context
  - [x] 4.5 Pass context to resilience adapter calls
  - [x] 4.6 Update error mapping for new error types
  - [x] 4.7 Verify all engine tests pass

- [x] 5. Integration and Validation
  - [x] 5.1 Run full test suite across all packages
  - [x] 5.2 Verify type checking passes with no errors
  - [x] 5.3 Run build to ensure proper compilation
  - [x] 5.4 Check that no `any` types were introduced
  - [x] 5.5 Validate that existing functionality is preserved
  - [x] 5.6 Run pnpm check for format, lint, and type issues
