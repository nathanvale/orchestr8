import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { MemoryMonitor } from './memory-monitor.js'

// Global memory monitor instance
const globalMemoryMonitor = new MemoryMonitor({
  maxMemoryMB: 500,
  warningThresholdPercent: 80,
  enableTracking: true,
  enableWarnings: true,
  enableTrendReporting: process.env['MEMORY_TREND_REPORT'] === 'true',
})

// Track current test name
let currentTestName: string | undefined

// Setup hooks for memory monitoring
beforeAll(() => {
  // Start global monitoring
  globalMemoryMonitor.getProfiler().reset()

  if (process.env['MEMORY_DEBUG'] === 'true') {
    console.log('Memory monitoring enabled for test suite')
  }
})

beforeEach(({ task }) => {
  if (!task) return

  currentTestName = task.name

  // Take memory snapshot before test
  globalMemoryMonitor.beforeTest(currentTestName, {
    maxMemoryMB: Number(process.env['TEST_MEMORY_LIMIT_MB']) || 500,
  })

  // Check if we're already at memory warning threshold
  globalMemoryMonitor.checkMemoryWarning(currentTestName)
})

afterEach(({ task }) => {
  if (!task || !currentTestName) return

  // Take memory snapshot after test
  globalMemoryMonitor.afterTest(currentTestName)

  // Get memory data for this test
  const memoryData = globalMemoryMonitor.getTestData(currentTestName)

  if (memoryData && process.env['MEMORY_DEBUG'] === 'true') {
    const deltaHeap = (memoryData.delta.heapUsed / 1024 / 1024).toFixed(2)
    const afterHeap = (memoryData.after.memory.heapUsed / 1024 / 1024).toFixed(2)
    console.log(`Memory after ${task.name}: ${afterHeap}MB (delta: ${deltaHeap}MB)`)
  }

  // Check if test exceeded memory limits
  try {
    globalMemoryMonitor.checkMemoryLimit(currentTestName)
  } catch (error) {
    // Log the error but don't fail the test
    console.error(`Memory limit exceeded in test "${currentTestName}":`, error)

    if (process.env['FAIL_ON_MEMORY_LIMIT'] === 'true') {
      throw error
    }
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc()
  }

  currentTestName = undefined
})

afterAll(async () => {
  // Generate trend report if enabled
  if (process.env['MEMORY_TREND_REPORT'] === 'true') {
    const report = globalMemoryMonitor.generateTrendReport()

    console.log('\n=== Memory Usage Report ===')
    console.log(`Total tests: ${report.totalTests}`)
    console.log(`Average memory: ${report.averageMemoryUsage.toFixed(2)}MB`)
    console.log(`Peak memory: ${report.peakMemoryUsage.toFixed(2)}MB`)
    console.log(`Memory growth: ${report.memoryGrowthTrend.toFixed(2)}MB`)

    if (report.testsExceedingWarning.length > 0) {
      console.log(
        `\nTests exceeding warning threshold (${globalMemoryMonitor['config'].warningThresholdPercent}%):`,
      )
      report.testsExceedingWarning.forEach((test) => console.log(`  - ${test}`))
    }

    if (report.testsExceedingLimit.length > 0) {
      console.log('\nTests exceeding memory limit:')
      report.testsExceedingLimit.forEach((test) => console.log(`  - ${test}`))
    }

    if (report.potentialLeak) {
      console.warn(`\n⚠️  ${report.leakReason}`)
      console.warn(`Memory growth rate: ${report.memoryGrowthRate?.toFixed(2)}%`)
    }

    // Export report to file if path provided
    const reportPath = process.env['MEMORY_REPORT_PATH']
    if (reportPath) {
      try {
        await globalMemoryMonitor.exportTrendReport(reportPath)
        console.log(`\nMemory report exported to: ${reportPath}`)
      } catch (error) {
        console.error('Failed to export memory report:', error)
      }
    }
  }

  // Check for memory leaks
  const leaks = globalMemoryMonitor.detectMemoryLeaks()
  if (leaks.potentialLeak) {
    console.warn('\n⚠️  Potential memory leaks detected:')
    console.warn(`  Reason: ${leaks.reason}`)
    console.warn(`  Growth rate: ${leaks.growthRate?.toFixed(2)}%`)

    if (process.env['FAIL_ON_MEMORY_LEAK'] === 'true') {
      throw new Error(`Memory leak detected: ${leaks.reason}`)
    }
  }

  // Cleanup
  globalMemoryMonitor.cleanup()
})

// Export for programmatic access
export { globalMemoryMonitor }
