/**
 * Workflow AST types for orchestration engine
 * Defines the structure for sequential and parallel execution patterns
 */

import type { ExecutionError } from './errors.js'

/**
 * Base step configuration shared by all step types
 */
export interface BaseStep {
  /**
   * Unique identifier for the step
   */
  id: string

  /**
   * Human-readable name for the step
   */
  name?: string

  /**
   * Description of what this step does
   */
  description?: string

  /**
   * JMESPath condition for step execution
   * Step runs if condition evaluates to truthy
   */
  if?: string

  /**
   * JMESPath condition for skipping step execution
   * Step is skipped if condition evaluates to truthy
   */
  unless?: string

  /**
   * Error handling policy for this step
   */
  onError?: 'fail' | 'continue' | 'retry' | 'fallback'

  /**
   * Fallback step ID to execute on error
   */
  fallbackStepId?: string

  /**
   * Maximum retry attempts for retryable errors
   */
  maxRetries?: number

  /**
   * Timeout in milliseconds for step execution
   */
  timeout?: number

  /**
   * Dependencies - step IDs that must complete before this step
   */
  dependsOn?: string[]
}

/**
 * Agent execution step
 */
export interface AgentStep extends BaseStep {
  type: 'agent'

  /**
   * Agent identifier to execute
   */
  agentId: string

  /**
   * Configuration to pass to the agent
   */
  config?: Record<string, unknown>

  /**
   * Input mapping using ${steps.*.output} or ${variables.*} patterns
   */
  input?: Record<string, unknown>
}

/**
 * Sequential execution group
 */
export interface SequentialStep extends BaseStep {
  type: 'sequential'

  /**
   * Steps to execute in order
   */
  steps: WorkflowStep[]
}

/**
 * Parallel execution group
 */
export interface ParallelStep extends BaseStep {
  type: 'parallel'

  /**
   * Steps to execute concurrently
   */
  steps: WorkflowStep[]

  /**
   * Maximum concurrent executions (default: unlimited)
   */
  maxConcurrency?: number
}

/**
 * Union type for all workflow step types
 */
export type WorkflowStep = AgentStep | SequentialStep | ParallelStep

/**
 * Complete workflow definition
 */
export interface Workflow {
  /**
   * Workflow identifier
   */
  id: string

  /**
   * Workflow version
   */
  version: string

  /**
   * Human-readable workflow name
   */
  name: string

  /**
   * Workflow description
   */
  description?: string

  /**
   * Schema hash for validation
   */
  schemaHash?: string

  /**
   * Global variables available to all steps
   */
  variables?: Record<string, unknown>

  /**
   * Environment variable whitelist
   */
  allowedEnvVars?: string[]

  /**
   * Root execution steps
   */
  steps: WorkflowStep[]

  /**
   * Global timeout for entire workflow
   */
  timeout?: number

  /**
   * Global concurrency limit
   */
  maxConcurrency?: number

  /**
   * Global resilience policies
   */
  resilience?: {
    retry?: {
      maxAttempts?: number
      backoffStrategy?: 'fixed' | 'exponential'
      jitterStrategy?: 'none' | 'full-jitter'
      initialDelay?: number
      maxDelay?: number
    }
    circuitBreaker?: {
      failureThreshold?: number
      recoveryTime?: number
      sampleSize?: number
      halfOpenPolicy?: 'single-probe' | 'gradual'
    }
  }
}

/**
 * Execution context passed between steps
 */
export interface ExecutionContext {
  /**
   * Unique execution ID
   */
  executionId: string

  /**
   * Workflow being executed
   */
  workflow: Workflow

  /**
   * Current variables state
   */
  variables: Record<string, unknown>

  /**
   * Results from completed steps
   */
  steps: Record<string, StepResult>

  /**
   * Abort signal for cancellation
   */
  signal?: globalThis.AbortSignal
}

/**
 * Result from a completed step
 */
export interface StepResult {
  /**
   * Step ID
   */
  stepId: string

  /**
   * Execution status
   */
  status: 'completed' | 'failed' | 'skipped' | 'cancelled'

  /**
   * Step output data
   */
  output?: unknown

  /**
   * Error if step failed
   */
  error?: ExecutionError

  /**
   * Start timestamp
   */
  startTime: string

  /**
   * End timestamp
   */
  endTime: string

  /**
   * Number of retry attempts
   */
  attempts?: number

  /**
   * Whether output was truncated
   */
  truncated?: boolean

  /**
   * Original size if truncated
   */
  originalSize?: number

  /**
   * Retained bytes after truncation
   */
  retainedBytes?: number
}

/**
 * Final workflow execution result
 */
export interface WorkflowResult {
  /**
   * Unique execution ID
   */
  executionId: string

  /**
   * Overall execution status
   */
  status: 'completed' | 'failed' | 'cancelled'

  /**
   * All step results
   */
  steps: Record<string, StepResult>

  /**
   * Final variables state
   */
  variables: Record<string, unknown>

  /**
   * Aggregated errors if failed
   */
  errors?: ExecutionError[]

  /**
   * Execution start time
   */
  startTime: string

  /**
   * Execution end time
   */
  endTime: string

  /**
   * Total execution duration in milliseconds
   */
  duration: number
}
