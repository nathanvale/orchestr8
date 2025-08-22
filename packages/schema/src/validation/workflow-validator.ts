/**
 * Workflow-specific validation utilities
 * Provides specialized validation for workflow schemas with enhanced error messages
 */

import {
  AgentDefinitionSchema,
  type AgentDefinition,
} from '../agent/agent-schema.js'
import { WorkflowSchema, type Workflow } from '../workflow/workflow-schema.js'
import {
  SchemaValidator,
  ValidationError,
  type ValidationResult,
} from './validator.js'

/**
 * Workflow validator with specialized error handling
 */
export class WorkflowValidator extends SchemaValidator<typeof WorkflowSchema> {
  constructor() {
    super(WorkflowSchema, { cacheEnabled: true, maxCacheSize: 50 })
  }

  /**
   * Validate a workflow with enhanced error messages
   */
  validateWorkflow(data: unknown): ValidationResult<Workflow> {
    const result = this.validate(data)

    // Add workflow-specific context to errors
    if (!result.valid && result.errors) {
      result.errors = result.errors.map((error) => {
        // Add workflow-specific hints
        if (error.path === 'schemaHash') {
          error.message +=
            '. This should be a SHA-256 hash of the workflow schema definition.'
        }
        if (error.path.includes('steps') && error.path.includes('agent.id')) {
          error.message +=
            '. Agent IDs must be in the format @scope/name (e.g., @orchestr8/http-agent).'
        }
        if (error.path.includes('input.mapping')) {
          error.message +=
            '. Use expressions like ${steps.stepId.output.field}, ${variables.name}, or ${env.VAR_NAME}.'
        }
        if (error.path.includes('policies.retry.maxAttempts')) {
          error.message +=
            '. Consider starting with 3 attempts for most use cases.'
        }
        if (error.path.includes('policies.circuitBreaker.failureThreshold')) {
          error.message +=
            '. A threshold of 5 failures is typically a good starting point.'
        }
        return error
      })
    }

    return result
  }

  /**
   * Validate workflow and provide suggestions for fixes
   */
  validateWithSuggestions(
    data: unknown,
  ): ValidationResult<Workflow> & { suggestions?: string[] } {
    const result = this.validateWorkflow(data) as ValidationResult<Workflow> & {
      suggestions?: string[]
    }

    if (!result.valid) {
      const suggestions: string[] = []

      // Analyze errors and provide suggestions
      if (result.errors) {
        for (const error of result.errors) {
          if (error.code === 'invalid_type' && error.path === 'steps') {
            suggestions.push(
              'Ensure steps is an array containing at least one step definition.',
            )
          }
          if (error.path.includes('schemaVersion')) {
            suggestions.push(
              'Consider using schemaVersion: "1.0.0" to indicate the workflow schema version.',
            )
          }
          if (
            error.path.includes('metadata.id') &&
            error.code === 'invalid_string'
          ) {
            suggestions.push(
              'Generate a UUID v4 for the workflow ID using a UUID generator.',
            )
          }
          if (error.path.includes('dependencies')) {
            suggestions.push(
              'Check that all step dependencies reference existing step IDs.',
            )
          }
          if (error.path.includes('onError')) {
            suggestions.push(
              'Common error strategies: "fail" (default), "continue" (skip errors), "retry" (with policy), "fallback" (use alternate step).',
            )
          }
          if (
            error.code === 'invalid_enum_value' &&
            error.path.includes('onError')
          ) {
            suggestions.push(
              'Error handling must be one of: fail, continue, retry, or fallback.',
            )
          }
        }
      }

      // Remove duplicate suggestions
      result.suggestions = [...new Set(suggestions)]
    }

    return result
  }

