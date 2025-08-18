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

**🔧 Remaining Medium Priority (1 item):**

- Mapping parser robustness improvements

**✅ Recently Completed:**

- Resilience composition order finalization ✅

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

**New Technical Gaps Identified:**

8. **Nested Step Types vs Flat Execution** - Schema defines SequentialStep/ParallelStep but engine uses flat dependency graph
9. **Configuration Parity** - OrchestrationOptions limits not threaded through to evaluator (uses hard-coded limits)
10. **Environment Whitelist Inconsistency** - Evaluator uses workflow.allowedEnvVars but engine has unused envWhitelist

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

### Remaining Items (Medium Priority):

1. Resilience composition order finalization
2. Mapping parser robustness improvements  
3. Nested step semantics decision (implement or de-scope)
4. Configuration parity for evaluator limits

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
