# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-18-core-orchestration-engine/spec.md

> Created: 2025-08-18
> Version: 4.0.0
> Updated: 2025-08-18
> Status: **Phase 1 Complete - Phase 2 Hardening In Progress**

## Implementation Status Summary

**✅ PHASE 1 COMPLETE (Core Engine):**

- **OrchestrationEngine Class**: Fully implemented with 859 lines of production code
- **Workflow Graph Building**: buildExecutionGraph() with topological sorting and cycle detection
- **Step Execution Logic**: executeStep() and executeLevel() with parallel coordination
- **Dependency Resolution**: scheduleSteps() with deterministic dependency-count + index ordering
- **Parallel Execution**: Promise.all with fail-fast semantics and level-based cancellation
- **Memory Bounds**: 512KB truncation with byte-accurate binary search implementation

**✅ PHASE 2 COMPLETED (Hardening):**

**Previously Critical (Now Resolved):**

- **Cancellation Propagation**: Parent AbortSignal merged with level controller using AbortSignal.any ✅
- **Timeout Enforcement**: Preemptive cancellation implemented for expression evaluation ✅
- **Expression Expansion**: 64KB limit enforcement added during mapping resolution ✅
- **Dependency Semantics**: Skip behavior for failed/cancelled dependencies implemented ✅
- **Structured Logging**: Logger interface wired into engine with lifecycle events ✅

**🔧 REMAINING GAPS (Medium Priority):**

- **Resilience Composition**: Order between retry/timeout/circuit breaker needs finalization
- **Default Parsing**: Naive split on '??' breaks with quoted/nested expressions
- **Nested Step Types**: Schema defines SequentialStep/ParallelStep but engine uses flat dependency graph  
- **Configuration Parity**: OrchestrationOptions limits not threaded through to evaluator
- **Environment Whitelist**: Inconsistent usage between workflow.allowedEnvVars and engine envWhitelist

## Phase 2 Gap Analysis

### ✅ Resolved Critical Gaps (Previously Blocking)

**1. Cancellation Propagation (RESOLVED ✅)**

- **Previous Issue**: Parent AbortSignal not combined with level AbortController
- **Solution Applied**: AbortSignal.any([parentSignal, levelController.signal]) implemented
- **Location**: orchestration-engine.ts executeLevel() method

**2. True Timeout Enforcement (RESOLVED ✅)**

- **Previous Issue**: Timeout checked after JMESPath execution completes
- **Solution Applied**: Preemptive cancellation implemented for expression evaluation
- **Location**: expression-evaluator.ts evaluateCondition() method

**3. Expression Expansion Limits (RESOLVED ✅)**

- **Previous Issue**: 64KB max expansion size not enforced
- **Solution Applied**: Byte counter added during resolution with VALIDATION error
- **Location**: expression-evaluator.ts resolveMapping() method

**4. Dependency Failure Semantics (RESOLVED ✅)**

- **Previous Issue**: Unclear skip behavior for failed/cancelled dependencies
- **Solution Applied**: Skip behavior implemented for "failed" and "cancelled" statuses
- **Location**: orchestration-engine.ts executeStep() method

**5. Structured Logging (RESOLVED ✅)**

- **Previous Issue**: Logger interface not wired into engine
- **Solution Applied**: Logger option accepted with lifecycle events implementation
- **Location**: Throughout orchestration-engine.ts

### 🔧 Remaining Medium Priority Gaps

**6. Resilience Composition Order**

- **Issue**: Composition order between retry/timeout/circuit breaker unclear
- **Impact**: Inconsistent behavior across different policy combinations
- **Solution**: Finalize order and document clearly
- **Location**: ResilienceAdapter integration points

**7. Mapping Parser Robustness**

- **Issue**: Naive split on '??' breaks with quoted or nested expressions
- **Impact**: Cannot use '??' in default values
- **Solution**: Implement proper tokenizer for default value parsing
- **Location**: expression-evaluator.ts parseExpression() method

### 🆕 New Technical Gaps Identified

**8. Nested Step Types vs Flat Execution**

- **Issue**: Schema defines SequentialStep/ParallelStep but engine uses flat dependency graph
- **Impact**: Nested groups not traversed; maxConcurrency not honored at group level
- **Decision Needed**: Implement group expansion or explicitly de-scope for MVP
- **Location**: Engine architecture decision

**9. Configuration Parity**  

- **Issue**: OrchestrationOptions exposes limits but evaluator uses hard-coded SECURITY_LIMITS
- **Impact**: Engine configuration not threaded through to expression evaluation
- **Solution**: Thread engine limits to evaluator; add tests for non-default limits
- **Location**: expression-evaluator.ts SECURITY_LIMITS usage

**10. Environment Whitelist Source Mismatch**

- **Issue**: Evaluator uses workflow.allowedEnvVars; engine's envWhitelist unused
- **Impact**: Inconsistent environment variable access patterns
- **Solution**: Settle on single approach (workflow.allowedEnvVars recommended)
- **Location**: InternalExecutionContext.envWhitelist vs workflow usage

### Low Priority Items (Technical Debt)

**11. Code Cleanup**

