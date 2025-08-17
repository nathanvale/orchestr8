import type { RetryOptions, ResilienceOperation } from './types.js'
import { RetryExhaustedError } from './types.js'

export async function retry<T>(
  operation: ResilienceOperation<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === options.maxAttempts) {
        throw new RetryExhaustedError(attempt, lastError)
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(
        options.initialDelayMs *
          Math.pow(options.backoffMultiplier, attempt - 1),
        options.maxDelayMs,
      )

      const delay = options.jitter
        ? baseDelay * (0.5 + Math.random()) // Full jitter: 50% to 150% of base
        : baseDelay

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw new RetryExhaustedError(options.maxAttempts, lastError!)
}
