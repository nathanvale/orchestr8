import { TimeoutError } from './errors.js'

/**
 * Cancellation token for cancellable operations
 */
export interface CancellationToken {
  /** Whether cancellation has been requested */
  readonly isCancellationRequested: boolean

  /** Register a callback to be called when cancellation is requested */
  onCancellationRequested(callback: () => void): void
}

/**
 * Source for creating cancellation tokens
 */
export class CancellationTokenSource {
  private _isCancellationRequested = false
  private callbacks: Set<() => void> = new Set()

  /** The cancellation token */
  readonly token: CancellationToken

  constructor() {
    // Create token with proper 'this' binding
    this.token = this.createToken()
  }

  private createToken(): CancellationToken {
    const getIsCancelled = () => this._isCancellationRequested
    const registerCallback = (callback: () => void) => {
      if (this._isCancellationRequested) {
        // Already cancelled, call immediately
        callback()
      } else {
        this.callbacks.add(callback)
      }
    }

    return {
      get isCancellationRequested(): boolean {
        return getIsCancelled()
      },
      onCancellationRequested: registerCallback,
    }
  }

  /** Request cancellation */
  cancel(): void {
    if (this._isCancellationRequested) {
      return
    }

    this._isCancellationRequested = true

    // Call all registered callbacks
    for (const callback of this.callbacks) {
      try {
        callback()
      } catch {
        // Ignore errors in callbacks
      }
    }

    this.callbacks.clear()
  }
}

/**
 * Manages timeouts and cancellation for operations
 */
export class TimeoutManager {
  private timeouts: Map<string, NodeJS.Timeout> = new Map()
  private cancellationSources: Map<string, CancellationTokenSource> = new Map()

  /**
   * Run an operation with a timeout
   */
  async runWithTimeout<T>(
    operation: (token: CancellationToken) => Promise<T>,
    timeoutMs: number,
    operationName?: string,
  ): Promise<T> {
    const id = this.generateId()
    const source = new CancellationTokenSource()
    this.cancellationSources.set(id, source)

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeout = setTimeout(() => {
        source.cancel()
        reject(new TimeoutError(timeoutMs, operationName))
      }, timeoutMs)
      this.timeouts.set(id, timeout)
    })

    try {
      // Race between operation and timeout
      const result = await Promise.race([operation(source.token), timeoutPromise])
      return result
    } finally {
      // Clean up
      this.clearTimeout(id)
    }
  }

  /**
   * Run multiple operations with a shared timeout
   */
  async runAllWithTimeout<T>(
    operations: Array<(token: CancellationToken) => Promise<T>>,
    timeoutMs: number,
    operationName?: string,
  ): Promise<T[]> {
    const id = this.generateId()
    const source = new CancellationTokenSource()
    this.cancellationSources.set(id, source)

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeout = setTimeout(() => {
        source.cancel()
        reject(new TimeoutError(timeoutMs, operationName))
      }, timeoutMs)
      this.timeouts.set(id, timeout)
    })

    try {
      // Run all operations with the same cancellation token
      const operationPromises = operations.map((op) => op(source.token))
      const allPromise = Promise.all(operationPromises)

      // Race between all operations completing and timeout
      const results = await Promise.race([allPromise, timeoutPromise])
      return results
    } finally {
      // Clean up
      this.clearTimeout(id)
    }
  }

  /**
   * Create a cancellable timeout
   */
  createTimeout(callback: () => void, timeoutMs: number): { id: string; cancel: () => void } {
    const id = this.generateId()
    const timeout = setTimeout(callback, timeoutMs)
    this.timeouts.set(id, timeout)

    return {
      id,
      cancel: () => this.clearTimeout(id),
    }
  }

  /**
   * Clear a timeout
   */
  private clearTimeout(id: string): void {
    const timeout = this.timeouts.get(id)
    if (timeout) {
      clearTimeout(timeout)
      this.timeouts.delete(id)
    }

    const source = this.cancellationSources.get(id)
    if (source) {
      source.cancel()
      this.cancellationSources.delete(id)
    }
  }

  /**
   * Clear all timeouts
   */
  clearAll(): void {
    for (const id of this.timeouts.keys()) {
      this.clearTimeout(id)
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Check if a cancellation token is cancelled
   */
  static isCancelled(token: CancellationToken): boolean {
    return token.isCancellationRequested
  }

  /**
   * Create a promise that rejects when cancelled
   */
  static createCancellationPromise(token: CancellationToken): Promise<never> {
    return new Promise<never>((_, reject) => {
      if (token.isCancellationRequested) {
        reject(new Error('Operation cancelled'))
      } else {
        token.onCancellationRequested(() => {
          reject(new Error('Operation cancelled'))
        })
      }
    })
  }

  /**
   * Wrap an async operation to support cancellation
   */
  static async withCancellation<T>(operation: Promise<T>, token: CancellationToken): Promise<T> {
    return Promise.race([operation, this.createCancellationPromise(token)])
  }
}
