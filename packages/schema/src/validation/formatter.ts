/**
 * Schema error formatter for user-friendly validation messages
 * Transforms Zod errors into actionable feedback
 */

import type { z } from 'zod'

/**
 * Formatted error structure
 */
export interface FormattedError {
  path: string
  message: string
  expected?: string
  received?: unknown
  example?: string
  code?: string
}

/**
 * Schema error formatter class
 */
export class SchemaErrorFormatter {
  private readonly exampleMap: Map<string, string>

  constructor() {
    // Map of common paths to example values
    this.exampleMap = new Map([
      ['version', '1.0.0'],
      ['schemaVersion', '1.0.0'],
      ['schemaHash', 'a'.repeat(64)],
      ['metadata.id', '123e4567-e89b-12d3-a456-426614174000'],
      ['metadata.name', 'My Workflow'],
      ['metadata.description', 'A workflow that processes user data'],
      ['steps[].id', 'fetch-data'],
      ['steps[].name', 'Fetch User Data'],
      ['steps[].agent.id', '@orchestr8/http-agent'],
      ['steps[].agent.version', '^1.0.0'],
      ['steps[].input.mapping', '${steps.previous.output.data}'],
      ['steps[].dependencies[]', 'previous-step-id'],
      ['context.secretRefs[]', 'secret://github/token'],
      ['context.variables', '{ "apiKey": "abc123" }'],
      ['policies.timeout.global', '300000'],
      ['policies.resilience.retry.maxAttempts', '3'],
      ['policies.resilience.circuitBreaker.failureThreshold', '5'],
    ])
  }

  /**
   * Format a Zod error into user-friendly messages
   */
  format(error: z.ZodError): FormattedError[] {
    return error.errors.map((err) => this.formatSingleError(err))
  }

  /**
   * Format a single Zod issue
   */
  private formatSingleError(issue: z.ZodIssue): FormattedError {
    const path = this.formatPath(issue.path)
    const message = this.getHumanMessage(issue)
    const expected = this.getExpectedType(issue)
    const example = this.getExample(path, issue)

    return {
      path,
      message,
      expected,
      received: 'received' in issue ? issue.received : undefined,
      example,
      code: issue.code,
    }
  }

  /**
   * Format the error path into a readable string
   */
  private formatPath(path: (string | number)[]): string {
    if (path.length === 0) return 'root'

    return path
      .map((segment, index) => {
        if (typeof segment === 'number') {
          return `[${segment}]`
        }
        if (index === 0) {
          return segment
        }
        // Check if previous segment was a number (array index)
        if (typeof path[index - 1] === 'number') {
          return `.${segment}`
        }
        return `.${segment}`
      })
      .join('')
  }

  /**
   * Get a human-readable error message
   */
  private getHumanMessage(issue: z.ZodIssue): string {
    switch (issue.code) {
      case 'invalid_type':
        if (issue.received === 'undefined') {
          return `This field is required`
        }
        return `Expected ${this.formatType(issue.expected)}, but received ${this.formatType(
          issue.received,
        )}`

      case 'invalid_string':
        if ('validation' in issue) {
          switch (issue.validation) {
            case 'uuid':
              return 'Must be a valid UUID (e.g., 123e4567-e89b-12d3-a456-426614174000)'
            case 'regex':
              return issue.message || 'Invalid format'
            case 'datetime':
              return 'Must be a valid ISO 8601 datetime (e.g., 2025-01-20T10:00:00Z)'
            default:
              return `Invalid string validation: ${issue.validation}`
          }
        }
        return 'Invalid string value'

      case 'too_small':
        if (issue.type === 'string') {
          return `Must be at least ${issue.minimum} characters long`
        }
        if (issue.type === 'array') {
          return `Must have at least ${issue.minimum} item${issue.minimum === 1 ? '' : 's'}`
        }
        if (issue.type === 'number') {
          return `Must be at least ${issue.minimum}`
        }
        return `Value is too small (minimum: ${issue.minimum})`

      case 'too_big':
        if (issue.type === 'string') {
          return `Must be at most ${issue.maximum} characters long`
        }
        if (issue.type === 'array') {
          return `Must have at most ${issue.maximum} item${issue.maximum === 1 ? '' : 's'}`
        }
        if (issue.type === 'number') {
          return `Must be at most ${issue.maximum}`
        }
        return `Value is too large (maximum: ${issue.maximum})`

      case 'invalid_enum_value':
        return `Must be one of: ${issue.options.map((o) => `"${o}"`).join(', ')}`

      case 'invalid_union':
        return 'None of the expected formats matched'

      case 'invalid_union_discriminator':
        return `Invalid discriminator value. Expected one of: ${issue.options
          .map((o) => `"${String(o)}"`)
          .join(', ')}`

      case 'custom':
        return issue.message || 'Validation failed'

      default:
        return issue.message || 'Invalid value'
    }
  }

  /**
   * Format a type for display
   */
  private formatType(type: unknown): string {
    if (type === 'undefined') return 'undefined'
    if (type === 'null') return 'null'
    if (typeof type === 'string') return type
    return String(type)
  }

  /**
   * Get the expected type/format
   */
  private getExpectedType(issue: z.ZodIssue): string | undefined {
    switch (issue.code) {
      case 'invalid_type':
        return this.formatType(issue.expected)

      case 'invalid_string':
        if ('validation' in issue) {
          switch (issue.validation) {
            case 'uuid':
              return 'UUID'
            case 'regex':
              return 'matching pattern'
            case 'datetime':
              return 'ISO 8601 datetime'
            default:
              return typeof issue.validation === 'string'
                ? issue.validation
                : JSON.stringify(issue.validation)
          }
        }
        return 'string'

      case 'invalid_enum_value':
        return issue.options.join(' | ')

      default:
        return undefined
    }
  }

  /**
   * Get an example value for the path
   */
  private getExample(path: string, issue: z.ZodIssue): string | undefined {
    // Check for direct path match
    if (this.exampleMap.has(path)) {
      return this.exampleMap.get(path)
    }

    // Check for pattern matches
    for (const [pattern, example] of this.exampleMap) {
      if (pattern.includes('[]') && path.includes('[')) {
        // Handle array patterns
        const patternBase = pattern.replace('[]', '')
        const pathBase = path.replace(/\[\d+\]/, '')
        if (pathBase.includes(patternBase)) {
          return example
        }
      }
    }

    // Generate example based on issue type
    if (issue.code === 'invalid_string' && 'validation' in issue) {
      switch (issue.validation) {
        case 'uuid':
          return '123e4567-e89b-12d3-a456-426614174000'
        case 'datetime':
          return new Date().toISOString()
        default:
          break
      }
    }

    if (issue.code === 'invalid_enum_value' && issue.options.length > 0) {
      return String(issue.options[0])
    }

    return undefined
  }

  /**
   * Format errors as a single string message
   */
  formatAsString(error: z.ZodError): string {
    const formatted = this.format(error)
    return formatted
      .map((err) => {
        let msg = `• ${err.path}: ${err.message}`
        if (err.example) {
          msg += ` (example: ${err.example})`
        }
        return msg
      })
      .join('\n')
  }

  /**
   * Format errors as JSON for API responses
   */
  formatAsJSON(error: z.ZodError): object {
    return {
      valid: false,
      errors: this.format(error),
    }
  }
}
