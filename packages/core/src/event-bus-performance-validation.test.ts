/**
 * Performance validation suite for BoundedEventBus
 * Consolidates and validates all performance targets
 */

import { performance } from 'node:perf_hooks'

import { describe, it, expect } from 'vitest'

import type { OrchestrationEvent } from './event-bus.js'

import { BoundedEventBus } from './event-bus.js'

// Environment flags
const isPerfMode = process.env.PERF === '1'
const isCI = process.env.CI === 'true'

interface PerformanceTarget {
  name: string
  target: number
  unit: string
  description: string
}

interface PerformanceResult {
  name: string
  value: number
  target: number
  passed: boolean
  unit: string
}

const PERFORMANCE_TARGETS: PerformanceTarget[] = [
  {
    name: 'Emission Latency (P95)',
    target: isCI ? 2.0 : 1.0,
    unit: 'ms',
    description: 'Time to emit an event should be < 1ms (2ms in CI)',
  },
  {
    name: 'Throughput',
    target: 10000,
    unit: 'events/sec',
    description: 'Should handle 10,000 events per second',
  },
  {
    name: 'Orchestration Overhead',
    target: 100,
    unit: 'ms',
    description: 'Total overhead should be < 100ms',
  },
  {
    name: 'Queue Recovery Time',
    target: 500,
    unit: 'ms',
    description: 'Should recover from saturation within 500ms',
  },
  {
    name: 'Memory Overhead',
    target: 10,
    unit: 'MB',
    description: 'Memory usage should stay under 10MB for 1000 events',
  },
]

