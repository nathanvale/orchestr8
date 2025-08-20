/**
 * Expression validation for workflow input mapping
 * Provides secure validation and resolution of ${...} expressions
 */

/**
 * Configuration for expression security limits
 */
export interface ExpressionSecurityConfig {
  /** Maximum depth for nested property access */
  maxExpansionDepth: number
  /** Maximum size in bytes for expanded expression result */
  maxExpansionSize: number
  /** Whether to allow environment variable access */
  allowEnvAccess: boolean
  /** Whitelist of allowed environment variables */
  allowedEnvVars?: string[]
}

/**
 * Default security configuration
 */
export const DEFAULT_EXPRESSION_SECURITY: ExpressionSecurityConfig = {
  maxExpansionDepth: 10,
  maxExpansionSize: 65536, // 64KB
  allowEnvAccess: true,
  allowedEnvVars: undefined, // undefined means check workflow.allowedEnvVars
}

/**
 * Context available for expression resolution
 */
export interface ExpressionContext {
  /** Results from completed workflow steps */
  steps: Record<string, { output: unknown }>
  /** Workflow variables */
  variables: Record<string, unknown>
  /** Environment variables (filtered by allowlist) */
  env: Record<string, string>
  /** Security configuration */
  security?: ExpressionSecurityConfig
  /** Workflow configuration (for allowedEnvVars) */
  workflowConfig?: {
    allowedEnvVars?: string[]
  }
}

/**
 * Result of expression validation
 */
export interface ExpressionValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Expression validation and resolution utilities
 */
