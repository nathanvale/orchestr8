# Lean MVP Specification - @orchestr8 Agent Orchestration System

This document defines the **realistic 4-week MVP scope** for @orchestr8, focusing on delivering core value with minimal complexity.

> Created: 2025-01-17  
> Version: 1.0.0  
> Timeline: 4 weeks  
> Status: MVP Definition

## Executive Summary

The @orchestr8 MVP delivers a **working agent orchestration system** with CLI tooling, basic resilience patterns, and execution observability in 4 weeks. Visual builders, advanced debugging, and multiple API interfaces are deferred to post-MVP phases.

## MVP Architecture (Simplified)

```mermaid
graph TB
    subgraph "External Interfaces - MVP Only"
        CLI[CLI Tool]
        REST[Minimal REST API]
        NPM[NPM Registry]
    end

    subgraph "Core Platform - MVP Packages"
        subgraph "Essential Packages Only"
            Core[@orchestr8/core<br/>Orchestration Engine]
            Resilience[@orchestr8/resilience<br/>Basic Patterns]
            AgentBase[@orchestr8/agent-base<br/>Base Classes]
            Testing[@orchestr8/testing<br/>Test Harness]
            Schema[@orchestr8/schema<br/>Workflow AST]
            CLIPkg[@orchestr8/cli<br/>Developer Tool]
        end
    end

    subgraph "Deferred Post-MVP"
        style Deferred fill:#f9f9f9,stroke:#999,stroke-dasharray: 5 5
        GraphQL[GraphQL API]
        WebSocket[WebSocket]
        Builder[Visual Builder]
        Debugger[Advanced Debugger]
        Registry[Agent Registry]
    end

    CLI --> Core
    REST --> Core
    Core --> Resilience
    Core --> AgentBase
    AgentBase --> Testing
    Core --> Schema
    CLI --> CLIPkg
    CLIPkg --> NPM
```

## 4-Week MVP Timeline

```mermaid
gantt
    title Realistic 4-Week MVP Delivery
    dateFormat YYYY-MM-DD

    section Week 1: Foundation
    Core orchestration engine    :w1core, 2025-01-20, 3d
    Basic resilience patterns    :w1res, 2025-01-20, 3d
    Workflow AST + Schema        :w1ast, 2025-01-22, 2d
    In-process event bus         :w1bus, 2025-01-23, 2d

    section Week 2: Developer Tools
    Agent base classes           :w2base, 2025-01-27, 2d
    Test harness + MSW           :w2test, 2025-01-27, 3d
    CLI scaffold/run/test        :w2cli, 2025-01-29, 3d
    Execution journal            :w2journal, 2025-01-30, 2d

    section Week 3: Integration
    Minimal REST API             :w3rest, 2025-02-03, 2d
    JSON prompt adapters         :w3prompt, 2025-02-03, 2d
    Resilience tuning            :w3tune, 2025-02-05, 2d
    Basic observability          :w3obs, 2025-02-06, 2d

    section Week 4: Production Ready
    Documentation                :w4docs, 2025-02-10, 3d
    Example workflows            :w4ex, 2025-02-10, 2d
    Performance benchmarks       :w4perf, 2025-02-12, 2d
    CI/CD pipeline               :w4ci, 2025-02-13, 2d
```

## Core MVP Components

### 1. Orchestration Engine (Week 1)

```mermaid
graph LR
    subgraph "MVP Orchestration Core"
        OE[Orchestration Engine]
        ES[Execution Strategy]
        SM[State Manager]
        EB[Event Bus<br/>In-Process]
    end

    subgraph "Execution Modes"
        PAR[Parallel]
        SEQ[Sequential]
    end

    subgraph "Basic Resilience"
        RT[Retry]
        TO[Timeout]
        CB[Circuit Breaker]
    end

    OE --> ES
    ES --> SM
    SM --> EB

    ES --> PAR
    ES --> SEQ

    OE --> RT
    RT --> TO
    TO --> CB
```

