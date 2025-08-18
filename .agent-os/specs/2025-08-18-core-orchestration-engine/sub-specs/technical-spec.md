# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-18-core-orchestration-engine/spec.md

> Created: 2025-08-18
> Version: 3.0.0
> Updated: 2025-08-18
> Status: **CRITICAL GAPS IDENTIFIED** - Core engine implementation missing

## Critical Implementation Gaps Identified

**❌ MISSING CORE IMPLEMENTATION:**
- **OrchestrationEngine Class**: Main engine class not implemented - blocks all workflow execution
- **Workflow Graph Building**: buildExecutionGraph() method missing - cannot parse or analyze workflows  
- **Step Execution Logic**: executeStep() and executeLevel() methods missing - no step coordination
- **Dependency Resolution**: scheduleSteps() deterministic scheduling missing - no execution order planning
- **Parallel Execution**: Promise.all coordination and fail-fast semantics missing - no concurrent execution
- **Memory Bounds**: Result truncation and size enforcement not implemented - no memory safety

**⚠️ IMPLEMENTATION INCONSISTENCIES:**
- **Condition Error Handling**: Code returns false on errors vs spec requirement for ExecutionError with VALIDATION code  
- **Expression Mapping**: Naive parser splits on '??' without handling quoted defaults or nested expressions properly
- **Security Limits**: 64KB expansion size limit defined but never enforced during mapping resolution
- **Error Taxonomy**: Schema validation throws generic Error instead of ExecutionError with VALIDATION code
- **ResilienceAdapter API**: Composition order approach needs final decision between Option A (apply/applyGlobalPolicies) vs Option B (applyPolicy only)

## Technical Requirements

- **OrchestrationEngine Class**: Implement main engine with execute() method coordinating complete workflow execution
- **Execution Graph Builder**: Parse workflow AST and construct dependency graph with cycle detection and topological sorting
- **Deterministic Scheduler**: Implement scheduleSteps() with dependency-count + index-based stable ordering for parallel readiness
- **Parallel Execution Manager**: Implement executeLevel() with Promise.all, fail-fast semantics, and AbortSignal.any cancellation  
- **Memory Management**: Enforce 512KB per-step limits with JSON-safe serialization, circular reference handling, and truncation metadata
- **Context Threading**: Maintain ExecutionContext with correlation IDs, result collection, and data flow between workflow steps
- **Cancellation Support**: Implement AbortSignal propagation with grace periods and deterministic cleanup throughout execution chain
- **Error Classification**: Ensure all error paths use ExecutionError taxonomy with appropriate codes (VALIDATION, TIMEOUT, CANCELLED, etc.)

## Approach Options

**Option A: Event-Driven Architecture**

- Pros: Highly scalable, decoupled components, natural async handling
- Cons: Complex debugging, potential race conditions, harder to reason about

**Option B: Direct Function Call Architecture** (Selected)

- Pros: Simple to understand, easy to debug, synchronous reasoning about flow
- Cons: Less scalable for very large workflows, tighter coupling

**Option C: Generator-Based Execution**

- Pros: Natural step-by-step execution, good memory characteristics
- Cons: Complex implementation, limited TypeScript support for advanced patterns

**Rationale:** Option B provides the best balance of simplicity and functionality for MVP. The direct function call approach aligns with the team's preference for readable, maintainable code while still supporting the required sequential and parallel execution patterns.

## Enhanced Type Contracts

### StepResult - ALIGNED WITH SCHEMA

Result container for individual step execution with status tracking:

```typescript
interface StepResult {
  stepId: string  // Use 'stepId' not 'id'
  status: 'completed' | 'failed' | 'skipped' | 'cancelled'  // Use 'completed' not 'success'
  output?: unknown
  error?: ExecutionError
  startTime: string  // ISO string format
  endTime: string    // ISO string format
  attempts?: number
  
  // Memory truncation metadata
  truncated?: boolean
  originalSize?: number
  retainedBytes?: number
}
```

### ExecutionError

Structured error taxonomy exactly matching @orchestr8/schema:

```typescript
interface ExecutionError {
  code:
    | 'TIMEOUT'
    | 'CIRCUIT_OPEN'
    | 'CANCELLED'
    | 'VALIDATION'
    | 'RETRYABLE'
    | 'UNKNOWN'
  message: string
  cause?: unknown
  stepId?: string
  attempt?: number
  retryable?: boolean
}
```

