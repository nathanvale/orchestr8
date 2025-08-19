import type { ResiliencePolicy } from '@orchestr8/core'

import { describe, expect, it, vi, beforeEach } from 'vitest'

import { ReferenceResilienceAdapter } from './reference-adapter.js'

describe('ReferenceResilienceAdapter', () => {
  let adapter: ReferenceResilienceAdapter
  let operation: () => Promise<string>
  let operationCallOrder: string[]

  beforeEach(() => {
    adapter = new ReferenceResilienceAdapter()
    operationCallOrder = []
    operation = vi.fn().mockImplementation(async () => {
      operationCallOrder.push('operation-call')
      return 'success'
    })
  })

  describe('legacy applyPolicy interface', () => {
    it('should handle timeout policy', async () => {
      const policy: ResiliencePolicy = {
        timeout: 1000,
      }

      const result = await adapter.applyPolicy(operation, policy)

      expect(result).toBe('success')
      expect(operationCallOrder).toEqual(['operation-call'])
    })

    it('should handle retry policy with defaults', async () => {
      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 2,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 10,
          maxDelay: 10,
        },
      }

      const result = await adapter.applyPolicy(operation, policy)

      expect(result).toBe('success')
      expect(operationCallOrder).toEqual(['operation-call'])
    })

    it('should handle combined retry and timeout', async () => {
      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 2,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 10,
          maxDelay: 10,
        },
        timeout: 1000,
      }

      const result = await adapter.applyPolicy(operation, policy)

      expect(result).toBe('success')
      expect(operationCallOrder).toEqual(['operation-call'])
    })

    it('should retry on failure', async () => {
      let callCount = 0
      const failingOperation = vi.fn().mockImplementation(async () => {
        callCount++
        operationCallOrder.push(`operation-call-${callCount}`)
        if (callCount < 2) {
          throw new Error('temporary failure')
        }
        return 'success'
      })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 1,
          maxDelay: 1,
        },
      }

      const result = await adapter.applyPolicy(failingOperation, policy)

      expect(result).toBe('success')
      expect(operationCallOrder).toEqual([
        'operation-call-1',
        'operation-call-2',
      ])
      expect(callCount).toBe(2)
    })

    it('should timeout operation', async () => {
      const slowOperation = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        operationCallOrder.push('operation-call-slow')
        return 'success'
      })

      const policy: ResiliencePolicy = {
        timeout: 10, // Very short timeout
      }

      await expect(adapter.applyPolicy(slowOperation, policy)).rejects.toThrow(
        'timed out',
      )
      // Operation should not have completed
      expect(operationCallOrder).toEqual([])
    })
  })

  describe('new applyNormalizedPolicy interface', () => {
    it('should handle retry-cb-timeout composition order', async () => {
      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 2,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 1,
          maxDelay: 1,
        },
        timeout: 1000,
      }

      const result = await adapter.applyNormalizedPolicy(
        operation,
        policy,
        'retry-cb-timeout',
      )

      expect(result).toBe('success')
      expect(operationCallOrder).toEqual(['operation-call'])
    })

    it('should handle timeout-cb-retry composition order', async () => {
      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 2,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 1,
          maxDelay: 1,
        },
        timeout: 1000,
      }

      const result = await adapter.applyNormalizedPolicy(
        operation,
        policy,
        'timeout-cb-retry',
      )

      expect(result).toBe('success')
      expect(operationCallOrder).toEqual(['operation-call'])
    })

    it('should handle both retry and timeout (simplified implementation)', async () => {
      let callCount = 0
      const failingOperation = vi.fn().mockImplementation(async () => {
        callCount++
        operationCallOrder.push(`attempt-${callCount}`)

        // First attempt fails
        if (callCount === 1) {
          throw new Error('first attempt fails')
        }

        // Second attempt succeeds
        return 'success-on-retry'
      })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 1,
          maxDelay: 1,
        },
        // Note: In this simple reference implementation, timeout takes precedence
        // Production adapters would compose these properly
      }

      const result = await adapter.applyNormalizedPolicy(
        failingOperation,
        policy,
        'retry-cb-timeout',
      )

      expect(result).toBe('success-on-retry')
      expect(operationCallOrder).toEqual(['attempt-1', 'attempt-2'])
      expect(callCount).toBe(2)
    })

    it('should prioritize timeout over retry in simple implementation', async () => {
      const slowOperation = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return 'should-timeout'
      })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 1,
          maxDelay: 1,
        },
        timeout: 20, // Should timeout before operation completes
      }

      await expect(
        adapter.applyNormalizedPolicy(
          slowOperation,
          policy,
          'timeout-cb-retry',
        ),
      ).rejects.toThrow('timed out')
    })

    it('should handle cancellation via AbortSignal', async () => {
      const controller = new AbortController()
      const longOperation = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return 'should-not-complete'
      })

      const policy: ResiliencePolicy = {
        timeout: 2000,
      }

      // Cancel after 10ms
      setTimeout(() => controller.abort(), 10)

      await expect(
        adapter.applyNormalizedPolicy(
          longOperation,
          policy,
          'retry-cb-timeout',
          controller.signal,
        ),
      ).rejects.toThrow('cancelled')
    })

    it('should apply circuit breaker (basic implementation)', async () => {
      const policy: ResiliencePolicy = {
        circuitBreaker: {
          failureThreshold: 3,
          recoveryTime: 1000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
      }

      const result = await adapter.applyNormalizedPolicy(
        operation,
        policy,
        'retry-cb-timeout',
      )

      expect(result).toBe('success')
      expect(operationCallOrder).toEqual(['operation-call'])
    })

    it('should handle no resilience patterns', async () => {
      const policy: ResiliencePolicy = {}

      const result = await adapter.applyNormalizedPolicy(
        operation,
        policy,
        'retry-cb-timeout',
      )

      expect(result).toBe('success')
      expect(operationCallOrder).toEqual(['operation-call'])
    })
  })

  describe('backoff calculation', () => {
    it('should calculate exponential backoff with jitter', async () => {
      let callCount = 0
      const failingOperation = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount < 4) {
          throw new Error(`attempt ${callCount} fails`)
        }
        return 'success'
      })

      const startTime = Date.now()

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 4,
          backoffStrategy: 'exponential',
          jitterStrategy: 'full-jitter',
          initialDelay: 10,
          maxDelay: 100,
        },
      }

      const result = await adapter.applyNormalizedPolicy(
        failingOperation,
        policy,
        'retry-cb-timeout',
      )

      const duration = Date.now() - startTime

      expect(result).toBe('success')
      expect(callCount).toBe(4)

      // Should have taken some time due to backoff (at least 10ms for delays)
      expect(duration).toBeGreaterThan(10)
    })

    it('should respect maxDelay for exponential backoff', async () => {
      let callCount = 0
      const failingOperation = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount < 3) {
          throw new Error(`attempt ${callCount} fails`)
        }
        return 'success'
      })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          jitterStrategy: 'none',
          initialDelay: 50,
          maxDelay: 60, // Should cap the exponential growth
        },
      }

      const startTime = Date.now()
      const result = await adapter.applyNormalizedPolicy(
        failingOperation,
        policy,
        'retry-cb-timeout',
      )
      const duration = Date.now() - startTime

      expect(result).toBe('success')
      expect(callCount).toBe(3)

      // Should respect maxDelay: first delay ~50ms, second delay capped at 60ms
      // Total should be around 110ms, not 150ms (50 + 100)
      expect(duration).toBeLessThan(130)
      expect(duration).toBeGreaterThan(100)
    })
  })
})
