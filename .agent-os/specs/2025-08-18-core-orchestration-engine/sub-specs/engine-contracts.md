# Engine Contracts

This document defines the minimal interfaces that the orchestration engine requires to integrate with other @orchestr8 packages.

> Created: 2025-08-18
> Version: 2.0.0
> Updated: 2025-08-19
> Status: **ALIGNMENT REQUIRED** - Mismatches between spec and implementation

## Type Locations

All integration contracts are exported from `@orchestr8/core/contracts`:

- `AgentRegistry` and `Agent` interfaces
- `ResilienceAdapter` and related types
- Mock implementations available in `@orchestr8/testing`

## Agent Registry Interface

The engine needs a way to resolve and invoke agents by their identifier.

### AgentRegistry Contract - DECISION REQUIRED

**Current Misalignment:**
- **Spec**: Synchronous API with `lookup(): Agent | undefined`
- **Code**: Async API with `getAgent(): Promise<Agent>` (throws on not found)

**Decision Options:**

#### Option A: Sync API (Spec Version)
```typescript
interface AgentRegistry {
  lookup(agentId: string): Agent | undefined
  register(agent: Agent): void
  has(agentId: string): boolean
  list(): string[]
}
```
**Pros:** Simple, no async overhead for in-memory registry
**Cons:** Cannot support remote registries

#### Option B: Async API (Code Version)
```typescript
interface AgentRegistry {
  getAgent(agentId: string): Promise<Agent>
  hasAgent(agentId: string): Promise<boolean>
  registerAgent?(agent: Agent): Promise<void>
}
```
**Pros:** Supports remote registries, future-proof
**Cons:** Async overhead for simple cases

### Agent Interface - DECISION REQUIRED

**Current Misalignment:**
- **Spec**: `execute(input: unknown, signal: AbortSignal): Promise<unknown>`
- **Code**: `execute(input: unknown, context: ExecutionContext, signal?: AbortSignal): Promise<unknown>`

**Decision Options:**

#### Option A: Simple Signature (Spec Version)
```typescript
interface Agent {
  readonly id: string
  execute(input: unknown, signal: AbortSignal): Promise<unknown>
}
```
**Pros:** Simple, context can be part of input
**Cons:** Less explicit about context dependency

#### Option B: Context Parameter (Code Version)
```typescript
interface Agent {
  readonly id: string
  readonly name: string
  execute(input: unknown, context: ExecutionContext, signal?: AbortSignal): Promise<unknown>
}
```
**Pros:** Explicit context, more flexible
**Cons:** More complex signature

**RECOMMENDATION**: Use Option B (Code Version) for both - aligns with existing code and provides more flexibility
```

### Integration Points

- **Agent Resolution**: Engine calls `registry.lookup(step.agent.id)`
- **Configuration Injection**: Pass `step.agent.config` as part of input to `agent.execute()`
- **Error Handling**: Missing agents result in `ExecutionError` with code `VALIDATION`
- **Abort Propagation**: AbortSignal passed through to agent execution

## Resilience Adapter Interface

The engine delegates resilience pattern implementation to `@orchestr8/resilience` package.

### ResilienceAdapter Contract - DECISION REQUIRED

**Current Misalignment:**
- **Spec**: `apply()` and `applyGlobalPolicies()` with composition order
- **Code**: `applyPolicy()` with different policy structure

**Decision Options:**

#### Option A: Spec Version (Recommended)
```typescript
interface ResilienceAdapter {
  apply<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    policies: ResiliencePolicies,
    signal: AbortSignal,
  ): Promise<T>

  applyGlobalPolicies<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    globalPolicies: ResiliencePolicies,
    stepPolicies: ResiliencePolicies | undefined,
    signal: AbortSignal,
  ): Promise<T>

  getCircuitState(key: string): 'closed' | 'open' | 'half-open'
  resetCircuit(key: string): void
}

interface ResiliencePolicies {
  retry?: {
    maxAttempts: number
    backoffStrategy: 'fixed' | 'exponential'
    jitterStrategy: 'none' | 'full-jitter'
    initialDelay: number
    maxDelay: number
  }
  circuitBreaker?: {
    failureThreshold: number
    recoveryTime: number
    sampleSize: number
    halfOpenPolicy: 'single-probe' | 'gradual'
  }
  timeout?: number
  compositionOrder?: 'retry-cb-timeout' | 'timeout-cb-retry'
}
```
**Pros:** Clear composition order, separate global/step policies
**Cons:** More complex API

#### Option B: Code Version (Current)
```typescript
interface ResilienceAdapter {
  applyPolicy<T>(
    operation: () => Promise<T>,
    policy: ResiliencePolicy,
    signal?: AbortSignal,
  ): Promise<T>
}
```
**Pros:** Simple API
**Cons:** No composition order control, unclear policy precedence

**RECOMMENDATION**: Adopt Option A (Spec Version) for explicit composition control
```

### Policy Application Strategy

**Composition Order Mapping:**

- `'retry-cb-timeout'`: retry(circuitBreaker(timeout(operation))) - Default
- `'timeout-cb-retry'`: timeout(circuitBreaker(retry(operation)))

**Integration Rules:**

- **Step-level policies**: Override global defaults (step takes precedence)
- **Policy inheritance**: Global policies apply when step policies undefined
- **Cancellation**: Resilience adapter must respect AbortSignal throughout
- **Error classification**: Return errors with proper ExecutionError taxonomy

### Fallback Step Semantics

**Execution Rules:**

1. **Trigger**: Fallback executes only after original step fails
2. **Dependencies**: Fallback step can have its own dependencies; they must be satisfied
3. **Input Mapping**: Fallback consumes same mapped input as original unless overridden
4. **Concurrency**: Fallback honors global concurrency cap and cancellation semantics
5. **Result Aliasing**: Fallback result replaces original step's output in context
6. **Nested Failure**: If fallback also fails, error propagates with both original and fallback errors

