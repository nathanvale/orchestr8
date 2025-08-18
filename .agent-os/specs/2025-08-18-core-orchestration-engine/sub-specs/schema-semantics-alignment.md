# Schema Semantics Alignment

This document establishes the canonical semantics for expression evaluation, condition processing, and mapping resolution across the @orchestr8 platform, resolving conflicts between schema implementation and documentation.

> Created: 2025-08-18
> Version: 1.1.0
> Updated: 2025-08-18
> Status: Semantic Standards Definition

## Purpose

Standardize expression semantics across schema, documentation, and engine implementation to eliminate the inconsistencies identified in the pre-implementation gap analysis. This document serves as the single source of truth for expression evaluation behavior.

## Expression Evaluation Standards

### Condition Evaluation: JMESPath Only

**Decision**: All step conditions use JMESPath for safe, deterministic evaluation.

**Implementation Requirements:**

- **Library**: `jmespath` npm package (^0.16.0)
- **Compilation**: Expressions compiled and cached for performance
- **Security**: No function expressions allowed, safe subset only
- **Timeout**: 500ms maximum evaluation time per condition
- **Context**: Full execution context available for path traversal

**Condition Schema Contract:**

```typescript
interface StepCondition {
  if?: string // JMESPath expression - step executes if truthy
  unless?: string // JMESPath expression - step executes if falsy
}
```

**Evaluation Logic:**

```typescript
// Both present: step executes if (if is truthy) AND (unless is falsy)
// Only if: step executes if if is truthy
// Only unless: step executes if unless is falsy
// Neither: step always executes (after dependencies met)
```

**JMESPath Truthiness Rules:**

- `false` → falsy
- `null` → falsy
- `0` → falsy
- Empty string `""` → falsy
- Empty array `[]` → falsy
- Empty object `{}` → falsy
- All other values → truthy

**Note:** 500ms timeout is independent from step timeouts; applies only to expression evaluation.

**Example Conditions:**

```json
{
  "condition": {
    "if": "steps.api_check.output.status == 'success'",
    "unless": "steps.rate_limit.output.exceeded"
  }
}
```

### Mapping Placeholders: ${} Pattern Resolution

**Decision**: Mapping uses simple `${expression}` pattern resolution with precedence order for context lookups.

**Supported Patterns:**

- `${steps.<stepId>.output.<path>}` - Access step outputs (highest precedence)
- `${variables.<name>}` - Access workflow context variables
- `${env.<name>}` - Access environment variables (lowest precedence)
- `${expression ?? defaultValue}` - Optional default value syntax

**Default Value Escaping Rules (MVP):**

- Default value segment may NOT contain `}` or `??` characters
- For defaults with special characters, use quoted syntax: `${path ?? "literal with ?? or }"}`
- Quotes required around defaults containing reserved tokens
- Single-line defaults only, no nested braces
- Violations result in VALIDATION error

**Security Enforcement:**

- **Max Expansion Depth**: 10 nested property accesses
- **Max Expansion Size**: 64KB per expanded expression
- **Environment Whitelist**: Only variables in ExecutionContext.envWhitelist allowed
  - No env access if whitelist not provided
  - Non-whitelisted access → VALIDATION error
- **Prototype Protection**: Prevent `__proto__`, `constructor`, `prototype` access

**Resolution Algorithm:**

```typescript
function resolveMapping(template: string, context: ExecutionContext): any {
  return template.replace(/\$\{([^}]+)\}/g, (match, expression) => {
    // Parse expression and optional default
    const [path, defaultValue] = expression.split('??').map((s) => s.trim())

    // Try resolution in precedence order
    let value: any

    if (path.startsWith('steps.')) {
      value = resolveStepOutput(context, path.substring(6))
    } else if (path.startsWith('variables.')) {
      value = context.variables[path.substring(10)]
    } else if (path.startsWith('env.')) {
      const envKey = path.substring(4)
      if (isWhitelistedEnvVar(envKey)) {
        value = process.env[envKey]
      }
    }

    // Apply default if value is undefined/null
    if (value === undefined || value === null) {
      return defaultValue !== undefined ? defaultValue : ''
    }

    return value
  })
}
```

**Example Mappings:**

```json
{
  "input": {
    "mapping": {
      "apiKey": "${env.GITHUB_TOKEN}",
      "previousResult": "${steps.data-fetch.output.result ?? 'no-data'}",
      "contextVar": "${variables.userId}"
    }
  }
}
```

### Transform Processing: JMESPath Post-Mapping

**Decision**: Optional `transform` field applies JMESPath expression to mapped input before agent execution.

**Processing Pipeline:**

1. **Mapping Resolution**: Apply `${expression}` placeholder resolution
2. **Transform Application**: Apply JMESPath transform to resolved input
3. **Agent Execution**: Pass transformed input to agent

**Security Bounds:**

- Same timeout and safety restrictions as condition evaluation
- No function expressions allowed
- 64KB maximum result size

**Example Transform:**

```json
{
  "input": {
    "mapping": {
      "rawData": "${steps.fetch.output.data}",
      "metadata": "${steps.fetch.output.metadata}"
    },
    "transform": "{ processedData: rawData[?size > `1000`], count: length(rawData) }"
  }
}
```

## Schema Implementation Alignment

### Current Schema Compatibility

**Mapping Regex Status:**

