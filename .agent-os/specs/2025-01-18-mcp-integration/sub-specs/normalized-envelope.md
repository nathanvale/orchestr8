# Normalized Result Envelope Specification

This defines the canonical response format used across all @orchestr8 integration surfaces (MCP and HTTP).

> Created: 2025-01-19
> Version: 1.0.0
> Status: Canonical

## Overview

The Normalized Result Envelope provides a consistent response format for all orchestr8 operations, whether invoked through MCP tools or HTTP API endpoints. This ensures parity across integration surfaces and simplifies client implementations.

## JSON Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://orchestr8.io/schemas/normalized-envelope/v1",
  "type": "object",
  "title": "NormalizedEnvelope",
  "description": "Canonical response format for orchestr8 operations",
  "required": ["status", "correlationId"],
  "additionalProperties": false,
  "properties": {
    "status": {
      "type": "string",
      "enum": ["running", "ok", "error"],
      "description": "Execution state of the operation"
    },
    "executionId": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9-_]+$",
      "minLength": 1,
      "maxLength": 256,
      "description": "Unique identifier for workflow execution"
    },
    "workflowId": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9-_]+$",
      "minLength": 1,
      "maxLength": 256,
      "description": "Identifier of the workflow being executed"
    },
    "data": {
      "type": "object",
      "additionalProperties": true,
      "description": "Workflow output data or intermediate results"
    },
    "logs": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "maxItems": 100,
      "description": "Execution logs (truncated to 100 most recent entries)"
    },
    "error": {
      "type": "object",
      "required": ["code", "message", "retryable"],
      "additionalProperties": false,
      "properties": {
        "code": {
          "type": "string",
          "description": "Error code for programmatic handling"
        },
        "message": {
          "type": "string",
          "description": "Human-readable error description"
        },
        "retryable": {
          "type": "boolean",
          "description": "Whether retry might succeed"
        },
        "details": {
          "type": "object",
          "additionalProperties": true,
          "description": "Additional error context"
        }
      },
      "description": "Error information when status is 'error'"
    },
    "cost": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "inputTokens": {
          "type": "integer",
          "minimum": 0,
          "description": "Input tokens consumed"
        },
        "outputTokens": {
          "type": "integer",
          "minimum": 0,
          "description": "Output tokens generated"
        },
        "cacheCreationTokens": {
          "type": "integer",
          "minimum": 0,
          "description": "Tokens used for cache creation (Anthropic)"
        },
        "cacheReadTokens": {
          "type": "integer",
          "minimum": 0,
          "description": "Tokens read from cache (Anthropic)"
        },
        "totalCost": {
          "type": "number",
          "minimum": 0,
          "description": "Total cost in USD (optional)"
        }
      },
      "description": "Token usage and cost tracking"
    },
    "correlationId": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9-_]+$",
      "minLength": 1,
      "maxLength": 256,
      "description": "End-to-end correlation identifier"
    },
    "meta": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "rateLimit": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "limit": {
              "type": "integer",
              "minimum": 0,
              "description": "Request limit per window"
            },
            "remaining": {
              "type": "integer",
              "minimum": 0,
              "description": "Remaining requests in window"
            },
            "resetAt": {
              "type": "string",
              "format": "date-time",
              "description": "When limit window resets"
            }
          },
          "description": "Rate limiting information"
        },
        "requestId": {
          "type": "string",
          "description": "Unique request identifier"
        },
        "startedAt": {
          "type": "string",
          "format": "date-time",
          "description": "Execution start timestamp"
        },
        "completedAt": {
          "type": "string",
          "format": "date-time",
          "description": "Execution completion timestamp"
        },
        "duration": {
          "type": "integer",
          "minimum": 0,
          "description": "Execution duration in milliseconds"
        }
      },
      "description": "Metadata and telemetry"
    }
  }
}
```

## Field Specifications

### Required Fields

#### `status`

- **Type**: `string`
- **Values**:
  - `"running"` - Workflow is currently executing
  - `"ok"` - Workflow completed successfully
  - `"error"` - Workflow failed or was cancelled
- **Usage**: Primary indicator of operation state

#### `correlationId`

- **Type**: `string`
- **Format**: Alphanumeric with hyphens and underscores
- **Purpose**: Links related operations across systems
- **Generation**:
  - Client-provided for traceability
  - Auto-generated as `o8-{uuid}` if not provided

### Conditional Fields

#### `executionId`

- **Present when**: Workflow has been started
- **Purpose**: Unique identifier for tracking specific execution
- **Usage**: Required for `get_status` and `cancel_workflow` operations

#### `workflowId`

- **Present when**: Associated with workflow execution
- **Purpose**: Identifies which workflow definition was executed

#### `data`

- **Present when**: Workflow produces output
- **Content**: Workflow-specific result data
- **Format**: Arbitrary JSON object

#### `logs`

- **Present when**: Execution generates log entries
- **Limit**: Truncated to 100 most recent entries
- **Security**: Sensitive data must be redacted

#### `error`

- **Present when**: `status` is `"error"`
- **Required subfields**:
  - `code`: Standardized error code
  - `message`: Human-readable description
  - `retryable`: Boolean retry indicator

### Optional Fields

#### `cost`

- **Purpose**: Track token usage and costs
- **Mapping from Anthropic SDK**:
  - `inputTokens` ← `usage.input_tokens`
  - `outputTokens` ← `usage.output_tokens`
  - `cacheCreationTokens` ← `usage.cache_creation_input_tokens`
  - `cacheReadTokens` ← `usage.cache_read_input_tokens`

#### `meta`

- **Purpose**: Additional telemetry and control information
- **Common fields**:
  - `rateLimit`: Rate limiting state
  - `requestId`: Unique request tracking
  - `duration`: Performance metrics

## Error Codes

### Standard Codes

```typescript
enum StandardErrorCode {
  // Validation Errors (400-class, not retryable)
  VALIDATION = 'VALIDATION',
  INVALID_INPUT = 'INVALID_INPUT',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',
  INVALID_WORKFLOW = 'INVALID_WORKFLOW',

