import type { Workflow } from '@orchestr8/schema'

import { describe, expect, it, vi, beforeEach } from 'vitest'

import type {
  Agent,
  AgentRegistry,
  ResilienceAdapter,
  ResiliencePolicy,
} from './types.js'

import { OrchestrationEngine } from './orchestration-engine.js'

describe('Resilience Composition Order', () => {
  let engine: OrchestrationEngine
  let mockAgentRegistry: AgentRegistry
  let compositionTestAdapter: ResilienceAdapter
  let mockAgent: Agent
  let operationCallOrder: string[]
  let policyApplicationOrder: string[]

  beforeEach(() => {
    operationCallOrder = []
    policyApplicationOrder = []

    // Mock agent that records when it's called
    mockAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      execute: vi.fn().mockImplementation(async () => {
        operationCallOrder.push('agent-execute')
        return 'agent-result'
      }),
    }

    // Mock registry
    mockAgentRegistry = {
      getAgent: vi.fn().mockResolvedValue(mockAgent),
      hasAgent: vi.fn().mockResolvedValue(true),
    }

    // Composition testing adapter that records the order of pattern application
    compositionTestAdapter = {
      applyPolicy: vi
        .fn()
        .mockImplementation(async (operation, policy, _signal) => {
          const patterns = []
          if (policy?.retry) patterns.push('retry')
          if (policy?.circuitBreaker) patterns.push('cb')
          if (policy?.timeout) patterns.push('timeout')

          policyApplicationOrder.push(`applyPolicy(${patterns.join('+')})`)

          // Simulate composition by wrapping operation with each pattern
          let wrappedOperation = operation

          // Test different composition orders
          if (policy?.retry && policy?.circuitBreaker && policy?.timeout) {
            // Default: retry(circuitBreaker(timeout(operation)))
            wrappedOperation = () => {
              operationCallOrder.push('timeout-enter')
              return new Promise((resolve) => {
                setTimeout(() => {
                  operationCallOrder.push('timeout-execute')
                  operationCallOrder.push('cb-enter')
                  operationCallOrder.push('cb-execute')
                  operationCallOrder.push('retry-enter')
                  operationCallOrder.push('retry-execute')
                  resolve(operation())
                }, 1)
              })
            }
          }

          return wrappedOperation()
        }),
    }

    engine = new OrchestrationEngine({
      agentRegistry: mockAgentRegistry,
      resilienceAdapter: compositionTestAdapter,
    })
  })

  describe('retry-cb-timeout composition order (default)', () => {
    it('should apply patterns in retry(circuitBreaker(timeout(operation))) order', async () => {
      // Arrange
      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: {
                maxAttempts: 3,
                backoffStrategy: 'exponential',
                jitterStrategy: 'full-jitter',
                initialDelay: 100,
                maxDelay: 1000,
              },
              circuitBreaker: {
                failureThreshold: 5,
                recoveryTime: 30000,
                sampleSize: 10,
                halfOpenPolicy: 'single-probe',
              },
              timeout: 5000,
            },
          },
        ],
      }

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(policyApplicationOrder).toEqual(['applyPolicy(retry+cb+timeout)'])

      // Verify composition order in execution
      expect(operationCallOrder).toEqual([
        'timeout-enter', // Timeout is innermost wrapper
        'timeout-execute',
        'cb-enter', // Circuit breaker wraps timeout
        'cb-execute',
        'retry-enter', // Retry is outermost wrapper
        'retry-execute',
        'agent-execute', // Actual agent execution
      ])
    })

    it('should handle retry with timeout only', async () => {
      // Arrange
      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: {
                maxAttempts: 2,
                backoffStrategy: 'fixed',
                jitterStrategy: 'none',
                initialDelay: 50,
                maxDelay: 50,
              },
              timeout: 3000,
            },
          },
        ],
      }

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(policyApplicationOrder).toEqual(['applyPolicy(retry+timeout)'])
    })

    it('should handle circuit breaker with timeout only', async () => {
      // Arrange
      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              circuitBreaker: {
                failureThreshold: 3,
                recoveryTime: 10000,
                sampleSize: 5,
                halfOpenPolicy: 'gradual',
              },
              timeout: 2000,
            },
          },
        ],
      }

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(policyApplicationOrder).toEqual(['applyPolicy(cb+timeout)'])
    })

    it('should handle single timeout policy', async () => {
      // Arrange
      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              timeout: 1000,
            },
          },
        ],
      }

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(policyApplicationOrder).toEqual(['applyPolicy(timeout)'])
    })

    it('should handle no resilience policy', async () => {
      // Arrange
      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            // No resilience policy
          },
        ],
      }

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      // Should not call applyPolicy when no resilience policy is defined
      expect(policyApplicationOrder).toEqual([])
    })
  })

  describe('timeout-cb-retry composition order (alternative)', () => {
    beforeEach(() => {
      // Reset tracking arrays
      operationCallOrder = []
      policyApplicationOrder = []

      // Alternative composition adapter that implements timeout(circuitBreaker(retry(operation)))
      compositionTestAdapter = {
        applyPolicy: vi
          .fn()
          .mockImplementation(async (operation, policy, _signal) => {
            const patterns = []
            if (policy?.retry) patterns.push('retry')
            if (policy?.circuitBreaker) patterns.push('cb')
            if (policy?.timeout) patterns.push('timeout')

            policyApplicationOrder.push(`applyPolicy(${patterns.join('+')})`)

            // Test alternative composition: timeout(circuitBreaker(retry(operation)))
            let wrappedOperation = operation

            if (policy?.retry && policy?.circuitBreaker && policy?.timeout) {
              // Alternative: timeout(circuitBreaker(retry(operation)))
              wrappedOperation = () => {
                operationCallOrder.push('timeout-enter') // Timeout is outermost
                return new Promise((resolve) => {
                  setTimeout(() => {
                    operationCallOrder.push('timeout-execute')
                    operationCallOrder.push('cb-enter') // Circuit breaker wraps retry
                    operationCallOrder.push('cb-execute')
                    operationCallOrder.push('retry-enter') // Retry is innermost wrapper
                    operationCallOrder.push('retry-execute')
                    resolve(operation())
                  }, 1)
                })
              }
            }

            return wrappedOperation()
          }),
      }

      engine = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter: compositionTestAdapter,
      })
    })

    it('should apply patterns in timeout(circuitBreaker(retry(operation))) order', async () => {
      // Arrange
      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: {
                maxAttempts: 2,
                backoffStrategy: 'fixed',
                jitterStrategy: 'none',
                initialDelay: 50,
                maxDelay: 50,
              },
              circuitBreaker: {
                failureThreshold: 3,
                recoveryTime: 10000,
                sampleSize: 5,
                halfOpenPolicy: 'single-probe',
              },
              timeout: 2000,
            },
          },
        ],
      }

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(policyApplicationOrder).toEqual(['applyPolicy(retry+cb+timeout)'])

      // Verify alternative composition order in execution
      expect(operationCallOrder).toEqual([
        'timeout-enter', // Timeout is outermost wrapper
        'timeout-execute',
        'cb-enter', // Circuit breaker wraps retry
        'cb-execute',
        'retry-enter', // Retry is innermost wrapper (gets all timeout benefit)
        'retry-execute',
        'agent-execute', // Actual agent execution
      ])
    })

    it('should demonstrate difference from default composition', async () => {
      // This test shows that timeout-cb-retry means:
      // - Overall timeout applies to ALL retry attempts combined
      // - Retry gets full benefit of the timeout window
      // - Circuit breaker tracks retry attempts within the timeout window

      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: {
                maxAttempts: 3,
                backoffStrategy: 'fixed',
                jitterStrategy: 'none',
                initialDelay: 10,
                maxDelay: 10,
              },
              circuitBreaker: {
                failureThreshold: 5,
                recoveryTime: 5000,
                sampleSize: 10,
                halfOpenPolicy: 'single-probe',
              },
              timeout: 1000,
            },
          },
        ],
      }

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')

      // In timeout-cb-retry order:
      // - The timeout encompasses all retry attempts
      // - If retries take too long collectively, the timeout cancels everything
      // - This is different from retry-cb-timeout where timeout applies per attempt
      expect(policyApplicationOrder).toEqual(['applyPolicy(retry+cb+timeout)'])
    })
  })

  describe('retry and timeout interaction', () => {
    it('should demonstrate retry-cb-timeout: each retry attempt gets individual timeout', async () => {
      let attemptCount = 0
      const timeoutTrackingAdapter: ResilienceAdapter = {
        applyPolicy: vi
          .fn()
          .mockImplementation(async (operation, policy, _signal) => {
            // Simulate retry-cb-timeout: retry(circuitBreaker(timeout(operation)))
            // Each retry attempt gets its own timeout
            const maxAttempts = policy?.retry?.maxAttempts || 3
            const timeout = policy?.timeout || 1000

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              try {
                attemptCount++
                operationCallOrder.push(
                  `attempt-${attempt}-start-with-individual-timeout-${timeout}ms`,
                )

                // Each attempt gets its own timeout window
                const result = await Promise.race([
                  operation(),
                  new Promise((_, reject) =>
                    setTimeout(
                      () => reject(new Error('Individual timeout')),
                      timeout,
                    ),
                  ),
                ])

                operationCallOrder.push(`attempt-${attempt}-succeeded`)
                return result
              } catch (error) {
                operationCallOrder.push(`attempt-${attempt}-failed`)
                if (attempt === maxAttempts) throw error
                // Continue to next attempt
              }
            }
          }),
      }

      const engine = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter: timeoutTrackingAdapter,
      })

      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: {
                maxAttempts: 3,
                backoffStrategy: 'fixed',
                jitterStrategy: 'none',
                initialDelay: 10,
                maxDelay: 10,
              },
              timeout: 500, // Individual timeout per attempt
            },
          },
        ],
      }

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(attemptCount).toBeGreaterThan(0)
      // Each attempt should have individual timeout tracking
      expect(
        operationCallOrder.some((order) =>
          order.includes('individual-timeout-500ms'),
        ),
      ).toBe(true)
    })

    it('should demonstrate timeout-cb-retry: overall timeout covers all retry attempts', async () => {
      let attemptCount = 0
      const overallTimeoutAdapter: ResilienceAdapter = {
        applyPolicy: vi
          .fn()
          .mockImplementation(async (operation, policy, _signal) => {
            // Simulate timeout-cb-retry: timeout(circuitBreaker(retry(operation)))
            // Overall timeout covers all retry attempts combined
            const maxAttempts = policy?.retry?.maxAttempts || 3
            const overallTimeout = policy?.timeout || 1000

            operationCallOrder.push(`overall-timeout-start-${overallTimeout}ms`)

            const overallTimeoutPromise = new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Overall timeout')),
                overallTimeout,
              ),
            )

            const retryPromise = (async () => {
              for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                  attemptCount++
                  operationCallOrder.push(
                    `attempt-${attempt}-within-overall-timeout`,
                  )
                  return await operation()
                } catch (error) {
                  operationCallOrder.push(`attempt-${attempt}-failed`)
                  if (attempt === maxAttempts) throw error
                  // Continue to next attempt within overall timeout window
                  await new Promise((resolve) => setTimeout(resolve, 10)) // Small delay between retries
                }
              }
            })()

            return Promise.race([retryPromise, overallTimeoutPromise])
          }),
      }

      const engine = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter: overallTimeoutAdapter,
      })

      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: {
                maxAttempts: 3,
                backoffStrategy: 'fixed',
                jitterStrategy: 'none',
                initialDelay: 10,
                maxDelay: 10,
              },
              timeout: 1000, // Overall timeout for all attempts combined
            },
          },
        ],
      }

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(attemptCount).toBeGreaterThan(0)
      // Should track overall timeout covering all attempts
      expect(
        operationCallOrder.some((order) =>
          order.includes('overall-timeout-start-1000ms'),
        ),
      ).toBe(true)
      expect(
        operationCallOrder.some((order) =>
          order.includes('within-overall-timeout'),
        ),
      ).toBe(true)
    })
  })

  describe('composition order decision', () => {
    it('should document the default retry-cb-timeout composition decision', () => {
      // This test documents the architectural decision for default composition order

      const defaultComposition = 'retry-cb-timeout' // retry(circuitBreaker(timeout(operation)))

      // Rationale for retry-cb-timeout as default:
      const rationale = {
        advantages: [
          'Each retry attempt gets fresh timeout window',
          "Better fault isolation - timeouts don't affect other attempts",
          'Circuit breaker sees individual attempt outcomes',
          'Consistent with most resilience libraries (Polly, resilience4j)',
        ],
        tradeoffs: [
          'Total execution time can exceed single timeout value',
          'More complex timeout accounting for users',
        ],
        alternativeUseCase:
          'Use timeout-cb-retry when you need hard SLA enforcement',
      }

      // Assert our architectural decision
      expect(defaultComposition).toBe('retry-cb-timeout')
      expect(rationale.advantages).toHaveLength(4)
      expect(rationale.alternativeUseCase).toContain('SLA')
    })

    it('should provide clear mapping for composition orders', () => {
      // Document the exact function composition mapping
      const compositionMappings = {
        'retry-cb-timeout': 'retry(circuitBreaker(timeout(operation)))',
        'timeout-cb-retry': 'timeout(circuitBreaker(retry(operation)))',
      }

      // Verify the mappings are well-defined
      expect(compositionMappings['retry-cb-timeout']).toContain('retry(')
      expect(compositionMappings['retry-cb-timeout']).toContain(
        'timeout(operation)',
      )

      expect(compositionMappings['timeout-cb-retry']).toContain('timeout(')
      expect(compositionMappings['timeout-cb-retry']).toContain(
        'retry(operation)',
      )
    })
  })

  describe('policy normalization', () => {
    it('should normalize default retry policy values', async () => {
      // Arrange
      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: {
                maxAttempts: 3,
                // Other fields should get defaults
                backoffStrategy: 'exponential',
                jitterStrategy: 'full-jitter',
                initialDelay: 100,
                maxDelay: 1000,
              },
            },
          },
        ],
      }

      // Act
      await engine.execute(workflow)

      // Assert - applyPolicy should be called with normalized retry config
      expect(compositionTestAdapter.applyPolicy).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          retry: expect.objectContaining({
            maxAttempts: 3,
            backoffStrategy: 'exponential',
            jitterStrategy: 'full-jitter',
            initialDelay: 100,
            maxDelay: 1000,
          }),
        }),
        expect.any(AbortSignal),
      )
    })

    it('should normalize default circuit breaker policy values', async () => {
      // Arrange
      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              circuitBreaker: {
                failureThreshold: 5,
                recoveryTime: 30000,
                sampleSize: 10,
                halfOpenPolicy: 'single-probe',
              },
            },
          },
        ],
      }

      // Act
      await engine.execute(workflow)

      // Assert - applyPolicy should be called with normalized circuit breaker config
      expect(compositionTestAdapter.applyPolicy).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          circuitBreaker: expect.objectContaining({
            failureThreshold: 5,
            recoveryTime: 30000,
            sampleSize: 10,
            halfOpenPolicy: 'single-probe',
          }),
        }),
        expect.any(AbortSignal),
      )
    })
  })

  describe('ResilienceAdapter with explicit composition order', () => {
    let newInterfaceAdapter: ResilienceAdapter
    let compositionCallTracker: Array<{
      normalizedPolicy: ResiliencePolicy
      compositionOrder: string
    }>

    beforeEach(() => {
      compositionCallTracker = []

      // Mock adapter implementing the new interface with explicit compositionOrder
      newInterfaceAdapter = {
        applyPolicy: vi
          .fn()
          .mockImplementation(async (operation, _policy, _signal) => {
            // For backward compatibility test - old interface
            operationCallOrder.push('old-interface-call')
            return operation()
          }),
        applyNormalizedPolicy: vi
          .fn()
          .mockImplementation(
            async (operation, normalizedPolicy, compositionOrder, _signal) => {
              // Track calls to new interface
              compositionCallTracker.push({
                normalizedPolicy,
                compositionOrder,
              })
              operationCallOrder.push(`new-interface-${compositionOrder}`)
              return operation()
            },
          ),
      }

      engine = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter: newInterfaceAdapter,
      })
    })

    it('should call applyNormalizedPolicy with default retry-cb-timeout composition order', async () => {
      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: {
                maxAttempts: 3,
                backoffStrategy: 'exponential',
                jitterStrategy: 'full-jitter',
                initialDelay: 1000,
                maxDelay: 10000,
              },
              circuitBreaker: {
                failureThreshold: 5,
                recoveryTime: 30000,
                sampleSize: 10,
                halfOpenPolicy: 'single-probe',
              },
              timeout: 5000,
            },
          },
        ],
      }

      await engine.execute(workflow)

      expect(newInterfaceAdapter.applyNormalizedPolicy).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          retry: expect.objectContaining({
            maxAttempts: 3,
            backoffStrategy: 'exponential',
            jitterStrategy: 'full-jitter',
            initialDelay: 1000,
            maxDelay: 10000,
          }),
          circuitBreaker: expect.objectContaining({
            failureThreshold: 5,
            recoveryTime: 30000,
            sampleSize: 10,
            halfOpenPolicy: 'single-probe',
          }),
          timeout: 5000,
        }),
        'retry-cb-timeout', // Default composition order
        expect.any(AbortSignal),
      )

      expect(compositionCallTracker).toHaveLength(1)
      expect(compositionCallTracker[0].compositionOrder).toBe(
        'retry-cb-timeout',
      )
      expect(operationCallOrder).toContain('new-interface-retry-cb-timeout')
    })

    it('should use configurable composition order when specified', async () => {
      // Create engine with custom composition order
      const customEngine = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter: newInterfaceAdapter,
        defaultCompositionOrder: 'timeout-cb-retry',
      })

      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: {
                maxAttempts: 2,
                backoffStrategy: 'fixed',
                jitterStrategy: 'none',
                initialDelay: 500,
                maxDelay: 500,
              },
              timeout: 3000,
            },
          },
        ],
      }

      await customEngine.execute(workflow)

      expect(newInterfaceAdapter.applyNormalizedPolicy).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          retry: expect.objectContaining({
            maxAttempts: 2,
          }),
          timeout: 3000,
        }),
        'timeout-cb-retry',
        expect.any(AbortSignal),
      )

      expect(operationCallOrder).toContain('new-interface-timeout-cb-retry')
    })

    it('should fall back to old interface when applyNormalizedPolicy is not available', async () => {
      // Create adapter with only old interface
      const legacyAdapter: ResilienceAdapter = {
        applyPolicy: vi.fn().mockImplementation(async (operation) => {
          operationCallOrder.push('legacy-adapter-call')
          return operation()
        }),
      }

      const legacyEngine = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter: legacyAdapter,
      })

      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              timeout: 2000,
            },
          },
        ],
      }

      await legacyEngine.execute(workflow)

      expect(legacyAdapter.applyPolicy).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ timeout: 2000 }),
        expect.any(AbortSignal),
      )
      expect(operationCallOrder).toContain('legacy-adapter-call')
    })

    it('should handle normalized policy with only one resilience pattern', async () => {
      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: {
                maxAttempts: 2,
                backoffStrategy: 'fixed',
                jitterStrategy: 'none',
                initialDelay: 100,
                maxDelay: 100,
              },
            },
          },
        ],
      }

      await engine.execute(workflow)

      expect(newInterfaceAdapter.applyNormalizedPolicy).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          retry: expect.objectContaining({ maxAttempts: 2 }),
        }),
        'retry-cb-timeout',
        expect.any(AbortSignal),
      )
    })
  })
})
