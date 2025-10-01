/**
 * Memory leak detection utilities for @orchestr8/testkit
 *
 * Provides comprehensive leak detection for event listeners, timers, and resources
 * to help identify and prevent memory leaks in test environments.
 */

import { getProcessListenerStats, detectProcessListenerLeaks } from './process-listeners.js'
import { getResourceStats, detectResourceLeaks } from '../resources/index.js'

/**
 * Timer and interval tracking for leak detection
 */
class TimerTracker {
  private timers = new Set<NodeJS.Timeout>()
  private intervals = new Set<NodeJS.Timeout>()
  private originalSetTimeout = global.setTimeout
  private originalSetInterval = global.setInterval
  private originalClearTimeout = global.clearTimeout
  private originalClearInterval = global.clearInterval
  private isTracking = false

  /**
   * Start tracking timers and intervals
   */
  startTracking(): void {
    if (this.isTracking) return
    this.isTracking = true

    // Override setTimeout to track timers
    global.setTimeout = ((fn: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
      const timer = this.originalSetTimeout(fn, delay, ...args)
      this.timers.add(timer)
      return timer
    }) as typeof setTimeout

    // Override setInterval to track intervals
    global.setInterval = ((
      fn: (...args: unknown[]) => void,
      delay?: number,
      ...args: unknown[]
    ) => {
      const interval = this.originalSetInterval(fn, delay, ...args)
      this.intervals.add(interval)
      return interval
    }) as typeof setInterval

    // Override clearTimeout to untrack timers
    global.clearTimeout = ((timer: NodeJS.Timeout) => {
      this.timers.delete(timer)
      return this.originalClearTimeout(timer)
    }) as typeof clearTimeout

    // Override clearInterval to untrack intervals
    global.clearInterval = ((interval: NodeJS.Timeout) => {
      this.intervals.delete(interval)
      return this.originalClearInterval(interval)
    }) as typeof clearInterval
  }

  /**
   * Stop tracking and restore original functions
   */
  stopTracking(): void {
    if (!this.isTracking) return
    this.isTracking = false

    global.setTimeout = this.originalSetTimeout
    global.setInterval = this.originalSetInterval
    global.clearTimeout = this.originalClearTimeout
    global.clearInterval = this.originalClearInterval
  }

  /**
   * Get current timer and interval counts
   */
  getStats(): { timers: number; intervals: number } {
    return {
      timers: this.timers.size,
      intervals: this.intervals.size,
    }
  }

  /**
   * Clear all tracked timers and intervals
   */
  clearAll(): void {
    for (const timer of this.timers) {
      this.originalClearTimeout(timer)
    }
    for (const interval of this.intervals) {
      this.originalClearInterval(interval)
    }
    this.timers.clear()
    this.intervals.clear()
  }

  /**
   * Get active timers and intervals
   */
  getActiveTimers(): { timers: NodeJS.Timeout[]; intervals: NodeJS.Timeout[] } {
    return {
      timers: Array.from(this.timers),
      intervals: Array.from(this.intervals),
    }
  }
}

/**
 * Event listener tracking for leak detection (simplified for Node.js environment)
 */
class EventListenerTracker {
  /**
   * Start tracking event listeners (no-op in Node.js environment)
   */
  startTracking(): void {
    // Event listener tracking is primarily for browser environments
    // In Node.js, we focus on process listeners which are handled separately
  }

  /**
   * Stop tracking and restore original functions
   */
  stopTracking(): void {
    // No cleanup needed for simplified implementation
  }

  /**
   * Get current event listener counts (simplified for Node.js)
   */
  getStats(): { totalListeners: number; listenersByType: Record<string, number> } {
    // In Node.js environment, we primarily track process listeners separately
    return { totalListeners: 0, listenersByType: {} }
  }
}

/**
 * Comprehensive leak detection report
 */
export interface LeakDetectionReport {
  /** Process event listener leaks */
  processListeners: {
    stats: ReturnType<typeof getProcessListenerStats>
    leaks: ReturnType<typeof detectProcessListenerLeaks>
  }
  /** Resource manager leaks */
  resources: {
    stats: ReturnType<typeof getResourceStats>
    leaks: ReturnType<typeof detectResourceLeaks>
  }
  /** Timer and interval leaks */
  timers: {
    stats: { timers: number; intervals: number }
    activeTimers: { timers: NodeJS.Timeout[]; intervals: NodeJS.Timeout[] }
  }
  /** Event listener leaks */
  eventListeners: {
    stats: { totalListeners: number; listenersByType: Record<string, number> }
  }
  /** Overall leak assessment */
  summary: {
    totalLeaks: number
    hasLeaks: boolean
    criticalLeaks: number
    recommendations: string[]
  }
}

/**
 * Main leak detector class
 */
export class LeakDetector {
  private timerTracker = new TimerTracker()
  private eventListenerTracker = new EventListenerTracker()
  private isActive = false