**Deliverables:**

- Parallel and sequential execution strategies
- Basic retry with exponential backoff
- Timeout management per operation
- Simple circuit breaker (open/closed/half-open)
- In-process event bus with bounded queues

**NOT in MVP:**

- Bulkhead isolation
- Rate limiting
- Adaptive circuit breakers
- Cross-process messaging

### 2. Workflow AST and Schema (Week 1)

```mermaid
graph TB
    subgraph "Workflow AST Structure"
        WF[Workflow]
        WF --> MD[Metadata]
        WF --> ST[Steps]

        ST --> S1[Step 1]
        ST --> S2[Step 2]
        ST --> S3[Step N]

        S1 --> AG[Agent Invocation]
        S1 --> IN[Input Schema]
        S1 --> OUT[Output Schema]
        S1 --> POL[Resilience Policy]

        AG --> AID[Agent ID]
        AG --> VER[Version]
        AG --> CFG[Config]
    end

    subgraph "Codegen"
        AST[JSON AST]
        ZOD[Zod Schema]
        TS[TypeScript Code]

        AST --> ZOD
        ZOD --> TS
        TS --> AST
    end
```

**Deliverables:**

- JSON Schema for Workflow AST
- Zod types for runtime validation
- TypeScript codegen (one-way for MVP)
- Schema versioning (v1.0.0)

**NOT in MVP:**

- YAML/XML formats
- Visual AST editor
- Multi-format round-trip
- Schema migration tools

### 3. Developer CLI (Week 2)

```mermaid
graph LR
    subgraph "CLI Commands - MVP"
        CLI[orchestr8 CLI]

        CLI --> INIT[init<br/>Scaffold project]
        CLI --> CREATE[create<br/>New agent]
        CLI --> RUN[run<br/>Execute workflow]
        CLI --> TEST[test<br/>Run agent tests]
        CLI --> INSPECT[inspect<br/>View execution]
    end

    subgraph "Deferred"
        style Deferred fill:#f9f9f9,stroke:#999,stroke-dasharray: 5 5
        DEBUG[debug]
        REPLAY[replay]
        PUBLISH[publish]
        REGISTRY[registry]
    end
```

**Deliverables:**

- Project scaffolding
- Agent creation from templates
- Workflow execution
- Test runner integration
- Basic execution inspection

**NOT in MVP:**

- Interactive debugging
- State modification
- Registry operations
- Visual tools

### 4. Minimal REST API (Week 3)

```mermaid
graph TB
    subgraph "MVP REST Endpoints Only"
        POST1[POST /workflows/execute]
        GET1[GET /executions/:id]
        GET2[GET /executions/:id/journal]
        POST2[POST /executions/:id/cancel]
    end

    subgraph "Response Format"
        JSON[JSON Only]
        STATUS[HTTP Status Codes]
        ERRORS[Standard Error Format]
    end

    subgraph "Deferred Endpoints"
        style Deferred fill:#f9f9f9,stroke:#999,stroke-dasharray: 5 5
        GraphQL[GraphQL]
        WebSocket[WebSocket]
        SSE[Server-Sent Events]
    end

    POST1 --> JSON
    GET1 --> JSON
    GET2 --> JSON
    POST2 --> STATUS
```

**Deliverables:**

- Execute workflow endpoint
- Get execution status
- Retrieve execution journal
- Cancel execution
- Standard error responses

**NOT in MVP:**

- GraphQL interface
- WebSocket subscriptions
- Server-sent events
- Batch operations

## Resilience Pattern Composition (MVP)

```mermaid
graph LR
    subgraph "MVP Resilience Order"
        REQ[Request] --> TO[Timeout<br/>30s default]
        TO --> CB[Circuit Breaker<br/>5 failures]
        CB --> RT[Retry<br/>3 attempts]
        RT --> EXEC[Execute]
        EXEC --> RESP[Response]
    end

    subgraph "Configuration"
        CFG[Policy Config]
        CFG --> TO
        CFG --> CB
        CFG --> RT
    end

    subgraph "Deferred Patterns"
        style Deferred fill:#f9f9f9,stroke:#999,stroke-dasharray: 5 5
        RL[Rate Limit]
        BH[Bulkhead]
        ADAPT[Adaptive CB]
    end
```

