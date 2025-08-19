# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-01-18-claude-subagents-integration/spec.md

> Created: 2025-01-18
> Version: 1.0.0

## Test Coverage

### Unit Tests

**SharedOrchestrationCore**

- Validate input schemas for all actions (run_workflow, get_status, cancel_workflow)
- Build normalized envelope from execution results
- Handle validation errors with proper error codes
- Generate correlation IDs when not provided
- Enforce memory limits on execution journals

**MCPServer**

- Parse MCP tool calls correctly
- Handle malformed tool inputs gracefully
- Format responses according to MCP specification
- Support long-polling for status checks
- Manage connection lifecycle and reconnection

**HTTPController**

- Parse HTTP requests with proper content types
- Validate bearer token authentication
- Handle CORS preflight requests
- Return appropriate HTTP status codes
- Include rate limit headers in responses

**CachedPromptBuilder**

- Add cache_control to system prompts
- Cache tool definitions at correct position
- Calculate token savings from cache hits
- Handle prompts exceeding minimum cache size
- Parse cache metrics from Claude responses

**ThinkingBlockHandler**

- Filter out thinking blocks from responses
- Redact thinking content if accidentally captured
- Ensure thinking blocks never appear in envelopes
- Ignore thinking blocks in streaming responses
- Extract only rationale-lite summaries

### Integration Tests

**MCP ↔ Orchestr8 Engine**

- Execute workflow via MCP tool call
- Poll status until completion
- Cancel running workflow successfully
- Handle timeout with proper error response
- Propagate AbortSignal through execution chain

**HTTP ↔ Orchestr8 Engine**

- Start workflow via POST endpoint
- Long-poll status with waitForMs parameter
- Cancel workflow via POST endpoint
- Handle concurrent requests with same correlation ID
- Respect rate limits per correlation ID

**Claude Adapter Integration**

- Generate prompts with proper caching structure
- Parse Claude responses with Chain of Thought
- Handle API errors and retries
- Track token usage and costs
- Support streaming responses

### Parity Tests

**Envelope Parity**

- Identical envelope structure from MCP and HTTP for run_workflow
- Identical envelope structure from MCP and HTTP for get_status
- Identical envelope structure from MCP and HTTP for cancel_workflow
- Consistent error envelopes across both surfaces
- Matching correlation ID handling

**Parallel Tool Call Parity**

- Tool results grouped in single user message for both surfaces
- Parallel execution semantics maintained
- No split tool_result blocks across messages
- Consistent handling of multiple tool_use blocks
- Order preservation for dependent tool calls

**Validation Parity**

- Same validation errors for invalid workflow IDs
- Same validation errors for malformed inputs
- Same validation errors for invalid options
- Consistent handling of missing required fields
- Identical regex pattern enforcement

**Behavior Parity**

- Same timeout behavior across surfaces
- Identical retry logic application
- Consistent circuit breaker triggers
- Matching cancellation semantics
- Same journal truncation limits

### End-to-End Tests

**Complete Workflow Execution**

- Claude subagent calls MCP tool to run workflow
- Workflow executes with resilience patterns
- Status polling returns progressive updates
- Final result includes complete envelope
- Correlation ID maintained throughout

**Multi-Agent Collaboration**

- Coordinator agent initiates workflow
- TypeScript Pro agent receives handoff
- Shared correlation ID across agents
- Orchestr8 tracks unified execution
- Results aggregated correctly

**Error Recovery Flow**

- Initial execution fails with retryable error
- Automatic retry with backoff
- Circuit breaker prevents cascade
- Error envelope includes retry guidance
- Client handles error appropriately

### Performance Tests

**Latency Measurements**

- MCP tool call overhead <50ms
- HTTP endpoint response <100ms
- Status polling latency <200ms
- Cancellation response <150ms
- End-to-end execution overhead <100ms (p95)

**Throughput Tests**

- Handle 100 concurrent MCP connections
- Process 1000 HTTP requests/second
- Support 50 active executions
- Maintain performance under load
- Graceful degradation at limits

**Memory Tests**

- Journal stays within 10MB limit
- No memory leaks during long polling
- Efficient correlation ID tracking
- Proper cleanup of completed executions
- Cache memory bounded appropriately

### Security Tests

**Authentication & Authorization**

- Reject requests without bearer token (HTTP)
- Validate token format and expiry
- Respect MCP tool permissions
- Prevent token leakage in logs
- Handle authentication errors properly

**Input Sanitization**

- Prevent injection attacks in workflow IDs
- Sanitize correlation IDs
- Validate JSON payload sizes
- Reject malformed requests
- Escape user inputs in responses

**Secret Management**

- Never log sensitive tokens
- Redact secrets in error messages
- Secure token storage
- Rotate tokens without downtime
- Audit token usage

### JSON Mode Tests

**Response Format Validation**

