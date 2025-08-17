import { z } from 'zod'
import { WorkflowSchema, type Workflow } from './types.js'

export class WorkflowAST {
  private workflow: Workflow

  constructor(workflow: unknown) {
    this.workflow = WorkflowSchema.parse(workflow)
  }

  validate(): boolean {
    // Validate step dependencies exist
    const stepIds = new Set(this.workflow.steps.map((s) => s.id))

    for (const step of this.workflow.steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            throw new Error(
              `Step "${step.id}" depends on non-existent step "${dep}"`,
            )
          }
        }
      }
    }

    // Check for circular dependencies
    this.checkCircularDependencies()

    return true
  }

  private checkCircularDependencies(): void {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const hasCycle = (stepId: string): boolean => {
      visited.add(stepId)
      recursionStack.add(stepId)

      const step = this.workflow.steps.find((s) => s.id === stepId)
      if (step?.dependencies) {
        for (const dep of step.dependencies) {
          if (!visited.has(dep)) {
            if (hasCycle(dep)) return true
          } else if (recursionStack.has(dep)) {
            return true
          }
        }
      }

      recursionStack.delete(stepId)
      return false
    }

    for (const step of this.workflow.steps) {
      if (!visited.has(step.id)) {
        if (hasCycle(step.id)) {
          throw new Error('Circular dependency detected in workflow')
        }
      }
    }
  }

  getTopologicalOrder(): string[] {
    const order: string[] = []
    const visited = new Set<string>()

    const visit = (stepId: string): void => {
      if (visited.has(stepId)) return
      visited.add(stepId)

      const step = this.workflow.steps.find((s) => s.id === stepId)
      if (step?.dependencies) {
        for (const dep of step.dependencies) {
          visit(dep)
        }
      }

      order.push(stepId)
    }

    for (const step of this.workflow.steps) {
      visit(step.id)
    }

    return order
  }

  getWorkflow(): Workflow {
    return this.workflow
  }
}
