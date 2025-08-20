/**
 * Key derivation utilities for circuit breaker isolation
 */

import type { CircuitBreakerConfig, ResilienceContext } from './types.js'

/**
 * Derive a circuit breaker key from ResilienceContext
 *
 * Priority order:
 * 1. Explicit key in circuit breaker config
 * 2. Derived from workflowId:stepId
 * 3. Fallback to global:unknown for missing values
 *
 * @param context - The resilience context containing workflow and step IDs
 * @param config - Optional circuit breaker config with explicit key
 * @returns A string key for circuit isolation
 */
export function deriveKey(
  context?: ResilienceContext,
  config?: CircuitBreakerConfig,
): string {
  // Use explicit key if provided
  if (config?.key) {
    return config.key
  }

  // Derive from context
  const workflowId = context?.workflowId || 'global'
  const stepId = context?.stepId || 'unknown'

  return `${workflowId}:${stepId}`
}
