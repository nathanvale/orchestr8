/**
 * Expression evaluation for conditions and mappings
 * Implements JMESPath for conditions and ${} pattern for mappings
 */

import type { ExecutionContext } from '@orchestr8/schema'

import { createExecutionError, ExecutionErrorCode } from '@orchestr8/schema'
import * as jmespath from 'jmespath'

/**
 * Cache for JMESPath expressions (caching the expression string, not compiled form)
 */
const expressionCache = new Set<string>()

/**
 * Security limits for expression evaluation
 */
const SECURITY_LIMITS = {
  maxDepth: 10,
  maxSize: 64 * 1024, // 64KB
  timeout: 500, // 500ms as per spec
}

/**
 * Dangerous prototype keys to block
 */
const PROTOTYPE_POLLUTION_KEYS = ['__proto__', 'constructor', 'prototype']

/**
 * Evaluate a JMESPath condition expression
 * @param expression The JMESPath expression
 * @param context The execution context
 * @param strictMode If true, throw validation errors for invalid expressions
 * @returns The evaluation result
 */
export function evaluateCondition(
  expression: string,
  context: ExecutionContext,
  strictMode = false,
): boolean {
  if (!expression) {
    return true // No condition means always true
  }

  try {
    // Cache the expression string for validation
    if (!expressionCache.has(expression)) {
      expressionCache.add(expression)
    }

    // Build evaluation data from context
    const data = {
      steps: context.steps,
      variables: context.variables,
      env: getWhitelistedEnvVars(context.workflow.allowedEnvVars),
    }

    // Evaluate with timeout protection
    const result = evaluateWithTimeout(
      () => jmespath.search(data, expression),
      SECURITY_LIMITS.timeout,
    )

    // Convert to boolean
    return !!result
  } catch (error) {
    // If it's a timeout error, re-throw it
    if (error instanceof Error && error.message.includes('TIMEOUT')) {
      throw error
    }

    // In strict mode, throw validation error for invalid expressions
    if (strictMode) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        `Invalid condition expression: ${expression}`,
        { cause: error as Error },
      )
    }

    // Return false for invalid expressions (silent fail in non-strict mode)
    return false
  }
}

/**
 * Resolve mapping expressions with ${steps.*}, ${variables.*}, ${env.*} patterns
 * @param input The input object potentially containing expressions
 * @param context The execution context
 * @returns The resolved object
 */
export function resolveMapping(
  input: unknown,
  context: ExecutionContext,
): unknown {
  if (typeof input === 'string') {
    return resolveStringExpression(input, context)
  }

  if (Array.isArray(input)) {
    return input.map((item) => resolveMapping(item, context))
  }

  if (input && typeof input === 'object') {
    const resolved: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      resolved[key] = resolveMapping(value, context)
    }
    return resolved
  }

  return input
}

/**
 * Resolve a string expression with ${} placeholders
 */
function resolveStringExpression(
  input: string,
  context: ExecutionContext,
): unknown {
  // Check if entire string is a single expression
  const singleExpr = extractSingleExpression(input)
  if (singleExpr !== null) {
    return resolvePlaceholder(singleExpr, context)
  }

  // Replace multiple expressions in string
  return replaceExpressions(input, context)
}

/**
 * Extract expression from ${...} if the entire string is a single expression
 */
function extractSingleExpression(input: string): string | null {
  if (!input.startsWith('${') || !input.endsWith('}')) {
    return null
  }

  const content = input.slice(2, -1)

  // Verify this is actually a complete single expression by checking for balanced braces
  let braceCount = 0
  let inQuotes = false
  let quoteChar = ''
  let escaped = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true
      quoteChar = char
      continue
    }

    if (inQuotes && char === quoteChar) {
      inQuotes = false
      quoteChar = ''
      continue
    }

    if (!inQuotes) {
      if (char === '{') {
        braceCount++
      } else if (char === '}') {
        braceCount--
      }
    }
  }

  // If balanced and not in quotes, this is a single expression
  if (braceCount === 0 && !inQuotes) {
    return content
  }

  return null
}

/**
 * Replace all ${...} expressions in a string with their resolved values
 */
