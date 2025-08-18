# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-18-core-orchestration-engine/spec.md

> Created: 2025-08-18
> Status: Phase 0 Partially Complete - Contract Alignment Required

## Go/No-Go Gate

⚠️ **Phase 0 Partially Complete**: Critical misalignments identified:

**Completed:**
- [x] Repository prerequisites (Node >=20, jmespath, engines fields)
- [x] Error taxonomy aligned with ExecutionError structure
- [x] Basic type exports from @orchestr8/core

**Blocking Issues:**
- [ ] API contracts misaligned between spec and implementation
- [ ] Expression evaluator has critical bugs
- [ ] Naming and status inconsistencies
- [ ] Integration mocks don't match actual interfaces

See @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/implementation-readiness.md for details.

## Tasks

- [ ] 0. Pre-Implementation Gap Resolution (PARTIALLY COMPLETE)
  - [x] 0.1 Repository prerequisites (Node >=20, jmespath dependency)
  - [x] 0.2 Error taxonomy aligned with ExecutionError
  - [ ] 0.3 Fix API contract misalignments
  - [ ] 0.4 Fix expression evaluator implementation bugs
  - [ ] 0.5 Unify naming conventions and status values

- [x] 0.5. Immediate Contract Alignment & Bug Fixes (NEW - BLOCKING)
  - [x] 0.5.1 Fix expression evaluator: Replace jmespath.compile with jmespath.search
  - [x] 0.5.2 Fix expression evaluator: Correct depth tracking (not using indexOf)
  - [x] 0.5.3 Fix expression evaluator: Add prototype key guards (__proto__, constructor, prototype)
  - [x] 0.5.4 Fix expression evaluator: Enforce 500ms timeout with proper error mapping
  - [x] 0.5.5 Align Agent interface: Choose execute(input, signal) OR execute(input, context, signal?)
  - [x] 0.5.6 Align AgentRegistry: Choose sync (lookup) OR async (getAgent with Promises)
  - [x] 0.5.7 Align ResilienceAdapter: Use apply/applyGlobalPolicies pattern OR current applyPolicy
  - [x] 0.5.8 Unify naming: Use `dependsOn` consistently (not `dependencies`)
  - [x] 0.5.9 Unify status: Use `completed` (not `success`) in StepResult
  - [x] 0.5.10 Update all mocks to match chosen interfaces

- [ ] 1. Schema Contract Validation and Core Type Contracts (PREREQUISITE)
  - [ ] 1.1 Write tests validating ExecutionError taxonomy matches @orchestr8/schema exactly
  - [ ] 1.2 Write tests for fallbackStepId execution path and result aliasing semantics
  - [ ] 1.3 Write tests for JMESPath condition evaluation (if/unless) with compilation caching
  - [ ] 1.4 Write tests for mapping expression resolution (${steps/variables/env} with ?? defaults)
  - [ ] 1.5 Write tests for circular dependency detection with VALIDATION error format
  - [ ] 1.6 Implement schema-aligned type contracts and ExecutionGraph interfaces
  - [ ] 1.7 Verify all schema contract tests pass before proceeding

- [ ] 2. Implement deterministic scheduling and execution levels
  - [ ] 2.1 Write tests for deterministic step scheduling with stable ordering
  - [ ] 2.2 Implement scheduleSteps method with dependency count + index sorting
  - [ ] 2.3 Write tests for execution level construction and parallel grouping
  - [ ] 2.4 Implement executeLevel method with concurrency semaphore
  - [ ] 2.5 Verify all tests pass

- [ ] 3. Engine Integration Contracts and Mocking Framework
  - [ ] 3.1 Create MockAgentRegistry and MockResilienceAdapter in @orchestr8/testing package
  - [ ] 3.2 Write tests for AgentRegistry interface: lookup failures → VALIDATION error
  - [ ] 3.3 Write tests for ResilienceAdapter: AbortSignal propagation and policy application
  - [ ] 3.4 Write tests for configuration injection and policy precedence (step over global)
  - [ ] 3.5 Ensure all mocks use mockImplementation pattern for Wallaby.js compatibility
  - [ ] 3.6 Verify all integration contract tests pass with proper error classification

- [ ] 4. Implement parallel execution with failure semantics
  - [ ] 4.1 Write tests for parallel execution with fail-fast behavior
  - [ ] 4.2 Write tests for onError policies: fail (abort peers), continue, retry, fallback with aliasing
  - [ ] 4.3 Implement parallel execution with AbortSignal.any cascading cancellation
  - [ ] 4.4 Write tests for resilience composition order: retry(circuitBreaker(timeout()))
  - [ ] 4.5 Add tests for global concurrency cap enforcement with semaphore under simulated load
  - [ ] 4.6 Verify all parallel execution and failure semantic tests pass

- [ ] 5. Create main OrchestrationEngine with memory safety
  - [ ] 5.1 Write tests for OrchestrationEngine.execute with WorkflowResult contract
  - [ ] 5.2 Implement workflow parsing and execution graph building with schema validation
  - [ ] 5.3 Write tests for memory truncation (512KB limit) with JSON-safe serialization and circular reference handling
  - [ ] 5.4 Implement memory bounds with truncation metadata: {truncated, originalSize, retainedBytes}
  - [ ] 5.5 Add AbortSignal propagation throughout execution chain with graceful cleanup timeouts
  - [ ] 5.6 Verify all OrchestrationEngine tests pass with >80% coverage target

- [ ] 6. Add comprehensive integration and edge case tests
  - [ ] 6.1 Write tests for hybrid sequential-parallel workflow patterns with schema-valid workflows
  - [ ] 6.2 Test complex dependency graphs with multiple execution levels
  - [ ] 6.3 Add tests for partial parallel failures with ExecutionError aggregation and fail-fast behavior
  - [ ] 6.4 Test performance: <100ms orchestration overhead (p95) and deterministic scheduling
  - [ ] 6.5 Add tests for cancellation scenarios: graceful cleanup, timeout enforcement, AbortSignal propagation
  - [ ] 6.6 Verify all integration tests pass with comprehensive edge case coverage and >80% total coverage
