/**
 * General testing utilities with performance optimization through object pooling
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
} from '../security/index.js'

// Export resource management functions
export {
  ResourceManager,
  globalResourceManager,
  registerResource,
  cleanupAllResources,
  getResourceStats,
  detectResourceLeaks,
  ResourceCategory,
  ResourcePriority,
  ResourceEvent,
  type SyncCleanupFunction,
  type AsyncCleanupFunction,
  type CleanupFunction,
  type ResourceOptions,
  type ResourceDefinition,
  type CleanupOptions,
  type CleanupError,
  type CleanupCategorySummary,
  type CleanupResult,
  type ResourceLeak,
  type ResourceStats,
  type ResourceManagerConfig,
  type ResourceEventData,
  isAsyncCleanupFunction,
  DEFAULT_CATEGORY_PRIORITIES,
  DEFAULT_CATEGORY_TIMEOUTS,
} from '../resources/index.js'

// Export concurrency control functions
export {
  ConcurrencyManager,
  ConcurrencyError,
  limitConcurrency,
  limitedPromiseAll,
  limitedAll,
  limitedAllSettled,
  fileOperationsManager,
  databaseOperationsManager,
  networkOperationsManager,
  processSpawningManager,
  resourceCleanupManager,
  DEFAULT_CONCURRENCY_LIMITS,
  type ConcurrencyOptions,
  type BatchOptions,
} from './concurrency'

// Export object pooling functions
export {
  ObjectPool,
  BufferPool,
  ArrayPool,
  PromisePool,
  PoolManager,
  poolManager,
  PoolUtils,
  GlobalPools,
  DEFAULT_POOL_OPTIONS,
  type ObjectFactory,
  type ObjectResetter,
  type ObjectDisposer,
  type ObjectValidator,
  type ObjectPoolOptions,
  type PoolStats,
} from './object-pool'

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

/**
 * Utility functions for common testing scenarios with object pooling
 */
export const TestingUtils = {
  /**
   * Create a pooled buffer for test data
   */
  createTestBuffer: (size = 1024) => {
    return Buffer.allocUnsafe(size)
  },

  /**
   * Release a test buffer back to the pool
   */
  releaseTestBuffer: (buffer: Buffer) => {
    // Simple implementation - just fill with zeros for cleanup
    buffer.fill(0)
  },

  /**
   * Create a pooled array for test data
   */
  createTestArray: <T>() => {
    return [] as T[]
  },

  /**
   * Release a test array back to the pool
   */
  releaseTestArray: <T>(array: T[]) => {
    // Simple implementation - just clear the array
    array.length = 0
  },

  /**
   * Create a controlled promise for async testing
   */
  createControlledPromise: <T>() => {
    let resolve: (value: T | PromiseLike<T>) => void
    let reject: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve: resolve!, reject: reject! }
  },
} as const
