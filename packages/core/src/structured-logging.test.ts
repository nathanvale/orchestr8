/**
 * Tests for structured logging functionality
 */

import type { Workflow } from '@orchestr8/schema'

import { ExecutionErrorCode } from '@orchestr8/schema'
import { describe, expect, test, vi } from 'vitest'

import type { Agent, AgentRegistry, ResilienceAdapter } from './types.js'

import { MemoryLogger } from './logger.js'
import { OrchestrationEngine } from './orchestration-engine.js'

// Mock agent for testing
const mockAgent: Agent = {
  id: 'test-agent',
  name: 'Test Agent',
  execute: vi.fn(() => Promise.resolve({ message: 'Hello World' })),
}

// Mock agent registry
const mockRegistry: AgentRegistry = {
  getAgent: vi.fn(() => Promise.resolve(mockAgent)),
  hasAgent: vi.fn(() => Promise.resolve(true)),
}

// Mock resilience adapter
const mockResilienceAdapter: ResilienceAdapter = {
  applyPolicy: vi.fn((operation) => operation()),
}

describe('Structured Logging', () => {
  test('logs workflow lifecycle events', async () => {
    const logger = new MemoryLogger()
    const engine = new OrchestrationEngine({
      agentRegistry: mockRegistry,
      resilienceAdapter: mockResilienceAdapter,
      logger,
    })

    const workflow: Workflow = {
      id: 'test-workflow',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [
        {
          id: 'step1',
          type: 'agent',
          agentId: 'test-agent',
        },
      ],
    }

    await engine.execute(workflow, { inputVar: 'test' })

    const entries = logger.getEntries()

    // Check workflow.start log
    const startLog = entries.find((e) => e.message === 'workflow.start')
    expect(startLog).toBeDefined()
    expect(startLog?.level).toBe('info')
    expect(startLog?.data).toMatchObject({
      executionId: expect.any(String),
      workflowId: 'test-workflow',
      workflowVersion: '1.0.0',
      workflowName: 'Test Workflow',
      stepCount: 1,
      variables: { inputVar: 'test' },
      startTime: expect.any(String),
    })

    // Check workflow.end log
    const endLog = entries.find((e) => e.message === 'workflow.end')
    expect(endLog).toBeDefined()
    expect(endLog?.level).toBe('info')
    expect(endLog?.data).toMatchObject({
      executionId: expect.any(String),
      workflowId: 'test-workflow',
      workflowVersion: '1.0.0',
      status: 'completed',
      stepCount: 1,
      duration: expect.any(Number),
      endTime: expect.any(String),
      errorCount: 0,
    })
  })

  test('logs step lifecycle events', async () => {
    const logger = new MemoryLogger()
    const engine = new OrchestrationEngine({
      agentRegistry: mockRegistry,
      resilienceAdapter: mockResilienceAdapter,
      logger,
    })

    const workflow: Workflow = {
      id: 'test-workflow',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [
        {
          id: 'step1',
          type: 'agent',
          agentId: 'test-agent',
        },
      ],
    }

    await engine.execute(workflow)

    const entries = logger.getEntries()

    // Check step.start log
    const startLog = entries.find((e) => e.message === 'step.start')
    expect(startLog).toBeDefined()
    expect(startLog?.level).toBe('debug')
    expect(startLog?.data).toMatchObject({
      stepId: 'step1',
      agentId: 'test-agent',
      startTime: expect.any(String),
      dependencies: [],
      onError: 'fail',
    })

    // Check step.success log
    const successLog = entries.find((e) => e.message === 'step.success')
    expect(successLog).toBeDefined()
    expect(successLog?.level).toBe('info')
    expect(successLog?.data).toMatchObject({
      stepId: 'step1',
      agentId: 'test-agent',
      duration: expect.any(Number),
      endTime: expect.any(String),
      truncated: false,
    })
  })

  test('logs step errors with proper context', async () => {
    const failingAgent: Agent = {
      id: 'failing-agent',
      name: 'Failing Agent',
      execute: vi.fn(() => Promise.reject(new Error('Agent failed'))),
    }

    const failingRegistry: AgentRegistry = {
      getAgent: vi.fn(() => Promise.resolve(failingAgent)),
      hasAgent: vi.fn(() => Promise.resolve(true)),
    }

    const logger = new MemoryLogger()
    const engine = new OrchestrationEngine({
      agentRegistry: failingRegistry,
      resilienceAdapter: mockResilienceAdapter,
      logger,
    })

    const workflow: Workflow = {
      id: 'test-workflow',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [
        {
          id: 'step1',
          type: 'agent',
          agentId: 'failing-agent',
          onError: 'continue',
        },
      ],
    }

    await engine.execute(workflow)

    const entries = logger.getEntries()

    // Check step.error log
    const errorLog = entries.find((e) => e.message === 'step.error')
    expect(errorLog).toBeDefined()
    expect(errorLog?.level).toBe('error')
    expect(errorLog?.data).toMatchObject({
      stepId: 'step1',
      agentId: 'failing-agent',
      error: 'Agent failed',
      errorCode: ExecutionErrorCode.UNKNOWN,
      duration: expect.any(Number),
      endTime: expect.any(String),
      cancelled: false,
    })
  })

  test('logs level execution and fail-fast events', async () => {
    const failingAgent: Agent = {
      id: 'failing-agent',
      name: 'Failing Agent',
      execute: vi.fn(() => Promise.reject(new Error('Agent failed'))),
    }

    const mixedRegistry: AgentRegistry = {
      getAgent: vi.fn((id) => {
        if (id === 'failing-agent') return Promise.resolve(failingAgent)
        return Promise.resolve(mockAgent)
      }),
      hasAgent: vi.fn(() => Promise.resolve(true)),
    }

    const logger = new MemoryLogger()
    const engine = new OrchestrationEngine({
      agentRegistry: mixedRegistry,
      resilienceAdapter: mockResilienceAdapter,
      logger,
    })

    const workflow: Workflow = {
      id: 'test-workflow',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [
        {
          id: 'step1',
          type: 'agent',
          agentId: 'failing-agent',
          onError: 'fail', // This should trigger fail-fast
        },
        {
          id: 'step2',
          type: 'agent',
          agentId: 'test-agent',
        },
      ],
    }

    await engine.execute(workflow)

    const entries = logger.getEntries()

    // Check level.start log
    const levelStartLog = entries.find((e) => e.message === 'level.start')
    expect(levelStartLog).toBeDefined()
    expect(levelStartLog?.level).toBe('debug')
    expect(levelStartLog?.data).toMatchObject({
      levelIndex: 0,
      stepCount: 2,
      stepIds: ['step1', 'step2'],
    })

    // Check level.fail-fast log
    const failFastLog = entries.find((e) => e.message === 'level.fail-fast')
    expect(failFastLog).toBeDefined()
    expect(failFastLog?.level).toBe('warn')
    expect(failFastLog?.data).toMatchObject({
      levelIndex: 0,
      failedSteps: [
        {
          stepId: 'step1',
          error: 'Agent failed',
        },
      ],
    })
  })

  test('logs dependency skip events', async () => {
    const logger = new MemoryLogger()
    const engine = new OrchestrationEngine({
      agentRegistry: mockRegistry,
      resilienceAdapter: mockResilienceAdapter,
      logger,
    })

    const workflow: Workflow = {
      id: 'test-workflow',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [
        {
          id: 'step1',
          type: 'agent',
          agentId: 'test-agent',
          if: 'false', // This should skip
        },
        {
          id: 'step2',
          type: 'agent',
          agentId: 'test-agent',
          dependsOn: ['step1'], // This should skip due to dependency
        },
      ],
    }

    await engine.execute(workflow)

    const entries = logger.getEntries()

    // Check condition skip log
    const conditionSkipLog = entries.find(
      (e) =>
        e.message === 'step.skip' &&
        e.data?.reason === 'condition-not-met' &&
        e.data?.stepId === 'step1',
    )
    expect(conditionSkipLog).toBeDefined()
    expect(conditionSkipLog?.level).toBe('debug')
    expect(conditionSkipLog?.data).toMatchObject({
      stepId: 'step1',
      reason: 'condition-not-met',
      conditions: { if: 'false' },
    })

    // Check dependency skip log
    const dependencySkipLog = entries.find(
      (e) =>
        e.message === 'step.skip' &&
        e.data?.reason === 'dependency-not-completed' &&
        e.data?.stepId === 'step2',
    )
    expect(dependencySkipLog).toBeDefined()
    expect(dependencySkipLog?.level).toBe('debug')
    expect(dependencySkipLog?.data).toMatchObject({
      stepId: 'step2',
      reason: 'dependency-not-completed',
      dependency: 'step1',
      dependencyStatus: 'skipped',
    })
  })

  test('logs fallback execution', async () => {
    const failingAgent: Agent = {
      id: 'failing-agent',
      name: 'Failing Agent',
      execute: vi.fn(() => Promise.reject(new Error('Primary failed'))),
    }

    const fallbackAgent: Agent = {
      id: 'fallback-agent',
      name: 'Fallback Agent',
      execute: vi.fn(() => Promise.resolve({ message: 'Fallback success' })),
    }

    const mixedRegistry: AgentRegistry = {
      getAgent: vi.fn((id) => {
        if (id === 'failing-agent') return Promise.resolve(failingAgent)
        if (id === 'fallback-agent') return Promise.resolve(fallbackAgent)
        return Promise.resolve(mockAgent)
      }),
      hasAgent: vi.fn(() => Promise.resolve(true)),
    }

    const logger = new MemoryLogger()
    const engine = new OrchestrationEngine({
      agentRegistry: mixedRegistry,
      resilienceAdapter: mockResilienceAdapter,
      logger,
    })

    const workflow: Workflow = {
      id: 'test-workflow',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [
        {
          id: 'primary',
          type: 'agent',
          agentId: 'failing-agent',
          onError: 'fallback',
          fallbackStepId: 'fallback-step',
        },
        {
          id: 'fallback-step',
          type: 'agent',
          agentId: 'fallback-agent',
        },
      ],
    }

    await engine.execute(workflow)

    const entries = logger.getEntries()

    // Check step.fallback log
    const fallbackLog = entries.find((e) => e.message === 'step.fallback')
    expect(fallbackLog).toBeDefined()
    expect(fallbackLog?.level).toBe('info')
    expect(fallbackLog?.data).toMatchObject({
      originalStepId: 'primary',
      fallbackStepId: 'fallback-step',
      originalError: 'Primary failed',
    })
  })

  test('child logger includes parent context in all logs', async () => {
    const logger = new MemoryLogger({ baseContext: 'test-value' })
    const engine = new OrchestrationEngine({
      agentRegistry: mockRegistry,
      resilienceAdapter: mockResilienceAdapter,
      logger,
    })

    const workflow: Workflow = {
      id: 'test-workflow',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [
        {
          id: 'step1',
          type: 'agent',
          agentId: 'test-agent',
        },
      ],
    }

    await engine.execute(workflow)

    const entries = logger.getEntries()

    // Verify all logs include the base context and execution context
    for (const entry of entries) {
      expect(entry.data).toMatchObject({
        baseContext: 'test-value',
        executionId: expect.any(String),
        workflowId: 'test-workflow',
        workflowVersion: '1.0.0',
      })
    }
  })

  test('no logs are created when using NoOpLogger', async () => {
    // Default engine uses NoOpLogger when no logger is provided
    const engine = new OrchestrationEngine({
      agentRegistry: mockRegistry,
      resilienceAdapter: mockResilienceAdapter,
      // No logger provided - should use NoOpLogger
    })

    const workflow: Workflow = {
      id: 'test-workflow',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [
        {
          id: 'step1',
          type: 'agent',
          agentId: 'test-agent',
        },
      ],
    }

    // This should not throw and should not produce any logs
    const result = await engine.execute(workflow)
    expect(result.status).toBe('completed')

    // No way to verify no logs were created with NoOpLogger, but this test
    // ensures the engine works correctly without a logger
  })
})
