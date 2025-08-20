# Spec Requirements Document

> Spec: Resilience P0 Prerequisites
> Created: 2025-08-19
> Status: Planning

## Overview

Implement critical schema and interface changes required before the production resilience adapter can be built. These P0 items address contract mismatches that currently block signal propagation and circuit key derivation.

## User Stories

### Signal Propagation for Middleware

As a resilience middleware developer, I want operations to accept an optional AbortSignal parameter, so that I can inject combined signals for timeout and cancellation without being locked to a pre-chosen signal.

Currently, the orchestration engine passes operations that have already closed over a specific signal. This prevents the resilience adapter from injecting its own timeout signals or combining multiple cancellation sources. The solution is to pass operations as functions that accept a signal parameter, allowing middleware to control signal propagation through the chain.

### Circuit Breaker Key Derivation

As a platform operator, I want circuit breakers to automatically derive keys from execution context, so that circuits are isolated per workflow/step combination without manual configuration.

The circuit breaker needs context about which workflow and step is executing to derive sensible default keys. Without this context, every circuit would need explicit key configuration, leading to error-prone manual setup. By passing invocation context to the adapter, we enable automatic per-step circuit isolation.

## Spec Scope

1. **Update Adapter Operation Signature** - Change ResilienceAdapter to accept operations as `(signal?: AbortSignal) => Promise<T>`
2. **Add Invocation Context Type** - Define ResilienceInvocationContext with workflowId, stepId, correlationId
3. **Extend Resilience Policy Types** - Add circuitBreaker.key, confirm retry/composition types match spec
4. **Define Error Types** - Add TimeoutError and CircuitBreakerOpenError with proper metadata
5. **Update Core Engine Signal Passing** - Modify OrchestrationEngine to pass signal-accepting functions

## Out of Scope

- Implementation of ProductionResilienceAdapter
- Circuit breaker state management
- Composition engine implementation
- Performance optimizations
- Migration from ReferenceResilienceAdapter

## Expected Deliverable

1. Updated TypeScript interfaces in @orchestr8/schema that support signal propagation
2. Core engine correctly passing operations that accept signals
3. All existing tests passing with updated contracts
4. Type definitions ready for resilience adapter implementation

## Spec Documentation

- Tasks: @.agent-os/specs/2025-08-19-resilience-p0-prerequisites/tasks.md
- Technical Specification: @.agent-os/specs/2025-08-19-resilience-p0-prerequisites/sub-specs/technical-spec.md
- Tests Specification:
  @.agent-os/specs/2025-08-19-resilience-p0-prerequisites/sub-specs/tests.md
