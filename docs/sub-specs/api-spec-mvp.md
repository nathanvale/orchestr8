# MVP API Specification

This is the MVP API specification containing only the 4 REST endpoints and core APIs for @orchestr8.

> Created: 2025-01-17
> Version: 1.0.0 (MVP)
> Scope: 4-week MVP delivery

## Core TypeScript APIs

### Orchestrator API

```typescript
/**
 * Main orchestration engine for managing agent execution
 * MVP: Basic parallel/sequential execution with simple resilience
 */
export class Orchestrator {
  constructor(config?: OrchestratorConfig)

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: Agent): void

  /**
   * Execute a workflow with resilience policies
   */
  async execute(
    workflow: Workflow,
    context?: ExecutionContext,
  ): Promise<ExecutionResult>

  /**
   * Execute agents in parallel
   */
  async parallel<T>(...agents: Agent[]): Promise<T[]>

  /**
   * Execute agents sequentially
   */
  async sequential<T>(...agents: Agent[]): Promise<T[]>

  /**
   * Subscribe to orchestration events
   */
  on(event: OrchestratorEvent, handler: EventHandler): void

  /**
   * Get current orchestrator status
   */
  getStatus(): OrchestratorStatus
}

interface OrchestratorConfig {
  resilience?: ResilienceConfig
  telemetry?: TelemetryConfig
  maxConcurrency?: number // MVP: Max 10
  timeout?: number // MVP: Default 30000ms
}
```

### Agent API

```typescript
/**
 * Base class for all agents
 * MVP: Simple agent abstraction
 */
export abstract class BaseAgent {
  abstract readonly id: string
  abstract readonly version: string
  abstract readonly manifest: AgentManifest

  /**
   * Core execution method - agents only need to implement this
   */
  abstract execute(context: AgentContext): Promise<AgentResult>

  /**
   * Framework-managed execution with telemetry
   */
  async run(context: AgentContext): Promise<AgentResult>

  /**
   * Validate inputs before execution
   */
  protected validate(input: unknown): ValidationResult
}

interface AgentManifest {
  name: string
  description: string
  version: string
  capabilities: string[]
  inputSchema: JsonSchema
  outputSchema: JsonSchema
}
```

### Resilience API (MVP Only)

```typescript
/**
 * MVP Resilience patterns - Retry, Timeout, Circuit Breaker only
 */
export interface ResilienceConfig {
  retry?: {
    maxAttempts: number // MVP: Max 3
    baseDelay: number // MVP: 1000ms
    maxDelay: number // MVP: 10000ms
    multiplier: number // MVP: 2
  }

  timeout?: {
    duration: number // MVP: 30000ms
    graceful: boolean // MVP: true
  }

  circuitBreaker?: {
    failureThreshold: number // MVP: 5
    resetTimeout: number // MVP: 60000ms
    halfOpenRequests: number // MVP: 3
  }
}
```

## REST API Endpoints (MVP Only)

### Base URL

```
http://127.0.0.1:8088/api/v1
```

**Security Notes:**

- API binds to 127.0.0.1:8088 only (localhost)
- CORS is disabled entirely
- No external interface listening

### 1. Execute Workflow

**POST** `/v1/workflows/execute`

Execute a workflow with the orchestrator. By default, execution is **asynchronous** and returns immediately with 202 Accepted.

#### Execution Modes (Per ADR-015)

**Default: Asynchronous Execution**

- Returns immediately with 202 Accepted
- Client polls the `checkUrl` for status
- No query parameters needed

**Optional: Synchronous Execution**

- Add `?mode=sync` query parameter
- Blocks until completion or timeout (30s max)
- Returns 200 OK with results or 504 on timeout

#### Request Headers

```http
Idempotency-Key: unique-request-id-123  # Required for idempotent execution (Per ADR-019)
X-Correlation-ID: correlation-abc-123   # Optional: End-to-end tracing
Content-Type: application/json
```

**Idempotency Behavior (Per ADR-019):**

- Idempotency keys are stored for **10 minutes** (600 seconds)
- Duplicate requests with same key return cached response with execution ID
- Only successful executions are cached (errors are not cached)
- Key format: Must be unique string, 1-255 characters, alphanumeric and hyphens only
- Collision behavior: Return same execution if key matches, 409 Conflict if payload differs

#### Request Body

```json
{
  "workflow": {
    "id": "my-workflow",
    "name": "Research Workflow",
    "version": "1.0.0",
    "steps": [
      {
        "id": "step1",
        "type": "agent",
        "agentId": "github-research",
        "inputs": { "username": "octocat" }
      }
    ]
  },
  "context": {
    "correlationId": "abc-123",
    "timeout": 30000
  }
}
```

#### Response: Asynchronous Mode (Default)

**POST** `/v1/workflows/execute`

