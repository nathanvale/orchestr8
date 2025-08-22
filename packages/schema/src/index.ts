/**
 * @orchestr8/schema - Workflow AST definitions and validation
 */

// Export agent schemas and types
export {
  // Zod schemas
  AgentInvocationSchema,
  AgentDefinitionSchema,
  AgentCapabilitySchema,
  // TypeScript types (from Zod inference)
  type AgentInvocation,
  type AgentDefinition,
  type AgentCapability,
} from './agent/agent-schema.js'

// Export agent types
export type { Agent, AgentRegistry } from './agents.js'

// Export error types
export {
  ExecutionErrorCode,
  type ExecutionError,
  createExecutionError,
  isExecutionError,
} from './errors.js'

// Export event schemas and types
export {
  // Event schemas
  WorkflowEventSchema,
  ExecutionEventSchema,
  StepEventSchema,
  ResilienceEventSchema,
  OrchestrationEventSchema,
  EnhancedJournalEntrySchema,
  JournalExportSchema,
  // Individual event schemas
  WorkflowStartedEventSchema,
  WorkflowCompletedEventSchema,
  WorkflowFailedEventSchema,
  ExecutionQueuedEventSchema,
  ExecutionStartedEventSchema,
  ExecutionCancelledEventSchema,
  StepStartedEventSchema,
  StepCompletedEventSchema,
  StepFailedEventSchema,
  RetryAttemptedEventSchema,
  CircuitBreakerOpenedEventSchema,
  TimeoutExceededEventSchema,
  // Additional schemas for JSON execution model
  StepExecutionStateSchema,
  ExecutionStateSchema,
  ExecutionJournalEntrySchema,
  // TypeScript types (from Zod inference)
  type WorkflowEvent,
  type ExecutionEvent,
  type StepEvent,
  type ResilienceEvent,
  type OrchestrationEvent as OrchestrationEventZod,
  type EnhancedJournalEntry as EnhancedJournalEntryZod,
  type JournalExport as JournalExportZod,
  type StepExecutionState as StepExecutionStateZod,
  type ExecutionState as ExecutionStateZod,
  type ExecutionJournalEntry as ExecutionJournalEntryZod,
} from './events/event-schemas.js'

// Export expression validation utilities
export {
  ExpressionValidator,
  DEFAULT_EXPRESSION_SECURITY,
  type ExpressionSecurityConfig,
  type ExpressionContext,
  type ExpressionValidationResult,
} from './expression-validator.js'

// Export JSON Schema generation utilities
export {
  generateJsonSchema,
  generateNamedSchema,
  generateAllSchemas,
  validateAgainstSchema,
  getJsonSchemaString,
  exportSchemasToDirectory,
  type JsonSchemaGenerationOptions,
  type SchemaName,
} from './generation/index.js'

// Export resilience types
export type {
  ResiliencePolicy,
  ResilienceAdapter,
  ResilienceInvocationContext,
  CompositionOrder,
} from './resilience.js'

// Export validation utilities
export {
  SchemaErrorFormatter,
  type FormattedError,
} from './validation/formatter.js'

export {
  SchemaValidator,
  ValidationError,
  createValidator,
  validateSchema,
  type ValidationResult,
} from './validation/validator.js'

export {
  WorkflowValidator,
  AgentValidator,
  workflowValidator,
  agentValidator,
  validateWorkflow as validateWorkflowZod,
  validateAgent,
  validateWorkflowOrThrow,
  validateAgentOrThrow,
} from './validation/workflow-validator.js'

// Export validators and hash helper (backward compatibility)
export {
  computeWorkflowSchemaHash,
  validateWorkflow,
  isValidWorkflow,
} from './validators.js'

// Export workflow types (original TypeScript interfaces)
export type {
  BaseStep,
  AgentStep,
  SequentialStep,
  ParallelStep,
  WorkflowStep,
  Workflow,
  ExecutionContext,
  StepResult,
  WorkflowResult,
} from './workflow.js'

// Export policy schemas and types
export {
  // Zod schemas
  RetryPolicySchema,
  CircuitBreakerPolicySchema,
  TimeoutPolicySchema,
  ConcurrencyPolicySchema,
  CancellationPolicySchema,
  ResilienceConfigSchema,
  GlobalPoliciesSchema,
  // TypeScript types (from Zod inference)
  type RetryPolicy,
  type CircuitBreakerPolicy,
  type TimeoutPolicy,
  type ConcurrencyPolicy,
  type CancellationPolicy,
  type ResilienceConfig,
  type GlobalPolicies,
} from './workflow/policies-schema.js'

// Export step schemas and types
export {
  // Zod schemas
  WorkflowStepSchema,
  BaseStepSchema,
  AgentStepSchema,
  SequentialStepSchema,
  ParallelStepSchema,
  StepInputSchema,
  StepOutputSchema,
  StepConditionSchema,
  StepPoliciesSchema,
  // TypeScript types (from Zod inference)
  type WorkflowStep as WorkflowStepZod,
  type BaseStep as BaseStepZod,
  type AgentStep as AgentStepZod,
  type SequentialStep as SequentialStepZod,
  type ParallelStep as ParallelStepZod,
  type StepInput,
  type StepOutput,
  type StepCondition,
  type StepPolicies,
} from './workflow/step-schema.js'

// Export workflow schemas and types
export {
  // Zod schemas
  WorkflowSchema,
  WorkflowMetadataSchema,
  WorkflowContextSchema,
  // TypeScript types (from Zod inference)
  type Workflow as WorkflowZod,
  type WorkflowMetadata,
  type WorkflowContext,
} from './workflow/workflow-schema.js'
