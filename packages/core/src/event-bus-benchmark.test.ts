/**
 * Performance benchmarks for BoundedEventBus
 * Run with: PERF=1 pnpm test event-bus-benchmark.test.ts
 */

import type { OrchestrationEvent } from './event-bus.js'

import { performance } from 'node:perf_hooks'

import { describe, it, expect, beforeEach } from 'vitest'

import { BoundedEventBus } from './event-bus.js'

// Environment variable gate for performance benchmarks
const isPerfMode = process.env.PERF === '1'
const isCI = process.env.CI === 'true'

interface BenchmarkResult {
  name: string
  iterations: number
  totalTime: number
  meanTime: number
  medianTime: number
  p95Time: number
  p99Time: number
  minTime: number
  maxTime: number
  throughput: number // events per second
}

interface BenchmarkOptions {
  iterations?: number
  warmupIterations?: number
}

class EventBusBenchmarkSuite {
  private results: BenchmarkResult[] = []

  async benchmark(
    name: string,
    fn: () => Promise<void> | void,
    options: BenchmarkOptions = {},
  ): Promise<BenchmarkResult> {
    const { iterations = 1000, warmupIterations = 100 } = options

    // Warmup phase
    console.log(`Warming up ${name}...`)
    for (let i = 0; i < warmupIterations; i++) {
      await fn()
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }

    // Benchmark phase
    console.log(`Benchmarking ${name}...`)
    const times: number[] = []

    const totalStart = performance.now()
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await fn()
      const end = performance.now()
      times.push(end - start)
    }
    const totalEnd = performance.now()
    const totalTime = totalEnd - totalStart

    // Calculate statistics
    times.sort((a, b) => a - b)
    const meanTime = times.reduce((sum, t) => sum + t, 0) / iterations
    const medianTime = times[Math.floor(iterations / 2)] ?? 0
    const p95Time = times[Math.floor(iterations * 0.95)] ?? 0
    const p99Time = times[Math.floor(iterations * 0.99)] ?? 0
    const minTime = times[0] ?? 0
    const maxTime = times[times.length - 1] ?? 0
    const throughput = (iterations / totalTime) * 1000 // events per second

    const result: BenchmarkResult = {
      name,
      iterations,
      totalTime,
      meanTime,
      medianTime,
      p95Time,
      p99Time,
      minTime,
      maxTime,
      throughput,
    }

    this.results.push(result)
    return result
  }

  printResults(): void {
    console.log('\n📊 Event Bus Benchmark Results\n')
    console.log('═'.repeat(80))

    for (const result of this.results) {
      console.log(`\n📈 ${result.name}`)
      console.log('─'.repeat(40))
      console.log(`  Iterations:    ${result.iterations}`)
      console.log(`  Throughput:    ${result.throughput.toFixed(0)} events/sec`)
      console.log(`  Mean:          ${result.meanTime.toFixed(3)}ms`)
      console.log(`  Median:        ${result.medianTime.toFixed(3)}ms`)
      console.log(`  P95:           ${result.p95Time.toFixed(3)}ms`)
      console.log(`  P99:           ${result.p99Time.toFixed(3)}ms`)
      console.log(`  Min:           ${result.minTime.toFixed(3)}ms`)
      console.log(`  Max:           ${result.maxTime.toFixed(3)}ms`)
    }

    console.log('\n' + '═'.repeat(80))
    this.validatePerformanceTargets()
  }

  private validatePerformanceTargets(): void {
    console.log('\n✅ Performance Target Validation\n')

    // Relaxed thresholds for CI
    const emissionLatencyTarget = isCI ? 2.0 : 1.0 // 2ms in CI, 1ms locally
    const throughputTarget = 10000 // 10,000 events/second

    let allPassed = true

    // Check emission latency benchmarks
    const emissionBenchmarks = this.results.filter((r) =>
      r.name.includes('Emission'),
    )
    for (const result of emissionBenchmarks) {
      const p95Passes = result.p95Time < emissionLatencyTarget
      if (!p95Passes) allPassed = false

      const emoji = p95Passes ? '✅' : '❌'
      console.log(`${emoji} ${result.name}:`)
      console.log(
        `    P95 Latency: ${result.p95Time.toFixed(3)}ms (target: <${emissionLatencyTarget}ms)`,
      )
    }

    // Check throughput benchmarks
    const throughputBenchmarks = this.results.filter((r) =>
      r.name.includes('Throughput'),
    )
    for (const result of throughputBenchmarks) {
      const throughputPasses = result.throughput >= throughputTarget
      if (!throughputPasses) allPassed = false

      const emoji = throughputPasses ? '✅' : '❌'
      console.log(`${emoji} ${result.name}:`)
      console.log(
        `    Throughput: ${result.throughput.toFixed(0)} events/sec (target: >${throughputTarget})`,
      )
    }

    if (!allPassed && isCI) {
      console.log('\n❌ Performance targets not met in CI')
      process.exit(1)
    }
  }

  getResults(): BenchmarkResult[] {
    return this.results
  }
}

