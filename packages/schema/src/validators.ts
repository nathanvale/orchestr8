/**
 * Workflow schema validation and hash computation
 * Enhanced with Zod validation for comprehensive type checking
 */

import type { Workflow } from './workflow.js'

import { WorkflowSchemaValidator, type WorkflowZod } from './zod-schemas.js'

/**
 * Compute a hash of the workflow schema structure
 * This is a constant hash for a given schema version, NOT unique per workflow
 * @deprecated Use WorkflowSchemaValidator.calculateSchemaHash() instead
 * @returns The current schema version hash
 */
export function computeWorkflowSchemaHash(): string {
  return WorkflowSchemaValidator.calculateSchemaHash()
}

/**
 * Validate that a workflow conforms to the expected schema using Zod
 * @param workflow The workflow to validate
 * @returns The validated workflow with proper typing
 * @throws Error if validation fails with detailed error messages
 */
export function validateWorkflow(workflow: unknown): Workflow {
  // First validate with Zod for comprehensive type checking
  const validatedWorkflow = WorkflowSchemaValidator.validateWorkflow(workflow)

  // Additional domain-specific validations that Zod can't handle
  validateStepReferences(validatedWorkflow)
  checkCircularDependencies(validatedWorkflow.steps)

  // Convert back to the existing Workflow type for backward compatibility
  return validatedWorkflow as Workflow
}

/**
 * Check if a workflow is valid without throwing
 * @param workflow The workflow to check
 * @returns True if valid, false otherwise
 */
export function isValidWorkflow(workflow: unknown): workflow is Workflow {
  try {
    validateWorkflow(workflow)
    return true
  } catch {
    return false
  }
}

/**
 * Validate step references and cross-references in a Zod-validated workflow
 * This handles validations that require understanding relationships between steps
 */
function validateStepReferences(workflow: WorkflowZod): void {
  const stepIds = new Set<string>()

  // Check for duplicate step IDs (though Zod should catch basic structure issues)
  for (const step of workflow.steps) {
    if (stepIds.has(step.id)) {
      throw new Error(`Duplicate step ID: ${step.id}`)
    }
    stepIds.add(step.id)
  }

  // Validate dependency references and fallback references
  for (const step of workflow.steps) {
    // Check that all dependencies reference existing steps
    if (step.dependsOn) {
      for (const depId of step.dependsOn) {
        if (!stepIds.has(depId)) {
          throw new Error(
            `Step ${step.id} depends on non-existent step: ${depId}`,
          )
        }
      }
    }

    // Check that fallback references point to existing steps
    if (step.onError === 'fallback' && step.fallbackStepId) {
      if (!stepIds.has(step.fallbackStepId)) {
        throw new Error(
          `Step ${step.id} fallback references non-existent step: ${step.fallbackStepId}`,
        )
      }
    }

    // Check that steps don't depend on themselves
    if (step.dependsOn?.includes(step.id)) {
      throw new Error(`Step ${step.id} cannot depend on itself`)
    }
  }
}

/**
 * Check for circular dependencies in workflow steps using depth-first search
 */
function checkCircularDependencies(
  steps: Array<{ id: string; dependsOn?: string[] }>,
): void {
  const graph = buildDependencyGraph(steps)
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function hasCycle(nodeId: string, path: string[] = []): boolean {
    visited.add(nodeId)
    recursionStack.add(nodeId)
    path.push(nodeId)

    const dependencies = graph.get(nodeId) || []
    for (const dep of dependencies) {
      if (!visited.has(dep)) {
        if (hasCycle(dep, [...path])) {
          return true
        }
      } else if (recursionStack.has(dep)) {
        // Found a cycle - provide detailed error message
        const cycleStart = path.indexOf(dep)
        const cyclePath = [...path.slice(cycleStart), dep].join(' → ')
        throw new Error(`Circular dependency detected: ${cyclePath}`)
      }
    }

    recursionStack.delete(nodeId)
    return false
  }

  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      hasCycle(nodeId)
    }
  }
}

/**
 * Build a dependency graph from workflow steps
 */
function buildDependencyGraph(
  steps: Array<{ id: string; dependsOn?: string[] }>,
): Map<string, string[]> {
  const graph = new Map<string, string[]>()

  for (const step of steps) {
    // Every step gets an entry, even if it has no dependencies
    graph.set(step.id, step.dependsOn || [])
  }

  return graph
}