function replaceExpressions(input: string, context: ExecutionContext): string {
  let result = ''
  let i = 0

  while (i < input.length) {
    if (i < input.length - 1 && input[i] === '$' && input[i + 1] === '{') {
      // Found start of expression, find the matching closing brace
      const expressionStart = i + 2
      let braceCount = 1
      let j = expressionStart
      let inQuotes = false
      let quoteChar = ''
      let escaped = false

      while (j < input.length && braceCount > 0) {
        const char = input[j]

        if (escaped) {
          escaped = false
          j++
          continue
        }

        if (char === '\\') {
          escaped = true
          j++
          continue
        }

        if (!inQuotes && (char === '"' || char === "'")) {
          inQuotes = true
          quoteChar = char
          j++
          continue
        }

        if (inQuotes && char === quoteChar) {
          inQuotes = false
          quoteChar = ''
          j++
          continue
        }

        if (!inQuotes) {
          if (char === '{') {
            braceCount++
          } else if (char === '}') {
            braceCount--
          }
        }

        j++
      }

      if (braceCount === 0) {
        // Found complete expression
        const expression = input.slice(expressionStart, j - 1)
        const value = resolvePlaceholder(expression, context)
        result += value === undefined ? input.slice(i, j) : String(value)
        i = j
      } else {
        // Unmatched braces, treat as literal
        result += input[i]
        i++
      }
    } else {
      result += input[i]
      i++
    }
  }

  return result
}

/**
 * Parse expression with default value, handling quote escaping and nested ?? operators
 */
function parseExpressionWithDefault(expression: string): {
  expression: string
  defaultValue?: string
} {
  let i = 0
  let inQuotes = false
  let quoteChar = ''
  let escaped = false

  // Find the first ?? operator that's not inside quotes
  while (i < expression.length - 1) {
    const char = expression[i]
    const nextChar = expression[i + 1]

    if (escaped) {
      escaped = false
      i++
      continue
    }

    if (char === '\\') {
      escaped = true
      i++
      continue
    }

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true
      quoteChar = char
      i++
      continue
    }

    if (inQuotes && char === quoteChar) {
      inQuotes = false
      quoteChar = ''
      i++
      continue
    }

    // Look for ?? operator when not in quotes
    if (!inQuotes && char === '?' && nextChar === '?') {
      // Found the operator - split here
      const expr = expression.substring(0, i).trim()
      const defaultRaw = expression.substring(i + 2).trim()

      // Parse the default value to remove quotes and handle escaping
      const defaultValue = parseQuotedString(defaultRaw)

      return {
        expression: expr,
        defaultValue: defaultValue,
      }
    }

    i++
  }

  // No ?? operator found
  return {
    expression: expression.trim(),
    defaultValue: undefined,
  }
}

/**
 * Parse a quoted string, handling escape sequences
 */
function parseQuotedString(input: string): string | undefined {
  if (input === undefined || input === null) return undefined

  const trimmed = input.trim()
  if (trimmed === '') return undefined

  // Check for double quotes
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const content = trimmed.slice(1, -1)
    return unescapeString(content, '"')
  }

  // Check for single quotes
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const content = trimmed.slice(1, -1)
    return unescapeString(content, "'")
  }

  // Return as-is if not quoted
  return trimmed
}

/**
 * Unescape a string based on the quote type
 */
function unescapeString(str: string, quoteType: string): string {
  return str
    .replace(new RegExp(`\\\\${quoteType}`, 'g'), quoteType) // Unescape quotes
    .replace(/\\\\/g, '\\') // Unescape backslashes
}

/**
 * Resolve a single placeholder expression
 */
function resolvePlaceholder(
  expression: string,
  context: ExecutionContext,
): unknown {
  // Handle default value syntax: expression ?? defaultValue
  const parsedExpression = parseExpressionWithDefault(expression)
  const expr = parsedExpression.expression
  const defaultValue = parsedExpression.defaultValue

  // Parse the expression path
  const parts = expr.split('.')
  const source = parts[0]

  let value: unknown

  // Resolve based on source (precedence: steps → variables → env)
  if (source === 'steps' && parts.length >= 3) {
    // Format: steps.stepId.output or steps.stepId.property
    const stepId = parts[1]
    const property = parts.slice(2).join('.')
    const stepResult = stepId ? context.steps[stepId] : undefined

    if (stepResult) {
      if (property === 'output') {
        value = stepResult.output
      } else if (property === 'status') {
        value = stepResult.status
      } else if (property === 'stepId') {
        value = stepResult.stepId
      } else if (property.startsWith('output.')) {
        // Navigate into output object
        value = navigateObject(stepResult.output, property.substring(7))
      } else {
        // Try to access any other property on the step result
        value = navigateObject(stepResult, property)
      }
    }
  } else if (source === 'variables') {
    // Format: variables.varName
    const varPath = parts.slice(1).join('.')
    value = navigateObject(context.variables, varPath)
  } else if (source === 'env') {
    // Format: env.VAR_NAME
    const envVar = parts[1]
    const allowedVars = context.workflow.allowedEnvVars
    if (allowedVars && envVar && allowedVars.includes(envVar)) {
      value = process.env[envVar]
    }
  }

  // Get final resolved value or default
  const resolvedValue = value !== undefined ? value : defaultValue

  // Check expansion size limit
  if (resolvedValue !== undefined) {
    checkExpansionSizeLimit(resolvedValue)
  }

  return resolvedValue
}

