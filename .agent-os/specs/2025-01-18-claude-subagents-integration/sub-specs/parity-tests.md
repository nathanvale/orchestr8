# Parity Tests Specification

Comprehensive test specifications ensuring identical behavior across all orchestr8 integration surfaces.

> Created: 2025-01-19
> Version: 1.0.0

## Overview

Parity tests verify that all integration surfaces (MCP, HTTP API, Claude SDK) produce identical results for the same inputs. These tests are critical for ensuring consistent behavior regardless of how orchestr8 is accessed.

## Test Categories

### 1. Input Validation Parity

**Purpose**: Ensure all surfaces validate inputs identically

```typescript
describe('Input Validation Parity', () => {
  const invalidInputs = [
    {
      name: 'missing workflowId',
      input: { inputs: {} },
      expectedError: {
        code: 'VALIDATION',
        message: 'workflowId is required',
        retryable: false,
      },
    },
    {
      name: 'invalid correlationId format',
      input: {
        workflowId: 'test',
        correlationId: 'invalid spaces here',
      },
      expectedError: {
        code: 'VALIDATION',
        message: 'correlationId must match pattern ^[a-zA-Z0-9-_]+$',
        retryable: false,
      },
    },
    {
      name: 'timeout exceeds maximum',
      input: {
        workflowId: 'test',
        options: { timeoutMs: 999999 },
      },
      expectedError: {
        code: 'VALIDATION',
        message: 'timeoutMs must be <= 300000',
        retryable: false,
      },
    },
  ]

  describe.each(['MCP', 'HTTP', 'Claude SDK'])('%s Surface', (surface) => {
    test.each(invalidInputs)(
      'rejects $name',
      async ({ input, expectedError }) => {
        const result = await callSurface(surface, 'run_workflow', input)

        expect(result.status).toBe('error')
        expect(result.error).toMatchObject(expectedError)
      },
    )
  })
})
```

### 2. Successful Execution Parity

**Purpose**: Verify identical success responses

```typescript
describe('Successful Execution Parity', () => {
  const successCases = [
    {
      name: 'simple workflow',
      input: {
        workflowId: 'hello-world',
        inputs: { name: 'Test' },
      },
      expectedEnvelope: {
        status: 'ok',
        data: { greeting: 'Hello, Test!' },
      },
    },
    {
      name: 'workflow with resilience',
      input: {
        workflowId: 'resilient-task',
        options: {
          resilience: {
            retry: { maxAttempts: 3 },
          },
        },
      },
      expectedEnvelope: {
        status: 'ok',
        data: { attempts: 2, result: 'success' },
      },
    },
  ]

  describe.each(['MCP', 'HTTP'])('%s Surface', (surface) => {
    test.each(successCases)(
      'executes $name',
      async ({ input, expectedEnvelope }) => {
        const result = await callSurface(surface, 'run_workflow', input)

        expect(result.status).toBe(expectedEnvelope.status)
        expect(result.data).toEqual(expectedEnvelope.data)
        expect(result.executionId).toMatch(/^exec_[a-zA-Z0-9]+$/)
        expect(result.correlationId).toBeDefined()
      },
    )
  })
})
```

### 3. Error Handling Parity

**Purpose**: Ensure consistent error responses

```typescript
describe('Error Handling Parity', () => {
  const errorCases = [
    {
      name: 'workflow not found',
      input: { workflowId: 'non-existent' },
      expectedError: {
        code: 'WORKFLOW_NOT_FOUND',
        retryable: false,
      },
    },
    {
      name: 'timeout error',
      input: {
        workflowId: 'slow-workflow',
        options: { timeoutMs: 100 },
      },
      expectedError: {
        code: 'TIMEOUT',
        retryable: true,
      },
    },
    {
      name: 'circuit breaker open',
      input: {
        workflowId: 'failing-workflow',
        options: {
          resilience: {
            circuitBreaker: { threshold: 0.5 },
          },
        },
      },
      expectedError: {
        code: 'CIRCUIT_OPEN',
        retryable: false,
      },
    },
  ]

  describe.each(['MCP', 'HTTP'])('%s Surface', (surface) => {
    test.each(errorCases)('handles $name', async ({ input, expectedError }) => {
      const result = await callSurface(surface, 'run_workflow', input)

      expect(result.status).toBe('error')
      expect(result.error.code).toBe(expectedError.code)
      expect(result.error.retryable).toBe(expectedError.retryable)
      expect(result.error.message).toBeDefined()
    })
  })
})
```

