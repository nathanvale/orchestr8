# Schema Alignment

This document ensures the orchestration engine implementation aligns perfectly with the @orchestr8/schema contracts.

> Created: 2025-08-18  
> Version: 1.0.0
> Schema Reference: @orchestr8/schema v1.0.0

## Schema Contract Validation

### Critical Alignment Points

#### 1. Fallback Step Contract ✅

**Schema Definition** (packages/schema/src/index.ts:140):

```typescript
fallbackStepId: z.string().optional()
```

**Engine Implementation Requirements:**

- Engine MUST support `onError: 'fallback'` with `fallbackStepId` pointer
- Fallback step output MUST alias as original step output for dependency resolution
- Both original failure and fallback execution MUST be recorded in journal

#### 2. Condition Model ✅

**Schema Definition** (packages/schema/src/index.ts:56-59):

```typescript
export const StepConditionSchema = z.object({
  if: z.string().optional(),
  unless: z.string().optional(),
})
```

**Engine Implementation Requirements:**

- Engine MUST use `{ if?, unless? }` model exclusively
- Condition evaluation MUST occur after dependency readiness, before execution
- Expression context MUST include `steps.*`, `variables.*`, `env.*`

#### 3. Mapping Expression Scope ✅

**Schema Definition** (packages/schema/src/index.ts:40):

```typescript
mapping: z.record(z.string().regex(/^\$\{[^}]+\}$/)).optional()
```

**Current Limitation**: Regex allows any `${expression}` but documentation shows broader scope needed.

**Engine Implementation Requirements:**

- Support `${steps.<stepId>.output.*}` - access step outputs
- Support `${variables.<name>}` - access workflow context variables
- Support `${env.<name>}` - access environment variables (with security limits)
- Enforce `expressionSecurity` limits: `maxExpansionDepth: 10`, `maxExpansionSize: 64KB`

#### 4. Retry Policy ✅

**Schema Definition** (packages/schema/src/index.ts:62-70):

```typescript
export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(3),
  baseDelayMs: z.number().int().min(100).default(1000),
  maxDelayMs: z.number().int().default(30000),
  jitterStrategy: z.enum(['full-jitter']).default('full-jitter'),
  retryableErrors: z
    .array(z.enum(['RetryableError', 'TimeoutError', 'NetworkError']))
    .default(['RetryableError', 'TimeoutError']),
})
```

**Engine Implementation Requirements:**

- Use `jitterStrategy: 'full-jitter'` (NO `jitter: boolean`)
- Apply jitter calculation per @orchestr8/resilience implementation
- Respect `retryableErrors` array for error classification

#### 5. Circuit Breaker Policy ✅

**Schema Definition** (packages/schema/src/index.ts:72-90):

```typescript
export const CircuitBreakerPolicySchema = z.object({
  keyStrategy: z.object({
    agentId: z.boolean().default(true),
    includeTarget: z.boolean().default(true),
  }).optional(),
  failureThreshold: z.number().int().min(1).default(5),
  resetTimeoutMs: z.number().int().min(1000).default(60000),
  halfOpenPolicy: z.enum(['single-probe']).default('single-probe'),
  errorClassification: z.object({...}).optional(),
})
```

**Engine Implementation Requirements:**

- Use `keyStrategy` object (NOT `key` string in examples)
- Use `halfOpenPolicy: 'single-probe'` (NOT `'single-trial'`)
- Generate circuit breaker keys per `keyStrategy` configuration

#### 6. Error Taxonomy ✅

**Schema Definition** (packages/schema/src/index.ts:105-119):

```typescript
export const ExecutionErrorSchema = z.object({
  code: z.enum([
    'TIMEOUT',
    'CIRCUIT_OPEN',
    'CANCELLED',
    'VALIDATION',
    'RETRYABLE',
    'UNKNOWN',
  ]),
  message: z.string(),
  cause: z.unknown().optional(),
  stepId: z.string().optional(),
  attempt: z.number().int().min(0).optional(),
  retryable: z.boolean().optional(),
})
```

**Engine Implementation Requirements:**

