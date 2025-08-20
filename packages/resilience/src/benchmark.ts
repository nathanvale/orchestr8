import type { ResilienceInvocationContext } from '@orchestr8/schema'

import { performance } from 'node:perf_hooks'

import { ProductionResilienceAdapter } from './production-adapter.js'

// Environment variable gate for performance benchmarks
const isCI = process.env.CI === 'true'
const isPerfMode = process.env.PERF === '1'

if (!isPerfMode && !isCI) {
  console.log(
    '🏃‍♂️ Performance benchmarks are gated behind PERF=1 environment variable',
  )
  console.log('')
  console.log('To run benchmarks:')
  console.log('  PERF=1 pnpm benchmark')
  console.log('  PERF=1 tsx src/benchmark.ts')
  console.log('')
  console.log(
    'This prevents accidental execution of resource-intensive benchmarks.',
  )
  console.log(
    'Benchmarks should typically be run in dedicated CI jobs or during performance testing.',
  )
  process.exit(0)
}

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
}

interface BenchmarkOptions {
  iterations?: number
  warmupIterations?: number
}

class BenchmarkSuite {
  private results: BenchmarkResult[] = []

  async benchmark(
    name: string,
    fn: () => Promise<void>,
    options: BenchmarkOptions = {},
  ): Promise<BenchmarkResult> {
    const { iterations = 500, warmupIterations = 50 } = options

    // Warmup phase
    console.log(`Warming up ${name}...`)
    for (let i = 0; i < warmupIterations; i++) {
      await fn()
    }

    // Benchmark phase
    console.log(`Benchmarking ${name}...`)
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await fn()
      const end = performance.now()
      times.push(end - start)
    }

    // Calculate statistics
    times.sort((a, b) => a - b)
    const totalTime = times.reduce((sum, t) => sum + t, 0)
    const meanTime = totalTime / iterations
    const medianTime = times[Math.floor(iterations / 2)] ?? 0
    const p95Time = times[Math.floor(iterations * 0.95)] ?? 0
    const p99Time = times[Math.floor(iterations * 0.99)] ?? 0
    const minTime = times[0] ?? 0
    const maxTime = times[times.length - 1] ?? 0

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
    }

    this.results.push(result)
    return result
  }

  printResults(): void {
    console.log('\n📊 Benchmark Results\n')
    console.log('═'.repeat(80))

    for (const result of this.results) {
      console.log(`\n📈 ${result.name}`)
      console.log('─'.repeat(40))
      console.log(`  Iterations:    ${result.iterations}`)
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

    // Use relaxed thresholds in CI to account for variability
    const medianTarget = isCI ? 2.0 : 1.0 // 2ms in CI, 1ms locally
    const p95Target = isCI ? 5.0 : 2.0 // 5ms in CI, 2ms locally

    let allPassed = true
    for (const result of this.results) {
      const medianPasses = result.medianTime < medianTarget
      const p95Passes = result.p95Time < p95Target
      const passes = medianPasses && p95Passes

      if (!passes) allPassed = false

      const emoji = passes ? '✅' : '❌'
      const status = passes ? 'PASS' : 'FAIL'

      console.log(`${emoji} ${result.name}: ${status}`)
      console.log(
        `    Median: ${result.medianTime.toFixed(3)}ms (target: <${medianTarget}ms) ${medianPasses ? '✅' : '❌'}`,
      )
      console.log(
        `    P95:    ${result.p95Time.toFixed(3)}ms (target: <${p95Target}ms) ${p95Passes ? '✅' : '❌'}`,
      )
    }

    if (!allPassed && isCI) {
      console.log('\n❌ Performance targets not met in CI')
      process.exit(1)
    }
  }
}

