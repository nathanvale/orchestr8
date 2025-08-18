# Spec Requirements Document

> Spec: Core Orchestration Engine - Sequential and Parallel Execution
> Created: 2025-08-18
> Status: In Progress - Phase 2 Hardening
> Last Updated: 2025-08-18

## Overview

Implement the core orchestration engine that executes multi-step workflows with both sequential and parallel execution patterns. This engine is the foundation of the @orchestr8 platform, enabling reliable coordination of agent tasks with proper dependency management and execution flow control.

**CURRENT STATUS**: Phase 1 core implementation COMPLETE. Phase 2 hardening in progress.

**✅ Phase 1 Complete (Core Engine):**

- OrchestrationEngine class fully implemented (859 lines)
- Workflow execution with sequential/parallel patterns
- Dependency resolution with topological sorting
- Memory-bounded execution (512KB limits)
- Strict condition mode support
- Fallback aliasing semantics
- Retry default policies

**🔧 Phase 2 In Progress (Hardening):**

- Cancellation propagation improvements needed
- Expression expansion limits enforcement
- Dependency failure semantics clarification
- Resilience composition order finalization
- Structured logging implementation

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

### Phase 2: Hardening & Reliability (🔧 IN PROGRESS)

**Critical (Blocking Issues):**

1. **Cancellation Propagation** - Merge parent AbortSignal with level controller using AbortSignal.any

**High Priority:** 2. **True Timeout Enforcement** - Implement preemptive cancellation for expression evaluation (500ms limit) 3. **Expression Expansion Limits** - Enforce 64KB max size during mapping resolution with byte counting 4. **Dependency Failure Semantics** - Define and implement skip behavior for failed/cancelled dependencies

**Medium Priority:** 5. **Structured Logging** - Wire Logger interface and emit lifecycle events (see sub-spec: `sub-specs/structured-logging.md`) 6. **Resilience Composition** - Finalize order between retry/timeout/circuit breaker with consistent defaults 7. **Mapping Parser Robustness** - Support quoted defaults and handle nested ?? expressions

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

## Expected Deliverable

### Phase 1 (✅ Delivered):

1. Working orchestration engine executing sequential and parallel workflows
2. Integration with @orchestr8/schema workflow definitions
3. Test coverage for core execution patterns

### Phase 2 (In Progress):

1. Hardened cancellation and timeout enforcement
2. Complete expression security with size limits
3. Structured logging implementation with correlation
4. Comprehensive test coverage >80% with edge cases

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
