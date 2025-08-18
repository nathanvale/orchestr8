# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-01-17-orchestr8-system/spec.md

> Created: 2025-01-17
> Version: 2.0.0 - Enhanced with concrete testing architecture
> Status: Comprehensive test strategy with ADR conformance

## Testing Architecture Overview

The @orchestr8 testing strategy implements a multi-layered approach with separated Vitest projects, property-based testing, and strict ADR conformance validation. For detailed architecture, see:

- **Testing Architecture**: @.agent-os/specs/2025-01-17-orchestr8-system/sub-specs/testing-architecture.md
- **ADR Conformance Tests**: @.agent-os/specs/2025-01-17-orchestr8-system/sub-specs/adr-conformance-tests.md

## Test Coverage Strategy

### MVP Coverage Requirements (ADR-009 Aligned)

#### Coverage Configuration (v8 Reporter - No nyc)

Per ADR-009, all packages must use Vitest with v8 coverage reporter. **CRITICAL: Do NOT use nyc for coverage merging**:

````typescript
// vitest.config.ts - Standard configuration for all packages
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',           // Required by ADR-009 - ONLY use v8
      reporter: ['text', 'json-summary', 'html'],  // json-summary for Codecov
      reportsDirectory: './coverage/',  // Standard directory for CI
      exclude: [
        'dist/**',
        'node_modules/**',
        '**/*.config.{js,ts}',
        '**/*.test.{js,ts}',
        '**/index.ts'             // Simple re-exports
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    reporters: [
      'default',
      ['junit', { outputFile: './test-results/junit.xml' }]
    ]
  }
});

// CI/CD Coverage Upload (NO nyc merge)
// .github/workflows/test.yml
```yaml
- name: Run Tests with Coverage
  run: pnpm test:coverage

- name: Upload Coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-summary.json
    flags: unit-tests
    # Codecov handles merging automatically - NO nyc needed
````

#### Core Packages (80% Coverage Required)

- **@orchestr8/core** - Orchestration engine
- **@orchestr8/resilience** - Retry, circuit breaker, timeout
- **@orchestr8/schema** - Workflow AST and validation

These packages form the foundation and must be thoroughly tested with comprehensive unit and integration tests.

#### Supporting Packages (60-70% Coverage)

- **@orchestr8/agent-base** - Base agent classes
- **@orchestr8/testing** - Test utilities
- **@orchestr8/cli** - Command-line tools

Critical infrastructure and user-facing tools.

#### Example Packages (50%+ Coverage)

- **@orchestr8/hello-world** - Example agent implementation

Demonstration code with focus on happy paths.

#### Deferred Packages (Post-MVP)

- **@orchestr8/builder** - Visual workflow builder (Phase 3)
- **@orchestr8/debugger** - Time travel debugger (Phase 3)
- **@orchestr8/runtime** - Advanced execution environment (Phase 2)

Not included in MVP scope.

## ADR Traceability Matrix

This section maps test requirements to specific Architectural Decision Records to ensure compliance:

| ADR         | Decision                         | Test Requirement                | Implementation                              |
| ----------- | -------------------------------- | ------------------------------- | ------------------------------------------- |
| **ADR-001** | Modular Monorepo                 | Cross-package integration tests | Test imports between @orchestr8/\* packages |
| **ADR-002** | JSON Prompts + Schema Versioning | Schema validation tests         | Test Zod validation, hash verification      |
| **ADR-003** | REST API Only                    | API integration tests           | Test all 4 endpoints, HTTP semantics        |
| **ADR-004** | Basic Resilience Patterns        | Resilience pattern tests        | Test retry, timeout, circuit breaker        |
| **ADR-005** | In-Process Event Bus             | Event bus tests                 | Test bounded queue, overflow policy         |
| **ADR-006** | No Visual Tools in MVP           | N/A - Validation only           | Ensure no visual dependencies in MVP        |
| **ADR-007** | Local-Only Security              | Security constraint tests       | Test 127.0.0.1 binding, CORS disabled       |
| **ADR-008** | TypeScript Strict Mode           | Type safety tests               | Validate strict mode compilation            |
| **ADR-009** | 80% Test Coverage + v8           | Coverage enforcement            | vitest.config.ts with v8 provider           |
| **ADR-010** | pnpm Publishing                  | Build pipeline tests            | Test pnpm commands, workspace protocols     |
| **ADR-011** | Local LLM (Deferred)             | N/A - Post-MVP                  | No tests required for MVP                   |
| **ADR-012** | Dual Deployment                  | Adapter compatibility tests     | Test microservice vs sub-agent modes        |
| **ADR-014** | Resilience Composition           | Composition order tests         | Test retry(CB(timeout)) pattern             |
| **ADR-015** | API Execution Modes              | API semantics tests             | Test async (202) vs sync modes              |
| **ADR-016** | Dashboard Technology             | (Post-MVP)                      | Deferred to Phase 3                         |
| **ADR-017** | Port 8088 Selection              | (Post-MVP)                      | Deferred to Phase 3                         |
| **ADR-018** | Execution Semantics              | Concurrency tests               | Test semaphore limits, cancellation         |
| **ADR-019** | Operational Contracts            | Contract validation tests       | Test scheduler, idempotency, ETags          |

### Test Implementation for ADR Compliance

```typescript
// ADR-002: Schema versioning compliance test
describe('JSON Schema Versioning (ADR-002)', () => {
  it('validates schema with hash verification', async () => {
    const schema = await loadWorkflowSchema()
    expect(schema.version).toBeDefined()
    expect(schema.schemaHash).toMatch(/^[a-f0-9]{64}$/) // SHA-256

    const hashCalculated = calculateSchemaHash(schema)
    expect(hashCalculated).toBe(schema.schemaHash)
  })

  it('rejects schemas with invalid hash', async () => {
    const invalidSchema = { ...validSchema, schemaHash: 'invalid' }
    await expect(validateSchema(invalidSchema)).rejects.toThrow(
      'Invalid schema hash',
    )
  })
})

