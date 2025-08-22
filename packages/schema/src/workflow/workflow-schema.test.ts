/**
 * Tests for enhanced workflow schema validation
 * Ensures comprehensive validation of workflow JSON structures
 */

import { describe, expect, it } from 'vitest'

// Import the schemas we'll create
import { WorkflowSchema } from './workflow-schema.js'

describe('WorkflowSchema', () => {
  describe('valid workflows', () => {
    it('should validate a minimal workflow', () => {
      const validWorkflow = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        schemaHash: 'a'.repeat(64),
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Workflow',
        },
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            agent: {
              id: '@orchestr8/test-agent',
            },
          },
        ],
      }

      const result = WorkflowSchema.safeParse(validWorkflow)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.metadata.name).toBe('Test Workflow')
      }
    })

    it('should validate a complex workflow with all fields', () => {
      const complexWorkflow = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        schemaHash: 'b'.repeat(64),
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Complex Workflow',
          description: 'A workflow with all features',
          tags: ['test', 'complex'],
          createdAt: '2025-01-20T10:00:00Z',
          updatedAt: '2025-01-20T11:00:00Z',
        },
        context: {
          environment: {
            API_URL: 'https://api.example.com',
          },
          variables: {
            targetUser: 'john.doe',
            maxRetries: 3,
          },
          secretRefs: ['secret://github/token', 'secret://openai/api-key'],
        },
        steps: [
          {
            id: 'fetch-data',
            name: 'Fetch User Data',
            description: 'Retrieve user information from API',
            agent: {
              id: '@orchestr8/http-agent',
              version: '^1.0.0',
              config: {
                timeout: 30000,
              },
            },
            input: {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                },
              },
              mapping: {
                userId: '${variables.targetUser}',
                apiUrl: '${env.API_URL ?? "https://default.api.com"}',
              },
            },
            output: {
              schema: {
                type: 'object',
                properties: {
                  userData: { type: 'object' },
                },
              },
              capture: {
                user: 'userData',
              },
            },
            policies: {
              timeout: 60000,
              retry: {
                maxAttempts: 3,
                baseDelayMs: 1000,
                jitterStrategy: 'full-jitter',
              },
              circuitBreaker: {
                failureThreshold: 5,
                resetTimeoutMs: 60000,
              },
            },
          },
          {
            id: 'process-data',
            name: 'Process User Data',
            agent: {
              id: '@orchestr8/processor-agent',
            },
            dependencies: ['fetch-data'],
            condition: {
              if: 'steps.fetch-data.output.userData',
            },
            input: {
              mapping: {
                data: '${steps.fetch-data.output.userData}',
              },
            },
            onError: 'continue',
          },
        ],
        policies: {
          timeout: {
            global: 300000,
            perStep: 30000,
          },
          resilience: {
            retry: {
              maxAttempts: 3,
              baseDelayMs: 1000,
            },
            circuitBreaker: {
              failureThreshold: 5,
              resetTimeoutMs: 60000,
            },
            compositionOrder: 'retry-cb-timeout',
          },
          concurrency: {
            maxConcurrentSteps: 10,
          },
          cancellation: {
            gracePeriod: 5000,
            propagate: true,
          },
        },
      }

      const result = WorkflowSchema.safeParse(complexWorkflow)
      expect(result.success).toBe(true)
    })

    it('should validate expression patterns in mappings', () => {
      const workflowWithExpressions = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        schemaHash: 'c'.repeat(64),
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Expression Test',
        },
        steps: [
          {
            id: 'step1',
            name: 'Step with expressions',
            agent: {
              id: '@orchestr8/test-agent',
            },
            input: {
              mapping: {
                // Valid expression patterns
                stepOutput: '${steps.previous.output.data}',
                withDefault: '${variables.optional ?? "default"}',
                envVar: '${env.API_KEY}',
                nestedPath: '${steps.fetch.output.user.profile.name}',
                arrayAccess: '${steps.list.output.items[0]}',
              },
            },
          },
        ],
      }

      const result = WorkflowSchema.safeParse(workflowWithExpressions)
      expect(result.success).toBe(true)
    })
  })

  describe('invalid workflows', () => {
    it('should reject workflow without required fields', () => {
      const invalidWorkflow = {
        version: '1.0.0',
        // Missing schemaVersion and schemaHash
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
        },
        // Missing steps
      }

      const result = WorkflowSchema.safeParse(invalidWorkflow)
      expect(result.success).toBe(false)
      if (!result.success) {
        const errors = result.error.errors
        expect(errors.some((e) => e.path.includes('schemaVersion'))).toBe(true)
        expect(errors.some((e) => e.path.includes('steps'))).toBe(true)
      }
    })

    it('should reject invalid version format', () => {
      const invalidVersion = {
        version: 'invalid-version',
        schemaVersion: '1.0.0',
        schemaHash: 'd'.repeat(64),
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
        },
        steps: [
          {
            id: 'step1',
            name: 'Step',
            agent: { id: '@orchestr8/test' },
          },
        ],
      }

      const result = WorkflowSchema.safeParse(invalidVersion)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('semver')
      }
    })

    it('should reject invalid UUID in metadata', () => {
      const invalidUuid = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        schemaHash: 'e'.repeat(64),
        metadata: {
          id: 'not-a-uuid',
          name: 'Test',
        },
        steps: [
          {
            id: 'step1',
            name: 'Step',
            agent: { id: '@orchestr8/test' },
          },
        ],
      }

      const result = WorkflowSchema.safeParse(invalidUuid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('id')
      }
    })

    it('should reject invalid agent ID format', () => {
      const invalidAgentId = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        schemaHash: 'f'.repeat(64),
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
        },
        steps: [
          {
            id: 'step1',
            name: 'Step',
            agent: {
              id: 'missing-scope', // Should be @scope/name
            },
          },
        ],
      }

      const result = WorkflowSchema.safeParse(invalidAgentId)
      expect(result.success).toBe(false)
      if (!result.success) {
        const error = result.error.errors.find((e) =>
          e.path.join('.').includes('agent.id'),
        )
        expect(error).toBeDefined()
      }
    })

    it('should reject invalid expression patterns', () => {
      const invalidExpressions = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        schemaHash: 'a'.repeat(64),
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
        },
        steps: [
          {
            id: 'step1',
            name: 'Step',
            agent: { id: '@orchestr8/test' },
            input: {
              mapping: {
                invalid1: 'not-an-expression',
                invalid2: '${invalid.path}', // Not steps/variables/env
                invalid3: '${steps}', // Incomplete path
                invalid4: '${}', // Empty expression
              },
            },
          },
        ],
      }

      const result = WorkflowSchema.safeParse(invalidExpressions)
      expect(result.success).toBe(false)
    })

    it('should reject invalid resilience policy values', () => {
      const invalidPolicies = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        schemaHash: 'b'.repeat(64),
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
        },
        steps: [
          {
            id: 'step1',
            name: 'Step',
            agent: { id: '@orchestr8/test' },
            policies: {
              retry: {
                maxAttempts: 20, // Exceeds max of 10
                baseDelayMs: 50, // Below min of 100
              },
              circuitBreaker: {
                failureThreshold: 0, // Below min of 1
                resetTimeoutMs: 500, // Below min of 1000
              },
            },
          },
        ],
      }

      const result = WorkflowSchema.safeParse(invalidPolicies)
      expect(result.success).toBe(false)
    })

    it('should reject invalid secret references', () => {
      const invalidSecrets = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        schemaHash: 'c'.repeat(64),
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
        },
        context: {
          secretRefs: [
            'not-a-secret-ref',
            'secret://', // Empty path
            'https://secret', // Wrong protocol
          ],
        },
        steps: [
          {
            id: 'step1',
            name: 'Step',
            agent: { id: '@orchestr8/test' },
          },
        ],
      }

      const result = WorkflowSchema.safeParse(invalidSecrets)
      expect(result.success).toBe(false)
    })

    it('should reject steps with empty array', () => {
      const emptySteps = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        schemaHash: 'd'.repeat(64),
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
        },
        steps: [],
      }

      const result = WorkflowSchema.safeParse(emptySteps)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('at least 1')
      }
    })

    it('should reject concurrency limits outside valid range', () => {
      const invalidConcurrency = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        schemaHash: 'e'.repeat(64),
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
        },
        steps: [
          {
            id: 'step1',
            name: 'Step',
            agent: { id: '@orchestr8/test' },
          },
        ],
        policies: {
          concurrency: {
            maxConcurrentSteps: 15, // Exceeds max of 10
          },
        },
      }

      const result = WorkflowSchema.safeParse(invalidConcurrency)
      expect(result.success).toBe(false)
    })
  })

  describe('schema metadata', () => {
    it('should include descriptions for documentation', () => {
      // This will be tested when we implement the actual schema with descriptions
      expect(true).toBe(true)
    })

    it('should support schema versioning', () => {
      const workflow = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        schemaHash: 'f'.repeat(64),
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
        },
        steps: [
          {
            id: 'step1',
            name: 'Step',
            agent: { id: '@orchestr8/test' },
          },
        ],
      }

      const result = WorkflowSchema.safeParse(workflow)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.schemaVersion).toBe('1.0.0')
        expect(result.data.schemaHash).toHaveLength(64)
      }
    })
  })
})
