/**
 * @orchestr8/core - Core orchestration engine
 */

// Export expression evaluation
export {
  evaluateCondition,
  resolveMapping,
  clearExpressionCache,
} from './expression-evaluator.js'

// Export logger implementations
export { NoOpLogger, MemoryLogger } from './logger.js'

// Export implementation
export { OrchestrationEngine } from './orchestration-engine.js'

// Export core types and interfaces
export type {
  Agent,
  AgentRegistry,
  ResiliencePolicy,
  ResilienceAdapter,
  ExecutionNode,
  ExecutionGraph,
  OrchestrationOptions,
  OrchestrationEngine as IOrchestrationEngine,
  Logger,
  LogLevel,
  LogEntry,
} from './types.js'

// Re-export commonly used schema types
export {
  ExecutionErrorCode,
  createExecutionError,
  isExecutionError,
  type ExecutionError,
  type Workflow,
  type WorkflowResult,
  type StepResult,
  type ExecutionContext,
} from '@orchestr8/schema'