**Response (202 Accepted):**

```http
HTTP/1.1 202 Accepted
Location: /v1/executions/exec-456
Retry-After: 5
Content-Type: application/json

{
  "executionId": "exec-456",
  "status": "running",
  "message": "Workflow execution started",
  "checkUrl": "/v1/executions/exec-456"
}
```

Client should poll the `checkUrl` to check execution status. Recommended polling interval: 5 seconds (as indicated by Retry-After header).

#### Response: Synchronous Mode

**POST** `/v1/workflows/execute?mode=sync`

**Response (200 OK - Success):**

```json
{
  "executionId": "exec-456",
  "status": "completed",
  "outputs": {
    "step1": { "repositories": [...] }
  },
  "duration": 5432,
  "timestamp": "2025-01-17T10:00:00Z"
}
```

**Note:** Maximum payload size for sync responses is 1MB.

**Response (504 Gateway Timeout - Exceeded 30s):**

```http
HTTP/1.1 504 Gateway Timeout
Location: /v1/executions/exec-456
Retry-After: 10
Content-Type: application/json

{
  "error": {
    "code": "TIMEOUT",
    "message": "Execution exceeded synchronous timeout of 30 seconds",
    "details": {
      "executionId": "exec-456",
      "checkUrl": "/v1/executions/exec-456",
      "elapsedTime": 30000
    }
  }
}
```

#### Idempotency (Per ADR-019)

When using the same `Idempotency-Key` header:

- If execution is still running: Returns existing execution info with 202 Accepted
- If execution completed successfully: Returns cached results with original status code
- If execution failed: Not cached, executes new attempt
- TTL: **10 minutes** for idempotency cache
- Cache cleanup: Expired entries removed automatically every 60 seconds

### 2. Get Execution Status

**GET** `/v1/executions/:id`

Get the current status and results of a workflow execution.

**Response (200 OK):**

```http
HTTP/1.1 200 OK
ETag: "686897696a7c876b7e"
Cache-Control: max-age=0, must-revalidate
Content-Type: application/json

{
  "executionId": "exec-456",
  "status": "completed",  // queued | running | completed | failed | cancelled
  "workflow": {
    "id": "my-workflow",
    "name": "Research Workflow"
  },
  "outputs": {
    "step1": { "repositories": [...] }
  },
  "errors": [],
  "startedAt": "2025-01-17T10:00:00Z",
  "completedAt": "2025-01-17T10:00:05Z",
  "duration": 5432
}
```

**Conditional Request Support:**

- Use `If-None-Match: "686897696a7c876b7e"` header for efficient polling
- Returns `304 Not Modified` if execution state hasn't changed

### 3. Get Execution Journal

**GET** `/v1/executions/:id/journal`

Get the detailed execution journal for debugging. Supports pagination and streaming via NDJSON format.

#### Query Parameters

- `cursor` - Pagination cursor from previous response
- `since` - ISO timestamp to get entries after (e.g., `2025-01-17T10:00:00Z`)
- `limit` - Max entries to return (default: 100, max: 1000)
- `format` - Response format: `json` (default) or `ndjson` for streaming

#### Standard JSON Response (200 OK)

```http
HTTP/1.1 200 OK
ETag: "7c876b7e68689769"
Cache-Control: max-age=0, must-revalidate
Content-Type: application/json

{
  "executionId": "exec-456",
  "entries": [
    {
      "timestamp": "2025-01-17T10:00:00.000Z",
      "level": "info",
      "message": "Workflow execution started",
      "context": { "workflowId": "my-workflow" }
    },
    {
      "timestamp": "2025-01-17T10:00:00.100Z",
      "level": "info",
      "message": "Executing step: step1",
      "context": { "stepId": "step1", "agentId": "github-research" }
    },
    {
      "timestamp": "2025-01-17T10:00:03.500Z",
      "level": "info",
      "message": "Step completed successfully",
      "context": { "stepId": "step1", "duration": 3400 }
    }
  ],
  "pagination": {
    "cursor": "eyJ0aW1lc3RhbXAiOiIyMDI1LTAxLTE3VDEwOjAwOjAzLjUwMFoifQ==",
    "hasMore": true,
    "limit": 100
  },
  "summary": {
    "totalEntries": 1523,
    "errors": 2,
    "warnings": 5,
    "retries": 3
  }
}
```

#### NDJSON Streaming Response

**GET** `/v1/executions/:id/journal?format=ndjson`

```http
HTTP/1.1 200 OK
Content-Type: application/x-ndjson
Transfer-Encoding: chunked

{"timestamp":"2025-01-17T10:00:00.000Z","level":"info","message":"Workflow execution started","context":{"workflowId":"my-workflow"}}
{"timestamp":"2025-01-17T10:00:00.100Z","level":"info","message":"Executing step: step1","context":{"stepId":"step1","agentId":"github-research"}}
{"timestamp":"2025-01-17T10:00:03.500Z","level":"info","message":"Step completed successfully","context":{"stepId":"step1","duration":3400}}
```

