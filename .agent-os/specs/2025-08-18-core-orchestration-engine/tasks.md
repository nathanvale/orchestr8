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

**✅ PHASE 2 HARDENING (MOSTLY COMPLETED):**

**Completed Critical Gaps:**

- [x] ✅ Cancellation propagation with AbortSignal.any
- [x] ✅ True timeout enforcement for expression evaluation
- [x] ✅ Expression expansion 64KB limit enforcement
- [x] ✅ Dependency failure skip semantics
- [x] ✅ Structured logging implementation

**🔧 REMAINING MEDIUM PRIORITY GAPS:**

- [ ] Resilience composition order finalization
- [ ] Mapping parser robustness improvements

**🆕 UPDATED TECHNICAL GAPS (from Code Review):**

**High Priority:**

- [x] ✅ Fallback input override not honored (fallback step input ignored)
- [ ] Nested step schema vs flat execution divergence (groups not traversed)

**Medium Priority:**

- [ ] Resilience composition control not enforced at adapter contract level
- [ ] Configuration parity - engine limits not threaded through evaluator
- [ ] Environment whitelist duplication/inconsistency (two sources of truth)
- [ ] Condition error handling defaults to "silent false" (non-strict mode)

**Low Priority:**

- [ ] Preemptive timeout documentation overpromises (post-check only)
- [ ] Unused type fields and implementation drift
- [ ] Memory truncation UX - no partial output preview

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

- [x] 7. **MEDIUM: Resilience Composition Order** (Reliability ✅ COMPLETED)
  - [x] 7.1 Write tests for retry-cb-timeout composition order
  - [x] 7.2 Write tests for timeout-cb-retry alternative order
  - [x] 7.3 Finalize default composition order decision
  - [x] 7.4 Implement consistent policy normalization
  - [x] 7.5 Test interaction between retry attempts and timeouts
  - [x] 7.6 Document composition semantics clearly

- [x] 8. **MEDIUM: Mapping Parser Improvements** (Robustness) ✅ COMPLETED
  - [x] 8.1 Write tests for single-quoted default values
  - [x] 8.2 Write tests for escaped quotes in defaults
  - [x] 8.3 Write tests for nested ?? in quoted strings
  - [x] 8.4 Implement proper tokenizer for default value parsing
  - [x] 8.5 Handle edge cases in expression resolution
  - [x] 8.6 Verify robust parsing for all expression patterns

- [x] 9. **HIGH: Fix Fallback Input Override** (Implementation Bug) ✅ COMPLETED
  - [x] 9.1 Write tests for fallback step with explicit input mapping
  - [x] 9.2 Write tests for fallback step without input (uses original step input)
  - [x] 9.3 Update executeFallback to check fallback.input before using originalNode.input
  - [x] 9.4 Verify fallback input precedence: fallback.input > originalNode.input
  - [x] 9.5 Test both explicit fallback input and fallback-as-alias scenarios
  - [x] 9.6 Ensure backwards compatibility with existing fallback patterns

- [x] 10. **HIGH DECISION: Nested Step Types Semantics** (Architecture Decision) ✅ COMPLETED
  - [x] 10.1 Analyze current schema SequentialStep/ParallelStep definitions
  - [x] 10.2 Evaluate impact of flat dependency graph vs nested group execution
  - [x] 10.3 Decision: Implement group expansion layer OR explicitly de-scope nested groups
  - [x] 10.4 If de-scope: Update schema/examples to use dependsOn only
  - [x] 10.5 If implement: Design group expansion with maxConcurrency support
  - [x] 10.6 Document decision rationale and update architecture docs

- [x] 11. **MEDIUM: Update ResilienceAdapter Contract** (Interface Consistency) ✅ COMPLETED
  - [x] 11.1 Update ResilienceAdapter interface to accept normalized policies
  - [x] 11.2 Add explicit compositionOrder parameter (e.g., 'retry-cb-timeout')
  - [x] 11.3 Provide reference adapter implementation in @orchestr8/resilience
  - [x] 11.4 Keep current wrapper for compatibility but add deprecation notice
  - [x] 11.5 Test consistent composition order across different adapters
  - [x] 11.6 Update documentation on resilience composition semantics

- [ ] 12. **MEDIUM: Configuration Parity** (Technical Consistency)
  - [ ] 12.1 Thread OrchestrationOptions.maxExpansionDepth to evaluator
  - [ ] 12.2 Thread OrchestrationOptions.maxExpansionSize to evaluator
  - [ ] 12.3 Add tests for non-default limits
  - [ ] 12.4 Remove hard-coded SECURITY_LIMITS usage in expression-evaluator
  - [ ] 12.5 Verify configurable limits work end-to-end

- [ ] 13. **MEDIUM: Environment Whitelist Consistency** (API Cleanup)
  - [ ] 13.1 Remove unused InternalExecutionContext.envWhitelist field
  - [ ] 13.2 Ensure evaluator consistently uses workflow.allowedEnvVars
  - [ ] 13.3 Add tests for environment variable access patterns
  - [ ] 13.4 Document single source of truth for env access (workflow schema)
  - [ ] 13.5 Update any references to the removed envWhitelist field

- [ ] 14. **MEDIUM: Strict Condition Defaults** (Runtime Safety)
  - [ ] 14.1 Analyze current strictConditions=false default behavior
  - [ ] 14.2 Consider changing default to strictConditions=true
  - [ ] 14.3 Add tests for invalid conditions raising VALIDATION errors when strict
  - [ ] 14.4 Test backward compatibility with existing workflows
  - [ ] 14.5 Document condition error handling behavior changes
  - [ ] 14.6 Consider workflow-level strictConditions override

- [ ] 15. **LOW: Documentation and Polish** (Technical Debt)
  - [ ] 15.1 Update timeout documentation from "preemptive" to "post-check"
  - [ ] 15.2 Clean up unused ExecutionNode.children and maxMetadataBytes
  - [ ] 15.3 Consider safe preview for truncated memory results
  - [ ] 15.4 Clean dist before build in schema package
  - [ ] 15.5 Document Map insertion order invariants
  - [ ] 15.6 Clean up TODO comments in code

- [ ] 16. **FUTURE: Integration Testing & Performance** (Phase 3)
  - [ ] 16.1 Comprehensive integration test suite
  - [ ] 16.2 Performance benchmarks (<100ms p95 overhead)
  - [ ] 16.3 Memory profiling and optimization
  - [ ] 16.4 Load testing with large workflows
  - [ ] 16.5 Edge case coverage >90%
