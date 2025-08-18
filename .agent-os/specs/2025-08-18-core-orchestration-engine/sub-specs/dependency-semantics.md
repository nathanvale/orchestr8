# Dependency Failure Semantics

> Created: 2025-08-18
> Status: ✅ IMPLEMENTED
> Scope: @orchestr8/core step dependency resolution
> Implementation Date: 2025-08-18

## Purpose

Define clear semantics for step execution when dependencies are in various failure states. ✅ **COMPLETED**: Implemented Option A (skip on any non-completed dependency) with comprehensive test coverage.

## ✅ Implemented Behavior

Steps are skipped when ANY dependency is not in "completed" status, with fallback aliasing support:

```typescript
// ✅ IMPLEMENTED - Current behavior
for (const dep of node.dependsOn) {
  const depResult = context.results.get(dep)
  if (!depResult || depResult.status !== 'completed') {
    // Check if there's a successful fallback that aliases for this dependency
    const hasSuccessfulFallback = Array.from(context.results.values()).some(
      (r) => r.aliasFor === dep && r.status === 'completed',
    )

    if (!hasSuccessfulFallback) {
      // Skip this step if dependency not completed and no successful fallback
      return {
        stepId: node.stepId,
        status: 'skipped',
        skipReason: 'dependency-not-completed',
        startTime,
        endTime: new Date().toISOString(),
      }
    }
  }
}
```

## Proposed Semantics

### Option A: Skip on Any Non-Success (RECOMMENDED)

Skip a step if ANY dependency is not in "completed" state:

```typescript
if (step.dependsOn?.some(dep => {
  const status = results.get(dep)?.status
  return status !== 'completed'
})) {
  // Skip this step with appropriate reason
  return {
    status: 'skipped',
    skipReason: 'dependency-not-completed',
    ...
  }
}
```

**Rationale:**

- Simple mental model: steps only run when ALL dependencies succeeded
- Prevents cascade of failures from propagating
- Aligns with fail-fast philosophy
- Clear and predictable behavior

### Option B: Differentiated Handling

Different behavior based on dependency status:

```typescript
const failedDeps = step.dependsOn?.filter(dep =>
  results.get(dep)?.status === 'failed'
)
const cancelledDeps = step.dependsOn?.filter(dep =>
  results.get(dep)?.status === 'cancelled'
)
const skippedDeps = step.dependsOn?.filter(dep =>
  results.get(dep)?.status === 'skipped'
)

if (failedDeps.length > 0) {
  // Fail this step due to dependency failure
  return {
    status: 'failed',
    error: { code: 'DEPENDENCY_FAILED', ... }
  }
} else if (cancelledDeps.length > 0) {
  // Cancel this step due to dependency cancellation
  return {
    status: 'cancelled',
    error: { code: 'DEPENDENCY_CANCELLED', ... }
  }
} else if (skippedDeps.length > 0) {
  // Skip this step due to dependency skip
  return { status: 'skipped', ... }
}
```

**Rationale:**

- Preserves failure context through the graph
- Allows different handling strategies per status
- More complex but more flexible

## Impact Analysis

### Option A Impact:

- **Pros:**
  - Simpler implementation and testing
  - Easier to reason about workflow behavior
  - Natural circuit breaking on failures
- **Cons:**
  - Less granular error reporting
  - May hide root cause of failures

### Option B Impact:

- **Pros:**
  - Rich error propagation
  - Can implement different recovery strategies
  - Better debugging information
- **Cons:**
  - More complex state machine
  - Harder to predict workflow behavior
  - More test scenarios needed

## Decision Criteria

1. **Simplicity vs Flexibility**: Do we prioritize simple, predictable behavior or rich error handling?
2. **User Experience**: What helps users debug failed workflows more effectively?
3. **Recovery Strategies**: Do we need different recovery paths for different failure types?
4. **Consistency**: How does this align with other workflow engines (GitHub Actions, Airflow, etc.)?

## Recommendation

**Adopt Option A** for the following reasons:

1. **Predictability**: Users can easily understand that steps run only when all dependencies succeed
2. **Fail-Fast**: Aligns with the fail-fast philosophy already implemented for parallel execution
3. **Simplicity**: Reduces cognitive load and testing complexity
4. **Industry Standard**: Most workflow engines use this simpler model

## Implementation Tasks

1. Update step execution logic to check for `status !== 'completed'`
2. Add `skipReason` field to StepResult for better debugging
3. Update tests to verify new skip semantics
4. Document behavior clearly in API documentation

## Test Scenarios

Required test coverage:

1. Step with failed dependency → skipped
2. Step with cancelled dependency → skipped
3. Step with skipped dependency → skipped
4. Step with mixed statuses (some completed, some failed) → skipped
5. Step with all completed dependencies → executes normally
6. Multi-level dependency chains with various failure modes

## ✅ Acceptance Criteria

- [x] **Clear decision documented and approved** - Option A implemented
- [x] **Implementation matches chosen semantics** - Skip on any non-completed dependency
- [x] **All test scenarios pass** - 7 comprehensive test cases added
- [x] **Documentation updated** - This document and technical spec updated
- [x] **No regression in existing tests** - All 71 tests passing
- [x] **Fallback compatibility** - Works correctly with fallback aliasing mechanism
- [x] **skipReason field added** - Enhanced debugging with specific skip reasons
- [x] **onError: continue support** - Workflow failure logic respects continue directive

## ✅ Implementation Summary

**Key Features Implemented:**

1. **Dependency Check Logic**: Steps skip when `status !== 'completed'`
2. **Fallback Support**: Successful fallbacks satisfy dependency requirements
3. **Enhanced Debugging**: `skipReason` field with specific reasons:
   - `'dependency-not-completed'` - Normal dependency failure
   - `'condition-not-met'` - Conditional execution skipped
   - `'level-failure'` - Skip due to level failure (fail-fast)
   - `'workflow-cancelled'` - Skip due to workflow cancellation
4. **onError Integration**: `onError: 'continue'` prevents workflow failure
5. **Comprehensive Testing**: All dependency failure scenarios covered

**Test Coverage:**

- ✅ Step with failed dependency → skipped
- ✅ Step with cancelled dependency → skipped
- ✅ Step with skipped dependency → skipped
- ✅ Step with mixed statuses → skipped
- ✅ Step with all completed dependencies → executes normally
- ✅ Multi-level dependency chains with failures
- ✅ Special case: onError: continue prevents level failure

**Files Modified:**

- `packages/schema/src/workflow.ts` - Added `skipReason?: string` to StepResult
- `packages/core/src/orchestration-engine.ts` - Updated dependency logic and failure detection
- `packages/core/src/orchestration-engine.test.ts` - Added 7 comprehensive test cases