**Order Rationale:**

1. **Timeout first**: Prevents hanging operations
2. **Circuit breaker second**: Stops cascading failures
3. **Retry last**: Only retry if circuit is closed

**Default Configuration:**

```typescript
{
  timeout: {
    default: 30000,  // 30 seconds
    perOperation: {} // Override per agent
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    halfOpenRequests: 3
  },
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true
  }
}
```

## Execution Semantics (MVP)

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Running: Start execution
    Running --> StepExecuting: Next step

    StepExecuting --> StepSuccess: Success
    StepExecuting --> StepFailed: Failure
    StepExecuting --> StepTimeout: Timeout

    StepSuccess --> Running: More steps
    StepSuccess --> Completed: No more steps

    StepFailed --> Retrying: Retry policy
    StepFailed --> Failed: No retry

    Retrying --> StepExecuting: Attempt retry

    StepTimeout --> Failed: Timeout exceeded

    Running --> Cancelling: Cancel requested
    Cancelling --> Cancelled: Cleanup complete

    Completed --> [*]
    Failed --> [*]
    Cancelled --> [*]
```

**Key Semantics:**

- **Deterministic step boundaries**: Each step completes fully before next
- **Fail-fast default**: Stop on first failure unless configured otherwise
- **Cooperative cancellation**: Agents check cancellation token
- **Idempotency required**: Agents must handle duplicate invocations

## Observability (MVP)

```mermaid
graph TB
    subgraph "MVP Observability"
        subgraph "Spans"
            OS[orchestrator.execute]
            AS[agent.run]
            RS[resilience.retry]
            CS[circuit.state]
        end

        subgraph "Metrics"
            DUR[duration_ms]
            SUCC[success_count]
            FAIL[failure_count]
            RET[retry_count]
        end

        subgraph "Attributes"
            WID[workflow_id]
            SID[step_id]
            AID[agent_id]
            CID[correlation_id]
        end
    end

    OS --> AS
    AS --> RS
    RS --> CS

    OS --> DUR
    AS --> SUCC
    RS --> RET
    CS --> FAIL
```

**Deliverables:**

- OpenTelemetry spans for key operations
- Basic metrics (counters, histograms)
- Correlation ID propagation
- JSON structured logging

**NOT in MVP:**

- Distributed tracing
- Custom dashboards
- Metric aggregation
- Log analysis

## Testing Strategy (MVP)

```mermaid
graph LR
    subgraph "MVP Test Pyramid"
        UNIT[Unit Tests<br/>80% coverage]
        INT[Integration Tests<br/>Key paths]
        PERF[Performance Tests<br/>Baseline only]
    end

    subgraph "Test Tools"
        VITEST[Vitest]
        MSW[MSW for mocks]
        BENCH[tinybench]
    end

    subgraph "Deferred Testing"
        style Deferred fill:#f9f9f9,stroke:#999,stroke-dasharray: 5 5
        E2E[E2E Tests]
        CHAOS[Chaos Testing]
        LOAD[Load Testing]
    end

    UNIT --> VITEST
    INT --> MSW
    PERF --> BENCH
