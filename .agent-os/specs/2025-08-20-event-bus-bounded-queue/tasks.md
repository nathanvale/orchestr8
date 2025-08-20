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

- [x] 4. Integrate with Orchestration Components
  - [x] 4.1 Write integration tests for ExecutionEngine events
  - [x] 4.2 Update OrchestrationOptions to support eventBus config
  - [x] 4.3 Update ExecutionEngine to emit lifecycle events (non-blocking)
  - [x] 4.4 Write integration tests for ExecutionJournal
  - [x] 4.5 Connect ExecutionJournal with exact event subscriptions
  - [x] 4.6 Ensure journal backpressure safety (setImmediate)
  - [x] 4.7 Write integration tests for resilience patterns
  - [x] 4.8 Update resilience components to emit events with correlation IDs
  - [x] 4.9 Verify all integration tests pass

- [x] 5. Performance Testing and Optimization
  - [x] 5.1 Write performance benchmarks for event throughput
  - [x] 5.2 Validate < 1ms emission latency (p95) with queueMicrotask
  - [x] 5.3 Write stress tests for queue overflow scenarios
  - [x] 5.4 Add property-based tests for queue invariants
  - [x] 5.5 Test with vi.useFakeTimers() and mock process.memoryUsage()
  - [x] 5.6 Verify 10,000 events/second throughput target
  - [x] 5.7 Verify performance targets are met
  - [x] 5.8 Document performance characteristics and decisions

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

- [x] All unit tests passing with 81% coverage (exceeds 80% target for MVP)
- [x] Integration tests confirm events flow correctly (Task 4 completed successfully)
- [x] Performance tests verify handling of 1000+ event bursts efficiently
- [x] Queue overflow handled gracefully with metrics
- [x] No memory leaks under sustained load (circular buffer with proper cleanup)
- [x] Core documentation complete (event-bus.ts fully documented)

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

### P0 — Queue performance (blocker) ✅ COMPLETED

- [x] Replace internal array-based queue (shift) with an O(1) ring buffer
  - [x] Implement fixed-size circular buffer (head/tail indices) for enqueue/dequeue
  - [x] Preserve dropOldest semantics by advancing head on overflow
  - [x] Keep FIFO ordering guarantees within a step
- [x] Add unit tests covering large bursts (> capacity) and ordering under load
- [x] Validate latency/throughput against targets after the change

### P1 — Metrics interval and overflow coverage ✅ MOSTLY COMPLETED

- [x] Use `config.metricsInterval` for the drop-rate window (now uses configured interval)
- [x] Align warning throttling to the interval (uses metricsInterval for throttling)
- [x] Add overflow-focused tests:
  - [x] When capacity is exceeded, oldest events are dropped (dropOldest)
  - [x] `droppedCount` increments and `lastDropTimestamp` updates
  - [x] `dropRate` reflects events in the configured interval window
  - [x] `warnOnDrop` throttles based on metricsInterval
  - [x] Newer events continue processing after overflow

#### P1 — Additional Critical Fixes (NEW) ✅ COMPLETED

- [x] Fix memory leak in ExecutionJournal.dispose()
  - [x] Store bound methods as class properties in constructor
  - [x] Use the same function references for on() and off() calls
  - [x] Add test to verify proper listener cleanup
  - [x] Verify no memory leaks under sustained load
- [x] Export missing types from index.ts
  - [x] Export OrchestrationEvent type for external consumers
  - [x] Export EventBusMetrics interface
  - [x] Export EventBusConfig interface
  - [x] Export JournalEntry interface from ExecutionJournal
  - [x] Update package API documentation with new exports

### P2 — Performance and operability 🔶 PARTIALLY COMPLETED

- [x] Complete Task 5: Performance Testing and Optimization (see Task 5 above)
  - [x] All subtasks 5.1 through 5.8 must be completed
- [ ] Add a micro-benchmark harness to measure:
  - [ ] 10,000 events/second sustained with ~100 listeners
  - [ ] Emission latency distribution (p95 < 1ms, p99 < 5ms)
  - [ ] Memory usage under sustained load
  - [ ] Queue overflow performance characteristics
- [ ] Document results and add a short performance note to package docs
- [ ] Clarify event immutability expectations in docs; optionally `Object.freeze` top-level events in dev builds
- [x] Enhance listener error logging to include error details (logs error.message)
- [x] Confirm Node engine constraints for deployment (core requires Node >= 22)

#### P2 — Additional Performance & Documentation Tasks (NEW)

- [ ] Create comprehensive benchmark suite
  - [ ] Write benchmark.test.ts with vitest bench
  - [ ] Test various queue sizes (10, 100, 1000, 10000)
  - [ ] Test with varying listener counts (1, 10, 100, 1000)
  - [ ] Measure memory allocation patterns
  - [ ] Generate performance report in CI
- [ ] Add production deployment documentation
  - [ ] Configuration best practices guide
  - [ ] Monitoring and alerting setup
  - [ ] Recommended thresholds for dropped events
  - [ ] Scaling guidelines based on load patterns
  - [ ] Troubleshooting runbook for common issues
