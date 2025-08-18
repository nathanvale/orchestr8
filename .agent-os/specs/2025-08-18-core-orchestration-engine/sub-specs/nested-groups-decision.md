# Nested Groups Decision Document

> Decision ID: DEC-002
> Created: 2025-08-18
> Status: Accepted
> Category: Technical Architecture
> Related Task: 10 - Nested Step Types Semantics

## Summary

For MVP, nested group execution (SequentialStep/ParallelStep with child steps) has been **de-scoped** in favor of a flat dependency graph approach using `dependsOn` relationships.

## Problem Statement

The @orchestr8/schema defined `SequentialStep` and `ParallelStep` types that promised nested execution with child `steps[]` arrays, but the orchestration engine only implemented flat dependency graph execution. This created a significant gap between API promises and actual behavior.

### Evidence of the Gap

1. **Schema Promise**: `SequentialStep.steps: WorkflowStep[]` and `ParallelStep.maxConcurrency`
2. **Engine Reality**: Only processed root-level steps, ignored nested children
3. **Silent Failures**: Workflows with nested groups appeared to work but child steps never executed
4. **Testing Impact**: `createHybridWorkflow()` and group-based utilities were broken

## Decision Options Evaluated

### Option A: Implement Group Expansion Layer

- **Pros**: Schema consistency, intuitive authoring, group-level policies
- **Cons**: 200-300 lines additional complexity, performance overhead, delayed MVP
- **Estimated Effort**: 3-5 days additional development + testing

### Option B: De-scope Nested Groups for MVP ✅ **SELECTED**

- **Pros**: Maintains proven architecture, no implementation risk, clear MVP boundary
- **Cons**: Schema breaking change, requires utility updates
- **Estimated Effort**: 1-2 days cleanup and documentation

## Rationale

**MVP Focus**: The current flat dependency graph model is proven, well-tested, and sufficient for Phase 1 requirements. Adding recursive group execution introduces complexity that could jeopardize the MVP timeline.

**Risk Mitigation**: Nested group execution involves edge cases (error handling in groups, memory bounds across nested levels, cancellation propagation) that are better addressed post-MVP with user feedback.

**Clear API Contract**: Better to have a clear, limited API that works perfectly than an expansive API that has gaps.

## Implementation Changes Made

### Schema Updates (`packages/schema/src/workflow.ts`)

```typescript
// BEFORE (Broken Promise)
export interface SequentialStep extends BaseStep {
  type: 'sequential'
  steps: WorkflowStep[] // ❌ Not implemented in engine
}

// AFTER (Clear MVP Boundaries)
export interface SequentialStep extends BaseStep {
  type: 'sequential'
  steps?: never // ✅ TypeScript prevents usage
}
```

### Validation Updates (`packages/schema/src/validators.ts`)

- Added runtime checks to prevent nested group usage
- Clear error messages directing users to `dependsOn` approach
- Removed recursive step validation logic

### Testing Utilities (`packages/testing/src/utilities/workflow-builder.ts`)

- **`addSequentialGroup()`**: Creates dependency chains automatically
- **`addParallelGroup()`**: Adds steps with shared dependencies
- **`createHybridWorkflow()`**: Uses proper dependency references

### Example: Sequential to Dependency Chain

```typescript
// OLD (Nested Groups - Broken)
.addSequentialGroup('seq-group', [
  createAgentStep('step-1', 'agent-1'),
  createAgentStep('step-2', 'agent-2'),
  createAgentStep('step-3', 'agent-3')
])

// NEW (Dependency Chain - Works)
.addSequentialGroup('seq-group', [
  createAgentStep('step-1', 'agent-1'),           // no dependencies
  createAgentStep('step-2', 'agent-2'),           // depends on step-1
  createAgentStep('step-3', 'agent-3')            // depends on step-2
])
```

## Post-MVP Implementation Plan

### Phase 1: Schema Evolution Strategy

- Add `@deprecated` warnings to current group types
- Introduce `NestedSequentialStep` and `NestedParallelStep` types for future use
- Maintain backward compatibility with dependency-based approach

### Phase 2: Group Expansion Algorithm Design

- **Input**: Nested workflow tree with groups and steps
- **Process**: Recursive traversal generating dependency relationships
- **Output**: Flat dependency graph for existing engine
- **Policies**: Group-level `maxConcurrency` and resilience inheritance

### Phase 3: Implementation Requirements

- Recursive step traversal and flattening
- Group-level policy inheritance (resilience, concurrency)
- Enhanced error handling for group failures
- Memory bounds across nested levels
- Comprehensive test coverage for nested scenarios

### Estimated Post-MVP Effort: 1-2 weeks

- Algorithm design: 2-3 days
- Implementation: 5-7 days
- Testing & validation: 3-5 days
- Documentation: 1-2 days

## Migration Guide

### For Current Users

**Before (Will TypeScript Error):**

```typescript
const workflow = new WorkflowBuilder().addParallelGroup(
  'parallel',
  [createAgentStep('step-1', 'agent-1'), createAgentStep('step-2', 'agent-2')],
  { maxConcurrency: 2 },
) // ❌ maxConcurrency not available
```

**After (MVP Approach):**

```typescript
const workflow = new WorkflowBuilder()
  .withMaxConcurrency(2) // ✅ Use workflow-level concurrency
  .addParallelGroup('parallel', [
    createAgentStep('step-1', 'agent-1'),
    createAgentStep('step-2', 'agent-2'),
  ])
```

### Manual Dependency Approach

For complex scenarios, use explicit `dependsOn`:

```typescript
const workflow = new WorkflowBuilder()
  .addAgentStep('init', 'init-agent')

  // Parallel group depending on init
  .addAgentStep('parallel-1', 'agent-1', { dependsOn: ['init'] })
  .addAgentStep('parallel-2', 'agent-2', { dependsOn: ['init'] })

  // Sequential chain depending on parallel completion
  .addAgentStep('seq-1', 'agent-3', { dependsOn: ['parallel-1', 'parallel-2'] })
  .addAgentStep('seq-2', 'agent-4', { dependsOn: ['seq-1'] })

  .addAgentStep('cleanup', 'cleanup-agent', { dependsOn: ['seq-2'] })
```

## Success Metrics

✅ **Completed:**

- Schema accurately reflects engine capabilities (no false promises)
- TypeScript prevents nested group usage at compile time
- Runtime validation provides clear error messages
- All existing tests pass with updated approach
- Testing utilities work with dependency-based approach

✅ **Validated:**

- `createHybridWorkflow()` generates correct dependency structure
- Sequential chains execute in proper order
- Parallel groups execute concurrently
- Complex dependency patterns work as expected

## Future Considerations

1. **User Feedback**: Monitor demand for nested groups in real usage
2. **Performance**: Measure if group expansion overhead is acceptable
3. **Complexity**: Assess if recursive execution complexity is warranted
4. **Alternatives**: Consider builder patterns or workflow DSL improvements

---

_This decision maintains MVP timeline while establishing clear boundaries and future evolution path for @orchestr8 nested group functionality._
