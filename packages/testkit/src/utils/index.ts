/**
 * General testing utilities
 */

/**
 * Wait for a specified amount of time
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function until it succeeds or max attempts reached
 */
export async function retry<T>(fn: () => Promise<T>, maxAttempts = 3, delayMs = 1000): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts) {
        await delay(delayMs)
      }
    }
  }

  throw lastError
}

/**
 * Create a timeout promise that rejects after specified time
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs),
    ),
  ])
}

/**
 * Create a mock function with basic tracking
 */
export function createMockFn<TArgs extends unknown[], TReturn>(
  implementation?: (...args: TArgs) => TReturn,
) {
  const calls: TArgs[] = []
  const results: TReturn[] = []

  const mockFn = (...args: TArgs): TReturn => {
    calls.push(args)
    const result = implementation ? implementation(...args) : (undefined as TReturn)
    results.push(result)
    return result
  }

  return Object.assign(mockFn, { calls, results })
}
