/**
 * Observability integration for resilience patterns
 */

import type { Logger } from '@orchestr8/logger'

import { createLoggerSync } from '@orchestr8/logger'

import type { CircuitBreakerObserver } from './circuit-breaker.js'
import type { ResilienceContext } from './types.js'

/**
 * Resilience event types for structured logging
 */
export type ResilienceEventType =
  | 'retry_attempt'
  | 'retry_success'
  | 'retry_exhausted'
  | 'retry_backoff'
  | 'timeout_triggered'
  | 'timeout_cleared'
  | 'circuit_state_change'
  | 'circuit_probe_attempt'
  | 'circuit_recovery'
  | 'composition_start'
  | 'composition_complete'
  | 'composition_error'

/**
 * Resilience telemetry interface for observability
 */
export interface ResilienceTelemetry {
  /** Log a resilience event */
  logEvent(
    type: ResilienceEventType,
    context: ResilienceContext,
    metadata?: Record<string, unknown>,
  ): void

  /** Create a circuit breaker observer */
  createCircuitBreakerObserver(): CircuitBreakerObserver

  /** Start a timed operation */
  startTimer(operation: string): () => number

  /** Get the underlying logger */
  getLogger(): Logger
}

/**
 * Default implementation using @orchestr8/logger
 */
export class DefaultResilienceTelemetry implements ResilienceTelemetry {
  private readonly logger: Logger

  constructor(logger?: Logger) {
    this.logger = logger || createLoggerSync({ name: 'resilience' })
  }

  logEvent(
    type: ResilienceEventType,
    context: ResilienceContext,
    metadata?: Record<string, unknown>,
  ): void {
    const level = this.getLogLevel(type)
    const message = this.getEventMessage(type)

    this.logger[level](message, {
      event: type,
      workflowId: context.workflowId,
      stepId: context.stepId,
      correlationId: context.correlationId,
      ...metadata,
    })
  }

  createCircuitBreakerObserver(): CircuitBreakerObserver {
    return {
      onStateChange: (key: string, state: 'closed' | 'open' | 'half-open') => {
        this.logger.info(`Circuit breaker ${key} transitioned to ${state}`, {
          event: 'circuit_state_change',
          circuitKey: key,
          newState: state,
          timestamp: new Date().toISOString(),
        })
      },
    }
  }

  startTimer(operation: string): () => number {
    const startTime = Date.now()
    this.logger.debug(`Starting ${operation}`, { operation, phase: 'start' })

    return () => {
      const duration = Date.now() - startTime
      this.logger.debug(`Completed ${operation} in ${duration}ms`, {
        operation,
        phase: 'complete',
        duration,
      })
      return duration
    }
  }

  getLogger(): Logger {
    return this.logger
  }

  private getLogLevel(
    type: ResilienceEventType,
  ): 'debug' | 'info' | 'warn' | 'error' {
    switch (type) {
      case 'retry_attempt':
      case 'retry_backoff':
      case 'timeout_cleared':
      case 'composition_start':
        return 'debug'

      case 'retry_success':
      case 'circuit_state_change':
      case 'circuit_recovery':
      case 'composition_complete':
        return 'info'

      case 'retry_exhausted':
      case 'timeout_triggered':
      case 'circuit_probe_attempt':
        return 'warn'

      case 'composition_error':
        return 'error'

      default:
        return 'info'
    }
  }

  private getEventMessage(type: ResilienceEventType): string {
    switch (type) {
      case 'retry_attempt':
        return 'Attempting retry'
      case 'retry_success':
        return 'Retry succeeded'
      case 'retry_exhausted':
        return 'All retry attempts exhausted'
      case 'retry_backoff':
        return 'Applying backoff delay'
      case 'timeout_triggered':
        return 'Operation timed out'
      case 'timeout_cleared':
        return 'Timeout cleared - operation completed'
      case 'circuit_state_change':
        return 'Circuit breaker state changed'
      case 'circuit_probe_attempt':
        return 'Circuit breaker probe attempt'
      case 'circuit_recovery':
        return 'Circuit breaker recovered'
      case 'composition_start':
        return 'Starting resilience composition'
      case 'composition_complete':
        return 'Resilience composition completed'
      case 'composition_error':
        return 'Resilience composition failed'
      default:
        return 'Resilience event'
    }
  }
}

/**
 * Singleton instance for convenience
 */
export const defaultTelemetry = new DefaultResilienceTelemetry()

/**
 * Factory function to create telemetry with custom logger
 */
export function createResilienceTelemetry(
  logger?: Logger,
): ResilienceTelemetry {
  return new DefaultResilienceTelemetry(logger)
}