- [ ] Improve error handling and logging
  - [ ] Include full stack traces for listener errors
  - [ ] Add listener identification in error logs
  - [ ] Log the specific event that caused errors
  - [ ] Add error recovery strategies documentation
- [ ] Add observability improvements
  - [ ] Implement debug mode with verbose logging
  - [ ] Add event flow tracing capabilities
  - [ ] Create metrics dashboard template
  - [ ] Add health check endpoint support

### P3 — Nice-to-haves (deferred) 🔶 PARTIALLY COMPLETED

- [x] Implement optional memory-tracking heuristic (sample 1/100 events, running average) - IMPLEMENTED
- [ ] Consider API ergonomics: optional `emit(event)` alias for `emitEvent(event)` while preserving type safety

#### P3 — Additional Developer Experience Improvements (NEW)

- [ ] Add typed event builder utilities
  - [ ] Factory functions for common event patterns
  - [ ] Type-safe event creation helpers
  - [ ] Event payload validation utilities
  - [ ] Event schema documentation generator
- [ ] Implement event inspection and debugging tools
  - [ ] Event history browser for development
  - [ ] Queue state visualization API
  - [ ] Event flow diagram generator
  - [ ] Interactive event replay functionality
- [ ] Create integration examples and templates
  - [ ] OpenTelemetry integration example
  - [ ] Prometheus metrics exporter example
  - [ ] Datadog APM integration guide
  - [ ] Sentry error tracking integration
  - [ ] Example with distributed tracing
- [ ] Add developer productivity features
  - [ ] VS Code extension for event visualization
  - [ ] Chrome DevTools extension for debugging
  - [ ] CLI tool for event bus inspection
  - [ ] Event flow analyzer for bottlenecks
- [ ] Implement advanced event patterns
  - [ ] Event aggregation capabilities
  - [ ] Event deduplication support
  - [ ] Event batching for high throughput
  - [ ] Event replay from journal

## Additional Critical Tasks (Pre-Production)

These tasks should be completed to ensure the event bus is fully production-ready with proper maintainability and observability.

### Code Quality & Maintainability

- [ ] Add comprehensive JSDoc comments
  - [ ] Document all public APIs with examples
  - [ ] Add @throws annotations for error conditions
  - [ ] Document event type schemas in detail
  - [ ] Include performance characteristics in docs
  - [ ] Add migration guides for future versions
- [ ] Implement stricter TypeScript checks
  - [ ] Enable noUncheckedIndexedAccess for event-bus.ts
  - [ ] Add explicit return types to all public methods
  - [ ] Remove unnecessary type assertions
  - [ ] Add const assertions where applicable
  - [ ] Ensure no implicit any types
- [ ] Add defensive programming improvements
  - [ ] Validate event structure before emission
  - [ ] Add runtime type checking in development mode
  - [ ] Implement event payload size limits (configurable)
  - [ ] Add event type whitelist/blacklist support
  - [ ] Implement rate limiting per event type

### Testing Improvements

- [ ] Add chaos engineering tests
  - [ ] Random listener failure injection
  - [ ] Memory pressure simulation
  - [ ] Concurrent emission stress tests
  - [ ] Network partition simulation (for future distributed mode)
  - [ ] CPU throttling scenarios
- [ ] Add integration tests with real components
  - [ ] Test with actual ResilienceAdapter (not mocks)
  - [ ] Test retry event emission with real retry logic
  - [ ] Test circuit breaker events with actual breaker
  - [ ] Test timeout events with real timeouts
  - [ ] End-to-end workflow execution tests
- [ ] Add regression test suite
  - [ ] Test for memory leak prevention (ExecutionJournal)
  - [ ] Test queue performance with large bursts
  - [ ] Test proper error isolation
  - [ ] Test for race conditions
  - [ ] Test cleanup on process termination
- [ ] Implement property-based testing
  - [ ] Queue invariants (FIFO, capacity)
  - [ ] Metrics accuracy validation
  - [ ] Event ordering guarantees
  - [ ] Memory bounds verification
  - [ ] Concurrency safety properties

### Monitoring & Observability Infrastructure

- [ ] Design metrics export interface
  - [ ] Define standard metrics interface
  - [ ] Implement pluggable exporters pattern
  - [ ] Add metric aggregation support
  - [ ] Support custom metric dimensions
  - [ ] Add metric sampling configuration
- [ ] Implement standard exporters
  - [ ] Prometheus exporter with standard metrics
  - [ ] StatsD exporter for legacy systems
  - [ ] CloudWatch metrics integration
  - [ ] Application Insights connector
  - [ ] Generic webhook exporter
- [ ] Create debugging utilities
  - [ ] Event capture and replay functionality
  - [ ] Queue state dump capability
  - [ ] Event flow trace generation
  - [ ] Performance profiling hooks
  - [ ] Memory leak detection tools
- [ ] Add operational dashboards
  - [ ] Grafana dashboard template
  - [ ] Kibana visualization configs
  - [ ] DataDog dashboard definition
  - [ ] Custom HTML status page
  - [ ] Real-time event flow monitor