**Maximum Response Size:** 10MB for journal responses

### 4. Cancel Execution

**POST** `/v1/executions/:id/cancel`

Cancel a running workflow execution.

**Request:**

```json
{
  "reason": "User requested cancellation",
  "graceful": true
}
```

**Response (202 Accepted):**

```json
{
  "executionId": "exec-456",
  "status": "cancelling",
  "message": "Cancellation requested",
  "graceful": true
}
```

**Response (200 OK - Already completed):**

```json
{
  "executionId": "exec-456",
  "status": "completed",
  "message": "Execution already completed, cannot cancel"
}
```

### 5. Dashboard and WebSocket API

The orchestration server includes a real-time dashboard accessible via browser, with WebSocket support for live updates.

#### Dashboard Routes

**GET** `/`

Serves the React dashboard application.

**Response (200 OK):**

```http
HTTP/1.1 200 OK
Content-Type: text/html
Cache-Control: no-cache

<!DOCTYPE html>
<html>
  <head>
    <title>Orchestr8 Dashboard</title>
    ...
  </head>
  <body>
    <div id="root"></div>
    ...
  </body>
</html>
```

**GET** `/dashboard/*`

Serves dashboard static assets (JS, CSS, images).

**Response (200 OK):**

```http
HTTP/1.1 200 OK
Content-Type: application/javascript|text/css|image/*
Cache-Control: public, max-age=3600
```

#### Dashboard Data API

**GET** `/v1/dashboard/executions`

Get recent workflow executions for dashboard display.

**Query Parameters:**

- `limit` (optional): Number of executions to return (default: 50, max: 100)
- `status` (optional): Filter by status (`running`, `completed`, `failed`)

**Response (200 OK):**

```json
{
  "executions": [
    {
      "id": "exec-456",
      "workflowId": "my-workflow",
      "status": "running",
      "startedAt": "2025-01-17T10:30:00Z",
      "duration": null,
      "steps": [
        {
          "id": "step1",
          "name": "GitHub Research",
          "status": "completed",
          "duration": 2340
        },
        {
          "id": "step2",
          "name": "Profile Analysis",
          "status": "running",
          "duration": null
        }
      ],
      "metadata": {
        "name": "Research Workflow",
        "description": "Research GitHub user profile"
      }
    }
  ],
  "total": 1
}
```

**GET** `/v1/dashboard/metrics`

Get current system metrics for dashboard display.

**Response (200 OK):**

```json
{
  "system": {
    "uptime": 3600,
    "version": "1.0.0",
    "nodeVersion": "v20.0.0",
    "memory": {
      "used": 512000000,
      "total": 1024000000
    }
  },
  "orchestration": {
    "activeExecutions": 2,
    "totalExecutions": 15,
    "successRate": 0.87,
    "averageDuration": 12340
  },
  "agents": {
    "totalRegistered": 5,
    "totalExecutions": 42,
    "averageResponseTime": 2340
  },
  "errors": {
    "totalErrors": 2,
    "errorRate": 0.13,
    "recentErrors": [
      {
        "timestamp": "2025-01-17T10:25:00Z",
        "type": "TimeoutError",
        "message": "Agent timeout after 30s"
      }
    ]
  }
}
```

**GET** `/v1/dashboard/system`

Get system information for dashboard.

**Response (200 OK):**

```json
{
  "version": "1.0.0",
  "uptime": 3600,
  "platform": "darwin",
  "nodeVersion": "v20.0.0",
  "memory": {
    "rss": 45056000,
    "heapTotal": 20480000,
    "heapUsed": 18432000,
    "external": 1024000
  },
  "cpu": {
    "model": "Apple M2",
    "cores": 8
  }
}
```

#### WebSocket Endpoint

**WebSocket** `/ws`

Real-time communication endpoint for dashboard updates.

**Connection:**

```javascript
const ws = new WebSocket('ws://127.0.0.1:8088/ws')
```

**Message Types (Server → Client):**

