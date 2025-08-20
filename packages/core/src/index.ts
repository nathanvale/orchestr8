/**
 * @orchestr8/core - Core orchestration engine
 */

// Export event bus implementation and types
export { BoundedEventBus } from './event-bus.js'
export type {
  EventBusConfig,
  EventBusMetrics,
  OrchestrationEvent,
  WorkflowEvent,
  ExecutionEvent,
  StepEvent,
  ResilienceEvent,
} from './event-bus.js'
// Export journal implementation and types
export { ExecutionJournal } from './execution-journal.js'
export type { JournalEntry } from './execution-journal.js'
export {
  evaluateCondition,
  resolveMapping,
  clearExpressionCache,
} from './expression-evaluator.js'

export { OrchestrationEngine } from './orchestration-engine.js'

// Export core types and interfaces
export type {
  Agent,
  AgentRegistry,
  ResiliencePolicy,
  ResilienceAdapter,
  CompositionOrder,
  ExecutionNode,
  ExecutionGraph,
  OrchestrationOptions,
  OrchestrationEngine as IOrchestrationEngine,
  Logger,
  LogLevel,
} from './types.js'

// Re-export logger types from @orchestr8/logger for convenience
export type { LogEntry } from '@orchestr8/logger'

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
