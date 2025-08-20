/**
 * @orchestr8/schema - Workflow AST definitions and validation
 */

// Export agent types
export type { Agent, AgentRegistry } from './agents.js'

// Export error types
export {
  ExecutionErrorCode,
  type ExecutionError,
  createExecutionError,
  isExecutionError,
} from './errors.js'

// Export expression validation utilities
export {
  ExpressionValidator,
  DEFAULT_EXPRESSION_SECURITY,
  type ExpressionSecurityConfig,
  type ExpressionContext,
  type ExpressionValidationResult,
} from './expression-validator.js'

// Export resilience types
export type {
  ResiliencePolicy,
  ResilienceAdapter,
  ResilienceInvocationContext,
  CompositionOrder,
} from './resilience.js'

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

// Export Zod schemas and validation utilities
export {
  // Zod schemas
  WorkflowSchema,
  WorkflowStepSchema,
  WorkflowMetadataSchema,
  WorkflowContextSchema,
  AgentInvocationSchema,
  StepInputSchema,
  StepOutputSchema,
  StepConditionSchema,
  RetryPolicySchema,
  CircuitBreakerPolicySchema,
  ConcurrencyPolicySchema,
  ResilienceBudgetSchema,
  StepPoliciesSchema,
  GlobalPoliciesSchema,
  ErrorTaxonomySchema,
  ExpressionSecuritySchema,

  // Schema validator class
  WorkflowSchemaValidator,

  // Zod-derived types
  type WorkflowZod,
  type WorkflowStepZod,
  type WorkflowMetadata,
  type WorkflowContext,
  type AgentInvocation,
  type StepInput,
  type StepOutput,
  type StepCondition,
  type RetryPolicy,
  type CircuitBreakerPolicy,
  type ConcurrencyPolicy,
  type ResilienceBudget,
  type StepPolicies,
  type GlobalPolicies,
} from './zod-schemas.js'
