/**
 * Workflow schema validation and hash computation
 */

import { createHash } from 'node:crypto'

import type { Workflow, WorkflowStep } from './workflow.js'

/**
 * Compute a hash of the workflow schema structure
 * This is a constant hash for a given schema version, NOT unique per workflow
 *
 * @returns The current schema version hash
 */
export function computeWorkflowSchemaHash(): string {
  // This represents the structure/version of the workflow schema itself
  // It should be updated when the schema structure changes
  const schemaVersion = '1.0.0'
  const schemaStructure = {
    version: schemaVersion,
    fields: [
      'id',
      'version',
      'name',
      'description',
      'schemaHash',
      'variables',
      'allowedEnvVars',
      'steps',
      'timeout',
      'maxConcurrency',
      'resilience',
    ],
    stepTypes: ['agent', 'sequential', 'parallel'],
    errorCodes: [
      'TIMEOUT',
      'CIRCUIT_OPEN',
      'CANCELLED',
      'VALIDATION',
      'RETRYABLE',
      'UNKNOWN',
    ],
  }

  const hash = createHash('sha256')
  hash.update(JSON.stringify(schemaStructure))
  return hash.digest('hex').substring(0, 16) // Use first 16 chars for brevity
}

/**
 * Validate that a workflow conforms to the expected schema
 * @param workflow The workflow to validate
 * @returns True if valid, throws error if invalid
 */
export function validateWorkflow(workflow: Workflow): boolean {
  // Basic structure validation
  if (!workflow.id || typeof workflow.id !== 'string') {
    throw new Error('Workflow must have a valid id')
  }

  if (!workflow.version || typeof workflow.version !== 'string') {
    throw new Error('Workflow must have a valid version')
  }

  if (!workflow.name || typeof workflow.name !== 'string') {
    throw new Error('Workflow must have a valid name')
  }

  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    throw new Error('Workflow must have at least one step')
  }

  // Validate each step
  const stepIds = new Set<string>()
  validateSteps(workflow.steps, stepIds)

  // Check for circular dependencies
  checkCircularDependencies(workflow.steps)

  return true
}

/**
 * Validate workflow steps recursively
 */
function validateSteps(steps: WorkflowStep[], stepIds: Set<string>): void {
  for (const step of steps) {
    // Check for duplicate IDs
    if (stepIds.has(step.id)) {
      throw new Error(`Duplicate step ID: ${step.id}`)
    }
    stepIds.add(step.id)

    // Validate step type
    if (!['agent', 'sequential', 'parallel'].includes(step.type)) {
      throw new Error(`Invalid step type: ${step.type}`)
    }

    // Validate agent-specific fields
    if (step.type === 'agent') {
      if (!step.agentId || typeof step.agentId !== 'string') {
        throw new Error(`Agent step ${step.id} must have a valid agentId`)
      }
    }

    // MVP: Nested groups are deprecated - validate that steps property is not used
    if (step.type === 'sequential' || step.type === 'parallel') {
      // TypeScript should prevent this, but add runtime check for safety
      if ('steps' in step && step.steps !== undefined) {
        throw new Error(
          `${step.type} step ${step.id}: Nested groups are not supported in MVP. ` +
            `Use root-level steps with dependsOn relationships instead.`,
        )
      }
    }

    // Validate error handling
    if (
      step.onError &&
      !['fail', 'continue', 'retry', 'fallback'].includes(step.onError)
    ) {
      throw new Error(
        `Invalid onError policy for step ${step.id}: ${step.onError}`,
      )
    }

    // Validate fallback reference
    if (step.onError === 'fallback' && !step.fallbackStepId) {
      throw new Error(
        `Step ${step.id} has onError: 'fallback' but no fallbackStepId`,
      )
    }
  }
}

/**
 * Check for circular dependencies in workflow steps
 */
function checkCircularDependencies(steps: WorkflowStep[]): void {
  const graph = buildDependencyGraph(steps)
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId)
    recursionStack.add(nodeId)

    const dependencies = graph.get(nodeId) || []
    for (const dep of dependencies) {
      if (!visited.has(dep)) {
        if (hasCycle(dep)) {
          return true
        }
      } else if (recursionStack.has(dep)) {
        return true
      }
    }

    recursionStack.delete(nodeId)
    return false
  }

  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      if (hasCycle(nodeId)) {
        throw new Error(
          `Circular dependency detected involving step: ${nodeId}`,
        )
      }
    }
  }
}

/**
 * Build a dependency graph from workflow steps
 */
function buildDependencyGraph(steps: WorkflowStep[]): Map<string, string[]> {
  const graph = new Map<string, string[]>()

  function addStep(step: WorkflowStep): void {
    if (step.dependsOn && step.dependsOn.length > 0) {
      graph.set(step.id, step.dependsOn)
    } else {
      graph.set(step.id, [])
    }

    // MVP: Skip nested step processing for sequential/parallel - they use dependsOn instead
    // if (step.type === 'sequential' || step.type === 'parallel') {
    //   // Nested steps not supported in MVP
    // }
  }

  for (const step of steps) {
    addStep(step)
  }

  return graph
}
