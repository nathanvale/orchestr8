/**
 * Performance benchmarks for JSON Execution Model
 * Tests compliance with <100ms validation requirement
 */

import { performance } from 'perf_hooks'

import { type Workflow, type StepResult } from '@orchestr8/schema'
import { describe, it, expect, beforeEach } from 'vitest'
const SKIP_BENCHMARKS_IF = !(
  !process.env.WALLABY_WORKER &&
  process.env.CI !== 'true' &&
  process.env.PERF === '1'
)

import {
  JsonExecutionModel,
  type ExecutionState,
  HTTPExecutionContext,
} from './json-execution-model.js'

// Create test workflow with configurable complexity
const createTestWorkflow = (stepCount: number = 50): Workflow => ({
  id: `perf-test-workflow-${stepCount}`,
  version: '1.0.0',
  name: `Performance Test Workflow (${stepCount} steps)`,
  description: `A workflow with ${stepCount} steps for performance testing`,
  steps: Array.from({ length: stepCount }, (_, i) => ({
    id: `step${i + 1}`,
    type: 'agent' as const,
    agentId: `test-agent-${i + 1}`,
    input: { message: `Processing step ${i + 1}`, data: 'x'.repeat(100) },
    ...(i > 0 && { dependsOn: [`step${i}`] }), // Chain dependencies for realistic workflow
  })),
})

// Create complex execution state for testing
const createComplexExecutionState = (
  stepCount: number = 50,
): ExecutionState => {
  const completedStepCount = Math.floor(stepCount / 2)
  const completedSteps = Array.from(
    { length: completedStepCount },
    (_, i) => `step${i + 1}`,
  )
  const stepResults: Record<string, unknown> = {}

  // Create step results for completed steps
  completedSteps.forEach((stepId) => {
    stepResults[stepId] = {
      success: true,
      data: `Result from ${stepId}`,
      metadata: { processingTime: 500, attempts: 1 },
    }
  })

  return {
    executionId: `exec-perf-${Date.now()}`,
    workflowId: `workflow-perf-${stepCount}`,
    status: 'running',
    startTime: new Date().toISOString(),
    currentLevel: 0,
    completedSteps,
    failedSteps: [],
    skippedSteps: [],
    cancelledSteps: [],
    stepResults,
    variables: {},
    metadata: {
      totalSteps: stepCount,
      completedSteps: completedStepCount,
      failedSteps: 0,
    },
  }
}

// Utility function to measure execution time
function measureTime<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now()
  const result = fn()
  const end = performance.now()
  return { result, duration: end - start }
}

// Benchmark runner with detailed statistics
function benchmark(name: string, fn: () => void, iterations = 100): void {
  const durations: number[] = []

  // Warm up runs to stabilize JIT
  for (let i = 0; i < 10; i++) {
    fn()
  }

  // Actual measurements
  for (let i = 0; i < iterations; i++) {
    const { duration } = measureTime(fn)
    durations.push(duration)
  }

  // Calculate statistics
  const sortedDurations = durations.sort((a, b) => a - b)
  const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length
  const min = Math.min(...durations)
  const max = Math.max(...durations)
  const p50 = sortedDurations[Math.floor(durations.length * 0.5)]
  const p95 = sortedDurations[Math.floor(durations.length * 0.95)]
  const p99 = sortedDurations[Math.floor(durations.length * 0.99)]

  console.log(`📊 ${name} (${iterations} iterations):`)
  console.log(`   Min: ${min.toFixed(2)}ms`)
  console.log(`   Avg: ${avg.toFixed(2)}ms`)
  console.log(`   P50: ${p50.toFixed(2)}ms`)
  console.log(`   P95: ${p95.toFixed(2)}ms`)
  console.log(`   P99: ${p99.toFixed(2)}ms`)
  console.log(`   Max: ${max.toFixed(2)}ms`)

  // Assert performance requirements
  if (name.includes('Critical')) {
    expect(p95).toBeLessThan(100) // <100ms requirement
  }
}

