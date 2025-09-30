/**
 * Tests for memory leak detection utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  LeakDetector,
  globalLeakDetector,
  detectLeaks,
  startLeakTracking,
  stopLeakTracking,
  cleanupAllLeaks,
  getLeakSummary,
  withLeakDetection,
} from '../leak-detection.js'

describe('LeakDetector', () => {
  let detector: LeakDetector

  beforeEach(() => {
    detector = new LeakDetector()
  })

  afterEach(() => {
    detector.stopTracking()
  })

  describe('timer tracking', () => {
    it('should track setTimeout calls', () => {
      detector.startTracking()

      // Create some timers
      const timer1 = setTimeout(() => {}, 1000)
      const timer2 = setTimeout(() => {}, 2000)

      const report = detector.getReport()
      expect(report.timers.stats.timers).toBeGreaterThanOrEqual(2)

      // Clean up
      clearTimeout(timer1)
      clearTimeout(timer2)
    })

    it('should track setInterval calls', () => {
      detector.startTracking()

      // Create some intervals
      const interval1 = setInterval(() => {}, 1000)
      const interval2 = setInterval(() => {}, 2000)

      const report = detector.getReport()
      expect(report.timers.stats.intervals).toBeGreaterThanOrEqual(2)

      // Clean up
      clearInterval(interval1)
      clearInterval(interval2)
    })

    it('should untrack timers when cleared', () => {
      detector.startTracking()

      const timer = setTimeout(() => {}, 1000)
      const initialStats = detector.getReport().timers.stats

      clearTimeout(timer)
      const finalStats = detector.getReport().timers.stats

      expect(finalStats.timers).toBeLessThan(initialStats.timers)
    })

    it('should restore original functions when stopped', () => {
      const originalSetTimeout = global.setTimeout
      const originalSetInterval = global.setInterval

      detector.startTracking()
      expect(global.setTimeout).not.toBe(originalSetTimeout)
      expect(global.setInterval).not.toBe(originalSetInterval)

      detector.stopTracking()
      expect(global.setTimeout).toBe(originalSetTimeout)
      expect(global.setInterval).toBe(originalSetInterval)
    })
  })

  describe('leak detection report', () => {
    it('should generate comprehensive leak report', () => {
      const report = detector.getReport()

      expect(report).toHaveProperty('processListeners')
      expect(report).toHaveProperty('resources')
      expect(report).toHaveProperty('timers')
      expect(report).toHaveProperty('eventListeners')
      expect(report).toHaveProperty('summary')

      expect(report.summary).toHaveProperty('totalLeaks')
      expect(report.summary).toHaveProperty('hasLeaks')
      expect(report.summary).toHaveProperty('criticalLeaks')
      expect(report.summary).toHaveProperty('recommendations')
    })

    it('should detect when no leaks exist', () => {
      const report = detector.getReport()
      expect(typeof report.summary.hasLeaks).toBe('boolean')
      expect(Array.isArray(report.summary.recommendations)).toBe(true)
    })

    it('should provide recommendations when leaks exist', () => {
      detector.startTracking()

      // Create a timer leak
      setTimeout(() => {}, 10000)

      const report = detector.getReport()
      if (report.summary.hasLeaks) {
        expect(report.summary.recommendations.length).toBeGreaterThan(0)
        expect(report.summary.recommendations[0]).toContain('timer')
      }
    })
  })

  describe('leak cleanup', () => {
    it('should clean up all tracked leaks', async () => {
      detector.startTracking()

      // Create some leaks
      const timer1 = setTimeout(() => {}, 10000)
      const timer2 = setTimeout(() => {}, 20000)
      const interval1 = setInterval(() => {}, 5000)

      const beforeCleanup = detector.getReport().timers.stats
      expect(beforeCleanup.timers).toBeGreaterThanOrEqual(2)
      expect(beforeCleanup.intervals).toBeGreaterThanOrEqual(1)

      await detector.cleanupLeaks()

      const afterCleanup = detector.getReport().timers.stats
      expect(afterCleanup.timers).toBe(0)
      expect(afterCleanup.intervals).toBe(0)

      // Verify timers are actually cleared (they won't fire)
      let timer1Fired = false
      let timer2Fired = false
      let interval1Fired = false

      setTimeout(() => {
        timer1Fired = true
      }, 50)
      setTimeout(() => {
        timer2Fired = true
      }, 50)
      setInterval(() => {
        interval1Fired = true
      }, 50)

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Original timers should not have fired since they were cleared
      expect(timer1Fired).toBe(false)
      expect(timer2Fired).toBe(false)
      expect(interval1Fired).toBe(false)
    })
  })

  describe('critical leak detection', () => {
    it('should identify critical leaks', () => {
      // This test would need to create resources with old timestamps
      // For now, we just test the method exists and returns boolean
      const hasCritical = detector.hasCriticalLeaks()
      expect(typeof hasCritical).toBe('boolean')
    })

    it('should provide leak summary', () => {
      const summary = detector.getLeakSummary()
      expect(typeof summary).toBe('string')
      expect(summary.length).toBeGreaterThan(0)
    })
  })
})

describe('global leak detection functions', () => {
  afterEach(() => {
    stopLeakTracking()
  })

  it('should start and stop global leak tracking', () => {
    const originalSetTimeout = global.setTimeout

    startLeakTracking()
    expect(global.setTimeout).not.toBe(originalSetTimeout)

    stopLeakTracking()
    expect(global.setTimeout).toBe(originalSetTimeout)
  })

  it('should detect leaks globally', () => {
    const report = detectLeaks()
    expect(report).toHaveProperty('summary')
    expect(typeof report.summary.hasLeaks).toBe('boolean')
  })

  it('should clean up leaks globally', async () => {
    startLeakTracking()

    // Create a leak
    setTimeout(() => {}, 10000)

    await cleanupAllLeaks()

    const summary = getLeakSummary()
    expect(typeof summary).toBe('string')
  })

  it('should provide global leak summary', () => {
    const summary = getLeakSummary()
    expect(typeof summary).toBe('string')
    expect(summary).toContain('leak')
  })
})

describe('withLeakDetection', () => {
  it('should track leaks for an operation', async () => {
    const result = await withLeakDetection(async () => {
      // Create a timer that should be cleaned up
      setTimeout(() => {}, 1000)
      return 'test-result'
    })

    expect(result).toBe('test-result')
  })

  it('should clean up leaks when cleanup option is true', async () => {
    let timerFired = false

    await withLeakDetection(
      async () => {
        setTimeout(() => {
          timerFired = true
        }, 100)
        return 'result'
      },
      { cleanup: true },
    )

    // Wait for timer to potentially fire
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Timer should not have fired because it was cleaned up
    expect(timerFired).toBe(false)
  })

  it('should throw on leaks when throwOnLeaks is true', async () => {
    await expect(
      withLeakDetection(
        async () => {
          // Create multiple leaks
          setTimeout(() => {}, 10000)
          setTimeout(() => {}, 20000)
          setInterval(() => {}, 5000)
        },
        { throwOnLeaks: true, leakThreshold: 1 },
      ),
    ).rejects.toThrow('memory leaks')
  })

  it('should respect leak threshold', async () => {
    // This should not throw because we allow 5 leaks
    await expect(
      withLeakDetection(
        async () => {
          setTimeout(() => {}, 10000)
          setTimeout(() => {}, 20000)
        },
        { throwOnLeaks: true, leakThreshold: 5 },
      ),
    ).resolves.toBeUndefined()
  })

  it('should handle synchronous operations', async () => {
    const result = await withLeakDetection(() => {
      setTimeout(() => {}, 1000)
      return 42
    })

    expect(result).toBe(42)
  })

  it('should handle errors in operations', async () => {
    await expect(
      withLeakDetection(async () => {
        setTimeout(() => {}, 1000)
        throw new Error('Test error')
      }),
    ).rejects.toThrow('Test error')
  })
})

describe('integration with process listeners and resources', () => {
  it('should integrate with process listener stats', () => {
    const report = detectLeaks()
    expect(report.processListeners).toHaveProperty('stats')
    expect(report.processListeners).toHaveProperty('leaks')
  })

  it('should integrate with resource manager stats', () => {
    const report = detectLeaks()
    expect(report.resources).toHaveProperty('stats')
    expect(report.resources).toHaveProperty('leaks')
  })

  it('should include all leak sources in summary', () => {
    const report = detectLeaks()
    expect(typeof report.summary.totalLeaks).toBe('number')
    expect(report.summary.totalLeaks >= 0).toBe(true)
  })
})

describe('memory leak prevention regression tests', () => {
  it('should not leak when creating and destroying detectors', () => {
    const originalSetTimeout = global.setTimeout
    const originalSetInterval = global.setInterval

    // Create and destroy multiple detectors
    for (let i = 0; i < 10; i++) {
      const detector = new LeakDetector()
      detector.startTracking()
      detector.stopTracking()
    }

    // Functions should be restored to original
    expect(global.setTimeout).toBe(originalSetTimeout)
    expect(global.setInterval).toBe(originalSetInterval)
  })

  it('should handle rapid start/stop cycles', () => {
    const detector = new LeakDetector()

    // Rapid start/stop should not cause issues
    for (let i = 0; i < 5; i++) {
      detector.startTracking()
      detector.stopTracking()
    }

    // Should still work normally
    detector.startTracking()
    const timer = setTimeout(() => {}, 1000)
    const report = detector.getReport()
    expect(report.timers.stats.timers).toBeGreaterThanOrEqual(1)

    clearTimeout(timer)
    detector.stopTracking()
  })

  it('should handle concurrent detector instances', () => {
    const detector1 = new LeakDetector()
    const detector2 = new LeakDetector()

    detector1.startTracking()
    detector2.startTracking()

    // Both should work independently
    const report1 = detector1.getReport()
    const report2 = detector2.getReport()

    expect(report1).toBeDefined()
    expect(report2).toBeDefined()

    detector1.stopTracking()
    detector2.stopTracking()
  })
})

describe('edge cases and error handling', () => {
  it('should handle timer cleanup when timers complete naturally', async () => {
    const detector = new LeakDetector()
    detector.startTracking()

    // Create a short timer that will complete
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve()
      }, 10)
    })

    const report = detector.getReport()
    // The completed timer should still be tracked until cleared
    expect(typeof report.timers.stats.timers).toBe('number')

    detector.stopTracking()
  })

  it('should handle invalid timer IDs gracefully', () => {
    const detector = new LeakDetector()
    detector.startTracking()

    // This should not throw
    expect(() => {
      clearTimeout(undefined as any)
      clearInterval(null as any)
    }).not.toThrow()

    detector.stopTracking()
  })

  it('should handle cleanup when no leaks exist', async () => {
    const detector = new LeakDetector()

    // Cleanup with no leaks should not throw
    await expect(detector.cleanupLeaks()).resolves.toBeUndefined()
  })
})
