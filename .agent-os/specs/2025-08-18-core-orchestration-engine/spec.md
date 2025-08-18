# Spec Requirements Document

> Spec: Core Orchestration Engine - Sequential and Parallel Execution
> Created: 2025-08-18
> Status: Planning

## Overview

Implement the core orchestration engine that executes multi-step workflows with both sequential and parallel execution patterns. This engine will be the foundation of the @orchestr8 platform, enabling reliable coordination of agent tasks with proper dependency management and execution flow control.

**CURRENT STATUS**: Phase 0 is **PARTIALLY COMPLETE** with critical contract misalignments identified:
- ✅ Repository prerequisites met (Node >=20, jmespath, engines)
- ✅ Error taxonomy aligned with ExecutionError structure
- ❌ API contracts misaligned (Agent, AgentRegistry, ResilienceAdapter)
- ❌ Expression evaluator has implementation bugs
- ❌ Naming inconsistencies (dependsOn vs dependencies)
- ❌ Status taxonomy mismatch (completed vs success)

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

### Phase 0.5: Contract Alignment & Bug Fixes (IMMEDIATE)

1. **Fix Expression Evaluator Bugs** - Replace compile with search, fix depth tracking, add prototype guards, enforce 500ms timeout
2. **Align API Contracts** - Standardize Agent.execute signature, choose sync/async for AgentRegistry, align ResilienceAdapter
3. **Unify Naming Conventions** - Use `dependsOn` consistently, align status values to `completed/failed/skipped/cancelled`
4. **Update Integration Mocks** - Ensure MockAgentRegistry and MockResilienceAdapter match chosen contracts

### Phase 1: Core Implementation (After Contract Alignment)

1. **Workflow AST Execution** - Parse and execute workflow definitions with sequential and parallel node types
2. **Dependency Resolution** - Analyze workflow graphs to determine execution order and parallelization opportunities
3. **Execution Context Management** - Maintain execution state, correlation IDs, and data flow between workflow steps
4. **Result Collection** - Collect results from parallel branches before proceeding to dependent steps
5. **Error Handling** - Implement proper error propagation and workflow termination on failures
6. **Memory Safety** - 512KB per-step output cap with JSON-safe serialization and truncation metadata

## Out of Scope

- Resilience patterns (retry, timeout, circuit breaker) - handled by @orchestr8/resilience package
- Agent implementation details - handled by @orchestr8/agent-base package
- Workflow validation - handled by @orchestr8/schema package
- Execution journaling - will be added in a separate spec
- REST API endpoints - planned for Phase 3

## Expected Deliverable

1. A working orchestration engine that can execute both sequential and parallel workflows defined in the workflow AST format
2. Comprehensive test coverage demonstrating execution of complex workflow patterns with proper result handling
3. Integration with existing @orchestr8/schema workflow definitions and validation

## Spec Documentation

### Phase 0 Prerequisites (Complete Before Implementation)

- **Pre-Implementation Gap Analysis**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/pre-implementation-gap-analysis.md
- **Repository Prerequisites**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/repository-prerequisites.md
- **Implementation Readiness Checklist**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/implementation-readiness.md
- **Schema Semantics Alignment**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/schema-semantics-alignment.md

### Implementation Documentation (Phase 1)

- **Tasks**: @.agent-os/specs/2025-08-18-core-orchestration-engine/tasks.md
- **Technical Specification**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/technical-spec.md
- **Engine Contracts**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/engine-contracts.md
- **Tests Specification**: @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/tests.md
