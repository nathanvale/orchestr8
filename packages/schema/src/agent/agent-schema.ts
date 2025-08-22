/**
 * Agent schemas for validation
 * Modular agent definition and invocation schemas
 */

import { z } from 'zod'

// Patterns for validation
const AGENT_ID_PATTERN = /^@[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/
const VERSION_PATTERN =
  /^(\d+\.\d+\.\d+|latest|\^\d+\.\d+\.\d+|~\d+\.\d+\.\d+)$/

/**
 * Agent invocation schema for workflow steps
 */
export const AgentInvocationSchema = z
  .object({
    id: z
      .string()
      .regex(AGENT_ID_PATTERN, 'Agent ID must follow format: @scope/name')
      .describe('Agent identifier in @scope/name format'),
    version: z
      .string()
      .regex(
        VERSION_PATTERN,
        'Version must be semver, latest, or semver range (^x.y.z or ~x.y.z)',
      )
      .optional()
      .describe('Agent version constraint'),
    config: z
      .record(z.unknown())
      .optional()
      .describe('Agent-specific configuration parameters'),
  })
  .describe('Agent invocation details including version and configuration')

/**
 * Agent metadata schema for agent definitions
 */
export const AgentMetadataSchema = z
  .object({
    id: z
      .string()
      .regex(AGENT_ID_PATTERN, 'Agent ID must follow format: @scope/name')
      .describe('Unique agent identifier'),
    name: z
      .string()
      .min(1, 'Agent name cannot be empty')
      .max(255, 'Agent name must be less than 255 characters')
      .describe('Human-readable agent name'),
    description: z
      .string()
      .max(1000, 'Description must be less than 1000 characters')
      .optional()
      .describe('Detailed description of agent purpose'),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/, 'Version must be valid semver format (x.y.z)')
      .describe('Agent version'),
    author: z.string().optional().describe('Agent author or organization'),
    tags: z
      .array(z.string())
      .optional()
      .describe('Tags for categorizing agents'),
    license: z
      .string()
      .optional()
      .describe('License identifier (e.g., MIT, Apache-2.0)'),
  })
  .describe('Agent metadata including identification and documentation')

/**
 * Agent input/output schema definition
 */
export const AgentIOSchemaDefinition = z
  .object({
    type: z
      .enum(['object', 'array', 'string', 'number', 'boolean'])
      .describe('JSON Schema type'),
    properties: z
      .record(z.any())
      .optional()
      .describe('Object properties for type: object'),
    items: z.any().optional().describe('Array item schema for type: array'),
    required: z
      .array(z.string())
      .optional()
      .describe('Required properties for type: object'),
    description: z.string().optional().describe('Schema description'),
    examples: z.array(z.any()).optional().describe('Example values'),
  })
  .describe('JSON Schema definition for input/output validation')

/**
 * Agent capability schema
 */
export const AgentCapabilitySchema = z
  .object({
    name: z.string().describe('Capability name'),
    description: z.string().optional().describe('Capability description'),
    required: z
      .boolean()
      .default(false)
      .describe('Whether this capability is required'),
  })
  .describe('Agent capability declaration')

/**
 * Agent configuration schema
 */
export const AgentConfigurationSchema = z
  .object({
    timeout: z
      .number()
      .int()
      .min(1000, 'Timeout must be at least 1000ms')
      .optional()
      .describe('Default timeout for agent execution'),
    retryable: z
      .boolean()
      .default(true)
      .describe('Whether agent operations are retryable'),
    idempotent: z
      .boolean()
      .default(false)
      .describe('Whether agent operations are idempotent'),
    capabilities: z
      .array(AgentCapabilitySchema)
      .optional()
      .describe('Agent capabilities and features'),
    environment: z
      .record(z.string())
      .optional()
      .describe('Required environment variables'),
    secrets: z.array(z.string()).optional().describe('Required secret names'),
  })
  .describe('Agent configuration and requirements')

/**
 * Complete agent definition schema
 */
export const AgentDefinitionSchema = z
  .object({
    metadata: AgentMetadataSchema,
    input: AgentIOSchemaDefinition.optional(),
    output: AgentIOSchemaDefinition.optional(),
    configuration: AgentConfigurationSchema.optional(),
    dependencies: z
      .array(
        z.object({
          id: z
            .string()
            .regex(
              AGENT_ID_PATTERN,
              'Dependency ID must follow format: @scope/name',
            ),
          version: z
            .string()
            .regex(VERSION_PATTERN, 'Version must be valid constraint'),
        }),
      )
      .optional()
      .describe('Other agents this agent depends on'),
  })
  .describe('Complete agent definition with metadata and schemas')

// Type exports
export type AgentInvocation = z.infer<typeof AgentInvocationSchema>
export type AgentMetadata = z.infer<typeof AgentMetadataSchema>
export type AgentIOSchema = z.infer<typeof AgentIOSchemaDefinition>
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>
export type AgentConfiguration = z.infer<typeof AgentConfigurationSchema>
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>