  // Execution Errors (mixed retryability)
  TIMEOUT = 'TIMEOUT', // Retryable
  CANCELLED = 'CANCELLED', // Not retryable
  RATE_LIMIT = 'RATE_LIMIT', // Retryable with backoff
  EXECUTION_FAILED = 'EXECUTION_FAILED', // Context-dependent

  // System Errors (500-class, mostly retryable)
  INTERNAL_ERROR = 'INTERNAL_ERROR', // Retryable
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE', // Retryable
  CIRCUIT_OPEN = 'CIRCUIT_OPEN', // Not immediately retryable

  // Resource Errors (404-class, not retryable)
  NOT_FOUND = 'NOT_FOUND',
  WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',
  EXECUTION_NOT_FOUND = 'EXECUTION_NOT_FOUND',

  // Authorization Errors (401/403-class, not retryable)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}
```

### Retryability Matrix

| Error Code          | Retryable | Retry Strategy         |
| ------------------- | --------- | ---------------------- |
| TIMEOUT             | ✅        | Exponential backoff    |
| RATE_LIMIT          | ✅        | After reset time       |
| INTERNAL_ERROR      | ✅        | Exponential backoff    |
| SERVICE_UNAVAILABLE | ✅        | Exponential backoff    |
| EXECUTION_FAILED    | ⚠️        | Check error details    |
| CIRCUIT_OPEN        | ❌        | Wait for circuit reset |
| VALIDATION          | ❌        | Fix input              |
| CANCELLED           | ❌        | User-initiated         |
| NOT_FOUND           | ❌        | Invalid reference      |
| UNAUTHORIZED        | ❌        | Fix credentials        |

## Usage Examples

### Successful Execution

```json
{
  "status": "ok",
  "executionId": "exec_abc123",
  "workflowId": "data-processing",
  "data": {
    "recordsProcessed": 1000,
    "outputFile": "s3://bucket/output.parquet"
  },
  "logs": [
    "Started processing at 2025-01-19T10:00:00Z",
    "Completed successfully at 2025-01-19T10:05:00Z"
  ],
  "cost": {
    "inputTokens": 1500,
    "outputTokens": 500
  },
  "correlationId": "claude-session-xyz",
  "meta": {
    "duration": 300000,
    "requestId": "req-789"
  }
}
```

### Running State

```json
{
  "status": "running",
  "executionId": "exec_abc123",
  "workflowId": "data-processing",
  "correlationId": "claude-session-xyz",
  "meta": {
    "startedAt": "2025-01-19T10:00:00Z"
  }
}
```

### Error Response

```json
{
  "status": "error",
  "executionId": "exec_abc123",
  "error": {
    "code": "TIMEOUT",
    "message": "Workflow execution exceeded 60000ms timeout",
    "retryable": true,
    "details": {
      "elapsedMs": 60500,
      "lastStep": "data-transformation"
    }
  },
  "correlationId": "claude-session-xyz",
  "meta": {
    "duration": 60500
  }
}
```

## Integration Requirements

### MCP Tools

All MCP tools (`run_workflow`, `get_status`, `cancel_workflow`) MUST:

1. Return responses matching this schema
2. Include in tool definition: `"outputSchema": { "$ref": "#/definitions/NormalizedEnvelope" }`
3. Map internal states to standard status values
4. Include correlation ID in all responses

### HTTP API

All HTTP endpoints MUST:

1. Return JSON responses matching this schema
2. Use appropriate HTTP status codes (202, 200, 4xx, 5xx)
3. Include rate limit information in `meta.rateLimit`
4. Support correlation ID via header or body

### Parity Testing

Both surfaces MUST pass parity tests verifying:

1. Identical envelope structure for same operations
2. Consistent error code usage
3. Matching correlation ID propagation
4. Equivalent rate limit behavior

## Security Considerations

1. **Secret Redaction**: Never include secrets, tokens, or PII in any field
2. **Log Truncation**: Limit logs to prevent response bloat (100 entries max)
3. **Error Details**: Sanitize error details to prevent information leakage
4. **Correlation IDs**: Use non-guessable IDs to prevent correlation attacks

## Versioning

This schema uses semantic versioning. Changes follow these rules:

- **Patch**: Documentation updates, clarifications
- **Minor**: New optional fields, additional enum values
- **Major**: Breaking changes to required fields or semantics

Current version: `1.0.0`

## References

- **MCP Specification**: Model Context Protocol 2025-06-18
- **JSON Schema**: Draft-07 specification
- **Anthropic SDK**: Token usage field mappings