**Error Classification Guidelines:**

- `VALIDATION`: Schema violations, cycle detection, missing dependencies, expression security violations
- `TIMEOUT`: Step timeout, workflow timeout, or expression evaluation timeout
- `CIRCUIT_OPEN`: Circuit breaker in open state preventing execution
- `CANCELLED`: Execution cancelled via AbortSignal propagation
- `RETRYABLE`: Transient failures eligible for retry (network, temporary service issues)
- `UNKNOWN`: Unclassified errors (minimize usage, log for analysis and taxonomy improvements)

### ExecutionContext

Enhanced context with memory bounds and result retention:

```typescript
interface ExecutionContext {
  correlationId: string
  abortSignal: AbortSignal
  results: Map<string, StepResult>
  metadata: Record<string, unknown>
  // Memory safety (UTF-8 byte size measurement)
  maxResultBytesPerStep: number // Default: 512KB (524,288 bytes)
  maxMetadataBytes: number // Default: 128KB (131,072 bytes)
  // Environment whitelist
  envWhitelist?: string[] // For ${env.*} expression access
}
```

**Memory Measurement:**

- Size calculated as UTF-8 byte length: `Buffer.byteLength(JSON.stringify(value), 'utf8')`
- Non-JSON serializable values handled with circular reference safety
- Truncation adds metadata: `{truncated: true, originalSize: bytes, retainedBytes: bytes}`

### ExecutionGraph

Internal representation with topological sorting for deterministic scheduling:

```typescript
interface ExecutionGraph {
  nodes: Map<string, WorkflowStep>
  dependencies: Map<string, Set<string>>
  levels: Array<Array<WorkflowStep>> // Topologically sorted levels for parallel execution
}
```

### WorkflowResult - ALIGNED WITH SCHEMA

Complete workflow execution result:

```typescript
interface WorkflowResult {
  executionId: string
  status: 'completed' | 'failed' | 'cancelled'  // Use 'completed' not 'success'
  steps: Record<string, StepResult>  // Use Record not Array
  variables: Record<string, unknown>
  errors?: ExecutionError[]
  startTime: string  // ISO string format
  endTime: string    // ISO string format
  duration: number  // milliseconds
}
```

## Core Components

### OrchestrationEngine Class (❌ NOT IMPLEMENTED)

**Current Status**: Class does not exist in @orchestr8/core - this is a critical blocking issue for MVP delivery.

**Required Implementation**: Main engine class that coordinates complete workflow execution:

```typescript
class OrchestrationEngine {
  // Main execution entry point - MISSING
  async execute(
    workflow: Workflow,
    context: ExecutionContext,
  ): Promise<WorkflowResult>
  
  // Graph construction and analysis - MISSING  
  private buildExecutionGraph(workflow: Workflow): ExecutionGraph
  
  // Parallel level execution with fail-fast - MISSING
  private executeLevel(
    steps: WorkflowStep[],
    context: ExecutionContext,
  ): Promise<StepResult[]>
  
  // Individual step execution with resilience - MISSING
  private executeStep(
    step: WorkflowStep,
    context: ExecutionContext,
  ): Promise<StepResult>
  
  // Deterministic scheduling algorithm - MISSING
  private scheduleSteps(
    steps: WorkflowStep[],
    completed: Set<string>,
  ): WorkflowStep[]
  
  // Execution tracking - MISSING
  getExecutionId(): string
}
```

**Impact**: Without this class, no workflows can be executed. This blocks the entire MVP Phase 1 deliverable.

## Execution Semantics

### Deterministic Scheduling

When multiple steps are ready for execution (all dependencies met), the following rules determine execution order:

1. **Primary sort: dependency count ascending** - Steps with fewer dependencies execute first
2. **Tiebreaker: original steps[] index** - Earlier in workflow definition executes first
3. **Stable sort** - Maintains relative order when priorities are equal

```typescript
private scheduleSteps(steps: WorkflowStep[], completed: Set<string>): WorkflowStep[] {
  const ready = steps.filter(step =>
    // CRITICAL: Dependencies must be COMPLETED, not just "not running"
    step.dependencies.every(dep => completed.has(dep))
  )

  return ready.sort((a, b) => {
    // Primary: dependency count (ascending) - fewer dependencies first
    const depDiff = a.dependencies.length - b.dependencies.length
    if (depDiff !== 0) return depDiff

    // Tiebreaker: original array index (stable, deterministic)
    return steps.indexOf(a) - steps.indexOf(b)
  })
}
```