/**
 * Check if a value exceeds the expansion size limit
 */
function checkExpansionSizeLimit(value: unknown): void {
  try {
    // Serialize the value to check its size
    const serialized = JSON.stringify(value)
    const byteSize = Buffer.byteLength(serialized, 'utf8')

    if (byteSize > SECURITY_LIMITS.maxSize) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        `Expression expansion size exceeds limit of ${SECURITY_LIMITS.maxSize} bytes (got ${byteSize} bytes)`,
      )
    }
  } catch (error) {
    // If it's already our validation error, re-throw it
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'VALIDATION'
    ) {
      throw error
    }

    // If JSON.stringify fails (circular reference, etc), that's also a validation error
    throw createExecutionError(
      ExecutionErrorCode.VALIDATION,
      `Expression value could not be serialized for size check: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

/**
 * Navigate an object path safely
 */
function navigateObject(obj: unknown, path: string): unknown {
  if (!obj || !path) return undefined

  const parts = path.split('.')
  let current: unknown = obj
  let depth = 0

  for (const part of parts) {
    // Check depth limit using proper counter
    depth++
    if (depth > SECURITY_LIMITS.maxDepth) {
      throw new Error(
        `Expression depth exceeds limit of ${SECURITY_LIMITS.maxDepth}`,
      )
    }

    // Block prototype pollution keys
    if (PROTOTYPE_POLLUTION_KEYS.includes(part)) {
      throw new Error(`Access to dangerous property '${part}' is not allowed`)
    }

    if (current === null || current === undefined) {
      return undefined
    }

    // Type guard to ensure current is an object
    if (typeof current !== 'object') {
      return undefined
    }

    // Handle array indices
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/)
    if (arrayMatch) {
      const [, key, index] = arrayMatch
      if (key && index) {
        // Also check the key for prototype pollution
        if (PROTOTYPE_POLLUTION_KEYS.includes(key)) {
          throw new Error(
            `Access to dangerous property '${key}' is not allowed`,
          )
        }
        const objWithKey = current as Record<string, unknown>
        const arrayValue = objWithKey[key]
        if (Array.isArray(arrayValue)) {
          current = arrayValue[parseInt(index, 10)]
        } else {
          return undefined
        }
      }
    } else {
      const objCurrent = current as Record<string, unknown>
      current = objCurrent[part]
    }
  }

  return current
}

/**
 * Get whitelisted environment variables
 */
function getWhitelistedEnvVars(
  allowedVars?: string[],
): Record<string, string | undefined> {
  if (!allowedVars || allowedVars.length === 0) {
    return {}
  }

  const env: Record<string, string | undefined> = {}
  for (const varName of allowedVars) {
    env[varName] = process.env[varName]
  }
  return env
}

/**
 * Evaluate a function with timeout protection using AbortSignal
 */
function evaluateWithTimeout<T>(fn: () => T, timeout: number): T {
  const startTime = Date.now()

  // Create an AbortController for timeout
  const timeoutController = new AbortController()

  // Set up timeout
  const timeoutId = setTimeout(() => {
    timeoutController.abort()
  }, timeout)

  try {
    // For synchronous operations, we still check elapsed time
    // In the future, this could be enhanced with worker threads
    const result = fn()

    const elapsed = Date.now() - startTime
    if (elapsed > timeout || timeoutController.signal.aborted) {
      throw createExecutionError(
        ExecutionErrorCode.TIMEOUT,
        `Expression evaluation exceeded ${timeout}ms timeout (took ${elapsed}ms)`,
      )
    }

    return result
  } catch (error) {
    // Check if this is a timeout-related error
    if (timeoutController.signal.aborted) {
      throw createExecutionError(
        ExecutionErrorCode.TIMEOUT,
        `Expression evaluation was cancelled due to ${timeout}ms timeout`,
      )
    }
    // Re-throw original error
    throw error
  } finally {
    // Clean up timeout
    clearTimeout(timeoutId)
  }
}

/**
 * Clear the expression cache (useful for testing)
 */
export function clearExpressionCache(): void {
  expressionCache.clear()
}

/**
 * Export security limits for testing
 */
export { SECURITY_LIMITS, PROTOTYPE_POLLUTION_KEYS }
