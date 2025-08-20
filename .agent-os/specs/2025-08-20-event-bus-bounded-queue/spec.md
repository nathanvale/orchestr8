# Spec Requirements Document

> Spec: In-process Event Bus with Bounded Queue
> Created: 2025-08-20
> Status: Planning

## Overview

Implement an in-process event bus with a bounded queue and overflow policy for the @orchestr8 orchestration engine. This feature enables asynchronous event-driven communication between components with memory safety through queue bounds and configurable overflow handling.

## User Stories

### Orchestration Engine Developer

As an orchestration engine developer, I want to emit and consume events asynchronously within the execution process, so that I can decouple components and enable reactive patterns without external dependencies.

The event bus will handle workflow execution events, state transitions, and resilience pattern triggers. When the engine executes workflows, it emits events for step starts, completions, failures, and retries. Components subscribe to relevant events to trigger actions like journal updates, metric collection, or state management.

### DevOps Engineer Monitoring Execution

As a DevOps engineer, I want the event bus to safely handle high event volumes without memory exhaustion, so that I can monitor production workloads without worrying about out-of-memory errors.

The bounded queue prevents unbounded memory growth during event storms or when consumers fall behind. The overflow policy ensures the system remains stable by dropping old events and tracking metrics when the queue reaches capacity.

## Spec Scope

1. **EventBus Core** - In-process event emitter with typed events and subscription management
2. **Bounded Queue** - Memory-safe queue with configurable capacity (default 1000 events)
3. **Overflow Policy** - DropOldest strategy with dropped event counting and metrics
4. **Event Types** - Strongly-typed workflow, execution, step, and resilience events
5. **Async Processing** - Non-blocking event emission with error isolation

## Out of Scope

- Cross-process messaging or distributed events
- Event persistence or replay capabilities
- Complex routing or filtering beyond basic subscriptions
- Multiple overflow policies (only dropOldest for MVP)
- Event prioritization or ordering guarantees beyond FIFO

## Expected Deliverable

1. EventBus class that extends Node.js EventEmitter with bounded queue enforcement
2. Strongly-typed event definitions covering all orchestration lifecycle events
3. Queue overflow handling that drops oldest events and maintains dropped count metrics

## Implementation Decisions

### Wildcard Pattern Support

**Decision**: No wildcards for MVP - exact event types only

- Rationale: Simplifies implementation, better performance, clearer contracts
- Future: Can add pattern matching in v2 if needed
- Impact: All subscriptions must use exact event type strings

### Event Cloning Strategy

**Decision**: Hybrid approach for memory safety

- Shallow clone event envelope properties
- Preserve Error instances without cloning (maintain stack traces)
- Document that event data should be treated as immutable
- Rationale: Balances memory safety with Error debugging capabilities

### Metrics API Shape

**Decision**: Standardized metrics interface

```typescript
interface EventBusMetrics {
  droppedCount: number
  lastDropTimestamp: number | null
  highWaterMark: number
  queueSize: number
  dropRate: number // events dropped per minute
  listeners: Map<string, number> // event type -> listener count
}
```

### Emission Scheduling

**Decision**: Use `queueMicrotask()` for async delivery

- Provides lowest latency (< 1ms p95)
- Better than `setImmediate` or `process.nextTick` for our performance targets
- Maintains JavaScript microtask queue semantics

### Listener Limits

**Decision**: Per-event-type limits via EventEmitter

- Use `emitter.setMaxListeners(config.maxListenersPerEvent)`
- Default: 100 listeners per event type
- Behavior: Warning logged when exceeded, not a hard limit

### Memory Estimation

**Decision**: Lightweight optional heuristic

- Sample 1 in 100 events for size estimation
- Use running average for memory calculations
- Configurable via `enableMemoryTracking` flag (default: false)
- Rationale: Avoids `JSON.stringify` overhead under load

## Spec Documentation

- Tasks: @.agent-os/specs/2025-08-20-event-bus-bounded-queue/tasks.md
- Technical Specification: @.agent-os/specs/2025-08-20-event-bus-bounded-queue/sub-specs/technical-spec.md
- Tests Specification: @.agent-os/specs/2025-08-20-event-bus-bounded-queue/sub-specs/tests.md
