/**
 * JSON Schema generation utilities for workflow and agent schemas
 */

import type { ZodType, ZodError } from 'zod'

import { zodToJsonSchema } from 'zod-to-json-schema'

// JSON Schema type definition
export type JsonSchema = Record<string, unknown> & {
  $schema?: string
  $id?: string
  type?: string
  properties?: Record<string, unknown>
  required?: string[]
  examples?: unknown[]
}

import {
  agentDefinitionSchema,
  agentInvocationSchema,
  agentConfigSchema,
  agentCapabilitySchema,
} from '../agent/index.js'
import {
  workflowSchema,
  stepSchema,
  agentStepSchema,
  sequentialStepSchema,
  parallelStepSchema,
  resiliencePolicySchema,
  stepInputSchema,
  stepOutputSchema,
} from '../workflow/index.js'

/**
 * Options for JSON Schema generation
 */
export interface JsonSchemaGenerationOptions {
  /**
   * Include descriptions in the generated schema
   */
  includeDescriptions?: boolean

  /**
   * Target JSON Schema specification version
   */
  target?: 'jsonSchema7' | 'openApi3'

  /**
   * Base URI for schema references
   */
  baseUri?: string

  /**
   * Whether to include examples in the schema
   */
  includeExamples?: boolean
}

/**
 * Schema registry mapping schema names to Zod schemas
 */
const SCHEMA_REGISTRY = {
  // Workflow schemas
  workflow: workflowSchema,
  step: stepSchema,
  agentStep: agentStepSchema,
  sequentialStep: sequentialStepSchema,
  parallelStep: parallelStepSchema,
  resiliencePolicy: resiliencePolicySchema,
  stepInput: stepInputSchema,
  stepOutput: stepOutputSchema,

  // Agent schemas
  agentDefinition: agentDefinitionSchema,
  agentInvocation: agentInvocationSchema,
  agentConfig: agentConfigSchema,
  agentCapability: agentCapabilitySchema,
} as const

export type SchemaName = keyof typeof SCHEMA_REGISTRY

/**
 * Generate JSON Schema from a Zod schema
 */
export function generateJsonSchema<T extends ZodType>(
  schema: T,
  options: JsonSchemaGenerationOptions = {},
): JsonSchema {
  const {
    includeDescriptions = true,
    target = 'jsonSchema7',
    baseUri = 'https://orchestr8.io/schemas',
    includeExamples = true,
  } = options

  const jsonSchema = zodToJsonSchema(schema, {
    target,
    basePath: [baseUri],
    markdownDescription: includeDescriptions,
    errorMessages: true,
    $refStrategy: 'relative',
  }) as JsonSchema

  // Add metadata
  if (typeof jsonSchema === 'object' && jsonSchema !== null) {
    const schemaObj = jsonSchema

    // Add schema metadata
    schemaObj.$schema = 'https://json-schema.org/draft-07/schema#'
    schemaObj.$id = `${baseUri}/${schema.description || 'schema'}.json`

    // Add examples if requested
    if (includeExamples && schema._def.description) {
      schemaObj.examples = getSchemaExamples(schema)
    }
  }

  return jsonSchema
}

/**
 * Generate JSON Schema for a named schema from the registry
 */
export function generateNamedSchema(
  name: SchemaName,
  options: JsonSchemaGenerationOptions = {},
): JsonSchema {
  const schema = SCHEMA_REGISTRY[name]
  if (!schema) {
    throw new Error(`Unknown schema: ${name}`)
  }

  return generateJsonSchema(schema, {
    ...options,
    baseUri: `${options.baseUri || 'https://orchestr8.io/schemas'}/${name}`,
  })
}

/**
 * Generate all JSON Schemas from the registry
 */
export function generateAllSchemas(
  options: JsonSchemaGenerationOptions = {},
): Record<SchemaName, JsonSchema> {
  const schemas: Partial<Record<SchemaName, JsonSchema>> = {}

  for (const [name, schema] of Object.entries(SCHEMA_REGISTRY)) {
    schemas[name as SchemaName] = generateJsonSchema(schema, {
      ...options,
      baseUri: `${options.baseUri || 'https://orchestr8.io/schemas'}/${name}`,
    })
  }

  return schemas as Record<SchemaName, JsonSchema>
}

/**
 * Get example values for a schema (placeholder - would be expanded)
 */
function getSchemaExamples(_schema: ZodType): unknown[] {
  // This would be expanded to generate realistic examples
  // For now, return empty array
  return []
}

/**
 * Validate JSON data against a named schema
 */
export function validateAgainstSchema(
  name: SchemaName,
  data: unknown,
): {
  success: boolean
  errors?: Array<{ path: string; message: string; code: string }>
} {
  const schema = SCHEMA_REGISTRY[name]
  if (!schema) {
    return {
      success: false,
      errors: [
        {
          path: '',
          message: `Unknown schema: ${name}`,
          code: 'UNKNOWN_SCHEMA',
        },
      ],
    }
  }

  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true }
  }

  return {
    success: false,
    errors: result.error.errors.map((err: ZodError['errors'][0]) => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  }
}

/**
 * Get JSON Schema as string for file writing
 */
export function getJsonSchemaString(
  name: SchemaName,
  options: JsonSchemaGenerationOptions = {},
): string {
  const schema = generateNamedSchema(name, options)
  return JSON.stringify(schema, null, 2)
}

/**
 * Export all schemas to a directory (used by build script)
 */
export async function exportSchemasToDirectory(
  outputDir: string,
  options: JsonSchemaGenerationOptions = {},
): Promise<void> {
  const { writeFile, mkdir } = await import('fs/promises')
  const { join } = await import('path')

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true })

  // Generate and write each schema
  for (const name of Object.keys(SCHEMA_REGISTRY) as SchemaName[]) {
    const schemaJson = getJsonSchemaString(name, options)
    const outputPath = join(outputDir, `${name}.schema.json`)
    await writeFile(outputPath, schemaJson, 'utf-8')
  }

  // Write an index file
  const indexContent = {
    schemas: Object.keys(SCHEMA_REGISTRY),
    baseUri: options.baseUri || 'https://orchestr8.io/schemas',
    generated: new Date().toISOString(),
  }

  await writeFile(
    join(outputDir, 'index.json'),
    JSON.stringify(indexContent, null, 2),
    'utf-8',
  )
}