**Critical Implementation Note:** The readiness check validates that dependencies are COMPLETED, not just "not running" status. This ensures deterministic scheduling and prevents race conditions in execution ordering.

### Parallel Failure Semantics

**Default behavior (fail-fast within levels):**

- If any step in a parallel level fails with `onError: 'fail'` (default), short-circuit remaining steps in same level
- Issue `abortSignal` to cancel running parallel branches
- Aggregate all errors from the failed level
- Mark workflow as failed

**Cancellation Timing and Order:**

1. **On first failure** within parallel level with `onError: 'fail'`:
   - Immediately signal `AbortSignal.any` for remaining peers in that level
   - Start grace period timer (`GlobalPolicies.cancellation.gracePeriod`, default: 5000ms)
2. **During grace period**:
   - Running steps receive abort signal and can perform cleanup
   - Steps that complete cleanly are recorded with their results
3. **After grace period expires**:
   - Force abort any still-running steps
   - Mark forced-aborted steps as 'cancelled' with CANCELLED error
4. **Downstream prevention**:
   - No downstream levels start until error resolution completes
   - Prevents cascading failures and ensures deterministic cleanup

**Error handling by `onError` policy:**

- **`fail`**: Stop execution, propagate failure (default)
- **`continue`**: Skip step, mark as skipped, proceed to next levels
- **`retry`**: Integrate with resilience patterns, fail after attempts exhausted
- **`fallback`**: Execute `fallbackStepId`, use result to satisfy dependencies

### Fallback Result Aliasing

**Fallback execution semantics:**

- When `stepX` fails and has `onError: 'fallback'` with `fallbackStepId: 'stepY'`:
  1. Execute `stepY` with same input context as `stepX`
  2. If `stepY` succeeds, alias `stepY.output` as `steps.stepX.output` for dependency resolution
  3. Dependent steps receive fallback result as if original step succeeded
  4. Both original failure and fallback success are recorded in WorkflowResult.stepResults (MVP scope)
- **Fallback failure**: If fallback step also fails, propagate original step's failure
- **Result reporting**: Final WorkflowResult includes both original step failure and fallback step execution details
- **Aliasing metadata**: Fallback step result includes `aliasFor: 'stepX'` property to indicate it's serving as a replacement for the failed step
- **Memory scope**: Persistent journaling deferred to separate spec; MVP uses in-memory WorkflowResult.stepResults only

### Concurrency Management

**Semaphore-based limiting:**

- Global workflow concurrency limit: `policies.concurrency.maxConcurrentSteps` (default: 10)
- Enforced across entire workflow, not just within levels
- Lightweight semaphore implementation for resource protection

### Resilience Composition Order

**Composition Order Mapping:**

- `'retry-cb-timeout'` (default): `retry(circuitBreaker(timeout(operation)))`
  - Retry wraps circuit breaker, which wraps timeout, which wraps the operation
  - Retries occur at the outermost level, circuit breaker tracks all attempts
- `'timeout-cb-retry'`: `timeout(circuitBreaker(retry(operation)))`
  - Timeout wraps circuit breaker, which wraps retry, which wraps the operation
  - Overall timeout encompasses all retry attempts

**Implementation:**

```typescript
// Example for 'retry-cb-timeout' (default)
const wrappedOperation = withRetry(
  withCircuitBreaker(
    withTimeout(operation, timeoutPolicy),
    circuitBreakerPolicy,
  ),
  retryPolicy,
)
```

### Condition Evaluation - FIX REQUIRED

**Condition model (schema-aligned):**

- Uses `{ if?, unless? }` structure as defined in current schema
- **Evaluation timing**: Conditions checked after dependency readiness, before step execution
- **Expression language**: JMESPath evaluation only (safe, cached)
- **Execution rules**:
  - `if: "expression"` - Step executes only if JMESPath expression evaluates to truthy
  - `unless: "expression"` - Step executes only if JMESPath expression evaluates to falsy
  - **Both present**: Step executes if `if` is truthy AND `unless` is falsy
  - **Neither present**: Step always executes (after dependencies met)

**JMESPath Context:**

- Full execution context available for path traversal
- `steps.<stepId>.output.*` - Access completed step outputs
- `variables.<name>` - Access workflow context variables
- `env.<name>` - Access environment variables (whitelisted only)
- **Security**: 500ms evaluation timeout enforced with proper error mapping
- **Error handling**: Evaluation errors result in ExecutionError with code VALIDATION

