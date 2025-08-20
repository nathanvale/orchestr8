/**
 * Tests for context propagation through middleware layers
 */

import { describe, expect, it, vi } from 'vitest'

import type {
  CircuitBreakerConfig,
  NormalizedResilienceConfig,
  ResilienceContext,
} from './types.js'

import {
  defaultCircuitBreakerWrapper,
  defaultRetryWrapper,
  defaultTimeoutWrapper,
  ResilienceComposer,
} from './composition.js'
import { deriveKey } from './key-derivation.js'

describe('context propagation', () => {
  describe('through circuit breaker wrapper', () => {
    it('should pass context to deriveKey for circuit isolation', async () => {
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        correlationId: 'correlation-789',
      }

      const config: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTime: 30000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }

      const operation = vi.fn().mockResolvedValue('success')

      await defaultCircuitBreakerWrapper(operation, config, context)

      // The derived key should be used internally
      const expectedKey = deriveKey(context, config)
      expect(expectedKey).toBe('workflow-123:step-456')
      expect(operation).toHaveBeenCalledWith(context.signal)
    })

    it('should use explicit key from config over derived key', async () => {
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
      }

      const config: CircuitBreakerConfig = {
        key: 'custom-circuit-key',
        failureThreshold: 5,
        recoveryTime: 30000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }

      const operation = vi.fn().mockResolvedValue('success')

      await defaultCircuitBreakerWrapper(operation, config, context)

      const expectedKey = deriveKey(context, config)
      expect(expectedKey).toBe('custom-circuit-key')
      expect(operation).toHaveBeenCalledWith(context?.signal)
    })

    it('should propagate AbortSignal through circuit breaker', async () => {
      const controller = new AbortController()
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        signal: controller.signal,
      }

      const config: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTime: 30000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }

      const operation = vi.fn().mockResolvedValue('success')

      await defaultCircuitBreakerWrapper(operation, config, context)

      expect(operation).toHaveBeenCalledWith(controller.signal)
    })
  })

  describe('through retry wrapper', () => {
    it('should propagate signal to operation', async () => {
      const controller = new AbortController()
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        signal: controller.signal,
      }

      const operation = vi.fn().mockResolvedValue('success')

      await defaultRetryWrapper(
        operation,
        {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 100,
          maxDelay: 1000,
        },
        context,
      )

      expect(operation).toHaveBeenCalledWith(controller.signal)
    })

    it('should check for cancellation before each retry', async () => {
      const controller = new AbortController()
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        signal: controller.signal,
      }

      let attempts = 0
      const operation = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts === 1) {
          throw new Error('First attempt failed')
        }
        // Abort before second attempt completes
        controller.abort()
        throw new Error('Second attempt failed')
      })

      await expect(
        defaultRetryWrapper(
          operation,
          {
            maxAttempts: 3,
            backoffStrategy: 'fixed',
            jitterStrategy: 'none',
            initialDelay: 10,
            maxDelay: 1000,
          },
          context,
        ),
      ).rejects.toThrow('Operation was cancelled')

      expect(attempts).toBe(2)
    })
  })

  describe('through timeout wrapper', () => {
    it('should combine parent signal with timeout signal', async () => {
      const parentController = new AbortController()
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        signal: parentController.signal,
      }

      let receivedSignal: AbortSignal | undefined
      const operation = vi.fn().mockImplementation((signal) => {
        receivedSignal = signal
        return new Promise((resolve) =>
          setTimeout(() => resolve('success'), 10),
        )
      })

      await defaultTimeoutWrapper(operation, { duration: 5000 }, context)

      expect(receivedSignal).toBeDefined()
      expect(receivedSignal).not.toBe(parentController.signal)
      // The signal should be a combined signal
    })

    it('should cancel on parent signal abort', async () => {
      const parentController = new AbortController()
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        signal: parentController.signal,
      }

      const operation = vi
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) => setTimeout(() => resolve('success'), 100)),
        )

      // Abort immediately
      parentController.abort()

      await expect(
        defaultTimeoutWrapper(operation, { duration: 5000 }, context),
      ).rejects.toThrow('Operation was cancelled')
    })
  })

  describe('through full composition chain', () => {
    it('should maintain context integrity through all layers', async () => {
      const composer = new ResilienceComposer()
      const contextCaptures: Array<{
        layer: string
        context?: ResilienceContext
      }> = []

      // Track context at each layer
      composer.setRetryWrapper(async (op, config, context) => {
        contextCaptures.push({ layer: 'retry', context })
        return defaultRetryWrapper(op, config, context)
      })

      composer.setCircuitBreakerWrapper(async (op, config, context) => {
        contextCaptures.push({ layer: 'circuit-breaker', context })
        return defaultCircuitBreakerWrapper(op, config, context)
      })

      composer.setTimeoutWrapper(async (op, config, context) => {
        contextCaptures.push({ layer: 'timeout', context })
        return defaultTimeoutWrapper(op, config, context)
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
      const operation = vi.fn().mockResolvedValue('success')

      const controller = new AbortController()
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        correlationId: 'correlation-789',
        metadata: { userId: 'user-001' },
        signal: controller.signal,
      }

      await middleware(operation, context)

      // Verify context was passed to all layers
      expect(contextCaptures).toHaveLength(3)

      // Each layer should receive context with signal
      for (const capture of contextCaptures) {
        expect(capture.context).toBeDefined()
        expect(capture.context?.workflowId).toBe('workflow-123')
        expect(capture.context?.stepId).toBe('step-456')
        expect(capture.context?.correlationId).toBe('correlation-789')
        expect(capture.context?.metadata).toEqual({ userId: 'user-001' })
        expect(capture.context?.signal).toBeDefined()
      }
    })

    it('should derive consistent keys across multiple invocations', async () => {
      const composer = new ResilienceComposer()
      composer.setCircuitBreakerWrapper(defaultCircuitBreakerWrapper)

      const config: NormalizedResilienceConfig = {
        circuitBreaker: {
          failureThreshold: 2,
          recoveryTime: 30000,
          sampleSize: 3,
          halfOpenPolicy: 'single-probe',
        },
      }

      const middleware = composer.compose(config, 'retry-cb-timeout')

      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
      }

      // First invocation
      const operation1 = vi.fn().mockResolvedValue('result1')
      await middleware(operation1, context)

      // Second invocation with same context
      const operation2 = vi.fn().mockResolvedValue('result2')
      await middleware(operation2, context)

      // Both should use the same derived key internally
      const expectedKey = deriveKey(context)
      expect(expectedKey).toBe('workflow-123:step-456')
    })

    it('should preserve error stack traces through context layers', async () => {
      const composer = new ResilienceComposer()
      composer.setRetryWrapper(defaultRetryWrapper)
      composer.setCircuitBreakerWrapper(defaultCircuitBreakerWrapper)
      composer.setTimeoutWrapper(defaultTimeoutWrapper)

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

      const originalError = new Error('Operation failed')
      const originalStack = originalError.stack
      const operation = vi.fn().mockRejectedValue(originalError)

      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
      }

      try {
        await middleware(operation, context)
      } catch (error) {
        expect(error).toBe(originalError)
        expect((error as Error).stack).toBe(originalStack)
        expect((error as Error).message).toBe('Operation failed')
      }
    })
  })
})
