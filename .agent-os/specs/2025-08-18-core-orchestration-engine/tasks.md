# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-18-core-orchestration-engine/spec.md

> Created: 2025-08-18
> Status: Phase 1 Complete - Phase 2 Hardening In Progress
> Last Updated: 2025-08-18

## Implementation Status

**✅ COMPLETED (Prerequisites & Fixes):**

- [x] Repository prerequisites (Node >=20, jmespath, engines fields)
- [x] Error taxonomy aligned with ExecutionError structure
- [x] API contract decisions finalized (Agent.execute, AgentRegistry.getAgent)
- [x] Expression evaluator critical bugs fixed (compile→search, depth tracking, prototype guards)
- [x] Naming conventions aligned (dependsOn, completed status)

**✅ CRITICAL IMPLEMENTATION COMPLETED:**

- [x] **OrchestrationEngine class** - Fully implemented with 859 lines of production code
- [x] **Workflow execution logic** - Complete execution pipeline with WorkflowResult contract
- [x] **Dependency resolution** - Topological sort with cycle detection implemented
- [x] **Parallel execution** - Concurrent step coordination with Semaphore pattern
- [x] **Memory management** - 512KB bounded execution with truncation metadata

**🔧 PHASE 2 HARDENING (In Progress):**

**Critical Gaps:**

- [x] ✅ Cancellation propagation with AbortSignal.any (COMPLETED)

**High Priority Gaps:**

- [x] ✅ True timeout enforcement for expression evaluation (COMPLETED)
- [x] ✅ Expression expansion 64KB limit enforcement (COMPLETED)
- [x] ✅ Dependency failure skip semantics (COMPLETED)

**Medium Priority Gaps:**

- [x] ✅ Structured logging implementation (COMPLETED)
- [ ] Resilience composition order finalization
- [ ] Mapping parser robustness improvements

## Tasks

- [x] 0. Prerequisites & Contract Alignment (COMPLETED)
  - [x] 0.1 Repository prerequisites (Node >=20, jmespath dependency)
  - [x] 0.2 Error taxonomy aligned with ExecutionError
  - [x] 0.3 API contract decisions finalized
  - [x] 0.4 Expression evaluator critical bugs fixed
  - [x] 0.5 Naming conventions and status values unified

- [x] 1. **CRITICAL: Core OrchestrationEngine Implementation** (COMPLETED ✅)
  - [x] 1.1 Write tests for OrchestrationEngine.execute() method with WorkflowResult contract
  - [x] 1.2 Implement OrchestrationEngine class with main execute() method
  - [x] 1.3 Write tests for buildExecutionGraph() with dependency analysis and cycle detection
  - [x] 1.4 Implement buildExecutionGraph() method with topological sorting
  - [x] 1.5 Write tests for scheduleSteps() deterministic ordering (dependency count + index)
  - [x] 1.6 Implement scheduleSteps() method with stable scheduling algorithm
  - [x] 1.7 Verify core engine foundation tests pass before proceeding

- [x] 2. **CRITICAL: Parallel Execution & Memory Management** (COMPLETED ✅)
  - [x] 2.1 Write tests for executeLevel() with Promise.all coordination and fail-fast semantics
  - [x] 2.2 Implement executeLevel() method with parallel execution and AbortSignal.any cancellation
  - [x] 2.3 Write tests for executeStep() with resilience integration and context threading
  - [x] 2.4 Implement executeStep() method with agent execution and result collection
  - [x] 2.5 Write tests for memory truncation (512KB limit) with JSON-safe serialization
  - [x] 2.6 Implement memory bounds enforcement with truncation metadata
  - [x] 2.7 Verify parallel execution and memory management tests pass

- [x] 3. **CRITICAL: Cancellation Propagation Fix** (✅ COMPLETED)
  - [x] 3.1 Write tests for parent signal propagation with AbortSignal.any
  - [x] 3.2 Combine parent AbortSignal with level AbortController
  - [x] 3.3 Test cascading cancellation from parent to all level steps
  - [x] 3.4 Verify deterministic cancellation order

- [x] 4. **HIGH: Expression Security & Timeouts** (Security Critical ✅ COMPLETED)
  - [x] 4.1 Write tests for 500ms timeout on JMESPath evaluation
  - [x] 4.2 Implement preemptive cancellation for long-running expressions
  - [x] 4.3 Write tests for 64KB expansion limit enforcement
  - [x] 4.4 Add byte counter during mapping resolution with VALIDATION error
  - [x] 4.5 Test pathological expressions and memory bombs
  - [x] 4.6 Verify all security limits are enforced

- [x] 5. **HIGH: Dependency Failure Semantics** (Behavioral Clarity ✅ COMPLETED)
  - [x] 5.1 Write tests for skip behavior when dependencies fail
  - [x] 5.2 Write tests for skip behavior when dependencies are cancelled
  - [x] 5.3 Define clear contract: skip on "failed" and "cancelled" or only "skipped"
  - [x] 5.4 Implement chosen semantics consistently
  - [x] 5.5 Document decision in dependency-semantics.md sub-spec
  - [x] 5.6 Verify all dependency scenarios handle correctly

- [x] 6. **MEDIUM: Structured Logging Implementation** (Observability ✅ COMPLETED)
  - [x] 6.1 Define Logger interface in core with child() and log methods
  - [x] 6.2 Accept logger?: Logger in OrchestrationOptions
  - [x] 6.3 Implement no-op default logger
  - [x] 6.4 Add workflow.start/end logs with executionId correlation
  - [x] 6.5 Add step.start/success/error logs with stepId and timing
  - [x] 6.6 Add level.start and level.fail-fast logs
  - [x] 6.7 Write tests with memory logger to verify log fields
  - [x] 6.8 Document Pino adapter pattern for consumers

- [ ] 7. **MEDIUM: Resilience Composition Order** (Reliability)
  - [ ] 7.1 Write tests for retry-cb-timeout composition order
  - [ ] 7.2 Write tests for timeout-cb-retry alternative order
  - [ ] 7.3 Finalize default composition order decision
  - [ ] 7.4 Implement consistent policy normalization
  - [ ] 7.5 Test interaction between retry attempts and timeouts
  - [ ] 7.6 Document composition semantics clearly

- [ ] 8. **MEDIUM: Mapping Parser Improvements** (Robustness)
  - [ ] 8.1 Write tests for single-quoted default values
  - [ ] 8.2 Write tests for escaped quotes in defaults
  - [ ] 8.3 Write tests for nested ?? in quoted strings
  - [ ] 8.4 Implement proper tokenizer for default value parsing
  - [ ] 8.5 Handle edge cases in expression resolution
  - [ ] 8.6 Verify robust parsing for all expression patterns

- [ ] 9. **LOW: Code Cleanup** (Technical Debt)
  - [ ] 9.1 Remove or wire InternalExecutionContext.envWhitelist
  - [ ] 9.2 Evaluate expression cache usage beyond deduplication
  - [ ] 9.3 Document Map insertion order invariants
  - [ ] 9.4 Clean up TODO comments in code
  - [ ] 9.5 Improve type definitions where needed

- [ ] 10. **FUTURE: Integration Testing & Performance** (Phase 3)
  - [ ] 10.1 Comprehensive integration test suite
  - [ ] 10.2 Performance benchmarks (<100ms p95 overhead)
  - [ ] 10.3 Memory profiling and optimization
  - [ ] 10.4 Load testing with large workflows
  - [ ] 10.5 Edge case coverage >90%
