/**
 * Test utilities for building workflows
 */

import type {
  Workflow,
  AgentStep,
  SequentialStep,
  ParallelStep,
  WorkflowStep,
} from '@orchestr8/schema'

/**
 * Builder for creating test workflows
 */
export class WorkflowBuilder {
  private workflow: Partial<Workflow> = {
    id: 'test-workflow',
    version: '1.0.0',
    name: 'Test Workflow',
    steps: [],
  }

  /**
   * Set workflow ID
   */
  withId(id: string): this {
    this.workflow.id = id
    return this
  }

  /**
   * Set workflow name
   */
  withName(name: string): this {
    this.workflow.name = name
    return this
  }

  /**
   * Set workflow version
   */
  withVersion(version: string): this {
    this.workflow.version = version
    return this
  }

  /**
   * Set global variables
   */
  withVariables(variables: Record<string, unknown>): this {
    this.workflow.variables = variables
    return this
  }

  /**
   * Set allowed environment variables
   */
  withAllowedEnvVars(vars: string[]): this {
    this.workflow.allowedEnvVars = vars
    return this
  }

  /**
   * Set global timeout
   */
  withTimeout(timeout: number): this {
    this.workflow.timeout = timeout
    return this
  }

  /**
   * Set global concurrency limit
   */
  withMaxConcurrency(maxConcurrency: number): this {
    this.workflow.maxConcurrency = maxConcurrency
    return this
  }

  /**
   * Add an agent step
   */
  addAgentStep(
    id: string,
    agentId: string,
    options?: Partial<AgentStep>,
  ): this {
    const step: AgentStep = {
      id,
      type: 'agent',
      agentId,
      ...options,
    }
    this.workflow.steps!.push(step)
    return this
  }

  /**
   * Add a sequential group
   */
  addSequentialGroup(
    id: string,
    steps: WorkflowStep[],
    options?: Partial<SequentialStep>,
  ): this {
    const step: SequentialStep = {
      id,
      type: 'sequential',
      steps,
      ...options,
    }
    this.workflow.steps!.push(step)
    return this
  }

  /**
   * Add a parallel group
   */
  addParallelGroup(
    id: string,
    steps: WorkflowStep[],
    options?: Partial<ParallelStep>,
  ): this {
    const step: ParallelStep = {
      id,
      type: 'parallel',
      steps,
      ...options,
    }
    this.workflow.steps!.push(step)
    return this
  }

  /**
   * Build the workflow
   */
  build(): Workflow {
    return this.workflow as Workflow
  }
}

/**
 * Create a simple agent step
 */
export function createAgentStep(
  id: string,
  agentId: string,
  options?: Partial<AgentStep>,
): AgentStep {
  return {
    id,
    type: 'agent',
    agentId,
    ...options,
  }
}

/**
 * Create a sequential workflow with agent steps
 */
export function createSequentialWorkflow(stepCount: number = 3): Workflow {
  const builder = new WorkflowBuilder()
    .withId('sequential-test')
    .withName('Sequential Test Workflow')

  for (let i = 1; i <= stepCount; i++) {
    builder.addAgentStep(`step-${i}`, `agent-${i}`)
  }

  return builder.build()
}

/**
 * Create a parallel workflow with agent steps
 */
export function createParallelWorkflow(stepCount: number = 3): Workflow {
  const steps: AgentStep[] = []

  for (let i = 1; i <= stepCount; i++) {
    steps.push(createAgentStep(`step-${i}`, `agent-${i}`))
  }

  return new WorkflowBuilder()
    .withId('parallel-test')
    .withName('Parallel Test Workflow')
    .addParallelGroup('parallel-group', steps)
    .build()
}

/**
 * Create a workflow with dependencies
 */
export function createWorkflowWithDependencies(): Workflow {
  return new WorkflowBuilder()
    .withId('dependency-test')
    .withName('Dependency Test Workflow')
    .addAgentStep('step-1', 'agent-1')
    .addAgentStep('step-2', 'agent-2', { dependsOn: ['step-1'] })
    .addAgentStep('step-3', 'agent-3', { dependsOn: ['step-1'] })
    .addAgentStep('step-4', 'agent-4', { dependsOn: ['step-2', 'step-3'] })
    .build()
}

/**
 * Create a complex hybrid workflow
 */
export function createHybridWorkflow(): Workflow {
  const parallelSteps = [
    createAgentStep('parallel-1', 'agent-p1'),
    createAgentStep('parallel-2', 'agent-p2'),
  ]

  const sequentialSteps = [
    createAgentStep('seq-1', 'agent-s1'),
    createAgentStep('seq-2', 'agent-s2'),
  ]

  return new WorkflowBuilder()
    .withId('hybrid-test')
    .withName('Hybrid Test Workflow')
    .addAgentStep('start', 'agent-start')
    .addParallelGroup('parallel-group', parallelSteps, {
      dependsOn: ['start'],
    })
    .addSequentialGroup('sequential-group', sequentialSteps, {
      dependsOn: ['parallel-group'],
    })
    .addAgentStep('end', 'agent-end', {
      dependsOn: ['sequential-group'],
    })
    .build()
}
