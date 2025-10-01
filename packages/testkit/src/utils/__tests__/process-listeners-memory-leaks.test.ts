/**
 * Tests for process listener memory leak fixes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  ProcessListenerManager,
  globalProcessListenerManager,
  addProcessListener,
  removeProcessListener,
  removeAllProcessListeners,
  getProcessListenerStats,
  detectProcessListenerLeaks,
  createExitHandler,
} from '../process-listeners.js'

describe('ProcessListenerManager memory leak prevention', () => {
  let manager: ProcessListenerManager

  beforeEach(() => {
    manager = new ProcessListenerManager({ enableLogging: false })
  })

  afterEach(() => {
    // Clean up any listeners added during tests
    manager.removeAllListeners()
  })

  describe('listener registration and cleanup', () => {
    it('should register and remove listeners without leaking', () => {
      const handler = () => {}

      // Register listener
      const removeListener = manager.addListener('exit', handler, {
        description: 'test handler',
      })

      const stats = manager.getStats()
      expect(stats.totalListeners).toBe(1)
      expect(stats.listenersByEvent.exit).toBe(1)

      // Remove listener
      removeListener()

      const finalStats = manager.getStats()
      expect(finalStats.totalListeners).toBe(0)
      expect(finalStats.listenersByEvent.exit).toBe(0)
    })

    it('should prevent duplicate listener registration', () => {
      const handler = () => {}

      manager.addListener('exit', handler)

      expect(() => {
        manager.addListener('exit', handler) // Same handler, same event
      }).toThrow('already registered')
    })

    it('should enforce maximum listeners per event', () => {
      const maxListeners = 3
      const managerWithLimit = new ProcessListenerManager({
        enableLogging: false,
        maxListenersPerEvent: maxListeners,
      })

      // Add maximum number of listeners
      for (let i = 0; i < maxListeners; i++) {
        const handler = () => {}
        managerWithLimit.addListener('exit', handler, {
          description: `handler ${i}`,
        })
      }

      // Adding one more should fail
      expect(() => {
        managerWithLimit.addListener('exit', () => {})
      }).toThrow('Maximum listeners')

      managerWithLimit.removeAllListeners()
    })

    it('should track listener age and detect old listeners', async () => {
      const handler = () => {}

      manager.addListener('exit', handler, {
        description: 'old handler',
      })

      // Wait a tiny bit to ensure age > 0, then check with 0ms threshold
      await new Promise((resolve) => setTimeout(resolve, 1))
      const leaks = manager.detectPotentialLeaks(0) // 0ms threshold to catch immediately
      expect(leaks.length).toBe(1)
      expect(leaks[0].description).toBe('old handler')
    })

    it('should remove all listeners for specific event', () => {
      const handler1 = () => {}
      const handler2 = () => {}
      const handler3 = () => {}

      manager.addListener('exit', handler1)
      manager.addListener('exit', handler2)
      manager.addListener('SIGINT', handler3)

      expect(manager.getListenerCount('exit')).toBe(2)
      expect(manager.getListenerCount('SIGINT')).toBe(1)

      const removed = manager.removeAllListenersForEvent('exit')
      expect(removed).toBe(2)
      expect(manager.getListenerCount('exit')).toBe(0)
      expect(manager.getListenerCount('SIGINT')).toBe(1) // Should remain
    })

    it('should remove all listeners across all events', () => {
      const handler1 = () => {}
      const handler2 = () => {}
      const handler3 = () => {}

      manager.addListener('exit', handler1)
      manager.addListener('SIGINT', handler2)
      manager.addListener('SIGTERM', handler3)

      expect(manager.getTotalListenerCount()).toBe(3)

      manager.removeAllListeners()
      expect(manager.getTotalListenerCount()).toBe(0)
    })
  })

  describe('one-time listeners', () => {
    it('should handle once listeners correctly', () => {
      const handler = () => {}

      const removeListener = manager.addOnceListener('exit', handler, 'test once')

      const stats = manager.getStats()
      expect(stats.totalListeners).toBe(1)

      // Should be able to remove manually
      const removed = removeListener()
      expect(removed).toBe(true)

      const finalStats = manager.getStats()
      expect(finalStats.totalListeners).toBe(0)
    })
  })

  describe('global manager functions', () => {
    afterEach(() => {
      // Clean up global manager
      removeAllProcessListeners()
    })

    it('should work with global convenience functions', () => {
      const handler = () => {}

      const removeListener = addProcessListener('exit', handler, {
        description: 'global test',
      })

      const stats = getProcessListenerStats()
      expect(stats.totalListeners).toBeGreaterThanOrEqual(1)

      const removed = removeProcessListener('exit', handler)
      expect(removed).toBe(true)

      // Alternative cleanup via returned function
      removeListener() // Should not throw even if already removed
    })

    it('should detect leaks in global manager', async () => {
      const handler = () => {}
      addProcessListener('exit', handler, { description: 'leak test' })

      // Wait a tiny bit to ensure age > 0
      await new Promise((resolve) => setTimeout(resolve, 1))
      const leaks = detectProcessListenerLeaks(0) // 0ms threshold
      expect(leaks.length).toBeGreaterThanOrEqual(1)

      // Find our test leak
      const testLeak = leaks.find((leak) => leak.description === 'leak test')
      expect(testLeak).toBeDefined()
    })
  })

  describe('exit handler utility', () => {
    it('should create and clean up exit handlers', () => {
      let cleanupCalled = false
      const cleanup = () => {
        cleanupCalled = true
      }

      const removeHandler = createExitHandler(cleanup, {
        events: ['exit', 'SIGINT'],
        description: 'test exit handler',
      })

      const stats = getProcessListenerStats()
      expect(stats.totalListeners).toBeGreaterThanOrEqual(2) // At least 2 events

      // Clean up
      removeHandler()

      expect(cleanupCalled).toBe(false) // Cleanup only called on actual exit
    })

    it('should handle async cleanup with timeout', async () => {
      let cleanupStarted = false
      let cleanupCompleted = false

      const asyncCleanup = async () => {
        cleanupStarted = true
        await new Promise((resolve) => setTimeout(resolve, 100))
        cleanupCompleted = true
      }

      const removeHandler = createExitHandler(asyncCleanup, {
        timeout: 200, // Allow enough time
        description: 'async cleanup test',
      })

      // The handler is registered but cleanup won't run until actual exit
      const stats = getProcessListenerStats()
      expect(stats.totalListeners).toBeGreaterThanOrEqual(1)

      removeHandler()

      // Cleanup hasn't run because process didn't exit
      expect(cleanupStarted).toBe(false)
      expect(cleanupCompleted).toBe(false)
    })
  })

  describe('memory leak regression tests', () => {
    it('should not accumulate listeners across multiple registrations', () => {
      const initialStats = globalProcessListenerManager.getStats()
      const initialCount = initialStats.totalListeners

      // Register and remove multiple times
      for (let i = 0; i < 10; i++) {
        const handler = () => {}
        const remove = addProcessListener('exit', handler, {
          description: `iteration ${i}`,
        })
        remove()
      }

      const finalStats = globalProcessListenerManager.getStats()
      expect(finalStats.totalListeners).toBe(initialCount)
    })

    it('should handle rapid register/unregister cycles', () => {
      // Create manager with higher limit for this test
      const highLimitManager = new ProcessListenerManager({
        enableLogging: false,
        maxListenersPerEvent: 100,
      })

      const handlers: Array<() => void> = []
      const removeFunctions: Array<() => void> = []

      // Rapid registration
      for (let i = 0; i < 50; i++) {
        const handler = () => {}
        handlers.push(handler)
        const remove = highLimitManager.addListener('exit', handler, {
          description: `rapid ${i}`,
        })
        removeFunctions.push(remove)
      }

      expect(highLimitManager.getTotalListenerCount()).toBe(50)

      // Rapid cleanup
      removeFunctions.forEach((remove) => remove())

      expect(highLimitManager.getTotalListenerCount()).toBe(0)

      // Clean up the manager
      highLimitManager.removeAllListeners()
    })

    it('should prevent listener accumulation from failed cleanups', () => {
      const handler1 = () => {}
      const handler2 = () => {}

      // Register listeners
      manager.addListener('exit', handler1)
      manager.addListener('SIGINT', handler2)

      expect(manager.getTotalListenerCount()).toBe(2)

      // Even if individual removal fails, removeAllListeners should work
      manager.removeAllListeners()
      expect(manager.getTotalListenerCount()).toBe(0)
    })
  })

  describe('resource integration', () => {
    it('should integrate with resource cleanup system', () => {
      // The ProcessListenerManager should register itself as a resource
      // This is tested indirectly by ensuring cleanup works properly
      const handler = () => {}
      const remove = addProcessListener('exit', handler, {
        description: 'resource integration test',
      })

      // Normal cleanup should work
      expect(() => remove()).not.toThrow()
    })
  })

  describe('error handling', () => {
    it('should handle removal of non-existent listeners', () => {
      const handler = () => {}

      // Try to remove a listener that was never added
      const removed = manager.removeListener('exit', handler)
      expect(removed).toBe(false)
    })

    it('should handle removal from empty manager', () => {
      const removed = manager.removeAllListenersForEvent('exit')
      expect(removed).toBe(0)

      expect(() => manager.removeAllListeners()).not.toThrow()
    })

    it('should handle invalid event types gracefully', () => {
      const handler = () => {}

      // Manager should handle all defined ProcessEvent types
      expect(() => {
        manager.addListener('uncaughtException', handler)
        manager.addListener('unhandledRejection', handler)
        manager.addListener('beforeExit', handler)
      }).not.toThrow()

      manager.removeAllListeners()
    })
  })
})

describe('integration tests with actual process events', () => {
  // These tests are more careful to avoid actually triggering process exits

  it('should register real process listeners without side effects', () => {
    const originalListenerCount = process.listenerCount('exit')

    const handler = () => {}
    const remove = addProcessListener('exit', handler, {
      description: 'integration test',
    })

    // Should have added one listener
    expect(process.listenerCount('exit')).toBe(originalListenerCount + 1)

    // Clean up
    remove()

    // Should be back to original count
    expect(process.listenerCount('exit')).toBe(originalListenerCount)
  })

  it('should work with Node.js process listener limits', () => {
    const originalMaxListeners = process.getMaxListeners()

    // Temporarily set a low limit for testing
    process.setMaxListeners(5)

    try {
      const removeFunctions: Array<() => void> = []

      // Add listeners up to the limit
      for (let i = 0; i < 3; i++) {
        const handler = () => {}
        const remove = addProcessListener('exit', handler, {
          description: `limit test ${i}`,
        })
        removeFunctions.push(remove)
      }

      // Clean up
      removeFunctions.forEach((remove) => remove())
    } finally {
      // Restore original limit
      process.setMaxListeners(originalMaxListeners)
    }
  })
})
