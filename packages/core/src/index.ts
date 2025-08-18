/**
 * @orchestr8/core - Core orchestration engine
 */

// Export expression evaluation
export {
  evaluateCondition,
  resolveMapping,
  clearExpressionCache,
} from './expression-evaluator.js'

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