describe.skipIf(SKIP_BENCHMARKS_IF)(
  'JSON Execution Model Performance Benchmarks',
  () => {
    let model: JsonExecutionModel
    let largeWorkflow: Workflow
    let complexExecutionState: ExecutionState

    beforeEach(() => {
      model = new JsonExecutionModel({
        enableJournal: true,
        strictValidation: true,
      })
      largeWorkflow = createTestWorkflow(50)
      complexExecutionState = createComplexExecutionState(50)
    })

    describe('Workflow Serialization Performance', () => {
      it('should serialize large workflows within performance requirements', () => {
        benchmark('Critical: Workflow Serialization (50 steps)', () => {
          const serialized = model.serializeWorkflow(largeWorkflow)
          expect(serialized).toBeDefined()
          expect(typeof serialized).toBe('string')
          expect(serialized.length).toBeGreaterThan(0)
        })
      })

      it('should deserialize large workflows efficiently', () => {
        const serialized = model.serializeWorkflow(largeWorkflow)

        benchmark('Critical: Workflow Deserialization (50 steps)', () => {
          const deserialized = model.deserializeWorkflow(serialized)
          expect(deserialized).toBeDefined()
          expect(deserialized.id).toBe(largeWorkflow.id)
          expect(deserialized.steps).toHaveLength(50)
        })
      })

      it('should handle workflow serialization scaling', () => {
        const stepCounts = [1, 10, 25, 50, 100]

        stepCounts.forEach((stepCount) => {
          const workflow = createTestWorkflow(stepCount)

          const { duration } = measureTime(() => {
            const serialized = model.serializeWorkflow(workflow)
            const deserialized = model.deserializeWorkflow(serialized)
            expect(deserialized.steps).toHaveLength(stepCount)
          })

          console.log(
            `📏 Workflow round-trip (${stepCount} steps): ${duration.toFixed(2)}ms`,
          )

          // All operations should complete within reasonable time
          expect(duration).toBeLessThan(stepCount <= 50 ? 100 : 200)
        })
      })
    })

    describe('Execution State Management Performance', () => {
      it('should serialize execution states efficiently', () => {
        benchmark('Critical: Execution State Serialization', () => {
          const serialized = model.serializeExecutionState(
            complexExecutionState,
          )
          expect(serialized).toBeDefined()
          expect(typeof serialized).toBe('string')
          expect(JSON.parse(serialized)).toBeDefined()
        })
      })

      it('should deserialize execution states efficiently', () => {
        const serialized = model.serializeExecutionState(complexExecutionState)

        benchmark('Critical: Execution State Deserialization', () => {
          const deserialized = model.deserializeExecutionState(serialized)
          expect(deserialized).toBeDefined()
          expect(deserialized.executionId).toBe(
            complexExecutionState.executionId,
          )
          expect(deserialized.completedSteps.length).toBe(25) // Half of 50 steps are completed
        })
      })

      it('should update step execution states quickly', () => {
        const stepResult: StepResult = {
          success: true,
          data: { message: 'Test result', timestamp: Date.now() },
        }

        benchmark('Step State Update Performance', () => {
          const updatedState = model.updateStepExecutionState(
            complexExecutionState,
            'step25',
            'completed',
            stepResult,
          )
          expect(updatedState.completedSteps).toContain('step25')
          expect(updatedState.stepResults['step25']).toBeDefined()
        })
      })
    })

    describe('Deterministic ID Generation Performance', () => {
      it('should generate deterministic IDs quickly', () => {
        benchmark('Deterministic ID Generation', () => {
          const timestamp = Date.now()
          const id1 = model.generateDeterministicId(largeWorkflow.id, timestamp)
          const id2 = model.generateDeterministicId(largeWorkflow.id, timestamp)
          expect(id1).toBe(id2) // Should be deterministic
          expect(id1).toMatch(/^[a-f0-9]+$/) // Should be hex string
        })
      })

      it('should handle ID generation scaling', () => {
        const workflows = Array.from({ length: 10 }, (_, i) =>
          createTestWorkflow(10 + i),
        )

        const { duration } = measureTime(() => {
          workflows.forEach((workflow) => {
            const id = model.generateDeterministicId(workflow.id)
            expect(id).toBeDefined()
            expect(id.length).toBeGreaterThan(0)
          })
        })

        console.log(
          `🔑 Generated 10 deterministic IDs: ${duration.toFixed(2)}ms`,
        )
        expect(duration).toBeLessThan(50) // Should be very fast
      })
    })

    describe('HTTP Context Performance', () => {
      let httpContext: HTTPExecutionContext

      beforeEach(() => {
        httpContext = new HTTPExecutionContext()
      })

      it('should handle HTTP headers efficiently', () => {
        const mockResponse = {
          headers: {} as Record<string, string>,
          setHeader(name: string, value: string) {
            this.headers[name] = value
          },
        }

        benchmark('HTTP Headers Setting', () => {
          httpContext.setExecutionHeaders(mockResponse, 'exec-123', 'running', {
            data: complexExecutionState,
          })
          expect(Object.keys(mockResponse.headers).length).toBeGreaterThan(0)
        })
      })

      it('should generate ETags quickly', () => {
        benchmark('ETag Generation', () => {
          const etag = httpContext.generateETag(complexExecutionState)
          expect(etag).toBeDefined()
          expect(etag.length).toBeGreaterThan(0)
        })
      })
    })

    describe('Memory Efficiency', () => {
      it('should not leak memory during repeated operations', () => {
        const initialMemory = process.memoryUsage().heapUsed

        // Perform many serialization operations
        for (let i = 0; i < 1000; i++) {
          const workflow = createTestWorkflow(10)
          const serialized = model.serializeWorkflow(workflow)
          const deserialized = model.deserializeWorkflow(serialized)
          expect(deserialized.steps).toHaveLength(10)
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }

        const finalMemory = process.memoryUsage().heapUsed
        const memoryIncrease = finalMemory - initialMemory
        const memoryIncreaseMB = memoryIncrease / (1024 * 1024)

        console.log(
          `🧠 Memory increase after 1000 operations: ${memoryIncreaseMB.toFixed(2)}MB`,
        )

        // Should not leak significant memory
        expect(memoryIncreaseMB).toBeLessThan(50)
      })

      it('should handle large payloads efficiently', () => {
        // Create workflow with large data
        const largeWorkflow = createTestWorkflow(5)
        largeWorkflow.steps.forEach((step, i) => {
          step.input = {
            largeData: 'x'.repeat(10000), // 10KB per step
            metadata: Array.from({ length: 100 }, (_, j) => `item-${i}-${j}`),
          }
        })

        const { duration } = measureTime(() => {
          const serialized = model.serializeWorkflow(largeWorkflow)
          const deserialized = model.deserializeWorkflow(serialized)
          expect(deserialized.steps).toHaveLength(5)
        })

        console.log(`📦 Large payload serialization: ${duration.toFixed(2)}ms`)
        expect(duration).toBeLessThan(100) // Should handle large payloads efficiently
      })
    })

    describe('Error Handling Performance', () => {
      it('should handle validation errors efficiently', () => {
        const invalidWorkflow = {
          id: '', // Invalid empty ID
          version: 'invalid',
          name: null,
          steps: 'not-an-array',
        }

        benchmark('Validation Error Handling', () => {
          try {
            model.serializeWorkflow(invalidWorkflow as Workflow)
          } catch (error) {
            expect(error).toBeDefined()
          }
        })
      })

      it('should handle deserialization errors efficiently', () => {
        const invalidJson = '{"invalid": json, malformed}'

        benchmark('Deserialization Error Handling', () => {
          try {
            model.deserializeWorkflow(invalidJson)
          } catch (error) {
            expect(error).toBeDefined()
          }
        })
      })
    })

    describe('Concurrent Operations Performance', () => {
      it('should handle concurrent serialization efficiently', async () => {
        const workflows = Array.from({ length: 20 }, (_, i) =>
          createTestWorkflow(10 + i),
        )

        const { duration } = measureTime(async () => {
          const promises = workflows.map(async (workflow) => {
            return model.serializeWorkflow(workflow)
          })

          const results = await Promise.all(promises)
          expect(results).toHaveLength(20)
          results.forEach((result) => {
            expect(typeof result).toBe('string')
          })
        })

        console.log(
          `🚀 Concurrent serialization (20x): ${duration.toFixed(2)}ms`,
        )
        expect(duration).toBeLessThan(500)
      })

      it('should handle concurrent execution state updates', async () => {
        const executionStates = Array.from({ length: 10 }, () =>
          createComplexExecutionState(20),
        )

        const { duration } = measureTime(async () => {
          const promises = executionStates.map(async (state, i) => {
            model.updateStepExecutionState(state, 'step10', 'completed', {
              success: true,
              data: { result: i },
            })
            return state
          })

          const results = await Promise.all(promises)
          expect(results).toHaveLength(10)
        })

        console.log(
          `⚡ Concurrent state updates (10x): ${duration.toFixed(2)}ms`,
        )
        expect(duration).toBeLessThan(100)
      })
    })
  },
)
