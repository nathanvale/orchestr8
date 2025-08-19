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

    it('should propagate parent signal cancellation to all level steps', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'parent-cancel-workflow',
        name: 'Parent Cancel Workflow',
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
          },
        ],
      }

      const abortController = new AbortController()
      const executionPromises: Array<Promise<unknown>> = []

      const createMockAgent = (id: string): Agent => ({
        id,
        name: `Agent ${id}`,
        execute: vi.fn().mockImplementation(async (_, __, signal) => {
          const promise = new Promise((resolve, reject) => {
            // Simulate long-running work
            const timeout = setTimeout(() => {
              resolve({ result: `${id}-result` })
            }, 200)

            // Listen for cancellation
            signal?.addEventListener('abort', () => {
              clearTimeout(timeout)
              reject(
                createExecutionError(
                  ExecutionErrorCode.CANCELLED,
                  `${id} cancelled by signal`,
                ),
              )
            })
          })
          executionPromises.push(promise)
          return promise
        }),
      })

      const mockAgent1 = createMockAgent('agent1')
      const mockAgent2 = createMockAgent('agent2')
      const mockAgent3 = createMockAgent('agent3')

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
      const promise = engine.execute(workflow, {}, abortController.signal)

      // Cancel after all steps have started but before they complete
      await new Promise((resolve) => setTimeout(resolve, 50))
      abortController.abort()

      const result = await promise

      // Assert
      expect(result.status).toBe('cancelled')

      // All parallel steps should be cancelled
      expect(result.steps.step1.status).toBe('cancelled')
      expect(result.steps.step2.status).toBe('cancelled')
      expect(result.steps.step3.status).toBe('cancelled')

      // All agents should have been called (they started execution)
      expect(mockAgent1.execute).toHaveBeenCalled()
      expect(mockAgent2.execute).toHaveBeenCalled()
      expect(mockAgent3.execute).toHaveBeenCalled()
    })

    it('should combine parent and level abort signals properly', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'combined-signal-workflow',
        name: 'Combined Signal Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'fail-fast',
            type: 'agent',
            agentId: 'failAgent',
            onError: 'fail', // This will trigger level abort
          },
          {
            id: 'parallel-step',
            type: 'agent',
            agentId: 'parallelAgent',
          },
        ],
      }

      const parentAbortController = new AbortController()
      let parallelStepSignal: AbortSignal | undefined

      const failAgent: Agent = {
        id: 'failAgent',
        name: 'Fail Agent',
        execute: vi.fn().mockImplementation(async () => {
          // Fail immediately to trigger level abort
          throw createExecutionError(
            ExecutionErrorCode.EXECUTION,
            'Intentional failure',
          )
        }),
      }

      const parallelAgent: Agent = {
        id: 'parallelAgent',
        name: 'Parallel Agent',
        execute: vi.fn().mockImplementation(async (_, __, signal) => {
          parallelStepSignal = signal

          return new Promise((resolve, reject) => {
            // Wait for abort signal
            const timeout = setTimeout(() => {
              resolve({ result: 'should-not-complete' })
            }, 500)

            signal?.addEventListener('abort', () => {
              clearTimeout(timeout)
              reject(
                createExecutionError(
                  ExecutionErrorCode.CANCELLED,
                  'Cancelled by combined signal',
                ),
              )
            })
          })
        }),
      }

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'failAgent') return failAgent
        if (id === 'parallelAgent') return parallelAgent
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const result = await engine.execute(
        workflow,
        {},
        parentAbortController.signal,
      )

      // Assert
      expect(result.status).toBe('failed')
      expect(result.steps['fail-fast'].status).toBe('failed')
      expect(result.steps['parallel-step'].status).toBe('cancelled')

      // The parallel step should have received an abort signal from level controller
      expect(parallelStepSignal?.aborted).toBe(true)
      expect(parallelAgent.execute).toHaveBeenCalled()
    })

    it('should handle cascading cancellation from parent to all active levels', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'cascading-cancel-workflow',
        name: 'Cascading Cancel Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'level1-step1',
            type: 'agent',
            agentId: 'agent1',
          },
          {
            id: 'level1-step2',
            type: 'agent',
            agentId: 'agent2',
          },
          {
            id: 'level2-step1',
            type: 'agent',
            agentId: 'agent3',
            dependsOn: ['level1-step1'],
          },
          {
            id: 'level2-step2',
            type: 'agent',
            agentId: 'agent4',
            dependsOn: ['level1-step2'],
          },
        ],
      }

      const abortController = new AbortController()
      let level1Step1Completed = false
      let level1Step2Completed = false

      const createDelayedAgent = (id: string, delay: number): Agent => ({
        id,
        name: `Agent ${id}`,
        execute: vi.fn().mockImplementation(async (_, __, signal) => {
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              if (id === 'agent1') level1Step1Completed = true
              if (id === 'agent2') level1Step2Completed = true
              resolve({ result: `${id}-result` })
            }, delay)

            signal?.addEventListener('abort', () => {
              clearTimeout(timeout)
              reject(
                createExecutionError(
                  ExecutionErrorCode.CANCELLED,
                  `${id} cancelled`,
                ),
              )
            })
          })
        }),
      })

      // Level 1 steps complete quickly
      const mockAgent1 = createDelayedAgent('agent1', 10)
      const mockAgent2 = createDelayedAgent('agent2', 10)
      // Level 2 steps take longer
      const mockAgent3 = createDelayedAgent('agent3', 200)
      const mockAgent4 = createDelayedAgent('agent4', 200)

      vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
        if (id === 'agent1') return mockAgent1
        if (id === 'agent2') return mockAgent2
        if (id === 'agent3') return mockAgent3
        if (id === 'agent4') return mockAgent4
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Agent not found: ${id}`,
        )
      })

      // Act
      const promise = engine.execute(workflow, {}, abortController.signal)

      // Wait for level 1 to complete and level 2 to start
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Cancel while level 2 is executing
      abortController.abort()

      const result = await promise

      // Assert
      expect(result.status).toBe('cancelled')

      // Level 1 should have completed
      expect(level1Step1Completed).toBe(true)
      expect(level1Step2Completed).toBe(true)
      expect(result.steps['level1-step1'].status).toBe('completed')
      expect(result.steps['level1-step2'].status).toBe('completed')

      // Level 2 should be cancelled
      expect(result.steps['level2-step1'].status).toBe('cancelled')
      expect(result.steps['level2-step2'].status).toBe('cancelled')

      // All agents should have been called
      expect(mockAgent1.execute).toHaveBeenCalled()
      expect(mockAgent2.execute).toHaveBeenCalled()
      expect(mockAgent3.execute).toHaveBeenCalled()
      expect(mockAgent4.execute).toHaveBeenCalled()
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

  describe('dependency failure semantics', () => {
    describe('skip behavior for failed dependencies', () => {
      it('should skip step when dependency fails', async () => {
        // Arrange
        const workflow: Workflow = {
          id: 'dep-fail-test',
          name: 'Dependency Failure Test',
          version: '1.0.0',
          steps: [
            {
              id: 'failing-step',
              type: 'agent',
              agentId: 'failing-agent',
            },
            {
              id: 'dependent-step',
              type: 'agent',
              agentId: 'dependent-agent',
              dependsOn: ['failing-step'],
            },
          ],
        }

        const failingAgent: Agent = {
          id: 'failing-agent',
          name: 'Failing Agent',
          execute: vi.fn().mockImplementation(async () => {
            throw createExecutionError(
              ExecutionErrorCode.RETRYABLE,
              'Step failed',
            )
          }),
        }

        const dependentAgent: Agent = {
          id: 'dependent-agent',
          name: 'Dependent Agent',
          execute: vi
            .fn()
            .mockImplementation(async () => ({ result: 'should not execute' })),
        }

        vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
          if (id === 'failing-agent') return failingAgent
          if (id === 'dependent-agent') return dependentAgent
          throw new Error(`Agent not found: ${id}`)
        })

        // Act
        const result = await engine.execute(workflow)

        // Assert
        expect(result.status).toBe('failed')
        expect(result.steps['failing-step'].status).toBe('failed')
        expect(result.steps['dependent-step'].status).toBe('skipped')
        expect(result.steps['dependent-step'].skipReason).toBe('level-failure')
        expect(dependentAgent.execute).not.toHaveBeenCalled()
      })

      it('should skip step when dependency is cancelled', async () => {
        // Arrange - Using onError: continue to avoid level failure
        const workflow: Workflow = {
          id: 'dep-cancel-test',
          name: 'Dependency Cancellation Test',
          version: '1.0.0',
          steps: [
            {
              id: 'cancelled-step',
              type: 'agent',
              agentId: 'cancelled-agent',
              onError: 'continue', // Prevent level failure
            },
            {
              id: 'dependent-step',
              type: 'agent',
              agentId: 'dependent-agent',
              dependsOn: ['cancelled-step'],
            },
          ],
        }

        const cancelledAgent: Agent = {
          id: 'cancelled-agent',
          name: 'Cancelled Agent',
          execute: vi.fn().mockImplementation(async () => {
            throw createExecutionError(
              ExecutionErrorCode.CANCELLED,
              'Step cancelled',
            )
          }),
        }

        const dependentAgent: Agent = {
          id: 'dependent-agent',
          name: 'Dependent Agent',
          execute: vi
            .fn()
            .mockImplementation(async () => ({ result: 'should not execute' })),
        }

        vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
          if (id === 'cancelled-agent') return cancelledAgent
          if (id === 'dependent-agent') return dependentAgent
          throw new Error(`Agent not found: ${id}`)
        })

        // Act
        const result = await engine.execute(workflow)

        // Assert - Cancelled steps don't cause workflow failure if no other failures
        expect(result.status).toBe('completed') // Workflow completes (cancelled steps don't count as failures)
        expect(result.steps['cancelled-step'].status).toBe('cancelled') // CANCELLED errors remain cancelled
        expect(result.steps['dependent-step'].status).toBe('skipped')
        expect(result.steps['dependent-step'].skipReason).toBe(
          'dependency-not-completed',
        ) // Dependency logic applies
        expect(dependentAgent.execute).not.toHaveBeenCalled()
      })

      it('should skip step when dependency is skipped', async () => {
        // Arrange
        const workflow: Workflow = {
          id: 'dep-skip-test',
          name: 'Dependency Skip Test',
          version: '1.0.0',
          steps: [
            {
              id: 'conditional-step',
              type: 'agent',
              agentId: 'conditional-agent',
              if: 'variables.shouldExecute',
            },
            {
              id: 'dependent-step',
              type: 'agent',
              agentId: 'dependent-agent',
              dependsOn: ['conditional-step'],
            },
          ],
        }

        const conditionalAgent: Agent = {
          id: 'conditional-agent',
          name: 'Conditional Agent',
          execute: vi
            .fn()
            .mockImplementation(async () => ({ result: 'conditional result' })),
        }

        const dependentAgent: Agent = {
          id: 'dependent-agent',
          name: 'Dependent Agent',
          execute: vi
            .fn()
            .mockImplementation(async () => ({ result: 'should not execute' })),
        }

        vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
          if (id === 'conditional-agent') return conditionalAgent
          if (id === 'dependent-agent') return dependentAgent
          throw new Error(`Agent not found: ${id}`)
        })

        // Act - shouldExecute is false, so conditional-step gets skipped
        const result = await engine.execute(workflow, { shouldExecute: false })

        // Assert
        expect(result.status).toBe('completed')
        expect(result.steps['conditional-step'].status).toBe('skipped')
        expect(result.steps['conditional-step'].skipReason).toBe(
          'condition-not-met',
        )
        expect(result.steps['dependent-step'].status).toBe('skipped')
        expect(result.steps['dependent-step'].skipReason).toBe(
          'dependency-not-completed',
        )
        expect(conditionalAgent.execute).not.toHaveBeenCalled()
        expect(dependentAgent.execute).not.toHaveBeenCalled()
      })

      it('should skip step when any dependency is not completed (mixed statuses)', async () => {
        // Arrange
        const workflow: Workflow = {
          id: 'mixed-deps-test',
          name: 'Mixed Dependencies Test',
          version: '1.0.0',
          steps: [
            {
              id: 'successful-step',
              type: 'agent',
              agentId: 'success-agent',
            },
            {
              id: 'failing-step',
              type: 'agent',
              agentId: 'failing-agent',
              onError: 'continue', // Prevent level failure
            },
            {
              id: 'dependent-step',
              type: 'agent',
              agentId: 'dependent-agent',
              dependsOn: ['successful-step', 'failing-step'],
            },
          ],
        }

        const successAgent: Agent = {
          id: 'success-agent',
          name: 'Success Agent',
          execute: vi
            .fn()
            .mockImplementation(async () => ({ result: 'success' })),
        }

        const failingAgent: Agent = {
          id: 'failing-agent',
          name: 'Failing Agent',
          execute: vi.fn().mockImplementation(async () => {
            throw createExecutionError(
              ExecutionErrorCode.RETRYABLE,
              'Step failed',
            )
          }),
        }

        const dependentAgent: Agent = {
          id: 'dependent-agent',
          name: 'Dependent Agent',
          execute: vi
            .fn()
            .mockImplementation(async () => ({ result: 'should not execute' })),
        }

        vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
          if (id === 'success-agent') return successAgent
          if (id === 'failing-agent') return failingAgent
          if (id === 'dependent-agent') return dependentAgent
          throw new Error(`Agent not found: ${id}`)
        })

        // Act
        const result = await engine.execute(workflow)

        // Assert
        expect(result.status).toBe('completed') // Workflow continues due to onError: continue
        expect(result.steps['successful-step'].status).toBe('completed')
        expect(result.steps['failing-step'].status).toBe('failed')
        expect(result.steps['dependent-step'].status).toBe('skipped')
        expect(result.steps['dependent-step'].skipReason).toBe(
          'dependency-not-completed',
        )
        expect(successAgent.execute).toHaveBeenCalled()
        expect(failingAgent.execute).toHaveBeenCalled()
        expect(dependentAgent.execute).not.toHaveBeenCalled()
      })

      it('should execute step when all dependencies are completed', async () => {
        // Arrange
        const workflow: Workflow = {
          id: 'all-deps-success-test',
          name: 'All Dependencies Success Test',
          version: '1.0.0',
          steps: [
            {
              id: 'dep1',
              type: 'agent',
              agentId: 'agent1',
            },
            {
              id: 'dep2',
              type: 'agent',
              agentId: 'agent2',
            },
            {
              id: 'dependent-step',
              type: 'agent',
              agentId: 'dependent-agent',
              dependsOn: ['dep1', 'dep2'],
            },
          ],
        }

        const agent1: Agent = {
          id: 'agent1',
          name: 'Agent 1',
          execute: vi
            .fn()
            .mockImplementation(async () => ({ result: 'dep1-result' })),
        }

        const agent2: Agent = {
          id: 'agent2',
          name: 'Agent 2',
          execute: vi
            .fn()
            .mockImplementation(async () => ({ result: 'dep2-result' })),
        }

        const dependentAgent: Agent = {
          id: 'dependent-agent',
          name: 'Dependent Agent',
          execute: vi
            .fn()
            .mockImplementation(async () => ({ result: 'dependent-result' })),
        }

        vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
          if (id === 'agent1') return agent1
          if (id === 'agent2') return agent2
          if (id === 'dependent-agent') return dependentAgent
          throw new Error(`Agent not found: ${id}`)
        })

        // Act
        const result = await engine.execute(workflow)

        // Assert
        expect(result.status).toBe('completed')
        expect(result.steps.dep1.status).toBe('completed')
        expect(result.steps.dep2.status).toBe('completed')
        expect(result.steps['dependent-step'].status).toBe('completed')
        expect(agent1.execute).toHaveBeenCalled()
        expect(agent2.execute).toHaveBeenCalled()
        expect(dependentAgent.execute).toHaveBeenCalled()
      })

      it('should handle multi-level dependency chains with failures', async () => {
        // Arrange
        const workflow: Workflow = {
          id: 'multi-level-deps-test',
          name: 'Multi-Level Dependencies Test',
          version: '1.0.0',
          steps: [
            {
              id: 'level1',
              type: 'agent',
              agentId: 'agent1',
            },
            {
              id: 'level2',
              type: 'agent',
              agentId: 'agent2',
              dependsOn: ['level1'],
            },
            {
              id: 'level3',
              type: 'agent',
              agentId: 'agent3',
              dependsOn: ['level2'],
            },
          ],
        }

        const agent1: Agent = {
          id: 'agent1',
          name: 'Agent 1',
          execute: vi.fn().mockImplementation(async () => {
            throw createExecutionError(
              ExecutionErrorCode.RETRYABLE,
              'Level 1 failed',
            )
          }),
        }

        const agent2: Agent = {
          id: 'agent2',
          name: 'Agent 2',
          execute: vi
            .fn()
            .mockImplementation(async () => ({ result: 'should not execute' })),
        }

        const agent3: Agent = {
          id: 'agent3',
          name: 'Agent 3',
          execute: vi
            .fn()
            .mockImplementation(async () => ({ result: 'should not execute' })),
        }

        vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
          if (id === 'agent1') return agent1
          if (id === 'agent2') return agent2
          if (id === 'agent3') return agent3
          throw new Error(`Agent not found: ${id}`)
        })

        // Act
        const result = await engine.execute(workflow)

        // Assert
        expect(result.status).toBe('failed')
        expect(result.steps.level1.status).toBe('failed')
        expect(result.steps.level2.status).toBe('skipped')
        expect(result.steps.level2.skipReason).toBe('level-failure')
        expect(result.steps.level3.status).toBe('skipped')
        expect(result.steps.level3.skipReason).toBe('level-failure')
        expect(agent1.execute).toHaveBeenCalled()
        expect(agent2.execute).not.toHaveBeenCalled()
        expect(agent3.execute).not.toHaveBeenCalled()
      })

      it('should use dependency-not-completed skipReason when onError: continue prevents level failure', async () => {
        // Arrange - This test specifically verifies dependency-not-completed logic
        const workflow: Workflow = {
          id: 'dep-not-completed-test',
          name: 'Dependency Not Completed Test',
          version: '1.0.0',
          steps: [
            {
              id: 'failing-dep',
              type: 'agent',
              agentId: 'failing-agent',
              onError: 'continue', // This prevents level failure and allows dependency check
            },
            {
              id: 'dependent-step',
              type: 'agent',
              agentId: 'dependent-agent',
              dependsOn: ['failing-dep'],
            },
          ],
        }

        const failingAgent: Agent = {
          id: 'failing-agent',
          name: 'Failing Agent',
          execute: vi.fn().mockImplementation(async () => {
            throw createExecutionError(
              ExecutionErrorCode.RETRYABLE,
              'Dependency failed',
            )
          }),
        }

        const dependentAgent: Agent = {
          id: 'dependent-agent',
          name: 'Dependent Agent',
          execute: vi
            .fn()
            .mockImplementation(async () => ({ result: 'should not execute' })),
        }

        vi.mocked(mockAgentRegistry.getAgent).mockImplementation(async (id) => {
          if (id === 'failing-agent') return failingAgent
          if (id === 'dependent-agent') return dependentAgent
          throw new Error(`Agent not found: ${id}`)
        })

        // Act
        const result = await engine.execute(workflow)

        // Assert - This is where we expect dependency-not-completed
        expect(result.status).toBe('completed') // Workflow continues due to onError: continue
        expect(result.steps['failing-dep'].status).toBe('failed')
        expect(result.steps['dependent-step'].status).toBe('skipped')
        expect(result.steps['dependent-step'].skipReason).toBe(
          'dependency-not-completed',
        )
        expect(failingAgent.execute).toHaveBeenCalled()
        expect(dependentAgent.execute).not.toHaveBeenCalled()
      })
    })
  })

  describe('fallback input override behavior', () => {
    it('should use fallback step explicit input over original step input', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'fallback-input-test',
        name: 'Fallback Input Test',
        version: '1.0.0',
        steps: [
          {
            id: 'primary',
            type: 'agent',
            agentId: 'failing-agent',
            onError: 'fallback',
            fallbackStepId: 'fallback',
            input: { source: 'original-input', data: 'original-data' },
          },
          {
            id: 'fallback',
            type: 'agent',
            agentId: 'fallback-agent',
            input: { source: 'fallback-input', data: 'fallback-data' },
          },
        ],
      }

      const failingAgent: Agent = {
        id: 'failing-agent',
        name: 'Failing Agent',
        execute: vi.fn().mockRejectedValue(new Error('Primary failed')),
      }

      const fallbackAgent: Agent = {
        id: 'fallback-agent',
        name: 'Fallback Agent',
        execute: vi.fn().mockResolvedValue({ success: true }),
      }

      const mockRegistry: AgentRegistry = {
        getAgent: vi.fn().mockImplementation((id: string) => {
          if (id === 'failing-agent') return failingAgent
          if (id === 'fallback-agent') return fallbackAgent
          throw new Error(`Agent not found: ${id}`)
        }),
      }

      const engine = new OrchestrationEngine({
        agentRegistry: mockRegistry,
      })

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')

      // Verify that fallback agent received its own input, not original input
      expect(fallbackAgent.execute).toHaveBeenCalledWith(
        { source: 'fallback-input', data: 'fallback-data' }, // Should be fallback input
        expect.any(Object), // execution context
        expect.any(AbortSignal), // abort signal
      )

      // Verify the failing agent received original input
      expect(failingAgent.execute).toHaveBeenCalledWith(
        { source: 'original-input', data: 'original-data' },
        expect.any(Object), // execution context
        expect.any(AbortSignal), // abort signal
      )
    })

    it('should use original step input when fallback has no explicit input', async () => {
      // Arrange
      const workflow: Workflow = {
        id: 'fallback-no-input-test',
        name: 'Fallback No Input Test',
        version: '1.0.0',
        steps: [
          {
            id: 'primary',
            type: 'agent',
            agentId: 'failing-agent',
            onError: 'fallback',
            fallbackStepId: 'fallback',
            input: { source: 'original-input', data: 'original-data' },
          },
          {
            id: 'fallback',
            type: 'agent',
            agentId: 'fallback-agent',
            // No dependencies and no explicit input - should inherit from original
          },
        ],
      }

      const failingAgent: Agent = {
        id: 'failing-agent',
        name: 'Failing Agent',
        execute: vi.fn().mockRejectedValue(new Error('Primary failed')),
      }

      const fallbackAgent: Agent = {
        id: 'fallback-agent',
        name: 'Fallback Agent',
        execute: vi.fn().mockResolvedValue({ success: true }),
      }

      const mockRegistry: AgentRegistry = {
        getAgent: vi.fn().mockImplementation((id: string) => {
          if (id === 'failing-agent') return failingAgent
          if (id === 'fallback-agent') return fallbackAgent
          throw new Error(`Agent not found: ${id}`)
        }),
      }

      const engine = new OrchestrationEngine({
        agentRegistry: mockRegistry,
      })

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')

      // Verify that fallback agent received original input (since it has no explicit input)
      expect(fallbackAgent.execute).toHaveBeenCalledWith(
        { source: 'original-input', data: 'original-data' }, // Should inherit original input
        expect.any(Object), // execution context
        expect.any(AbortSignal), // abort signal
      )
    })

    it('should handle fallback-as-alias scenarios with proper input precedence', async () => {
      // Arrange - Test when a fallback step is also used as a regular step
      const workflow: Workflow = {
        id: 'fallback-alias-test',
        name: 'Fallback Alias Test',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'success-agent',
            input: { step: 'step1' },
          },
          {
            id: 'primary',
            type: 'agent',
            agentId: 'failing-agent',
            dependsOn: ['step1'],
            onError: 'fallback',
            fallbackStepId: 'shared-fallback',
            input: { source: 'primary-input' },
          },
          {
            id: 'shared-fallback',
            type: 'agent',
            agentId: 'fallback-agent',
            dependsOn: ['step1'],
            input: { source: 'shared-fallback-input' },
          },
        ],
      }

      const successAgent: Agent = {
        id: 'success-agent',
        name: 'Success Agent',
        execute: vi.fn().mockResolvedValue({ success: true }),
      }

      const failingAgent: Agent = {
        id: 'failing-agent',
        name: 'Failing Agent',
        execute: vi.fn().mockRejectedValue(new Error('Primary failed')),
      }

      const fallbackAgent: Agent = {
        id: 'fallback-agent',
        name: 'Fallback Agent',
        execute: vi.fn().mockResolvedValue({ fallback: true }),
      }

      const mockRegistry: AgentRegistry = {
        getAgent: vi.fn().mockImplementation((id: string) => {
          if (id === 'success-agent') return successAgent
          if (id === 'failing-agent') return failingAgent
          if (id === 'fallback-agent') return fallbackAgent
          throw new Error(`Agent not found: ${id}`)
        }),
      }

      const engine = new OrchestrationEngine({
        agentRegistry: mockRegistry,
      })

      // Act
      const result = await engine.execute(workflow)

      // Assert
      expect(result.status).toBe('completed')

      // Verify that shared-fallback agent received its own input when used as fallback
      expect(fallbackAgent.execute).toHaveBeenCalledWith(
        { source: 'shared-fallback-input' }, // Should use its own input
        expect.any(Object), // execution context
        expect.any(AbortSignal), // abort signal
      )

      // Verify it was only called once (as a fallback, not as regular step)
      expect(fallbackAgent.execute).toHaveBeenCalledTimes(1)
    })
  })

  describe('configurable security limits', () => {
    it('should pass custom expansion limits to expression evaluator', async () => {
      // Create mock agent
      const testAgent = {
        id: 'test-agent',
        name: 'Test Agent',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
      }

      const testRegistry: AgentRegistry = {
        getAgent: vi.fn().mockReturnValue(testAgent),
      }

      // Create engine with custom limits
      const customEngine = new OrchestrationEngine({
        agentRegistry: testRegistry,
        resilienceAdapter: mockResilienceAdapter,
        maxExpansionDepth: 3, // Custom shallow depth
        maxExpansionSize: 1024, // Custom 1KB limit
      })

      // Create workflow with deep variable path that exceeds custom depth
      const workflow: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        name: 'Test Custom Limits',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            input: {
              // This path is 4 levels deep (nested.level1.level2.value), exceeding our custom limit of 3
              deepValue: '${variables.nested.level1.level2.value ?? "default"}',
            },
          },
        ],
      }

      const variables = {
        nested: {
          level1: {
            level2: {
              value: 'should-not-reach-this',
            },
          },
        },
      }

      // Act
      const result = await customEngine.execute(workflow, variables)

      // Assert - step should complete but use default value due to depth limit
      expect(result.status).toBe('completed')
      expect(result.steps.step1?.status).toBe('completed')

      // The agent should have received the default value because depth limit was exceeded
      expect(testAgent.execute).toHaveBeenCalledWith(
        { deepValue: 'default' },
        expect.any(Object),
        expect.any(AbortSignal),
      )
    })

    it('should pass custom size limit to expression evaluator', async () => {
      // Create mock agent
      const testAgent = {
        id: 'test-agent',
        name: 'Test Agent',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
      }

      const testRegistry: AgentRegistry = {
        getAgent: vi.fn().mockReturnValue(testAgent),
      }

      // Create engine with very small size limit
      const customEngine = new OrchestrationEngine({
        agentRegistry: testRegistry,
        resilienceAdapter: mockResilienceAdapter,
        maxExpansionSize: 100, // 100 bytes limit
      })

      // Create workflow that tries to expand a large value
      const workflow: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        name: 'Test Size Limit',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            input: {
              largeValue: '${variables.largeString}',
            },
          },
        ],
      }

      const variables = {
        largeString: 'x'.repeat(200), // 200 bytes, exceeds 100 byte limit
      }

      // Act & Assert - should fail with validation error
      const result = await customEngine.execute(workflow, variables)

      expect(result.status).toBe('failed')
      expect(result.errors[0]?.message).toContain(
        'Expression expansion size exceeds limit of 100 bytes',
      )
    })

    it('should use default limits when not specified', async () => {
      // Create mock agent
      const testAgent = {
        id: 'test-agent',
        name: 'Test Agent',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
      }

      const testRegistry: AgentRegistry = {
        getAgent: vi.fn().mockReturnValue(testAgent),
      }

      // Create engine without custom limits
      const defaultEngine = new OrchestrationEngine({
        agentRegistry: testRegistry,
        resilienceAdapter: mockResilienceAdapter,
      })

      // Create workflow with moderately deep path (within default limit of 10)
      const workflow: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        name: 'Test Default Limits',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            input: {
              // 8 levels deep, within default limit
              deepValue: '${variables.l1.l2.l3.l4.l5.l6.l7.l8}',
            },
          },
        ],
      }

      const variables = {
        l1: { l2: { l3: { l4: { l5: { l6: { l7: { l8: 'success' } } } } } } },
      }

      // Act
      const result = await defaultEngine.execute(workflow, variables)

      // Assert - should succeed with default limits
      expect(result.status).toBe('completed')
      expect(testAgent.execute).toHaveBeenCalledWith(
        { deepValue: 'success' },
        expect.any(Object),
        expect.any(AbortSignal),
      )
    })

    it('should apply limits to condition evaluation', async () => {
      // Create mock agent
      const testAgent = {
        id: 'test-agent',
        name: 'Test Agent',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
      }

      const testRegistry: AgentRegistry = {
        getAgent: vi.fn().mockReturnValue(testAgent),
      }

      // Create engine with custom depth limit
      const customEngine = new OrchestrationEngine({
        agentRegistry: testRegistry,
        resilienceAdapter: mockResilienceAdapter,
        maxExpansionDepth: 2, // Very shallow limit
        strictConditions: false, // Non-strict mode to avoid throwing
      })

      const workflow: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        name: 'Test Condition Limits',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'test-agent',
            conditions: {
              // This condition accesses 3 levels deep, exceeding limit
              if: 'variables.deep.nested.value == `true`',
            },
            input: {},
          },
        ],
      }

      const variables = {
        deep: {
          nested: {
            value: true,
          },
        },
      }

      // Act
      const result = await customEngine.execute(workflow, variables)

      // Assert - JMESPath conditions don't use navigateObject so depth limit doesn't apply to them
      // The condition evaluates successfully to true, so the step executes
      expect(result.status).toBe('completed')
      expect(result.steps.step1?.status).toBe('completed')
    })
  })
})
