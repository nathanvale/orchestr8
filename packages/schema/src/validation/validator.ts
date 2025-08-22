/**
 * Schema validation utilities
 * Provides validation with caching and friendly error messages
 */

import type { z } from 'zod'

import { SchemaErrorFormatter, type FormattedError } from './formatter.js'

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  valid: boolean
  data?: T
  errors?: FormattedError[]
  rawErrors?: z.ZodError
}

/**
 * Schema validator with caching and formatting
 */
export class SchemaValidator<T extends z.ZodType> {
  private readonly schema: T
  private readonly formatter: SchemaErrorFormatter
  private readonly cache: Map<string, ValidationResult<z.infer<T>>>
  private readonly cacheEnabled: boolean
  private readonly maxCacheSize: number

  constructor(
    schema: T,
    options: { cacheEnabled?: boolean; maxCacheSize?: number } = {},
  ) {
    this.schema = schema
    this.formatter = new SchemaErrorFormatter()
    this.cache = new Map()
    this.cacheEnabled = options.cacheEnabled ?? true
    this.maxCacheSize = options.maxCacheSize ?? 100
  }

  /**
   * Validate data against the schema
   */
  validate(data: unknown): ValidationResult<z.infer<T>> {
    // Generate cache key if caching is enabled
    const cacheKey = this.cacheEnabled ? this.getCacheKey(data) : null

    // Check cache
    if (cacheKey && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    // Perform validation
    const result = this.schema.safeParse(data)

    let validationResult: ValidationResult<z.infer<T>>

    if (result.success) {
      validationResult = {
        valid: true,
        data: result.data,
      }
    } else {
      validationResult = {
        valid: false,
        errors: this.formatter.format(result.error),
        rawErrors: result.error,
      }
    }

    // Cache result if enabled
    if (cacheKey && this.cacheEnabled) {
      this.addToCache(cacheKey, validationResult)
    }

    return validationResult
  }

  /**
   * Validate and throw on error
   */
  validateOrThrow(data: unknown): z.infer<T> {
    const result = this.validate(data)
    if (!result.valid) {
      throw new ValidationError('Validation failed', result.errors!)
    }
    return result.data!
  }

  /**
   * Parse data (alias for validate)
   */
  parse(data: unknown): ValidationResult<z.infer<T>> {
    return this.validate(data)
  }

  /**
   * Get formatted error string
   */
  getErrorString(data: unknown): string | null {
    const result = this.validate(data)
    if (result.valid) return null

    return result
      .errors!.map((err) => {
        let msg = `• ${err.path}: ${err.message}`
        if (err.example) {
          msg += ` (example: ${err.example})`
        }
        return msg
      })
      .join('\n')
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size
  }

  /**
   * Generate cache key for data
   */
  private getCacheKey(data: unknown): string {
    try {
      return JSON.stringify(data)
    } catch {
      // If data can't be stringified, don't cache
      return ''
    }
  }

  /**
   * Add result to cache with size management
   */
  private addToCache(key: string, result: ValidationResult<z.infer<T>>): void {
    // Implement simple LRU by removing oldest when at capacity
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, result)
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: FormattedError[],
  ) {
    super(message)
    this.name = 'ValidationError'
  }

  /**
   * Get formatted error message
   */
  getFormattedMessage(): string {
    return (
      this.message +
      '\n' +
      this.errors
        .map((err) => {
          let msg = `  • ${err.path}: ${err.message}`
          if (err.example) {
            msg += ` (example: ${err.example})`
          }
          return msg
        })
        .join('\n')
    )
  }
}

/**
 * Create a validator for a schema
 */
export function createValidator<T extends z.ZodType>(
  schema: T,
  options?: { cacheEnabled?: boolean; maxCacheSize?: number },
): SchemaValidator<T> {
  return new SchemaValidator(schema, options)
}

/**
 * Validate data with a schema (convenience function)
 */
export function validateSchema<T extends z.ZodType>(
  schema: T,
  data: unknown,
): ValidationResult<z.infer<T>> {
  const validator = new SchemaValidator(schema, { cacheEnabled: false })
  return validator.validate(data)
}
