# Spec Requirements Document

> Spec: Core Orchestration Engine - Sequential and Parallel Execution
> Created: 2025-08-18
> Status: In Progress - Phase 2 Hardening
> Last Updated: 2025-08-18

## Overview

Implement the core orchestration engine that executes multi-step workflows with both sequential and parallel execution patterns. This engine is the foundation of the @orchestr8 platform, enabling reliable coordination of agent tasks with proper dependency management and execution flow control.

**CURRENT STATUS**: Phase 1 COMPLETE. Phase 2 hardening MOSTLY COMPLETE. Only 2 medium-priority gaps remain.

**✅ Phase 1 Complete (Core Engine):**

- OrchestrationEngine class fully implemented (859 lines)
- Workflow execution with sequential/parallel patterns
- Dependency resolution with topological sorting
- Memory-bounded execution (512KB limits)
- Strict condition mode support
- Fallback aliasing semantics
- Retry default policies

**✅ Phase 2 Complete (Hardening):**

- Cancellation propagation with AbortSignal.any ✅
- Expression expansion limits enforcement ✅
- Dependency failure semantics implemented ✅
- Structured logging implementation ✅
- True timeout enforcement for expressions ✅

**✅ Recently Completed:**

- Resilience composition order finalization ✅
- Mapping parser robustness improvements ✅

**🔧 Remaining Quality Issues (by Severity):**

**High Priority (Implementation Gaps):**
1. Fallback input override not honored - fallback step's own input ignored
2. Nested step schema vs flat execution divergence - groups not traversed

**Medium Priority (Technical Consistency):**
1. Resilience composition not enforced at adapter contract level
2. Configuration parity - engine limits not threaded through evaluator
3. Environment whitelist duplication/inconsistency
4. Condition error handling defaults to "silent false"

**Low Priority (Technical Debt):**
1. "True" preemptive timeout misleading documentation
2. Unused type fields and implementation drift  
3. Memory truncation UX - no partial output preview

## User Stories

### Sequential Workflow Execution

As an AI engineer, I want to define workflows where agents execute in a specific order, so that I can build complex multi-step processes where each step depends on the output of the previous step.

The engine should execute agents one after another, passing context and results between steps. Each step must complete successfully before the next one begins. If any step fails, the workflow should halt and provide clear error information.

### Parallel Workflow Execution

As a developer, I want to execute multiple independent agents simultaneously, so that I can optimize performance for tasks that don't have dependencies between them.

The engine should identify independent workflow branches and execute them concurrently while respecting resource limits and collecting all results before proceeding to dependent steps.

### Hybrid Sequential-Parallel Execution

As a platform engineer, I want to define complex workflows that mix sequential and parallel execution patterns, so that I can optimize both performance and dependency management in sophisticated agent orchestrations.

The engine should analyze the workflow graph, identify optimal execution strategies, and coordinate mixed execution patterns while maintaining data flow integrity.

## Spec Scope

### Phase 1: Core Engine Implementation (✅ COMPLETED)

1. **OrchestrationEngine Class** - Main engine with execute() method and workflow coordination
2. **Execution Graph Building** - Workflow AST parsing and dependency graph with cycle detection
3. **Deterministic Scheduling** - Topological sorting and level-based execution planning
4. **Parallel Execution Manager** - Concurrent step execution with Promise.all and fail-fast semantics
5. **Memory Management** - 512KB per-step limits with truncation metadata and JSON-safe serialization
6. **AbortSignal Integration** - Cancellation propagation throughout execution chain

### Phase 2: Hardening & Reliability (✅ MOSTLY COMPLETE)

**✅ Completed Critical Items:**

1. **Cancellation Propagation** - Parent AbortSignal merged with level controller using AbortSignal.any ✅

**✅ Completed High Priority Items:**

2. **True Timeout Enforcement** - Preemptive cancellation for expression evaluation (500ms limit) ✅
3. **Expression Expansion Limits** - 64KB max size enforcement during mapping resolution ✅
4. **Dependency Failure Semantics** - Skip behavior implemented for failed/cancelled dependencies ✅
5. **Structured Logging** - Logger interface wired and lifecycle events implemented ✅