  /**
   * Validate workflow structure without strict type checking
   * Useful for draft workflows or partial updates
   */
  validateStructure(data: unknown): { valid: boolean; issues: string[] } {
    const issues: string[] = []

    if (typeof data !== 'object' || data === null) {
      issues.push('Workflow must be an object')
      return { valid: false, issues }
    }

    const workflow = data as Record<string, unknown>

    // Check required top-level fields
    if (!workflow.metadata) {
      issues.push('Missing required field: metadata')
    } else {
      const metadata = workflow.metadata as Record<string, unknown>
      if (!metadata.id) issues.push('Missing required field: metadata.id')
      if (!metadata.name) issues.push('Missing required field: metadata.name')
    }

    if (!workflow.steps || !Array.isArray(workflow.steps)) {
      issues.push('Missing or invalid field: steps (must be an array)')
    } else if (workflow.steps.length === 0) {
      issues.push('Workflow must have at least one step')
    } else {
      // Check step structure
      workflow.steps.forEach((step: unknown, index: number) => {
        const stepObj = step as Record<string, unknown>
        if (!stepObj.id)
          issues.push(`Step ${index}: missing required field 'id'`)
        if (!stepObj.name)
          issues.push(`Step ${index}: missing required field 'name'`)
        if (!stepObj.agent)
          issues.push(`Step ${index}: missing required field 'agent'`)
        else {
          const agent = stepObj.agent as Record<string, unknown>
          if (!agent.id)
            issues.push(`Step ${index}: missing required field 'agent.id'`)
        }

        // Check for circular dependencies
        if (stepObj.dependencies && Array.isArray(stepObj.dependencies)) {
          const dependencies = stepObj.dependencies as unknown[]
          if (dependencies.includes(stepObj.id)) {
            issues.push(`Step ${stepObj.id}: cannot depend on itself`)
          }
        }
      })

      // Check for duplicate step IDs
      const stepIds = workflow.steps
        .map((s: unknown) => {
          const step = s as Record<string, unknown>
          return step.id
        })
        .filter(Boolean)
      const duplicates = stepIds.filter(
        (id: unknown, index: number) => stepIds.indexOf(id) !== index,
      )
      if (duplicates.length > 0) {
        issues.push(`Duplicate step IDs found: ${duplicates.join(', ')}`)
      }
    }

    return { valid: issues.length === 0, issues }
  }

  /**
   * Get a summary of validation errors grouped by category
   */
  getErrorSummary(data: unknown): string | null {
    const result = this.validate(data)
    if (result.valid) return null

    const errorsByCategory: Record<string, string[]> = {
      metadata: [],
      steps: [],
      policies: [],
      context: [],
      other: [],
    }

    if (result.errors) {
      for (const error of result.errors) {
        const category = this.categorizeError(error.path)
        const message = `${error.path}: ${error.message}`
        if (errorsByCategory[category]) {
          errorsByCategory[category].push(message)
        }
      }
    }

    // Build summary
    const summary: string[] = ['Workflow validation failed:']

    for (const [category, errors] of Object.entries(errorsByCategory)) {
      if (errors.length > 0) {
        summary.push(
          `\n${category.charAt(0).toUpperCase() + category.slice(1)} Issues:`,
        )
        errors.forEach((err) => summary.push(`  • ${err}`))
      }
    }

    return summary.join('\n')
  }

  /**
   * Categorize error by path
   */
  private categorizeError(path: string): string {
    if (path.startsWith('metadata')) return 'metadata'
    if (path.startsWith('steps')) return 'steps'
    if (path.startsWith('policies')) return 'policies'
    if (path.startsWith('context')) return 'context'
    return 'other'
  }
}

/**
 * Agent validator with specialized error handling
 */
export class AgentValidator extends SchemaValidator<
  typeof AgentDefinitionSchema
> {
  constructor() {
    super(AgentDefinitionSchema, { cacheEnabled: true, maxCacheSize: 50 })
  }

  /**
   * Validate an agent definition with enhanced error messages
   */
  validateAgent(data: unknown): ValidationResult<AgentDefinition> {
    const result = this.validate(data)

    // Add agent-specific context to errors
    if (!result.valid && result.errors) {
      result.errors = result.errors.map((error) => {
        if (error.path === 'metadata.id') {
          error.message += '. Agent IDs should follow the format @scope/name.'
        }
        if (error.path.includes('input') && error.path.includes('type')) {
          error.message += '. Use JSON Schema format to define input structure.'
        }
        if (error.path.includes('output') && error.path.includes('type')) {
          error.message +=
            '. Use JSON Schema format to define output structure.'
        }
        return error
      })
    }

    return result
  }
}

// Export singleton instances
export const workflowValidator = new WorkflowValidator()
export const agentValidator = new AgentValidator()

// Export convenience functions
export function validateWorkflow(data: unknown): ValidationResult<Workflow> {
  return workflowValidator.validateWorkflow(data)
}

export function validateAgent(
  data: unknown,
): ValidationResult<AgentDefinition> {
  return agentValidator.validateAgent(data)
}

/**
 * Validate and throw with formatted error message
 */
export function validateWorkflowOrThrow(data: unknown): Workflow {
  const result = workflowValidator.validateWorkflow(data)
  if (!result.valid) {
    const summary = workflowValidator.getErrorSummary(data)
    throw new ValidationError(
      summary || 'Workflow validation failed',
      result.errors!,
    )
  }
  return result.data!
}

/**
 * Validate and throw with formatted error message
 */
export function validateAgentOrThrow(data: unknown): AgentDefinition {
  const result = agentValidator.validateAgent(data)
  if (!result.valid) {
    throw new ValidationError('Agent validation failed', result.errors!)
  }
  return result.data!
}
