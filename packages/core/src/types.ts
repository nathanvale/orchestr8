/**
 * Core type definitions for the orchestration engine
 */

import type {
  ResiliencePolicy,
  ResilienceAdapter,
  CompositionOrder,
  AgentRegistry,
  Workflow,
  WorkflowResult,
} from '@orchestr8/schema'

// Re-export agent types from schema for convenience
export type { Agent, AgentRegistry } from '@orchestr8/schema'

// Re-export resilience types from schema for convenience
export type {
  ResiliencePolicy,
  ResilienceAdapter,
  CompositionOrder,
} from '@orchestr8/schema'

/**
 * Log level enumeration
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

/**
 * Log entry structure for structured logging
 */
export interface LogEntry {
  /**
   * Log level
   */
  level: LogLevel

  /**
   * Log message
   */
  message: string

  /**
   * Timestamp in ISO format
   */
  timestamp: string

  /**
   * Additional structured data
   */
  [key: string]: unknown
}

/**
 * Logger interface for structured logging throughout the orchestration engine
 */
export interface Logger {
  /**
   * Log an entry with the specified level
   * @param level The log level
   * @param message The log message
   * @param data Additional structured data
   */
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void

  /**
   * Log a trace entry
   * @param message The log message
   * @param data Additional structured data
   */
  trace(message: string, data?: Record<string, unknown>): void

  /**
   * Log a debug entry
   * @param message The log message
   * @param data Additional structured data
   */
  debug(message: string, data?: Record<string, unknown>): void

  /**
   * Log an info entry
   * @param message The log message
   * @param data Additional structured data
   */
  info(message: string, data?: Record<string, unknown>): void

  /**
   * Log a warning entry
   * @param message The log message
   * @param data Additional structured data
   */
  warn(message: string, data?: Record<string, unknown>): void

  /**
   * Log an error entry
   * @param message The log message
   * @param data Additional structured data
   */
  error(message: string, data?: Record<string, unknown>): void

  /**
   * Create a child logger with additional context
   * @param context Additional context to include in all logs
   * @returns A new logger with the added context
   */
  child(context: Record<string, unknown>): Logger
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
   * Optional logger for structured logging
   * If not provided, a no-op logger will be used
   */
  logger?: Logger

  /**
   * Default composition order for resilience patterns
   * Defaults to 'retry-cb-timeout' (retry wraps circuitBreaker wraps timeout)
   */
  defaultCompositionOrder?: CompositionOrder

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

  /**
   * Strict mode for condition evaluation
   * When true, invalid conditions throw validation errors instead of silently returning false
   */
  strictConditions?: boolean
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
