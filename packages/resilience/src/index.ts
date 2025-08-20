/**
 * @orchestr8/resilience - Production resilience adapter implementation
 */

// Export circuit breaker
export { CircuitBreaker } from './circuit-breaker.js'
export type { CircuitBreakerObserver } from './circuit-breaker.js'
// Export composition engine
export { ResilienceComposer } from './composition.js'
// Export error types
export {
  CircuitBreakerOpenError,
  RetryExhaustedError,
  TimeoutError,
  isCircuitBreakerOpenError,
  isRetryExhaustedError,
  isTimeoutError,
} from './errors.js'
// Export key derivation utility
export { deriveKey } from './key-derivation.js'
// Export observability
export {
  createResilienceTelemetry,
  DefaultResilienceTelemetry,
  defaultTelemetry,
} from './observability.js'
export type {
  ResilienceEventType,
  ResilienceTelemetry,
} from './observability.js'
// Export production adapter as default
export { ProductionResilienceAdapter } from './production-adapter.js'
// Export reference adapter for backward compatibility
export { ReferenceResilienceAdapter } from './reference-adapter.js'
// Export retry wrapper
export { RetryWrapper } from './retry.js'
export type { RetryCallback } from './retry.js'
export type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  NormalizedResilienceConfig,
  ResilienceContext,
  ResilientOperation,
  RetryConfig,
  TimeoutConfig,
} from './types.js'
export type { CompositionOrder, ResiliencePolicy } from '@orchestr8/schema'
