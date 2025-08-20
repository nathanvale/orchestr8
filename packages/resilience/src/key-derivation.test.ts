/**
 * Tests for key derivation from ResilienceContext
 */

import { describe, expect, it } from 'vitest'

import type { CircuitBreakerConfig, ResilienceContext } from './types.js'

import { deriveKey } from './key-derivation.js'

describe('key derivation', () => {
  describe('deriveKey', () => {
    it('should derive key from workflowId and stepId', () => {
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        correlationId: 'correlation-789',
      }

      const key = deriveKey(context)
      expect(key).toBe('workflow-123:step-456')
    })

    it('should use explicit key from config if provided', () => {
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
      }

      const config: CircuitBreakerConfig = {
        key: 'custom-key',
        failureThreshold: 5,
        recoveryTime: 30000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }

      const key = deriveKey(context, config)
      expect(key).toBe('custom-key')
    })

    it('should handle missing workflowId gracefully', () => {
      const context: ResilienceContext = {
        stepId: 'step-456',
        correlationId: 'correlation-789',
      }

      const key = deriveKey(context)
      expect(key).toBe('global:step-456')
    })

    it('should handle missing stepId gracefully', () => {
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        correlationId: 'correlation-789',
      }

      const key = deriveKey(context)
      expect(key).toBe('workflow-123:unknown')
    })

    it('should handle missing both workflowId and stepId', () => {
      const context: ResilienceContext = {
        correlationId: 'correlation-789',
      }

      const key = deriveKey(context)
      expect(key).toBe('global:unknown')
    })

    it('should handle undefined context', () => {
      const key = deriveKey(undefined)
      expect(key).toBe('global:unknown')
    })

    it('should handle empty context', () => {
      const context: ResilienceContext = {}

      const key = deriveKey(context)
      expect(key).toBe('global:unknown')
    })

    it('should prioritize explicit key over derived key', () => {
      const context: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
      }

      const config: CircuitBreakerConfig = {
        key: 'override-key',
        failureThreshold: 5,
        recoveryTime: 30000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }

      const key = deriveKey(context, config)
      expect(key).toBe('override-key')
    })

    it('should handle special characters in IDs', () => {
      const context: ResilienceContext = {
        workflowId: 'workflow:123:special',
        stepId: 'step:456:chars',
      }

      const key = deriveKey(context)
      expect(key).toBe('workflow:123:special:step:456:chars')
    })

    it('should be consistent for same inputs', () => {
      const context1: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
      }

      const context2: ResilienceContext = {
        workflowId: 'workflow-123',
        stepId: 'step-456',
        correlationId: 'different-correlation',
      }

      const key1 = deriveKey(context1)
      const key2 = deriveKey(context2)
      expect(key1).toBe(key2)
    })
  })
})