**🔧 Remaining Medium Priority:**

6. **Resilience Composition** - Finalize order between retry/timeout/circuit breaker with consistent defaults
7. **Mapping Parser Robustness** - Support quoted defaults and handle nested ?? expressions

**Detailed Quality Issues (from Code Review):**

**HIGH PRIORITY:**

8. **Fallback Input Override Not Honored**
   - **Evidence**: orchestration-engine.ts executeFallback builds fallback node with input: originalNode.input, ignoring any input mapping defined on the fallback step itself
   - **Impact**: Users defining explicit input for the fallback step will be surprised; results may be wrong
   - **Action**: Use fallback step's own input if present; otherwise fall back to the original step's input. Add tests for both cases

9. **Schema "Group" Semantics vs Flat Graph Divergence**
   - **Evidence**: Execution uses a flat dependency graph; ExecutionNode.type allows sequential|parallel and children, but the engine ignores nested groups and group-level maxConcurrency
   - **Impact**: Workflows authored with nested sequential/parallel will not behave as authored
   - **Action**: Decide and document. For MVP, de-scope nested groups explicitly and instruct using dependsOn. If keeping groups, implement expansion to a flat DAG respecting group-level properties

**MEDIUM PRIORITY:**

10. **Resilience Composition Control Not Enforced at Adapter Level**
    - **Evidence**: Commit 4d629ff finalizes default order; engine normalizes policy, but the adapter interface is still applyPolicy(operation, policy, signal?). Composition order relies on the adapter implementation, which isn't codified in the contract
    - **Impact**: Inconsistent behavior across adapters; ambiguity for consumers
    - **Action**: Update ResilienceAdapter contract to accept normalized policies and an explicit compositionOrder (e.g., 'retry-cb-timeout' default). Provide a reference adapter in @orchestr8/resilience

11. **Config Parity: Engine Limits Not Threaded Through Evaluator**
    - **Evidence**: Engine has maxExpansionDepth, maxExpansionSize options; expression-evaluator.ts uses local SECURITY_LIMITS
    - **Impact**: Tuning engine options won't affect expression evaluation; limits drift
    - **Action**: Thread engine limits to evaluator (function params or context) and remove hard-coded constants. Add tests for non-defaults

12. **Environment Whitelist Duplication/Inconsistency**
    - **Evidence**: Evaluator uses workflow.allowedEnvVars; engine carries an unused envWhitelist?: string[] with TODO
    - **Impact**: Two sources of truth; potential security confusion
    - **Action**: Choose one (recommend schema-driven workflow.allowedEnvVars) and remove/bridge the other. Document precedence

13. **Condition Error Handling Defaults to "Silent False"**
    - **Evidence**: evaluateCondition() returns false on invalid expressions in non-strict mode; engine's default strictConditions is false
    - **Impact**: Typos in conditions silently skip steps; harder to debug
    - **Action**: Consider defaulting strictConditions to true for runtime safety, or expose a workflow-level toggle. Add tests for invalid conditions raising VALIDATION errors when strict

**LOW PRIORITY:**

14. **"True" Preemptive Timeout Not Actually Preemptive**
    - **Evidence**: JMESPath search is synchronous; evaluateWithTimeout checks elapsed time after evaluation. It can't interrupt a long evaluation mid-flight
    - **Impact**: Small with JMESPath (fast), but spec text overpromises
    - **Action**: Update docs to "post-check timeout" or explore Worker-based evaluation for real preemption if needed

15. **Unused Type Fields and Implementation Drift**
    - **Evidence**: ExecutionNode.children, types for group nodes are unused; maxMetadataBytes isn't enforced anywhere
    - **Impact**: Minor maintenance cost and confusion
    - **Action**: Remove or wire these, and add tests or docs

