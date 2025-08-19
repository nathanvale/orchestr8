# Tests Specification

Testing strategy for @orchestr8 MCP server integration.

> Created: 2025-01-18
> Version: 1.0.0

## Test Coverage Requirements

- **Target Coverage:** >80% for MCP server package
- **Critical Paths:** 100% coverage for tool execution and error handling
- **Integration Tests:** Full MCP protocol compliance validation
- **Parity Tests:** Ensure MCP and HTTP APIs return identical envelopes

## Unit Tests

### MCP Server Core

**File:** `packages/mcp-server/__tests__/server.test.ts`

```typescript
describe('Orchestr8MCPServer', () => {
  describe('initialization', () => {
    it('should create server with default configuration')
    it('should register all tools on initialization')
    it('should register all resources on initialization')
    it('should set correct capabilities')
  })

  describe('transport', () => {
    it('should connect via stdio transport')
    it('should optionally connect via Streamable HTTP transport')
    it('should handle transport errors gracefully')
  })
})
```

### Tool Handlers

**File:** `packages/mcp-server/__tests__/tools/run-workflow.test.ts`

```typescript
describe('run_workflow tool', () => {
  describe('input validation', () => {
    it('should accept valid workflow execution request')
    it('should reject missing workflowId')
    it('should reject invalid workflowId format')
    it('should validate resilience options')
    it('should enforce timeout limits')
  })

  describe('execution', () => {
    it('should start workflow execution')
    it('should generate correlation ID if not provided')
    it('should track correlation across executions')
    it('should apply resilience policies')
  })

  describe('long-polling', () => {
    it('should return immediately without waitForMs')
    it('should poll until completion with waitForMs')
    it('should timeout after waitForMs expires')
    it('should handle execution completion during poll')
  })

  describe('error handling', () => {
    it('should handle workflow not found error')
    it('should handle validation errors')
    it('should handle engine failures')
    it('should return tool failures via ToolResult with isError and envelope')
    it('should reserve JSON-RPC errors for protocol faults only')
  })
})
```

**File:** `packages/mcp-server/__tests__/tools/get-status.test.ts`

```typescript
describe('get_status tool', () => {
  describe('status retrieval', () => {
    it('should return running status')
    it('should return completed status with data')
    it('should return error status with details')
    it('should include logs in response')
  })

  describe('long-polling', () => {
    it('should poll for status changes')
    it('should return on state transition')
    it('should respect waitForMs timeout')
  })

  describe('correlation', () => {
    it('should maintain correlation ID')
    it('should link related executions')
  })
})
```

**File:** `packages/mcp-server/__tests__/tools/cancel-workflow.test.ts`

```typescript
describe('cancel_workflow tool', () => {
  describe('cancellation', () => {
    it('should cancel running workflow')
    it('should include cancellation reason')
    it('should handle already completed workflows')
    it('should handle non-existent executions')
  })

  describe('response', () => {
    it('should return success envelope')
    it('should return error envelope on failure')
    it('should maintain correlation ID')
  })
})
```

### Resource Providers

**File:** `packages/mcp-server/__tests__/resources/workflow.test.ts`

```typescript
describe('workflow:// resource', () => {
  it('should return workflow definition')
  it('should handle non-existent workflows')
  it('should format as JSON with proper indentation')
  it('should include all workflow metadata')
})
```

**File:** `packages/mcp-server/__tests__/resources/execution.test.ts`

```typescript
describe('execution:// resource', () => {
  it('should return execution journal')
  it('should include execution logs')
  it('should handle non-existent executions')
  it('should redact sensitive information')
  it('should enforce size limits on large journals')
})
```

### Schema Validation

**File:** `packages/mcp-server/__tests__/schemas.test.ts`

```typescript
describe('Input Schemas', () => {
  describe('RunWorkflowSchema', () => {
    it('should validate required fields')
    it('should validate workflowId format')
    it('should validate timeout ranges')
    it('should validate resilience options')
    it('should reject extra properties')
  })

  describe('GetStatusSchema', () => {
    it('should validate executionId')
    it('should validate waitForMs range')
    it('should allow optional correlationId')
  })

  describe('CancelWorkflowSchema', () => {
    it('should validate executionId')
    it('should validate reason length')
    it('should allow optional fields')
  })
})
```

