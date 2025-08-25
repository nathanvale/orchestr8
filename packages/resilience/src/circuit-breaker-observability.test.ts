import type { Logger } from '@orchestr8/logger'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CircuitBreakerConfig } from './types.js'

import { CircuitBreaker } from './circuit-breaker.js'
import {
  createResilienceTelemetry,
  DefaultResilienceTelemetry,
} from './observability.js'

describe('Circuit Breaker Observability', () => {
  let circuitBreaker: CircuitBreaker
  let mockLogger: Logger
  let telemetry: DefaultResilienceTelemetry

  const config: CircuitBreakerConfig = {
    failureThreshold: 3,
    recoveryTime: 1000,
    sampleSize: 10,
    halfOpenPolicy: 'single-probe',
  }

  beforeEach(() => {
    vi.useFakeTimers()

    // Create mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as unknown as Logger

    telemetry = new DefaultResilienceTelemetry(mockLogger)

    // Create circuit breaker with observer
    const observer = telemetry.createCircuitBreakerObserver()
    circuitBreaker = new CircuitBreaker(config, observer)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('State Transition Logging', () => {
    it('logs circuit breaker state transitions from closed to open', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'))

      // Trigger circuit opening by filling window with failures
      for (let i = 0; i < 10; i++) {
        await expect(
          circuitBreaker.execute('test-key', operation),
        ).rejects.toThrow()
      }

      // Verify state change was logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circuit breaker test-key transitioned to open',
        expect.objectContaining({
          event: 'circuit_state_change',
          circuitKey: 'test-key',
          newState: 'open',
          timestamp: expect.any(String),
        }),
      )
    })

    it('logs circuit breaker state transitions from open to half-open', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'))

      // Open the circuit
      for (let i = 0; i < 10; i++) {
        await expect(
          circuitBreaker.execute('test-key', operation),
        ).rejects.toThrow()
      }

      // Clear previous calls
      vi.clearAllMocks()

      // Wait for recovery time to trigger half-open transition
      vi.advanceTimersByTime(1001)

      // Attempt operation to trigger half-open
      const probeOp = vi.fn().mockResolvedValue('success')
      await circuitBreaker.execute('test-key', probeOp)

      // Verify half-open transition was logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circuit breaker test-key transitioned to half-open',
        expect.objectContaining({
          event: 'circuit_state_change',
          circuitKey: 'test-key',
          newState: 'half-open',
          timestamp: expect.any(String),
        }),
      )
    })

    it('logs circuit breaker state transitions from half-open to closed', async () => {
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))
      const successOp = vi.fn().mockResolvedValue('success')

      // Open the circuit
      for (let i = 0; i < 10; i++) {
        await expect(
          circuitBreaker.execute('test-key', failOp),
        ).rejects.toThrow()
      }

      // Wait for recovery and transition to half-open
      vi.advanceTimersByTime(1001)

      // Clear previous calls to focus on closed transition
      vi.clearAllMocks()

      // Successful probe should close circuit
      await circuitBreaker.execute('test-key', successOp)

      // Verify closed transition was logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circuit breaker test-key transitioned to closed',
        expect.objectContaining({
          event: 'circuit_state_change',
          circuitKey: 'test-key',
          newState: 'closed',
          timestamp: expect.any(String),
        }),
      )
    })
  })

  describe('Performance Metrics', () => {
    it('provides timer functionality for measuring operation duration', () => {
      const stopTimer = telemetry.startTimer('test-operation')

      // Verify start was logged
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Starting test-operation',
        expect.objectContaining({
          operation: 'test-operation',
          phase: 'start',
        }),
      )

      // Advance time and stop timer
      vi.advanceTimersByTime(150)
      const duration = stopTimer()

      // Verify completion was logged with duration
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Completed test-operation in 150ms',
        expect.objectContaining({
          operation: 'test-operation',
          phase: 'complete',
          duration: 150,
        }),
      )

      expect(duration).toBe(150)
    })

    it('tracks multiple concurrent timers independently', () => {
      const timer1 = telemetry.startTimer('operation-1')
      vi.advanceTimersByTime(100)

      const timer2 = telemetry.startTimer('operation-2')
      vi.advanceTimersByTime(50)

      const duration1 = timer1() // Should be 150ms
      vi.advanceTimersByTime(25)

      const duration2 = timer2() // Should be 75ms

      expect(duration1).toBe(150)
      expect(duration2).toBe(75)
    })
  })

  describe('Telemetry Integration', () => {
    it('creates circuit breaker observer that integrates with telemetry', () => {
      const observer = telemetry.createCircuitBreakerObserver()

      expect(observer).toBeDefined()
      expect(typeof observer.onStateChange).toBe('function')
    })

    it('provides access to underlying logger', () => {
      const logger = telemetry.getLogger()
      expect(logger).toBe(mockLogger)
    })

    it('can be created with factory function', () => {
      const customTelemetry = createResilienceTelemetry(mockLogger)
      expect(customTelemetry).toBeInstanceOf(DefaultResilienceTelemetry)
    })

    it('can be created without explicit logger', () => {
      const defaultTelemetry = createResilienceTelemetry()
      expect(defaultTelemetry).toBeInstanceOf(DefaultResilienceTelemetry)
      expect(defaultTelemetry.getLogger()).toBeDefined()
    })
  })

  describe('Event Logging', () => {
    it('logs resilience events with appropriate context', () => {
      const context = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        correlationId: 'corr-789',
      }

      telemetry.logEvent('circuit_state_change', context, {
        circuitKey: 'test-circuit',
        newState: 'open',
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circuit breaker state changed',
        expect.objectContaining({
          event: 'circuit_state_change',
          workflowId: 'workflow-123',
          stepId: 'step-456',
          correlationId: 'corr-789',
          circuitKey: 'test-circuit',
          newState: 'open',
        }),
      )
    })

    it('uses appropriate log levels for different event types', () => {
      const context = { workflowId: 'test' }

      // Debug level events
      telemetry.logEvent('retry_attempt', context)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Attempting retry',
        expect.objectContaining({ event: 'retry_attempt' }),
      )

      // Info level events
      telemetry.logEvent('circuit_state_change', context)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circuit breaker state changed',
        expect.objectContaining({ event: 'circuit_state_change' }),
      )

      // Warn level events
      telemetry.logEvent('retry_exhausted', context)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'All retry attempts exhausted',
        expect.objectContaining({ event: 'retry_exhausted' }),
      )

      // Error level events
      telemetry.logEvent('composition_error', context)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Resilience composition failed',
        expect.objectContaining({ event: 'composition_error' }),
      )
    })
  })

  describe('Performance Overhead', () => {
    it('has minimal overhead when logging is disabled', () => {
      // Create telemetry with no-op logger
      const noOpLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnThis(),
      } as unknown as Logger

      const minimalTelemetry = new DefaultResilienceTelemetry(noOpLogger)
      const observer = minimalTelemetry.createCircuitBreakerObserver()

      // Measure overhead of state change notification
      const start = Date.now()

      for (let i = 0; i < 1000; i++) {
        observer.onStateChange?.('test-key', 'open')
      }

      const duration = Date.now() - start

      // Should complete 1000 calls in reasonable time (< 10ms)
      expect(duration).toBeLessThan(10)
    })

    it('timer overhead is minimal for short operations', () => {
      const start = Date.now()

      for (let i = 0; i < 1000; i++) {
        const stopTimer = telemetry.startTimer('micro-operation')
        stopTimer()
      }

      const duration = Date.now() - start

      // Should complete 1000 timer cycles in reasonable time (< 50ms)
      expect(duration).toBeLessThan(50)
    })
  })
})