- Engine MUST classify all errors using exact taxonomy codes
- `UNKNOWN` is allowed but should be minimized (log for analysis)
- Include `stepId` and `attempt` for debugging

## Validation Responsibilities

### Workflow Validation

**Schema Responsibility** (@orchestr8/schema):

- Structural validation via Zod schemas
- Field type validation
- Required field validation
- Schema versioning and hash validation

**Engine Responsibility** (this spec):

- **Cycle Detection**: Analyze step dependencies for circular references
- **Dependency Reference Validation**: Ensure all `dependencies` reference valid step IDs
- **Agent ID Validation**: Verify agent IDs are resolvable via AgentRegistry

### Cycle Detection Implementation

```typescript
interface ValidationError extends ExecutionError {
  code: 'VALIDATION'
  details: {
    type: 'CIRCULAR_DEPENDENCY'
    offendingEdges: Array<{ from: string; to: string }>
    cycle: string[]
  }
}
```

**Detection Algorithm:**

- Use depth-first search with gray/black marking
- Track path for cycle reconstruction
- Return all edges forming cycles
- Include human-readable cycle description

### Dependencies Array Normalization

**Schema Parsing** (packages/schema/src/index.ts:136):

```typescript
dependencies: z.array(StepId).default([])
```

**Engine Requirement:**

- Dependencies MUST always be materialized as `Array<string>`
- Default to `[]` if undefined during schema parsing
- Simplifies scheduling code by eliminating undefined checks

## Type Export Validation

### Required Exports from @orchestr8/schema

The engine implementation requires these exact type exports:

```typescript
// Core workflow types
export type Workflow = z.infer<typeof WorkflowSchema>
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>
export type WorkflowContext = z.infer<typeof WorkflowContextSchema>

// Policy types
export type StepPolicies = z.infer<typeof StepPoliciesSchema>
export type RetryPolicy = z.infer<typeof RetryPolicySchema>
export type CircuitBreakerPolicy = z.infer<typeof CircuitBreakerPolicySchema>
export type GlobalPolicies = z.infer<typeof GlobalPoliciesSchema>

// Error and result types
export type ExecutionError = z.infer<typeof ExecutionErrorSchema>

// Input/output types
export type StepInput = z.infer<typeof StepInputSchema>
export type StepOutput = z.infer<typeof StepOutputSchema>
export type StepCondition = z.infer<typeof StepConditionSchema>
```

**Status**: ✅ All required exports present in packages/schema/src/index.ts:183-197

## Implementation Validation Checklist

### Pre-Implementation (Schema Freeze)

- [ ] Verify all engine contracts match schema exactly
- [ ] Validate that schema exports include all required types
- [ ] Confirm schema versioning supports current version
- [ ] Test schema parsing with realistic workflow examples

### During Implementation

- [ ] Write unit tests that validate against actual schema instances
- [ ] Ensure error taxonomy codes match schema enum exactly
- [ ] Verify policy object structures match schema shape
- [ ] Test cycle detection with schema-validated workflows

### Post-Implementation

- [ ] Run integration tests against schema validation
- [ ] Verify all examples in technical spec parse successfully
- [ ] Confirm engine handles all schema-valid workflows
- [ ] Test engine rejects invalid workflows with proper error messages

## Compatibility Matrix

| Component                        | Schema Version | Engine Version | Status                           |
| -------------------------------- | -------------- | -------------- | -------------------------------- |
| WorkflowStep.fallbackStepId      | 1.0.0          | 1.0.0          | ✅ Aligned                       |
| StepCondition.{if,unless}        | 1.0.0          | 1.0.0          | ✅ Aligned                       |
| RetryPolicy.jitterStrategy       | 1.0.0          | 1.0.0          | ✅ Aligned                       |
| CircuitBreakerPolicy.keyStrategy | 1.0.0          | 1.0.0          | ✅ Aligned                       |
| ExecutionError.code enum         | 1.0.0          | 1.0.0          | ✅ Aligned                       |
| Mapping expression scope         | 1.0.0          | 1.0.0          | ⚠️ Schema regex needs broadening |

**Action Required**: Consider updating schema regex for mapping expressions to support documented patterns or keep current regex and document limitations.
