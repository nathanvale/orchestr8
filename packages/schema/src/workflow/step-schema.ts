/**
 * Step schemas for workflow validation
 * Modular step type definitions and validation
 */

import { z } from 'zod'

import { AgentInvocationSchema } from '../agent/agent-schema.js'
import {
  CircuitBreakerPolicySchema,
  RetryPolicySchema,
} from './policies-schema.js'

// Patterns for validation
const STEP_ID_PATTERN = /^[a-zA-Z0-9-_]+$/
const EXPRESSION_PATTERN =
  /^\$\{(steps\.[a-zA-Z0-9_-]+\.output\.[a-zA-Z0-9_.[\]]+|variables\.[a-zA-Z0-9_-]+|env\.[a-zA-Z0-9_-]+)(\s*\?\?\s*.+)?\}$/

/**
 * Step input schema
 */
export const StepInputSchema = z
  .object({
    schema: z
      .record(z.unknown())
      .optional()
      .describe('JSON Schema for input validation'),
    mapping: z
      .record(
        z
          .string()
          .regex(
            EXPRESSION_PATTERN,
            'Mapping must use ${steps.<id>.output.<path>}, ${variables.<name>}, or ${env.<name>} with optional ?? default',
          ),
      )
      .optional()
      .describe('Maps workflow context to agent input using expressions'),
    expressionSecurity: z
      .object({
        maxExpansionDepth: z
          .number()
          .int()
          .default(10)
          .describe('Maximum depth for path traversal'),
        maxExpansionSize: z
          .number()
          .int()
          .default(65536)
          .describe('Maximum expanded size in bytes per expression'),
      })
      .optional()
      .describe('Security limits for expression evaluation'),
    transform: z
      .string()
      .optional()
      .describe('Optional JMES path expression for transformation'),
  })
  .describe('Step input configuration including mapping and validation')

/**
 * Step output schema
 */
export const StepOutputSchema = z
  .object({
    schema: z
      .record(z.unknown())
      .optional()
      .describe('JSON Schema for output validation'),
    capture: z
      .record(z.string())
      .optional()
      .describe('Variables to capture from output'),
  })
  .describe('Step output configuration including capture and validation')

/**
 * Step condition schema
 */
export const StepConditionSchema = z
  .object({
    if: z
      .string()
      .optional()
      .describe('JMES path expression that must evaluate to true'),
    unless: z
      .string()
      .optional()
      .describe('JMES path expression that must evaluate to false'),
  })
  .describe('Conditional execution based on JMES path expressions')

/**
 * Step policies schema
 */
export const StepPoliciesSchema = z
  .object({
    timeout: z
      .number()
      .int()
      .min(1000, 'Timeout must be at least 1000ms')
      .optional()
      .describe('Timeout in milliseconds for step execution'),
    retry: RetryPolicySchema.optional(),
    circuitBreaker: CircuitBreakerPolicySchema.optional(),
    idempotencyKey: z
      .string()
      .optional()
      .describe('Template for generating idempotency key'),
  })
  .describe('Step-level resilience and execution policies')

/**
 * Base step schema with common fields
 */
export const BaseStepSchema = z
  .object({
    id: z
      .string()
      .regex(
        STEP_ID_PATTERN,
        'Step ID must contain only alphanumeric characters, hyphens, and underscores',
      )
      .describe('Unique identifier for the step'),
    name: z.string().describe('Human-readable step name'),
    description: z
      .string()
      .optional()
      .describe('Detailed description of step purpose'),
    dependencies: z
      .array(z.string())
      .optional()
      .describe('Step IDs that must complete before this step'),
    condition: StepConditionSchema.optional(),
    policies: StepPoliciesSchema.optional(),
    onError: z
      .enum(['fail', 'continue', 'retry', 'fallback'])
      .default('fail')
      .describe('Error handling strategy for this step'),
    fallbackStepId: z
      .string()
      .optional()
      .describe('Step ID to execute when onError is fallback'),
  })
  .describe('Common fields for all step types')

/**
 * Agent step schema
 */
export const AgentStepSchema = BaseStepSchema.extend({
  type: z.literal('agent').optional().default('agent'),
  agent: AgentInvocationSchema,
  input: StepInputSchema.optional(),
  output: StepOutputSchema.optional(),
}).describe('Agent execution step')

/**
 * Sequential step schema (currently pass-through)
 */
export const SequentialStepSchema = BaseStepSchema.extend({
  type: z.literal('sequential'),
  // Reserved for future nested execution
  steps: z.never().optional(),
}).describe('Sequential execution group marker')

/**
 * Parallel step schema (currently pass-through)
 */
export const ParallelStepSchema = BaseStepSchema.extend({
  type: z.literal('parallel'),
  // Reserved for future nested execution
  steps: z.never().optional(),
  maxConcurrency: z.never().optional(),
}).describe('Parallel execution group marker')

/**
 * Union type for all workflow step types
 * Supports both discriminated union and default agent type
 */
export const WorkflowStepSchema = z
  .union([AgentStepSchema, SequentialStepSchema, ParallelStepSchema])
  .describe('Workflow step configuration')

// Type exports
export type StepInput = z.infer<typeof StepInputSchema>
export type StepOutput = z.infer<typeof StepOutputSchema>
export type StepCondition = z.infer<typeof StepConditionSchema>
export type StepPolicies = z.infer<typeof StepPoliciesSchema>
export type BaseStep = z.infer<typeof BaseStepSchema>
export type AgentStep = z.infer<typeof AgentStepSchema>
export type SequentialStep = z.infer<typeof SequentialStepSchema>
export type ParallelStep = z.infer<typeof ParallelStepSchema>
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>