// ADR-014: Resilience pattern composition test
describe('Resilience Composition (ADR-014)', () => {
  it('composes patterns in correct order: retry(circuitBreaker(timeout))', async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new Error('Service unavailable'))

    const resilientOperation = withResilience(operation, {
      retry: { maxAttempts: 3 },
      circuitBreaker: { failureThreshold: 2 },
      timeout: { duration: 1000 },
    })

    await expect(resilientOperation()).rejects.toThrow()

    // Verify composition order: retry wraps CB which wraps timeout
    // Each retry attempt goes through CB and timeout
    expect(operation).toHaveBeenCalledTimes(3) // 3 retry attempts
    expect(circuitBreakerState).toBe('OPEN') // CB opened after 2 failures

    // Verify timeout is per-attempt, not global
    const callDurations = operation.mock.calls.map((call) => call.duration)
    expect(Math.max(...callDurations)).toBeLessThanOrEqual(1000) // Each attempt ≤ 1s
  })
})

// ADR-007: Security constraints test
describe('Local-Only Security (ADR-007)', () => {
  it('rejects non-localhost requests', async () => {
    const request = createMockRequest({
      headers: { host: 'example.com:3000' },
    })

    const response = await handleRequest(request)
    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('accepts both IPv4 and IPv6 localhost', () => {
    const isLocalhost = (address: string) => {
      return (
        address === '127.0.0.1' || address === '::1' || address === 'localhost'
      )
    }

    expect(isLocalhost('127.0.0.1')).toBe(true)
    expect(isLocalhost('::1')).toBe(true)
    expect(isLocalhost('localhost')).toBe(true)
    expect(isLocalhost('example.com')).toBe(false)
  })

  it('binds server to local interface only', () => {
    const server = createServer()
    const { address } = server.address() as AddressInfo

    // Accept either IPv4 or IPv6 localhost
    expect(['127.0.0.1', '::1']).toContain(address)
  })
})

// ADR-009: Coverage enforcement test
describe('Coverage Enforcement (ADR-009)', () => {
  it('uses v8 coverage provider', () => {
    const config = loadVitestConfig()
    expect(config.test.coverage.provider).toBe('v8')
    expect(config.test.coverage.reportsDirectory).toBe(
      './test-results/coverage/',
    )
  })

  it('enforces 80% threshold for core packages', () => {
    const config = loadVitestConfig()
    expect(config.test.coverage.thresholds.lines).toBe(80)
    expect(config.test.coverage.thresholds.branches).toBe(80)
  })
})

// ADR-012: Dual deployment test
describe('Dual Deployment Modes (ADR-012)', () => {
  it('microservice adapter responds to POST /process', async () => {
    const adapter = new MicroserviceAdapter(agent)
    const response = await adapter.handleRequest({
      method: 'POST',
      path: '/process', // Standardized path without /agent prefix
      body: { input: 'test data' },
    })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('output')
  })

  it('sub-agent adapter exports handleRequest function', async () => {
    const adapter = new SubAgentAdapter(agent)
    const result = await adapter.handleRequest({ input: 'test data' })

    expect(result).toHaveProperty('output')
    expect(typeof adapter.handleRequest).toBe('function')
  })

  it('both adapters produce equivalent output', async () => {
    const microservice = new MicroserviceAdapter(agent)
    const subAgent = new SubAgentAdapter(agent)
    const input = { data: 'test' }

    const microResponse = await microservice.handleRequest({
      method: 'POST',
      path: '/process', // Standardized path without /agent prefix
      body: input,
    })

    const subResponse = await subAgent.handleRequest(input)

    expect(microResponse.body.output).toEqual(subResponse.output)
  })

  it('returns 404 for legacy /agent/process path', async () => {
    const adapter = new MicroserviceAdapter(agent)
    const response = await adapter.handleRequest({
      method: 'POST',
      path: '/agent/process', // Legacy path should fail
      body: { input: 'test' },
    })

    expect(response.status).toBe(404)
    expect(response.body.error.message).toContain('Use /process instead')
  })
})

// ADR-013: Atomic operations test
describe('Cross-Repo Distribution (ADR-013)', () => {
  it('creates backup before modifying settings.json', async () => {
    const installer = new AtomicInstaller()
    await installer.install({ agents: ['context7'] })

    expect(fs.existsSync('.claude/settings.json.backup')).toBe(true)
  })

  it('rolls back on installation failure', async () => {
    const installer = new AtomicInstaller()
    const originalSettings = fs.readFileSync('.claude/settings.json', 'utf-8')

    // Simulate failure during installation
    vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('Disk full'))

    await expect(installer.install({})).rejects.toThrow()

    const restoredSettings = fs.readFileSync('.claude/settings.json', 'utf-8')
    expect(restoredSettings).toBe(originalSettings)
  })
})

// ADR-016: Dashboard technology stack test - Post-MVP
describe.skipIf(!process.env.ENABLE_POST_MVP)(
  'Dashboard Technology (ADR-016)',
  () => {
    it('uses Next.js 15 App Router', async () => {
      // Use dynamic import for ES modules
      const { readFile } = await import('fs/promises')
      const packageJsonContent = await readFile(
        '@orchestr8/dashboard/package.json',
        'utf-8',
      )
      const packageJson = JSON.parse(packageJsonContent)
      expect(packageJson.dependencies.next).toMatch(/^15\./)
      expect(fs.existsSync('packages/dashboard/app')).toBe(true)
    })

    it('integrates React 19 with server components', async () => {
      const Component = await import('@orchestr8/dashboard/app/page')
      expect(Component.default).toBeDefined()
      expect(Component.default.$$typeof).toBeDefined() // Server component marker
    })
  },
)

// ADR-017: Port 8088 selection test
describe('Port 8088 Binding (ADR-017)', () => {
  it('dashboard binds to port 8088', async () => {
    const server = await startDashboard()
    const address = server.address()

    expect(address.port).toBe(8088)
    expect(address.address).toBe('127.0.0.1')
  })

  it('shows meaningful error if port is occupied', async () => {
    // Occupy port 8088
    const blocker = net.createServer()
    await new Promise((resolve) => blocker.listen(8088, resolve))

    await expect(startDashboard()).rejects.toThrow(
      'Port 8088 is already in use. Please free the port for @orchestr8 dashboard.',
    )

    blocker.close()
  })
})

// ADR-018: Execution semantics test
describe('Execution Semantics (ADR-018)', () => {
  it('respects semaphore limits for parallel execution', async () => {
    const orchestrator = new Orchestrator({ maxConcurrency: 2 })
    const runningCount = vi.fn()

    const agents = Array(5)
      .fill(null)
      .map((_, i) =>
        createMockAgent(`agent-${i}`, async () => {
          runningCount(orchestrator.getRunningCount())
          await delay(100)
        }),
      )

    await orchestrator.parallel(agents)

    // Should never exceed maxConcurrency
    expect(Math.max(...runningCount.mock.calls.flat())).toBeLessThanOrEqual(2)
  })

  it('propagates AbortSignal through execution chain', async () => {
    const controller = new AbortController()
    const cleanupCalled = vi.fn()

    const agent = createMockAgent('test', async (input, context) => {
      context.signal.addEventListener('abort', cleanupCalled)
      await delay(1000)
    })

    const promise = orchestrator.execute(
      agent,
      {},
      { signal: controller.signal },
    )

    // Abort after 50ms
    setTimeout(() => controller.abort(), 50)

    await expect(promise).rejects.toThrow('Aborted')
    expect(cleanupCalled).toHaveBeenCalled()
  })
})

// ADR-019: Operational contracts test
describe('Operational Contracts (ADR-019)', () => {
  it('validates idempotency key TTL expiration', async () => {
    const api = new RestAPI({ idempotencyTTL: 100 }) // 100ms TTL
    const key = 'test-key-123'

    // First request
    const response1 = await api.handleRequest({
      method: 'POST',
      headers: { 'idempotency-key': key },
      body: { action: 'process' },
    })

    // Immediate duplicate - should return cached
    const response2 = await api.handleRequest({
      method: 'POST',
      headers: { 'idempotency-key': key },
      body: { action: 'process' },
    })

    expect(response2.headers['x-idempotent-cached']).toBe('true')
    expect(response2.body).toEqual(response1.body)

    // Wait for TTL expiration
    await delay(150)

    // After TTL - should execute new
    const response3 = await api.handleRequest({
      method: 'POST',
      headers: { 'idempotency-key': key },
      body: { action: 'process' },
    })

    expect(response3.headers['x-idempotent-cached']).toBeUndefined()
  })

  it('validates ETag conditional requests', async () => {
    const api = new RestAPI()

    // Get resource with ETag
    const response1 = await api.handleRequest({
      method: 'GET',
      path: '/workflows/test-workflow',
    })

    const etag = response1.headers['etag']
    expect(etag).toBeDefined()

    // Conditional request with matching ETag
    const response2 = await api.handleRequest({
      method: 'GET',
      path: '/workflows/test-workflow',
      headers: { 'if-none-match': etag },
    })

    expect(response2.status).toBe(304) // Not Modified
    expect(response2.body).toBeUndefined()
  })
})
```

## Unit Tests

### Orchestrator Tests

**Orchestrator Class**

- Should register agents with unique IDs
- Should reject duplicate agent registrations
- Should execute single agent successfully
- Should handle agent execution failures gracefully
- Should respect timeout configurations
- Should emit proper events during execution
- Should maintain execution history

**Parallel Execution**

- Should execute multiple agents concurrently
- Should collect all results when all succeed
- Should handle partial failures in parallel execution
- Should respect maxConcurrency limits
- Should measure parallel execution performance

**Sequential Execution**

- Should execute agents in order
- Should stop on first failure if configured
- Should pass outputs between sequential agents
- Should maintain execution order in results

### Resilience Pattern Tests

**RetryPolicy Tests**

- Should retry failed operations up to maxAttempts
- Should use exponential backoff when configured
- Should use linear backoff when configured
- Should apply jitter to prevent thundering herd
- Should respect maxDelay limits
- Should only retry on retryable errors
- Should emit retry events

**CircuitBreaker Tests**

- Should open after threshold failures
- Should reject calls when open
- Should transition to half-open after timeout
- Should close after successful half-open attempts
- Should track failure rate over time window
- Should emit state change events
- Should reset statistics on manual reset

**TimeoutPolicy Tests**

- Should timeout long-running operations
- Should preserve error context on timeout
- Should clean up resources on timeout
- Should allow custom timeout per operation

### Agent Framework Tests

**BaseAgent Tests**

- Should validate manifest on construction
- Should validate inputs before execution
- Should transform outputs after execution
- Should emit telemetry during execution
- Should handle execution errors gracefully
- Should respect agent-specific configuration

**AgentTestHarness Tests**

- Should run contract tests automatically
- Should validate agent ID format
- Should validate version format
- Should test empty context handling
- Should generate test reports

### JSON Prompt Configuration Tests

**Parser Tests**

- Should parse valid JSON prompt configurations
- Should validate against Zod schema
- Should extract metadata correctly
- Should parse nested orchestration steps
- Should handle malformed JSON gracefully
- Should support variable interpolation
- Should validate constraint definitions
- Should enforce MVP constraints (max retries: 3, timeout: 30s)

## Integration Tests

### End-to-End Workflow Tests

**Simple Workflow**

- Should execute linear workflow successfully
- Should handle workflow with conditionals
- Should manage workflow state correctly
- Should persist workflow execution history

**Complex Orchestration**

- Should handle nested parallel and sequential flows
- Should manage data flow between agents
- Should handle partial failures in complex workflows
- Should optimize execution paths
- Should generate accurate execution traces

**Error Recovery**

- Should recover from transient failures
- Should handle circuit breaker trips
- Should fallback to alternative agents
- Should maintain consistency during recovery
- Should log all recovery attempts

### Cross-Package Integration

**Core + Resilience Integration**

- Should apply resilience policies during orchestration
- Should cascade circuit breaker states
- Should coordinate retry attempts
- Should respect global timeout limits

**Agent + Testing Integration**

- Should use test harness for agent validation
- Should generate coverage reports for agents
- Should mock external dependencies properly

**CLI + Core Integration**

- Should execute CLI-defined workflows
- Should validate workflows before execution
- Should provide execution feedback via journal

### API Integration Tests

**REST API Tests (MVP Scope Only)**

- Should handle concurrent API requests
- Should validate request payloads
- Should return proper HTTP status codes
- Should bind to 127.0.0.1 only (local-only security per ADR-007)
- Should reject non-localhost Host headers

<!-- Post-MVP: Authentication/authorization (explicitly out of scope per ADR-007) -->
<!-- Post-MVP: Rate limiting (deferred to Phase 2) -->
<!-- Tests for these features are gated behind ENABLE_POST_MVP=1 environment flag -->

## Feature Tests

### MVP Feature Tests Only

### CLI Tool Tests

**Agent Creation**

- Should create agent from template
- Should validate agent name
- Should setup testing environment
- Should generate proper package.json

**Agent Testing**

- Should run agent tests
- Should generate coverage reports
- Should support watch mode
- Should integrate with CI/CD

## Mocking Requirements

### External Service Mocks

**AI Provider Mocks**

- Mock OpenAI API responses for changelog generation
- Mock Anthropic API for alternative provider
- Support offline development mode

**NPM Registry Mocks**

- Mock package publishing for testing
- Mock version checking
- Mock download statistics

**GitHub API Mocks**

- Mock PR creation for version updates
- Mock issue creation for feedback
- Mock GitHub Actions triggers

### Internal Service Mocks

**Logger Mock**

- Capture log outputs for testing
- Verify log levels and messages
- Support structured log validation

**Telemetry Mock**

- Capture spans and traces
- Verify metric emissions
- Support correlation ID tracking

**Event Bus Mock**

- Capture emitted events
- Verify event ordering
- Support event replay for testing

## Performance Tests

### Benchmarks

**Orchestration Performance**

- Measure overhead per operation
- Benchmark parallel execution scaling
- Test memory usage under load
- Measure startup time

**Resilience Pattern Performance**

- Retry overhead measurement
- Circuit breaker state transition timing
- Timeout accuracy testing

### Stress Tests

**Concurrent Agent Execution**

- Test with 100+ concurrent agents
- Measure resource consumption
- Identify bottlenecks
- Test graceful degradation

**Memory Leak Tests**

- Long-running workflow execution
- Agent creation/destruction cycles
- Event listener management
- State storage growth

### Load Tests

**API Load Testing (Post-MVP)**

<!-- Deferred to Phase 2 - not required for MVP -->
<!-- When enabled with ENABLE_POST_MVP=1: -->

- Test API with high request rates
- Measure response times under load
- Test rate limiting effectiveness
- Validate error rates

### Additional Critical Test Categories

**Scheduler Dependency Tests**

- Verify task dependencies are checked against `completedTasks` set, not `runningTasks`
- Test that dependent tasks wait for all dependencies to complete
- Validate dependency resolution with circular dependency detection
- Test partial completion scenarios where some dependencies fail

**Idempotency TTL Tests**

- Test REST API idempotency key expiration after configured TTL
- Verify duplicate requests within TTL window return cached response
- Test that expired keys allow new execution
- Validate idempotency key storage and cleanup

**ETag Validation Tests**

- Test If-None-Match header returns 304 Not Modified for unchanged resources
- Validate ETag generation for workflow definitions
- Test conditional PUT/POST with If-Match headers
- Verify ETag updates when resource content changes

**WebSocket Performance Metrics Tests (Post-MVP)**

<!-- Dashboard and WebSocket features deferred to Phase 3 -->
<!-- When enabled with ENABLE_POST_MVP=1: -->

- Test real-time dashboard metric updates via WebSocket
- Measure WebSocket message latency and throughput
- Test connection recovery and reconnection logic
- Validate metric aggregation and buffering under load

**Exponential Backoff with Jitter Tests**

- Verify exponential backoff calculation (2^attempt \* baseDelay)
- Test jitter adds randomization to prevent thundering herd
- Validate maximum delay caps are respected
- Test backoff reset after successful execution

**AbortSignal Propagation Tests**

- Test cancellation propagates through entire agent execution chain
- Verify cleanup handlers are called on abort
- Test partial execution rollback on cancellation
- Validate AbortSignal works with parallel and sequential flows

## Timer Management and Deterministic Testing

### Deterministic Timer Management

Tests must properly manage timers to avoid flakiness and memory leaks:

```typescript
// Timer abstraction for testability
interface Scheduler {
  setTimeout(fn: () => void, ms: number): TimerId
  clearTimeout(id: TimerId): void
  setInterval(fn: () => void, ms: number): TimerId
  clearInterval(id: TimerId): void
}

// Test harness with proper cleanup
describe('TTL and Idempotency', () => {
  let scheduler: TestScheduler
  let timers: Set<TimerId>

  beforeEach(() => {
    vi.useFakeTimers()
    scheduler = new TestScheduler()
    timers = new Set()
  })

  afterEach(() => {
    // Critical: Clear ALL timers
    timers.forEach((id) => scheduler.clear(id))
    timers.clear()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('cleans up TTL entries after expiration', async () => {
    const cache = new IdempotencyCache(scheduler)
    cache.set('key', 'value', { ttl: 5000 })

    expect(cache.has('key')).toBe(true)

    // Advance time and flush microtasks
    await vi.advanceTimersByTimeAsync(5001)
    await flushMicrotasks()

    expect(cache.has('key')).toBe(false)
  })
})

// Helper to flush all pending promises
async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve))
}
```

### Seedable RNG for Deterministic Jitter

```typescript
// Seedable RNG for deterministic testing
import { createRNG } from '@orchestr8/testing'