```

**Deliverables:**

- 80% unit test coverage on core packages
- Integration tests for orchestration flows
- Performance baseline with tinybench
- Agent test harness with MSW

**NOT in MVP:**

- End-to-end UI tests
- Chaos engineering
- Load testing
- Mutation testing

## What's NOT in the MVP

### Deferred to Post-MVP Phases

```mermaid
graph TB
    subgraph "Phase 2: Enhanced Developer Experience"
        VB[Visual Workflow Builder]
        TD[Time Travel Debugger]
        REG[Agent Registry]
        YAML[YAML/XML Support]
    end

    subgraph "Phase 3: Enterprise Features"
        GQL[GraphQL API]
        WS[WebSocket Monitoring]
        SSO[SSO Integration]
        RBAC[Role-Based Access]
    end

    subgraph "Phase 4: Advanced Capabilities"
        BH[Bulkhead Isolation]
        RL[Rate Limiting]
        ML[ML-Powered Optimization]
        CLOUD[Cloud Deployment]
    end

    subgraph "Phase 5: Local LLM Support"
        OLLAMA[Ollama Integration]
        ADAPT[Model Adapters<br/>Llama/Mistral/Mixtral]
        LOCAL[Local-First Execution]
        MULTI[Multi-Provider Support<br/>Claude/OpenAI/Local]
    end
```

### Explicit Non-Goals for MVP

1. **No Visual Tools**: CLI only, no web UI
2. **No Advanced Debugging**: Basic journal inspection only
3. **No Multiple API Formats**: REST with JSON only
4. **No Cross-Process Communication**: In-process only
5. **No Agent Registry**: Direct imports only
6. **No Authentication**: Local execution only
7. **No Cloud Features**: Single-node deployment
8. **No Advanced Resilience**: Basic patterns only
9. **No Local LLM Support**: Claude-only for MVP (Ollama in Phase 5)

## Success Criteria for MVP

### Week 1 Checkpoint

- [ ] Core orchestration engine runs hello-world
- [ ] Basic resilience patterns functional
- [ ] Workflow AST defined with JSON Schema
- [ ] In-process event bus operational

### Week 2 Checkpoint

- [ ] CLI can scaffold and run agents
- [ ] Test harness executes with MSW
- [ ] Execution journal captures steps
- [ ] Agent base classes documented

### Week 3 Checkpoint

- [ ] REST API serves 4 endpoints
- [ ] JSON prompts execute successfully
- [ ] Resilience policies tunable
- [ ] Basic observability operational

### Week 4 Checkpoint

- [ ] Documentation complete on Docusaurus
- [ ] 3+ example workflows functional
- [ ] Performance baseline established
- [ ] CI/CD pipeline green

## Risk Mitigation

| Risk               | Mitigation                                |
| ------------------ | ----------------------------------------- |
| Scope creep        | Hard stop on features not in MVP          |
| Performance issues | Baseline early, monitor continuously      |
| Complex debugging  | Simple journal format, clear boundaries   |
| Type complexity    | Single AST schema, generated types        |
| Testing bottleneck | Parallel test execution, focused coverage |

## Measurement Plan for Claims

### Instead of "95% Better"

```mermaid
graph LR
    subgraph "Measurable Metrics"
        ADH[Adherence Score]
        ADH --> STRUCT[Structure: 0-100]
        ADH --> CONST[Constraints: 0-100]
        ADH --> COMP[Completeness: 0-100]

        PERF[Performance]
        PERF --> LAT[Latency p50/p95/p99]
        PERF --> THRU[Throughput ops/sec]
        PERF --> MEM[Memory MB]
    end

    subgraph "A/B Testing"
        CONTROL[Markdown Prompts]
        TEST[JSON Prompts]
        MEASURE[Statistical Significance]
    end

    CONTROL --> MEASURE
    TEST --> MEASURE
    MEASURE --> ADH
```

**Measurement Protocol:**

1. Define 5 standard tasks
2. Score adherence on 3 dimensions (0-100)
3. Run A/B test with N=20 iterations
4. Require p<0.05 for claims
5. Report actual improvement percentage

## Conclusion

This lean MVP delivers **core orchestration value in 4 weeks** by:

- **Focusing**: CLI + REST, no visual tools
- **Simplifying**: 6 packages, not 17
- **Deferring**: Complex features to post-MVP
- **Measuring**: Real metrics, not marketing claims
- **Shipping**: Working system, not promises

The reduced scope enables high quality, comprehensive testing, and solid documentation while maintaining a clear path to the full vision in subsequent phases.
