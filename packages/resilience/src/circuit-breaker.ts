/**
 * Circuit breaker implementation with sliding window
 */

import type { ResilienceTelemetry } from './observability.js'
import type { CircuitBreakerConfig, CircuitBreakerState } from './types.js'

import { validateCircuitBreakerConfig } from './config-validation.js'
import {
  CircuitBreakerOpenError,
  CircuitBreakerThresholdError,
} from './errors.js'

/**
 * Observer interface for circuit breaker state changes (optional)
 */
export interface CircuitBreakerObserver {
  onStateChange?: (key: string, state: 'closed' | 'open' | 'half-open') => void
}

/**
 * Circuit breaker with sliding window for outcome tracking
 */
export class CircuitBreaker {
  private states: Map<string, CircuitBreakerState> = new Map()
  private readonly maxCircuits = 1000 // Bounded state map
  private lastCleanup = Date.now()
  private readonly cleanupInterval = 60000 // Cleanup every minute
  private cleanupInProgress = false // Flag to prevent concurrent cleanup
  private readonly config: CircuitBreakerConfig
  private readonly telemetry?: ResilienceTelemetry
  private readonly performanceMetrics = new Map<
    string,
    { totalOperations: number; totalDuration: number; failures: number }
  >()

  constructor(
    config: CircuitBreakerConfig,
    private readonly observer?: CircuitBreakerObserver,
    telemetry?: ResilienceTelemetry,
  ) {
    // Validate configuration and store validated version
    this.config = validateCircuitBreakerConfig(config)
    this.telemetry = telemetry
  }

  /**
   * Get or create circuit state for a given key
   */
  private getState(key: string): CircuitBreakerState {
    // Perform lazy cleanup if needed (async, non-blocking)
    this.scheduleAsyncCleanup()

    let state = this.states.get(key)

    if (!state) {
      // Bounded state map - remove least recently used if at limit
      if (this.states.size >= this.maxCircuits) {
        this.evictLeastRecentlyUsed()
      }

      state = {
        status: 'closed',
        slidingWindow: new Array(this.config.sampleSize).fill(null),
        windowIndex: 0,
        windowSize: 0,
        probeInProgress: false,
        lastAccessTime: Date.now(),
      }
      this.states.set(key, state)
    } else {
      // Update access time for LRU tracking
      state.lastAccessTime = Date.now()
    }

    return state
  }

  /**
   * Evict the least recently used circuit state
   */
  private evictLeastRecentlyUsed(): void {
    if (this.states.size === 0) {
      return
    }

    let oldestKey: string | undefined
    let oldestTime = Infinity

    // Find the state with the oldest lastAccessTime
    for (const [key, state] of this.states.entries()) {
      if (state.lastAccessTime < oldestTime) {
        oldestTime = state.lastAccessTime
        oldestKey = key
      }
    }

    // Delete the least recently used state
    if (oldestKey) {
      this.states.delete(oldestKey)
    }
  }

  /**
   * Schedule async cleanup if needed (non-blocking)
   */
  private scheduleAsyncCleanup(): void {
    const now = Date.now()

    // Only cleanup periodically and if not already in progress
    if (
      now - this.lastCleanup < this.cleanupInterval ||
      this.cleanupInProgress
    ) {
      return
    }

    this.lastCleanup = now
    this.cleanupInProgress = true

    // Schedule async cleanup to prevent blocking
    globalThis.setImmediate(() => {
      this.performAsyncCleanup().finally(() => {
        this.cleanupInProgress = false
      })
    })
  }

  /**
   * Perform async cleanup of expired circuits in chunks
   */
  private async performAsyncCleanup(): Promise<void> {
    const now = Date.now()
    const expiredThreshold = now - this.config.recoveryTime * 10 // Keep circuits for 10x recovery timeout

    // Collect expired keys
    const keysToDelete: string[] = []
    for (const [key, state] of this.states.entries()) {
      // Remove if:
      // 1. Circuit is closed and hasn't been accessed recently
      // 2. Circuit is open but past its expiry time
      const isExpired = state.lastAccessTime < expiredThreshold
      const isStaleOpen =
        state.status === 'open' &&
        state.nextHalfOpenTime &&
        state.nextHalfOpenTime < expiredThreshold

      if (isExpired || isStaleOpen) {
        keysToDelete.push(key)
      }
    }

    // Delete expired circuits in chunks to avoid blocking
    await this.deleteKeysInChunks(keysToDelete)
  }