class ExponentialBackoff {
  constructor(private rng: RNG = Math.random) {}

  calculateDelay(attempt: number): number {
    const base = Math.pow(2, attempt) * 100
    const jitter = this.rng() * 100 // Deterministic in tests
    return base + jitter
  }
}

describe('Exponential Backoff', () => {
  it('produces deterministic sequence with seeded RNG', () => {
    const rng = createRNG(12345) // Fixed seed
    const backoff = new ExponentialBackoff(rng)

    // Deterministic assertions
    expect(backoff.calculateDelay(0)).toBe(149.32) // Exact value with seed
    expect(backoff.calculateDelay(1)).toBe(267.89)
    expect(backoff.calculateDelay(2)).toBe(443.21)
  })

  it('distributes jitter uniformly (smoke test only)', () => {
    // This test runs locally only, not in CI
    if (process.env.CI) {
      return // Skip in CI to avoid flakiness
    }

    const samples = Array.from({ length: 1000 }, () =>
      new ExponentialBackoff().calculateDelay(1),
    )

    // Statistical check for uniform distribution
    const histogram = createHistogram(samples, 10)
    const chiSquare = calculateChiSquare(histogram)
    expect(chiSquare).toBeLessThan(16.92) // 95% confidence
  })
})
```

### Async Timer Coordination

```typescript
describe('Cancellation with Fake Timers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cancels in-flight operations correctly', async () => {
    const operation = vi.fn(async () => {
      await sleep(1000)
      return 'completed'
    })

    const controller = new AbortController()
    const promise = runWithTimeout(operation, {
      timeout: 2000,
      signal: controller.signal,
    })

    // Advance halfway
    await vi.advanceTimersByTimeAsync(500)
    await flushMicrotasks() // Critical: flush before next action

    // Cancel operation
    controller.abort()
    await flushMicrotasks() // Ensure abort propagates

    // Verify cancellation
    await expect(promise).rejects.toThrow(AbortError)
    expect(operation).toHaveBeenCalledTimes(1)

    // Advance to would-be completion
    await vi.advanceTimersByTimeAsync(1500)
    await flushMicrotasks()

    // Operation should not complete
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
```

## High-Value Test Improvements

### Circuit Breaker Scoping

```typescript
describe('Circuit Breaker Scoping', () => {
  it('maintains independent state per key', async () => {
    const cb = new CircuitBreaker()

    // Fail agent1 on host1
    await expectFail(() => cb.execute('agent1:host1', failingOp))
    await expectFail(() => cb.execute('agent1:host1', failingOp))

    expect(cb.getState('agent1:host1')).toBe('OPEN')
    expect(cb.getState('agent2:host1')).toBe('CLOSED') // Different agent
    expect(cb.getState('agent1:host2')).toBe('CLOSED') // Different host
  })

  it('shares state for identical keys', async () => {
    const cb = new CircuitBreaker()
    const key = 'agent1:host1'

    // Multiple calls with same key share state
    await expectFail(() => cb.execute(key, failingOp))
    await expectFail(() => cb.execute(key, failingOp))

    // Both see the same OPEN state
    await expect(cb.execute(key, successOp)).rejects.toThrow(CircuitOpenError)
  })
})
```

### Timeout Semantics

```typescript
describe('Timeout Composition', () => {
  it('applies timeout per-attempt, not globally', async () => {
    const slowOp = async () => {
      await sleep(1500)
      return 'done'
    }

    const retriedOp = withRetry(withTimeout(slowOp, 1000), {
      maxAttempts: 3,
      delay: 100,
    })

    const start = Date.now()
    await expect(retriedOp()).rejects.toThrow(TimeoutError)
    const duration = Date.now() - start

    // 3 attempts * 1s timeout + 2 delays * 100ms = ~3200ms
    expect(duration).toBeGreaterThan(3000)
    expect(duration).toBeLessThan(3500)
  })

  it('includes attempt metadata in timeout errors', async () => {
    try {
      await retriedTimeoutOp()
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError)
      expect(error.attempt).toBe(3)
      expect(error.elapsed).toBeGreaterThan(1000)
      expect(error.limit).toBe(1000)
    }
  })
})
```

### Event Bus Ordering

```typescript
describe('Event Bus Overflow', () => {
  it('preserves order when dropping oldest', async () => {
    const bus = new EventBus({ maxSize: 3, overflow: 'dropOldest' })

    bus.emit('event1')
    bus.emit('event2')
    bus.emit('event3')
    bus.emit('event4') // Drops event1
    bus.emit('event5') // Drops event2

    const events = await bus.drain()
    expect(events).toEqual(['event3', 'event4', 'event5'])
    expect(bus.getStats().droppedCount).toBe(2)
  })
})
```

### API Contract Tests

```typescript
describe('Async Execution API', () => {
  it('returns 202 Accepted with Location header', async () => {
    const response = await request(app)
      .post('/workflows/execute')
      .send({ workflow: validWorkflow })

    expect(response.status).toBe(202)
    expect(response.headers.location).toMatch(/^\/executions\/[a-f0-9-]{36}$/)
    expect(response.body).toEqual({
      executionId: expect.stringMatching(/^[a-f0-9-]{36}$/),
      status: 'ACCEPTED',
      links: {
        self: expect.stringMatching(/^\/executions\//),
        journal: expect.stringMatching(/\/journal$/),
        cancel: expect.stringMatching(/\/cancel$/),
      },
    })
  })

  it('returns 409 for idempotency key collision', async () => {
    const idempotencyKey = 'test-key-123'

    // First request
    await request(app)
      .post('/workflows/execute')
      .set('Idempotency-Key', idempotencyKey)
      .send({ workflow: validWorkflow })
      .expect(202)

    // Duplicate request
    const response = await request(app)
      .post('/workflows/execute')
      .set('Idempotency-Key', idempotencyKey)
      .send({ workflow: validWorkflow })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('IDEMPOTENCY_CONFLICT')
  })

  it('supports If-Match for conditional updates', async () => {
    const { etag } = await createExecution()

    // Update with wrong ETag
    const response = await request(app)
      .put('/executions/123')
      .set('If-Match', '"wrong-etag"')
      .send({ status: 'CANCELLED' })

    expect(response.status).toBe(412)
    expect(response.body.error.code).toBe('PRECONDITION_FAILED')
  })
})
```

### Journal PII Protection

```typescript
describe('Journal PII Protection', () => {
  it('redacts sensitive fields in journal', () => {
    const journal = captureJournal({
      apiKey: 'sk-secret123',
      password: 'mypassword',
      data: 'public info',
    })

    expect(journal).toEqual({
      apiKey: '[REDACTED]',
      password: '[REDACTED]',
      data: 'public info',
    })
  })

  it('truncates large fields', () => {
    const largeData = 'x'.repeat(10000)
    const journal = captureJournal({ data: largeData })

    expect(journal.data).toBe('x'.repeat(1000) + '[truncated]')
  })
})
```

## Test Configuration Updates

### Fast-Check Time Budgets

```typescript
// vitest.config.ts - Property test configuration
export default defineConfig({
  test: {
    // Time-based limits for property tests
    testTimeout: 10000, // 10s max per test

    // Environment-specific configuration
    env: {
      FAST_CHECK_NUM_RUNS: process.env.CI ? '50' : '200',
      FAST_CHECK_TIMEOUT: process.env.CI ? '5000' : '10000',
    },
  },
})
```

### MSW v2 Configuration

```typescript
// @orchestr8/testing/src/msw-setup.ts
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

export const server = setupServer(
  // Default handlers for common services
  http.post('https://api.openai.com/*', () => {
    return HttpResponse.json({
      choices: [{ message: { content: 'Mocked response' } }],
    })
  }),

  // Fail on unhandled in CI
  http.all('*', ({ request }) => {
    if (process.env.CI) {
      throw new Error(`Unhandled request: ${request.method} ${request.url}`)
    }
    console.warn(`Unhandled request: ${request.method} ${request.url}`)
    return HttpResponse.json({ error: 'Not mocked' }, { status: 500 })
  }),
)

// Test setup
beforeAll(() =>
  server.listen({
    onUnhandledRequest: process.env.CI ? 'error' : 'warn',
  }),
)
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### ADR Traceability Test

```typescript
// scripts/validate-adrs.ts
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

describe('ADR Traceability', () => {
  it('all referenced ADRs exist', async () => {
    const testFiles = await glob('**/*.test.ts')
    const adrReferences = new Set<string>()

    // Extract ADR references from tests
    for (const file of testFiles) {
      const content = await readFile(file, 'utf-8')
      const matches = content.matchAll(/ADR-(\d{3})/g)
      for (const [, num] of matches) {
        adrReferences.add(`ADR-${num}`)
      }
    }

    // Verify ADR documents exist
    const adrDir = 'docs/adrs'
    const adrFiles = await readdir(adrDir)

    for (const ref of adrReferences) {
      const exists = adrFiles.some((f) => f.includes(ref))
      expect(exists).toBe(true)
    }
  })

  it('generates traceability report', async () => {
    const report = await generateTraceabilityReport()
    await writeFile(
      'test-results/adr-traceability.json',
      JSON.stringify(report, null, 2),
    )

    expect(report.coverage).toBeGreaterThan(0.9) // 90% ADRs have tests
  })
})
```

## Test Utilities

### Agent Test Harness

```typescript
import { describe, it, expect } from 'vitest'
import { AgentTestHarness } from '@orchestr8/testing'

// Vitest syntax for agent testing
describe('Agent Tests', () => {
  const harness = new AgentTestHarness()

  it('processes valid input', async () => {
    const result = await harness.testAgent(agent, {
      input: { data: 'test' },
      context: mockContext,
    })
    expect(result).toEqual({ status: 'success' })
  })

  it('handles missing data', async () => {
    const result = await harness.testAgent(agent, {
      input: {},
      context: mockContext,
    })
    expect(result).toEqual({
      status: 'failure',
      error: 'Missing required data',
    })
  })
})
```

### Workflow Test Builder

```typescript
import { describe, it, expect } from 'vitest'
import { WorkflowTestBuilder } from '@orchestr8/testing'

describe('Workflow Tests', () => {
  it('executes workflow with parallel agents', async () => {
    const testWorkflow = WorkflowTestBuilder.create('test-workflow')
      .addAgent('validator', mockValidator)
      .addAgent('processor', mockProcessor)
      .parallel(['analyzer', 'formatter'])
      .expectOutput({ processed: true })
      .build()

    const result = await testWorkflow.run()
    expect(result.status).toBe('completed')
    expect(result.output).toEqual({ processed: true })
  })
})
```

### Assertion Helpers

```typescript
import { expect } from 'vitest'
import { orchestrationMatchers } from '@orchestr8/testing'

// Extend Vitest with custom matchers
expect.extend(orchestrationMatchers)

// Custom assertions for orchestration
await expect(execution).toCompleteWithin(5000)
expect(execution).toHaveRetryCount(2)
expect(circuitBreaker).toBeInState('OPEN')
expect(workflow).toExecuteAgentsInOrder(['a', 'b', 'c'])
```

## Testing Standards

### Test Naming (Vitest)

```typescript
import { describe, it } from 'vitest'

// Good test names - descriptive without "test"
describe('Orchestrator', () => {
  it('executes single agent successfully', async () => {
    // test implementation
  })

  it('handles agent timeout gracefully', async () => {
    // test implementation
  })

  it('retries failed operations with exponential backoff', async () => {
    // test implementation
  })
})

// Bad - avoid word "test" in names
it('test orchestrator execution', () => {}) // ❌
```

### Assertion Standards (Vitest)

```typescript
import { expect } from 'vitest'

// Strict assertions preferred
expect(result).toEqual({ status: 'success', data: 'value' }) // ✅
expect(result.status).toBe('success') // ✅
expect(result).toContain('success') // ❌ Too loose

// Deep equality for objects
expect(config).toStrictEqual(expectedConfig) // ✅

// Async assertions
await expect(promise).resolves.toBe('value') // ✅
await expect(asyncFn()).rejects.toThrow('error') // ✅
```

### Mock Usage (Vitest)

```typescript
import { vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock external dependencies only
vi.mock('openai') // ✅ External service

// Don't mock our own code
vi.mock('@orchestr8/core') // ❌ Our package

// Use MSW for API mocking
const server = setupServer(
  http.get('/api/data', () => {
    return HttpResponse.json({ data: 'test' })
  }),
)

// Use test doubles for internal dependencies
const testAgent = new TestAgent() // ✅ Test implementation
```

### MSW Setup and Configuration

```typescript
// packages/testing/src/setup/msw.ts - Centralized MSW configuration
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { openAIHandlers } from './handlers/openai'
import { anthropicHandlers } from './handlers/anthropic'
import { githubHandlers } from './handlers/github'

// Centralized MSW server with proper handler organization
export const server = setupServer(
  ...openAIHandlers,
  ...anthropicHandlers,
  ...githubHandlers,
)

// NOTE: Do NOT call server.listen() here - it should be called in setup helpers only

// packages/testing/src/handlers/openai.ts - OpenAI canned fixtures
export const openAIHandlers = [
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 1677652288,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Mocked OpenAI response for testing',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    })
  }),
]

// packages/testing/src/handlers/anthropic.ts - Anthropic canned fixtures
export const anthropicHandlers = [
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Mocked Anthropic response for testing',
        },
      ],
      model: 'claude-3-opus-20240229',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
      },
    })
  }),
]

// packages/testing/src/handlers/github.ts - GitHub canned fixtures
export const githubHandlers = [
  http.get('https://api.github.com/repos/:owner/:repo/releases', () => {
    return HttpResponse.json([
      {
        id: 1,
        tag_name: 'v1.0.0',
        name: 'Release v1.0.0',
        body: 'Initial release',
        draft: false,
        prerelease: false,
        created_at: '2025-01-17T00:00:00Z',
        published_at: '2025-01-17T00:00:00Z',
      },
    ])
  }),

  http.post('https://api.github.com/repos/:owner/:repo/pulls', () => {
    return HttpResponse.json({
      id: 1,
      number: 42,
      state: 'open',
      title: 'Test PR',
      body: 'Test PR body',
      html_url: 'https://github.com/owner/repo/pull/42',
    })
  }),
]

// Test setup helpers with proper error handling
// IMPORTANT: This is the ONLY place where server.listen() should be called
export function setupMSW() {
  beforeAll(() => {
    // In CI, fail on unhandled requests. In dev, just warn.
    server.listen({
      onUnhandledRequest: process.env.CI ? 'error' : 'warn',
    })
  })

  afterEach(() => {
    server.resetHandlers()
  })

  afterAll(() => {
    server.close()
  })
}
```

### Error Taxonomy Tests

```typescript
// packages/core/src/errors/error-taxonomy.test.ts
import { describe, it, expect } from 'vitest'
import {
  mapErrorToTaxonomy,
  ErrorCategory,
  ErrorSeverity,
} from './error-taxonomy'

describe('Error Taxonomy', () => {
  describe('Error Shape Validation', () => {
    it('validates error JSON structure', () => {
      const error = mapErrorToTaxonomy(new Error('Test error'))

      // Golden test for error shape
      expect(error).toMatchObject({
        code: expect.stringMatching(/^[A-Z]{3}-\d{3}$/),
        category: expect.stringMatching(
          /^(EXECUTION|RESOURCE|VALIDATION|SYSTEM)$/,
        ),
        severity: expect.stringMatching(/^(LOW|MEDIUM|HIGH|CRITICAL)$/),
        retryable: expect.any(Boolean),
        userActionRequired: expect.any(Boolean),
        message: expect.any(String),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })

      // Ensure no PII in error
      expect(JSON.stringify(error)).not.toMatch(/password|token|key|secret/i)
    })
  })

  describe('Error Mapping', () => {
    const errorMappings = [
      {
        input: new TimeoutError('Operation timed out'),
        expected: {
          code: 'EXE-001',
          category: 'EXECUTION',
          severity: 'MEDIUM',
          retryable: true,
        },
      },
      {
        input: new CircuitBreakerOpenError('Circuit breaker is open'),
        expected: {
          code: 'RES-001',
          category: 'RESOURCE',
          severity: 'HIGH',
          retryable: false,
        },
      },
      {
        input: new ValidationError('Invalid input'),
        expected: {
          code: 'VAL-001',
          category: 'VALIDATION',
          severity: 'LOW',
          retryable: false,
          userActionRequired: true,
        },
      },
    ]

    it.each(errorMappings)(
      'maps $input.constructor.name correctly',
      ({ input, expected }) => {
        const mapped = mapErrorToTaxonomy(input)
        expect(mapped).toMatchObject(expected)
      },
    )
  })

  describe('PII Sanitization', () => {
    it('removes sensitive data from error messages', () => {
      const sensitiveError = new Error(
        'Failed to authenticate with password=secret123',
      )
      const mapped = mapErrorToTaxonomy(sensitiveError)

      expect(mapped.message).toBe('Failed to authenticate with password=***')
      expect(mapped.details).not.toContain('secret123')
    })
  })
})
```

### Test Determinism Utilities

```typescript
// packages/testing/src/determinism.ts
import { vi } from 'vitest'

// Deterministic time control
export function useFakeTimers(initialTime = new Date('2025-01-17T00:00:00Z')) {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(initialTime)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  return {
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    runAllTimers: () => vi.runAllTimers(),
    runOnlyPendingTimers: () => vi.runOnlyPendingTimers(),
  }
}

// Deterministic random number generation
export function useDeterministicRandom(seed = 42) {
  let originalRandom: typeof Math.random

  beforeEach(() => {
    originalRandom = Math.random
    let x = seed
    Math.random = () => {
      x = Math.sin(x) * 10000
      return x - Math.floor(x)
    }
  })

  afterEach(() => {
    Math.random = originalRandom
  })
}

// Environment consistency validation
export function validateTestEnvironment() {
  const required = {
    NODE_ENV: 'test',
    TZ: 'UTC',
    LANG: 'en_US.UTF-8',
  }

  for (const [key, value] of Object.entries(required)) {
    if (process.env[key] !== value) {
      throw new Error(
        `Invalid test environment: ${key}=${process.env[key]}, expected ${value}`,
      )
    }
  }
}

// Flakiness prevention patterns
export const testStabilizers = {
  // Wait for async operations with timeout
  waitFor: async (condition: () => boolean, timeout = 5000) => {
    const start = Date.now()
    while (!condition() && Date.now() - start < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (!condition()) {
      throw new Error('Timeout waiting for condition')
    }
  },

  // Retry flaky operations
  retryUntilStable: async <T>(
    fn: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T> => {
    let lastError: Error | undefined
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)))
        }
      }
    }
    throw lastError
  },
}
```

## Continuous Integration

### Test Pipeline with Project Separation

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_ENV: test
  CI: true
  VITEST_MAX_THREADS: 8 # Cap threads for stability

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [20, 22] # Node 20+ required for AbortSignal.any and AbortSignal.timeout
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests
        run: pnpm test:unit --coverage
        env:
          VITEST_MAX_THREADS: 8

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: unit-coverage-${{ matrix.node }}
          path: test-results/coverage/unit/

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run integration tests (serial)
        run: pnpm test:integration --coverage
        env:
          MSW_UNHANDLED_REQUEST: error # Fail on unhandled requests

      - name: Upload test results
        uses: actions/upload-artifact@v4
        with:
          name: integration-results
          path: |
            test-results/junit.xml
            test-results/coverage/integration/

  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run performance tests (isolated)
        run: pnpm test:perf
        env:
          RUN_PERF_TESTS: true

      - name: Compare with baseline
        run: node scripts/compare-perf-baseline.js

      - name: Upload benchmark results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: test-results/benchmark.json

  coverage-merge:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4

      - name: Download coverage artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: '*-coverage-*'
          path: ./coverage-artifacts

      - name: Upload to Codecov (let Codecov merge)
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage-artifacts/**/coverage-summary.json
          flags: unittests,integration
          fail_ci_if_error: false # Don't fail on upload issues

      # Alternative: Run single coverage pass with Vitest workspace
      # This avoids the need for any merging at all:
      # - name: Run all tests with unified coverage
      #   run: pnpm test --coverage --workspace

  adr-conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ADR conformance tests
        run: pnpm test:adr --coverage

      - name: Enforce package-specific thresholds
        run: node scripts/enforce-coverage.js core test-results/coverage/adr
```

### Coverage Enforcement Script (Updated for v8)

```typescript
// scripts/enforce-coverage.ts - Updated to use v8 coverage-summary.json
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

interface V8CoverageReport {
  total: {
    lines: { pct: number }
    branches: { pct: number }
    functions: { pct: number }
    statements: { pct: number }
  }
}

const THRESHOLDS = {
  core: { lines: 80, branches: 80, functions: 80, statements: 80 },
  supporting: { lines: 60, branches: 60, functions: 60, statements: 60 },
  examples: { lines: 50, branches: 50, functions: 50, statements: 50 },
}

function enforceCoverage(
  packageType: keyof typeof THRESHOLDS,
  reportPath: string,
) {
  // Use v8 provider's coverage-summary.json output
  const summaryPath = resolve(reportPath, 'coverage-summary.json')

  if (!existsSync(summaryPath)) {
    console.error(`❌ Coverage report not found: ${summaryPath}`)
    console.error(
      'Ensure Vitest is using v8 provider and generating coverage-summary.json',
    )
    process.exit(1)
  }

  const report: V8CoverageReport = JSON.parse(
    readFileSync(summaryPath, 'utf-8'),
  )
  const thresholds = THRESHOLDS[packageType]
  const { total } = report

  const checks = [
    { name: 'lines', actual: total.lines.pct, required: thresholds.lines },
    {
      name: 'branches',
      actual: total.branches.pct,
      required: thresholds.branches,
    },
    {
      name: 'functions',
      actual: total.functions.pct,
      required: thresholds.functions,
    },
    {
      name: 'statements',
      actual: total.statements.pct,
      required: thresholds.statements,
    },
  ]

  const failures = checks.filter((check) => check.actual < check.required)

  if (failures.length > 0) {
    // Fail fast with readable output
    console.error(`\n❌ Coverage below threshold for ${packageType} package:\n`)
    failures.forEach(({ name, actual, required }) => {
      const diff = (required - actual).toFixed(2)
      console.error(
        `   ${name}: ${actual.toFixed(2)}% < ${required}% required (−${diff}%)`,
      )
    })
    console.error(
      `\nIncrease test coverage or adjust thresholds in ADR-009 if justified.\n`,
    )
    process.exit(1)
  }

  console.log(`✅ Coverage requirements met for ${packageType} package`)
  checks.forEach(({ name, actual, required }) => {
    const surplus = (actual - required).toFixed(2)
    console.log(
      `   ${name}: ${actual.toFixed(2)}% ≥ ${required}% required (+${surplus}%)`,
    )
  })
}

// Main execution
const packageType = process.argv[2] as 'core' | 'supporting' | 'examples'
const reportPath = process.argv[3] || './test-results/coverage'

if (!packageType) {
  console.error(
    'Usage: node enforce-coverage.js <core|supporting|examples> [report-path]',
  )
  process.exit(1)
}

enforceCoverage(packageType, reportPath)
```

### Test Environments

- **Local**: Wallaby.js for continuous testing with instant feedback
- **CI**: GitHub Actions with separated test jobs (unit parallel, integration serial)
- **Staging**: Full integration test suite with real services
- **Production**: Smoke tests only with health checks

### Security and Localhost Testing

```typescript
// packages/api/src/security/localhost.test.ts
import { describe, it, expect } from 'vitest'
import { createServer } from 'http'
import net from 'net'

describe('Security: Localhost-only binding', () => {
  it('binds to 127.0.0.1 exclusively', async () => {
    const server = createServer()
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

    const address = server.address() as net.AddressInfo
    expect(address.address).toBe('127.0.0.1')

    // Verify cannot connect from external IP
    const client = new net.Socket()
    await expect(
      new Promise((resolve, reject) => {
        client.connect(address.port, '0.0.0.0', () => {
          reject(new Error('Should not connect from 0.0.0.0'))
        })
        client.on('error', resolve)
      }),
    ).resolves.toMatchObject({ code: 'ECONNREFUSED' })

    server.close()
  })

  it('rejects non-localhost Host headers', async () => {
    const api = new RestAPI({ security: { localOnly: true } })

    const response = await api.handleRequest({
      method: 'GET',
      path: '/health',
      headers: { host: 'malicious.site:8088' },
    })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })
})
```

### Flake Reduction Patterns

```typescript
// packages/testing/src/utils/stability.ts
import { vi } from 'vitest'

// Replace polling with deterministic waiting
export async function waitFor<T>(
  condition: () => T | Promise<T>,
  options = { timeout: 5000, interval: 100 },
): Promise<T> {
  const start = Date.now()
  let lastError: Error | undefined

  while (Date.now() - start < options.timeout) {
    try {
      const result = await condition()
      if (result) return result
    } catch (error) {
      lastError = error as Error
    }

    await new Promise((resolve) => setTimeout(resolve, options.interval))
  }

  throw (
    lastError ||
    new Error(`Timeout waiting for condition after ${options.timeout}ms`)
  )
}

// Clear all side effects between tests
export function cleanupGlobalState() {
  // Clear all timers (Vitest handles all timer types)
  vi.clearAllTimers()

  // Clear event listeners
  if (typeof globalThis.eventBus !== 'undefined') {
    globalThis.eventBus.removeAllListeners()
  }

  // Reset mocks
  vi.clearAllMocks()
  vi.resetModules()
}

// Use in test setup
beforeEach(() => {
  cleanupGlobalState()
})
```

## MVP Test Strategy Summary

### Aligned with ADR-009

- **Core packages**: 80% coverage target (not 90% as originally specified)
- **Supporting packages**: 60-70% coverage
- **Example packages**: 50% coverage
- **Focus**: Reliability over exhaustive coverage in 4-week timeline

### MVP Scope

- **Included**: Unit tests, integration tests, basic e2e tests
- **Excluded**: Performance benchmarks beyond basic validation
- **Excluded**: Tests for deferred packages (builder, debugger, advanced runtime)

### Test Framework

- **Vitest**: Primary test runner
- **MSW**: Mock Service Worker for API mocking
- **Zod**: Schema validation for JSON prompts
- **Scoped XML exception**: Workflows/policies remain JSON; allow agent-level XML prompt templates for the single MVP research agent only

### Dual Deployment Tests (MVP-Scoped)

#### Agent Adapters

- Microservice adapter responds to POST /process and GET /health
- Sub‑agent adapter exports handleRequest and returns expected payload
- Equivalent outputs across both modes with identical mocked LLM responses
- Validation errors return 400 (microservice) and structured error (sub‑agent)
