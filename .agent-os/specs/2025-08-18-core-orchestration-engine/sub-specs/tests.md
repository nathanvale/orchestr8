# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-18-core-orchestration-engine/spec.md

> Created: 2025-08-18
> Version: 2.0.0
> Updated: 2025-08-19
> Status: **CRITICAL BUGS** - Specific test cases for identified issues

## Test Coverage Requirements

**Coverage Targets:**

- @orchestr8/core: 90% minimum coverage
- Other packages: 80% minimum coverage
- Critical paths: 100% coverage (scheduler, error handling, cancellation)

## Critical Bug Fix Tests (IMMEDIATE PRIORITY)

### Expression Evaluator Bugs

**Test: JMESPath compile vs search**
```typescript
describe('Expression Evaluator - JMESPath', () => {
  test('should use jmespath.search() not compile()', () => {
    // Current BUG: Code tries to use jmespath.compile() which doesn't exist
    // FIX: Use jmespath.search(data, expression) directly
    const result = jmespath.search(data, 'steps.step1.output')
    expect(result).toBeDefined()
  })
})
```

**Test: Depth tracking bug**
```typescript
describe('Expression Evaluator - Depth Tracking', () => {
  test('should correctly track depth with iteration counter', () => {
    // Current BUG: Uses parts.indexOf(part) which always returns first occurrence
    // FIX: Use iteration counter i < maxDepth
    const deepPath = 'a.b.c.d.e.f.g.h.i.j.k' // 11 levels
    expect(() => navigateObject(obj, deepPath)).toThrow(/depth exceeds limit/)
  })
})
```

**Test: Prototype pollution protection**
```typescript
describe('Expression Evaluator - Security', () => {
  test('should block prototype pollution keys', () => {
    // Current BUG: No prototype key guards
    // FIX: Block __proto__, constructor, prototype
    const maliciousPath = 'obj.__proto__.polluted'
    expect(() => resolvePlaceholder(maliciousPath, context)).toThrow(/VALIDATION/)
  })
})
```

**Test: Timeout enforcement**
```typescript
describe('Expression Evaluator - Timeout', () => {
  test('should enforce 500ms timeout with TIMEOUT error', () => {
    // Current BUG: Only warns, doesn't enforce
    // FIX: Use Promise.race or AbortController to enforce
    const slowExpression = 'complexJMESPath'
    await expect(evaluateCondition(slowExpression, context))
      .rejects.toMatchObject({ code: 'TIMEOUT' })
  })
})
```

## Test Coverage

### Unit Tests

**Enhanced Type Contracts**

- **StepResult**: Validate status transitions, timing, and error handling
- **ExecutionError**: Test error taxonomy, retryable classification, and cause chaining
- **ExecutionContext**: Memory bounds, result retention, and correlation ID management

**OrchestrationEngine**

- Parse workflow and execute with proper WorkflowResult contract
- Maintain execution context and correlation IDs across workflow steps
- Handle workflow execution failures with structured error propagation
- Respect memory bounds with truncation metadata for large outputs
- Propagate AbortSignal cancellation through execution chain
- Generate unique execution IDs and accurate timing measurements

**ExecutionGraph**

- Build dependency graph from Workflow AST with correct topological sorting
- Implement deterministic scheduling: dependency count + index tiebreaker
- Identify independent parallel execution levels correctly
- **Circular dependency detection**: Return VALIDATION error with list of offending edges
- Handle complex dependency chains with stable ordering

**Deterministic Scheduling**

- **Stable ordering**: Multiple ready steps sorted by dependency count (ascending), then original index
- **Tiebreaker behavior**: Earlier steps in array execute first when dependency counts equal
- **Execution levels**: Parallel groups constructed correctly from topological sort
- **Readiness check**: Dependencies must be COMPLETED (not just "not running")
- **Cycle detection**: Circular dependencies return VALIDATION error with offending edges
- **Global semaphore**: Concurrency cap enforced across entire workflow
- **Property-based tests**: Use fast-check to verify determinism across random workflow graphs

**Memory Safety and Bounds**

- **Result truncation**: Large outputs lead to truncated flag and size metadata
- **Memory limits**: Per-step serialized size cap (512KB) measured as UTF-8 byte length
- **Context bounds**: Prevent memory leaks in long-running workflows
- **Serialization safety**: Handle circular references and non-JSON types
- **Byte math validation**: Assert truncation uses Buffer.byteLength(JSON.stringify(value), 'utf8')

### Integration Contract Tests

**AgentRegistry Integration**

- Agent lookup success returns valid agent with execute method
- Agent lookup failure returns ExecutionError with code VALIDATION
- Version constraints resolution (^1.0.0, ~1.2.0, latest)
- Agent configuration passed through execution context
- AbortSignal propagation from engine through to agent.execute()

**ResilienceAdapter Integration**

- Policy composition order: retry(circuitBreaker(timeout(operation)))
- Step-level policies override global policies correctly
- AbortSignal propagation through resilience layers
- Error classification preserved through resilience wrapping
- Timeout enforcement with proper TIMEOUT error code
- Circuit breaker state transitions with CIRCUIT_OPEN errors

### Integration Tests

**Sequential Workflow Execution**

- Execute multi-step workflow where each step depends on previous results
- Handle step failures and workflow termination scenarios
- Verify data flow and context passing between sequential steps