  /**
   * Delete keys in chunks to prevent event loop blocking
   */
  private async deleteKeysInChunks(keys: string[]): Promise<void> {
    const CHUNK_SIZE = 10 // Process 10 deletions per chunk

    for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
      // Process a chunk
      const chunk = keys.slice(i, i + CHUNK_SIZE)
      for (const key of chunk) {
        this.states.delete(key)
      }

      // Yield control back to event loop if there are more chunks
      if (i + CHUNK_SIZE < keys.length) {
        await new Promise((resolve) => globalThis.setImmediate(resolve))
      }
    }
  }

  /**
   * Record an outcome in the sliding window
   */
  private recordOutcome(state: CircuitBreakerState, success: boolean): void {
    // Add outcome to circular buffer
    state.slidingWindow[state.windowIndex] = success
    state.windowIndex = (state.windowIndex + 1) % this.config.sampleSize

    // Track window size until it's full
    if (state.windowSize < this.config.sampleSize) {
      state.windowSize++
    }
  }

  /**
   * Count failures in the sliding window
   */
  private countFailures(state: CircuitBreakerState): number {
    let failures = 0
    // Count failures in the valid portion of the window
    // When window is not full, only count up to windowSize
    // When window is full, count all entries
    const limit = Math.min(state.windowSize, this.config.sampleSize)

    if (state.windowSize < this.config.sampleSize) {
      // Window not full - count from start
      for (let i = 0; i < limit; i++) {
        if (state.slidingWindow[i] === false) {
          failures++
        }
      }
    } else {
      // Window is full - count all valid entries
      for (let i = 0; i < this.config.sampleSize; i++) {
        if (state.slidingWindow[i] === false) {
          failures++
        }
      }
    }
    return failures
  }

  /**
   * Check if circuit should transition to open
   */
  private shouldOpen(state: CircuitBreakerState): boolean {
    // Only open when window is full AND threshold exceeded
    if (state.windowSize < this.config.sampleSize) {
      return false
    }

    const failures = this.countFailures(state)

    // Interpret threshold based on value:
    // - Values > 1: Absolute count of failures
    // - Values <= 1: Failure rate (percentage)
    if (this.config.failureThreshold <= 1) {
      // Rate-based threshold
      const failureRate = failures / this.config.sampleSize
      return failureRate >= this.config.failureThreshold
    } else {
      // Count-based threshold
      return failures >= this.config.failureThreshold
    }
  }

  /**
   * Check if circuit can transition to half-open
   */
  private canTransitionToHalfOpen(state: CircuitBreakerState): boolean {
    if (state.status !== 'open' || !state.nextHalfOpenTime) {
      return false
    }
    return Date.now() >= state.nextHalfOpenTime
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const state = this.getState(key)
    const stopTimer = this.telemetry?.startTimer(`circuit-breaker-${key}`)

    // Check for state transitions
    if (state.status === 'open' && this.canTransitionToHalfOpen(state)) {
      state.status = 'half-open'
      this.observer?.onStateChange?.(key, 'half-open')
      state.probeInProgress = false

      // Log state transition with telemetry
      this.telemetry?.logEvent(
        'circuit_state_change',
        {},
        {
          circuitKey: key,
          previousState: 'open',
          newState: 'half-open',
          transition: 'recovery_attempt',
        },
      )
    }

    // Handle circuit states
    switch (state.status) {
      case 'open': {
        // Circuit is open - reject immediately
        stopTimer?.()
        this.updateMetrics(key, 0, false)

        this.telemetry?.logEvent(
          'circuit_probe_attempt',
          {},
          {
            circuitKey: key,
            circuitStatus: 'open',
            outcome: 'rejected',
            failures: this.countFailures(state),
          },
        )

        const retryAfter =
          state.nextHalfOpenTime || Date.now() + this.config.recoveryTime
        throw new CircuitBreakerOpenError(
          `Circuit breaker '${key}' is open`,
          key,
          new Date(retryAfter),
          this.countFailures(state),
        )
      }

      case 'half-open': {
        // Half-open behavior depends on policy:
        // - 'single-probe': allow only one in-flight probe; others rejected
        // - 'gradual': allow concurrent probes; first success closes circuit
        const singleProbe = this.config.halfOpenPolicy === 'single-probe'
        if (singleProbe && state.probeInProgress) {
          const retryAfter = Date.now() + 1000 // Retry in 1 second
          throw new CircuitBreakerOpenError(
            `Circuit breaker '${key}' is testing recovery`,
            key,
            new Date(retryAfter),
            this.countFailures(state),
          )
        }

        if (singleProbe) {
          // Acquire probe lock for single-probe mode
          state.probeInProgress = true
        }

        try {
          const result = await operation()
          const duration = stopTimer?.() ?? 0

          // Success - transition to closed
          state.status = 'closed'
          this.observer?.onStateChange?.(key, 'closed')
          state.probeInProgress = false
          state.lastFailureTime = undefined
          state.nextHalfOpenTime = undefined

          // Record success and update metrics
          this.recordOutcome(state, true)
          this.updateMetrics(key, duration, false)

          // Log successful recovery
          this.telemetry?.logEvent(
            'circuit_recovery',
            {},
            {
              circuitKey: key,
              previousState: 'half-open',
              newState: 'closed',
              probeSuccess: true,
              operationDuration: duration,
            },
          )

          return result
        } catch (error) {
          const duration = stopTimer?.() ?? 0

          // Failure - return to open for single-probe. In gradual mode, remain half-open
          if (singleProbe) {
            state.status = 'open'
            this.observer?.onStateChange?.(key, 'open')
            state.nextHalfOpenTime = Date.now() + this.config.recoveryTime
          } else {
            // In gradual mode, keep half-open, and set next half-open window to avoid hammering
            state.status = 'half-open'
            this.observer?.onStateChange?.(key, 'half-open')
            state.nextHalfOpenTime =
              Date.now() + Math.floor(this.config.recoveryTime / 2)
          }
          state.probeInProgress = false
          state.lastFailureTime = Date.now()

          // Record failure and update metrics
          this.recordOutcome(state, false)
          this.updateMetrics(key, duration, true)

          // Log probe failure
          this.telemetry?.logEvent(
            'circuit_probe_attempt',
            {},
            {
              circuitKey: key,
              circuitStatus: 'half-open',
              outcome: 'failed',
              newState: singleProbe ? 'open' : 'half-open',
              operationDuration: duration,
              error: error instanceof Error ? error.message : String(error),
            },
          )

          throw error
        }
      }

      case 'closed':
      default: {
        // Circuit is closed - execute normally
        try {
          const result = await operation()
          const duration = stopTimer?.() ?? 0

          // Record success and update metrics
          this.recordOutcome(state, true)
          this.updateMetrics(key, duration, false)

          return result
        } catch (error) {
          const duration = stopTimer?.() ?? 0

          // Record failure and update metrics
          this.recordOutcome(state, false)
          this.updateMetrics(key, duration, true)
          state.lastFailureTime = Date.now()

          // Check if circuit should open
          if (this.shouldOpen(state)) {
            const previousState = state.status
            state.status = 'open'
            this.observer?.onStateChange?.(key, 'open')
            state.nextHalfOpenTime = Date.now() + this.config.recoveryTime

            // Log circuit opening
            this.telemetry?.logEvent(
              'circuit_state_change',
              {},
              {
                circuitKey: key,
                previousState,
                newState: 'open',
                transition: 'threshold_exceeded',
                failures: this.countFailures(state),
                threshold: this.config.failureThreshold,
                sampleSize: this.config.sampleSize,
                operationDuration: duration,
                error: error instanceof Error ? error.message : String(error),
              },
            )
          }

          throw error
        }
      }
    }
  }

  /**
   * Get current state for a circuit (for testing/monitoring)
   */
  getCircuitState(key: string): CircuitBreakerState | undefined {
    return this.states.get(key)
  }

  /**
   * Reset a specific circuit (for testing)
   */
  reset(key: string): void {
    this.states.delete(key)
  }

  /**
   * Reset all circuits (for testing)
   */
  resetAll(): void {
    this.states.clear()
  }

  /**
   * Get debug info for a circuit (for testing)
   */
  getDebugInfo(key: string): CircuitBreakerState | undefined {
    return this.states.get(key)
  }

  /**
   * Get current state map size (for testing)
   */
  getStateMapSize(): number {
    return this.states.size
  }

  /**
   * Update performance metrics for a circuit
   */
  private updateMetrics(
    key: string,
    duration: number,
    isFailure: boolean,
  ): void {
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, {
        totalOperations: 0,
        totalDuration: 0,
        failures: 0,
      })
    }

    const metrics = this.performanceMetrics.get(key)!
    metrics.totalOperations++
    metrics.totalDuration += duration

    if (isFailure) {
      metrics.failures++
    }
  }

  /**
   * Get performance metrics for a circuit
   */
  getPerformanceMetrics(key: string):
    | {
        totalOperations: number
        totalDuration: number
        averageDuration: number
        failures: number
        successRate: number
      }
    | undefined {
    const metrics = this.performanceMetrics.get(key)
    if (!metrics) {
      return undefined
    }

    return {
      totalOperations: metrics.totalOperations,
      totalDuration: metrics.totalDuration,
      averageDuration:
        metrics.totalOperations > 0
          ? metrics.totalDuration / metrics.totalOperations
          : 0,
      failures: metrics.failures,
      successRate:
        metrics.totalOperations > 0
          ? (metrics.totalOperations - metrics.failures) /
            metrics.totalOperations
          : 0,
    }
  }

  /**
   * Get all performance metrics
   */
  getAllPerformanceMetrics(): Map<
    string,
    {
      totalOperations: number
      totalDuration: number
      averageDuration: number
      failures: number
      successRate: number
    }
  > {
    const result = new Map()

    for (const [key] of this.performanceMetrics) {
      const metrics = this.getPerformanceMetrics(key)
      if (metrics) {
        result.set(key, metrics)
      }
    }

    return result
  }

  /**
   * Create enhanced threshold error for the given circuit state
   */
  createThresholdError(
    key: string,
    state: CircuitBreakerState,
  ): CircuitBreakerThresholdError {
    const failures = this.countFailures(state)
    const failureRate = failures / this.config.sampleSize
    const retryAfter = new Date(Date.now() + this.config.recoveryTime)

    return new CircuitBreakerThresholdError(
      `Circuit breaker '${key}' opened due to threshold exceeded`,
      key,
      retryAfter,
      failures,
      failureRate,
      this.config.failureThreshold,
      this.config.sampleSize,
    )
  }

  /**
   * Derive a circuit key from context
   */
  static deriveKey(workflowId: string, stepId: string): string {
    return `${workflowId}:${stepId}`
  }
}
