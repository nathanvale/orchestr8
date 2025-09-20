/**
 * Vitest Force-Kill Setup
 *
 * Implements aggressive termination policies for hanging tests and processes.
 * This setup file provides nuclear options to prevent zombie processes from
 * surviving beyond configured timeouts.
 */

import { afterEach, beforeEach, onTestFailed, onTestFinished } from 'vitest'
import { processTracker } from './packages/quality-check/src/process-tracker.js'

/**
 * Environment-specific timeout profiles
 */
const timeoutProfiles = {
  unit: {
    testTimeout: 5000, // 5s for unit tests
    hookTimeout: 2000, // 2s for setup/teardown
    teardownTimeout: 1000, // 1s aggressive teardown
  },
  integration: {
    testTimeout: 15000, // 15s for integration tests
    hookTimeout: 5000, // 5s for setup/teardown
    teardownTimeout: 3000, // 3s teardown
  },
  e2e: {
    testTimeout: 30000, // 30s for e2e tests
    hookTimeout: 10000, // 10s for setup/teardown
    teardownTimeout: 5000, // 5s teardown
  },
  ci: {
    testTimeout: 45000, // More lenient in CI
    hookTimeout: 15000, // More lenient hooks in CI
    teardownTimeout: 10000, // More lenient teardown in CI
  },
} as const

/**
 * Determine timeout profile based on environment and test type
 */
function getTimeoutProfile() {
  // Check if running in CI
  if (process.env['CI'] === 'true') {
    return timeoutProfiles.ci
  }

  // Get current test file from stack trace
  const stack = new Error().stack || ''
  const testFile = stack
    .split('\n')
    .find((line) => line.includes('.test.') || line.includes('.spec.'))

  if (testFile?.includes('.e2e.')) {
    return timeoutProfiles.e2e
  }
  if (testFile?.includes('.integration.')) {
    return timeoutProfiles.integration
  }

  return timeoutProfiles.unit
}

/**
 * Hanging Test Detector
 *
 * Tracks individual test execution and force-kills processes that exceed timeouts.
 */
class HangingTestDetector {
  private activeTests = new Map<string, NodeJS.Timeout>()
  private testStartTimes = new Map<string, number>()
  private forceKillTimeouts = new Map<string, NodeJS.Timeout>()
  private readonly profile = getTimeoutProfile()

  /**
   * Start tracking a test with force-kill timeout
   */
  startTest(testName: string): void {
    const startTime = Date.now()
    this.testStartTimes.set(testName, startTime)

    // Set up hanging test detection timeout
    const hangingTimeout = setTimeout(() => {
      console.error(`\n❌ TEST HANGING: "${testName}" exceeded ${this.profile.testTimeout}ms`)
      this.forceKillTest(testName)
    }, this.profile.testTimeout)

    this.activeTests.set(testName, hangingTimeout)

    // Nuclear option: Force exit if test runs way too long
    const nuclearTimeout = setTimeout(() => {
      console.error(
        `\n💥 NUCLEAR KILL: Test "${testName}" exceeded nuclear timeout, terminating process`,
      )
      this.nuclearExit()
    }, this.profile.testTimeout * 2)

    this.forceKillTimeouts.set(testName, nuclearTimeout)
  }

  /**
   * End test tracking and cleanup timeouts
   */
  endTest(testName: string): void {
    const startTime = this.testStartTimes.get(testName)
    if (startTime) {
      const duration = Date.now() - startTime

      // Log slow tests
      if (duration > this.profile.testTimeout * 0.8) {
        console.warn(
          `⚠️ SLOW TEST: "${testName}" took ${duration}ms (${((duration / this.profile.testTimeout) * 100).toFixed(1)}% of timeout)`,
        )
      }

      this.testStartTimes.delete(testName)
    }

    // Clear timeouts
    const hangingTimeout = this.activeTests.get(testName)
    if (hangingTimeout) {
      clearTimeout(hangingTimeout)
      this.activeTests.delete(testName)
    }

    const nuclearTimeout = this.forceKillTimeouts.get(testName)
    if (nuclearTimeout) {
      clearTimeout(nuclearTimeout)
      this.forceKillTimeouts.delete(testName)
    }
  }

  /**
   * Force kill all processes associated with a hanging test
   */
  private forceKillTest(testName: string): void {
    try {
      // Get all processes that might be associated with this test
      const processes = processTracker.getProcessesByTest(testName)

      if (processes.length > 0) {
        console.error(`🔪 Force killing ${processes.length} processes for test: ${testName}`)

        // Force kill all processes
        processes.forEach((p) => {
          try {
            console.error(`  Killing PID ${p.pid}: ${p.command}`)
            process.kill(p.pid, 'SIGKILL')
          } catch {
            // Process may already be dead, ignore
          }
        })
      }

      // If this is the only test running, consider exiting
      if (this.activeTests.size <= 1) {
        console.error(`💀 No other tests running, considering process exit...`)

        // Give a small grace period before nuclear exit
        setTimeout(() => {
          if (this.activeTests.size === 0) {
            this.nuclearExit()
          }
        }, 2000)
      }
    } catch (error) {
      console.error(`❌ Error during force kill of test "${testName}":`, error)
    }
  }

