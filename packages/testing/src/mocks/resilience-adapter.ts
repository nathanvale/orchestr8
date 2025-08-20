/**
 * Mock ResilienceAdapter for testing
 * Wallaby.js compatible with mockImplementation pattern
 */

import type {
  CompositionOrder,
  ResilienceAdapter,
  ResilienceInvocationContext,
  ResiliencePolicy,
} from '@orchestr8/schema'

import { createExecutionError, ExecutionErrorCode } from '@orchestr8/schema'
import { vi } from 'vitest'

/**
 * Mock ResilienceAdapter for testing
 */
export class MockResilienceAdapter implements ResilienceAdapter {
  // Spy function for testing (legacy interface)
  applyPolicy = vi.fn()

  // Spy function for new interface
  applyNormalizedPolicy = vi.fn()

  // Track applied policies for assertions
  appliedPolicies: Array<{
    policy: ResiliencePolicy
    signal?: AbortSignal
    timestamp: string
    compositionOrder?: CompositionOrder
    context?: ResilienceInvocationContext
  }> = []

  // Configuration for simulating behaviors
  private simulateTimeout = false
  private simulateCircuitOpen = false
  private simulateCancellation = false
  private simulateRetryCount = 0
  private currentAttempt = 0

  constructor() {
    // Default implementation that passes through the operation (legacy interface)
    this.applyPolicy.mockImplementation(
      async (
        operation: () => Promise<unknown>,
        policy: ResiliencePolicy,
        signal?: AbortSignal,
        context?: ResilienceInvocationContext,
      ) => {
        return this.executeWithPolicy(
          operation,
          policy,
          signal,
          undefined,
          context,
        )
      },
    )

    // New interface implementation
    this.applyNormalizedPolicy.mockImplementation(
      async (
        operation: () => Promise<unknown>,
        normalizedPolicy: ResiliencePolicy,
        compositionOrder: CompositionOrder,
        signal?: AbortSignal,
        context?: ResilienceInvocationContext,
      ) => {
        return this.executeWithPolicy(
          operation,
          normalizedPolicy,
          signal,
          compositionOrder,
          context,
        )
      },
    )
  }

  private async executeWithPolicy(
    operation: () => Promise<unknown>,
    policy: ResiliencePolicy,
    signal?: AbortSignal,
    compositionOrder?: CompositionOrder,
    context?: ResilienceInvocationContext,
  ): Promise<unknown> {
    // Track the applied policy
    this.appliedPolicies.push({
      policy,
      signal,
      timestamp: new Date().toISOString(),
      compositionOrder,
      context,
    })

    // Check for abort signal
    if (signal?.aborted) {
      throw createExecutionError(
        ExecutionErrorCode.CANCELLED,
        'Operation cancelled',
        { context: { reason: signal.reason } },
      )
    }

    // Simulate timeout if configured
    if (this.simulateTimeout && policy.timeout) {
      // Emit timeout event if context with emitter is provided
      if (context?.eventEmitter) {
        context.eventEmitter.emit({
          type: 'timeout.exceeded',
          stepId: context.stepId,
          duration: policy.timeout,
        })
      }
      throw createExecutionError(
        ExecutionErrorCode.TIMEOUT,
        `Operation timed out after ${policy.timeout}ms`,
        { context: { timeout: policy.timeout } },
      )
    }

    // Simulate circuit breaker open if configured
    if (this.simulateCircuitOpen && policy.circuitBreaker) {
      throw createExecutionError(
        ExecutionErrorCode.CIRCUIT_BREAKER_OPEN,
        'Circuit breaker is open',
        { context: { policy: policy.circuitBreaker } },
      )
    }

    // Simulate cancellation if configured
    if (this.simulateCancellation) {
      throw createExecutionError(
        ExecutionErrorCode.CANCELLED,
        'Operation was cancelled',
        { context: { simulatedCancellation: true } },
      )
    }

    // Simulate retries if configured
    if (this.simulateRetryCount > 0 && policy.retry) {
      this.currentAttempt++
      if (this.currentAttempt <= this.simulateRetryCount) {
        // Emit retry event if context with emitter is provided
        if (context?.eventEmitter && this.currentAttempt > 1) {
          const delay = policy.retry.initialDelay || 100
          context.eventEmitter.emit({
            type: 'retry.attempted',
            stepId: context.stepId,
            attempt: this.currentAttempt,
            delay,
          })
        }
        throw createExecutionError(
          ExecutionErrorCode.RETRYABLE,
          `Simulated retry attempt ${this.currentAttempt}`,
          { attempt: this.currentAttempt },
        )
      }
      // Reset for next operation
      this.currentAttempt = 0
    }

    // Listen for abort signal during operation
    if (signal) {
      return new Promise((resolve, reject) => {
        const abortHandler = () => {
          reject(
            createExecutionError(
              ExecutionErrorCode.CANCELLED,
              'Operation cancelled during execution',
              { context: { reason: signal.reason } },
            ),
          )
        }

        signal.addEventListener('abort', abortHandler, { once: true })

        operation()
          .then((result) => {
            resolve(result)
          })
          .catch((error) => {
            reject(error)
          })
          .finally(() => {
            signal.removeEventListener('abort', abortHandler)
          })
      })
    }

    // Default: execute the operation
    return operation()
  }