describe.skipIf(!isPerfMode && !isCI)(
  'Event Bus Performance Validation',
  () => {
    const results: PerformanceResult[] = []

    it('should validate emission latency target', async () => {
      const eventBus = new BoundedEventBus({ maxQueueSize: 10000 })
      const latencies: number[] = []

      // Add a simple listener
      eventBus.on('perf.latency', () => {
        // Minimal work
      })

      // Measure emission latency
      for (let i = 0; i < 1000; i++) {
        const start = performance.now()
        eventBus.emitEvent({
          type: 'perf.latency',
          id: i,
        } as OrchestrationEvent)
        const end = performance.now()
        latencies.push(end - start)
      }

      // Calculate P95
      latencies.sort((a, b) => a - b)
      const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0

      const target = PERFORMANCE_TARGETS[0]
      results.push({
        name: target.name,
        value: p95,
        target: target.target,
        passed: p95 < target.target,
        unit: target.unit,
      })

      expect(p95).toBeLessThan(target.target)
    })

    it('should validate throughput target', async () => {
      const eventBus = new BoundedEventBus({ maxQueueSize: 20000 })

      eventBus.on('perf.throughput', () => {})

      const eventCount = 10000
      const startTime = performance.now()

      // Emit events as fast as possible
      for (let i = 0; i < eventCount; i++) {
        eventBus.emitEvent({
          type: 'perf.throughput',
          id: i,
        } as OrchestrationEvent)
      }

      const emitTime = performance.now() - startTime

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const throughput = (eventCount / emitTime) * 1000

      const target = PERFORMANCE_TARGETS[1]
      results.push({
        name: target.name,
        value: throughput,
        target: target.target,
        passed: throughput > target.target,
        unit: target.unit,
      })

      expect(throughput).toBeGreaterThan(target.target)
    })

    it('should validate orchestration overhead', async () => {
      const eventBus = new BoundedEventBus({ maxQueueSize: 5000 })
      const overheads: number[] = []

      // Simulate orchestration with multiple listeners
      for (let i = 0; i < 5; i++) {
        eventBus.on('perf.overhead', async () => {
          // Simulate some work
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
      }

      // Measure overhead for batch processing
      for (let batch = 0; batch < 10; batch++) {
        const startTime = performance.now()

        // Emit batch of events
        for (let i = 0; i < 100; i++) {
          eventBus.emitEvent({
            type: 'perf.overhead',
            batch,
            id: i,
          } as OrchestrationEvent)
        }

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 50))

        const overhead = performance.now() - startTime
        overheads.push(overhead)
      }

      const avgOverhead =
        overheads.reduce((sum, o) => sum + o, 0) / overheads.length

      const target = PERFORMANCE_TARGETS[2]
      results.push({
        name: target.name,
        value: avgOverhead,
        target: target.target,
        passed: avgOverhead < target.target,
        unit: target.unit,
      })

      expect(avgOverhead).toBeLessThan(target.target)
    })

    it('should validate queue recovery time', async () => {
      const eventBus = new BoundedEventBus({
        maxQueueSize: 100,
        warnOnDrop: false,
      })

      let slowProcessing = true

      eventBus.on('perf.recovery', async () => {
        if (slowProcessing) {
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      })

      // Saturate the queue
      for (let i = 0; i < 500; i++) {
        eventBus.emitEvent({
          type: 'perf.recovery',
          id: i,
        } as OrchestrationEvent)
      }

      // Measure recovery time
      slowProcessing = false
      const recoveryStart = performance.now()

      // Wait for queue to drain
      while (eventBus.getMetrics().queueSize > 0) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      const recoveryTime = performance.now() - recoveryStart

      const target = PERFORMANCE_TARGETS[3]
      results.push({
        name: target.name,
        value: recoveryTime,
        target: target.target,
        passed: recoveryTime < target.target,
        unit: target.unit,
      })

      expect(recoveryTime).toBeLessThan(target.target)
    })

    it('should validate memory overhead', async () => {
      const eventBus = new BoundedEventBus({
        maxQueueSize: 1000,
        enableMemoryTracking: true,
      })

      // Measure initial memory
      if (global.gc) global.gc()
      const memBefore = process.memoryUsage().heapUsed

      // Create 1000 events with payload
      for (let i = 0; i < 1000; i++) {
        eventBus.emitEvent({
          type: 'perf.memory',
          id: i,
          payload: {
            data: 'x'.repeat(1000), // 1KB per event
            timestamp: Date.now(),
            metadata: {
              source: 'performance-test',
              index: i,
            },
          },
        } as OrchestrationEvent)
      }

      // Process events

      eventBus.on('perf.memory', () => {})

      await new Promise((resolve) => setTimeout(resolve, 500))

      // Measure memory after
      const memAfter = process.memoryUsage().heapUsed
      const memoryOverheadBytes = memAfter - memBefore
      const memoryOverheadMB = memoryOverheadBytes / (1024 * 1024)

      const target = PERFORMANCE_TARGETS[4]
      results.push({
        name: target.name,
        value: memoryOverheadMB,
        target: target.target,
        passed: memoryOverheadMB < target.target,
        unit: target.unit,
      })

      expect(memoryOverheadMB).toBeLessThan(target.target)
    })

    it('should print comprehensive performance report', () => {
      console.log('\n' + '='.repeat(80))
      console.log('📊 PERFORMANCE VALIDATION REPORT')
      console.log('='.repeat(80))

      const allPassed = results.every((r) => r.passed)

      // Summary
      console.log('\n📈 Summary:')
      console.log(`  Total Tests: ${results.length}`)
      console.log(`  Passed: ${results.filter((r) => r.passed).length}`)
      console.log(`  Failed: ${results.filter((r) => !r.passed).length}`)
      console.log(`  Overall: ${allPassed ? '✅ PASS' : '❌ FAIL'}`)

      // Detailed Results
      console.log('\n📋 Detailed Results:')
      console.log('-'.repeat(80))

      for (const result of results) {
        const status = result.passed ? '✅' : '❌'
        const comparison =
          result.unit === 'events/sec' || result.unit === 'MB'
            ? result.passed
              ? '<='
              : '>'
            : result.passed
              ? '<'
              : '≥'

        console.log(`\n${status} ${result.name}`)
        console.log(`  Actual: ${result.value.toFixed(2)} ${result.unit}`)
        console.log(`  Target: ${comparison} ${result.target} ${result.unit}`)
        console.log(`  Result: ${result.passed ? 'PASS' : 'FAIL'}`)
      }

      // Performance Targets Reference
      console.log('\n📖 Performance Targets:')
      console.log('-'.repeat(80))

      for (const target of PERFORMANCE_TARGETS) {
        console.log(`\n• ${target.name}`)
        console.log(`  Target: ${target.target} ${target.unit}`)
        console.log(`  Description: ${target.description}`)
      }

      console.log('\n' + '='.repeat(80))

      // CI enforcement
      if (!allPassed && isCI) {
        console.log('\n❌ Performance validation failed in CI')
        console.log('Some performance targets were not met.')
        console.log('Please investigate and optimize the affected areas.')
        process.exit(1)
      }

      expect(allPassed).toBe(true)
    })

    it('should validate performance under concurrent load', async () => {
      const eventBus = new BoundedEventBus({ maxQueueSize: 5000 })
      const concurrentEmitters = 10
      const eventsPerEmitter = 1000

      // Track emit times for performance validation

      // Create concurrent emitters
      const emitters = Array.from({ length: concurrentEmitters }, (_, i) =>
        (async () => {
          const start = performance.now()
          for (let j = 0; j < eventsPerEmitter; j++) {
            eventBus.emitEvent({
              type: 'perf.concurrent',
              emitter: i,
              event: j,
            } as OrchestrationEvent)
          }
          const end = performance.now()
          return end - start
        })(),
      )

      // Run all emitters concurrently
      const times = await Promise.all(emitters)
      const avgEmitTime = times.reduce((sum, t) => sum + t, 0) / times.length
      const totalEvents = concurrentEmitters * eventsPerEmitter
      const concurrentThroughput = (totalEvents / avgEmitTime) * 1000

      console.log('\n🔄 Concurrent Performance:')
      console.log(`  Emitters: ${concurrentEmitters}`)
      console.log(`  Events per emitter: ${eventsPerEmitter}`)
      console.log(`  Total events: ${totalEvents}`)
      console.log(`  Avg emit time: ${avgEmitTime.toFixed(2)}ms`)
      console.log(
        `  Concurrent throughput: ${concurrentThroughput.toFixed(0)} events/sec`,
      )

      expect(concurrentThroughput).toBeGreaterThan(10000)
    })

    it('should validate latency percentiles', async () => {
      const eventBus = new BoundedEventBus({ maxQueueSize: 10000 })
      const endToEndLatencies: number[] = []
      const emitTimes = new Map<number, number>()

      eventBus.on('perf.percentiles', (event: OrchestrationEvent) => {
        const receiveTime = performance.now()
        const id = (event as { type: string; id: number }).id
        const emitTime = emitTimes.get(id)
        if (emitTime) {
          endToEndLatencies.push(receiveTime - emitTime)
        }
      })

      // Emit many events
      for (let i = 0; i < 10000; i++) {
        const emitTime = performance.now()
        emitTimes.set(i, emitTime)
        eventBus.emitEvent({
          type: 'perf.percentiles',
          id: i,
        } as OrchestrationEvent)
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Calculate percentiles
      endToEndLatencies.sort((a, b) => a - b)
      const p50 =
        endToEndLatencies[Math.floor(endToEndLatencies.length * 0.5)] ?? 0
      const p90 =
        endToEndLatencies[Math.floor(endToEndLatencies.length * 0.9)] ?? 0
      const p95 =
        endToEndLatencies[Math.floor(endToEndLatencies.length * 0.95)] ?? 0
      const p99 =
        endToEndLatencies[Math.floor(endToEndLatencies.length * 0.99)] ?? 0
      const p999 =
        endToEndLatencies[Math.floor(endToEndLatencies.length * 0.999)] ?? 0

      console.log('\n📊 Latency Percentiles:')
      console.log(`  P50:  ${p50.toFixed(3)}ms`)
      console.log(`  P90:  ${p90.toFixed(3)}ms`)
      console.log(`  P95:  ${p95.toFixed(3)}ms`)
      console.log(`  P99:  ${p99.toFixed(3)}ms`)
      console.log(`  P99.9: ${p999.toFixed(3)}ms`)

      // Validate percentiles
      expect(p50).toBeLessThan(1.0)
      expect(p95).toBeLessThan(isCI ? 3.0 : 2.0)
      expect(p99).toBeLessThan(isCI ? 5.0 : 3.0)
    })
  },
)
