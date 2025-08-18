# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-18-core-orchestration-engine/spec.md

> Created: 2025-08-18
> Status: CRITICAL IMPLEMENTATION REQUIRED - Core Engine Missing

## Implementation Status

**✅ COMPLETED (Prerequisites & Fixes):**
- [x] Repository prerequisites (Node >=20, jmespath, engines fields)
- [x] Error taxonomy aligned with ExecutionError structure
- [x] API contract decisions finalized (Agent.execute, AgentRegistry.getAgent)
- [x] Expression evaluator critical bugs fixed (compile→search, depth tracking, prototype guards)
- [x] Naming conventions aligned (dependsOn, completed status)

**❌ CRITICAL MISSING IMPLEMENTATION:**
- [ ] **OrchestrationEngine class** - Core engine not implemented (BLOCKS MVP)
- [ ] **Workflow execution logic** - Cannot execute any workflows
- [ ] **Dependency resolution** - No graph building or scheduling
- [ ] **Parallel execution** - No concurrent step coordination  
- [ ] **Memory management** - No bounded execution or truncation

**⚠️ MEDIUM PRIORITY FIXES:**
- [ ] Condition error handling consistency (throw vs return false)
- [ ] Expression parser improvements (quoted defaults, 64KB limit)
- [ ] ResilienceAdapter composition order finalization
- [ ] Schema validation error taxonomy alignment

## Tasks

- [x] 0. Prerequisites & Contract Alignment (COMPLETED)
  - [x] 0.1 Repository prerequisites (Node >=20, jmespath dependency)
  - [x] 0.2 Error taxonomy aligned with ExecutionError
  - [x] 0.3 API contract decisions finalized
  - [x] 0.4 Expression evaluator critical bugs fixed
  - [x] 0.5 Naming conventions and status values unified

- [ ] 1. **CRITICAL: Core OrchestrationEngine Implementation** (BLOCKS MVP)
  - [ ] 1.1 Write tests for OrchestrationEngine.execute() method with WorkflowResult contract
  - [ ] 1.2 Implement OrchestrationEngine class with main execute() method
  - [ ] 1.3 Write tests for buildExecutionGraph() with dependency analysis and cycle detection
  - [ ] 1.4 Implement buildExecutionGraph() method with topological sorting
  - [ ] 1.5 Write tests for scheduleSteps() deterministic ordering (dependency count + index)
  - [ ] 1.6 Implement scheduleSteps() method with stable scheduling algorithm
  - [ ] 1.7 Verify core engine foundation tests pass before proceeding

- [ ] 2. **CRITICAL: Parallel Execution & Memory Management** (BLOCKS MVP)
  - [ ] 2.1 Write tests for executeLevel() with Promise.all coordination and fail-fast semantics
  - [ ] 2.2 Implement executeLevel() method with parallel execution and AbortSignal.any cancellation
  - [ ] 2.3 Write tests for executeStep() with resilience integration and context threading
  - [ ] 2.4 Implement executeStep() method with agent execution and result collection
  - [ ] 2.5 Write tests for memory truncation (512KB limit) with JSON-safe serialization
  - [ ] 2.6 Implement memory bounds enforcement with truncation metadata
  - [ ] 2.7 Verify parallel execution and memory management tests pass

- [ ] 3. **MEDIUM: Error Handling & Resilience Integration** (Post-MVP Critical Features)
  - [ ] 3.1 Write tests for condition evaluation error handling (throw ExecutionError vs return false) 
  - [ ] 3.2 Implement strict mode for condition evaluation with VALIDATION error consistency
  - [ ] 3.3 Write tests for ResilienceAdapter composition order and policy application
  - [ ] 3.4 Finalize ResilienceAdapter API and implement policy composition
  - [ ] 3.5 Write tests for fallbackStepId execution path and result aliasing semantics
  - [ ] 3.6 Implement complete fallback execution and dependency resolution
  - [ ] 3.7 Verify error handling and resilience tests pass

- [ ] 4. **MEDIUM: Expression & Validation Improvements** (Post-MVP Polish)
  - [ ] 4.1 Write tests for robust default value parsing with quoted literals
  - [ ] 4.2 Implement improved expression parser handling quoted defaults and nested expressions
  - [ ] 4.3 Write tests for 64KB expansion size enforcement during mapping resolution
  - [ ] 4.4 Implement expansion size limits with VALIDATION error classification
  - [ ] 4.5 Write tests for schema validation using ExecutionError taxonomy
  - [ ] 4.6 Update schema validation to use ExecutionError with VALIDATION code
  - [ ] 4.7 Verify expression and validation improvement tests pass

- [ ] 5. **LOW: Integration Testing & Performance Validation** (Quality Gates)
  - [ ] 5.1 Write tests for hybrid sequential-parallel workflow patterns with complex dependencies
  - [ ] 5.2 Add tests for partial parallel failures with ExecutionError aggregation and fail-fast behavior  
  - [ ] 5.3 Test performance benchmarks: <100ms orchestration overhead (p95) and deterministic scheduling
  - [ ] 5.4 Add tests for cancellation scenarios: graceful cleanup, timeout enforcement, AbortSignal propagation
  - [ ] 5.5 Comprehensive edge case testing and >80% coverage validation
  - [ ] 5.6 Verify all integration tests pass with performance requirements met