```json
// Connection established
{
  "type": "connection.established",
  "timestamp": "2025-01-17T10:30:00Z"
}

// Workflow lifecycle events
{
  "type": "workflow.started",
  "workflowId": "my-workflow",
  "executionId": "exec-456",
  "timestamp": "2025-01-17T10:30:00Z"
}

{
  "type": "workflow.completed",
  "workflowId": "my-workflow",
  "executionId": "exec-456",
  "status": "completed",
  "duration": 12340,
  "timestamp": "2025-01-17T10:30:12Z"
}

// Step lifecycle events
{
  "type": "step.started",
  "executionId": "exec-456",
  "stepId": "step1",
  "agentId": "github-research",
  "timestamp": "2025-01-17T10:30:01Z"
}

{
  "type": "step.completed",
  "executionId": "exec-456",
  "stepId": "step1",
  "status": "completed",
  "duration": 2340,
  "timestamp": "2025-01-17T10:30:03Z"
}

// Metrics updates
{
  "type": "metrics.update",
  "metrics": {
    "activeExecutions": 3,
    "totalExecutions": 16,
    "successRate": 0.88
  },
  "timestamp": "2025-01-17T10:30:05Z"
}

// Real-time log entries
{
  "type": "log.entry",
  "level": "info",
  "message": "Step step1 completed successfully",
  "executionId": "exec-456",
  "stepId": "step1",
  "timestamp": "2025-01-17T10:30:03Z"
}
```

**Message Types (Client → Server):**

```json
// Heartbeat/ping
{
  "type": "ping"
}

// Subscribe to specific execution
{
  "type": "subscribe",
  "executionId": "exec-456"
}

// Unsubscribe from execution
{
  "type": "unsubscribe",
  "executionId": "exec-456"
}
```

**WebSocket Behavior:**

- Server sends automatic heartbeat every 30 seconds
- Client should respond to heartbeat with pong
- Connection auto-disconnects after 60 seconds of inactivity
- Supports automatic reconnection with exponential backoff
- Maximum 10 concurrent WebSocket connections per server

## Error Responses

All endpoints use standard HTTP status codes and return errors in this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid workflow configuration",
    "details": {
      "field": "steps[0].agentId",
      "issue": "Agent 'unknown-agent' not found"
    }
  },
  "timestamp": "2025-01-17T10:00:00Z",
  "correlationId": "abc-123"
}
```

### Standard Error Codes (Per ADR-019)

#### Operational Error Taxonomy

**Execution Errors:**

- `TIMEOUT_ERROR` - Operation exceeded timeout limit
- `CANCELLED_ERROR` - Operation was cancelled via AbortSignal
- `CIRCUIT_OPEN_ERROR` - Circuit breaker is open for target
- `RETRYABLE_ERROR` - Operation failed but can be retried

**Validation Errors:**

- `VALIDATION_ERROR` - Input validation failed (schema/format)
- `EXPR_INVALID_SYNTAX` - Invalid expression syntax
- `EXPR_STEP_NOT_FOUND` - Referenced step does not exist
- `EXPR_STEP_NOT_COMPLETED` - Referenced step not completed
- `EXPR_PATH_NOT_FOUND` - Output path not found in step result

**Resource Errors:**

- `NOT_FOUND` - Resource does not exist
- `CONFLICT` - Resource conflict (idempotency key collision)
- `RESOURCE_EXHAUSTED` - System resource limits exceeded

**Network Errors:**

- `NETWORK_ERROR` - Network connectivity issues
- `SERVICE_UNAVAILABLE` - External service unavailable

**System Errors:**

- `INTERNAL_ERROR` - Unexpected server error
- `CONFIGURATION_ERROR` - System configuration issue

#### Enhanced Error Response Format

```json
{
  "error": {
    "code": "TIMEOUT_ERROR",
    "message": "Operation timed out after 30000ms",
    "isRetryable": true,
    "category": "execution",
    "details": {
      "timeoutMs": 30000,
      "operationType": "agent_execution",
      "agentId": "github-research",
      "executionId": "exec-456",
      "attempts": 2,
      "correlationId": "abc-123"
    },
    "cause": {
      "code": "NETWORK_ERROR",
      "message": "Connection timeout to external API"
    }
  },
  "timestamp": "2025-01-17T10:00:00Z",
  "correlationId": "abc-123",
  "executionId": "exec-456"
}
```

#### Error Response Headers

```http
HTTP/1.1 408 Request Timeout
X-Error-Code: TIMEOUT_ERROR
X-Correlation-ID: abc-123
X-Retry-After: 5
Content-Type: application/json
```

## Status Enums

```typescript
enum ExecutionStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}
```

## MVP Constraints

- **No authentication**: Local execution only
- **No GraphQL/WebSocket**: REST only
- **No visual tools**: API and CLI only
- **Max 10 concurrent agents**: Resource limitation
- **30 second timeout**: Default for all operations
- **3 retry attempts max**: With exponential backoff
- **JSON prompts only**: No XML support
- **In-process events**: No distributed messaging

## Next Steps (Post-MVP)

Features deferred to future phases:

- GraphQL API for complex queries
- WebSocket support for real-time updates
- Authentication and authorization
- Agent registry and discovery
- Visual workflow builder
- Time travel debugger
- Advanced resilience patterns (bulkhead, rate limiting)
- Multi-provider LLM support