## Integration Tests

### MCP Protocol Compliance

**File:** `packages/mcp-server/__tests__/integration/protocol.test.ts`

```typescript
describe('MCP Protocol Compliance', () => {
  let server: Orchestr8MCPServer
  let client: MCPTestClient

  beforeEach(async () => {
    server = new Orchestr8MCPServer({ engine })
    client = new MCPTestClient()
    await connectViaTestTransport(server, client)
  })

  describe('initialization handshake', () => {
    it('should complete MCP initialization')
    it('should advertise correct protocol version')
    it('should expose tools capability')
    it('should expose resources capability')
  })

  describe('tool discovery', () => {
    it('should list all available tools')
    it('should provide tool schemas')
    it('should include tool descriptions')
  })

  describe('resource discovery', () => {
    it('should list available resources')
    it('should provide resource templates')
  })

  describe('JSON-RPC compliance', () => {
    it('should handle valid requests')
    it('should reject malformed JSON')
    it('should return proper error codes')
    it('should include request ID in responses')
  })
})
```

### End-to-End Workflow Tests

**File:** `packages/mcp-server/__tests__/integration/workflows.test.ts`

```typescript
describe('End-to-End Workflow Execution', () => {
  it('should execute simple sequential workflow', async () => {
    // Start workflow
    const runResult = await client.callTool('run_workflow', {
      workflowId: 'test-sequential',
      inputs: { value: 42 },
    })

    expect(runResult.status).toBe('running')

    // Poll for completion
    const statusResult = await client.callTool('get_status', {
      executionId: runResult.executionId,
      waitForMs: 5000,
    })

    expect(statusResult.status).toBe('ok')
    expect(statusResult.data.result).toBe(84)
  })

  it('should execute parallel workflow with resilience', async () => {
    const result = await client.callTool('run_workflow', {
      workflowId: 'test-parallel',
      inputs: { items: [1, 2, 3] },
      options: {
        resilience: {
          retry: { maxAttempts: 3 },
          timeout: { ms: 5000 },
        },
      },
      waitForMs: 10000,
    })

    expect(result.status).toBe('ok')
    expect(result.data.processed).toBe(3)
  })

  it('should handle workflow cancellation', async () => {
    // Start long-running workflow
    const runResult = await client.callTool('run_workflow', {
      workflowId: 'test-long-running',
      inputs: {},
    })

    // Cancel it
    const cancelResult = await client.callTool('cancel_workflow', {
      executionId: runResult.executionId,
      reason: 'Test cancellation',
    })

    expect(cancelResult.status).toBe('ok')

    // Verify cancelled status
    const statusResult = await client.callTool('get_status', {
      executionId: runResult.executionId,
    })

    expect(statusResult.status).toBe('error')
    expect(statusResult.error.code).toBe('CANCELLED')
  })
})
```

## Parity Tests

### MCP vs HTTP Envelope Parity

**File:** `packages/mcp-server/__tests__/parity/envelope.test.ts`

```typescript
describe('MCP vs HTTP Envelope Parity', () => {
  let mcpServer: Orchestr8MCPServer
  let httpServer: Orchestr8HTTPServer

  const testCases = [
    {
      name: 'successful execution',
      input: { workflowId: 'test', inputs: {} },
      expectedStatus: 'ok',
    },
    {
      name: 'validation error',
      input: { workflowId: '', inputs: {} },
      expectedStatus: 'error',
    },
    {
      name: 'timeout error',
      input: {
        workflowId: 'slow-workflow',
        options: { timeoutMs: 100 },
      },
      expectedStatus: 'error',
    },
  ]

  testCases.forEach(({ name, input, expectedStatus }) => {
    it(`should return identical envelope for ${name}`, async () => {
      // Execute via MCP
      const mcpResult = await mcpServer.handleToolCall('run_workflow', input)

      // Execute via HTTP
      const httpResult = await httpServer.handlePost(
        '/api/workflows/run',
        input,
      )

      // Parse responses
      const mcpEnvelope = JSON.parse(mcpResult.content[0].text)
      const httpEnvelope = httpResult.body

      // Compare envelopes
      expect(mcpEnvelope.status).toBe(httpEnvelope.status)
      expect(mcpEnvelope.status).toBe(expectedStatus)
      expect(mcpEnvelope.correlationId).toBe(httpEnvelope.correlationId)

      // Structure should be identical
      expect(Object.keys(mcpEnvelope).sort()).toEqual(
        Object.keys(httpEnvelope).sort(),
      )
    })
  })
})
```

