/**
 * Integration tests for event bus with orchestration engine
 */

/* global setImmediate */

import { NoopLogger } from '@orchestr8/logger'
import { ProductionResilienceAdapter } from '@orchestr8/resilience'
import {
  createExecutionError,
  ExecutionErrorCode,
  type Agent,
  type AgentRegistry,
  type Workflow,
} from '@orchestr8/schema'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { OrchestrationOptions } from './types.js'

import { BoundedEventBus, type OrchestrationEvent } from './event-bus.js'
import { ExecutionJournal } from './execution-journal.js'
import { OrchestrationEngine } from './orchestration-engine.js'

describe('Event Bus Integration', () => {
  let eventBus: BoundedEventBus
  let journal: ExecutionJournal
  let engine: OrchestrationEngine
  let capturedEvents: unknown[] = []

  // Mock agents
  const successAgent: Agent = {
    id: 'success-agent',
    name: 'Success Agent',
    version: '1.0.0',
    execute: vi.fn().mockResolvedValue({ result: 'success' }),
  }

  const failAgent: Agent = {
    id: 'fail-agent',
    name: 'Fail Agent',
    version: '1.0.0',
    execute: vi.fn().mockRejectedValue(
      createExecutionError(ExecutionErrorCode.AGENT, 'Agent failed', {
        agentId: 'fail-agent',
      }),
    ),
  }

  const slowAgent: Agent = {
    id: 'slow-agent',
    name: 'Slow Agent',
    version: '1.0.0',
    execute: vi.fn().mockImplementation(
      (_input, _context, signal) =>
        new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve({ result: 'slow' })
          }, 100)

          // Listen for abort signal
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timeoutId)
              reject(new Error('Operation aborted'))
            })
          }
        }),
    ),
  }

  const mockRegistry: AgentRegistry = {
    getAgent: vi.fn().mockImplementation((id: string) => {
      switch (id) {
        case 'success-agent':
          return Promise.resolve(successAgent)
        case 'fail-agent':
          return Promise.resolve(failAgent)
        case 'slow-agent':
          return Promise.resolve(slowAgent)
        default:
          throw new Error(`Unknown agent: ${id}`)
      }
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    capturedEvents = []

    // Re-setup agent mocks after clearing
    successAgent.execute = vi.fn().mockResolvedValue({ result: 'success' })

    failAgent.execute = vi.fn().mockRejectedValue(
      createExecutionError(ExecutionErrorCode.AGENT, 'Agent failed', {
        agentId: 'fail-agent',
      }),
    )

    slowAgent.execute = vi.fn().mockImplementation(
      (_input, _context, signal) =>
        new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve({ result: 'slow' })
          }, 100)

          // Listen for abort signal
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timeoutId)
              reject(new Error('Operation aborted'))
            })
          }
        }),
    )

    // Re-setup mock registry after clearing mocks
    mockRegistry.getAgent = vi.fn().mockImplementation((id: string) => {
      switch (id) {
        case 'success-agent':
          return Promise.resolve(successAgent)
        case 'fail-agent':
          return Promise.resolve(failAgent)
        case 'slow-agent':
          return Promise.resolve(slowAgent)
        default:
          throw new Error(`Unknown agent: ${id}`)
      }
    })

    // Create event bus
    eventBus = new BoundedEventBus({ maxQueueSize: 100 }, new NoopLogger())

    // Create journal
    journal = new ExecutionJournal(eventBus)

    // Subscribe to all events for verification
    const eventTypes = [
      'workflow.started',
      'workflow.completed',
      'workflow.failed',
      'execution.queued',
      'execution.started',
      'execution.cancelled',
      'step.started',
      'step.completed',
      'step.failed',
      'retry.attempted',
      'circuitBreaker.opened',
      'timeout.exceeded',
    ] as const

    for (const eventType of eventTypes) {
      eventBus.on(eventType, (event) => {
        capturedEvents.push(event)
      })
    }

    // Create orchestration engine with event bus
    const options: OrchestrationOptions = {
      agentRegistry: mockRegistry,
      resilienceAdapter: new ProductionResilienceAdapter(),
      logger: new NoopLogger(),
      eventBus,
    }

    engine = new OrchestrationEngine(options)
  })

  describe('Workflow Events', () => {
    it('should emit workflow lifecycle events', async () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'agent',
            agentId: 'success-agent',
          },
        ],
      }

      const result = await engine.execute(workflow)

      // Check result
      expect(result.status).toBe('completed')

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(() => resolve(undefined)))

      // Check workflow events were emitted
      const workflowEvents = capturedEvents.filter((e) =>
        (e as { type: string }).type.startsWith('workflow.'),
      )

      expect(workflowEvents).toHaveLength(2)
      expect(workflowEvents[0]).toMatchObject({
        type: 'workflow.started',
        workflowId: 'test-workflow',
      })
      expect(workflowEvents[1]).toMatchObject({
        type: 'workflow.completed',
        workflowId: 'test-workflow',
      })
    })

    it('should emit workflow failed event on failure', async () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'agent',
            agentId: 'fail-agent',
          },
        ],
      }

      const result = await engine.execute(workflow)

      // Check result
      expect(result.status).toBe('failed')

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(() => resolve(undefined)))

      // Check workflow failed event was emitted
      const failedEvent = capturedEvents.find(
        (e) => (e as { type: string }).type === 'workflow.failed',
      )

      expect(failedEvent).toBeDefined()
      expect(failedEvent).toMatchObject({
        type: 'workflow.failed',
        workflowId: 'test-workflow',
      })
    })
  })

  describe('Execution Events', () => {
    it('should emit execution lifecycle events', async () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'agent',
            agentId: 'success-agent',
          },
        ],
      }

      await engine.execute(workflow)

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(() => resolve(undefined)))

      // Check execution events
      const executionEvents = capturedEvents.filter((e) =>
        (e as { type: string }).type.startsWith('execution.'),
      )

      expect(executionEvents).toHaveLength(2)
      expect(executionEvents[0]).toMatchObject({
        type: 'execution.queued',
        workflowId: 'test-workflow',
      })
      expect(executionEvents[1]).toMatchObject({
        type: 'execution.started',
      })
    })

    it('should emit execution cancelled event on cancellation', async () => {
      const controller = new AbortController()
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'agent',
            agentId: 'slow-agent',
          },
        ],
      }

      // Start execution and cancel immediately
      const promise = engine.execute(workflow, {}, controller.signal)
      controller.abort()

      const result = await promise

      // Check result
      expect(result.status).toBe('cancelled')

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(() => resolve(undefined)))

      // Check cancelled event
      const cancelledEvent = capturedEvents.find(
        (e) => (e as { type: string }).type === 'execution.cancelled',
      )

      expect(cancelledEvent).toBeDefined()
      expect(cancelledEvent).toMatchObject({
        type: 'execution.cancelled',
        reason: 'User requested cancellation',
      })
    })
  })

  describe('Step Events', () => {
    it('should emit step lifecycle events', async () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'agent',
            agentId: 'success-agent',
          },
          {
            id: 'step2',
            name: 'Step 2',
            type: 'agent',
            agentId: 'success-agent',
            dependsOn: ['step1'],
          },
        ],
      }

      await engine.execute(workflow)

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(() => resolve(undefined)))

      // Check step events
      const stepEvents = capturedEvents.filter((e) =>
        (e as { type: string }).type.startsWith('step.'),
      )

      expect(stepEvents).toHaveLength(4) // 2 started + 2 completed

      // Step 1 events
      expect(stepEvents[0]).toMatchObject({
        type: 'step.started',
        stepId: 'step1',
      })
      expect(stepEvents[1]).toMatchObject({
        type: 'step.completed',
        stepId: 'step1',
      })

      // Step 2 events
      expect(stepEvents[2]).toMatchObject({
        type: 'step.started',
        stepId: 'step2',
      })
      expect(stepEvents[3]).toMatchObject({
        type: 'step.completed',
        stepId: 'step2',
      })
    })

    it('should emit step failed event on failure', async () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'agent',
            agentId: 'fail-agent',
            onError: 'continue', // Continue on error to test event emission
          },
        ],
      }

      await engine.execute(workflow)

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(() => resolve(undefined)))

      // Check step failed event
      const failedEvent = capturedEvents.find(
        (e) => (e as { type: string }).type === 'step.failed',
      )

      expect(failedEvent).toBeDefined()
      expect(failedEvent).toMatchObject({
        type: 'step.failed',
        stepId: 'step1',
        retryable: false,
      })
    })
  })

  describe('ExecutionJournal', () => {
    it('should record all events in journal', async () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'agent',
            agentId: 'success-agent',
          },
        ],
      }

      const result = await engine.execute(workflow)

      // Allow setImmediate to complete for journal recording
      await new Promise((resolve) => setImmediate(() => resolve(undefined)))

      // Check journal entries
      const entries = journal.getEntries()
      expect(entries.length).toBeGreaterThan(0)

      // Check workflow entries
      const workflowEntries = journal.getEntriesByWorkflow('test-workflow')
      expect(workflowEntries.length).toBeGreaterThan(0)

      // Check execution entries
      const executionEntries = journal.getEntriesByExecution(result.executionId)
      expect(executionEntries.length).toBeGreaterThan(0)

      // Check step entries
      const stepEntries = journal.getEntriesByStep('step1')
      expect(stepEntries.length).toBeGreaterThan(0)
    })

    it('should handle high-volume events without blocking', async () => {
      // Create a workflow with many steps
      const steps = Array.from({ length: 20 }, (_, i) => ({
        id: `step${i}`,
        name: `Step ${i}`,
        type: 'agent' as const,
        agentId: 'success-agent',
        dependsOn: i > 0 ? [`step${i - 1}`] : undefined,
      }))

      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps,
      }

      const startTime = Date.now()
      await engine.execute(workflow)
      const executionTime = Date.now() - startTime

      // Execution should be fast despite many events
      expect(executionTime).toBeLessThan(1000) // Should complete in less than 1 second

      // Allow journal to catch up
      await new Promise((resolve) => setImmediate(() => resolve(undefined)))

      // Check all events were recorded
      const entries = journal.getEntries()
      expect(entries.length).toBeGreaterThan(steps.length * 2) // At least started + completed for each step
    })
  })

  describe('Resilience Events', () => {
    it('should emit retry events', async () => {
      // Mock agent that fails once then succeeds
      let attemptCount = 0
      const retryAgent: Agent = {
        id: 'retry-agent',
        name: 'Retry Agent',
        version: '1.0.0',
        execute: vi.fn().mockImplementation(() => {
          attemptCount++
          if (attemptCount === 1) {
            return Promise.reject(new Error('First attempt failed'))
          }
          return Promise.resolve({ result: 'success' })
        }),
      }

      mockRegistry.getAgent = vi.fn().mockImplementation((id: string) => {
        if (id === 'retry-agent') return Promise.resolve(retryAgent)
        throw new Error(`Unknown agent: ${id}`)
      })

      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'agent',
            agentId: 'retry-agent',
            resilience: {
              retry: {
                maxAttempts: 3,
                backoffStrategy: 'fixed',
                jitterStrategy: 'none',
                initialDelay: 10,
                maxDelay: 100,
              },
            },
          },
        ],
      }

      await engine.execute(workflow)

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(() => resolve(undefined)))

      // Also wait a bit more for retry delay
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Check retry event was emitted
      const retryEvent = capturedEvents.find(
        (e) => (e as { type: string }).type === 'retry.attempted',
      )

      expect(retryEvent).toBeDefined()
      expect(retryEvent).toMatchObject({
        type: 'retry.attempted',
        stepId: 'step1',
        attempt: expect.any(Number),
        delay: expect.any(Number),
      })
    })

    it('should emit timeout events', async () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'agent',
            agentId: 'slow-agent',
            resilience: {
              timeout: 50, // Timeout before agent completes
            },
            onError: 'continue', // Continue to allow event emission
          },
        ],
      }

      await engine.execute(workflow)

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(() => resolve(undefined)))

      // Check timeout event was emitted
      const timeoutEvent = capturedEvents.find(
        (e) => (e as { type: string }).type === 'timeout.exceeded',
      )

      expect(timeoutEvent).toBeDefined()
      expect(timeoutEvent).toMatchObject({
        type: 'timeout.exceeded',
        stepId: 'step1',
        duration: 50,
      })
    })
  })

  describe('ExecutionJournal Memory Management', () => {
    it('should properly cleanup listeners when disposed', async () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'agent',
            agentId: 'success-agent',
          },
        ],
      }

      // Get initial listener count (includes journal from beforeEach + capturedEvents listener)
      const initialListenerCount = eventBus.listenerCount('workflow.started')

      // Create a new journal
      const testJournal = new ExecutionJournal(eventBus)

      // Verify listener was added
      expect(eventBus.listenerCount('workflow.started')).toBe(
        initialListenerCount + 1,
      )

      // Execute workflow to generate events
      await engine.execute(workflow)

      // Allow journal to process events
      await new Promise((resolve) => setImmediate(() => resolve(undefined)))

      // Verify journal recorded events
      const entries = testJournal.getEntries()
      expect(entries.length).toBeGreaterThan(0)

      // Dispose the journal
      testJournal.dispose()

      // Check that listeners were removed (should be back to initial count)
      const finalListenerCount = eventBus.listenerCount('workflow.started')
      expect(finalListenerCount).toBe(initialListenerCount)

      // Verify all event types had their listeners removed
      const eventTypes = [
        'workflow.started',
        'workflow.completed',
        'workflow.failed',
        'execution.queued',
        'execution.started',
        'execution.cancelled',
        'step.started',
        'step.completed',
        'step.failed',
        'retry.attempted',
        'circuitBreaker.opened',
        'timeout.exceeded',
      ]

      // Create another journal to check listener counts
      const testJournal2 = new ExecutionJournal(eventBus)

      for (const eventType of eventTypes) {
        // Each event type should have:
        // - 1 from the main journal created in beforeEach
        // - 1 from the capturedEvents listener in beforeEach
        // - 1 from testJournal2
        // (testJournal's listeners should have been removed)
        const count = eventBus.listenerCount(
          eventType as OrchestrationEvent['type'],
        )
        expect(count).toBe(3) // beforeEach journal + capturedEvents + testJournal2
      }

      // Clean up testJournal2
      testJournal2.dispose()

      // Verify entries were cleared
      expect(testJournal.getEntries().length).toBe(0)
    })

    it('should not leak memory when creating and disposing multiple journals', async () => {
      // Get initial count (journal from beforeEach + capturedEvents listener)
      const initialCount = eventBus.listenerCount('workflow.started')

      const journals: ExecutionJournal[] = []

      // Create many journals (but stay under max listeners limit)
      const journalCount = 50
      for (let i = 0; i < journalCount; i++) {
        journals.push(new ExecutionJournal(eventBus, 100))
      }

      // Check listener count - should be initial + journalCount
      const count = eventBus.listenerCount('workflow.started')
      expect(count).toBe(initialCount + journalCount)

      // Dispose all journals
      for (const j of journals) {
        j.dispose()
      }

      // Check listener count - should be back to initial
      const finalCount = eventBus.listenerCount('workflow.started')
      expect(finalCount).toBe(initialCount)

      // Verify we can create and dispose again without issues
      const moreJournals: ExecutionJournal[] = []
      for (let i = 0; i < journalCount; i++) {
        moreJournals.push(new ExecutionJournal(eventBus, 100))
      }

      expect(eventBus.listenerCount('workflow.started')).toBe(
        initialCount + journalCount,
      )

      for (const j of moreJournals) {
        j.dispose()
      }

      expect(eventBus.listenerCount('workflow.started')).toBe(initialCount)
    })
  })

  describe('Event Bus Metrics', () => {
    it('should track event metrics correctly', async () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'agent',
            agentId: 'success-agent',
          },
        ],
      }

      await engine.execute(workflow)

      // Allow queue to fully process
      await new Promise((resolve) => setImmediate(() => resolve(undefined)))

      // Get metrics
      const metrics = eventBus.getMetrics()

      // Check metrics
      expect(metrics.droppedCount).toBe(0)
      expect(metrics.queueSize).toBe(0) // Should be empty after processing
      expect(metrics.listeners.size).toBeGreaterThan(0) // Should have listeners
    })

    it('should handle queue overflow gracefully', async () => {
      // Create event bus with small queue
      const smallBus = new BoundedEventBus({ maxQueueSize: 5 })

      // Emit many events rapidly
      for (let i = 0; i < 20; i++) {
        smallBus.emitEvent({
          type: 'step.started',
          stepId: `step${i}`,
          executionId: 'test',
        })
      }

      // Check metrics
      const metrics = smallBus.getMetrics()
      expect(metrics.droppedCount).toBeGreaterThan(0)
      expect(metrics.queueSize).toBeLessThanOrEqual(5)
    })
  })
})