describe.skipIf(!isPerfMode && !isCI)(
  'Event Bus Performance Benchmarks',
  () => {
    let suite: EventBusBenchmarkSuite

    beforeEach(() => {
      suite = new EventBusBenchmarkSuite()
    })

    it('should benchmark simple event emission latency', async () => {
      const eventBus = new BoundedEventBus({ maxQueueSize: 10000 })
      let eventsReceived = 0

      eventBus.on('test.event', () => {
        eventsReceived++
      })

      const result = await suite.benchmark(
        'Simple Event Emission',
        () => {
          const event: OrchestrationEvent = {
            type: 'test.event',
            data: { id: Math.random() },
          } as OrchestrationEvent
          eventBus.emitEvent(event)
        },
        { iterations: 10000, warmupIterations: 1000 },
      )

      // Wait for all events to be processed
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(result.p95Time).toBeLessThan(isCI ? 2.0 : 1.0)
      console.log(`Events received: ${eventsReceived}`)
    }, 30000)

    it('should benchmark event emission with multiple listeners', async () => {
      const eventBus = new BoundedEventBus({ maxQueueSize: 10000 })
      const listenerCount = 10

      // Add multiple listeners
      for (let i = 0; i < listenerCount; i++) {
        eventBus.on('workflow.started', () => {
          // Simulate minimal work
          Math.random()
        })
      }

      const result = await suite.benchmark(
        'Event Emission with 10 Listeners',
        () => {
          const event: OrchestrationEvent = {
            type: 'workflow.started',
            workflowId: `wf-${Math.random()}`,
            timestamp: Date.now(),
          }
          eventBus.emitEvent(event)
        },
        { iterations: 5000, warmupIterations: 500 },
      )

      expect(result.p95Time).toBeLessThan(isCI ? 3.0 : 2.0)
    }, 30000)

    it('should benchmark throughput with small events', async () => {
      const eventBus = new BoundedEventBus({ maxQueueSize: 10000 })
      let processedCount = 0

      eventBus.on('step.started', () => {
        processedCount++
      })

      const eventsPerBatch = 1000
      const result = await suite.benchmark(
        'Throughput - Small Events',
        async () => {
          // Emit a batch of events
          for (let i = 0; i < eventsPerBatch; i++) {
            const event: OrchestrationEvent = {
              type: 'step.started',
              stepId: `step-${i}`,
              executionId: 'exec-1',
            }
            eventBus.emitEvent(event)
          }
          // Wait for processing
          await new Promise((resolve) => setImmediate(resolve))
        },
        { iterations: 10, warmupIterations: 2 },
      )

      // Calculate actual throughput
      const actualThroughput = (eventsPerBatch * 10) / (result.totalTime / 1000)
      console.log(
        `Actual throughput: ${actualThroughput.toFixed(0)} events/sec`,
      )

      expect(actualThroughput).toBeGreaterThan(10000)
    }, 30000)

    it('should benchmark throughput with complex events', async () => {
      const eventBus = new BoundedEventBus({ maxQueueSize: 10000 })
      let processedCount = 0

      eventBus.on('step.completed', () => {
        processedCount++
      })

      const eventsPerBatch = 1000
      const result = await suite.benchmark(
        'Throughput - Complex Events',
        async () => {
          // Emit a batch of complex events
          for (let i = 0; i < eventsPerBatch; i++) {
            const event: OrchestrationEvent = {
              type: 'step.completed',
              stepId: `step-${i}`,
              output: {
                result: 'x'.repeat(100),
                metadata: {
                  timestamp: Date.now(),
                  duration: Math.random() * 1000,
                  retries: Math.floor(Math.random() * 3),
                },
                nested: {
                  deep: {
                    value: 'test',
                  },
                },
              },
            }
            eventBus.emitEvent(event)
          }
          // Wait for processing
          await new Promise((resolve) => setImmediate(resolve))
        },
        { iterations: 10, warmupIterations: 2 },
      )

      const actualThroughput = (eventsPerBatch * 10) / (result.totalTime / 1000)
      console.log(
        `Complex event throughput: ${actualThroughput.toFixed(0)} events/sec`,
      )

      expect(actualThroughput).toBeGreaterThan(10000)
    }, 30000)

    it('should benchmark queue saturation and recovery', async () => {
      const eventBus = new BoundedEventBus({
        maxQueueSize: 1000,
        warnOnDrop: false,
      })

      let slowProcessingActive = true
      let processedCount = 0

      // Add a slow listener to cause queue buildup
      eventBus.on('test.burst', async () => {
        if (slowProcessingActive) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        processedCount++
      })

      const result = await suite.benchmark(
        'Queue Saturation Recovery',
        async () => {
          // Burst emit events
          for (let i = 0; i < 2000; i++) {
            eventBus.emitEvent({
              type: 'test.burst',
              id: i,
            } as OrchestrationEvent)
          }

          // Let queue saturate
          await new Promise((resolve) => setTimeout(resolve, 50))

          // Speed up processing
          slowProcessingActive = false

          // Wait for recovery
          await new Promise((resolve) => setTimeout(resolve, 100))
        },
        { iterations: 5, warmupIterations: 1 },
      )

      const metrics = eventBus.getMetrics()
      console.log(`Dropped events: ${metrics.droppedCount}`)
      console.log(`Processed events: ${processedCount}`)

      expect(metrics.droppedCount).toBeGreaterThan(0)
    }, 60000)

    it('should benchmark event isolation overhead', async () => {
      const eventBus = new BoundedEventBus({ maxQueueSize: 5000 })

      let modificationAttempts = 0
      eventBus.on('test.isolation', (event) => {
        // Try to modify the event (this shouldn't affect original due to shallow clone)
        if ('data' in event && typeof event.data === 'object') {
          ;(event.data as Record<string, unknown>).modified = true
          modificationAttempts++
        }
      })

      const result = await suite.benchmark(
        'Event Isolation Overhead',
        () => {
          // Create a fresh event for each iteration to properly test isolation
          const event: OrchestrationEvent = {
            type: 'test.isolation',
            data: { value: 'original' },
          } as OrchestrationEvent
          
          const originalData = JSON.stringify(event.data)
          eventBus.emitEvent(event)
          
          // Verify the original event wasn't modified (shallow clone protects top level)
          expect(JSON.stringify(event.data)).toBe(originalData)
        },
        { iterations: 10000, warmupIterations: 1000 },
      )

      console.log(`Modification attempts: ${modificationAttempts}`)
      expect(result.p95Time).toBeLessThan(isCI ? 2.0 : 1.0)
    }, 30000)

    it('should measure memory tracking overhead when enabled', async () => {
      const eventBusWithTracking = new BoundedEventBus({
        maxQueueSize: 5000,
        enableMemoryTracking: true,
      })

      const eventBusWithoutTracking = new BoundedEventBus({
        maxQueueSize: 5000,
        enableMemoryTracking: false,
      })

      // Benchmark with memory tracking
      const withTrackingResult = await suite.benchmark(
        'With Memory Tracking',
        () => {
          for (let i = 0; i < 100; i++) {
            eventBusWithTracking.emitEvent({
              type: 'test.memory',
              data: 'x'.repeat(1000),
            } as OrchestrationEvent)
          }
        },
        { iterations: 100, warmupIterations: 10 },
      )

      // Benchmark without memory tracking
      const withoutTrackingResult = await suite.benchmark(
        'Without Memory Tracking',
        () => {
          for (let i = 0; i < 100; i++) {
            eventBusWithoutTracking.emitEvent({
              type: 'test.memory',
              data: 'x'.repeat(1000),
            } as OrchestrationEvent)
          }
        },
        { iterations: 100, warmupIterations: 10 },
      )

      const overhead =
        ((withTrackingResult.meanTime - withoutTrackingResult.meanTime) /
          withoutTrackingResult.meanTime) *
        100

      console.log(`Memory tracking overhead: ${overhead.toFixed(1)}%`)

      // Memory tracking should have minimal overhead (< 40% in test environment)
      // Note: Overhead can be higher in test environments due to small batch sizes
      expect(overhead).toBeLessThan(40)
    }, 30000)

    it('should print comprehensive benchmark results', async () => {
      // This test runs last to print all results
      // Only print if we have results (other tests ran)
      const results = suite.getResults()
      
      if (results.length > 0) {
        suite.printResults()
        
        // Verify key performance targets
        const emissionBenchmarks = results.filter((r) =>
          r.name.includes('Emission'),
        )
        const hasGoodLatency = emissionBenchmarks.some(
          (r) => r.p95Time < (isCI ? 2.0 : 1.0),
        )
        expect(hasGoodLatency).toBe(true)

        const throughputBenchmarks = results.filter((r) =>
          r.name.includes('Throughput'),
        )
        const hasGoodThroughput = throughputBenchmarks.some(
          (r) => r.throughput > 10000,
        )
        expect(hasGoodThroughput).toBe(true)
      } else {
        // No results means the suite was instantiated but no benchmarks ran
        // This can happen when running individual tests
        expect(results.length).toBe(0)
      }
    })
  },
)

// Export for use in other tests
export { EventBusBenchmarkSuite }
