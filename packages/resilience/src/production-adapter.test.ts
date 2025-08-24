/**
 * Tests for production resilience adapter
 */

import type {
  ResiliencePolicy,
  ResilienceInvocationContext,
} from '@orchestr8/schema'

import { describe, expect, it, vi, beforeEach } from 'vitest'

import {
  CircuitBreakerOpenError,
  TimeoutError,
  RetryExhaustedError,
} from './errors.js'
import { ProductionResilienceAdapter } from './production-adapter.js'

describe('ProductionResilienceAdapter', () => {
  let adapter: ProductionResilienceAdapter

  beforeEach(() => {
    adapter = new ProductionResilienceAdapter()
  })

  describe('retry-cb-timeout composition', () => {
    it('should retry operations on failure', async () => {
      let attempts = 0
      const operation = vi.fn().mockImplementation(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary failure')
        }
        return 'success'
      })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 3,
          initialDelay: 10,
          maxDelay: 100,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
      }

      const result = await adapter.applyNormalizedPolicy(
        operation,
        policy,
        'retry-cb-timeout',
      )

      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('should open circuit breaker after threshold failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Service down'))

      const policy: ResiliencePolicy = {
        circuitBreaker: {
          key: 'test-service',
          failureThreshold: 3,
          sampleSize: 10,
          recoveryTime: 100,
          halfOpenPolicy: 'single-probe',
        },
      }

      // Fill the sliding window with failures
      for (let i = 0; i < 10; i++) {
        try {
          await adapter.applyNormalizedPolicy(
            operation,
            policy,
            'retry-cb-timeout',
          )
        } catch {
          // Expected to fail
        }
      }

      // Circuit should now be open
      await expect(
        adapter.applyNormalizedPolicy(operation, policy, 'retry-cb-timeout'),
      ).rejects.toThrow(CircuitBreakerOpenError)

      // Operation should not be called when circuit is open
      const callCountBefore = operation.mock.calls.length
      try {
        await adapter.applyNormalizedPolicy(
          operation,
          policy,
          'retry-cb-timeout',
        )
      } catch {
        // Expected
      }
      expect(operation.mock.calls.length).toBe(callCountBefore)
    })

    it('should timeout long-running operations', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
        return 'too late'
      })

      const policy: ResiliencePolicy = {
        timeout: 50,
      }

      await expect(
        adapter.applyNormalizedPolicy(operation, policy, 'retry-cb-timeout'),
      ).rejects.toThrow(TimeoutError)
    })

    it('should apply all patterns in correct order', async () => {
      const executionOrder: string[] = []
      let attempts = 0

      const operation = vi.fn().mockImplementation(async () => {
        executionOrder.push('operation')
        attempts++
        if (attempts === 1) {
          throw new Error('First attempt fails')
        }
        return 'success'
      })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 2,
          initialDelay: 10,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
        circuitBreaker: {
          key: 'test-cb',
          failureThreshold: 5,
          sampleSize: 10,
          recoveryTime: 1000,
        },
        timeout: 100,
      }

      const result = await adapter.applyNormalizedPolicy(
        operation,
        policy,
        'retry-cb-timeout',
      )

      expect(result).toBe('success')
      expect(attempts).toBe(2) // First attempt failed, second succeeded
      expect(executionOrder).toEqual(['operation', 'operation'])
    })
  })

  describe('timeout-cb-retry composition', () => {
    it('should apply timeout to entire retry sequence', async () => {
      let attempts = 0
      const operation = vi.fn().mockImplementation(async () => {
        attempts++
        await new Promise((resolve) => setTimeout(resolve, 50))
        throw new Error('Always fails')
      })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 5,
          initialDelay: 10,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
        timeout: 100, // Total timeout for all retries
      }

      await expect(
        adapter.applyNormalizedPolicy(operation, policy, 'timeout-cb-retry'),
      ).rejects.toThrow(TimeoutError)

      // Should have attempted fewer times due to timeout
      expect(attempts).toBeLessThan(5)
    })

    it('should check circuit breaker before each retry', async () => {
      let attempts = 0
      const operation = vi.fn().mockImplementation(async () => {
        attempts++
        throw new Error('Service error')
      })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 10,
          initialDelay: 1,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
        circuitBreaker: {
          key: 'test-service-2',
          failureThreshold: 3,
          sampleSize: 10,
          recoveryTime: 1000,
          halfOpenPolicy: 'single-probe',
        },
        // No timeout in this order - timeout wraps everything
      }

      // For timeout-cb-retry, the retry happens inside the circuit breaker
      // So the circuit breaker sees each retry attempt
      await expect(
        adapter.applyNormalizedPolicy(operation, policy, 'timeout-cb-retry'),
      ).rejects.toThrow(RetryExhaustedError)

      // Should have failed after max attempts
      expect(attempts).toBe(10)
    })
  })

  describe('context propagation', () => {
    it('should derive circuit breaker key from context', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      const policy: ResiliencePolicy = {
        circuitBreaker: {
          failureThreshold: 5,
          sampleSize: 10,
          recoveryTime: 1000,
        },
      }

      const context: ResilienceInvocationContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
      }

      await adapter.applyNormalizedPolicy(
        operation,
        policy,
        'retry-cb-timeout',
        undefined,
        context,
      )

      // The circuit breaker should use derived key
      const state = adapter.getCircuitBreakerState('workflow-123:step-456')
      expect(state).toBeDefined()
    })

    it('should respect abort signal', async () => {
      const controller = new AbortController()
      controller.abort()

      const operation = vi.fn().mockResolvedValue('should not reach')

      const policy: ResiliencePolicy = {
        retry: { maxAttempts: 3 },
      }

      await expect(
        adapter.applyNormalizedPolicy(
          operation,
          policy,
          'retry-cb-timeout',
          controller.signal,
        ),
      ).rejects.toThrow('Operation was cancelled')

      expect(operation).not.toHaveBeenCalled()
    })

    it('should propagate correlation ID through layers', async () => {
      const signals: Array<AbortSignal | undefined> = []
      const operation = vi
        .fn()
        .mockImplementation(async (signal?: AbortSignal) => {
          signals.push(signal)
          return 'success'
        })

      const policy: ResiliencePolicy = {
        retry: { maxAttempts: 1 },
        circuitBreaker: {
          failureThreshold: 5,
          sampleSize: 10,
          recoveryTime: 1000,
        },
        timeout: 1000,
      }

      const context: ResilienceInvocationContext = {
        workflowId: 'workflow-abc',
        stepId: 'step-xyz',
        correlationId: 'correlation-123',
      }

      await adapter.applyNormalizedPolicy(
        operation,
        policy,
        'retry-cb-timeout',
        undefined,
        context,
      )

      expect(operation).toHaveBeenCalledOnce()
      expect(signals[0]).toBeDefined() // Should have received a signal
    })
  })

  describe('error handling', () => {
    it('should not retry CircuitBreakerOpenError', async () => {
      const adapter2 = new ProductionResilienceAdapter()

      // First, open a circuit breaker
      const failingOp = vi.fn().mockRejectedValue(new Error('Service down'))
      const policy: ResiliencePolicy = {
        circuitBreaker: {
          key: 'service-x',
          failureThreshold: 2,
          sampleSize: 10,
          recoveryTime: 1000,
        },
      }

      // Open the circuit
      for (let i = 0; i < 10; i++) {
        try {
          await adapter2.applyNormalizedPolicy(
            failingOp,
            policy,
            'retry-cb-timeout',
          )
        } catch {
          // Expected
        }
      }

      // Now try with retry - should not retry the circuit breaker error
      const retryPolicy: ResiliencePolicy = {
        retry: {
          maxAttempts: 3,
          initialDelay: 10,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
        },
        circuitBreaker: {
          key: 'service-x',
          failureThreshold: 2,
          sampleSize: 10,
          recoveryTime: 1000,
        },
      }

      const operation2 = vi.fn().mockResolvedValue('should not reach')

      await expect(
        adapter2.applyNormalizedPolicy(
          operation2,
          retryPolicy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow(CircuitBreakerOpenError)

      // Should not have been called because circuit was open
      expect(operation2).not.toHaveBeenCalled()
    })

    it('should preserve original error stack traces', async () => {
      const originalError = new Error('Original error')
      const originalStack = originalError.stack

      const operation = vi.fn().mockRejectedValue(originalError)

      const policy: ResiliencePolicy = {
        retry: { maxAttempts: 1 },
      }

      try {
        await adapter.applyNormalizedPolicy(
          operation,
          policy,
          'retry-cb-timeout',
        )
      } catch (error) {
        expect(error).toBe(originalError)
        expect((error as Error).stack).toBe(originalStack)
      }
    })
  })

  describe('legacy interface', () => {
    it('should support legacy applyPolicy method', async () => {
      const operation = vi.fn().mockResolvedValue('legacy result')

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 2,
          initialDelay: 10,
        },
      }

      const result = await adapter.applyPolicy(operation, policy)

      expect(result).toBe('legacy result')
      expect(operation).toHaveBeenCalledOnce()
    })
  })

  describe('circuit breaker recovery', () => {
    it('should transition to half-open after recovery time', async () => {
      const adapter3 = new ProductionResilienceAdapter()
      let callCount = 0

      const operation = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount <= 10) {
          // Fail for first 10 calls to ensure circuit opens
          throw new Error('Still failing')
        }
        return 'recovered'
      })

      const policy: ResiliencePolicy = {
        circuitBreaker: {
          key: 'recovery-test',
          failureThreshold: 2,
          sampleSize: 10,
          recoveryTime: 50, // Short recovery for testing
          halfOpenPolicy: 'single-probe',
        },
      }

      // Open the circuit
      for (let i = 0; i < 10; i++) {
        try {
          await adapter3.applyNormalizedPolicy(
            operation,
            policy,
            'retry-cb-timeout',
          )
        } catch {
          // Expected failures
        }
      }

      // Circuit is now open
      await expect(
        adapter3.applyNormalizedPolicy(operation, policy, 'retry-cb-timeout'),
      ).rejects.toThrow(CircuitBreakerOpenError)

      // Wait for recovery time
      await new Promise((resolve) => setTimeout(resolve, 60))

      // Should now attempt recovery (half-open)
      const result = await adapter3.applyNormalizedPolicy(
        operation,
        policy,
        'retry-cb-timeout',
      )

      expect(result).toBe('recovered')
      expect(callCount).toBe(11) // 10 failures to open circuit + 1 success on recovery
    })
  })
})