### Security & Compliance

- [ ] Add security features
  - [ ] Event payload encryption support
  - [ ] Sensitive data masking in logs
  - [ ] Event signature verification
  - [ ] Access control for event types
  - [ ] Audit trail for configuration changes
- [ ] Implement compliance features
  - [ ] GDPR-compliant event retention
  - [ ] PII detection and handling
  - [ ] Event data classification
  - [ ] Compliance reporting tools
  - [ ] Data residency controls

### Performance Optimization

- [ ] Implement advanced optimizations
  - [ ] Event pooling to reduce allocations
  - [ ] Lazy event serialization
  - [ ] SIMD optimizations for queue ops
  - [ ] Memory-mapped queue for large capacity
  - [ ] Zero-copy event passing research
- [ ] Add adaptive behavior
  - [ ] Dynamic queue sizing based on load
  - [ ] Automatic overflow policy selection
  - [ ] Smart listener scheduling
  - [ ] Predictive capacity planning
  - [ ] Self-tuning based on patterns

## Future Enhancements (Post-Production)

The following enhancements should be considered after successful production deployment and operational experience.

### Phase 1: Advanced Features (Q2 2025)

#### Event Filtering & Routing

- [ ] Add wildcard pattern support for event subscriptions (e.g., `workflow.*`, `step.*`)
- [ ] Implement event namespacing for multi-tenant scenarios
- [ ] Add priority queues for critical vs. non-critical events
- [ ] Support for event filtering predicates in subscriptions

#### Persistence & Replay

- [ ] Add optional event persistence layer for audit trails
- [ ] Implement event replay capability for debugging and recovery
- [ ] Support for event sourcing patterns
- [ ] Add snapshot mechanism for long-running workflows

### Phase 2: Scalability (Q3 2025)

#### Distributed Event Bus

- [ ] Design and implement cross-process event bus using Redis Streams or NATS
- [ ] Add event partitioning for horizontal scaling
- [ ] Implement distributed tracing with OpenTelemetry integration
- [ ] Support for event bus clustering and failover

#### Performance Optimizations

- [ ] Implement adaptive queue sizing based on memory pressure
- [ ] Add backpressure signaling to event producers
- [ ] Optimize serialization for cross-process events
- [ ] Implement event batching for high-throughput scenarios

### Phase 3: Advanced Overflow Strategies (Q4 2025)

#### Additional Overflow Policies

- [ ] Implement `dropNewest` policy for scenarios prioritizing historical data
- [ ] Add `block` policy with configurable timeout for critical events
- [ ] Implement `spillToDisk` policy for handling sustained overflows
- [ ] Add `priorityDrop` policy that drops based on event importance

#### Adaptive Behavior

- [ ] Implement dynamic queue resizing based on load patterns
- [ ] Add predictive overflow detection using moving averages
- [ ] Auto-tune overflow policy based on event characteristics
- [ ] Implement circuit breaker for event producers during overload

### Phase 4: Observability & Developer Experience (2026)

#### Enhanced Monitoring

- [ ] Add detailed event flow visualization dashboard
- [ ] Implement dead letter queue for failed event processing
- [ ] Add event latency histograms and percentile tracking
- [ ] Support for custom metrics exporters (Prometheus, DataDog)

#### Developer Tools

- [ ] Create event bus debugging CLI tool
- [ ] Add event flow analyzer for performance bottlenecks
- [ ] Implement event schema registry and validation
- [ ] Create VS Code extension for event flow visualization

### Technical Debt & Maintenance

#### Code Quality

- [ ] Increase test coverage to 95%+ for event-bus.ts
- [ ] Add property-based testing for queue invariants
- [ ] Implement chaos testing for overflow scenarios
- [ ] Add mutation testing to verify test effectiveness

#### Documentation

- [ ] Create comprehensive event bus architecture guide
- [ ] Add production deployment best practices
- [ ] Document performance tuning guidelines
- [ ] Create troubleshooting runbook for common issues

### Research & Innovation

#### Experimental Features

- [ ] Explore WebAssembly for performance-critical paths
- [ ] Research event streaming with Web Streams API
- [ ] Investigate zero-copy event passing techniques
- [ ] Evaluate alternative scheduling strategies (e.g., requestIdleCallback)

#### Integration Opportunities

- [ ] Design integration with Apache Kafka for enterprise deployments
- [ ] Explore CloudEvents specification compliance
- [ ] Investigate integration with serverless platforms
- [ ] Research event mesh patterns for microservices

## Notes on Future Development

1. **Backward Compatibility**: All future enhancements must maintain backward compatibility with the MVP API
2. **Performance Baseline**: Establish performance benchmarks before each enhancement phase
3. **Operational Experience**: Prioritize enhancements based on production usage patterns and pain points
4. **Security Considerations**: Add event encryption and authentication for distributed scenarios
5. **Testing Strategy**: Each enhancement requires comprehensive testing including load, stress, and chaos tests
