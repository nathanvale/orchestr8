/**
 * Tests for JSON Execution Model
 */

import {
  createExecutionError,
  ExecutionErrorCode,
  type Workflow,
  type StepResult,
} from '@orchestr8/schema'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  JsonExecutionModel,
  type ExecutionState,
  type StepExecutionState,
  HTTPExecutionContext,
} from './json-execution-model.js'

describe('JsonExecutionModel', () => {
  let model: JsonExecutionModel

  beforeEach(() => {
    model = new JsonExecutionModel({
      enableJournal: true,
      strictValidation: true,
    })
  })

  describe('workflow serialization', () => {
    const validWorkflow: Workflow = {
      id: 'test-workflow',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [
        {
          id: 'step1',
          type: 'agent',
          agentId: 'test-agent',
          input: { message: 'hello' },
        },
        {
          id: 'step2',
          type: 'agent',
          agentId: 'test-agent',
          dependsOn: ['step1'],
          input: { message: '${steps.step1.output.result}' },
        },
      ],
    }

    it('should serialize workflow to JSON', () => {
      const json = model.serializeWorkflow(validWorkflow)
      expect(json).toBeTypeOf('string')

      const parsed = JSON.parse(json)
      expect(parsed).toEqual(validWorkflow)
    })

    it('should deserialize workflow from JSON', () => {
      const json = JSON.stringify(validWorkflow)
      const workflow = model.deserializeWorkflow(json)

      expect(workflow).toEqual(validWorkflow)
    })

    it('should validate workflow structure during deserialization', () => {
      const invalidWorkflow = { id: 'test', steps: [] }
      const json = JSON.stringify(invalidWorkflow)

      expect(() => model.deserializeWorkflow(json)).toThrow(
        'Workflow must have a version',
      )
    })

    it('should validate duplicate step IDs', () => {
      const duplicateStepWorkflow: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        steps: [
          { id: 'step1', type: 'agent', agentId: 'agent1' },
          { id: 'step1', type: 'agent', agentId: 'agent2' }, // Duplicate
        ],
      }

      const json = JSON.stringify(duplicateStepWorkflow)
      expect(() => model.deserializeWorkflow(json)).toThrow(
        'Duplicate step ID: step1',
      )
    })

    it('should validate non-existent dependencies', () => {
      const invalidDepsWorkflow: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: 'agent1',
            dependsOn: ['non-existent'],
          },
        ],
      }

      const json = JSON.stringify(invalidDepsWorkflow)
      expect(() => model.deserializeWorkflow(json)).toThrow(
        "Step 'step1' depends on non-existent step 'non-existent'",
      )
    })

    it('should enforce payload size limits', () => {
      const largeModel = new JsonExecutionModel({ maxPayloadSize: 100 })
      const largeWorkflow: Workflow = {
        id: 'test',
        version: '1.0.0',
        description: 'x'.repeat(200), // Exceed 100 byte limit
        steps: [{ id: 'step1', type: 'agent', agentId: 'agent1' }],
      }

      expect(() => largeModel.serializeWorkflow(largeWorkflow)).toThrow(
        'workflow payload size',
      )
    })
  })

  describe('execution state management', () => {
    const workflow: Workflow = {
      id: 'test-workflow',
      version: '1.0.0',
      steps: [
        { id: 'step1', type: 'agent', agentId: 'agent1' },
        { id: 'step2', type: 'agent', agentId: 'agent2', dependsOn: ['step1'] },
      ],
    }

    it('should create initial execution state', () => {
      const variables = { env: 'test' }
      const state = model.createExecutionState(workflow, variables)

      expect(state.executionId).toBeTypeOf('string')
      expect(state.workflowId).toBe('test-workflow')
      expect(state.status).toBe('pending')
      expect(state.variables).toEqual(variables)
      expect(state.completedSteps).toEqual([])
      expect(state.failedSteps).toEqual([])
      expect(state.startTime).toBeTypeOf('string')
    })

    it('should use deterministic IDs when configured', () => {
      const deterministicModel = new JsonExecutionModel({
        deterministicIds: true,
      })

      // Mock Date.now to ensure consistent timestamps
      const originalDateNow = Date.now
      Date.now = vi.fn().mockReturnValue(1234567890)

      const state1 = deterministicModel.createExecutionState(workflow)
      const state2 = deterministicModel.createExecutionState(workflow)

      expect(state1.executionId).toBe(state2.executionId)

      Date.now = originalDateNow
    })

    it('should serialize and deserialize execution state', () => {
      const state = model.createExecutionState(workflow)
      state.completedSteps.push('step1')
      state.currentLevel = 1

      const json = model.serializeExecutionState(state)
      const deserialized = model.deserializeExecutionState(json)

      expect(deserialized).toEqual(state)
    })

    it('should create step execution state', () => {
      const stepState = model.createStepExecutionState('step1')

      expect(stepState.stepId).toBe('step1')
      expect(stepState.status).toBe('pending')
    })

    it('should update execution state for completed step', () => {
      const state = model.createExecutionState(workflow)
      const stepState: StepExecutionState = {
        stepId: 'step1',
        status: 'success',
        duration: 100,
      }
      const result: StepResult = {
        stepId: 'step1',
        status: 'completed',
        output: { result: 'success' },
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      }

      const updated = model.updateExecutionStateForStep(
        state,
        stepState,
        result,
      )

      expect(updated.completedSteps).toContain('step1')
      expect(updated.stepResults.step1).toEqual(result)
    })

    it('should update execution state for failed step', () => {
      const state = model.createExecutionState(workflow)
      const stepState: StepExecutionState = {
        stepId: 'step1',
        status: 'failed',
      }
      const error = createExecutionError(
        ExecutionErrorCode.UNKNOWN,
        'Test error',
      )
      const result: StepResult = {
        stepId: 'step1',
        status: 'failed',
        error,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      }

      const updated = model.updateExecutionStateForStep(
        state,
        stepState,
        result,
      )

      expect(updated.failedSteps).toContain('step1')
      expect(updated.errors).toContainEqual(error)
    })

    it('should finalize execution state', () => {
      const state = model.createExecutionState(workflow)
      state.completedSteps = ['step1', 'step2']

      const finalized = model.finalizeExecutionState(state)

      expect(finalized.status).toBe('completed')
      expect(finalized.endTime).toBeTypeOf('string')
      expect(finalized.duration).toBeTypeOf('number')
    })

    it('should mark as cancelled if any steps cancelled', () => {
      const state = model.createExecutionState(workflow)
      state.completedSteps = ['step1']
      state.cancelledSteps = ['step2']

      const finalized = model.finalizeExecutionState(state)

      expect(finalized.status).toBe('cancelled')
    })

    it('should mark as failed if any steps failed', () => {
      const state = model.createExecutionState(workflow)
      state.completedSteps = ['step1']
      state.failedSteps = ['step2']

      const finalized = model.finalizeExecutionState(state)

      expect(finalized.status).toBe('failed')
    })

    it('should convert execution state to workflow result', () => {
      const state: ExecutionState = {
        executionId: 'exec-123',
        workflowId: 'workflow-1',
        status: 'completed',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:01:00Z',
        duration: 60000,
        completedSteps: ['step1'],
        failedSteps: [],
        skippedSteps: [],
        cancelledSteps: [],
        stepResults: {
          step1: {
            stepId: 'step1',
            status: 'completed',
            output: { result: 'success' },
            startTime: '2024-01-01T00:00:00Z',
            endTime: '2024-01-01T00:00:30Z',
          },
        },
        variables: { env: 'test' },
      }

      const result = model.toWorkflowResult(state)

      expect(result.executionId).toBe('exec-123')
      expect(result.status).toBe('completed')
      expect(result.steps).toEqual(state.stepResults)
      expect(result.variables).toEqual(state.variables)
    })
  })

  describe('resilience policy normalization', () => {
    it('should normalize retry policy', () => {
      const policy = {
        retry: {
          maxAttempts: 5,
        },
      }

      const normalized = model.normalizeResiliencePolicy(policy)

      expect(normalized?.retry).toEqual({
        maxAttempts: 5,
        backoffStrategy: 'exponential',
        jitterStrategy: 'full-jitter',
        initialDelay: 1000,
        maxDelay: 10000,
      })
    })

    it('should normalize circuit breaker policy', () => {
      const policy = {
        circuitBreaker: {
          failureThreshold: 3,
        },
      }

      const normalized = model.normalizeResiliencePolicy(policy)

      expect(normalized?.circuitBreaker).toEqual({
        failureThreshold: 3,
        recoveryTime: 30000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      })
    })

    it('should handle timeout policy', () => {
      const policy = {
        timeout: 5000,
      }

      const normalized = model.normalizeResiliencePolicy(policy)

      expect(normalized?.timeout).toBe(5000)
    })

    it('should handle combined policies', () => {
      const policy = {
        retry: { maxAttempts: 3 },
        timeout: 30000,
        circuitBreaker: { failureThreshold: 5 },
      }

      const normalized = model.normalizeResiliencePolicy(policy)

      expect(normalized?.retry?.maxAttempts).toBe(3)
      expect(normalized?.timeout).toBe(30000)
      expect(normalized?.circuitBreaker?.failureThreshold).toBe(5)
    })

    it('should return undefined for invalid policy', () => {
      expect(model.normalizeResiliencePolicy(null)).toBeUndefined()
      expect(model.normalizeResiliencePolicy('invalid')).toBeUndefined()
      expect(model.normalizeResiliencePolicy(123)).toBeUndefined()
    })
  })

  describe('execution journal', () => {
    it('should record journal entries when enabled', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        steps: [{ id: 'step1', type: 'agent', agentId: 'agent1' }],
      }

      model.createExecutionState(workflow)
      const journal = model.getJournal()

      expect(journal.length).toBeGreaterThan(0)
      expect(journal[0]?.event).toBe('execution.created')
    })

    it('should not record journal entries when disabled', () => {
      const disabledJournalModel = new JsonExecutionModel({
        enableJournal: false,
      })
      const workflow: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        steps: [{ id: 'step1', type: 'agent', agentId: 'agent1' }],
      }

      disabledJournalModel.createExecutionState(workflow)
      const journal = disabledJournalModel.getJournal()

      expect(journal.length).toBe(0)
    })

    it('should export journal as JSON', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        steps: [{ id: 'step1', type: 'agent', agentId: 'agent1' }],
      }

      model.createExecutionState(workflow)
      const json = model.exportJournal()

      expect(json).toBeTypeOf('string')
      const parsed = JSON.parse(json)
      expect(Array.isArray(parsed)).toBe(true)
    })

    it('should truncate journal when exceeding size limit', () => {
      const smallJournalModel = new JsonExecutionModel({
        enableJournal: true,
        maxJournalSize: 500, // Small limit but enough for test
      })

      const workflow: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        steps: Array.from({ length: 10 }, (_, i) => ({
          id: `step${i}`,
          type: 'agent' as const,
          agentId: `agent${i}`,
        })),
      }

      // Create many journal entries to exceed the limit
      for (let i = 0; i < 20; i++) {
        smallJournalModel.createExecutionState(workflow)
      }

      const json = smallJournalModel.exportJournal()
      // Should be truncated to fit within the limit
      expect(json.length).toBeLessThanOrEqual(500)
      // But should have some content
      expect(json.length).toBeGreaterThan(0)
      // And should be valid JSON
      expect(() => JSON.parse(json)).not.toThrow()
    })

    it('should clear journal', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        steps: [{ id: 'step1', type: 'agent', agentId: 'agent1' }],
      }

      model.createExecutionState(workflow)
      expect(model.getJournal().length).toBeGreaterThan(0)

      model.clearJournal()
      expect(model.getJournal().length).toBe(0)
    })
  })
})

