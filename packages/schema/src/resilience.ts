/**
 * Resilience pattern types for @orchestr8
 * These types define the contracts for resilience policies and adapters
 */

/**
 * Context passed to resilience adapters for circuit key derivation and correlation
 */
export interface ResilienceInvocationContext {
  /** Unique identifier for the workflow instance */
  workflowId: string
  /** Identifier for the specific step being executed */
  stepId: string
  /** Optional correlation ID for tracing across retries and systems */
  correlationId?: string
  /** Optional metadata for custom observability */
  metadata?: Record<string, unknown>
}

/**
 * Resilience policy configuration
 */
export interface ResiliencePolicy {
  /**
   * Retry configuration
   */
  retry?: {
    maxAttempts: number
    backoffStrategy: 'fixed' | 'exponential'
    jitterStrategy: 'none' | 'full-jitter'
    initialDelay: number
    maxDelay: number
  }

  /**
   * Circuit breaker configuration
   */
  circuitBreaker?: {
    /** Optional explicit key for circuit isolation (defaults to workflowId:stepId) */
    key?: string
    failureThreshold: number
    recoveryTime: number
    sampleSize: number
    halfOpenPolicy: 'single-probe' | 'gradual'
  }

  /**
   * Timeout in milliseconds
   */
  timeout?: number
}

/**
 * Composition order for resilience patterns
 */
export type CompositionOrder = 'retry-cb-timeout' | 'timeout-cb-retry'

/**
 * Adapter for applying resilience patterns to operations
 */
export interface ResilienceAdapter {
  /**
   * Apply resilience policies to an operation (legacy method)
   * @param operation The operation to wrap
   * @param policy The resilience policy to apply
   * @param signal Abort signal for cancellation
   * @param context Optional invocation context for key derivation
   * @returns The wrapped operation
   * @deprecated Use applyNormalizedPolicy for better control over composition order
   */
  applyPolicy<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    policy: ResiliencePolicy,
    signal?: AbortSignal,
    context?: ResilienceInvocationContext,
  ): Promise<T>

  /**
   * Apply normalized resilience policies to an operation with explicit composition order
   * @param operation The operation to wrap - accepts signal for middleware injection
   * @param normalizedPolicy The normalized resilience policy with all defaults applied
   * @param compositionOrder The order to compose resilience patterns (e.g., 'retry-cb-timeout')
   * @param signal Abort signal for cancellation
   * @param context Optional invocation context for key derivation
   * @returns The wrapped operation
   */
  applyNormalizedPolicy?<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    normalizedPolicy: ResiliencePolicy,
    compositionOrder: CompositionOrder,
    signal?: AbortSignal,
    context?: ResilienceInvocationContext,
  ): Promise<T>
}
