# HTTP API Specification

HTTP REST API adapter for orchestr8 workflow execution in CI/CD and headless environments.

> Created: 2025-01-18
> Version: 1.0.0

## Overview

This specification defines HTTP REST endpoints that serve as an adaptation layer, forwarding requests to the core MCP server. These endpoints enable orchestr8 workflows to be executed from CI/CD pipelines, server environments, and other non-MCP contexts while maintaining exact parity with MCP tool behavior.

## Foundation References

This HTTP API adapter builds upon:

- **MCP Tools**: @.agent-os/specs/2025-01-18-mcp-integration/sub-specs/mcp-tools-spec.md
- **Tool Schemas**: Reuses exact Zod schemas from MCP spec
- **Normalized Envelope**: @.agent-os/specs/2025-01-18-mcp-integration/sub-specs/normalized-envelope.md
- **Correlation IDs**: Same propagation pattern as MCP server

## HTTP API Endpoints

### POST /api/workflows/run

**Purpose:** Execute a workflow (forwards to `mcp__orchestr8__run_workflow`)

**Request:**

```http
POST /api/workflows/run
Authorization: Bearer <token>
Content-Type: application/json

{
  "workflowId": "data-processing",
  "inputs": {
    "source": "s3://bucket/data.csv",
    "format": "parquet"
  },
  "options": {
    "timeoutMs": 60000,
    "resilience": {
      "retry": {
        "maxAttempts": 3
      }
    }
  },
  "correlationId": "req-123",
  "executionId": "client-generated-uuid"  // Optional: for idempotency
```

**Response:**

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "status": "running",
  "executionId": "exec_abc123",
  "workflowId": "data-processing",
  "correlationId": "req-123"
}
```

### GET /api/workflows/status/{executionId}

**Purpose:** Get workflow execution status (forwards to `mcp__orchestr8__get_status`)

**Request:**

```http
GET /api/workflows/status/exec_abc123?waitForMs=5000
Authorization: Bearer <token>
X-Correlation-Id: req-123
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ok",
  "executionId": "exec_abc123",
  "workflowId": "data-processing",
  "data": {
    "outputFile": "s3://bucket/output.parquet",
    "recordsProcessed": 1000000
  },
  "logs": [
    "Started processing at 2025-01-18T10:00:00Z",
    "Completed successfully at 2025-01-18T10:05:00Z"
  ],
  "cost": {
    "inputTokens": 1500,
    "outputTokens": 500
  },
  "correlationId": "req-123"
}
```

### POST /api/workflows/cancel/{executionId}

**Purpose:** Cancel a running workflow (forwards to `mcp__orchestr8__cancel_workflow`)

**Request:**

```http
POST /api/workflows/cancel/exec_abc123
Authorization: Bearer <token>
Content-Type: application/json
X-Correlation-Id: req-123

{
  "reason": "User requested cancellation"
}
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ok",
  "executionId": "exec_abc123",
  "message": "Workflow cancelled successfully",
  "correlationId": "req-123"
}
```

## Response Format

All HTTP endpoints return responses using the Normalized Result Envelope defined in:
**@.agent-os/specs/2025-01-18-mcp-integration/sub-specs/normalized-envelope.md**

This ensures parity with MCP tool responses, enabling clients to use either integration surface interchangeably.

## Authentication & Authorization

### Claude Code Authentication

- Relies on MCP tool permissions (see @.agent-os/specs/2025-01-18-mcp-integration/)
- No additional authentication required for local execution
- Tool access controlled by MCP configuration

### HTTP Authentication

- Bearer token required in Authorization header
- Tokens validated against configured secret
- Optional API key rotation support

### Example Configuration

#### Claude Code MCP Configuration (.claude/mcp.json)

```json
{
  "mcpServers": {
    "orchestr8": {
      "command": "node",
      "args": ["./packages/mcp-server/dist/index.js"],
      "env": {
        "ORCHESTR8_CONFIG": "${HOME}/.orchestr8/config.json"
      }
    }
  }
}
```

#### HTTP API Configuration (config/api.json)

```json
{
  "api": {
    "port": 8088,
    "auth": {
      "type": "bearer",
      "tokens": ["${API_TOKEN_1}", "${API_TOKEN_2}"]
    }
  }
}
```

## Idempotency

### Request Idempotency

- Clients can provide `executionId` for idempotent workflow execution
- Server maintains execution cache for deduplication (5-minute window)
- Duplicate requests with same `executionId` return cached result

### Implementation

```typescript
// Server-side deduplication
async function runWorkflow(request: RunWorkflowRequest) {
  if (request.executionId) {
    const cached = await cache.get(request.executionId)
    if (cached) return cached
  }

  const result = await executeWorkflow(request)
  if (request.executionId) {
    await cache.set(request.executionId, result, ttl: 300000) // 5 min
  }
  return result
}
```

## Rate Limiting

### Limits by Correlation ID

- 100 requests per minute per correlation ID
- 1000 requests per hour per correlation ID
- Configurable burst allowance

### Response Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705577400
```

## Error Handling

### Structured Error Response

```json
{
  "status": "error",
  "error": {
    "code": "TIMEOUT",
    "message": "Workflow execution exceeded 60000ms timeout",
    "retryable": true,
    "details": {
      "executionId": "exec_abc123",
      "elapsedMs": 60500,
      "retryAfterMs": 5000, // For rate limits
      "attemptNumber": 2 // Current retry attempt
    }
  },
  "correlationId": "req-123"
}
```

### Retry Policy

```typescript
// Exponential backoff with jitter for retryable errors
const retryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: 0.1, // ±10% randomization

  shouldRetry: (error: ErrorCode) => RETRYABLE_ERRORS.includes(error),

  calculateDelay: (attempt: number) => {
    const baseDelay = Math.min(
      initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
      maxDelayMs,
    )
    const jitterRange = baseDelay * jitter
    return baseDelay + (Math.random() * 2 - 1) * jitterRange
  },
}
```

### HTTP Status Codes

- **202 Accepted**: Workflow started successfully
- **200 OK**: Status retrieved or action completed
- **400 Bad Request**: Invalid input or validation error
- **401 Unauthorized**: Missing or invalid authentication
- **404 Not Found**: Execution ID not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected server error
- **503 Service Unavailable**: Circuit breaker open

## Versioning

### API Version Header

```http
X-API-Version: 1.0.0
```

### Backward Compatibility

- New optional fields may be added to responses
- Existing field semantics will not change
- Deprecation notices provided 30 days in advance

## OpenAPI Documentation

OpenAPI 3.0 specification will be generated and available at:

- Development: `http://localhost:8088/api/docs`
- Production: `/api/docs` endpoint
