/**
 * Comprehensive Zod schemas for workflow validation
 * Based on the specification in docs/sub-specs/workflow-ast-schema.md
 */

import { createHash } from 'node:crypto'

import { z } from 'zod'

// Base types with validation patterns
const WorkflowVersion = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'Must be valid semver format (x.y.z)')
const StepId = z
  .string()
  .regex(
    /^[a-zA-Z0-9-_]+$/,
    'Step ID must contain only alphanumeric characters, hyphens, and underscores',
  )
const AgentId = z
  .string()
  .regex(
    /^@[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/,
    'Agent ID must be in format @scope/name',
  )
const SecretRef = z
  .string()
  .regex(
    /^secret:\/\/[a-zA-Z0-9-_/]+$/,
    'Secret reference must start with secret://',
  )

// Expression patterns for input mapping validation
const ExpressionPattern = z
  .string()
  .regex(
    /^\$\{(steps\.[a-zA-Z0-9_-]+\.output\.[a-zA-Z0-9_.[\]]+|variables\.[a-zA-Z0-9_-]+|env\.[a-zA-Z0-9_-]+)(\?\?.+)?\}$/,
    'Expression must be ${steps.<id>.output.<path>}, ${variables.<name>}, or ${env.<name>} with optional ?? default',
  )

// Metadata schema
export const WorkflowMetadataSchema = z.object({
  id: z.string().uuid('Workflow ID must be a valid UUID'),
  name: z
    .string()
    .min(1, 'Workflow name is required')
    .max(255, 'Workflow name must be 255 characters or less'),
  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z
    .string()
    .datetime('Created timestamp must be valid ISO 8601 datetime')
    .optional(),
  updatedAt: z
    .string()
    .datetime('Updated timestamp must be valid ISO 8601 datetime')
    .optional(),
})

// Context schema
export const WorkflowContextSchema = z.object({
  environment: z.record(z.string()).optional(),
  variables: z.record(z.unknown()).optional(),
  secretRefs: z.array(SecretRef).optional(),
})

// Agent invocation schema
export const AgentInvocationSchema = z.object({
  id: AgentId,
  version: z
    .string()
    .regex(
      /^(\d+\.\d+\.\d+|latest|\^\d+\.\d+\.\d+|~\d+\.\d+\.\d+)$/,
      'Agent version must be semver, latest, or semver range (^/~)',
    )
    .optional(),
  config: z.record(z.unknown()).optional(),
})

// Expression security configuration
export const ExpressionSecuritySchema = z.object({
  maxExpansionDepth: z
    .number()
    .int()
    .min(1, 'Max expansion depth must be at least 1')
    .max(100, 'Max expansion depth cannot exceed 100')
    .default(10),
  maxExpansionSize: z
    .number()
    .int()
    .min(1024, 'Max expansion size must be at least 1KB')
    .max(1048576, 'Max expansion size cannot exceed 1MB')
    .default(65536),
})

// Step input/output schemas
export const StepInputSchema = z.object({
  schema: z.record(z.unknown()).optional(),
  mapping: z.record(ExpressionPattern).optional(),
  expressionSecurity: ExpressionSecuritySchema.optional(),
  transform: z.string().optional(),
})

export const StepOutputSchema = z.object({
  schema: z.record(z.unknown()).optional(),
  capture: z.record(z.string()).optional(),
})

// Condition schemas
export const StepConditionSchema = z.object({
  if: z.string().min(1, 'If condition cannot be empty').optional(),
  unless: z.string().min(1, 'Unless condition cannot be empty').optional(),
})

// Retry policy schema
export const RetryPolicySchema = z.object({
  maxAttempts: z
    .number()
    .int()
    .min(1, 'Max retry attempts must be at least 1')
    .max(10, 'Max retry attempts cannot exceed 10')
    .default(3),
  baseDelayMs: z
    .number()
    .int()
    .min(100, 'Base delay must be at least 100ms')
    .max(60000, 'Base delay cannot exceed 60 seconds')
    .default(1000),
  maxDelayMs: z
    .number()
    .int()
    .min(1000, 'Max delay must be at least 1 second')
    .max(300000, 'Max delay cannot exceed 5 minutes')
    .default(30000),
  jitterStrategy: z.enum(['full-jitter']).default('full-jitter'),
  retryableErrors: z
    .array(z.enum(['RetryableError', 'TimeoutError', 'NetworkError']))
    .default(['RetryableError', 'TimeoutError']),
})

// Circuit breaker policy schema
export const CircuitBreakerKeyStrategySchema = z.object({
  agentId: z.boolean().default(true),
  includeTarget: z.boolean().default(true),
})

export const CircuitBreakerErrorClassificationSchema = z.object({
  countTimeouts: z.boolean().default(true),
  countNetworkErrors: z.boolean().default(true),
  count5xxErrors: z.boolean().default(true),
  countRetryableErrors: z.boolean().default(true),
})

export const CircuitBreakerPolicySchema = z.object({
  keyStrategy: CircuitBreakerKeyStrategySchema.optional(),
  failureThreshold: z
    .number()
    .int()
    .min(1, 'Failure threshold must be at least 1')
    .max(100, 'Failure threshold cannot exceed 100')
    .default(5),
  resetTimeoutMs: z
    .number()
    .int()
    .min(1000, 'Reset timeout must be at least 1 second')
    .max(3600000, 'Reset timeout cannot exceed 1 hour')
    .default(60000),
  halfOpenPolicy: z.enum(['single-probe']).default('single-probe'),
  errorClassification: CircuitBreakerErrorClassificationSchema.optional(),
})

// Concurrency policy schema
export const ConcurrencyPolicySchema = z.object({
  maxConcurrentSteps: z
    .number()
    .int()
    .min(1, 'Max concurrent steps must be at least 1')
    .max(10, 'Max concurrent steps cannot exceed 10 in MVP')
    .default(10),
  abortOnSignal: z.boolean().default(true),
  cleanupTimeoutMs: z
    .number()
    .int()
    .min(1000, 'Cleanup timeout must be at least 1 second')
    .max(60000, 'Cleanup timeout cannot exceed 1 minute')
    .default(5000),
})

// Resilience budget schema
export const ResilienceBudgetSchema = z.object({
  perExecutionMs: z
    .number()
    .int()
    .min(30000, 'Per-execution budget must be at least 30 seconds')
    .max(3600000, 'Per-execution budget cannot exceed 1 hour')
    .default(90000),
  queueTimeoutMs: z
    .number()
    .int()
    .min(10000, 'Queue timeout must be at least 10 seconds')
    .max(300000, 'Queue timeout cannot exceed 5 minutes')
    .default(30000),
  totalSystemBudgetMs: z
    .number()
    .int()
    .min(60000, 'Total system budget must be at least 1 minute')
    .max(7200000, 'Total system budget cannot exceed 2 hours')
    .default(120000),
})

// Error taxonomy schema
export const ErrorTaxonomySchema = z.object({
  code: z.enum([
    'TIMEOUT',
    'CIRCUIT_BREAKER_OPEN',
    'CIRCUIT_OPEN', // @deprecated Use CIRCUIT_BREAKER_OPEN instead
    'CANCELLED',
    'VALIDATION',
    'RETRYABLE',
    'UNKNOWN',
  ]),
  isRetryable: z.boolean(),
  attempts: z.number().int().min(0, 'Attempt count cannot be negative'),
  cause: z.string().optional(),
  context: z.record(z.unknown()).optional(),
})

// Step policies schema
export const StepPoliciesSchema = z.object({
  timeout: z
    .number()
    .int()
    .min(1000, 'Step timeout must be at least 1 second')
    .max(3600000, 'Step timeout cannot exceed 1 hour')
    .optional(),
  retry: RetryPolicySchema.optional(),
  circuitBreaker: CircuitBreakerPolicySchema.optional(),
  idempotencyKey: z
    .string()
    .min(1, 'Idempotency key cannot be empty')
    .optional(),
})

// Global policies schema
export const GlobalTimeoutSchema = z.object({
  global: z
    .number()
    .int()
    .min(60000, 'Global timeout must be at least 1 minute')
    .max(7200000, 'Global timeout cannot exceed 2 hours')
    .default(300000),
  perStep: z
    .number()
    .int()
    .min(1000, 'Per-step timeout must be at least 1 second')
    .max(3600000, 'Per-step timeout cannot exceed 1 hour')
    .default(30000),
})

export const GlobalResilienceSchema = z.object({
  retry: RetryPolicySchema.optional(),
  circuitBreaker: CircuitBreakerPolicySchema.optional(),
  compositionOrder: z
    .enum(['retry-cb-timeout', 'timeout-cb-retry'])
    .default('retry-cb-timeout'),
})

export const GlobalCancellationSchema = z.object({
  gracePeriod: z
    .number()
    .int()
    .min(1000, 'Grace period must be at least 1 second')
    .max(60000, 'Grace period cannot exceed 1 minute')
    .default(5000),
  propagate: z.boolean().default(true),
  abortSignal: z.boolean().default(true),
})

export const GlobalPoliciesSchema = z.object({
  timeout: GlobalTimeoutSchema.optional(),
  resilience: GlobalResilienceSchema.optional(),
  concurrency: ConcurrencyPolicySchema.optional(),
  resilienceBudget: ResilienceBudgetSchema.optional(),
  cancellation: GlobalCancellationSchema.optional(),
})

// Workflow step schema (matches existing TypeScript interface)
export const WorkflowStepSchema = z.object({
  // Base step properties
  id: StepId,
  name: z.string().min(1, 'Step name is required').optional(),
  description: z.string().optional(),
  if: z.string().optional(),
  unless: z.string().optional(),
  onError: z.enum(['fail', 'continue', 'retry', 'fallback']).default('fail'),
  fallbackStepId: StepId.optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  timeout: z.number().int().min(1000).optional(),
  resilience: z
    .object({
      retry: RetryPolicySchema.optional(),
      circuitBreaker: CircuitBreakerPolicySchema.optional(),
      timeout: z.number().int().min(1000).optional(),
    })
    .optional(),
  dependsOn: z.array(StepId).optional(),

  // Type discriminator - for now we only support 'agent' type in MVP
  type: z.literal('agent'),

  // Agent-specific properties
  agentId: AgentId,
  config: z.record(z.unknown()).optional(),
  input: z.record(z.unknown()).optional(),
})

// Complete workflow schema with versioning
export const WorkflowSchema = z.object({
  // Core identification
  id: z.string().min(1, 'Workflow ID is required'),
  version: WorkflowVersion,
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional(),

  // Schema versioning (per ADR-002)
  schemaHash: z.string().optional(), // Optional for backward compatibility

  // Context
  variables: z.record(z.unknown()).optional(),
  allowedEnvVars: z.array(z.string()).optional(),

  // Execution definition
  steps: z
    .array(WorkflowStepSchema)
    .min(1, 'Workflow must have at least one step'),

  // Global policies - new structured approach
  policies: GlobalPoliciesSchema.optional(),

  // Legacy global policies - maintained for backward compatibility
  // @deprecated Use policies field instead
  timeout: z.number().int().min(1000).optional(),
  maxConcurrency: z.number().int().min(1).max(10).optional(),
  resilience: GlobalResilienceSchema.optional(),
})

// Type exports derived from Zod schemas
export type WorkflowMetadata = z.infer<typeof WorkflowMetadataSchema>
export type WorkflowContext = z.infer<typeof WorkflowContextSchema>
export type AgentInvocation = z.infer<typeof AgentInvocationSchema>
export type StepInput = z.infer<typeof StepInputSchema>
export type StepOutput = z.infer<typeof StepOutputSchema>
export type StepCondition = z.infer<typeof StepConditionSchema>
export type RetryPolicy = z.infer<typeof RetryPolicySchema>
export type CircuitBreakerPolicy = z.infer<typeof CircuitBreakerPolicySchema>
export type ConcurrencyPolicy = z.infer<typeof ConcurrencyPolicySchema>
export type ResilienceBudget = z.infer<typeof ResilienceBudgetSchema>
export type StepPolicies = z.infer<typeof StepPoliciesSchema>
export type GlobalPolicies = z.infer<typeof GlobalPoliciesSchema>
export type WorkflowStepZod = z.infer<typeof WorkflowStepSchema>
export type WorkflowZod = z.infer<typeof WorkflowSchema>

// Schema versioning utilities (per ADR-002)
export class WorkflowSchemaValidator {
  private static readonly CURRENT_SCHEMA_VERSION = '1.0.0'

  /**
   * Calculate a deterministic hash of the workflow schema structure
   */
  static calculateSchemaHash(): string {
    // Create a canonical representation of the schema structure
    const canonicalSchema = {
      version: this.CURRENT_SCHEMA_VERSION,
      fields: [
        'id',
        'version',
        'name',
        'description',
        'schemaHash',
        'variables',
        'allowedEnvVars',
        'steps',
        'policies', // New structured policies field
        'timeout', // Legacy, deprecated
        'maxConcurrency', // Legacy, deprecated
        'resilience', // Legacy, deprecated
      ],
      stepTypes: ['agent'],
      errorCodes: [
        'TIMEOUT',
        'CIRCUIT_BREAKER_OPEN',
        'CIRCUIT_OPEN', // @deprecated Use CIRCUIT_BREAKER_OPEN instead
        'CANCELLED',
        'VALIDATION',
        'RETRYABLE',
        'UNKNOWN',
      ],
      policies: [
        'retry',
        'circuitBreaker',
        'timeout',
        'concurrency',
        'resilienceBudget',
        'cancellation',
      ],
    }

    // Deterministic JSON serialization with sorted keys
    const sortedJson = JSON.stringify(
      canonicalSchema,
      Object.keys(canonicalSchema).sort(),
    )

    return createHash('sha256').update(sortedJson).digest('hex')
  }

  /**
   * Validate schema hash against current schema
   */
  static validateSchemaHash(workflow: { schemaHash?: string }): boolean {
    if (!workflow.schemaHash) {
      return true // Hash is optional for backward compatibility
    }
    const expectedHash = this.calculateSchemaHash()
    return workflow.schemaHash === expectedHash
  }

  /**
   * Validate workflow with comprehensive error reporting
   */
  static validateWorkflow(data: unknown): WorkflowZod {
    try {
      const parsed = WorkflowSchema.parse(data)

      // Validate schema hash if present
      if (!this.validateSchemaHash(parsed)) {
        throw new Error(
          `Schema hash mismatch. Expected: ${this.calculateSchemaHash()}`,
        )
      }

      return parsed
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = this.formatZodErrors(error)
        throw new Error(`Workflow validation failed:\n${errorMessage}`)
      }
      throw error
    }
  }

  /**
   * Format Zod validation errors into human-readable messages
   */
  private static formatZodErrors(error: z.ZodError): string {
    return error.errors
      .map((err) => {
        const path = err.path.length > 0 ? `${err.path.join('.')}: ` : ''
        return `  - ${path}${err.message}`
      })
      .join('\n')
  }

  /**
   * Validate a step independently
   */
  static validateStep(data: unknown): WorkflowStepZod {
    try {
      return WorkflowStepSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = this.formatZodErrors(error)
        throw new Error(`Step validation failed:\n${errorMessage}`)
      }
      throw error
    }
  }

  /**
   * Check if a workflow is valid without throwing
   */
  static isValidWorkflow(data: unknown): data is WorkflowZod {
    try {
      this.validateWorkflow(data)
      return true
    } catch {
      return false
    }
  }
}
