/**
 * Expression evaluation for conditions and mappings
 * Implements JMESPath for conditions and ${} pattern for mappings
 */

import type { ExecutionContext, ExecutionError } from '@orchestr8/schema'

import { createExecutionError } from '@orchestr8/schema'
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
 * @returns The evaluation result
 */
export function evaluateCondition(
  expression: string,
  context: ExecutionContext,
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
    // Log error and return false for invalid expressions
    console.error(`Failed to evaluate condition: ${expression}`, error)
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
  const singleExprMatch = input.match(/^\$\{([^}]+)\}$/)
  if (singleExprMatch) {
    return resolvePlaceholder(singleExprMatch[1]!, context)
  }

  // Replace multiple expressions in string
  return input.replace(/\$\{([^}]+)\}/g, (match, expr) => {
    const value = resolvePlaceholder(expr, context)
    return value === undefined ? match : String(value)
  })
}

/**
 * Resolve a single placeholder expression
 */
function resolvePlaceholder(
  expression: string,
  context: ExecutionContext,
): unknown {
  // Handle default value syntax: expression ?? defaultValue
  const [expr, defaultValueRaw] = expression.split('??').map((s) => s.trim())

  // Parse default value - remove surrounding quotes if present
  let defaultValue = defaultValueRaw
  if (
    defaultValue &&
    defaultValue.startsWith('"') &&
    defaultValue.endsWith('"')
  ) {
    defaultValue = defaultValue.slice(1, -1)
  }

  // Parse the expression path
  const parts = expr!.split('.')
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

  // Return value or default
  return value !== undefined ? value : defaultValue || undefined
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
 * Evaluate a function with timeout protection
 */
function evaluateWithTimeout<T>(fn: () => T, timeout: number): T {
  const startTime = Date.now()

  // Note: In a real implementation, we'd use worker threads or
  // other mechanisms for true timeout protection. For now, we
  // execute synchronously and check elapsed time.
  const result = fn()

  const elapsed = Date.now() - startTime
  if (elapsed > timeout) {
    // Throw a proper timeout error instead of just warning
    const error: ExecutionError = createExecutionError(
      'TIMEOUT',
      `Expression evaluation exceeded ${timeout}ms timeout (took ${elapsed}ms)`,
    )
    throw error
  }

  return result
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
