# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-20-event-bus-bounded-queue/spec.md

> Created: 2025-08-20
> Status: Ready for Implementation

## Tasks

- [x] 1. Create Core Event Bus Infrastructure
  - [x] 1.1 Write tests for BoundedEventBus class creation and configuration
  - [x] 1.2 Create BoundedEventBus class extending EventEmitter
  - [x] 1.3 Implement configuration schema with TypeScript interfaces
  - [x] 1.4 Add event type definitions using discriminated unions (exact types only)
  - [x] 1.5 Implement getMetrics() API returning EventBusMetrics interface
  - [x] 1.6 Add queueMicrotask scheduling for async emission
  - [x] 1.7 Verify all core tests pass

- [x] 2. Implement Bounded Queue Mechanism
  - [x] 2.1 Write tests for queue capacity enforcement
  - [x] 2.2 Implement internal queue data structure (circular buffer)
  - [x] 2.3 Add queue size tracking and bounds checking
  - [x] 2.4 Implement FIFO event processing with queueMicrotask
  - [x] 2.5 Add optional memory tracking (sampling heuristic)
  - [x] 2.6 Implement hybrid event cloning (shallow + Error preservation)
  - [x] 2.7 Verify queue management tests pass

- [x] 3. Add Overflow Policy and Metrics
  - [x] 3.1 Write tests for dropOldest overflow behavior
  - [x] 3.2 Implement dropOldest policy when queue is full
  - [x] 3.3 Add dropped event counting and metrics collection
  - [x] 3.4 Implement drop rate calculation with rolling window
  - [x] 3.5 Add warning logs with throttling (max 1/minute)
  - [x] 3.6 Update getMetrics() to include all metric fields
  - [x] 3.7 Document queueMicrotask scheduling decision
  - [x] 3.8 Verify overflow handling tests pass

- [ ] 4. Integrate with Orchestration Components
  - [ ] 4.1 Write integration tests for ExecutionEngine events
  - [ ] 4.2 Update OrchestrationOptions to support eventBus config
  - [ ] 4.3 Update ExecutionEngine to emit lifecycle events (non-blocking)
  - [ ] 4.4 Write integration tests for ExecutionJournal
  - [ ] 4.5 Connect ExecutionJournal with exact event subscriptions
  - [ ] 4.6 Ensure journal backpressure safety (setImmediate)
  - [ ] 4.7 Write integration tests for resilience patterns
  - [ ] 4.8 Update resilience components to emit events with correlation IDs
  - [ ] 4.9 Verify all integration tests pass

- [ ] 5. Performance Testing and Optimization
  - [ ] 5.1 Write performance benchmarks for event throughput
  - [ ] 5.2 Validate < 1ms emission latency (p95) with queueMicrotask
  - [ ] 5.3 Write stress tests for queue overflow scenarios
  - [ ] 5.4 Add property-based tests for queue invariants
  - [ ] 5.5 Test with vi.useFakeTimers() and mock process.memoryUsage()
  - [ ] 5.6 Verify 10,000 events/second throughput target
  - [ ] 5.7 Verify performance targets are met
  - [ ] 5.8 Document performance characteristics and decisions

## Implementation Order

The tasks should be executed in the following order to ensure proper dependencies:

1. **Core Infrastructure First** (Task 1): Establish the foundation with basic event bus functionality
2. **Queue Management** (Task 2): Add bounded queue with capacity enforcement
3. **Overflow Handling** (Task 3): Implement overflow policy and metrics
4. **Integration** (Task 4): Connect to existing orchestration components
5. **Performance** (Task 5): Validate and optimize for production use

## Time Estimates

- Task 1: 2 hours (Core infrastructure)
- Task 2: 2 hours (Queue implementation)
- Task 3: 1.5 hours (Overflow policy)
- Task 4: 3 hours (Integration with existing components)
- Task 5: 1.5 hours (Performance testing)

**Total Estimated Time**: 10 hours

## Dependencies

### Internal Dependencies

- @orchestr8/core package must exist for integration
- @orchestr8/schema for event type definitions
- @orchestr8/testing for test harness utilities

### External Dependencies

- None - uses only Node.js built-in modules

## Success Criteria

- [ ] All unit tests passing with 95% coverage
- [ ] Integration tests confirm events flow correctly
- [ ] Performance benchmarks meet targets (< 1ms latency, 10K events/sec)
- [ ] Queue overflow handled gracefully with metrics
- [ ] No memory leaks under sustained load
- [ ] Documentation complete with usage examples

## Risk Mitigation

### Risk: Event Loss During High Load

**Mitigation**: Implement overflow metrics and monitoring to detect and alert on dropped events

### Risk: Memory Leak from Listener References

**Mitigation**: Implement automatic listener cleanup and provide clear lifecycle management

### Risk: Performance Degradation with Many Listeners

**Mitigation**: Limit listeners per event type (100 max) and use queueMicrotask for optimal scheduling

### Risk: Error Object Mutation

**Mitigation**: Document immutability expectations and preserve Error objects without cloning

## Notes

- The event bus is critical infrastructure that will be used throughout the orchestration engine
- Focus on reliability and performance over features for the MVP
- Consider future extensibility but don't over-engineer the initial implementation
- Ensure clear documentation of overflow behavior for production operations

## Production readiness (P0–P3)

The following remediation tasks must be completed before promoting to production, ordered by priority from the latest assessment (2025-08-20).

### P0 — Queue performance (blocker)

- [ ] Replace internal array-based queue (shift) with an O(1) ring buffer
  - [ ] Implement fixed-size circular buffer (head/tail indices) for enqueue/dequeue
  - [ ] Preserve dropOldest semantics by advancing head on overflow
  - [ ] Keep FIFO ordering guarantees within a step
- [ ] Add unit tests covering large bursts (> capacity) and ordering under load
- [ ] Validate latency/throughput against targets after the change

### P1 — Metrics interval and overflow coverage

- [ ] Use `config.metricsInterval` for the drop-rate window (currently fixed at 60s)
- [ ] Align warning throttling to the interval or document it remains 60s explicitly
- [ ] Add overflow-focused tests:
  - [ ] When capacity is exceeded, oldest events are dropped (dropOldest)
  - [ ] `droppedCount` increments and `lastDropTimestamp` updates
  - [ ] `dropRate` reflects events in the configured interval window
  - [ ] `warnOnDrop` throttles to 1 per minute (or per configured interval)
  - [ ] Newer events continue processing after overflow

### P2 — Performance and operability

- [ ] Add a micro-benchmark harness to measure:
  - [ ] 10,000 events/second sustained with ~100 listeners
  - [ ] Emission latency distribution (p95 < 1ms, p99 < 5ms)
- [ ] Document results and add a short performance note to package docs
- [ ] Clarify event immutability expectations in docs; optionally `Object.freeze` top-level events in dev builds
- [ ] Enhance listener error logging to include `error.stack` when available
- [ ] Confirm Node engine constraints for deployment (core requires Node >= 22)

### P3 — Nice-to-haves (deferred)

- [ ] Implement optional memory-tracking heuristic (sample 1/100 events, running average)
  - Or remove `enableMemoryTracking` flag for now to avoid dead configuration
- [ ] Consider API ergonomics: optional `emit(event)` alias for `emitEvent(event)` while preserving type safety