- Enforce JSON-only output when response_format set
- Fail on non-JSON responses appropriately
- Validate against JSON schema when provided
- Handle malformed JSON gracefully
- Test JSON mode with and without schema constraints

### Streaming Tests

**Fine-grained Tool Streaming**

- Assemble input_json_delta chunks correctly
- Handle malformed partial JSON
- Validate complete JSON after assembly
- Test streaming with client-side validation
- Recovery from interrupted streams

**Thinking Block Streaming**

- Filter thinking_delta events properly
- Never expose thinking content to users
- Handle interleaved thinking and tool blocks
- Test signature validation in thinking blocks
- Ensure clean separation of content types

### Cache Metrics Tests

**Usage Field Mapping**

- Verify cache_creation_input_tokens presence
- Verify cache_read_input_tokens presence
- Calculate cache hit ratio correctly
- Map usage fields to envelope.cost
- Test cache metrics across multiple calls

### Retry and Backoff Tests

**Deterministic Retry Behavior**

- Retry on 429 with exponential backoff
- Retry on 5xx errors with jitter
- Respect max attempts limit
- Use correct delay calculations
- Include retry metadata in errors

### Idempotency Tests

**Request Deduplication**

- Same executionId returns cached result
- Deduplication window of 5 minutes
- Different executionId executes new workflow
- Test cache expiration behavior
- Verify idempotency across both surfaces

### Mocking Requirements

**Claude API Mocking**

- Mock successful completion responses
- Mock streaming responses with chunks
- Mock rate limit errors (429)
- Mock timeout scenarios
- Mock token usage with cache fields
- Mock response_format enforcement
- Mock fine-grained tool streaming
- Mock thinking blocks in responses

**Orchestr8 Engine Mocking**

- Mock workflow execution start
- Mock status progression (running → ok)
- Mock execution failures
- Mock cancellation acknowledgment
- Mock journal entries

**MCP Runtime Mocking**

- Mock tool registration
- Mock tool invocation
- Mock connection establishment
- Mock reconnection after disconnect
- Mock permission checks

**HTTP Client Mocking**

- Mock successful POST requests
- Mock GET with long-polling
- Mock network errors
- Mock timeout scenarios
- Mock rate limit responses

### Test Data Fixtures

**Workflow Definitions**

```typescript
export const testWorkflows = {
  simple: {
    id: 'test-simple',
    steps: [{ type: 'log', message: 'Hello' }],
  },
  complex: {
    id: 'test-complex',
    steps: [
      /* parallel, sequential, conditional */
    ],
  },
  failing: {
    id: 'test-failing',
    steps: [{ type: 'throw', error: 'Intentional' }],
  },
}
```

**Claude Responses**

```typescript
export const claudeResponses = {
  withThinking: {
    content: [
      {
        type: 'thinking',
        thinking: 'Analyzing the workflow requirements...',
        signature: 'EqQBCgIYAhIM1gbcDa9GJwZA...',
      },
      {
        type: 'text',
        text: 'Processing workflow with retry pattern enabled.',
      },
    ],
  },
  withCache: {
    usage: {
      input_tokens: 100,
      output_tokens: 200,
      cache_creation_input_tokens: 1000,
      cache_read_input_tokens: 900,
    },
  },
  jsonMode: {
    response_format: { type: 'json_object' },
    content: [
      {
        type: 'text',
        text: '{"status": "ok", "executionId": "exec_123", "data": {}}',
      },
    ],
  },
}
```

**Error Scenarios**

```typescript
export const errorScenarios = {
  timeout: {
    code: 'TIMEOUT',
    message: 'Execution exceeded 60000ms',
    retryable: true,
  },
  validation: {
    code: 'VALIDATION',
    message: 'Invalid workflow ID format',
    retryable: false,
  },
  rateLimit: {
    code: 'RATE_LIMIT',
    message: 'Too many requests',
    retryable: true,
  },
}
```

### Coverage Requirements

- **Unit Test Coverage**: >95% for all new code
- **Integration Test Coverage**: >90% for critical paths
- **Parity Test Coverage**: 100% for envelope structure
- **E2E Test Coverage**: Core workflows must pass
- **Performance Tests**: Must meet defined SLAs

### Test Execution Strategy

**Local Development**

```bash
# Run all tests with Wallaby.js
pnpm test

# Run specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:parity
pnpm test:e2e
```

**CI/CD Pipeline**

```yaml
- name: Unit Tests
  run: pnpm test:unit --coverage
- name: Integration Tests
  run: pnpm test:integration
- name: Parity Tests
  run: pnpm test:parity
- name: E2E Tests
  run: pnpm test:e2e
```

### Test Tools & Frameworks

- **Vitest**: Test runner with v8 coverage
- **Wallaby.js**: Inline test feedback
- **MSW**: Mock Service Worker for API mocking
- **Zod**: Schema validation testing
- **Supertest**: HTTP endpoint testing
