/**
 * Concurrency control utilities for preventing memory pressure and resource exhaustion
 */

export interface ConcurrencyOptions {
  limit: number
  throwOnTimeout?: boolean
  timeout?: number
}

export interface BatchOptions {
  concurrency: number
  throwOnTimeout?: boolean
  timeout?: number
  preserveOrder?: boolean
}

export class ConcurrencyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'ConcurrencyError'
  }
}

export class ConcurrencyManager {
  private pending: number = 0
  private queue: Array<() => void> = []
  private readonly options: Required<ConcurrencyOptions>

  constructor(options: ConcurrencyOptions) {
    this.options = {
      limit: options.limit,
      throwOnTimeout: options.throwOnTimeout ?? false,
      timeout: options.timeout ?? 30000, // 30 seconds default
    }
  }

  /**
   * Execute a function with concurrency control
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = this.options.timeout
        ? setTimeout(() => {
            if (this.options.throwOnTimeout) {
              reject(
                new ConcurrencyError(
                  `Operation timed out after ${this.options.timeout}ms`,
                  'TIMEOUT',
                ),
              )
            }
          }, this.options.timeout)
        : undefined

      const executeTask = async () => {
        this.pending++
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.pending--
          if (timeoutId) clearTimeout(timeoutId)
          this.processQueue()
        }
      }

      if (this.pending < this.options.limit) {
        executeTask()
      } else {
        this.queue.push(executeTask)
      }
    })
  }

  /**
   * Execute multiple operations in batches with concurrency control
   */
  async batch<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = []
    const promises: Promise<void>[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const promise = this.execute(() => fn(item)).then((result) => {
        results[i] = result
      })
      promises.push(promise)
    }

    await Promise.all(promises)
    return results
  }

  /**
   * Map over items with concurrency control, preserving order
   */
  async map<T, R>(items: T[], fn: (item: T) => Promise<R>, limit?: number): Promise<R[]> {
    const manager = limit ? new ConcurrencyManager({ ...this.options, limit }) : this

    return manager.batch(items, fn)
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.pending < this.options.limit) {
      const nextTask = this.queue.shift()
      if (nextTask) {
        nextTask()
      }
    }
  }

  /**
   * Get current statistics
   */
  getStats(): { pending: number; queued: number; limit: number } {
    return {
      pending: this.pending,
      queued: this.queue.length,
      limit: this.options.limit,
    }
  }

  /**
   * Wait for all pending operations to complete
   */
  async drain(): Promise<void> {
    while (this.pending > 0 || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
}

/**
 * Create a function with built-in concurrency limiting
 */
export function limitConcurrency<
  TArgs extends readonly unknown[],
  TReturn,
  TFn extends (...args: TArgs) => Promise<TReturn>,
>(fn: TFn, limit: number): TFn {
  const manager = new ConcurrencyManager({ limit })

  return ((...args: Parameters<TFn>) => {
    return manager.execute(() => fn(...args))
  }) as TFn
}

/**
 * Execute an array of promises with concurrency control
 */
export async function limitedPromiseAll<T>(
  promises: (() => Promise<T>)[],
  options: BatchOptions,
): Promise<T[]> {
  const managerOptions: ConcurrencyOptions = {
    limit: options.concurrency,
    timeout: options.timeout,
    throwOnTimeout: options.throwOnTimeout,
  }
  const manager = new ConcurrencyManager(managerOptions)
  return manager.batch(promises, (promiseFn) => promiseFn())
}

/**
 * Default concurrency managers for common operations
 */
export const DEFAULT_CONCURRENCY_LIMITS = {
  FILE_OPERATIONS: 10,
  DATABASE_OPERATIONS: 5,
  NETWORK_OPERATIONS: 3,
  PROCESS_SPAWNING: 2,
  RESOURCE_CLEANUP: 8,
} as const

// Global managers for common operations
export const fileOperationsManager = new ConcurrencyManager({
  limit: DEFAULT_CONCURRENCY_LIMITS.FILE_OPERATIONS,
  timeout: 30000,
})

export const databaseOperationsManager = new ConcurrencyManager({
  limit: DEFAULT_CONCURRENCY_LIMITS.DATABASE_OPERATIONS,
  timeout: 60000,
})

export const networkOperationsManager = new ConcurrencyManager({
  limit: DEFAULT_CONCURRENCY_LIMITS.NETWORK_OPERATIONS,
  timeout: 30000,
})

export const processSpawningManager = new ConcurrencyManager({
  limit: DEFAULT_CONCURRENCY_LIMITS.PROCESS_SPAWNING,
  timeout: 120000, // Longer timeout for process operations
})

export const resourceCleanupManager = new ConcurrencyManager({
  limit: DEFAULT_CONCURRENCY_LIMITS.RESOURCE_CLEANUP,
  timeout: 45000,
})

/**
 * Utility function to replace Promise.all with concurrency-controlled execution
 */
export async function limitedAll<T>(
  items: (() => Promise<T>)[],
  limit: number = DEFAULT_CONCURRENCY_LIMITS.FILE_OPERATIONS,
): Promise<T[]> {
  const manager = new ConcurrencyManager({ limit })
  return manager.batch(items, (fn) => fn())
}

/**
 * Utility function to replace Promise.allSettled with concurrency-controlled execution
 */
export async function limitedAllSettled<T>(
  items: (() => Promise<T>)[],
  limit: number = DEFAULT_CONCURRENCY_LIMITS.FILE_OPERATIONS,
): Promise<PromiseSettledResult<T>[]> {
  const manager = new ConcurrencyManager({ limit })

  const results = await manager.batch(items, async (fn) => {
    try {
      const value = await fn()
      return { status: 'fulfilled' as const, value }
    } catch (reason) {
      return { status: 'rejected' as const, reason }
    }
  })

  return results
}
