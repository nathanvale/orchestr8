/**
 * Circuit breaker implementation with sliding window
 */

import type { CircuitBreakerConfig, CircuitBreakerState } from './types.js'

import { CircuitBreakerOpenError } from './errors.js'

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

  constructor(
    private readonly config: CircuitBreakerConfig,
    private readonly observer?: CircuitBreakerObserver,
  ) {}

  /**
   * Get or create circuit state for a given key
   */
  private getState(key: string): CircuitBreakerState {
    // Perform lazy cleanup if needed
    this.performLazyCleanup()

    let state = this.states.get(key)

    if (!state) {
      // Bounded state map - remove oldest if at limit
      if (this.states.size >= this.maxCircuits) {
        const firstKey = this.states.keys().next().value
        if (firstKey) {
          this.states.delete(firstKey)
        }
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
   * Perform lazy cleanup of expired circuits
   */
  private performLazyCleanup(): void {
    const now = Date.now()

    // Only cleanup periodically
    if (now - this.lastCleanup < this.cleanupInterval) {
      return
    }

    this.lastCleanup = now
    const expiredThreshold = now - this.config.recoveryTime * 10 // Keep circuits for 10x recovery timeout

    // Remove expired circuits
    const keysToDelete: string[] = []
    for (const [key, state] of this.states.entries()) {
      // Remove if:
      // 1. Circuit is closed and hasn't been accessed recently
      // 2. Circuit is open but past its expiry time
      const isExpired =
        state.lastAccessTime && state.lastAccessTime < expiredThreshold
      const isStaleOpen =
        state.status === 'open' &&
        state.nextHalfOpenTime &&
        state.nextHalfOpenTime < expiredThreshold

      if (isExpired || isStaleOpen) {
        keysToDelete.push(key)
      }
    }

    // Delete expired circuits
    for (const key of keysToDelete) {
      this.states.delete(key)
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

    // Check for state transitions
    if (state.status === 'open' && this.canTransitionToHalfOpen(state)) {
      state.status = 'half-open'
      this.observer?.onStateChange?.(key, 'half-open')
      state.probeInProgress = false
    }

    // Handle circuit states
    switch (state.status) {
      case 'open': {
        // Circuit is open - reject immediately
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

          // Success - transition to closed
          state.status = 'closed'
          this.observer?.onStateChange?.(key, 'closed')
          state.probeInProgress = false
          state.lastFailureTime = undefined
          state.nextHalfOpenTime = undefined

          // Record success
          this.recordOutcome(state, true)

          return result
        } catch (error) {
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

          // Record failure
          this.recordOutcome(state, false)

          throw error
        }
      }

      case 'closed':
      default: {
        // Circuit is closed - execute normally
        try {
          const result = await operation()

          // Record success
          this.recordOutcome(state, true)

          return result
        } catch (error) {
          // Record failure
          this.recordOutcome(state, false)
          state.lastFailureTime = Date.now()

          // Check if circuit should open
          if (this.shouldOpen(state)) {
            state.status = 'open'
            this.observer?.onStateChange?.(key, 'open')
            state.nextHalfOpenTime = Date.now() + this.config.recoveryTime
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
   * Derive a circuit key from context
   */
  static deriveKey(workflowId: string, stepId: string): string {
    return `${workflowId}:${stepId}`
  }
}
