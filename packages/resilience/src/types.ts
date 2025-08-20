/**
 * Type definitions for resilience patterns
 */

import type { ResilienceInvocationContext } from '@orchestr8/schema'

/**
 * Resilient operation type - all operations must accept an optional AbortSignal
 */
export type ResilientOperation<T> = (signal?: AbortSignal) => Promise<T>

/**
 * Retry configuration with precise control over backoff and jitter
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number
  /** Strategy for calculating delays between retries */
  backoffStrategy: 'fixed' | 'exponential'
  /** Jitter strategy to prevent thundering herd */
  jitterStrategy: 'none' | 'full'
  /** Initial delay in milliseconds */
  initialDelay: number
  /** Maximum delay in milliseconds (caps exponential backoff) */
  maxDelay: number
  /** Custom predicate to determine if an error is retryable */
  retryOn?: (error: unknown) => boolean
}

/**
 * Circuit breaker configuration with sliding window
 */
export interface CircuitBreakerConfig {
  /** Optional explicit key for circuit isolation (defaults to workflowId:stepId) */
  key?: string
  /** Number of failures required to open the circuit */
  failureThreshold: number
  /** Time in milliseconds before attempting recovery (half-open) */
  recoveryTime: number
  /** Size of the sliding window for tracking outcomes */
  sampleSize: number
  /** Policy for handling concurrent requests during half-open state */
  halfOpenPolicy: 'single-probe' | 'gradual'
}

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  /** Timeout duration in milliseconds */
  duration: number
  /** Optional operation name for error messages */
  operationName?: string
}

/**
 * Extended resilience context with signal for cancellation
 * Makes workflowId and stepId optional for standalone usage
 */
export interface ResilienceContext
  extends Partial<ResilienceInvocationContext> {
  /** AbortSignal for cancellation propagation */
  signal?: AbortSignal
}

/**
 * Circuit breaker state for internal tracking
 */
export interface CircuitBreakerState {
  /** Current state of the circuit */
  status: 'closed' | 'open' | 'half-open'
  /** Sliding window of outcomes (true = success, false = failure) */
  slidingWindow: Array<boolean>
  /** Current position in the circular buffer */
  windowIndex: number
  /** Number of valid entries in the window */
  windowSize: number
  /** Timestamp of the last failure */
  lastFailureTime?: number
  /** Timestamp when circuit can transition to half-open */
  nextHalfOpenTime?: number
  /** Lock to prevent concurrent probes in half-open state */
  probeInProgress: boolean
  /** Last access time for LRU cleanup */
  lastAccessTime?: number
}

/**
 * Normalized resilience configuration with all defaults applied
 */
export interface NormalizedResilienceConfig {
  retry?: RetryConfig
  circuitBreaker?: CircuitBreakerConfig
  timeout?: TimeoutConfig
}
