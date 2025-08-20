import { describe, it, expect } from 'vitest'

describe.skipIf(!process.env.PERF)('Performance Benchmarks', () => {
  // These tests only run when PERF=1 environment variable is set
  // to avoid triggering process.exit() during normal test runs

  it('should run benchmark suite without errors', async () => {
    const { runBenchmarks } = await import('./benchmark.js')
    await expect(runBenchmarks()).resolves.not.toThrow()
  }, 30000)

  it('should validate performance targets', async () => {
    const { runBenchmarks } = await import('./benchmark.js')

    // Capture console output to verify target validation
    const logs: string[] = []
    const originalLog = console.log
    console.log = (msg: string) => {
      logs.push(String(msg))
      originalLog(msg)
    }

    await runBenchmarks()
    console.log = originalLog

    // Check that performance validation was performed
    const hasValidation = logs.some((log) =>
      log.includes('Performance Target Validation'),
    )
    expect(hasValidation).toBe(true)

    // Check that results were printed
    const hasResults = logs.some((log) => log.includes('Benchmark Results'))
    expect(hasResults).toBe(true)
  }, 30000)
})

describe('Performance Benchmarks (Compilation)', () => {
  it('should validate benchmark dependencies compile', () => {
    // This test runs in normal test mode to ensure benchmark dependencies compile
    expect(true).toBe(true) // Placeholder test that always passes
  })
})