### 4. Correlation ID Parity

**Purpose**: Verify correlation ID propagation

```typescript
describe('Correlation ID Parity', () => {
  describe.each(['MCP', 'HTTP'])('%s Surface', (surface) => {
    test('uses provided correlation ID', async () => {
      const correlationId = 'test-correlation-123'
      const result = await callSurface(surface, 'run_workflow', {
        workflowId: 'test',
        correlationId,
      })

      expect(result.correlationId).toBe(correlationId)
    })

    test('generates correlation ID if not provided', async () => {
      const result = await callSurface(surface, 'run_workflow', {
        workflowId: 'test',
      })

      expect(result.correlationId).toMatch(/^o8-[a-f0-9-]+$/)
    })

    test('propagates correlation ID through status calls', async () => {
      const runResult = await callSurface(surface, 'run_workflow', {
        workflowId: 'test',
        correlationId: 'session-456',
      })

      const statusResult = await callSurface(surface, 'get_status', {
        executionId: runResult.executionId,
        correlationId: 'session-456',
      })

      expect(statusResult.correlationId).toBe('session-456')
    })
  })
})
```

### 5. Long-Polling Parity

**Purpose**: Test consistent polling behavior

```typescript
describe('Long-Polling Parity', () => {
  describe.each(['MCP', 'HTTP'])('%s Surface', (surface) => {
    test('returns immediately if complete', async () => {
      const startTime = Date.now()
      const result = await callSurface(surface, 'get_status', {
        executionId: 'completed-exec',
        waitForMs: 5000,
      })
      const duration = Date.now() - startTime

      expect(result.status).toBe('ok')
      expect(duration).toBeLessThan(500) // Should return immediately
    })

    test('waits for completion up to timeout', async () => {
      const startTime = Date.now()
      const result = await callSurface(surface, 'get_status', {
        executionId: 'slow-exec',
        waitForMs: 2000,
      })
      const duration = Date.now() - startTime

      expect(result.status).toBe('running')
      expect(duration).toBeGreaterThanOrEqual(1900)
      expect(duration).toBeLessThan(2500)
    })

    test('returns on completion before timeout', async () => {
      const startTime = Date.now()
      const result = await callSurface(surface, 'get_status', {
        executionId: 'completes-in-1s',
        waitForMs: 5000,
      })
      const duration = Date.now() - startTime

      expect(result.status).toBe('ok')
      expect(duration).toBeGreaterThanOrEqual(900)
      expect(duration).toBeLessThan(1500)
    })
  })
})
```

### 6. Cancellation Parity

**Purpose**: Ensure consistent cancellation behavior

```typescript
describe('Cancellation Parity', () => {
  describe.each(['MCP', 'HTTP'])('%s Surface', (surface) => {
    test('cancels running workflow', async () => {
      const runResult = await callSurface(surface, 'run_workflow', {
        workflowId: 'long-running',
      })

      const cancelResult = await callSurface(surface, 'cancel_workflow', {
        executionId: runResult.executionId,
        reason: 'User requested',
      })

      expect(cancelResult.status).toBe('ok')
      expect(cancelResult.message).toContain('cancelled')

      const statusResult = await callSurface(surface, 'get_status', {
        executionId: runResult.executionId,
      })

      expect(statusResult.status).toBe('error')
      expect(statusResult.error.code).toBe('CANCELLED')
    })

    test('handles cancel of non-existent execution', async () => {
      const result = await callSurface(surface, 'cancel_workflow', {
        executionId: 'non-existent-exec',
      })

      expect(result.status).toBe('error')
      expect(result.error.code).toBe('EXECUTION_NOT_FOUND')
    })
  })
})
```

### 7. Envelope Structure Parity

**Purpose**: Verify identical envelope structure

