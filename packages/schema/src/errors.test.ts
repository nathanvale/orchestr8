/**
 * Tests for error utilities
 */

import { describe, it, expect } from 'vitest'

import {
  ExecutionErrorCode,
  createExecutionError,
  isExecutionError,
} from './errors.js'

describe('Execution Errors', () => {
  describe('createExecutionError', () => {
    it('should create basic execution error', () => {
      const error = createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'Test validation error',
      )

      expect(error.message).toBe('Test validation error')
      expect(error.code).toBe(ExecutionErrorCode.VALIDATION)
      expect(typeof error.timestamp).toBe('string')
    })

    it('should create error with context', () => {
      const context = {
        workflowId: 'test-workflow',
        stepId: 'test-step',
        executionId: 'test-execution',
      }

      const error = createExecutionError(
        ExecutionErrorCode.RETRYABLE,
        'Step failed',
        { context, stepId: 'test-step' },
      )

      expect(error.context).toEqual(context)
      expect(error.stepId).toBe('test-step')
    })

    it('should create error with cause', () => {
      const originalError = new Error('Original error')

      const error = createExecutionError(
        ExecutionErrorCode.UNKNOWN,
        'Agent execution failed',
        { cause: originalError },
      )

      expect(error.cause).toBe(originalError)
    })

    it('should create error with all parameters', () => {
      const context = { stepId: 'test-step' }
      const cause = new Error('Network timeout')

      const error = createExecutionError(
        ExecutionErrorCode.TIMEOUT,
        'Network operation failed',
        {
          stepId: 'test-step',
          attempt: 2,
          context,
          cause,
        },
      )

      expect(error.code).toBe(ExecutionErrorCode.TIMEOUT)
      expect(error.message).toBe('Network operation failed')
      expect(error.context).toEqual(context)
      expect(error.cause).toBe(cause)
      expect(error.stepId).toBe('test-step')
      expect(error.attempt).toBe(2)
      expect(typeof error.timestamp).toBe('string')
    })
  })

  describe('isExecutionError', () => {
    it('should identify execution errors', () => {
      const executionError = createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'Test error',
      )

      expect(isExecutionError(executionError)).toBe(true)
    })

    it('should reject regular errors', () => {
      const regularError = new Error('Regular error')

      expect(isExecutionError(regularError)).toBe(false)
    })

    it('should reject non-errors', () => {
      expect(isExecutionError(null)).toBe(false)
      expect(isExecutionError(undefined)).toBe(false)
      expect(isExecutionError('string')).toBe(false)
      expect(isExecutionError({})).toBe(false)
      expect(isExecutionError(42)).toBe(false)
    })

    it('should handle objects with partial ExecutionError properties', () => {
      const fakeError = {
        message: 'Fake error',
        code: 'INVALID_CODE',
        // missing timestamp
      }

      expect(isExecutionError(fakeError)).toBe(false)
    })
  })

  describe('ExecutionErrorCode enum', () => {
    it('should have all expected error codes', () => {
      expect(ExecutionErrorCode.TIMEOUT).toBe('TIMEOUT')
      expect(ExecutionErrorCode.CIRCUIT_BREAKER_OPEN).toBe(
        'CIRCUIT_BREAKER_OPEN',
      )
      expect(ExecutionErrorCode.CIRCUIT_OPEN).toBe('CIRCUIT_OPEN')
      expect(ExecutionErrorCode.CANCELLED).toBe('CANCELLED')
      expect(ExecutionErrorCode.VALIDATION).toBe('VALIDATION')
      expect(ExecutionErrorCode.RETRYABLE).toBe('RETRYABLE')
      expect(ExecutionErrorCode.UNKNOWN).toBe('UNKNOWN')
    })
  })
})