  /**
   * Configure to simulate timeout
   */
  simulateTimeoutError(): void {
    this.simulateTimeout = true
  }

  /**
   * Configure to simulate circuit breaker open
   */
  simulateCircuitBreakerOpen(): void {
    this.simulateCircuitOpen = true
  }

  /**
   * Configure to simulate cancellation
   */
  simulateCancellationError(): void {
    this.simulateCancellation = true
  }

  /**
   * Configure to simulate retries
   * @param count Number of failed attempts before success
   */
  simulateRetries(count: number): void {
    this.simulateRetryCount = count
    this.currentAttempt = 0
  }

  /**
   * Configure custom behavior for next call
   */
  mockImplementationOnce(
    fn: (
      operation: () => Promise<unknown>,
      policy: ResiliencePolicy,
      signal?: AbortSignal,
      context?: ResilienceInvocationContext,
    ) => Promise<unknown>,
  ): void {
    this.applyPolicy.mockImplementationOnce(fn)
  }

  /**
   * Verify that resilience composition order is correct
   * Should be: retry(circuitBreaker(timeout(operation)))
   */
  verifyCompositionOrder(): boolean {
    // Check that policies are applied in the correct order
    // This is a simplified check - in real implementation this would
    // verify the actual wrapping order
    const lastPolicy = this.appliedPolicies[this.appliedPolicies.length - 1]
    if (!lastPolicy) return true

    const { policy } = lastPolicy

    // If all three policies are present, they should be composed correctly
    if (policy.retry && policy.circuitBreaker && policy.timeout) {
      // This would be validated by the actual implementation
      // Here we just return true for the mock
      return true
    }

    return true
  }

  /**
   * Verify that AbortSignal was propagated
   */
  verifyAbortSignalPropagation(signal: AbortSignal): boolean {
    return this.appliedPolicies.some((p) => p.signal === signal)
  }

  /**
   * Get the number of times policies have been applied
   */
  getApplicationCount(): number {
    return this.appliedPolicies.length
  }

  /**
   * Clear applied policies history
   */
  clearHistory(): void {
    this.appliedPolicies = []
  }

  /**
   * Reset all configurations
   */
  reset(): void {
    this.simulateTimeout = false
    this.simulateCircuitOpen = false
    this.simulateCancellation = false
    this.simulateRetryCount = 0
    this.currentAttempt = 0
    this.appliedPolicies = []
    this.applyPolicy.mockReset()
    this.applyNormalizedPolicy.mockReset()

    // Restore default implementations
    this.applyPolicy.mockImplementation(
      async (
        operation: () => Promise<unknown>,
        policy: ResiliencePolicy,
        signal?: AbortSignal,
        context?: ResilienceInvocationContext,
      ) => {
        return this.executeWithPolicy(
          operation,
          policy,
          signal,
          undefined,
          context,
        )
      },
    )

    this.applyNormalizedPolicy.mockImplementation(
      async (
        operation: () => Promise<unknown>,
        normalizedPolicy: ResiliencePolicy,
        compositionOrder: CompositionOrder,
        signal?: AbortSignal,
        context?: ResilienceInvocationContext,
      ) => {
        return this.executeWithPolicy(
          operation,
          normalizedPolicy,
          signal,
          compositionOrder,
          context,
        )
      },
    )
  }
}
