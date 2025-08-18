/**
 * Core type definitions for the orchestration engine
 */

import type { ExecutionContext } from '@orchestr8/schema'
import type { Workflow, WorkflowResult } from '@orchestr8/schema'

/**
 * Agent definition for execution
 */
export interface Agent {
  /**
   * Unique agent identifier
   */
  id: string

  /**
   * Agent name
   */
  name: string

  /**
   * Agent execution function
   */
  execute: (
    input: unknown,
    context: ExecutionContext,
    signal?: AbortSignal,
  ) => Promise<unknown>
}

/**
 * Registry for agent lookup and management
 */
export interface AgentRegistry {
  /**
   * Get an agent by ID
   * @param agentId The agent identifier
   * @returns The agent if found
   * @throws ExecutionError with VALIDATION code if agent not found
   */
  getAgent(agentId: string): Promise<Agent>

  /**
   * Check if an agent exists
   * @param agentId The agent identifier
   */
  hasAgent(agentId: string): Promise<boolean>

  /**
   * Register an agent
   * @param agent The agent to register
   */
  registerAgent?(agent: Agent): Promise<void>
}

/**
 * Resilience policy configuration
 */
export interface ResiliencePolicy {
  /**
   * Retry configuration
   */
  retry?: {
    maxAttempts: number
    backoffStrategy: 'fixed' | 'exponential'
    jitterStrategy: 'none' | 'full-jitter'
    initialDelay: number
    maxDelay: number
  }

  /**
   * Circuit breaker configuration
   */
  circuitBreaker?: {
    failureThreshold: number
    recoveryTime: number
    sampleSize: number
    halfOpenPolicy: 'single-probe' | 'gradual'
  }

  /**
   * Timeout in milliseconds
   */
  timeout?: number
}

/**
 * Adapter for applying resilience patterns to operations
 */
export interface ResilienceAdapter {
  /**
   * Apply resilience policies to an operation
   * @param operation The operation to wrap
   * @param policy The resilience policy to apply
   * @param signal Abort signal for cancellation
   * @returns The wrapped operation
   */
  applyPolicy<T>(
    operation: () => Promise<T>,
    policy: ResiliencePolicy,
    signal?: AbortSignal,
  ): Promise<T>
}

/**
 * Execution graph node representing a step ready for execution
 */
export interface ExecutionNode {
  /**
   * Step ID
   */
  stepId: string

  /**
   * Step type
   */
  type: 'agent' | 'sequential' | 'parallel'

  /**
   * Agent ID for agent steps
   */
  agentId?: string

  /**
   * Nested nodes for sequential/parallel steps
   */
  children?: ExecutionNode[]

  /**
   * Dependencies that must complete before this node
   */
  dependsOn: string[]

  /**
   * Step configuration
   */
  config?: Record<string, unknown>

  /**
   * Input mapping
   */
  input?: Record<string, unknown>

  /**
   * Resilience policy for this step
   */
  resilience?: ResiliencePolicy

  /**
   * Error handling policy
   */
  onError?: 'fail' | 'continue' | 'retry' | 'fallback'

  /**
   * Fallback step ID
   */
  fallbackStepId?: string

  /**
   * JMESPath conditions
   */
  conditions?: {
    if?: string
    unless?: string
  }
}

/**
 * Execution graph representing the workflow structure
 */
export interface ExecutionGraph {
  /**
   * All nodes in the graph
   */
  nodes: Map<string, ExecutionNode>

  /**
   * Root node IDs (no dependencies)
   */
  roots: string[]

  /**
   * Topological execution levels
   */
  levels?: ExecutionNode[][]
}

/**
 * Options for the orchestration engine
 */
export interface OrchestrationOptions {
  /**
   * Agent registry for looking up agents
   */
  agentRegistry: AgentRegistry

  /**
   * Resilience adapter for applying policies
   */
  resilienceAdapter: ResilienceAdapter

  /**
   * Global concurrency limit
   */
  maxConcurrency?: number

  /**
   * Maximum result size per step in bytes
   */
  maxResultBytesPerStep?: number

  /**
   * Maximum metadata size in bytes
   */
  maxMetadataBytes?: number

  /**
   * Maximum expression expansion depth
   */
  maxExpansionDepth?: number

  /**
   * Maximum expression expansion size in bytes
   */
  maxExpansionSize?: number
}

/**
 * Main orchestration engine interface
 */
export interface OrchestrationEngine {
  /**
   * Execute a workflow
   * @param workflow The workflow to execute
   * @param variables Initial variables
   * @param signal Abort signal for cancellation
   * @returns The workflow execution result
   */
  execute(
    workflow: Workflow,
    variables?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<WorkflowResult>
}
