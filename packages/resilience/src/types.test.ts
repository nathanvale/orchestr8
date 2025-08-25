import { describe, expect, it } from 'vitest'

import type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  NormalizedResilienceConfig,
  ResilienceContext,
  ResilientOperation,
  RetryConfig,
  TimeoutConfig,
} from './types.js'

describe('Resilience Types', () => {
  describe('ResilientOperation', () => {
    it('accepts operations with optional signal', () => {
      const operation: ResilientOperation<string> = async (signal) => {
        if (signal?.aborted) {
          throw new Error('Aborted')
        }
        return 'success'
      }

      expect(operation).toBeDefined()
      expect(typeof operation).toBe('function')
    })

    it('supports generic return types', () => {
      const numberOp: ResilientOperation<number> = async () => 42
      const objectOp: ResilientOperation<{ id: string }> = async () => ({
        id: '123',
      })

      expect(numberOp).toBeDefined()
      expect(objectOp).toBeDefined()
    })
  })

  describe('RetryConfig', () => {
    it('defines complete retry configuration', () => {
      const config: RetryConfig = {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        jitterStrategy: 'full',
        initialDelay: 100,
        maxDelay: 5000,
        retryOn: (error) =>
          !(error instanceof Error && error.message === 'fatal'),
      }

      expect(config.maxAttempts).toBe(3)
      expect(config.backoffStrategy).toBe('exponential')
      expect(config.jitterStrategy).toBe('full')
      expect(config.initialDelay).toBe(100)
      expect(config.maxDelay).toBe(5000)
      expect(config.retryOn?.(new Error('transient'))).toBe(true)
      expect(config.retryOn?.(new Error('fatal'))).toBe(false)
    })

    it('allows minimal configuration without retryOn', () => {
      const config: RetryConfig = {
        maxAttempts: 2,
        backoffStrategy: 'fixed',
        jitterStrategy: 'none',
        initialDelay: 500,
        maxDelay: 500,
      }

      expect(config.retryOn).toBeUndefined()
    })
  })

  describe('CircuitBreakerConfig', () => {
    it('defines complete circuit breaker configuration', () => {
      const config: CircuitBreakerConfig = {
        key: 'service:operation',
        failureThreshold: 5,
        recoveryTime: 30000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }

      expect(config.key).toBe('service:operation')
      expect(config.failureThreshold).toBe(5)
      expect(config.recoveryTime).toBe(30000)
      expect(config.sampleSize).toBe(10)
      expect(config.halfOpenPolicy).toBe('single-probe')
    })

    it('allows configuration without explicit key', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 10000,
        sampleSize: 10,
        halfOpenPolicy: 'gradual',
      }

      expect(config.key).toBeUndefined()
    })
  })

  describe('TimeoutConfig', () => {
    it('defines timeout configuration with operation name', () => {
      const config: TimeoutConfig = {
        duration: 5000,
        operationName: 'fetchUserData',
      }

      expect(config.duration).toBe(5000)
      expect(config.operationName).toBe('fetchUserData')
    })

    it('allows configuration without operation name', () => {
      const config: TimeoutConfig = {
        duration: 3000,
      }

      expect(config.operationName).toBeUndefined()
    })
  })

  describe('ResilienceContext', () => {
    it('extends ResilienceInvocationContext with signal', () => {
      const controller = new AbortController()
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        correlationId: 'correlation-789',
        metadata: { userId: 'user-001' },
        signal: controller.signal,
      }

      expect(context.workflowId).toBe('workflow-123')
      expect(context.stepId).toBe('step-456')
      expect(context.correlationId).toBe('correlation-789')
      expect(context.metadata).toEqual({ userId: 'user-001' })
      expect(context.signal).toBe(controller.signal)
    })

    it('allows context without optional fields', () => {
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
      }

      expect(context.correlationId).toBeUndefined()
      expect(context.metadata).toBeUndefined()
      expect(context.signal).toBeUndefined()
    })
  })

  describe('CircuitBreakerState', () => {
    it('defines complete circuit breaker state', () => {
      const state: CircuitBreakerState = {
        status: 'open',
        slidingWindow: [true, false, false, true, false],
        windowIndex: 2,
        windowSize: 5,
        lastFailureTime: Date.now(),
        nextHalfOpenTime: Date.now() + 30000,
        probeInProgress: false,
        lastAccessTime: Date.now(),
      }

      expect(state.status).toBe('open')
      expect(state.slidingWindow).toHaveLength(5)
      expect(state.windowIndex).toBe(2)
      expect(state.windowSize).toBe(5)
      expect(state.lastFailureTime).toBeDefined()
      expect(state.nextHalfOpenTime).toBeDefined()
      expect(state.probeInProgress).toBe(false)
    })

    it('supports all circuit states', () => {
      const closedState: CircuitBreakerState = {
        status: 'closed',
        slidingWindow: [],
        windowIndex: 0,
        windowSize: 0,
        probeInProgress: false,
      }

      const halfOpenState: CircuitBreakerState = {
        status: 'half-open',
        slidingWindow: [true, true, false],
        windowIndex: 0,
        windowSize: 3,
        probeInProgress: true,
      }

      expect(closedState.status).toBe('closed')
      expect(halfOpenState.status).toBe('half-open')
    })
  })

  describe('NormalizedResilienceConfig', () => {
    it('defines complete normalized configuration', () => {
      const config: NormalizedResilienceConfig = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          jitterStrategy: 'full',
          initialDelay: 100,
          maxDelay: 5000,
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTime: 30000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
        timeout: {
          duration: 10000,
          operationName: 'apiCall',
        },
      }

      expect(config.retry).toBeDefined()
      expect(config.circuitBreaker).toBeDefined()
      expect(config.timeout).toBeDefined()
    })

    it('allows partial configuration', () => {
      const retryOnly: NormalizedResilienceConfig = {
        retry: {
          maxAttempts: 2,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 1000,
          maxDelay: 1000,
        },
      }

      const timeoutOnly: NormalizedResilienceConfig = {
        timeout: {
          duration: 5000,
        },
      }

      expect(retryOnly.retry).toBeDefined()
      expect(retryOnly.circuitBreaker).toBeUndefined()
      expect(timeoutOnly.timeout).toBeDefined()
      expect(timeoutOnly.retry).toBeUndefined()
    })

    it('allows empty configuration', () => {
      const empty: NormalizedResilienceConfig = {}

      expect(empty.retry).toBeUndefined()
      expect(empty.circuitBreaker).toBeUndefined()
      expect(empty.timeout).toBeUndefined()
    })
  })
})
