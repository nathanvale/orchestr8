import type { Workflow } from '@orchestr8/schema'

import { createExecutionError, ExecutionErrorCode } from '@orchestr8/schema'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { Agent, AgentRegistry, ResilienceAdapter } from './types.js'

import { OrchestrationEngine } from './orchestration-engine.js'

describe('OrchestrationEngine', () => {
  let mockAgentRegistry: AgentRegistry
  let mockResilienceAdapter: ResilienceAdapter
  let engine: OrchestrationEngine
  let strictEngine: OrchestrationEngine

  beforeEach(() => {
    // Create mock agent registry
    mockAgentRegistry = {
      getAgent: vi.fn(),
      hasAgent: vi.fn(),
      registerAgent: vi.fn(),
    }

    // Create mock resilience adapter
    mockResilienceAdapter = {
      applyPolicy: vi.fn().mockImplementation((operation) => operation()),
    }

    // Create engine instance
    engine = new OrchestrationEngine({
      agentRegistry: mockAgentRegistry,
      resilienceAdapter: mockResilienceAdapter,
    })

    // Create strict mode engine instance
    strictEngine = new OrchestrationEngine({
      agentRegistry: mockAgentRegistry,
      resilienceAdapter: mockResilienceAdapter,
      strictConditions: true,
    })
  })

  describe('execute()', () => {
    it('should execute a simple sequential workflow', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'agent1',
            input: {
              message: 'hello',
            },
          },
          {
            id: 'step2',
            type: 'agent',
            agentId: 'agent2',
            dependsOn: ['step1'],
            input: {
              data: '${steps.step1.output}',
            },
          },
        ],
      }

      const mockAgent1: Agent = {
        id: 'agent1',
        name: 'Agent 1',
        execute: vi
          .fn()
          .mockImplementation(async () => ({ result: 'step1-result' })),
      }

      const mockAgent2: Agent = {
        id: 'agent2',
        name: 'Agent 2',
        execute: vi
          .fn()
          .mockImplementation(async () => ({ result: 'step2-result' })),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'agent1') return mockAgent1
        if (id === 'agent2') return mockAgent2
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result).toMatchObject({
        executionId: expect.any(String),
        status: 'completed',
        steps: {
          step1: {
            stepId: 'step1',
            status: 'completed',
            output: { result: 'step1-result' },
            startTime: expect.any(String),
            endTime: expect.any(String),
          },
          step2: {
            stepId: 'step2',
            status: 'completed',
            output: { result: 'step2-result' },
            startTime: expect.any(String),
            endTime: expect.any(String),
          },
        },
        startTime: expect.any(String),
        endTime: expect.any(String),
        duration: expect.any(Number),
      })

      expect(mockAgent1.execute).toHaveBeenCalledWith(
        { message: 'hello' },
        expect.objectContaining({
          executionId: expect.any(String),
        }),
        expect.any(AbortSignal),
      )

      expect(mockAgent2.execute).toHaveBeenCalledWith(
        { data: { result: 'step1-result' } },
        expect.objectContaining({
          executionId: expect.any(String),
        }),
        expect.any(AbortSignal),
      )
    })

    it('should execute parallel steps concurrently', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'parallel-workflow',
        name: 'Parallel Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'agent1',
          },
          {
            id: 'step2',
            type: 'agent',
            agentId: 'agent2',
          },
          {
            id: 'step3',
            type: 'agent',
            agentId: 'agent3',
            dependsOn: ['step1', 'step2'],
          },
        ],
      }

      const executionOrder: string[] = []

      const createMockAgent = (id: string): Agent => ({
        id,
        name: `Agent ${id}`,
        execute: vi.fn().mockImplementation(async () => {
          executionOrder.push(`${id}-start`)
          await new Promise((resolve) => setTimeout(resolve, 10))
          executionOrder.push(`${id}-end`)
          return { result: `${id}-result` }
        }),
      })

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'agent1') return createMockAgent('agent1')
        if (id === 'agent2') return createMockAgent('agent2')
        if (id === 'agent3') return createMockAgent('agent3')
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const result = await engine.execute(workflow)

      // Assert - steps 1 and 2 should start before either ends (parallel)
      expect(executionOrder).toEqual([
        'agent1-start',
        'agent2-start',
        'agent1-end',
        'agent2-end',
        'agent3-start',
        'agent3-end',
      ])

      expect(result.status).toBe('completed')
      expect(result.steps.step1.status).toBe('completed')
      expect(result.steps.step2.status).toBe('completed')
      expect(result.steps.step3.status).toBe('completed')
    })

    it('should handle step failures with fail-fast semantics', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'fail-workflow',
        name: 'Fail Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'agent1',
          },
          {
            id: 'step2',
            type: 'agent',
            agentId: 'agent2',
          },
          {
            id: 'step3',
            type: 'agent',
            agentId: 'agent3',
            dependsOn: ['step1', 'step2'],
          },
        ],
      }

      const mockAgent1: Agent = {
        id: 'agent1',
        name: 'Agent 1',
        execute: vi.fn().mockImplementation(async () => {
          throw createExecutionError(
            ExecutionErrorCode.RETRYABLE,
            'Step 1 failed',
            { stepId: 'step1' },
          )
        }),
      }

      const mockAgent2: Agent = {
        id: 'agent2',
        name: 'Agent 2',
        execute: vi.fn().mockImplementation(async (_, __, signal) => {
          // Add a small delay so cancellation can happen
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => resolve({ result: 'step2-result' }),
              10,
            )
            signal?.addEventListener('abort', () => {
              clearTimeout(timeout)
              reject(
                createExecutionError(
                  ExecutionErrorCode.CANCELLED,
                  'Cancelled due to failure in parallel step',
                ),
              )
            })
          })
          return { result: 'step2-result' }
        }),
      }

      const mockAgent3: Agent = {
        id: 'agent3',
        name: 'Agent 3',
        execute: vi
          .fn()
          .mockImplementation(async () => ({ result: 'step3-result' })),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'agent1') return mockAgent1
        if (id === 'agent2') return mockAgent2
        if (id === 'agent3') return mockAgent3
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('failed')
      expect(result.steps.step1.status).toBe('failed')
      expect(result.steps.step1.error).toMatchObject({
        code: ExecutionErrorCode.RETRYABLE,
        message: 'Step 1 failed',
      })
      expect(result.steps.step2.status).toBe('cancelled')
      expect(result.steps.step3.status).toBe('skipped')
      expect(mockAgent3.execute).not.toHaveBeenCalled()
    })

    it('should respect conditional execution with if/unless', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'conditional-workflow',
        name: 'Conditional Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'agent1',
            input: { value: true },
          },
          {
            id: 'step2',
            type: 'agent',
            agentId: 'agent2',
            dependsOn: ['step1'],
            if: 'steps.step1.output.value',
          },
          {
            id: 'step3',
            type: 'agent',
            agentId: 'agent3',
            dependsOn: ['step1'],
            unless: 'steps.step1.output.value',
          },
        ],
      }

      const mockAgent1: Agent = {
        id: 'agent1',
        name: 'Agent 1',
        execute: vi.fn().mockImplementation(async (input) => input),
      }

      const mockAgent2: Agent = {
        id: 'agent2',
        name: 'Agent 2',
        execute: vi
          .fn()
          .mockImplementation(async () => ({ result: 'step2-result' })),
      }

      const mockAgent3: Agent = {
        id: 'agent3',
        name: 'Agent 3',
        execute: vi
          .fn()
          .mockImplementation(async () => ({ result: 'step3-result' })),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'agent1') return mockAgent1
        if (id === 'agent2') return mockAgent2
        if (id === 'agent3') return mockAgent3
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(result.steps.step2.status).toBe('completed')
      expect(result.steps.step3.status).toBe('skipped')
      expect(mockAgent2.execute).toHaveBeenCalled()
      expect(mockAgent3.execute).not.toHaveBeenCalled()
    })

    it('should apply resilience policies to step execution', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'resilient-workflow',
        name: 'Resilient Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'agent1',
          },
        ],
      }

      const mockAgent1: Agent = {
        id: 'agent1',
        name: 'Agent 1',
        execute: vi
          .fn()
          .mockImplementation(async () => ({ result: 'success' })),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'agent1') return mockAgent1
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      // Manually add resilience to the step (since it's not part of schema)
      const originalBuildGraph = engine['buildExecutionGraph'].bind(engine)
      engine['buildExecutionGraph'] = (wf) => {
        const graph = originalBuildGraph(wf)
        graph.nodes.get('step1')!.resilience = {
          retry: {
            maxAttempts: 3,
            backoffStrategy: 'exponential',
            jitterStrategy: 'full-jitter',
            initialDelay: 100,
            maxDelay: 1000,
          },
          timeout: 5000,
        }
        return graph
      }

      await engine.execute(workflow)

      // Assert
      expect(mockResilienceAdapter.applyPolicy).toHaveBeenCalledWith(
        expect.any(Function),
        {
          retry: {
            maxAttempts: 3,
            backoffStrategy: 'exponential',
            jitterStrategy: 'full-jitter',
            initialDelay: 100,
            maxDelay: 1000,
          },
          timeout: 5000,
        },
        expect.any(AbortSignal),
      )
    })

    it('should handle workflow cancellation with AbortSignal', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'cancel-workflow',
        name: 'Cancel Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'agent1',
          },
          {
            id: 'step2',
            type: 'agent',
            agentId: 'agent2',
            dependsOn: ['step1'],
          },
        ],
      }

      const abortController = new AbortController()

      const mockAgent1: Agent = {
        id: 'agent1',
        name: 'Agent 1',
        execute: vi.fn().mockImplementation(async (_, __, signal) => {
          // Check if already aborted
          if (signal?.aborted) {
            throw createExecutionError(
              ExecutionErrorCode.CANCELLED,
              'Operation cancelled',
            )
          }

          // Simulate async work
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, 100)
            signal?.addEventListener('abort', () => {
              clearTimeout(timeout)
              reject(
                createExecutionError(
                  ExecutionErrorCode.CANCELLED,
                  'Operation cancelled',
                ),
              )
            })
          })
          return { result: 'step1-result' }
        }),
      }

      const mockAgent2: Agent = {
        id: 'agent2',
        name: 'Agent 2',
        execute: vi
          .fn()
          .mockImplementation(async () => ({ result: 'step2-result' })),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'agent1') return mockAgent1
        if (id === 'agent2') return mockAgent2
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const promise = engine.execute(workflow, {}, abortController.signal)
      // Abort quickly but after execution starts
      setTimeout(() => abortController.abort(), 10)
      const result = await promise

      // Assert
      // The workflow should be cancelled if abort happened in time
      // Step1 might complete before cancellation (race condition)
      if (result.steps.step1.status === 'completed') {
        // If step1 completed before cancellation, step2 would be cancelled or skipped
        expect(result.status).toBe('cancelled')
        expect(['skipped', 'cancelled']).toContain(result.steps.step2.status)
      } else {
        // If step1 was cancelled
        expect(result.status).toBe('cancelled')
        expect(['cancelled', 'failed']).toContain(result.steps.step1.status)
        if (result.steps.step1.status === 'failed') {
          expect(result.steps.step1.error?.code).toBe(
            ExecutionErrorCode.CANCELLED,
          )
        }
        expect(result.steps.step2.status).toBe('skipped')
        expect(mockAgent2.execute).not.toHaveBeenCalled()
      }
    })

    it('should enforce memory limits on step results', async () => {
      // Arrange
      const largeData = 'x'.repeat(600 * 1024) // 600KB string

      const workflow: Workflow = {
        id: 'memory-workflow',
        name: 'Memory Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'agent1',
          },
        ],
      }

      const mockAgent1: Agent = {
        id: 'agent1',
        name: 'Agent 1',
        execute: vi.fn().mockImplementation(async () => ({ data: largeData })),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'agent1') return mockAgent1
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(result.steps.step1.status).toBe('completed')
      expect(result.steps.step1.truncated).toBe(true)
      expect(result.steps.step1.originalSize).toBeGreaterThan(512 * 1024)
      expect(result.steps.step1.retainedBytes).toBeLessThanOrEqual(512 * 1024)
    })

    it('should handle fallback step execution on failure', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'fallback-workflow',
        name: 'Fallback Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'primary',
            type: 'agent',
            agentId: 'agent1',
            onError: 'fallback',
            fallbackStepId: 'backup',
          },
          {
            id: 'backup',
            type: 'agent',
            agentId: 'agent2',
          },
          {
            id: 'dependent',
            type: 'agent',
            agentId: 'agent3',
            dependsOn: ['primary'],
            input: {
              data: '${steps.primary.output}',
            },
          },
        ],
      }

      const mockAgent1: Agent = {
        id: 'agent1',
        name: 'Agent 1',
        execute: vi.fn().mockImplementation(async () => {
          throw createExecutionError(
            ExecutionErrorCode.RETRYABLE,
            'Primary failed',
          )
        }),
      }

      const mockAgent2: Agent = {
        id: 'agent2',
        name: 'Agent 2',
        execute: vi
          .fn()
          .mockImplementation(async () => ({ result: 'backup-result' })),
      }

      const mockAgent3: Agent = {
        id: 'agent3',
        name: 'Agent 3',
        execute: vi
          .fn()
          .mockImplementation(async (input) => ({ received: input })),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'agent1') return mockAgent1
        if (id === 'agent2') return mockAgent2
        if (id === 'agent3') return mockAgent3
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(result.steps.primary.status).toBe('failed')
      expect(result.steps.backup.status).toBe('completed')
      expect(result.steps.backup.aliasFor).toBe('primary')
      expect(result.steps.dependent.status).toBe('completed')
      expect(mockAgent3.execute).toHaveBeenCalledWith(
        { data: { result: 'backup-result' } },
        expect.any(Object),
        expect.any(AbortSignal),
      )
    })
  })

  describe('fallback with dependencies', () => {
    it('should check fallback dependencies before execution', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'primary',
            type: 'agent',
            agentId: 'agent1',
            onError: 'fallback',
            fallbackStepId: 'backup',
            input: { test: true },
          },
          {
            id: 'dependency',
            type: 'agent',
            agentId: 'agent2',
            input: { data: 'test' },
          },
          {
            id: 'backup',
            type: 'agent',
            agentId: 'agent3',
            dependsOn: ['dependency'], // Fallback depends on another step
            input: { fallback: true },
          },
        ],
      }

      const mockAgent1: Agent = {
        id: 'agent1',
        name: 'Agent 1',
        execute: vi.fn().mockRejectedValue(new Error('Primary failed')),
      }

      const mockAgent2: Agent = {
        id: 'agent2',
        name: 'Agent 2',
        execute: vi.fn().mockImplementation(async () => ({ result: 'dep-ok' })),
      }

      const mockAgent3: Agent = {
        id: 'agent3',
        name: 'Agent 3',
        execute: vi
          .fn()
          .mockImplementation(async () => ({ result: 'backup-ok' })),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'agent1') return mockAgent1
        if (id === 'agent2') return mockAgent2
        if (id === 'agent3') return mockAgent3
        throw new Error(`Agent not found: ${id}`)
      })

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(result.steps.primary.status).toBe('failed')
      expect(result.steps.dependency.status).toBe('completed')
      expect(result.steps.backup.status).toBe('completed')
      expect(result.steps.backup.aliasFor).toBe('primary')
    })

    it('should fail if fallback dependencies are not met', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'primary',
            type: 'agent',
            agentId: 'agent1',
            onError: 'fallback',
            fallbackStepId: 'backup',
            input: { test: true },
          },
          {
            id: 'missing-dep',
            type: 'agent',
            agentId: 'agent2',
            if: 'variables.shouldExecute', // Will be skipped
            input: { data: 'test' },
          },
          {
            id: 'backup',
            type: 'agent',
            agentId: 'agent3',
            dependsOn: ['missing-dep'], // Depends on skipped step
            input: { fallback: true },
          },
        ],
      }

      const mockAgent1: Agent = {
        id: 'agent1',
        name: 'Agent 1',
        execute: vi.fn().mockRejectedValue(new Error('Primary failed')),
      }

      const mockAgent2: Agent = {
        id: 'agent2',
        name: 'Agent 2',
        execute: vi.fn().mockImplementation(async () => ({ result: 'dep-ok' })),
      }

      const mockAgent3: Agent = {
        id: 'agent3',
        name: 'Agent 3',
        execute: vi
          .fn()
          .mockImplementation(async () => ({ result: 'backup-ok' })),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'agent1') return mockAgent1
        if (id === 'agent2') return mockAgent2
        if (id === 'agent3') return mockAgent3
        throw new Error(`Agent not found: ${id}`)
      })

      // Act
      const result = await engine.execute(workflow, { shouldExecute: false })

      // Assert
      expect(result.status).toBe('failed')
      expect(result.steps.primary.status).toBe('failed')
      expect(result.steps['missing-dep'].status).toBe('skipped')
      // Backup should be skipped due to unmet dependencies
      expect(result.steps.backup?.status).toBe('skipped')
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0]?.message).toContain('Primary failed')
    })
  })

  describe('retry mechanism', () => {
    it('should retry failed steps with onError: retry', async () => {
      // Arrange
      let attemptCount = 0
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'flaky-step',
            type: 'agent',
            agentId: 'flaky-agent',
            onError: 'retry',
            input: { test: true },
          },
        ],
      }

      const mockAgent: Agent = {
        id: 'flaky-agent',
        name: 'Flaky Agent',
        execute: vi.fn().mockImplementation(async () => {
          attemptCount++
          if (attemptCount < 2) {
            throw new Error('Temporary failure')
          }
          return { result: 'success' }
        }),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockResolvedValue(mockAgent)

      // Mock resilience adapter to actually retry
      vi.mocked(mockResilienceAdapter.applyPolicy).mockImplementation(
        async (operation, policy) => {
          let lastError
          const retryConfig = policy?.retry || { maxAttempts: 3 }
          for (let i = 0; i < retryConfig.maxAttempts; i++) {
            try {
              return await operation()
            } catch (error) {
              lastError = error
              if (i < retryConfig.maxAttempts - 1) {
                // Wait before retry (simplified, no exponential backoff)
                await new Promise((resolve) => setTimeout(resolve, 10))
              }
            }
          }
          throw lastError
        },
      )

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(result.steps['flaky-step'].status).toBe('completed')
      expect(result.steps['flaky-step'].output).toEqual({ result: 'success' })
      expect(mockAgent.execute).toHaveBeenCalledTimes(2)
    })

    it('should fail after retry attempts are exhausted', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'always-fails',
            type: 'agent',
            agentId: 'failing-agent',
            onError: 'retry',
            input: { test: true },
          },
        ],
      }

      const mockAgent: Agent = {
        id: 'failing-agent',
        name: 'Failing Agent',
        execute: vi.fn().mockRejectedValue(new Error('Permanent failure')),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockResolvedValue(mockAgent)

      // Mock resilience adapter to actually retry
      vi.mocked(mockResilienceAdapter.applyPolicy).mockImplementation(
        async (operation, policy) => {
          let lastError
          const retryConfig = policy?.retry || { maxAttempts: 3 }
          for (let i = 0; i < retryConfig.maxAttempts; i++) {
            try {
              return await operation()
            } catch (error) {
              lastError = error
            }
          }
          throw lastError
        },
      )

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('failed')
      expect(result.steps['always-fails'].status).toBe('failed')
      expect(result.steps['always-fails'].error?.message).toContain(
        'Permanent failure',
      )
      expect(mockAgent.execute).toHaveBeenCalledTimes(3) // Initial + retries
    })
  })

  describe('strict mode conditions', () => {
    it('should silently skip invalid conditions in non-strict mode', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'agent1',
            if: 'invalid.syntax[', // Invalid JMESPath
            input: { test: true },
          },
        ],
      }

      const mockAgent: Agent = {
        id: 'agent1',
        name: 'Agent 1',
        execute: vi.fn().mockImplementation(async () => ({ result: 'ok' })),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockResolvedValue(mockAgent)

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(result.steps.step1.status).toBe('skipped')
      expect(mockAgent.execute).not.toHaveBeenCalled()
    })

    it('should throw validation error for invalid conditions in strict mode', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'agent1',
            if: 'invalid.syntax[', // Invalid JMESPath
            input: { test: true },
          },
        ],
      }

      const mockAgent: Agent = {
        id: 'agent1',
        name: 'Agent 1',
        execute: vi.fn().mockImplementation(async () => ({ result: 'ok' })),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockResolvedValue(mockAgent)

      // Act
      const result = await strictEngine.execute(workflow)

      // Assert
      expect(result.status).toBe('failed')
      expect(result.steps.step1.status).toBe('failed')
      expect(result.steps.step1.error?.code).toBe('VALIDATION')
      expect(result.steps.step1.error?.message).toContain(
        'Condition evaluation failed',
      )
      expect(mockAgent.execute).not.toHaveBeenCalled()
    })

    it('should handle valid conditions in strict mode', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'agent1',
            input: { value: 'test' },
          },
          {
            id: 'step2',
            type: 'agent',
            agentId: 'agent2',
            if: 'steps.step1.output.result', // Valid condition
            dependsOn: ['step1'],
            input: { data: 'test' },
          },
        ],
      }

      const mockAgent1: Agent = {
        id: 'agent1',
        name: 'Agent 1',
        execute: vi.fn().mockImplementation(async () => ({ result: true })),
      }

      const mockAgent2: Agent = {
        id: 'agent2',
        name: 'Agent 2',
        execute: vi.fn().mockImplementation(async () => ({ result: 'ok' })),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'agent1') return mockAgent1
        if (id === 'agent2') return mockAgent2
        throw new Error(`Agent not found: ${id}`)
      })

      // Act
      const result = await strictEngine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')
      expect(result.steps.step1.status).toBe('completed')
      expect(result.steps.step2.status).toBe('completed')
      expect(mockAgent1.execute).toHaveBeenCalled()
      expect(mockAgent2.execute).toHaveBeenCalled()
    })
  })
})