**Parallel Execution with Failure Semantics**

- **Fail-fast behavior**: One branch fails, others are aborted; aggregate errors; deterministic outcomes
- **onError policies**: Test fail, continue, retry, and fallback behaviors
- **Fallback execution**: fallbackStepId succeeds and unblocks dependents; failing fallback propagates failure
- **Partial failures**: Handle mixed success/failure in parallel branches

**Concurrency Management**

- **Concurrency cap**: Mock N slow steps and assert only cap concurrent; measure timing
- **Semaphore enforcement**: Verify global workflow concurrency limits respected
- **AbortSignal propagation**: Cancellation cascades through all running steps

**Hybrid Workflow Patterns**

- Execute complex workflows mixing sequential and parallel patterns
- Verify correct execution order in workflows with multiple dependency levels
- Test performance optimization in real-world workflow scenarios

**Error Handling and Resilience**

- **Error aggregation**: Multiple parallel failures collected and reported
- **Error taxonomy**: All errors wrapped in ExecutionError with proper classification
- **Cancellation**: Graceful shutdown with cleanup timeout enforcement

### Edge Cases and Performance

**Performance and Timing**

- **Parallelization benefits**: Measure timing improvements from parallel execution
- **Memory efficiency**: Large workflows stay within memory bounds
- **Cancellation speed**: AbortSignal propagation timing

**Complex Scenarios**

- **Deep dependency graphs**: 10+ levels with mixed parallel/sequential patterns
- **Large workflows**: 50+ steps with various dependency patterns
- **Error recovery**: Workflows continuing after failed branches with onError: 'continue'
- **Fallback chains**: Fallback steps with their own dependencies and potential failures
- **Mapping edge cases**: Default values with special characters using quoted syntax
- **Environment whitelist**: Test allowed and forbidden env variable access
- **JMESPath truthiness**: Test empty string/array/object falsy behavior
- **Condition timeout**: Verify 500ms JMESPath evaluation timeout independent from step timeouts

## Property-Based Testing

### Library

**fast-check** (devDependency) - Property-based testing for JavaScript/TypeScript

### Test Scenarios

**Scheduler Determinism**

```typescript
import fc from 'fast-check'

test('scheduler produces deterministic ordering', () => {
  fc.assert(
    fc.property(fc.array(workflowStepArbitrary()), (steps) => {
      const result1 = scheduleSteps(steps, new Set())
      const result2 = scheduleSteps(steps, new Set())
      expect(result1).toEqual(result2)
    }),
  )
})
```

**Concurrency Fairness**

- Generate random workflows with varying concurrency requirements
- Verify fair distribution of execution slots
- Assert no starvation under high concurrency

**Memory Truncation Consistency**

- Generate large random objects
- Verify truncation preserves JSON validity
- Assert byte count accuracy

**Cancellation Order Consistency**

- Generate workflows with random failure points
- Verify cancellation order matches specification
- Assert gracePeriod timing respected

## Test Gating Additions

### New Test Requirements

**Fallback Dependency Semantics**

- Fallback with additional dependencies
- Fallback failure propagation
- Result aliasing validation

**Cancellation Ordering**

- Fail-fast within level with gracePeriod
- Forced abort after timeout
- No downstream starts during error handling

**Composition Order Tests**

- Test 'retry-cb-timeout' wrapping order
- Test 'timeout-cb-retry' wrapping order
- Verify behavior matches string selection

**Mapping Default Escaping**

- Test default values with reserved tokens
- Verify quoted syntax support
- Assert VALIDATION errors for violations

**Environment Whitelist Enforcement**

- Test allowed variable access
- Test forbidden access → VALIDATION error
- Test missing whitelist behavior

**JMESPath Truthiness**

- Test empty collections as falsy
- Test zero and empty string as falsy
- Verify 500ms timeout enforcement

**Memory Size Measurement**

- Test UTF-8 byte counting
- Verify truncation metadata accuracy
- Test circular reference handling

### Mocking Requirements - ALIGNMENT CRITICAL

**Wallaby.js Compatibility:**
```typescript
// CORRECT - Wallaby compatible
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockImplementation(() => 'content')
}))

// INCORRECT - Breaks Wallaby
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('content')
}))
```

**Mock Interface Alignment Required:**
- **MockAgentRegistry**: Must match chosen sync/async decision
- **MockResilienceAdapter**: Must match apply vs applyPolicy decision
- **Agent.execute**: Must match context parameter decision
- **Timer Controls**: Mock setTimeout/Promise delays for deterministic test timing
- **AbortSignal**: Mock cancellation scenarios to verify cleanup and error handling
- **Memory Measurement**: Mock serialization to test memory bounds without large objects

### Expression Security Tests

**JMESPath Condition Evaluation**

- Compilation and caching of expressions for performance
- 500ms timeout enforcement on expression evaluation
- No function expressions allowed (security sandbox)
- Both 'if' and 'unless' conditions evaluated correctly
- VALIDATION error on malformed expressions

**Mapping Expression Security**

- Maximum expansion depth (10 levels) enforced
- Maximum expansion size (64KB) per expression
- Prototype pollution prevention (**proto**, constructor, prototype)
- Environment variable whitelist enforcement
- Precedence order: steps > variables > env
- Default value syntax (${path ?? default}) resolution
- Circular reference detection and handling
