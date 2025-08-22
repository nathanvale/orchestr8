/**
 * Enhanced Zod schemas for workflow validation
 * Main workflow schema using modular components
 */

import { z } from 'zod'

import { GlobalPoliciesSchema } from './policies-schema.js'
import { WorkflowStepSchema } from './step-schema.js'

// Regex patterns for validation
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SECRET_REF_PATTERN = /^secret:\/\/[a-zA-Z0-9-_/]+$/
const SCHEMA_HASH_PATTERN = /^[a-f0-9]{64}$/

/**
 * Workflow metadata schema
 */
export const WorkflowMetadataSchema = z
  .object({
    id: z
      .string()
      .regex(UUID_PATTERN, 'Workflow ID must be a valid UUID')
      .describe('Unique identifier for the workflow'),
    name: z
      .string()
      .min(1, 'Workflow name cannot be empty')
      .max(255, 'Workflow name must be less than 255 characters')
      .describe('Human-readable workflow name'),
    description: z
      .string()
      .max(1000, 'Description must be less than 1000 characters')
      .optional()
      .describe('Detailed description of the workflow purpose'),
    tags: z
      .array(z.string())
      .optional()
      .describe('Tags for categorizing and searching workflows'),
    createdAt: z
      .string()
      .datetime()
      .optional()
      .describe('ISO 8601 timestamp of workflow creation'),
    updatedAt: z
      .string()
      .datetime()
      .optional()
      .describe('ISO 8601 timestamp of last workflow update'),
  })
  .describe('Workflow metadata including identification and timestamps')

/**
 * Workflow context schema
 */
export const WorkflowContextSchema = z
  .object({
    environment: z
      .record(z.string())
      .optional()
      .describe('Environment variables available to the workflow'),
    variables: z
      .record(z.unknown())
      .optional()
      .describe('Workflow-level variables accessible by all steps'),
    secretRefs: z
      .array(
        z
          .string()
          .regex(
            SECRET_REF_PATTERN,
            'Secret reference must follow format: secret://path/to/secret',
          ),
      )
      .optional()
      .describe('References to secrets that will be resolved at runtime'),
  })
  .describe('Workflow execution context including variables and secrets')

/**
 * Complete workflow schema
 */
export const WorkflowSchema = z
  .object({
    version: z
      .string()
      .regex(SEMVER_PATTERN, 'Version must be valid semver format (x.y.z)')
      .describe('Workflow version'),
    schemaVersion: z
      .string()
      .regex(
        SEMVER_PATTERN,
        'Schema version must be valid semver format (x.y.z)',
      )
      .describe('Schema version for compatibility checking'),
    schemaHash: z
      .string()
      .regex(SCHEMA_HASH_PATTERN, 'Schema hash must be 64 character hex string')
      .describe('SHA-256 hash of schema structure for drift detection'),
    metadata: WorkflowMetadataSchema,
    context: WorkflowContextSchema.optional(),
    steps: z
      .array(WorkflowStepSchema)
      .min(1, 'Workflow must have at least 1 step')
      .describe('Workflow execution steps'),
    policies: GlobalPoliciesSchema.optional(),
  })
  .describe('Complete workflow definition with steps and policies')

// Type exports
export type Workflow = z.infer<typeof WorkflowSchema>
export type WorkflowMetadata = z.infer<typeof WorkflowMetadataSchema>
export type WorkflowContext = z.infer<typeof WorkflowContextSchema>

export type { AgentInvocation } from '../agent/agent-schema.js'
export type { GlobalPolicies } from './policies-schema.js'
// Re-export types from modular schemas for convenience
export type { WorkflowStep } from './step-schema.js'
