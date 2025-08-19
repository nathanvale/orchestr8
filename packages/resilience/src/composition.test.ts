/**
 * Tests for resilience pattern composition engine
 */

import { describe, expect, it, vi } from 'vitest'

import type {
  NormalizedResilienceConfig,
  ResilienceContext,
} from './types.js'

import { ResilienceComposer } from './composition.js'
import { CircuitBreakerOpenError } from './errors.js'

describe('ResilienceComposer', () => {
  describe('validation', () => {
    it('should accept retry-cb-timeout composition order', () => {
      const composer = new ResilienceComposer()
      const config: NormalizedResilienceConfig = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 100,
          maxDelay: 1000,
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTime: 30000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
        timeout: { duration: 5000 },
      }

      expect(() => {
        composer.compose(config, 'retry-cb-timeout')
      }).not.toThrow()
    })

    it('should accept timeout-cb-retry composition order', () => {
      const composer = new ResilienceComposer()
      const config: NormalizedResilienceConfig = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 100,
          maxDelay: 1000,
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTime: 30000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
        timeout: { duration: 5000 },
      }

      expect(() => {
        composer.compose(config, 'timeout-cb-retry')
      }).not.toThrow()
    })

    it('should reject unsupported composition orders', () => {
      const composer = new ResilienceComposer()
      const config: NormalizedResilienceConfig = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 100,
          maxDelay: 1000,
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTime: 30000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
        timeout: { duration: 5000 },
      }

      // Test various invalid orders
      const invalidOrders = [
        'cb-retry-timeout',
        'cb-timeout-retry',
        'timeout-retry-cb',
        'retry-timeout-cb',
        'invalid-order',
        'retry',
        'cb',
        'timeout',
      ]

      for (const order of invalidOrders) {
        expect(() => {
          composer.compose(config, order as 'retry-cb-timeout')
        }).toThrow(/Unsupported composition order/)
      }
    })

    it('should skip missing patterns while preserving order', () => {
      const composer = new ResilienceComposer()

      // Only retry and timeout (no circuit breaker)
      const config: NormalizedResilienceConfig = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 100,
          maxDelay: 1000,
        },
        timeout: { duration: 5000 },
      }

      expect(() => {
        composer.compose(config, 'retry-cb-timeout')
      }).not.toThrow()
    })

    it('should handle single pattern configurations', () => {
      const composer = new ResilienceComposer()

      // Only timeout
      const config: NormalizedResilienceConfig = {
        timeout: { duration: 5000 },
      }

      expect(() => {
        composer.compose(config, 'retry-cb-timeout')
      }).not.toThrow()
    })

    it('should handle empty configuration', async () => {
      const composer = new ResilienceComposer()
      const config: NormalizedResilienceConfig = {}

      const middleware = composer.compose(config, 'retry-cb-timeout')
      expect(middleware).toBeDefined()

      // Should be a pass-through
      const operation = vi.fn().mockResolvedValue('result')
      const result = await middleware(operation, undefined)
      expect(result).toBe('result')
      expect(operation).toHaveBeenCalledOnce()
    })
  })

  describe('middleware chain execution', () => {
    it('should execute patterns in retry-cb-timeout order', async () => {
      const composer = new ResilienceComposer()
      const executionOrder: string[] = []

      // Mock implementations that track execution order
      composer.setRetryWrapper(async (op, config, context) => {
        executionOrder.push('retry-start')
        try {
          const result = await op(context?.signal)
          executionOrder.push('retry-end')
          return result
        } catch (error) {
          executionOrder.push('retry-error')
          throw error
        }
      })

      composer.setCircuitBreakerWrapper(async (op, config, context) => {
        executionOrder.push('cb-start')
        try {
          const result = await op(context?.signal)
          executionOrder.push('cb-end')
          return result
        } catch (error) {
          executionOrder.push('cb-error')
          throw error
        }
      })

      composer.setTimeoutWrapper(async (op, config, context) => {
        executionOrder.push('timeout-start')
        try {
          const result = await op(context?.signal)
          executionOrder.push('timeout-end')
          return result
        } catch (error) {
          executionOrder.push('timeout-error')
          throw error
        }
      })

      const config: NormalizedResilienceConfig = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 100,
          maxDelay: 1000,
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTime: 30000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
        timeout: { duration: 5000 },
      }

      const middleware = composer.compose(config, 'retry-cb-timeout')
      const operation = vi.fn().mockResolvedValue('success')

      await middleware(operation, undefined)

      // Verify order: retry wraps cb wraps timeout wraps operation
      expect(executionOrder).toEqual([
        'retry-start',
        'cb-start',
        'timeout-start',
        'timeout-end',
        'cb-end',
        'retry-end',
      ])
    })

    it('should execute patterns in timeout-cb-retry order', async () => {
      const composer = new ResilienceComposer()
      const executionOrder: string[] = []

      // Mock implementations that track execution order
      composer.setRetryWrapper(async (op, config, context) => {
        executionOrder.push('retry-start')
        try {
          const result = await op(context?.signal)
          executionOrder.push('retry-end')
          return result
        } catch (error) {
          executionOrder.push('retry-error')
          throw error
        }
      })

      composer.setCircuitBreakerWrapper(async (op, config, context) => {
        executionOrder.push('cb-start')
        try {
          const result = await op(context?.signal)
          executionOrder.push('cb-end')
          return result
        } catch (error) {
          executionOrder.push('cb-error')
          throw error
        }
      })

      composer.setTimeoutWrapper(async (op, config, context) => {
        executionOrder.push('timeout-start')
        try {
          const result = await op(context?.signal)
          executionOrder.push('timeout-end')
          return result
        } catch (error) {
          executionOrder.push('timeout-error')
          throw error
        }
      })

      const config: NormalizedResilienceConfig = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 100,
          maxDelay: 1000,
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTime: 30000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
        timeout: { duration: 5000 },
      }

      const middleware = composer.compose(config, 'timeout-cb-retry')
      const operation = vi.fn().mockResolvedValue('success')

      await middleware(operation, undefined)

      // Verify order: timeout wraps cb wraps retry wraps operation
      expect(executionOrder).toEqual([
        'timeout-start',
        'cb-start',
        'retry-start',
        'retry-end',
        'cb-end',
        'timeout-end',
      ])
    })

    it('should propagate context through all layers', async () => {
      const composer = new ResilienceComposer()
      const contextCaptures: Array<ResilienceContext | undefined> = []

      composer.setRetryWrapper(async (op, config, context) => {
        contextCaptures.push(context)
        return op(context?.signal)
      })

      composer.setCircuitBreakerWrapper(async (op, config, context) => {
        contextCaptures.push(context)
        return op(context?.signal)
      })

      composer.setTimeoutWrapper(async (op, config, context) => {
        contextCaptures.push(context)
        return op(context?.signal)
      })

      const config: NormalizedResilienceConfig = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 100,
          maxDelay: 1000,
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTime: 30000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
        timeout: { duration: 5000 },
      }

      const middleware = composer.compose(config, 'retry-cb-timeout')
      const operation = vi.fn().mockResolvedValue('success')
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        correlationId: 'correlation-789',
      }

      await middleware(operation, context)

      // All layers should receive the same context
      expect(contextCaptures).toHaveLength(3)
      expect(contextCaptures[0]).toEqual(context)
      expect(contextCaptures[1]).toEqual(context)
      expect(contextCaptures[2]).toEqual(context)
    })

    it('should propagate errors correctly through layers', async () => {
      const composer = new ResilienceComposer()
      const errorCaptures: Array<unknown> = []

      composer.setRetryWrapper(async (op, config, context) => {
        try {
          return await op(context?.signal)
        } catch (error) {
          errorCaptures.push({ layer: 'retry', error })
          throw error
        }
      })

      composer.setCircuitBreakerWrapper(async (op, config, context) => {
        try {
          return await op(context?.signal)
        } catch (error) {
          errorCaptures.push({ layer: 'cb', error })
          throw error
        }
      })

      composer.setTimeoutWrapper(async (op, config, context) => {
        try {
          return await op(context?.signal)
        } catch (error) {
          errorCaptures.push({ layer: 'timeout', error })
          throw error
        }
      })

      const config: NormalizedResilienceConfig = {
        retry: {
          maxAttempts: 1,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 100,
          maxDelay: 1000,
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTime: 30000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
        timeout: { duration: 5000 },
      }

      const middleware = composer.compose(config, 'retry-cb-timeout')
      const testError = new Error('Operation failed')
      const operation = vi.fn().mockRejectedValue(testError)

      await expect(middleware(operation, undefined)).rejects.toThrow(
        'Operation failed',
      )

      // Error should propagate outward through layers
      expect(errorCaptures).toHaveLength(3)
      expect(errorCaptures[0]).toEqual({ layer: 'timeout', error: testError })
      expect(errorCaptures[1]).toEqual({ layer: 'cb', error: testError })
      expect(errorCaptures[2]).toEqual({ layer: 'retry', error: testError })
    })

    it('should preserve error stack traces', async () => {
      const composer = new ResilienceComposer()

      const config: NormalizedResilienceConfig = {
        retry: {
          maxAttempts: 1,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 100,
          maxDelay: 1000,
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTime: 30000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
        timeout: { duration: 5000 },
      }

      const middleware = composer.compose(config, 'retry-cb-timeout')
      const originalError = new Error('Original error')
      const originalStack = originalError.stack
      const operation = vi.fn().mockRejectedValue(originalError)

      try {
        await middleware(operation, undefined)
      } catch (error) {
        expect(error).toBe(originalError)
        expect((error as Error).stack).toBe(originalStack)
      }
    })
  })

  describe('pattern-specific behavior', () => {
    it('should skip retry on CircuitBreakerOpenError', async () => {
      const composer = new ResilienceComposer()
      let retryAttempts = 0

      composer.setRetryWrapper(async (op, config, context) => {
        // Should detect CircuitBreakerOpenError and not retry
        try {
          retryAttempts++
          return await op(context?.signal)
        } catch (error) {
          if (error instanceof CircuitBreakerOpenError) {
            throw error // Don't retry on circuit breaker open
          }
          // Would normally retry here
          retryAttempts++
          throw error
        }
      })

      const config: NormalizedResilienceConfig = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 100,
          maxDelay: 1000,
        },
      }

      const middleware = composer.compose(config, 'retry-cb-timeout')
      const cbError = new CircuitBreakerOpenError(
        'Circuit is open',
        'test-key',
        new Date(Date.now() + 30000),
        5,
      )
      const operation = vi.fn().mockRejectedValue(cbError)

      await expect(middleware(operation, undefined)).rejects.toThrow(
        CircuitBreakerOpenError,
      )
      expect(retryAttempts).toBe(1) // Should not retry
    })

    it('should respect AbortSignal cancellation', async () => {
      const composer = new ResilienceComposer()

      composer.setTimeoutWrapper(async (op, config, context) => {
        if (context?.signal?.aborted) {
          throw new Error('Operation was cancelled')
        }
        return op(context?.signal)
      })

      const config: NormalizedResilienceConfig = {
        timeout: { duration: 5000 },
      }

      const middleware = composer.compose(config, 'retry-cb-timeout')
      const controller = new AbortController()
      controller.abort()

      const operation = vi.fn().mockResolvedValue('should not reach')
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        signal: controller.signal,
      }

      await expect(middleware(operation, context)).rejects.toThrow(
        'Operation was cancelled',
      )
      expect(operation).not.toHaveBeenCalled()
    })
  })
})