## Performance Tests

**File:** `packages/mcp-server/__tests__/performance/throughput.test.ts`

```typescript
describe('MCP Server Performance', () => {
  it('should handle 100 concurrent tool calls', async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      client.callTool('run_workflow', {
        workflowId: `test-${i}`,
        inputs: { index: i },
      }),
    )

    const results = await Promise.all(promises)
    const successCount = results.filter((r) => r.status !== 'error').length

    expect(successCount).toBeGreaterThan(95) // Allow 5% failure rate
  })

  it('should maintain <100ms overhead for tool calls', async () => {
    const iterations = 50
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await client.callTool('get_status', {
        executionId: 'test-execution',
      })
      const end = performance.now()
      times.push(end - start)
    }

    const p95 = percentile(times, 95)
    expect(p95).toBeLessThan(100)
  })

  it('should handle large workflow definitions', async () => {
    const largeWorkflow = {
      workflowId: 'large-workflow',
      inputs: {
        data: Array(1000).fill({ value: 'test' }),
      },
    }

    const result = await client.callTool('run_workflow', largeWorkflow)
    expect(result.status).not.toBe('error')
  })
})
```

## Security Tests

**File:** `packages/mcp-server/__tests__/security/validation.test.ts`

```typescript
describe('Security Validation', () => {
  describe('input sanitization', () => {
    it('should reject prototype pollution attempts')
    it('should reject __proto__ in inputs')
    it('should reject constructor manipulation')
    it('should enforce maximum payload size')
  })

  describe('secret redaction', () => {
    it('should redact API keys from logs')
    it('should redact tokens from responses')
    it('should redact passwords from errors')
    it('should not log to stdout (stdio transport)')
  })

  describe('resource access', () => {
    it('should prevent directory traversal')
    it('should validate resource URIs')
    it('should enforce access controls')
  })
})
```

## Mocking Strategy

### External Dependencies

```typescript
// Mock orchestration engine
export class MockOrchestrationEngine {
  private executions = new Map()

  async startExecution(workflowId: string, inputs: any) {
    const executionId = `exec_${crypto.randomUUID()}`
    this.executions.set(executionId, {
      id: executionId,
      workflowId,
      state: 'running',
      inputs,
    })
    return { id: executionId }
  }

  async getExecutionStatus(executionId: string) {
    return (
      this.executions.get(executionId) || {
        state: 'error',
        error: new Error('Execution not found'),
      }
    )
  }
}
```

### Test Transport

```typescript
// In-memory transport for testing
export class TestTransport {
  private messages: any[] = []

  async send(message: any) {
    this.messages.push(message)
  }

  async receive() {
    return this.messages.shift()
  }
}
```

## Test Utilities

### MCP Test Client

```typescript
export class MCPTestClient {
  constructor(private transport: TestTransport) {}

  async callTool(name: string, args: any) {
    const request = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'tools/call',
      params: { name, arguments: args },
    }

    await this.transport.send(request)
    const response = await this.transport.receive()

    if (response.error) {
      throw new Error(response.error.message)
    }

    // In MCP, envelope is serialized in ToolResult content
    return JSON.parse(response.result.content[0].text)
  }
}
```

### Test Fixtures

```typescript
export const fixtures = {
  validWorkflow: {
    id: 'test-workflow',
    name: 'Test Workflow',
    steps: [{ type: 'service', service: { url: 'http://example.com' } }],
  },

  validExecution: {
    id: 'exec_123',
    workflowId: 'test-workflow',
    state: 'completed',
    output: { result: 'success' },
  },
}
```

## CI/CD Integration

```yaml
# .github/workflows/mcp-tests.yml
name: MCP Server Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test packages/mcp-server
      - run: pnpm test:coverage packages/mcp-server
      - uses: codecov/codecov-action@v3
        with:
          files: ./packages/mcp-server/coverage/lcov.info
```
