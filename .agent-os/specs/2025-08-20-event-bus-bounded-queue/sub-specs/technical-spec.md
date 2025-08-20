# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-20-event-bus-bounded-queue/spec.md

> Created: 2025-08-20
> Version: 1.0.0

## Technical Requirements

### Core Event Bus Implementation

- **Base Class**: Extend Node.js EventEmitter for familiarity and compatibility
- **TypeScript Generics**: Strongly-typed event definitions with discriminated unions
- **Queue Management**: Internal queue structure with size tracking and bounds enforcement
- **Async Processing**: Use `queueMicrotask()` for lowest-latency non-blocking emission (< 1ms p95)
- **Error Isolation**: Wrap listener calls in try-catch to prevent cascade failures
- **Subscription Model**: Exact event type matching only (no wildcards in MVP)

### Bounded Queue Specifications

- **Default Capacity**: 1000 events (configurable via constructor)
- **Data Structure**: Circular buffer or array with efficient shift operations
- **Size Tracking**: Maintain current queue size and high-water mark
- **Memory Calculation**: Track approximate memory usage (serialized size estimation)

### Overflow Policy Implementation

- **Strategy**: DropOldest - removes earliest events when capacity reached
- **Metrics API**: Standardized `getMetrics()` method returning:
  ```typescript
  interface EventBusMetrics {
    droppedCount: number
    lastDropTimestamp: number | null
    highWaterMark: number
    queueSize: number
    dropRate: number // events per minute
    listeners: Map<string, number>
  }
  ```
- **Logging**: Emit warning on first drop, then throttled warnings (max 1/minute)

### Event Type Definitions

```typescript
type WorkflowEvent =
  | { type: 'workflow.started'; workflowId: string; timestamp: number }
  | { type: 'workflow.completed'; workflowId: string; duration: number }
  | { type: 'workflow.failed'; workflowId: string; error: Error }

type ExecutionEvent =
  | { type: 'execution.queued'; executionId: string; workflowId: string }
  | { type: 'execution.started'; executionId: string }
  | { type: 'execution.cancelled'; executionId: string; reason: string }

type StepEvent =
  | { type: 'step.started'; stepId: string; executionId: string }
  | { type: 'step.completed'; stepId: string; output: unknown }
  | { type: 'step.failed'; stepId: string; error: Error; retryable: boolean }

type ResilienceEvent =
  | { type: 'retry.attempted'; stepId: string; attempt: number; delay: number }
  | { type: 'circuitBreaker.opened'; key: string; failures: number }
  | { type: 'timeout.exceeded'; stepId: string; duration: number }
```

### Performance Constraints

- **Event Processing**: < 1ms per event emission (p95) via `queueMicrotask`
- **Queue Operations**: O(1) enqueue/dequeue operations
- **Memory Overhead**: < 100KB base + event storage
- **Subscriber Limit**: Support up to 100 listeners per event type
- **Throughput Target**: 10,000 events/second sustained
- **Latency Target**: p95 < 1ms, p99 < 5ms

## Approach Options

**Option A: Direct EventEmitter Extension**

- Pros: Simple, familiar API, native Node.js performance
- Cons: Manual queue management, custom overflow logic

**Option B: Queue-First Architecture with EventEmitter** (Selected)

- Pros: Clean separation of concerns, easier testing, flexible queue strategies
- Cons: Additional abstraction layer

**Option C: Custom Event System**

- Pros: Full control, optimized for use case
- Cons: More code to maintain, learning curve for developers

**Rationale:** Option B provides the best balance of simplicity and flexibility. The queue layer handles bounds and overflow while delegating event delivery to the proven EventEmitter.

## External Dependencies

None required - uses only Node.js built-in modules (events, util)

## Integration with OrchestrationOptions

```typescript
interface OrchestrationOptions {
  // ... existing options
  eventBus?: BoundedEventBus | EventBusConfig
  // If not provided, creates internal bus with defaults
}

class OrchestrationEngine {
  private eventBus: BoundedEventBus

  constructor(options: OrchestrationOptions) {
    this.eventBus =
      options.eventBus instanceof BoundedEventBus
        ? options.eventBus
        : new BoundedEventBus(options.eventBus || {})
  }
}
```

## Event Emission Order Guarantees

- **Within a step**: All events maintain strict ordering
- **Cross-step**: Parallel steps may interleave events
- **Workflow level**: Start/complete/fail events bracket all step events

## Integration Points

### ExecutionEngine Integration

```typescript
class ExecutionEngine {
  private eventBus: BoundedEventBus

  async executeStep(step: WorkflowStep) {
    this.eventBus.emit({
      type: 'step.started',
      stepId: step.id,
      executionId: this.executionId,
    })

    try {
      const result = await step.execute()
      this.eventBus.emit({
        type: 'step.completed',
        stepId: step.id,
        output: result,
      })
    } catch (error) {
      this.eventBus.emit({
        type: 'step.failed',
        stepId: step.id,
        error,
        retryable: isRetryable(error),
      })
    }
  }
}
```

### Journal Integration

```typescript
class ExecutionJournal {
  constructor(eventBus: BoundedEventBus) {
    // Subscribe to specific event types (no wildcards in MVP)
    eventBus.on('step.started', this.recordStepEvent.bind(this))
    eventBus.on('step.completed', this.recordStepEvent.bind(this))
    eventBus.on('step.failed', this.recordStepEvent.bind(this))
    eventBus.on('workflow.started', this.recordWorkflowEvent.bind(this))
    eventBus.on('workflow.completed', this.recordWorkflowEvent.bind(this))
    eventBus.on('workflow.failed', this.recordWorkflowEvent.bind(this))
  }

  private recordStepEvent(event: StepEvent) {
    // Ensure backpressure safety - don't block bus
    setImmediate(() => {
      this.entries.push({
        timestamp: Date.now(),
        type: event.type,
        data: event,
      })
    })
  }
}
```

### Resilience Pattern Integration

```typescript
class CircuitBreaker {
  constructor(eventBus: BoundedEventBus) {
    this.eventBus = eventBus
  }

  private trip() {
    this.state = 'OPEN'
    this.eventBus.emit({
      type: 'circuitBreaker.opened',
      key: this.key,
      failures: this.failureCount,
    })
  }
}
```

## Configuration Schema

```typescript
interface EventBusConfig {
  maxQueueSize: number // Default: 1000
  overflowPolicy: 'dropOldest' // Only option for MVP
  warnOnDrop: boolean // Default: true
  metricsInterval: number // Default: 60000 (1 minute)
  maxListenersPerEvent: number // Default: 100 (per event type)
  enableMemoryTracking: boolean // Default: false (optional)
}
```

## Memory Safety Considerations

- **Event Cloning**: Hybrid approach for safety and performance:
  - Shallow clone event envelope properties
  - Preserve Error objects without cloning (maintain stack/prototype)
  - Document immutability expectations for event data
- **Memory Tracking**: Optional lightweight heuristic:
  - Sample 1 in 100 events for size estimation
  - Use running average for calculations
  - Enable via `enableMemoryTracking` config flag
- **Listener Cleanup**: Provide automatic cleanup on execution completion
- **Queue Bounds**: Hard limit enforced before any event is added
- **Metric Bounds**: Rolling window for drop rate (last 100 samples max)
