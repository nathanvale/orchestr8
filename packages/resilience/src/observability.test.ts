/**
 * Tests for observability integration
 */

import type { Logger } from '@orchestr8/logger'

import { describe, expect, it, vi } from 'vitest'

import type { ResilienceContext } from './types.js'

import { DefaultResilienceTelemetry } from './observability.js'

describe('DefaultResilienceTelemetry', () => {
  it('should log events at appropriate levels', () => {
    const mockLogger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger

    const telemetry = new DefaultResilienceTelemetry(mockLogger)
    const context: ResilienceContext = {
      workflowId: 'wf-123',
      stepId: 'step-456',
      correlationId: 'corr-789',
    }

    // Debug level events
    telemetry.logEvent('retry_attempt', context, { attempt: 2 })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Attempting retry',
      expect.objectContaining({
        event: 'retry_attempt',
        workflowId: 'wf-123',
        stepId: 'step-456',
        correlationId: 'corr-789',
        attempt: 2,
      }),
    )

    // Info level events
    telemetry.logEvent('retry_success', context, { attempts: 3 })
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Retry succeeded',
      expect.objectContaining({
        event: 'retry_success',
        attempts: 3,
      }),
    )

    // Warn level events
    telemetry.logEvent('retry_exhausted', context, { attempts: 5 })
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'All retry attempts exhausted',
      expect.objectContaining({
        event: 'retry_exhausted',
        attempts: 5,
      }),
    )

    // Error level events
    telemetry.logEvent('composition_error', context, {
      error: 'Something went wrong',
    })
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Resilience composition failed',
      expect.objectContaining({
        event: 'composition_error',
        error: 'Something went wrong',
      }),
    )
  })

  it('should create circuit breaker observer', () => {
    const mockLogger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger

    const telemetry = new DefaultResilienceTelemetry(mockLogger)
    const observer = telemetry.createCircuitBreakerObserver()

    // Test state change callback
    observer.onStateChange?.('circuit-1', 'open')
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Circuit breaker circuit-1 transitioned to open',
      expect.objectContaining({
        event: 'circuit_state_change',
        circuitKey: 'circuit-1',
        newState: 'open',
      }),
    )
  })

  it('should track operation timing', () => {
    const mockLogger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger

    const telemetry = new DefaultResilienceTelemetry(mockLogger)

    // Start timer
    const timer = telemetry.startTimer('test-operation')
    expect(mockLogger.debug).toHaveBeenCalledWith('Starting test-operation', {
      operation: 'test-operation',
      phase: 'start',
    })

    // Complete timer
    const duration = timer()
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Completed test-operation'),
      expect.objectContaining({
        operation: 'test-operation',
        phase: 'complete',
        duration: expect.any(Number),
      }),
    )
    expect(duration).toBeGreaterThanOrEqual(0)
  })

  it('should handle missing context gracefully', () => {
    const mockLogger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger

    const telemetry = new DefaultResilienceTelemetry(mockLogger)

    // Log with empty context
    telemetry.logEvent('retry_attempt', {}, { attempt: 1 })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Attempting retry',
      expect.objectContaining({
        event: 'retry_attempt',
        attempt: 1,
      }),
    )
  })

  it('should handle partial context', () => {
    const mockLogger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger

    const telemetry = new DefaultResilienceTelemetry(mockLogger)
    const partialContext: ResilienceContext = {
      workflowId: 'wf-only',
    }

    telemetry.logEvent('circuit_state_change', partialContext)
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Circuit breaker state changed',
      expect.objectContaining({
        event: 'circuit_state_change',
        workflowId: 'wf-only',
        stepId: undefined,
        correlationId: undefined,
      }),
    )
  })
})
