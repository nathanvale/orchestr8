/**
 * Configuration validation for resilience patterns
 */

import { z } from 'zod'

import type { CircuitBreakerConfig } from './types.js'

import { CircuitBreakerConfigurationError } from './errors.js'

/**
 * Zod schema for CircuitBreakerConfig validation
 */
export const CircuitBreakerConfigSchema = z.object({
  key: z.string().optional(),
  failureThreshold: z
    .number()
    .positive('Invalid failureThreshold: must be greater than 0')
    .refine((val) => val <= 1 || Number.isInteger(val), {
      message:
        'Invalid failureThreshold: must be between 0 and 1 for rate-based thresholds or an integer for count-based thresholds',
    }),
  recoveryTime: z.number().positive('Invalid recoveryTime: must be positive'),
  sampleSize: z
    .number()
    .int('Invalid sampleSize: must be an integer')
    .min(10, 'Invalid sampleSize: must be at least 10'),
  halfOpenPolicy: z.enum(['single-probe', 'gradual'], {
    errorMap: () => ({
      message: 'Invalid halfOpenPolicy: must be "single-probe" or "gradual"',
    }),
  }),
})

/**
 * Validate CircuitBreakerConfig and throw detailed errors
 */
export function validateCircuitBreakerConfig(
  config: unknown,
): CircuitBreakerConfig {
  const result = CircuitBreakerConfigSchema.safeParse(config)

  if (!result.success) {
    const firstError = result.error.errors[0]
    if (!firstError) {
      throw new CircuitBreakerConfigurationError(
        'Configuration validation failed with no error details',
        'unknown',
        undefined,
        'valid configuration',
      )
    }

    // Create detailed error based on the validation failure
    const field = firstError.path[0] as string
    const provided = (config as Record<string, unknown>)?.[field]
    const message = firstError.message

    // Extract expected value from error message
    let expected: string
    if (field === 'sampleSize') {
      expected = 'number >= 10'
    } else if (field === 'failureThreshold') {
      if (
        typeof provided === 'number' &&
        provided > 1 &&
        !Number.isInteger(provided)
      ) {
        expected = 'number between 0 and 1, or positive integer'
      } else {
        expected = 'positive number'
      }
    } else if (field === 'recoveryTime') {
      expected = 'positive number'
    } else if (field === 'halfOpenPolicy') {
      expected = '"single-probe" or "gradual"'
    } else {
      expected = 'valid value'
    }

    // Create human-readable message
    let readableMessage = message
    if (
      field === 'failureThreshold' &&
      typeof provided === 'number' &&
      provided > 1 &&
      !Number.isInteger(provided)
    ) {
      readableMessage = `Invalid failureThreshold: must be between 0 and 1 for rate-based thresholds, got ${provided}`
    } else if (field === 'halfOpenPolicy') {
      readableMessage = `Invalid halfOpenPolicy: must be "single-probe" or "gradual", got "${provided}"`
    } else if (field === 'sampleSize') {
      readableMessage = `Invalid sampleSize: must be at least 10, got ${provided}`
    } else if (field === 'recoveryTime') {
      readableMessage = `Invalid recoveryTime: must be positive, got ${provided}`
    } else if (
      field === 'failureThreshold' &&
      typeof provided === 'number' &&
      provided <= 0
    ) {
      readableMessage = `Invalid failureThreshold: must be greater than 0, got ${provided}`
    }

    throw new CircuitBreakerConfigurationError(
      readableMessage,
      field,
      provided as unknown,
      expected,
    )
  }

  return result.data
}