  /**
   * Start comprehensive leak tracking
   */
  startTracking(): void {
    if (this.isActive) return
    this.isActive = true

    this.timerTracker.startTracking()
    this.eventListenerTracker.startTracking()
  }

  /**
   * Stop leak tracking and restore original functions
   */
  stopTracking(): void {
    if (!this.isActive) return
    this.isActive = false

    this.timerTracker.stopTracking()
    this.eventListenerTracker.stopTracking()
  }

  /**
   * Generate comprehensive leak detection report
   */
  getReport(): LeakDetectionReport {
    const processListenerStats = getProcessListenerStats()
    const processListenerLeaks = detectProcessListenerLeaks()
    const resourceStats = getResourceStats()
    const resourceLeaks = detectResourceLeaks()
    const timerStats = this.timerTracker.getStats()
    const activeTimers = this.timerTracker.getActiveTimers()
    const eventListenerStats = this.eventListenerTracker.getStats()

    const totalLeaks =
      processListenerLeaks.length + resourceLeaks.length + timerStats.timers + timerStats.intervals
    const criticalLeaks =
      resourceLeaks.filter((leak) => leak.potentialLeak).length +
      processListenerLeaks.filter((leak) => leak.age > 120000).length

    const recommendations: string[] = []

    if (processListenerLeaks.length > 0) {
      recommendations.push(`Remove ${processListenerLeaks.length} old process listeners`)
    }
    if (resourceLeaks.length > 0) {
      recommendations.push(`Clean up ${resourceLeaks.length} leaked resources`)
    }
    if (timerStats.timers > 0) {
      recommendations.push(`Clear ${timerStats.timers} active timers`)
    }
    if (timerStats.intervals > 0) {
      recommendations.push(`Clear ${timerStats.intervals} active intervals`)
    }

    return {
      processListeners: {
        stats: processListenerStats,
        leaks: processListenerLeaks,
      },
      resources: {
        stats: resourceStats,
        leaks: resourceLeaks,
      },
      timers: {
        stats: timerStats,
        activeTimers,
      },
      eventListeners: {
        stats: eventListenerStats,
      },
      summary: {
        totalLeaks,
        hasLeaks: totalLeaks > 0,
        criticalLeaks,
        recommendations,
      },
    }
  }

  /**
   * Clean up all detected leaks
   */
  async cleanupLeaks(): Promise<void> {
    // Clear timers and intervals
    this.timerTracker.clearAll()

    // Clean up resources (this will also clean up process listeners)
    const { cleanupAllResources } = await import('../resources/index.js')
    await cleanupAllResources()
  }

  /**
   * Check if there are any critical leaks that need immediate attention
   */
  hasCriticalLeaks(): boolean {
    const report = this.getReport()
    return report.summary.criticalLeaks > 0
  }

  /**
   * Get a simple leak summary for quick checks
   */
  getLeakSummary(): string {
    const report = this.getReport()
    if (!report.summary.hasLeaks) {
      return 'No leaks detected'
    }

    return `${report.summary.totalLeaks} leaks detected (${report.summary.criticalLeaks} critical): ${report.summary.recommendations.join(', ')}`
  }
}

/**
 * Global leak detector instance
 */
export const globalLeakDetector = new LeakDetector()

/**
 * Convenience function to get a leak detection report
 */
export function detectLeaks(): LeakDetectionReport {
  return globalLeakDetector.getReport()
}

/**
 * Convenience function to start leak tracking globally
 */
export function startLeakTracking(): void {
  globalLeakDetector.startTracking()
}

/**
 * Convenience function to stop leak tracking globally
 */
export function stopLeakTracking(): void {
  globalLeakDetector.stopTracking()
}

/**
 * Convenience function to clean up all leaks globally
 */
export function cleanupAllLeaks(): Promise<void> {
  return globalLeakDetector.cleanupLeaks()
}

/**
 * Convenience function to get leak summary
 */
export function getLeakSummary(): string {
  return globalLeakDetector.getLeakSummary()
}

/**
 * Helper to track leaks for a specific test or operation
 */
export async function withLeakDetection<T>(
  operation: () => T | Promise<T>,
  options: {
    /** Cleanup leaks after operation */
    cleanup?: boolean
    /** Throw error if leaks are detected */
    throwOnLeaks?: boolean
    /** Custom leak threshold */
    leakThreshold?: number
  } = {},
): Promise<T> {
  const detector = new LeakDetector()

  // Get baseline
  const baseline = detector.getReport()

  detector.startTracking()

  try {
    const result = await Promise.resolve(operation())

    // Check for new leaks
    const finalReport = detector.getReport()
    const newLeaks = finalReport.summary.totalLeaks - baseline.summary.totalLeaks

    if (options.throwOnLeaks && newLeaks > (options.leakThreshold ?? 0)) {
      throw new Error(
        `Operation created ${newLeaks} memory leaks: ${finalReport.summary.recommendations.join(', ')}`,
      )
    }

    if (options.cleanup) {
      await detector.cleanupLeaks()
    }

    return result
  } finally {
    detector.stopTracking()
  }
}