**IMPLEMENTATION STATUS:**
- ✅ Fixed: jmespath.compile() replaced with jmespath.search()
- ✅ Fixed: Proper timeout enforcement implemented with TIMEOUT error  
- ⚠️ **Still Missing**: Condition evaluation error handling inconsistent with spec - returns false instead of throwing ExecutionError with VALIDATION code

### Mapping Expression Security - FIX REQUIRED

**Supported expression patterns:**

- `${steps.<stepId>.output.*}` - Step output references (highest precedence)
- `${variables.<name>}` - Workflow context variable access
- `${env.<name>}` - Environment variable access (lowest precedence, whitelisted)
- `${expression ?? defaultValue}` - Optional default value syntax

**Security enforcement:**

- **Expansion depth limit**: Maximum 10 nested property accesses
- **Expansion size limit**: Maximum 64KB per expanded expression
- **Environment access**: Explicit whitelist for `env.*` expressions only (from ExecutionContext.envWhitelist)
- **Prototype protection**: Prevent `__proto__`, `constructor`, `prototype` access
- **Precedence order**: steps → variables → env (for conflict resolution)

**IMPLEMENTATION STATUS:**
- ✅ Fixed: Depth tracking now uses proper iteration counter instead of indexOf()
- ✅ Fixed: Prototype key guards implemented to block `__proto__`, `constructor`, `prototype`
- ⚠️ **Still Incomplete**: Default value parsing remains naive using split('??') - needs robust parser for quoted defaults
- ⚠️ **Still Missing**: 64KB expansion size limit enforcement not implemented

**Default Value Escaping Rules:**

- Default values in `${path ?? default}` syntax must not contain `}` or `??`
- For defaults with special characters, use quoted syntax: `${path ?? "literal with ?? or }"}`
- MVP constraint: Single-line defaults only, no nested braces
- Escaping violations result in VALIDATION error

**Expression resolution algorithm:**

1. Parse `${expression}` pattern and extract path + optional default
2. Validate path against security rules and depth limits
3. Resolve value using precedence order (steps first, then variables, then env)
4. Apply default value if resolution yields undefined/null
5. Enforce size limits during expansion
6. Replace expression with resolved value in input mapping

**Transform Processing:**

- Applied post-mapping using JMESPath with same security bounds
- Input pipeline: mapping resolution → JMESPath transform → agent execution

### Memory Safety

**Result retention policy:**

- Per-step output size cap: 512KB serialized (configurable via `maxResultBytesPerStep`)
- **Serialization method**: `JSON.stringify()` with circular reference handling
- **Truncation metadata format**: `{truncated: true, originalSize: number, retainedBytes: number}`
- **Pre-truncation filtering**: Apply `step.output.capture` before size checks to minimize retained state
- **Security boundaries**: Expression expansion limited by `maxExpansionDepth: 10` and `maxExpansionSize: 64KB`

## External Dependencies

**Required Dependencies:**

- **jmespath** - For condition evaluation and transform processing (add to @orchestr8/core)
- **@orchestr8/schema** - For Workflow types and validation (already implemented)
- **Node.js built-ins** - Promise.all, AbortSignal, Map, Set (requires Node >=20 for AbortSignal.any)
- **TypeScript** - For type safety and development experience (ES2022+ target required)

**Repository Prerequisites:**

- Node >=20 engines field in package.json files
- TypeScript target ES2022+ for AbortSignal.any support
- Strict mode enabled for noUncheckedIndexedAccess

**Justification:** jmespath provides secure expression evaluation safer than JavaScript eval. Node >=20 requirement enables modern AbortSignal APIs essential for cancellation semantics.

## Integration Contracts

**Test Doubles for Unit Testing:**

- **MockAgentRegistry** - Provides configurable mock agents for testing workflow execution without real agent dependencies (implemented in @orchestr8/testing)
- **MockResilienceAdapter** - Stub implementation of resilience patterns for isolated engine testing (implemented in @orchestr8/testing)
- **Contract Rules**:
  - Agent lookup failures must return ExecutionError with code VALIDATION
  - AbortSignal must propagate through all layers (engine → resilience → agent)
  - Step-level policies override global policies
  - Mock implementations must use `mockImplementation(() => value)` pattern for Wallaby.js compatibility
