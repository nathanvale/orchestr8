/**
 * Circuit breaker implementation with sliding window
 */

import type { CircuitBreakerConfig, CircuitBreakerState } from './types.js'

import { CircuitBreakerOpenError } from './errors.js'

/**
 * Circuit breaker with sliding window for outcome tracking
 */
export class CircuitBreaker {
  private states: Map<string, CircuitBreakerState> = new Map()
  private readonly maxCircuits = 1000 // Bounded state map

  constructor(private readonly config: CircuitBreakerConfig) {}

  /**
   * Get or create circuit state for a given key
   */
  private getState(key: string): CircuitBreakerState {
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
      }
      this.states.set(key, state)
    }

    return state
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
    return failures >= this.config.failureThreshold
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
        // Single probe policy - only one request tests recovery
        if (state.probeInProgress) {
          // Reject concurrent requests during probe
          const retryAfter = Date.now() + 1000 // Retry in 1 second
          throw new CircuitBreakerOpenError(
            `Circuit breaker '${key}' is testing recovery`,
            key,
            new Date(retryAfter),
            this.countFailures(state),
          )
        }

        // Acquire probe lock
        state.probeInProgress = true

        try {
          const result = await operation()

          // Success - transition to closed
          state.status = 'closed'
          state.probeInProgress = false
          state.lastFailureTime = undefined
          state.nextHalfOpenTime = undefined

          // Record success
          this.recordOutcome(state, true)

          return result
        } catch (error) {
          // Failure - return to open
          state.status = 'open'
          state.probeInProgress = false
          state.lastFailureTime = Date.now()
          state.nextHalfOpenTime = Date.now() + this.config.recoveryTime

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
   * Derive a circuit key from context
   */
  static deriveKey(workflowId: string, stepId: string): string {
    return `${workflowId}:${stepId}`
  }
}
