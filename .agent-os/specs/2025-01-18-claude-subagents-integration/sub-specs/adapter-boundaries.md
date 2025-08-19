# Adapter Boundaries Specification

Clear definition of adapter responsibilities and boundaries to prevent orchestration logic reimplementation.

> Created: 2025-01-19
> Version: 1.0.0

## Core Principle

**Adapters are thin pass-through layers** that translate between different protocols/formats and the orchestr8 engine. They contain NO business logic, orchestration, resilience, or state management.

## Adapter Responsibilities

### What Adapters DO

1. **Protocol Translation**
   - Convert HTTP requests to engine calls
   - Map MCP tool calls to engine methods
   - Transform Claude SDK requests to engine operations

2. **Input Validation**
   - Use shared Zod schemas from MCP spec
   - Return validation errors in normalized envelope
   - Ensure type safety at boundaries

3. **Response Formatting**
   - Return normalized envelopes unchanged
   - Map HTTP status codes appropriately
   - Format errors consistently

4. **Correlation Tracking**
   - Accept correlation IDs from requests
   - Generate IDs if not provided (`o8-${uuid}`)
   - Propagate IDs through all operations

### What Adapters DO NOT DO

1. **Business Logic** ❌
   - No workflow execution logic
   - No resilience implementation
   - No retry/timeout/circuit breaker logic
   - No state machine management

2. **Data Transformation** ❌
   - No modification of engine responses
   - No enrichment of data
   - No filtering or aggregation

3. **State Management** ❌
   - No execution state tracking
   - No caching of results
   - No session management
   - No persistence layer

4. **Error Recovery** ❌
   - No retry logic
   - No fallback mechanisms
   - No error suppression
   - Only format errors from engine

## Implementation Pattern

### Correct Adapter Implementation

```typescript
// packages/api/src/adapters/http-adapter.ts
import { OrchestrationEngine } from '@orchestr8/core'
import { RunWorkflowSchema } from '@orchestr8/mcp-server/schemas'
import type { NormalizedEnvelope } from '@orchestr8/mcp-server/envelope'

export class HttpAdapter {
  constructor(private engine: OrchestrationEngine) {}

  async runWorkflow(req: Request): Promise<NormalizedEnvelope> {
    // 1. Validate input using shared schema
    const validated = RunWorkflowSchema.parse(req.body)

    // 2. Forward to engine (no modification)
    const result = await this.engine.startExecution(
      validated.workflowId,
      validated.inputs,
      validated.options,
    )

    // 3. Return normalized envelope (no modification)
    return {
      status: 'running',
      executionId: result.id,
      workflowId: validated.workflowId,
      correlationId: validated.correlationId ?? `o8-${crypto.randomUUID()}`,
    }
  }
}
```

### Incorrect Adapter Implementation ❌

```typescript
// DON'T DO THIS - Contains business logic
export class BadAdapter {
  async runWorkflow(req: Request): Promise<NormalizedEnvelope> {
    const validated = RunWorkflowSchema.parse(req.body)

    // ❌ NO: Implementing retry logic in adapter
    let attempts = 0
    while (attempts < 3) {
      try {
        const result = await this.engine.startExecution(...)
        break
      } catch (error) {
        attempts++
        await sleep(1000 * attempts) // ❌ NO: Backoff in adapter
      }
    }

    // ❌ NO: State management in adapter
    this.executionCache.set(result.id, result)

    // ❌ NO: Data enrichment in adapter
    return {
      ...envelope,
      additionalMetrics: this.calculateMetrics() // ❌ NO
    }
  }
}
```

## Adapter Types

### HTTP API Adapter

- **Location**: `packages/api/src/adapters/`
- **Purpose**: REST endpoints for CI/CD
- **Protocol**: HTTP → Engine
- **Validation**: Shared Zod schemas
- **Response**: Normalized envelope

### MCP Server (Not an adapter - the foundation)

- **Location**: `packages/mcp-server/`
- **Purpose**: Core MCP implementation
- **Protocol**: MCP protocol native
- **Note**: This is the canonical implementation, not an adapter

### Claude SDK Adapter

- **Location**: `packages/agent-adapters/claude/`
- **Purpose**: Anthropic SDK integration
- **Protocol**: Claude SDK → Engine
- **Features**: Prompt caching, JSON mode
- **Response**: Normalized envelope

## Testing Adapter Boundaries

### Parity Test Requirements

All adapters must pass identical test suites:

```typescript
// packages/testing/src/adapter-parity.test.ts
describe('Adapter Parity', () => {
  const testCases = [
    { input: validWorkflow, expected: runningEnvelope },
    { input: invalidWorkflow, expected: validationError },
    { input: timeoutWorkflow, expected: timeoutError },
  ]

  describe('HTTP Adapter', () => {
    testCases.forEach(({ input, expected }) => {
      it(`returns ${expected.status} for ${input.type}`, async () => {
        const result = await httpAdapter.runWorkflow(input)
        expect(result).toEqual(expected)
      })
    })
  })

  describe('MCP Server', () => {
    testCases.forEach(({ input, expected }) => {
      it(`returns ${expected.status} for ${input.type}`, async () => {
        const result = await mcpServer.callTool('run_workflow', input)
        expect(result).toEqual(expected)
      })
    })
  })
})
```

## Enforcement Guidelines

### Code Review Checklist

- [ ] Adapter only validates and forwards
- [ ] No business logic in adapter
- [ ] Uses shared schemas from MCP spec
- [ ] Returns unmodified normalized envelope
- [ ] No retry/resilience logic
- [ ] No state management
- [ ] Correlation ID propagation only
- [ ] Parity tests pass

### Anti-Patterns to Reject

1. **Implementing retries in adapter**
2. **Caching results in adapter**
3. **Modifying engine responses**
4. **Adding custom error handling**
5. **State tracking in adapter**
6. **Business rule validation**
7. **Workflow orchestration logic**
8. **Custom resilience patterns**

## Migration Path

For existing code that violates boundaries:

1. **Identify violations**: Logic in adapters
2. **Move to engine**: Transfer to @orchestr8/core
3. **Simplify adapter**: Remove all logic
4. **Test parity**: Ensure identical behavior
5. **Document**: Update this spec if needed

## Summary

Remember: **Adapters adapt protocols, not logic**. All orchestration, resilience, and business logic belongs in the engine. If you're writing more than validation and forwarding code in an adapter, you're doing it wrong.