// Benchmark implementations
export async function runBenchmarks(): Promise<void> {
  const suite = new BenchmarkSuite()

  // Create adapter
  const adapter = new ProductionResilienceAdapter()

  // Create test context
  const context: ResilienceInvocationContext = {
    workflowId: 'benchmark-workflow',
    stepId: 'benchmark-step',
    correlationId: 'benchmark-correlation',
  }

  // Test operations
  const successOperation = async () => {
    // Simulate minimal async work
    await Promise.resolve(42)
    return 42
  }

  // Unused operations commented out for future use
  // const failingOperation = async () => {
  //   await Promise.resolve()
  //   throw new Error('Simulated failure')
  // }

  // const slowOperation = async () => {
  //   await setTimeout(5)
  //   return 42
  // }

  console.log('Starting resilience pattern benchmarks...')

  // Benchmark 1: No resilience baseline
  await suite.benchmark('Baseline (no resilience)', async () => {
    await successOperation()
  })

  // Benchmark 2: Timeout only
  await suite.benchmark('Timeout pattern only', async () => {
    await adapter.applyNormalizedPolicy(
      successOperation,
      {
        timeout: 1000,
      },
      'timeout-cb-retry',
      undefined,
      context,
    )
  })

  // Benchmark 3: Retry only (no failures)
  await suite.benchmark('Retry pattern only (success)', async () => {
    await adapter.applyNormalizedPolicy(
      successOperation,
      {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          jitterStrategy: 'full-jitter',
          initialDelay: 100,
          maxDelay: 5000,
        },
      },
      'retry-cb-timeout',
      undefined,
      context,
    )
  })

  // Benchmark 4: Circuit breaker only (closed state)
  await suite.benchmark('Circuit breaker only (closed)', async () => {
    await adapter.applyNormalizedPolicy(
      successOperation,
      {
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTime: 1000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
      },
      'retry-cb-timeout',
      undefined,
      context,
    )
  })

  // Benchmark 5: Retry + Circuit Breaker + Timeout
  await suite.benchmark('Full pattern composition', async () => {
    await adapter.applyNormalizedPolicy(
      successOperation,
      {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          jitterStrategy: 'none',
          initialDelay: 100,
          maxDelay: 1000,
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTime: 1000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
        timeout: 1000,
      },
      'retry-cb-timeout',
      undefined,
      context,
    )
  })

  // Benchmark 6: Circuit breaker state lookup
  await suite.benchmark('Circuit breaker lookup (1000 keys)', async () => {
    // Pre-populate with many keys to test Map performance
    const testContext = {
      ...context,
      stepId: `step-${Math.floor(Math.random() * 1000)}`,
    }

    await adapter.applyNormalizedPolicy(
      successOperation,
      {
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTime: 1000,
          sampleSize: 10,
          halfOpenPolicy: 'single-probe',
        },
      },
      'retry-cb-timeout',
      undefined,
      testContext,
    )
  })

  // Benchmark 7: Retry with backoff calculation
  await suite.benchmark('Retry with exponential backoff', async () => {
    let attempt = 0
    const operationWithFailures = async () => {
      attempt++
      if (attempt < 2) {
        throw new Error('Simulated failure')
      }
      return 42
    }

    attempt = 0 // Reset for each benchmark iteration
    await adapter.applyNormalizedPolicy(
      operationWithFailures,
      {
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          jitterStrategy: 'full-jitter',
          initialDelay: 10,
          maxDelay: 1000,
        },
      },
      'retry-cb-timeout',
      undefined,
      context,
    )
  })

  // Benchmark 8: Parallel execution simulation
  await suite.benchmark('Parallel execution (10 operations)', async () => {
    const operations = Array.from({ length: 10 }, (_, i) => {
      const opContext = { ...context, stepId: `parallel-${i}` }
      return adapter.applyNormalizedPolicy(
        successOperation,
        {
          timeout: 1000,
        },
        'timeout-cb-retry',
        undefined,
        opContext,
      )
    })

    await Promise.all(operations)
  })

  // Print results
  suite.printResults()

  console.log('Benchmark suite completed')
}

// Run benchmarks if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmarks().catch(console.error)
}
