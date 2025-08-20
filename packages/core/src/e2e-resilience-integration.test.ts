/**
 * End-to-End integration tests for OrchestrationEngine with ProductionResilienceAdapter
 * Tests full retry + circuit breaker + timeout flows with real composition
 */

import { ProductionResilienceAdapter } from '@orchestr8/resilience'
import {
  createExecutionError,
  ExecutionErrorCode,
  type Workflow,
} from '@orchestr8/schema'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Agent, AgentRegistry } from './types.js'

import { OrchestrationEngine } from './orchestration-engine.js'

describe('E2E: OrchestrationEngine + ProductionResilienceAdapter', () => {
  let mockAgentRegistry: AgentRegistry
  let resilienceAdapter: ProductionResilienceAdapter
  let engine: OrchestrationEngine
  let abortController: AbortController

  beforeEach(() => {
    abortController = new AbortController()

    // Create mock agent registry
    mockAgentRegistry = {
      getAgent: vi.fn(),
      hasAgent: vi.fn(),
      registerAgent: vi.fn(),
    }

    // Create production resilience adapter
    resilienceAdapter = new ProductionResilienceAdapter({
      maxInstances: 100,
      telemetry: {
        logEvent: vi.fn(),
        startTimer: vi.fn().mockReturnValue(() => 100),
        createCircuitBreakerObserver: vi.fn().mockReturnValue({
          onStateChange: vi.fn(),
          onFailure: vi.fn(),
          onSuccess: vi.fn(),
        }),
      },
    })

    // Create engine with production adapter
    engine = new OrchestrationEngine({
      agentRegistry: mockAgentRegistry,
      resilienceAdapter,
      defaultCompositionOrder: 'retry-cb-timeout',
    })
  })

  afterEach(() => {
    resilienceAdapter.resetAllCircuits()
  })

  describe('retry-cb-timeout composition', () => {
    it('should retry failed operations through circuit breaker and timeout', async () => {
      // Arrange: Agent that fails twice then succeeds
      let callCount = 0
      const flakeyAgent: Agent = {
        id: 'flakey-agent',
        name: 'Flakey Agent',
        execute: vi.fn().mockImplementation(async (_input, _signal) => {
          callCount++
          if (callCount <= 2) {
            throw createExecutionError(
              ExecutionErrorCode.EXECUTION_TIMEOUT,
              `Attempt ${callCount} failed`,
            )
          }
          return { result: `success-on-attempt-${callCount}` }
        }),
      }

      const workflow: Workflow = {
        id: 'retry-test-workflow',
        name: 'Retry Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'retry-step',
            type: 'agent',
            agentId: 'flakey-agent',
            input: { message: 'test' },
            resilience: {
              retry: {
                maxAttempts: 3,
                backoffStrategy: 'fixed',
                initialDelay: 10, // Short delays for fast test
                maxDelay: 10,
                jitterStrategy: 'none',
              },
              circuitBreaker: {
                failureThreshold: 10, // High threshold so circuit doesn't open
                recoveryTime: 1000,
                sampleSize: 20,
                halfOpenPolicy: 'single-probe',
              },
              timeout: 500, // 500ms timeout per attempt
            },
          },
        ],
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'flakey-agent') return flakeyAgent
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const result = await engine.execute(workflow, {}, abortController.signal)

      // Assert
      expect(result.status).toBe('completed')
      expect(result.steps['retry-step']).toMatchObject({
        status: 'completed',
        output: { result: 'success-on-attempt-3' },
      })
      expect(flakeyAgent.execute).toHaveBeenCalledTimes(3)
    })

    it('should demonstrate circuit breaker behavior with key isolation', async () => {
      // Arrange: Agent that always fails to trigger circuit breaker
      const alwaysFailAgent: Agent = {
        id: 'always-fail-agent',
        name: 'Always Fail Agent',
        execute: vi.fn().mockImplementation(async () => {
          throw createExecutionError(
            ExecutionErrorCode.AGENT_EXECUTION_ERROR,
            'Always fails',
          )
        }),
      }

      const workflow: Workflow = {
        id: 'circuit-breaker-test-workflow',
        name: 'Circuit Breaker Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'failing-step',
            type: 'agent',
            agentId: 'always-fail-agent',
            input: { message: 'test' },
            resilience: {
              retry: {
                maxAttempts: 2, // Limited retries for faster test
                backoffStrategy: 'fixed',
                initialDelay: 10,
                maxDelay: 10,
                jitterStrategy: 'none',
              },
              circuitBreaker: {
                key: 'test-circuit',
                failureThreshold: 0.5, // 50% failure rate
                recoveryTime: 1000,
                sampleSize: 2, // Small sample to trigger quickly
                halfOpenPolicy: 'single-probe',
              },
              timeout: 200,
            },
          },
        ],
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'always-fail-agent') return alwaysFailAgent
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act & Assert: Execute and verify circuit breaker behavior exists
      const result = await engine.execute(workflow, {}, abortController.signal)

      expect(result.status).toBe('failed')
      expect(result.steps['failing-step']).toMatchObject({
        status: 'failed',
        error: {
          code: ExecutionErrorCode.RETRYABLE, // Should be mapped from RetryExhaustedError
        },
      })

      // Should have attempted the configured number of retries
      expect(alwaysFailAgent.execute).toHaveBeenCalledTimes(2)
    })

    it('should timeout individual retry attempts correctly', async () => {
      // Arrange: Agent that takes too long
      const slowAgent: Agent = {
        id: 'slow-agent',
        name: 'Slow Agent',
        execute: vi.fn().mockImplementation(async (_input, _signal) => {
          // Simulate long operation that exceeds timeout
          await new Promise((resolve) => setTimeout(resolve, 500))
          return { result: 'eventually-success' }
        }),
      }

      const workflow: Workflow = {
        id: 'timeout-test-workflow',
        name: 'Timeout Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'slow-step',
            type: 'agent',
            agentId: 'slow-agent',
            input: { message: 'test' },
            resilience: {
              retry: {
                maxAttempts: 2,
                backoffStrategy: 'fixed',
                initialDelay: 10,
                maxDelay: 10,
                jitterStrategy: 'none',
              },
              circuitBreaker: {
                failureThreshold: 10, // High threshold so circuit doesn't open
                recoveryTime: 1000,
                sampleSize: 20,
                halfOpenPolicy: 'single-probe',
              },
              timeout: 200, // 200ms timeout per attempt (less than agent's 500ms)
            },
          },
        ],
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'slow-agent') return slowAgent
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const result = await engine.execute(workflow, {}, abortController.signal)

      // Assert - should fail due to timeouts
      expect(result.status).toBe('failed')
      expect(result.steps['slow-step']).toMatchObject({
        status: 'failed',
        error: {
          code: ExecutionErrorCode.RETRYABLE, // Should be mapped from RetryExhaustedError after timeouts
        },
      })

      // Should have attempted the operation (timeouts during execution)
      expect(slowAgent.execute).toHaveBeenCalledTimes(2)
    })
  })

  describe('timeout-cb-retry composition', () => {
    it('should apply single timeout to all retries combined', async () => {
      // Arrange: Agent that fails initially but would succeed on retry
      let callCount = 0
      const eventuallySucceedsAgent: Agent = {
        id: 'eventually-succeeds-agent',
        name: 'Eventually Succeeds Agent',
        execute: vi.fn().mockImplementation(async () => {
          callCount++
          if (callCount <= 1) {
            throw createExecutionError(
              ExecutionErrorCode.EXECUTION_TIMEOUT,
              `Attempt ${callCount} failed`,
            )
          }
          return { result: 'success-after-retry' }
        }),
      }

      // Create engine with timeout-cb-retry composition
      const timeoutFirstEngine = new OrchestrationEngine({
        agentRegistry: mockAgentRegistry,
        resilienceAdapter,
        defaultCompositionOrder: 'timeout-cb-retry',
      })

      const workflow: Workflow = {
        id: 'timeout-first-workflow',
        name: 'Timeout First Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'timeout-retry-step',
            type: 'agent',
            agentId: 'eventually-succeeds-agent',
            input: { message: 'test' },
            resilience: {
              retry: {
                maxAttempts: 3,
                backoffStrategy: 'fixed',
                initialDelay: 10, // Fast retries for quick test
                maxDelay: 10,
                jitterStrategy: 'none',
              },
              circuitBreaker: {
                failureThreshold: 10,
                recoveryTime: 1000,
                sampleSize: 20,
                halfOpenPolicy: 'single-probe',
              },
              timeout: 100, // Short overall timeout
            },
          },
        ],
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'eventually-succeeds-agent') return eventuallySucceedsAgent
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const result = await timeoutFirstEngine.execute(
        workflow,
        {},
        abortController.signal,
      )

      // Assert - should succeed because retry happens within timeout
      expect(result.status).toBe('completed')
      expect(result.steps['timeout-retry-step']).toMatchObject({
        status: 'completed',
        output: { result: 'success-after-retry' },
      })

      // Should have retried and succeeded
      expect(eventuallySucceedsAgent.execute).toHaveBeenCalledTimes(2)
    })
  })

  describe('signal propagation', () => {
    it('should handle abort signal during execution', async () => {
      // Arrange: Agent that runs quickly but we'll test cancellation
      const fastAgent: Agent = {
        id: 'fast-agent',
        name: 'Fast Agent',
        execute: vi.fn().mockImplementation(async (_input, _signal) => {
          // Check if already aborted
          if (_signal?.aborted) {
            throw new Error('Operation was cancelled')
          }

          return { result: 'completed' }
        }),
      }

      const workflow: Workflow = {
        id: 'cancellation-test-workflow',
        name: 'Cancellation Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'fast-step',
            type: 'agent',
            agentId: 'fast-agent',
            input: { message: 'test' },
            resilience: {
              retry: {
                maxAttempts: 3,
                backoffStrategy: 'fixed',
                initialDelay: 10,
                maxDelay: 10,
                jitterStrategy: 'none',
              },
              timeout: 2000, // Long timeout
            },
          },
        ],
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'fast-agent') return fastAgent
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Cancel immediately
      abortController.abort()

      // Act
      const result = await engine.execute(workflow, {}, abortController.signal)

      // Assert - workflow should be cancelled
      expect(result.status).toBe('cancelled')
      expect(result.steps['fast-step']).toMatchObject({
        status: 'cancelled',
        error: {
          code: ExecutionErrorCode.CANCELLED, // Cancellation error
          message: expect.stringContaining('cancelled'),
        },
      })
    })
  })

  describe('error mapping integration', () => {
    it('should map resilience errors to schema ExecutionError codes', async () => {
      // Arrange: Agent that times out
      const timeoutAgent: Agent = {
        id: 'timeout-agent',
        name: 'Timeout Agent',
        execute: vi.fn().mockImplementation(async () => {
          // Simulate operation that takes longer than timeout
          await new Promise((resolve) => setTimeout(resolve, 500))
          return { result: 'never-reached' }
        }),
      }

      const workflow: Workflow = {
        id: 'error-mapping-workflow',
        name: 'Error Mapping Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'timeout-step',
            type: 'agent',
            agentId: 'timeout-agent',
            input: { message: 'test' },
            resilience: {
              retry: {
                maxAttempts: 1, // No retries
                backoffStrategy: 'fixed',
                initialDelay: 10,
                maxDelay: 10,
                jitterStrategy: 'none',
              },
              timeout: 200, // Short timeout (less than agent's 500ms)
            },
          },
        ],
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'timeout-agent') return timeoutAgent
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const result = await engine.execute(workflow, {}, abortController.signal)

      // Assert
      expect(result.status).toBe('failed')
      expect(result.steps['timeout-step']).toMatchObject({
        status: 'failed',
        error: {
          code: ExecutionErrorCode.TIMEOUT, // Should be mapped from TimeoutError
          message: expect.stringContaining('timed out'),
        },
      })
    })
  })
})
