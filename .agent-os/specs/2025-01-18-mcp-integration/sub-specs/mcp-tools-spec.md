# MCP Tools Specification

Detailed specification of MCP tools exposed by the @orchestr8 MCP server.

> Created: 2025-01-18
> Version: 1.0.0

## Tool Naming Convention

All orchestr8 MCP tools use short, human-friendly names per MCP guidance. The client will display or qualify tool names; do not prefix with `mcp__` or server names.

- Tool names:
  - `run_workflow`
  - `get_status`
  - `cancel_workflow`

## Tool Definitions

### run_workflow

**Purpose:** Execute an orchestr8 workflow with resilience patterns

**Input Schema (JSON Schema):**

```json
{
  "type": "object",
  "required": ["workflowId"],
  "properties": {
    "workflowId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "description": "Unique identifier of the workflow to execute"
    },
    "inputs": {
      "type": "object",
      "additionalProperties": true,
      "default": {},
      "description": "Input parameters for the workflow"
    },
    "options": {
      "type": "object",
      "properties": {
        "timeoutMs": {
          "type": "integer",
          "minimum": 0,
          "maximum": 300000,
          "description": "Maximum execution time in milliseconds"
        },
        "concurrency": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100,
          "description": "Maximum concurrent operations"
        },
        "resilience": {
          "type": "object",
          "properties": {
            "retry": {
              "type": "object",
              "properties": {
                "maxAttempts": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 10
                },
                "delayMs": {
                  "type": "integer",
                  "minimum": 0
                },
                "backoff": {
                  "type": "string",
                  "enum": ["fixed", "exponential", "linear"]
                }
              }
            },
            "circuitBreaker": {
              "type": "object",
              "properties": {
                "threshold": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1
                },
                "windowMs": {
                  "type": "integer",
                  "minimum": 1000
                }
              }
            },
            "timeout": {
              "type": "object",
              "properties": {
                "ms": {
                  "type": "integer",
                  "minimum": 100,
                  "maximum": 300000
                }
              }
            }
          }
        }
      },
      "description": "Execution options and resilience configuration"
    },
    "waitForMs": {
      "type": "integer",
      "minimum": 0,
      "maximum": 10000,
      "description": "Long-polling timeout in milliseconds"
    },
    "correlationId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[a-zA-Z0-9-_]+$",
      "description": "End-to-end correlation identifier"
    }
  }
}
```

**Output Contract:** Returns a [Normalized Result Envelope](./normalized-envelope.md) serialized into MCP ToolResult `content[0].text`. On tool failures, set `isError: true` and include the envelope with `status: "error"`.

**Example Usage:**

```typescript
// In Claude Code or any MCP client (short tool names)
const result = await callTool('run_workflow', {
  workflowId: 'data-processing',
  inputs: {
    source: 's3://bucket/input.csv',
    format: 'parquet',
  },
  options: {
    timeoutMs: 60000,
    resilience: {
      retry: { maxAttempts: 3 },
    },
  },
  correlationId: 'session-123',
})
```

### get_status

**Purpose:** Get the status of a running or completed workflow execution

**Input Schema (JSON Schema):**

```json
{
  "type": "object",
  "required": ["executionId"],
  "properties": {
    "executionId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "description": "Unique identifier of the execution to query"
    },
    "waitForMs": {
      "type": "integer",
      "minimum": 0,
      "maximum": 10000,
      "description": "Long-polling timeout in milliseconds"
    },
    "correlationId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[a-zA-Z0-9-_]+$",
      "description": "End-to-end correlation identifier"
    }
  }
}
```

**Output Contract:** Returns a [Normalized Result Envelope](./normalized-envelope.md) serialized into MCP ToolResult `content[0].text`. On tool failures, set `isError: true`.

**Long-Polling Behavior:**

- If `waitForMs` is provided and status is `running`, the server will poll internally
- Returns immediately if workflow completes or timeout is reached
- Polling uses bounded backoff (start ~100ms, cap ~1000ms)

### cancel_workflow

**Purpose:** Cancel a running workflow execution

**Input Schema (JSON Schema):**

```json
{
  "type": "object",
  "required": ["executionId"],
  "properties": {
    "executionId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "description": "Unique identifier of the execution to cancel"
    },
    "reason": {
      "type": "string",
      "maxLength": 1024,
      "description": "Optional reason for cancellation"
    },
    "correlationId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[a-zA-Z0-9-_]+$",
      "description": "End-to-end correlation identifier"
    }
  }
}
```

**Output Contract:** Returns a [Normalized Result Envelope](./normalized-envelope.md) serialized into MCP ToolResult `content[0].text`.

## Tool Discovery

MCP clients can discover available tools using the standard MCP protocol:

```typescript
// List all available tools
const tools = await mcp.listTools()

// Returns (example):
[
  {
    name: 'run_workflow',
    description: 'Execute an orchestr8 workflow with resilience patterns',
    inputSchema: { /* JSON Schema */ }
  },
  // ... other tools
]
```

## Error Handling

All tools return errors inside the normalized envelope, serialized in ToolResult content. Set `isError: true` for tool-level failures. Reserve JSON-RPC errors for protocol faults (e.g., parse errors, invalid request).

```json
{
  "status": "error",
  "error": {
    "code": "WORKFLOW_NOT_FOUND",
    "message": "Workflow 'invalid-id' does not exist",
    "retryable": false
  },
  "correlationId": "session-123"
}
```

## Correlation ID Propagation

- If `correlationId` is not provided, auto-generate as `o8-${uuid}`
- Correlation IDs must be included in all responses
- Used for end-to-end tracing across multiple tool calls

## Idempotency Key

- Clients MAY supply `idempotencyKey` (distinct from `executionId`) on `run_workflow` to deduplicate identical start requests
- The server SHOULD return the same envelope for duplicate keys within a bounded TTL

## Integration with Claude Code

When using these tools in Claude Code:

1. Configure the MCP server in `.claude/mcp.json`
2. Tools appear with their short names: `run_workflow`, `get_status`, `cancel_workflow`
3. Add short tool names to allowed tools in agent configuration
4. Claude can invoke tools directly through natural language

Example agent configuration:

```json
{
  "allowedTools": ["run_workflow", "get_status", "cancel_workflow"]
}
```
