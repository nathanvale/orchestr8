/**
 * Tests for JSON Schema generation utilities
 */

import { describe, it, expect } from 'vitest'

import { WorkflowSchema } from '../workflow/workflow-schema.js'
import {
  generateJsonSchema,
  generateNamedSchema,
  generateAllSchemas,
  validateAgainstSchema,
  getJsonSchemaString,
  type SchemaName,
} from './json-schema.js'

describe('JSON Schema Generation', () => {
  describe('generateJsonSchema', () => {
    it('should generate JSON schema from Zod schema', () => {
      const jsonSchema = generateJsonSchema(WorkflowSchema)

      expect(jsonSchema).toBeDefined()
      expect(jsonSchema.$schema).toBe(
        'https://json-schema.org/draft-07/schema#',
      )
      expect(jsonSchema.type).toBe('object')
    })

    it('should include custom options', () => {
      const jsonSchema = generateJsonSchema(WorkflowSchema, {
        includeDescriptions: true,
        baseUri: 'https://custom.com/schemas',
        includeExamples: true,
      })

      expect(jsonSchema).toBeDefined()
      expect(jsonSchema.$id).toContain('https://custom.com/schemas')
    })
  })

  describe('generateNamedSchema', () => {
    it('should generate schema for known schema names', () => {
      const workflowSchema = generateNamedSchema('workflow')

      expect(workflowSchema).toBeDefined()
      expect(workflowSchema.type).toBe('object')
    })

    it('should throw error for unknown schema names', () => {
      expect(() => {
        generateNamedSchema('unknown' as unknown as SchemaName)
      }).toThrow('Unknown schema: unknown')
    })
  })

  describe('generateAllSchemas', () => {
    it('should generate all registered schemas', () => {
      const schemas = generateAllSchemas()

      expect(schemas).toBeDefined()
      expect(schemas.workflow).toBeDefined()
      expect(schemas.step).toBeDefined()
      expect(schemas.agentDefinition).toBeDefined()

      // Should have multiple schemas
      const schemaCount = Object.keys(schemas).length
      expect(schemaCount).toBeGreaterThan(5)
    })
  })

  describe('validateAgainstSchema', () => {
    it('should validate valid data against schema', () => {
      const validStepInput = {
        schema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      }

      const result = validateAgainstSchema('stepInput', validStepInput)

      expect(result.success).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should return errors for invalid data', () => {
      const invalidWorkflow = {
        version: 'invalid',
        // missing required fields
      }

      const result = validateAgainstSchema('workflow', invalidWorkflow)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors).toBeInstanceOf(Array)
      expect(result.errors!.length).toBeGreaterThan(0)
    })

    it('should handle unknown schema names', () => {
      const result = validateAgainstSchema(
        'unknown' as unknown as SchemaName,
        {},
      )

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]?.message).toContain('Unknown schema: unknown')
    })
  })

  describe('getJsonSchemaString', () => {
    it('should return JSON schema as formatted string', () => {
      const schemaString = getJsonSchemaString('workflow')

      expect(typeof schemaString).toBe('string')
      expect(schemaString).toContain('"type": "object"')

      // Should be valid JSON
      expect(() => JSON.parse(schemaString)).not.toThrow()
    })
  })
})