```typescript
describe('Envelope Structure Parity', () => {
  const envelopeSchema = z.object({
    status: z.enum(['running', 'ok', 'error']),
    executionId: z.string().optional(),
    workflowId: z.string().optional(),
    data: z.object({}).optional(),
    logs: z.array(z.string()).optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        retryable: z.boolean(),
        details: z.object({}).optional(),
      })
      .optional(),
    correlationId: z.string(),
    cost: z
      .object({
        inputTokens: z.number().optional(),
        outputTokens: z.number().optional(),
        cacheCreationTokens: z.number().optional(),
        cacheReadTokens: z.number().optional(),
        totalCost: z.number().optional(),
      })
      .optional(),
    meta: z
      .object({
        rateLimit: z.object({}).optional(),
        requestId: z.string().optional(),
        startedAt: z.string().optional(),
        completedAt: z.string().optional(),
        duration: z.number().optional(),
      })
      .optional(),
  })

  describe.each(['MCP', 'HTTP'])('%s Surface', (surface) => {
    test('returns valid envelope for success', async () => {
      const result = await callSurface(surface, 'run_workflow', {
        workflowId: 'test',
      })

      expect(() => envelopeSchema.parse(result)).not.toThrow()
    })

    test('returns valid envelope for error', async () => {
      const result = await callSurface(surface, 'run_workflow', {
        workflowId: 'non-existent',
      })

      expect(() => envelopeSchema.parse(result)).not.toThrow()
    })
  })
})
```

## Test Helpers

### Surface Abstraction

```typescript
// packages/testing/src/surface-helpers.ts
export async function callSurface(
  surface: 'MCP' | 'HTTP' | 'Claude SDK',
  tool: string,
  input: any,
): Promise<NormalizedEnvelope> {
  switch (surface) {
    case 'MCP':
      return await mcpClient.callTool(`mcp__orchestr8__${tool}`, input)

    case 'HTTP':
      const endpoint = getHttpEndpoint(tool)
      const response = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      })
      return await response.json()

    case 'Claude SDK':
      return await claudeAdapter[tool](input)
  }
}
```

### Test Data Fixtures

```typescript
// packages/testing/src/fixtures.ts
export const testWorkflows = {
  'hello-world': {
    steps: [{ type: 'return', value: 'Hello, ${inputs.name}!' }],
  },
  'slow-workflow': {
    steps: [{ type: 'delay', ms: 5000 }],
  },
  'failing-workflow': {
    steps: [{ type: 'throw', error: 'Simulated failure' }],
  },
}

export const testExecutions = {
  'completed-exec': {
    state: 'completed',
    output: { result: 'done' },
  },
  'running-exec': {
    state: 'running',
    startedAt: new Date(),
  },
}
```

## Continuous Integration

### CI Test Matrix

```yaml
# .github/workflows/parity-tests.yml
name: Parity Tests

on: [push, pull_request]

jobs:
  parity:
    strategy:
      matrix:
        surface: [mcp, http, claude-sdk]
        test-suite:
          [
            validation,
            execution,
            errors,
            correlation,
            polling,
            cancellation,
            envelope,
          ]

    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4

      - name: Install dependencies
        run: pnpm install

      - name: Run parity tests
        run: pnpm test:parity --surface=${{ matrix.surface }} --suite=${{ matrix.test-suite }}

      - name: Compare results
        run: pnpm test:parity:compare
```

## Success Criteria

All parity tests must pass with:

1. **100% identical responses** for same inputs
2. **Same error codes** for failure scenarios
3. **Identical correlation ID behavior**
4. **Same envelope structure** across surfaces
5. **Consistent timing** for long-polling
6. **No surface-specific logic** detected

## Reporting

### Parity Report Format

```
PARITY TEST REPORT
==================

Surfaces Tested: MCP, HTTP, Claude SDK
Test Suites: 7
Test Cases: 156

✅ Input Validation: 24/24 pass (100% parity)
✅ Successful Execution: 18/18 pass (100% parity)
✅ Error Handling: 22/22 pass (100% parity)
✅ Correlation IDs: 12/12 pass (100% parity)
✅ Long-Polling: 15/15 pass (100% parity)
✅ Cancellation: 10/10 pass (100% parity)
✅ Envelope Structure: 55/55 pass (100% parity)

OVERALL: 100% PARITY ACHIEVED
```

## Maintenance

- Run parity tests on every PR
- Add new test cases for new features
- Update when envelope schema changes
- Monitor for surface-specific drift
- Report parity violations as P0 bugs