describe('HTTPExecutionContext', () => {
  let context: HTTPExecutionContext

  beforeEach(() => {
    context = new HTTPExecutionContext()
  })

  describe('ETag generation', () => {
    it('should generate consistent ETags for same content', () => {
      const content = { data: 'test' }
      const etag1 = context.generateETag(content)
      const etag2 = context.generateETag(content)

      expect(etag1).toBe(etag2)
      expect(etag1).toMatch(/^"[a-f0-9]{16}"$/)
    })

    it('should generate different ETags for different content', () => {
      const etag1 = context.generateETag({ data: 'test1' })
      const etag2 = context.generateETag({ data: 'test2' })

      expect(etag1).not.toBe(etag2)
    })
  })

  describe('location header generation', () => {
    it('should generate correct location header', () => {
      const location = context.generateLocationHeader('exec-123')
      expect(location).toBe('/v1/executions/exec-123')
    })
  })

  describe('retry-after calculation', () => {
    it('should calculate exponential backoff', () => {
      expect(context.calculateRetryAfter(0)).toBe('5')
      expect(context.calculateRetryAfter(1)).toBe('10')
      expect(context.calculateRetryAfter(2)).toBe('20')
      expect(context.calculateRetryAfter(3)).toBe('40')
      expect(context.calculateRetryAfter(10)).toBe('60') // Max cap
    })
  })

  describe('payload validation', () => {
    it('should validate sync payload size', () => {
      const smallPayload = { data: 'test' }
      expect(() => context.validatePayload(smallPayload, 'sync')).not.toThrow()

      const largePayload = { data: 'x'.repeat(2 * 1024 * 1024) }
      expect(() => context.validatePayload(largePayload, 'sync')).toThrow(
        'exceeds maximum',
      )
    })

    it('should validate async payload size', () => {
      const mediumPayload = { data: 'x'.repeat(5 * 1024 * 1024) }
      expect(() =>
        context.validatePayload(mediumPayload, 'async'),
      ).not.toThrow()

      const largePayload = { data: 'x'.repeat(11 * 1024 * 1024) }
      expect(() => context.validatePayload(largePayload, 'async')).toThrow(
        'exceeds maximum',
      )
    })

    it('should validate journal payload size', () => {
      const smallJournal = [{ event: 'test' }]
      expect(() =>
        context.validatePayload(smallJournal, 'journal'),
      ).not.toThrow()

      const largeJournal = Array.from({ length: 100000 }, () => ({
        event: 'test',
        data: 'x'.repeat(1000),
      }))
      expect(() => context.validatePayload(largeJournal, 'journal')).toThrow(
        'exceeds maximum',
      )
    })
  })

  describe('response headers', () => {
    it('should set headers for running execution', () => {
      const mockResponse = {
        headers: {} as Record<string, string>,
        setHeader(name: string, value: string) {
          this.headers[name] = value
        },
      }

      context.setExecutionHeaders(mockResponse, 'exec-123', 'running', {
        data: 'test',
      })

      expect(mockResponse.headers['Location']).toBe('/v1/executions/exec-123')
      expect(mockResponse.headers['Content-Type']).toBe('application/json')
      expect(mockResponse.headers['Retry-After']).toBe('5')
      expect(mockResponse.headers['ETag']).toBeDefined()
      expect(mockResponse.headers['Cache-Control']).toBe(
        'max-age=0, must-revalidate',
      )
    })

    it('should set headers for failed execution', () => {
      const mockResponse = {
        headers: {} as Record<string, string>,
        setHeader(name: string, value: string) {
          this.headers[name] = value
        },
      }

      context.setExecutionHeaders(mockResponse, 'exec-123', 'failed')

      expect(mockResponse.headers['Retry-After']).toBe('10')
    })

    it('should not set ETag when no content', () => {
      const mockResponse = {
        headers: {} as Record<string, string>,
        setHeader(name: string, value: string) {
          this.headers[name] = value
        },
      }

      context.setExecutionHeaders(mockResponse, 'exec-123', 'completed')

      expect(mockResponse.headers['ETag']).toBeUndefined()
      expect(mockResponse.headers['Cache-Control']).toBeUndefined()
    })
  })
})