**Example:**

```yaml
steps:
  - id: primary
    dependencies: [stepA]
    fallbackStepId: backup
  - id: backup
    dependencies: [stepA, stepB] # Additional dependency
```

In this case, `backup` executes only if:

1. `primary` fails
2. Both `stepA` and `stepB` are completed

## Execution Result Contracts

### ExecutionContext (Enhanced)

```typescript
interface ExecutionContext {
  correlationId: string
  abortSignal: AbortSignal
  results: Map<string, StepResult>
  metadata: Record<string, unknown>

  // Memory safety
  maxResultBytesPerStep: number // Default: 512KB
  maxMetadataBytes: number // Default: 128KB

  // Agent registry access
  agentRegistry: AgentRegistry
  resilienceAdapter: ResilienceAdapter

  // Environment variable whitelist
  envWhitelist?: string[] // List of allowed env vars for ${env.*} expressions
}
```

### Environment Variable Access

**Whitelist Ownership:**

- Provided at engine construction or per-execution via ExecutionContext
- No environment variables accessible if whitelist not provided
- Attempting to access non-whitelisted variables results in `VALIDATION` error

**Example:**

```typescript
const context: ExecutionContext = {
  envWhitelist: ['NODE_ENV', 'API_KEY', 'BASE_URL'],
  // ... other context
}

// In mapping: ${env.NODE_ENV} - Allowed
// In mapping: ${env.SECRET_KEY} - VALIDATION error if not in whitelist
```

### StepResult - ALIGNMENT NEEDED

**Current Misalignment:**
- **Spec**: Uses `'success'` status
- **Code**: Uses `'completed'` status

**RECOMMENDATION**: Use `'completed'` to match existing schema

```typescript
interface StepResult {
  stepId: string
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

  // Fallback aliasing metadata
  aliasFor?: string // Present when this result is a fallback for another failed step
}
```

### ExecutionError Taxonomy - ALIGNED

The error taxonomy is properly aligned with the schema definition:

```typescript
interface ExecutionError {
  code:
    | 'TIMEOUT'      // Operation exceeded time limit
    | 'CIRCUIT_OPEN' // Circuit breaker prevented execution
    | 'CANCELLED'    // Operation cancelled via AbortSignal
    | 'VALIDATION'   // Schema violations, missing deps, agent not found
    | 'RETRYABLE'    // Transient failures eligible for retry
    | 'UNKNOWN'      // Unclassified errors (minimize usage)
  message: string
  stepId?: string
  attempt?: number
  cause?: Error | ExecutionError
  context?: Record<string, unknown>
  timestamp: string
}
```

**Error Code Classification:**

- **TIMEOUT**: Operation exceeded time limit (step timeout, workflow timeout, or expression evaluation timeout)
- **CIRCUIT_OPEN**: Circuit breaker prevented execution
- **CANCELLED**: Operation cancelled via AbortSignal propagation
- **VALIDATION**: Schema violations, cycle detection, missing dependencies, expression security violations, agent lookup failures
- **RETRYABLE**: Transient failures eligible for retry (network, temporary service issues)
- **UNKNOWN**: Unclassified errors (minimize usage, log for analysis and taxonomy improvements)

## Implementation Guidelines

### Dependency Injection

```typescript
class OrchestrationEngine {
  constructor(
    private agentRegistry: AgentRegistry,
    private resilienceAdapter: ResilienceAdapter,
  ) {}

  async execute(
    workflow: Workflow,
    context: ExecutionContext,
  ): Promise<WorkflowResult> {
    // Engine implementation
  }
}
```

### Error Wrapping Strategy

- **Agent errors**: Wrap in ExecutionError with appropriate classification
- **Timeout errors**: Always map to `TIMEOUT` code
- **Network errors**: Map to `RETRYABLE` code unless explicitly non-retryable
- **Validation errors**: Map to `VALIDATION` code
- **Unknown errors**: Map to `UNKNOWN` but log for analysis

### Fallback Result Aliasing

When a step fails with `onError: 'fallback'` and `fallbackStepId` specified:

```typescript
interface FallbackExecution {
  // Original failed step result
  originalResult: StepResult & {
    status: 'failed'
    error: ExecutionError
  }

  // Fallback step execution result
  fallbackResult: StepResult & {
    aliasFor: string // References the original failed step ID
  }

  // Resolution for dependents
  resolvedOutput: unknown // Fallback output used by dependent steps
}
```

**Aliasing Rules:**

- Fallback step result includes `aliasFor` property with original step ID
- Dependent steps reference original step ID but receive fallback output
- Both original failure and fallback success are recorded in WorkflowResult
- If fallback also fails, original error propagates to dependents

### Testing Strategy - ALIGNMENT REQUIRED

**Mock Implementations (@orchestr8/testing):**

**CRITICAL**: Mocks must match the chosen interface decisions above

- `MockAgentRegistry`: Must implement chosen interface (sync or async)
  - Support agent lookup failures → VALIDATION error
  - Configurable agent versions and metadata
  - Deterministic agent resolution for testing
  
- `MockResilienceAdapter`: Must implement chosen interface
  - Pass-through mode for testing without resilience
  - Configurable failure injection
  - AbortSignal propagation verification
  - Policy composition order testing

**Wallaby.js Compatibility:**
```typescript
// CORRECT - Wallaby compatible
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockImplementation(() => 'content')
}))

// INCORRECT - Wallaby incompatible
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('content')
}))
```

**Integration Tests:**

- Test actual agent registry integration
- Verify resilience adapter policy application
- Validate error propagation and classification
- Test expression evaluator fixes