16. **Memory Truncation UX**
    - **Evidence**: truncateResult marks truncated: true and omits output; only size metadata is kept
    - **Impact**: Consumers can't inspect partial output
    - **Action**: Consider retaining a safe preview (e.g., JSON string prefix) under a documented policy. Keep current default for safety

### Phase 3: Polish & Optimization (FUTURE)

1. **Expression Cache Optimization** - Pre-parse and validate expression caching
2. **Environment Whitelist Cleanup** - Wire or remove unused envWhitelist in InternalExecutionContext
3. **Documentation** - Document Map insertion order invariants for deterministic scheduling

## Out of Scope

- Resilience patterns (retry, timeout, circuit breaker) - handled by @orchestr8/resilience package
- Agent implementation details - handled by @orchestr8/agent-base package
- Workflow validation - handled by @orchestr8/schema package
- Execution journaling - will be added in a separate spec
- REST API endpoints - planned for Phase 3
- Observability beyond logs (metrics/traces) - tracked separately

## Architectural Decision: Nested Step Types

**Current State**: The @orchestr8/schema defines `SequentialStep` and `ParallelStep` types with optional `maxConcurrency`, but the engine implements a **flat dependency graph** model using only `dependsOn` relationships.

**Gap**: Nested groups are not traversed/executed; group-level `maxConcurrency` is not honored.

**Decision Required**:

- **Option A**: Implement group expansion layer with proper nested execution
- **Option B**: Explicitly de-scope nested groups for MVP and document "use dependsOn for sequencing/parallelism"

**Recommendation**: For MVP simplicity, choose Option B - flatten all workflows to dependency-graph only execution. Document this limitation and plan nested groups for post-MVP if needed.

**Impact**: Current engine behavior is consistent but doesn't fully match schema capabilities. This should be explicitly documented to avoid confusion.

## Expected Deliverable

### Phase 1 (✅ Delivered):

1. Working orchestration engine executing sequential and parallel workflows
2. Integration with @orchestr8/schema workflow definitions
3. Test coverage for core execution patterns

### Phase 2 (✅ Mostly Complete):

1. Hardened cancellation and timeout enforcement ✅
2. Complete expression security with size limits ✅
3. Structured logging implementation with correlation ✅
4. Comprehensive test coverage >80% with edge cases ✅

### Next Actions Required (Priority Order):

**High Priority (Implementation Gaps):**
1. Fix fallback input precedence (fallback step input > original input); add tests
2. Decide nested groups architecture: implement group expansion OR explicitly de-scope and document dependsOn-only approach

**Medium Priority (Technical Consistency):**  
3. Update ResilienceAdapter contract to accept policies and compositionOrder; add reference adapter
4. Thread engine security limits to evaluator; remove hard-coded constants
5. Unify env var whitelist (choose schema field) and remove duplicate engine field  
6. Consider default strictConditions: true (or expose workflow-level flag) and test invalid expressions → VALIDATION

**Low Priority (Polish):**
7. Clarify docs on condition "timeout" behavior; optionally explore Worker-based preemption
8. Clean up unused types/fields (children, maxMetadataBytes) or wire them and add tests
9. Consider retaining safe preview for truncated results

### Phase 3 (Future):

1. Performance optimizations (<100ms p95 overhead)
2. Complete documentation and invariants

## Spec Documentation

### Phase 0 Prerequisites (Complete Before Implementation)

- **Pre-Implementation Gap Analysis**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/pre-implementation-gap-analysis.md
- **Repository Prerequisites**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/repository-prerequisites.md
- **Implementation Readiness Checklist**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/implementation-readiness.md
- **Schema Semantics Alignment**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/schema-semantics-alignment.md

### Implementation Documentation

- **Tasks**: @.agent-os/specs/2025-08-18-core-orchestration-engine/tasks.md
- **Technical Specification**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/technical-spec.md
- **Engine Contracts**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/engine-contracts.md
- **Tests Specification**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/tests.md
- **Structured Logging**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/structured-logging.md
- **Dependency Semantics**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/dependency-semantics.md
