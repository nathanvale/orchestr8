import { randomUUID } from 'node:crypto'

/**
 * Generate a correlation ID with optional prefix
 */
export function generateCorrelationId(prefix = 'o8'): string {
  return `${prefix}-${randomUUID()}`
}

/**
 * Extract correlation ID from various sources
 */
export function extractCorrelationId(
  source: unknown,
  fallbackPrefix = 'o8',
): string {
  // Check if source is an object with correlationId
  if (
    source &&
    typeof source === 'object' &&
    'correlationId' in source &&
    typeof source.correlationId === 'string'
  ) {
    return source.correlationId
  }

  // Check if source is a string (might be the ID itself)
  if (typeof source === 'string' && source.length > 0) {
    return source
  }

  // Generate a new one as fallback
  return generateCorrelationId(fallbackPrefix)
}

/**
 * Context for propagating correlation IDs through async operations
 */
export class CorrelationContext {
  private static storage = new Map<symbol, string>()
  private static currentKey: symbol | null = null

  /**
   * Run a function with a correlation ID context
   */
  static run<T>(correlationId: string, fn: () => T): T {
    const key = Symbol('correlation')
    const previousKey = this.currentKey

    try {
      this.currentKey = key
      this.storage.set(key, correlationId)
      return fn()
    } finally {
      this.storage.delete(key)
      this.currentKey = previousKey
    }
  }

  /**
   * Get the current correlation ID from context
   */
  static get(): string | undefined {
    if (!this.currentKey) {
      return undefined
    }
    return this.storage.get(this.currentKey)
  }

  /**
   * Get the current correlation ID or generate a new one
   */
  static getOrGenerate(prefix = 'o8'): string {
    return this.get() || generateCorrelationId(prefix)
  }
}