```typescript
// Current: permissive regex (KEEP for MVP)
mapping: z.record(z.string().regex(/^\$\{[^}]+\}$/)).optional()

// TODO Post-MVP: Tighten to specific patterns
// mapping: z.record(z.string().regex(/^\$\{(steps\.[^}]+|variables\.[^}]+|env\.[^}]+)(\?\?[^}]+)?\}$/))
```

**Why Keep Permissive**: Avoid rejecting valid patterns during MVP development. Schema evolution post-MVP will tighten validation.

**Schema Comment Addition:**

```typescript
mapping: z.record(z.string().regex(/^\$\{[^}]+\}$/)).optional()
// TODO: Tighten regex post-MVP to enforce steps/variables/env patterns
// Current regex intentionally permissive to avoid blocking valid MVP patterns
```

### Error Taxonomy Standardization

**Schema Source of Truth**: Use `ExecutionError` from `packages/schema/src/index.ts` exactly.

**Canonical Error Structure:**

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

- `VALIDATION`: Schema violations, cycle detection, missing dependencies
- `TIMEOUT`: Step or workflow timeout exceeded
- `CIRCUIT_OPEN`: Circuit breaker in open state
- `CANCELLED`: Execution cancelled via AbortSignal
- `RETRYABLE`: Transient failure eligible for retry
- `UNKNOWN`: Unclassified errors (minimize usage, log for analysis)

## Implementation Contracts

### Expression Security Enforcement

**Security Configuration:**

```typescript
interface ExpressionSecurity {
  maxExpansionDepth: number // Default: 10
  maxExpansionSize: number // Default: 64KB
  allowedEnvVars: string[] // Whitelist for env.* access
  evaluationTimeoutMs: number // Default: 500ms
}
```

**Security Violations:**

- Depth exceeded → `VALIDATION` error with path details
- Size exceeded → `VALIDATION` error with size information
- Timeout exceeded → `TIMEOUT` error with expression context
- Forbidden env access → `VALIDATION` error with variable name

### JMESPath Implementation Requirements

**Library Integration:**

```typescript
import jmespath from 'jmespath'

class ExpressionEvaluator {
  private cache = new Map<string, jmespath.CompiledExpression>()

  evaluateCondition(expression: string, context: any): boolean {
    // Compile and cache for performance
    let compiled = this.cache.get(expression)
    if (!compiled) {
      compiled = jmespath.compile(expression)
      this.cache.set(expression, compiled)
    }

    // Evaluate with timeout protection
    return this.withTimeout(() => {
      const result = compiled.search(context)
      return this.toBooleanResult(result)
    }, 500)
  }

  evaluateTransform(expression: string, input: any): any {
    // Same compilation caching and timeout protection
    let compiled = this.cache.get(expression)
    if (!compiled) {
      compiled = jmespath.compile(expression)
      this.cache.set(expression, compiled)
    }

    return this.withTimeout(() => compiled.search(input), 500)
  }
}
```

## Test Validation Requirements

### Expression Resolution Tests

**Required Test Coverage:**

- [ ] `${steps.*}` resolution with nested paths and missing steps
- [ ] `${variables.*}` resolution with missing variables
- [ ] `${env.*}` resolution with whitelist enforcement
- [ ] Default value handling with `?? syntax`
- [ ] Security limit enforcement (depth, size, timeout)
- [ ] Precedence order validation (steps > variables > env)

### JMESPath Evaluation Tests

**Required Test Coverage:**

- [ ] Condition evaluation: if/unless logic combinations
- [ ] Transform application: input mapping → transform → output
- [ ] Expression compilation and caching behavior
- [ ] Timeout enforcement and error handling
- [ ] Context object structure for path traversal

### Error Classification Tests

**Required Test Coverage:**

- [ ] All `ExecutionError` codes with proper structure
- [ ] Error message clarity and debugging information
- [ ] Cause chain preservation through error boundaries
- [ ] Step context inclusion for debugging

## Migration Path

### Phase 1: Documentation Alignment (Immediate)

- [ ] Update all docs to reference JMESPath for conditions
- [ ] Standardize mapping placeholder examples
- [ ] Remove conflicting expression evaluation references
- [ ] Add security limit documentation

### Phase 2: Implementation (Next Sprint)

- [ ] Implement JMESPath condition evaluator with caching
- [ ] Implement `${expression}` mapping resolver with security
- [ ] Add transform processing pipeline
- [ ] Comprehensive test coverage for all patterns

### Phase 3: Schema Evolution (Post-MVP)

- [ ] Tighten mapping regex to enforce specific patterns
- [ ] Add schema validation for expression syntax
- [ ] Version bump with migration guide

## Compliance Verification

### Pre-Implementation Checklist

- [ ] All documentation references JMESPath for conditions
- [ ] Mapping examples use `${steps/variables/env}` patterns consistently
- [ ] Error examples use schema `ExecutionError` structure exactly
- [ ] Security limits documented and consistent
- [ ] Transform pipeline clearly specified

### Implementation Validation

- [ ] JMESPath library integrated with compilation caching
- [ ] Mapping resolution follows precedence order exactly
- [ ] Security limits enforced with proper error responses
- [ ] Error classification matches schema enum exactly
- [ ] Test coverage validates all semantic requirements

This alignment resolves gaps 1, 3, and 6 from the pre-implementation analysis and provides clear implementation guidance for expression semantics across the platform.