- Unused InternalExecutionContext.envWhitelist (related to gap #10)
- Expression cache only used for deduplication
- Map insertion order invariants undocumented

**12. Build Artifact Cleanup**

- Dist artifacts drift in schema package (dist contains stale zod-based artifacts)
- Solution: Clean dist on build to avoid stale files

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
  stepId: string // Use 'stepId' not 'id'
  status: 'completed' | 'failed' | 'skipped' | 'cancelled' // Use 'completed' not 'success'
  output?: unknown
  error?: ExecutionError
  startTime: string // ISO string format
  endTime: string // ISO string format
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
  status: 'completed' | 'failed' | 'cancelled' // Use 'completed' not 'success'
  steps: Record<string, StepResult> // Use Record not Array
  variables: Record<string, unknown>
  errors?: ExecutionError[]
  startTime: string // ISO string format
  endTime: string // ISO string format
  duration: number // milliseconds
}
```

## Core Components

### OrchestrationEngine Class (✅ IMPLEMENTED)

**Current Status**: Fully implemented in @orchestr8/core with complete workflow execution capabilities.

**Implemented Methods**:

```typescript
class OrchestrationEngine {
  // Main execution entry point - ✅ COMPLETE
  async execute(
    workflow: Workflow,
    context: ExecutionContext,
  ): Promise<WorkflowResult>

  // Graph construction and analysis - ✅ COMPLETE
  private buildExecutionGraph(workflow: Workflow): ExecutionGraph

  // Parallel level execution with fail-fast - ✅ COMPLETE (needs AbortSignal.any fix)
  private executeLevel(
    steps: WorkflowStep[],
    context: ExecutionContext,
  ): Promise<StepResult[]>

  // Individual step execution with resilience - ✅ COMPLETE
  private executeStep(
    step: WorkflowStep,
    context: ExecutionContext,
  ): Promise<StepResult>

  // Deterministic scheduling algorithm - ✅ COMPLETE
  private scheduleSteps(
    steps: WorkflowStep[],
    completed: Set<string>,
  ): WorkflowStep[]

  // Execution tracking - ✅ COMPLETE
  getExecutionId(): string
}
```

**Known Issues to Address**:

- executeLevel() should use AbortSignal.any to merge parent and level signals
- Dependency skip logic needs clarification for failed/cancelled dependencies

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

**Default Composition: retry-cb-timeout** 

The @orchestr8 platform uses `retry(circuitBreaker(timeout(operation)))` as the default composition order, selected for optimal fault isolation and compatibility with industry standards.

**Composition Order Mappings:**

1. **`'retry-cb-timeout'` (Default):** `retry(circuitBreaker(timeout(operation)))`
   - **Execution Flow:** Retry wrapper → Circuit Breaker wrapper → Timeout wrapper → Operation
   - **Timeout Scope:** Each retry attempt gets its own independent timeout window
   - **Circuit Breaker Tracking:** Monitors individual attempt outcomes separately
   - **Total Execution Time:** Can exceed single timeout value (retry count × timeout)

2. **`'timeout-cb-retry'` (Alternative):** `timeout(circuitBreaker(retry(operation)))`
   - **Execution Flow:** Timeout wrapper → Circuit Breaker wrapper → Retry wrapper → Operation
   - **Timeout Scope:** Overall timeout encompasses all retry attempts combined
   - **Circuit Breaker Tracking:** Sees retry attempts within single timeout window
   - **Total Execution Time:** Hard-bounded by timeout value regardless of retry count

**Decision Rationale:**

The default `retry-cb-timeout` composition was chosen for:

1. **Better Fault Isolation:** Individual timeouts prevent one slow attempt from affecting subsequent retry attempts
2. **Industry Compatibility:** Aligns with Polly (.NET), resilience4j (Java), and other major resilience libraries
3. **Predictable Behavior:** Each attempt gets equal opportunity under timeout constraints
4. **Circuit Breaker Accuracy:** Separate tracking of individual attempt outcomes provides better failure rate calculation

**When to Use Alternative:**

Use `timeout-cb-retry` when:
- Hard SLA requirements must be enforced (total execution time cannot exceed timeout)
- Overall system latency budgets are critical
- Circuit breaker should consider retry persistence as part of failure pattern

**Implementation Contract:**

```typescript
// Default implementation in ResilienceAdapter
const wrappedOperation = withRetry(
  withCircuitBreaker(
    withTimeout(operation, timeoutPolicy),
    circuitBreakerPolicy,
  ),
  retryPolicy,
)

// Alternative implementation  
const wrappedOperation = withTimeout(
  withCircuitBreaker(
    withRetry(operation, retryPolicy),
    circuitBreakerPolicy,
  ),
  timeoutPolicy,
)
```

**Policy Normalization:**

All resilience policies are normalized with consistent defaults:

- **Retry Policy:**
  - `maxAttempts`: 3
  - `backoffStrategy`: 'exponential'  
  - `jitterStrategy`: 'full-jitter'
  - `initialDelay`: 1000ms
  - `maxDelay`: 10000ms

- **Circuit Breaker Policy:**
  - `failureThreshold`: 5
  - `recoveryTime`: 30000ms (30s)
  - `sampleSize`: 10
  - `halfOpenPolicy`: 'single-probe'

- **Timeout Policy:** No defaults - must be explicitly specified

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
