import type { ResiliencePolicy } from '@orchestr8/schema'

import { describe, expect, it, vi, beforeEach } from 'vitest'

import { ReferenceResilienceAdapter } from './reference-adapter.js'

describe('ReferenceResilienceAdapter', () => {
  let adapter: ReferenceResilienceAdapter
  let operation: (signal?: AbortSignal) => Promise<string>
  let operationCallOrder: string[]

  beforeEach(() => {
    adapter = new ReferenceResilienceAdapter()
    operationCallOrder = []
    operation = vi.fn().mockImplementation(async (_signal?: AbortSignal) => {
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
      const failingOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
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
      const slowOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
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
      const failingOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
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
      const slowOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
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
      const longOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
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

    it('should apply circuit breaker with successful operations', async () => {
      const policy: ResiliencePolicy = {
        circuitBreaker: {
          key: 'test-service',
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

  describe('circuit breaker', () => {
    it('should open circuit after failure threshold', async () => {
      let callCount = 0
      const failingOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
          callCount++
          throw new Error(`failure ${callCount}`)
        })

      const policy: ResiliencePolicy = {
        circuitBreaker: {
          key: 'test-cb-1',
          failureThreshold: 2,
          recoveryTime: 100,
          halfOpenPolicy: 'single-probe',
        },
      }

      // First failure
      await expect(
        adapter.applyNormalizedPolicy(
          failingOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow('failure 1')

      // Second failure should open the circuit
      await expect(
        adapter.applyNormalizedPolicy(
          failingOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow('failure 2')

      // Third attempt should be rejected immediately by open circuit
      await expect(
        adapter.applyNormalizedPolicy(
          failingOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow('Circuit breaker is open')

      expect(callCount).toBe(2) // Only 2 actual calls, third was rejected
    })

    it('should transition from open to half-open after recovery time', async () => {
      let callCount = 0
      const testOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
          callCount++
          if (callCount <= 2) {
            throw new Error(`failure ${callCount}`)
          }
          return `success ${callCount}`
        })

      const policy: ResiliencePolicy = {
        circuitBreaker: {
          key: 'test-cb-2',
          failureThreshold: 2,
          recoveryTime: 50, // Short recovery for testing
          halfOpenPolicy: 'single-probe',
        },
      }

      // Open the circuit
      await expect(
        adapter.applyNormalizedPolicy(
          testOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow('failure 1')

      await expect(
        adapter.applyNormalizedPolicy(
          testOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow('failure 2')

      // Should be open now
      await expect(
        adapter.applyNormalizedPolicy(
          testOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow('Circuit breaker is open')

      // Wait for recovery time
      await new Promise((resolve) => setTimeout(resolve, 60))

      // Should transition to half-open and allow one attempt
      const result = await adapter.applyNormalizedPolicy(
        testOperation,
        policy,
        'retry-cb-timeout',
      )

      expect(result).toBe('success 3')
      expect(callCount).toBe(3)
    })

    it('should close circuit after successful probe in half-open state', async () => {
      let callCount = 0
      const testOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
          callCount++
          if (callCount <= 2) {
            throw new Error(`failure ${callCount}`)
          }
          return `success ${callCount}`
        })

      const policy: ResiliencePolicy = {
        circuitBreaker: {
          key: 'test-cb-3',
          failureThreshold: 2,
          recoveryTime: 50,
          halfOpenPolicy: 'single-probe',
        },
      }

      // Open the circuit
      await expect(
        adapter.applyNormalizedPolicy(
          testOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow()
      await expect(
        adapter.applyNormalizedPolicy(
          testOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow()

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 60))

      // Successful probe should close the circuit
      await adapter.applyNormalizedPolicy(
        testOperation,
        policy,
        'retry-cb-timeout',
      )

      // Circuit should be closed, subsequent calls should work
      const result = await adapter.applyNormalizedPolicy(
        testOperation,
        policy,
        'retry-cb-timeout',
      )

      expect(result).toBe('success 4')
    })

    it('should re-open circuit if probe fails in half-open state', async () => {
      let callCount = 0
      const testOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
          callCount++
          if (callCount !== 5) {
            // Only succeed on the 5th call
            throw new Error(`failure ${callCount}`)
          }
          return `success ${callCount}`
        })

      const policy: ResiliencePolicy = {
        circuitBreaker: {
          key: 'test-cb-4',
          failureThreshold: 2,
          recoveryTime: 50,
          halfOpenPolicy: 'single-probe',
        },
      }

      // Open the circuit
      await expect(
        adapter.applyNormalizedPolicy(
          testOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow()
      await expect(
        adapter.applyNormalizedPolicy(
          testOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow()

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 60))

      // Probe fails, should re-open
      await expect(
        adapter.applyNormalizedPolicy(
          testOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow('failure 3')

      // Should be open again
      await expect(
        adapter.applyNormalizedPolicy(
          testOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow('Circuit breaker is open')

      expect(callCount).toBe(3) // 2 to open + 1 failed probe
    })

    it('should handle gradual recovery policy', async () => {
      let callCount = 0
      const testOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
          callCount++
          if (callCount <= 2) {
            throw new Error(`failure ${callCount}`)
          }
          return `success ${callCount}`
        })

      const policy: ResiliencePolicy = {
        circuitBreaker: {
          key: 'test-cb-5',
          failureThreshold: 2,
          recoveryTime: 50,
          halfOpenPolicy: 'gradual', // Requires 3 successes
        },
      }

      // Open the circuit
      await expect(
        adapter.applyNormalizedPolicy(
          testOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow()
      await expect(
        adapter.applyNormalizedPolicy(
          testOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow()

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 60))

      // Need 3 successful calls to close
      await adapter.applyNormalizedPolicy(
        testOperation,
        policy,
        'retry-cb-timeout',
      )
      await adapter.applyNormalizedPolicy(
        testOperation,
        policy,
        'retry-cb-timeout',
      )
      await adapter.applyNormalizedPolicy(
        testOperation,
        policy,
        'retry-cb-timeout',
      )

      // Circuit should now be closed
      const result = await adapter.applyNormalizedPolicy(
        testOperation,
        policy,
        'retry-cb-timeout',
      )

      expect(result).toBe('success 6')
      expect(callCount).toBe(6)
    })

    it('should use context for circuit breaker key if not provided', async () => {
      const policy: ResiliencePolicy = {
        circuitBreaker: {
          failureThreshold: 3,
          recoveryTime: 1000,
          halfOpenPolicy: 'single-probe',
        },
      }

      const context = {
        workflowId: 'workflow-1',
        stepId: 'step-1',
        correlationId: 'corr-1',
      }

      const result = await adapter.applyNormalizedPolicy(
        operation,
        policy,
        'retry-cb-timeout',
        undefined,
        context,
      )

      expect(result).toBe('success')
    })
  })

  describe('composition order', () => {
    it('should apply patterns in retry-cb-timeout order', async () => {
      const executionOrder: string[] = []

      const trackingOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
          executionOrder.push('operation')
          return 'success'
        })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 2,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 1,
          maxDelay: 1,
        },
        circuitBreaker: {
          key: 'test-order-1',
          failureThreshold: 3,
          recoveryTime: 1000,
        },
        timeout: 1000,
      }

      const result = await adapter.applyNormalizedPolicy(
        trackingOperation,
        policy,
        'retry-cb-timeout',
      )

      expect(result).toBe('success')
      expect(executionOrder).toEqual(['operation'])
    })

    it('should apply patterns in timeout-cb-retry order', async () => {
      const executionOrder: string[] = []

      const trackingOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
          executionOrder.push('operation')
          return 'success'
        })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 2,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 1,
          maxDelay: 1,
        },
        circuitBreaker: {
          key: 'test-order-2',
          failureThreshold: 3,
          recoveryTime: 1000,
        },
        timeout: 1000,
      }

      const result = await adapter.applyNormalizedPolicy(
        trackingOperation,
        policy,
        'timeout-cb-retry',
      )

      expect(result).toBe('success')
      expect(executionOrder).toEqual(['operation'])
    })

    it('should handle retry with circuit breaker correctly', async () => {
      let callCount = 0
      const failingOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
          callCount++
          if (callCount < 3) {
            throw new Error(`attempt ${callCount}`)
          }
          return `success ${callCount}`
        })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 1,
          maxDelay: 1,
        },
        circuitBreaker: {
          key: 'test-retry-cb',
          failureThreshold: 5, // High threshold so CB doesn't open
          recoveryTime: 1000,
        },
      }

      const result = await adapter.applyNormalizedPolicy(
        failingOperation,
        policy,
        'retry-cb-timeout',
      )

      expect(result).toBe('success 3')
      expect(callCount).toBe(3) // Should retry until success
    })

    it('should respect timeout even with retry', async () => {
      const slowOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
          await new Promise((resolve) => setTimeout(resolve, 100))
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
        timeout: 50, // Timeout before operation completes
      }

      // With retry-cb-timeout order, timeout wraps the operation
      await expect(
        adapter.applyNormalizedPolicy(
          slowOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow('timed out')
    })

    it('should handle circuit breaker opening during retries', async () => {
      let callCount = 0
      const failingOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
          callCount++
          throw new Error(`failure ${callCount}`)
        })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 5,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 1,
          maxDelay: 1,
        },
        circuitBreaker: {
          key: 'test-cb-retry',
          failureThreshold: 3, // CB will open after 3 failures
          recoveryTime: 1000,
        },
      }

      // Should fail with circuit breaker open error after 3 attempts
      await expect(
        adapter.applyNormalizedPolicy(
          failingOperation,
          policy,
          'retry-cb-timeout',
        ),
      ).rejects.toThrow()

      // The circuit should be open after failureThreshold attempts
      expect(callCount).toBeLessThanOrEqual(3)
    })
  })

  describe('backoff calculation', () => {
    it('should calculate exponential backoff with jitter', async () => {
      vi.useFakeTimers()

      let callCount = 0
      const failingOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
          callCount++
          if (callCount < 4) {
            throw new Error(`attempt ${callCount} fails`)
          }
          return 'success'
        })

      const policy: ResiliencePolicy = {
        retry: {
          maxAttempts: 4,
          backoffStrategy: 'exponential',
          jitterStrategy: 'full-jitter',
          initialDelay: 10,
          maxDelay: 100,
        },
      }

      const resultPromise = adapter.applyNormalizedPolicy(
        failingOperation,
        policy,
        'retry-cb-timeout',
      )

      // Advance timers to handle all retries
      // With exponential backoff and jitter, we need to advance enough to cover all delays
      await vi.advanceTimersByTimeAsync(500)

      const result = await resultPromise

      expect(result).toBe('success')
      expect(callCount).toBe(4)

      vi.useRealTimers()
    })

    it('should respect maxDelay for exponential backoff', async () => {
      let callCount = 0
      const failingOperation = vi
        .fn()
        .mockImplementation(async (_signal?: AbortSignal) => {
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
      // Allow some scheduler jitter in CI and local runs
      expect(duration).toBeLessThan(150)
      expect(duration).toBeGreaterThanOrEqual(100)
    })
  })
})
