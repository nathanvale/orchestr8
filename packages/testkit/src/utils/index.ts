/**
 * General testing utilities
 */

// Export security validation functions
export {
  sanitizeCommand,
  validateCommand,
  validatePath,
  sanitizeSqlIdentifier,
  escapeShellArg,
  validateShellExecution,
  validateBatch,
  SecurityValidationError,
  type SecurityValidationType,
  type SecurityValidationOptions,
  type ValidationResult,
} from '../security'

/**
 * Wait for a specified amount of time
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function until it succeeds or max attempts reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
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
      setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs),
    ),
  ])
}

/**
 * Create a mock function with basic tracking
 */
export function createMockFn<TArgs extends unknown[], TReturn>(
  implementation?: (...args: TArgs) => TReturn,
) {
  // Check if vitest is available
  if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
    const vi = (globalThis as { vi?: { fn?: (impl?: unknown) => unknown } }).vi
    if (vi?.fn && typeof vi.fn === 'function') {
      return vi.fn(implementation)
    }
  }

  // Fallback implementation with call tracking
  const calls: TArgs[] = []
  const results: TReturn[] = []

  const mockFn = (...args: TArgs): TReturn => {
    calls.push(args)
    const result = implementation ? implementation(...args) : (undefined as TReturn)
    results.push(result)
    return result
  }

  // Add vitest-like properties for compatibility
  const mockFnWithProps = Object.assign(mockFn, {
    calls,
    results,
    mockClear: () => {
      calls.length = 0
      results.length = 0
    },
    mockReset: () => {
      calls.length = 0
      results.length = 0
    },
    mockRestore: () => {
      calls.length = 0
      results.length = 0
    },
  })

  return mockFnWithProps
}