  /**
   * Nuclear option: Force exit the entire process
   */
  private nuclearExit(): void {
    console.error(`\n💥 NUCLEAR EXIT: Force terminating test process due to hanging tests`)
    console.error(`Active tests: ${Array.from(this.activeTests.keys()).join(', ')}`)

    // Try to cleanup what we can
    try {
      processTracker.cleanupAll(true).catch(() => {
        // Ignore cleanup errors during nuclear exit
      })
    } catch {
      // Ignore cleanup errors
    }

    // Exit with failure code
    process.exit(1)
  }

  /**
   * Get currently active tests for debugging
   */
  getActiveTests(): string[] {
    return Array.from(this.activeTests.keys())
  }

  /**
   * Get timeout profile being used
   */
  getProfile() {
    return this.profile
  }
}

// Global hanging test detector instance
const hangingTestDetector = new HangingTestDetector()

// Track test execution time and set up force-kill timeouts
let currentTestName: string
let testStartTime: number
let globalTimeoutKiller: NodeJS.Timeout | undefined

beforeEach(({ task }) => {
  currentTestName = task.name
  testStartTime = Date.now()

  // Start hanging test detection
  hangingTestDetector.startTest(currentTestName)

  // Set up global timeout killer as backup
  const profile = hangingTestDetector.getProfile()
  globalTimeoutKiller = setTimeout(() => {
    console.error(`\n⏰ GLOBAL TIMEOUT: Test "${currentTestName}" exceeded global timeout`)

    // Try graceful exit first
    setTimeout(() => {
      console.error(`💥 GLOBAL FORCE EXIT: Graceful exit failed, force terminating`)
      process.exit(1)
    }, 1000)

    // Trigger test failure to attempt graceful exit
    throw new Error(`Test "${currentTestName}" exceeded global timeout of ${profile.testTimeout}ms`)
  }, profile.testTimeout + 5000) // Give 5s extra before global kill

  if (process.env['PROCESS_DEBUG'] === 'true') {
    console.log(`🎯 Starting test: ${currentTestName} (timeout: ${profile.testTimeout}ms)`)
  }
})

afterEach(({ task }) => {
  const duration = Date.now() - testStartTime

  // Clear global timeout killer
  if (globalTimeoutKiller) {
    clearTimeout(globalTimeoutKiller)
    globalTimeoutKiller = undefined
  }

  // End hanging test detection
  hangingTestDetector.endTest(task.name)

  // Log test completion in debug mode
  if (process.env['PROCESS_DEBUG'] === 'true') {
    const profile = hangingTestDetector.getProfile()
    const percentUsed = ((duration / profile.testTimeout) * 100).toFixed(1)
    console.log(`✅ Completed test: ${task.name} (${duration}ms, ${percentUsed}% of timeout)`)
  }
})

// Handle test failures with aggressive cleanup
onTestFailed(({ task, errors }) => {
  const testName = task.name
  console.error(`❌ Test failed: ${testName}`)

  if (process.env['PROCESS_DEBUG'] === 'true') {
    console.error(`Errors:`, errors)
  }

  // Force kill any hanging processes on test failure
  try {
    const processes = processTracker.getProcessesByTest(testName)
    if (processes.length > 0) {
      console.error(`🧹 Cleaning up ${processes.length} processes after test failure`)
      processes.forEach((p) => {
        try {
          process.kill(p.pid, 'SIGKILL')
        } catch {
          // Process may already be dead
        }
      })
    }
  } catch (error) {
    console.error(`❌ Error during test failure cleanup:`, error)
  }

  // End hanging test detection
  hangingTestDetector.endTest(testName)
})

// Handle successful test completion
onTestFinished(({ task }) => {
  hangingTestDetector.endTest(task.name)
})

// Emergency exit handlers for unhandled process issues
const emergencyExitHandler = (signal: string) => {
  console.error(`\n🚨 EMERGENCY EXIT: Received ${signal} during test execution`)
  console.error(`Active tests: ${hangingTestDetector.getActiveTests().join(', ')}`)

  // Try to cleanup what we can quickly
  try {
    processTracker.cleanupAll(true).catch(() => {
      // Ignore cleanup errors during emergency exit
    })
  } catch {
    // Ignore cleanup errors
  }

  process.exit(signal === 'SIGINT' ? 130 : 1)
}

// Register emergency handlers (only once)
if (!process.env['_FORCE_KILL_REGISTERED']) {
  process.env['_FORCE_KILL_REGISTERED'] = 'true'

  process.once('SIGINT', () => emergencyExitHandler('SIGINT'))
  process.once('SIGTERM', () => emergencyExitHandler('SIGTERM'))
  process.once('uncaughtException', (error) => {
    console.error(`❌ Uncaught exception during test:`, error)
    emergencyExitHandler('uncaughtException')
  })
  process.once('unhandledRejection', (reason) => {
    console.error(`❌ Unhandled rejection during test:`, reason)
    emergencyExitHandler('unhandledRejection')
  })
}

// Export for testing
export { hangingTestDetector, getTimeoutProfile, timeoutProfiles }
