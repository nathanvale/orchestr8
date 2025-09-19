/**
 * Integration Test Base Setup
 *
 * Provides standardized setup and cleanup for integration tests,
 * ensuring proper resource management and test isolation.
 */

import { ChildProcess } from 'child_process'
import { afterEach, beforeEach, vi } from 'vitest'
import { TestResourceGuard } from './test-resource-guard.js'

interface IntegrationTestOptions {
  /** Enable fake timers (default: false) */
  useFakeTimers?: boolean
  /** Clear all mocks before each test (default: true) */
  clearMocks?: boolean
  /** Restore all mocks after each test (default: true) */
  restoreMocks?: boolean
  /** Additional cleanup functions to run */
  customCleanup?: Array<() => Promise<void> | void>
}

/**
 * Setup integration test environment with comprehensive resource management
 */
export function setupIntegrationTest(options: IntegrationTestOptions = {}) {
  const {
    useFakeTimers = false,
    clearMocks = true,
    restoreMocks = true,
    customCleanup = [],
  } = options

  const guard = new TestResourceGuard()

  beforeEach(() => {
    // Clear all mocks and timers
    if (clearMocks) {
      vi.clearAllMocks()
      vi.clearAllTimers()
    }

    // Setup fake timers if requested
    if (useFakeTimers) {
      vi.useFakeTimers()
    }

    // Register custom cleanup functions
    customCleanup.forEach((cleanup, index) => {
      guard.registerCleanup(`custom-${index}`, cleanup, 100) // High priority
    })
  })

  afterEach(async () => {
    try {
      // Restore timers first
      if (useFakeTimers || vi.isFakeTimers()) {
        vi.useRealTimers()
      }

      // Restore all mocks
      if (restoreMocks) {
        vi.restoreAllMocks()
      }

      // Run all tracked cleanup
      await guard.cleanup()
    } catch (error) {
      console.error('❌ Integration test cleanup failed:', error)
      throw error
    }
  })

  return guard
}

/**
 * Quick setup for simple integration tests with standard options
 */
export function setupSimpleIntegrationTest() {
  return setupIntegrationTest({
    useFakeTimers: false,
    clearMocks: true,
    restoreMocks: true,
  })
}

/**
 * Setup for integration tests that need timer control
 */
export function setupTimerIntegrationTest() {
  return setupIntegrationTest({
    useFakeTimers: true,
    clearMocks: true,
    restoreMocks: true,
  })
}

/**
 * Setup for integration tests with process spawning
 */
export function setupProcessIntegrationTest() {
  const guard = setupIntegrationTest()

  // Add process tracking helper
  return {
    ...guard,
    spawnProcess: (proc: ChildProcess, command: string, timeoutMs = 30000) => {
      guard.trackProcess(proc, command, timeoutMs)
      return proc
    },
  }
}

/**
 * Setup for integration tests with temporary directories
 */
export function setupFileSystemIntegrationTest(tempDirs: string[] = []) {
  const guard = setupIntegrationTest()

  // Track all temp directories
  tempDirs.forEach((dir) => guard.trackTempDir(dir))

  return {
    ...guard,
    addTempDir: (dir: string) => {
      guard.trackTempDir(dir)
    },
  }
}
