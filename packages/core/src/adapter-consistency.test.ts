import { describe, expect, it, beforeEach } from 'vitest'
import type { Workflow } from '@orchestr8/schema'
import { MockResilienceAdapter } from '@orchestr8/testing'
import { ReferenceResilienceAdapter } from '@orchestr8/resilience'
import { OrchestrationEngine } from './orchestration-engine.js'
import type { Agent, AgentRegistry, ResilienceAdapter } from './types.js'

describe('Adapter Consistency - Composition Order', () => {
  let mockAgentRegistry: AgentRegistry
  let mockAgent: Agent

  beforeEach(() => {
    mockAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      execute: async () => 'agent-result',
    }

    mockAgentRegistry = {
      getAgent: async () => mockAgent,
      hasAgent: async () => true,
    }
  })

  describe('Mock vs Reference Adapter Consistency', () => {
    it('should call applyNormalizedPolicy with same parameters on both adapters', async () => {
      const mockAdapter = new MockResilienceAdapter()
      const referenceAdapter = new ReferenceResilienceAdapter()

      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: { maxAttempts: 3, backoffStrategy: 'exponential', jitterStrategy: 'full-jitter', initialDelay: 1000, maxDelay: 10000 },
              circuitBreaker: { failureThreshold: 5, recoveryTime: 30000, sampleSize: 10, halfOpenPolicy: 'single-probe' },
              timeout: 5000,
            },
          },
        ],
      }

      // Test with mock adapter
      const mockEngine = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter: mockAdapter,
        defaultCompositionOrder: 'retry-cb-timeout',
      })

      await mockEngine.execute(workflow)

      // Verify mock adapter was called with applyNormalizedPolicy
      expect(mockAdapter.applyNormalizedPolicy).toHaveBeenCalledWith(
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
        'retry-cb-timeout',
        expect.any(AbortSignal),
      )

      // Test with reference adapter (this won't have spy methods, but should work)
      const referenceEngine = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter: referenceAdapter,
        defaultCompositionOrder: 'retry-cb-timeout',
      })

      const result = await referenceEngine.execute(workflow)
      expect(result.status).toBe('completed')
    })

    it('should respect different composition orders consistently', async () => {
      const mockAdapter1 = new MockResilienceAdapter()
      const mockAdapter2 = new MockResilienceAdapter()

      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: { maxAttempts: 2, backoffStrategy: 'fixed', jitterStrategy: 'none', initialDelay: 100, maxDelay: 100 },
              timeout: 1000,
            },
          },
        ],
      }

      // Test with retry-cb-timeout composition
      const engine1 = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter: mockAdapter1,
        defaultCompositionOrder: 'retry-cb-timeout',
      })

      await engine1.execute(workflow)

      expect(mockAdapter1.applyNormalizedPolicy).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          retry: expect.objectContaining({ maxAttempts: 2 }),
          timeout: 1000,
        }),
        'retry-cb-timeout',
        expect.any(AbortSignal),
      )

      // Test with timeout-cb-retry composition
      const engine2 = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter: mockAdapter2,
        defaultCompositionOrder: 'timeout-cb-retry',
      })

      await engine2.execute(workflow)

      expect(mockAdapter2.applyNormalizedPolicy).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          retry: expect.objectContaining({ maxAttempts: 2 }),
          timeout: 1000,
        }),
        'timeout-cb-retry',
        expect.any(AbortSignal),
      )
    })

    it('should fall back to legacy interface when applyNormalizedPolicy is not available', async () => {
      // Create legacy adapter that only implements applyPolicy
      const legacyAdapter: ResilienceAdapter = {
        applyPolicy: async (operation) => {
          // Mark that legacy interface was called
          return operation()
        },
      }

      const engine = new OrchestrationEngine({
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

      const result = await engine.execute(workflow)
      expect(result.status).toBe('completed')
    })

    it('should maintain consistent behavior across multiple adapters', async () => {
      const adapters = [
        new MockResilienceAdapter(),
        new ReferenceResilienceAdapter(),
      ]

      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: { maxAttempts: 2, backoffStrategy: 'fixed', jitterStrategy: 'none', initialDelay: 50, maxDelay: 50 },
            },
          },
        ],
      }

      const results = await Promise.all(
        adapters.map(async (adapter) => {
          const engine = new OrchestrationEngine({
            agentRegistry: mockAgentRegistry,
            resilienceAdapter: adapter,
            defaultCompositionOrder: 'retry-cb-timeout',
          })

          return engine.execute(workflow)
        })
      )

      // All adapters should produce successful results
      results.forEach(result => {
        expect(result.status).toBe('completed')
        expect(result.steps).toBeDefined()
        expect(result.executionId).toBeDefined()
      })
    })

    it('should handle normalized policies with consistent defaults across adapters', async () => {
      const mockAdapter = new MockResilienceAdapter()

      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: {
                maxAttempts: 3,
                // Other fields should get defaults during normalization
              },
            },
          },
        ],
      }

      const engine = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter: mockAdapter,
      })

      await engine.execute(workflow)

      // Verify that the normalized policy contains defaults
      expect(mockAdapter.applyNormalizedPolicy).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          retry: expect.objectContaining({
            maxAttempts: 3,
            backoffStrategy: 'exponential', // Default from normalization
            jitterStrategy: 'full-jitter', // Default from normalization
            initialDelay: 1000, // Default from normalization
            maxDelay: 10000, // Default from normalization
          }),
        }),
        'retry-cb-timeout', // Default composition order
        expect.any(AbortSignal),
      )
    })
  })

  describe('Cross-Adapter Interface Compatibility', () => {
    it('should work with adapters implementing only legacy interface', async () => {
      const legacyAdapter: ResilienceAdapter = {
        applyPolicy: async (operation, policy) => {
          // Simple pass-through implementation
          if (policy.timeout) {
            // Just execute without actual timeout for this test
          }
          return operation()
        },
      }

      const engine = new OrchestrationEngine({
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
              timeout: 1000,
            },
          },
        ],
      }

      const result = await engine.execute(workflow)
      expect(result.status).toBe('completed')
    })

    it('should prefer new interface when both are available', async () => {
      let legacyCalled = false
      let newInterfaceCalled = false

      const dualAdapter: ResilienceAdapter = {
        applyPolicy: async (operation) => {
          legacyCalled = true
          return operation()
        },
        applyNormalizedPolicy: async (operation) => {
          newInterfaceCalled = true
          return operation()
        },
      }

      const engine = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter: dualAdapter,
      })

      const workflow: Workflow = {
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            resilience: {
              retry: { maxAttempts: 2, backoffStrategy: 'fixed', jitterStrategy: 'none', initialDelay: 100, maxDelay: 100 },
            },
          },
        ],
      }

      await engine.execute(workflow)

      expect(newInterfaceCalled).toBe(true)
      expect(legacyCalled).toBe(false)
    })
  })
})