export class ExpressionValidator {
  private static readonly EXPRESSION_PATTERN = /^\$\{([^}]+)\}$/
  private static readonly PATH_PATTERN =
    /^(steps\.[a-zA-Z0-9_-]+\.output|variables|env)\.[a-zA-Z0-9_.[\]]+$/
  private static readonly DEFAULT_OPERATOR_PATTERN = /^(.+?)\s*\?\?\s*(.+)$/

  /**
   * Validate an expression syntax without resolving it
   */
  static validateExpressionSyntax(
    expression: string,
  ): ExpressionValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check if it's a valid expression format
    const match = expression.match(this.EXPRESSION_PATTERN)
    if (!match) {
      errors.push('Expression must be in format ${...}')
      return { isValid: false, errors, warnings }
    }

    const innerExpression = match[1]?.trim() || ''

    // Parse default value if present
    const defaultMatch = innerExpression.match(this.DEFAULT_OPERATOR_PATTERN)
    const pathExpression = defaultMatch
      ? defaultMatch[1]?.trim() || ''
      : innerExpression
    const defaultValue = defaultMatch ? defaultMatch[2]?.trim() : undefined

    // Validate path expression
    if (!pathExpression || !this.validatePathExpression(pathExpression)) {
      errors.push(
        `Invalid path expression: ${pathExpression}. ` +
          `Must be steps.<stepId>.output.<path>, variables.<name>, or env.<name>`,
      )
    }

    // Validate default value syntax if present
    if (defaultValue !== undefined) {
      const defaultValidation = this.validateDefaultValue(defaultValue)
      errors.push(...defaultValidation.errors)
      warnings.push(...defaultValidation.warnings)
    }

    // Check for potentially dangerous patterns
    if (
      pathExpression &&
      (pathExpression.includes('__proto__') ||
        pathExpression.includes('prototype'))
    ) {
      errors.push('Prototype pollution attempts are not allowed in expressions')
    }

    // Check for excessive nesting
    const depth = pathExpression
      ? (pathExpression.match(/\./g) || []).length
      : 0
    if (depth > 20) {
      warnings.push(
        `Deep property access detected (${depth} levels). Consider simplifying the expression.`,
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Resolve an expression against the given context
   */
  static resolveExpression(
    expression: string,
    context: ExpressionContext,
  ): unknown {
    const security = { ...DEFAULT_EXPRESSION_SECURITY, ...context.security }

    // First validate syntax
    const validation = this.validateExpressionSyntax(expression)
    if (!validation.isValid) {
      throw new Error(
        `Expression validation failed: ${validation.errors.join(', ')}`,
      )
    }

    const match = expression.match(this.EXPRESSION_PATTERN)!
    const innerExpression = match[1]?.trim() || ''

    // Parse default value
    const defaultMatch = innerExpression.match(this.DEFAULT_OPERATOR_PATTERN)
    const pathExpression = defaultMatch
      ? defaultMatch[1]?.trim() || ''
      : innerExpression
    const defaultValue =
      defaultMatch && defaultMatch[2]
        ? this.parseDefaultValue(defaultMatch[2].trim())
        : undefined

    try {
      // Resolve the path expression
      const result = this.resolvePathExpression(
        pathExpression,
        context,
        security,
      )

      // Check size limits
      this.validateResultSize(result, security)

      // If we got a result, return it
      if (result !== undefined && result !== null) {
        return result
      }

      // If we have a default value, use it
      if (defaultValue !== undefined) {
        return defaultValue
      }

      // No result and no default - throw error
      throw new Error(`Unable to resolve expression: ${pathExpression}`)
    } catch (error) {
      // If resolution fails and we have a default, return it
      if (defaultValue !== undefined) {
        return defaultValue
      }
      throw error
    }
  }

  /**
   * Resolve a path expression like "steps.step1.output.data"
   */
  private static resolvePathExpression(
    pathExpression: string,
    context: ExpressionContext,
    security: ExpressionSecurityConfig,
  ): unknown {
    const pathParts = pathExpression.split('.')
    if (pathParts.length < 2) {
      throw new Error(`Invalid path expression: ${pathExpression}`)
    }

    const [rootKey, ...restPath] = pathParts
    let rootValue: unknown

    // Get the root value based on the type
    switch (rootKey) {
      case 'steps':
        if (restPath.length < 3 || restPath[1] !== 'output') {
          throw new Error(
            `Step references must be in format steps.<stepId>.output.<path>`,
          )
        }
        {
          const stepId = restPath[0]
          if (!stepId) {
            throw new Error('Step ID is required in step reference')
          }
          const stepResult = context.steps[stepId]
          if (!stepResult) {
            throw new Error(`Step '${stepId}' not found or not completed`)
          }
          rootValue = stepResult.output
          // Skip 'output' and continue with remaining path
          return this.traversePath(rootValue, restPath.slice(2), security, 0)
        }

      case 'variables':
        rootValue = context.variables
        break

      case 'env':
        if (!security.allowEnvAccess) {
          throw new Error('Environment variable access is disabled')
        }
        // Check if we need to enforce env var whitelist
        if (restPath.length > 0) {
          const envVarName = restPath[0]
          if (envVarName) {
            // Get the allowed env vars list
            const allowedList =
              security.allowedEnvVars ?? context.workflowConfig?.allowedEnvVars

            // If a whitelist is specified, enforce it
            if (allowedList && !allowedList.includes(envVarName)) {
              throw new Error(
                `Environment variable '${envVarName}' is not in the allowed list`,
              )
            }
          }
        }
        rootValue = context.env
        break

      default:
        throw new Error(`Unknown root key: ${rootKey}`)
    }

    return this.traversePath(rootValue, restPath, security, 0)
  }

  /**
   * Safely traverse a nested object path with security limits
   */
  private static traversePath(
    obj: unknown,
    path: string[],
    security: ExpressionSecurityConfig,
    currentDepth: number,
  ): unknown {
    if (currentDepth >= security.maxExpansionDepth) {
      throw new Error(
        `Maximum expansion depth (${security.maxExpansionDepth}) exceeded`,
      )
    }

    if (path.length === 0) {
      return obj
    }

    if (obj === null || obj === undefined) {
      return undefined
    }

    if (typeof obj !== 'object') {
      // Return undefined instead of throwing for missing paths
      return undefined
    }

    const [currentKey, ...remainingPath] = path
    if (!currentKey) {
      return obj
    }

    let nextValue: unknown

    // Handle array access with brackets [0], [key], etc.
    if (currentKey.includes('[') && currentKey.includes(']')) {
      const bracketMatch = currentKey.match(/^([^[]+)\[([^\]]+)\]$/)
      if (bracketMatch) {
        const [, baseKey, indexOrKey] = bracketMatch
        if (!baseKey || !indexOrKey) {
          throw new Error(`Invalid array access syntax: ${currentKey}`)
        }
        const baseValue = (obj as Record<string, unknown>)[baseKey]

        if (Array.isArray(baseValue)) {
          const index = parseInt(indexOrKey, 10)
          if (isNaN(index) || index < 0 || index >= baseValue.length) {
            return undefined
          }
          nextValue = baseValue[index]
        } else if (baseValue && typeof baseValue === 'object') {
          // Remove quotes from string keys
          const key = indexOrKey.replace(/^["']|["']$/g, '')
          nextValue = (baseValue as Record<string, unknown>)[key]
        } else {
          return undefined
        }
      } else {
        throw new Error(`Invalid array/object access syntax: ${currentKey}`)
      }
    } else {
      // Simple property access
      nextValue = (obj as Record<string, unknown>)[currentKey]
    }

    return this.traversePath(
      nextValue,
      remainingPath,
      security,
      currentDepth + 1,
    )
  }

  /**
   * Validate that a resolved result doesn't exceed size limits
   */
  private static validateResultSize(
    result: unknown,
    security: ExpressionSecurityConfig,
  ): void {
    if (result === undefined || result === null) {
      return
    }

    // Estimate size by JSON stringifying
    const serialized = JSON.stringify(result)
    const sizeInBytes = Buffer.byteLength(serialized, 'utf8')

    if (sizeInBytes > security.maxExpansionSize) {
      throw new Error(
        `Expression result size (${sizeInBytes} bytes) exceeds maximum allowed size (${security.maxExpansionSize} bytes)`,
      )
    }
  }

  /**
   * Validate a path expression format
   */
  private static validatePathExpression(pathExpression: string): boolean {
    // Basic format check
    if (!pathExpression.includes('.')) {
      return false
    }

    // Check against allowed patterns
    const patterns = [
      /^steps\.[a-zA-Z0-9_-]+\.output(\.[a-zA-Z0-9_.[\]]+)?$/,
      /^variables\.[a-zA-Z0-9_.[\]]+$/,
      /^env\.[a-zA-Z0-9_]+$/,
    ]

    return patterns.some((pattern) => pattern.test(pathExpression))
  }

  /**
   * Validate default value syntax
   */
  private static validateDefaultValue(
    defaultValue: string,
  ): ExpressionValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for nested expressions (not supported)
    if (defaultValue.includes('${')) {
      errors.push('Nested expressions are not supported in default values')
    }

    // Check for potentially dangerous values
    if (
      defaultValue.includes('__proto__') ||
      defaultValue.includes('prototype')
    ) {
      errors.push(
        'Prototype pollution attempts are not allowed in default values',
      )
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  /**
   * Parse a default value string to appropriate type
   */
  private static parseDefaultValue(defaultValue: string): unknown {
    const trimmed = defaultValue.trim()

    // Handle quoted strings
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1)
    }

    // Handle booleans
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false

    // Handle null
    if (trimmed === 'null') return null

    // Handle numbers
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return trimmed.includes('.') ? parseFloat(trimmed) : parseInt(trimmed, 10)
    }

    // Handle arrays and objects (basic JSON parsing)
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed)
      } catch {
        // If JSON parsing fails, treat as string literal
        return trimmed
      }
    }

    // Default to string
    return trimmed
  }

  /**
   * Extract all expressions from an input mapping object
   */
  static extractExpressions(mapping: Record<string, unknown>): string[] {
    const expressions: string[] = []

    const traverse = (obj: unknown): void => {
      if (typeof obj === 'string' && this.EXPRESSION_PATTERN.test(obj)) {
        expressions.push(obj)
      } else if (Array.isArray(obj)) {
        obj.forEach(traverse)
      } else if (obj && typeof obj === 'object') {
        Object.values(obj as Record<string, unknown>).forEach(traverse)
      }
    }

    traverse(mapping)
    return expressions
  }

  /**
   * Validate all expressions in an input mapping
   */
  static validateInputMapping(
    mapping: Record<string, unknown>,
  ): ExpressionValidationResult {
    const expressions = this.extractExpressions(mapping)
    const allErrors: string[] = []
    const allWarnings: string[] = []

    for (const expression of expressions) {
      const result = this.validateExpressionSyntax(expression)
      allErrors.push(
        ...result.errors.map((err) => `Expression '${expression}': ${err}`),
      )
      allWarnings.push(
        ...result.warnings.map((warn) => `Expression '${expression}': ${warn}`),
      )
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    }
  }
}
