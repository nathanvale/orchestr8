import { describe, expect, it } from 'vitest'

import { ExpressionValidator } from './expression-validator.js'
import {
  validateWorkflow,
  computeWorkflowSchemaHash,
  isValidWorkflow,
} from './validators.js'
import {
  WorkflowSchema,
  WorkflowSchemaValidator,
  WorkflowStepSchema,
  RetryPolicySchema,
  CircuitBreakerPolicySchema,
  type WorkflowZod,
} from './zod-schemas.js'

describe('Schema Package', () => {
  describe('Zod Schema Validation', () => {
    const validWorkflow: WorkflowZod = {
      id: 'test-workflow',
      version: '1.0.0',
      name: 'Test Workflow',
      description: 'A test workflow',
      steps: [
        {
          id: 'step1',
          type: 'agent',
          agentId: '@test/agent',
          name: 'Test Step',
          input: {
            message: 'Hello World',
          },
        },
      ],
    }

    it('should validate a complete workflow', () => {
      const result = WorkflowSchema.parse(validWorkflow)
      // Zod adds default values, so we need to expect them
      expect(result).toEqual({
        ...validWorkflow,
        steps: [
          {
            ...validWorkflow.steps[0],
            onError: 'fail', // Default value added by Zod
          },
        ],
      })
    })

    it('should reject workflow with invalid id', () => {
      const invalidWorkflow = { ...validWorkflow, id: '' }
      expect(() => WorkflowSchema.parse(invalidWorkflow)).toThrow(
        'Workflow ID is required',
      )
    })

    it('should reject workflow with invalid version', () => {
      const invalidWorkflow = { ...validWorkflow, version: 'invalid-version' }
      expect(() => WorkflowSchema.parse(invalidWorkflow)).toThrow(
        'Must be valid semver format',
      )
    })

    it('should reject workflow with no steps', () => {
      const invalidWorkflow = { ...validWorkflow, steps: [] }
      expect(() => WorkflowSchema.parse(invalidWorkflow)).toThrow(
        'Workflow must have at least one step',
      )
    })

    it('should validate workflow with optional fields', () => {
      const workflowWithOptionals = {
        ...validWorkflow,
        variables: { key: 'value' },
        allowedEnvVars: ['NODE_ENV'],
        timeout: 30000,
        maxConcurrency: 5,
      }
      const result = WorkflowSchema.parse(workflowWithOptionals)
      expect(result.variables).toEqual({ key: 'value' })
      expect(result.allowedEnvVars).toEqual(['NODE_ENV'])
      expect(result.timeout).toBe(30000)
      expect(result.maxConcurrency).toBe(5)
    })
  })

  describe('Step Schema Validation', () => {
    const validStep = {
      id: 'test-step',
      type: 'agent' as const,
      agentId: '@test/agent',
      name: 'Test Step',
    }

    it('should validate a basic agent step', () => {
      const result = WorkflowStepSchema.parse(validStep)
      expect(result.id).toBe('test-step')
      expect(result.type).toBe('agent')
      expect(result.agentId).toBe('@test/agent')
    })

    it('should reject step with invalid id format', () => {
      const invalidStep = { ...validStep, id: 'invalid id with spaces!' }
      expect(() => WorkflowStepSchema.parse(invalidStep)).toThrow(
        'Step ID must contain only alphanumeric characters, hyphens, and underscores',
      )
    })

    it('should reject step with invalid agent id format', () => {
      const invalidStep = { ...validStep, agentId: 'invalid-agent-id' }
      expect(() => WorkflowStepSchema.parse(invalidStep)).toThrow(
        'Agent ID must be in format @scope/name',
      )
    })

    it('should validate step with all optional fields', () => {
      const complexStep = {
        ...validStep,
        description: 'A complex test step',
        dependsOn: ['other-step'],
        onError: 'continue' as const,
        maxRetries: 3,
        timeout: 5000,
        config: { setting: 'value' },
        input: { data: 'test' },
      }
      const result = WorkflowStepSchema.parse(complexStep)
      expect(result.description).toBe('A complex test step')
      expect(result.dependsOn).toEqual(['other-step'])
      expect(result.onError).toBe('continue')
      expect(result.maxRetries).toBe(3)
      expect(result.timeout).toBe(5000)
    })
  })

  describe('Retry Policy Schema', () => {
    it('should validate with default values', () => {
      const policy = RetryPolicySchema.parse({})
      expect(policy.maxAttempts).toBe(3)
      expect(policy.baseDelayMs).toBe(1000)
      expect(policy.maxDelayMs).toBe(30000)
      expect(policy.jitterStrategy).toBe('full-jitter')
      expect(policy.retryableErrors).toEqual(['RetryableError', 'TimeoutError'])
    })

    it('should validate custom retry policy', () => {
      const customPolicy = {
        maxAttempts: 5,
        baseDelayMs: 2000,
        maxDelayMs: 60000,
        retryableErrors: ['RetryableError', 'NetworkError'],
      }
      const result = RetryPolicySchema.parse(customPolicy)
      expect(result).toEqual({ ...customPolicy, jitterStrategy: 'full-jitter' })
    })

    it('should reject invalid max attempts', () => {
      expect(() => RetryPolicySchema.parse({ maxAttempts: 0 })).toThrow(
        'Max retry attempts must be at least 1',
      )
      expect(() => RetryPolicySchema.parse({ maxAttempts: 11 })).toThrow(
        'Max retry attempts cannot exceed 10',
      )
    })

    it('should reject invalid base delay', () => {
      expect(() => RetryPolicySchema.parse({ baseDelayMs: 50 })).toThrow(
        'Base delay must be at least 100ms',
      )
    })
  })

  describe('Circuit Breaker Policy Schema', () => {
    it('should validate with default values', () => {
      const policy = CircuitBreakerPolicySchema.parse({})
      expect(policy.failureThreshold).toBe(5)
      expect(policy.resetTimeoutMs).toBe(60000)
      expect(policy.halfOpenPolicy).toBe('single-probe')
    })

    it('should validate custom circuit breaker policy', () => {
      const customPolicy = {
        failureThreshold: 10,
        resetTimeoutMs: 120000,
        keyStrategy: { agentId: true, includeTarget: false },
        errorClassification: { countTimeouts: false, countNetworkErrors: true },
      }
      const result = CircuitBreakerPolicySchema.parse(customPolicy)
      expect(result.failureThreshold).toBe(10)
      expect(result.resetTimeoutMs).toBe(120000)
      expect(result.keyStrategy?.includeTarget).toBe(false)
      expect(result.errorClassification?.countTimeouts).toBe(false)
    })

    it('should reject invalid failure threshold', () => {
      expect(() =>
        CircuitBreakerPolicySchema.parse({ failureThreshold: 0 }),
      ).toThrow('Failure threshold must be at least 1')
      expect(() =>
        CircuitBreakerPolicySchema.parse({ failureThreshold: 101 }),
      ).toThrow('Failure threshold cannot exceed 100')
    })
  })

  describe('WorkflowSchemaValidator', () => {
    it('should calculate consistent schema hash', () => {
      const hash1 = WorkflowSchemaValidator.calculateSchemaHash()
      const hash2 = WorkflowSchemaValidator.calculateSchemaHash()
      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should accept workflow with global policies structure', () => {
      const workflow = {
        id: 'test',
        version: '1.0.0',
        name: 'Test Workflow',
        steps: [{ id: 'step1', type: 'agent', agentId: '@test/agent' }],
        policies: {
          timeout: {
            global: 300000,
            perStep: 30000,
          },
          resilience: {
            retry: {
              maxAttempts: 3,
              baseDelayMs: 1000,
              maxDelayMs: 30000,
              jitterStrategy: 'full-jitter',
              retryableErrors: ['RetryableError', 'TimeoutError'],
            },
            circuitBreaker: {
              failureThreshold: 5,
              resetTimeoutMs: 60000,
              halfOpenPolicy: 'single-probe',
            },
            compositionOrder: 'retry-cb-timeout',
          },
          concurrency: {
            maxConcurrentSteps: 10,
            abortOnSignal: true,
            cleanupTimeoutMs: 5000,
          },
          resilienceBudget: {
            perExecutionMs: 90000,
            queueTimeoutMs: 30000,
            totalSystemBudgetMs: 120000,
          },
          cancellation: {
            gracePeriod: 5000,
            propagate: true,
            abortSignal: true,
          },
        },
      }

      const result = WorkflowSchemaValidator.validateWorkflow(workflow)
      expect(result.id).toBe('test')
      expect(result.policies).toBeDefined()
      expect(result.policies?.timeout?.global).toBe(300000)
      expect(result.policies?.resilience?.retry?.maxAttempts).toBe(3)
      expect(result.policies?.concurrency?.maxConcurrentSteps).toBe(10)
      expect(result.policies?.resilienceBudget?.perExecutionMs).toBe(90000)
      expect(result.policies?.cancellation?.gracePeriod).toBe(5000)
    })

    it('should maintain backward compatibility with flat timeout and resilience', () => {
      const workflow = {
        id: 'test',
        version: '1.0.0',
        name: 'Test Workflow',
        steps: [{ id: 'step1', type: 'agent', agentId: '@test/agent' }],
        // Old flat structure
        timeout: 60000,
        maxConcurrency: 5,
        resilience: {
          retry: {
            maxAttempts: 2,
          },
        },
      }

      const result = WorkflowSchemaValidator.validateWorkflow(workflow)
      expect(result.id).toBe('test')
      expect(result.timeout).toBe(60000)
      expect(result.maxConcurrency).toBe(5)
      expect(result.resilience?.retry?.maxAttempts).toBe(2)
    })

    it('should validate workflow with hash', () => {
      const workflow = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: [{ id: 'step1', type: 'agent', agentId: '@test/agent' }],
        schemaHash: WorkflowSchemaValidator.calculateSchemaHash(),
      }
      const result = WorkflowSchemaValidator.validateWorkflow(workflow)
      expect(result.id).toBe('test')
    })

    it('should reject workflow with invalid hash', () => {
      const workflow = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: [{ id: 'step1', type: 'agent', agentId: '@test/agent' }],
        schemaHash: 'invalid-hash',
      }
      expect(() => WorkflowSchemaValidator.validateWorkflow(workflow)).toThrow(
        'Schema hash mismatch',
      )
    })

    it('should check validity without throwing', () => {
      const validWorkflow = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: [{ id: 'step1', type: 'agent', agentId: '@test/agent' }],
      }
      expect(WorkflowSchemaValidator.isValidWorkflow(validWorkflow)).toBe(true)

      const invalidWorkflow = {
        id: '',
        version: '1.0.0',
        name: 'Test',
        steps: [],
      }
      expect(WorkflowSchemaValidator.isValidWorkflow(invalidWorkflow)).toBe(
        false,
      )
    })
  })

  describe('Workflow Validation (Integration)', () => {
    it('should validate workflow with step references', () => {
      const workflow = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: [
          { id: 'step1', type: 'agent', agentId: '@test/agent1' },
          {
            id: 'step2',
            type: 'agent',
            agentId: '@test/agent2',
            dependsOn: ['step1'],
          },
        ],
      }
      const result = validateWorkflow(workflow)
      expect(result.steps).toHaveLength(2)
    })

    it('should reject workflow with circular dependencies', () => {
      const workflow = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: '@test/agent1',
            dependsOn: ['step2'],
          },
          {
            id: 'step2',
            type: 'agent',
            agentId: '@test/agent2',
            dependsOn: ['step1'],
          },
        ],
      }
      expect(() => validateWorkflow(workflow)).toThrow(
        'Circular dependency detected: step1 → step2 → step1',
      )
    })

    it('should reject workflow with invalid step reference', () => {
      const workflow = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: [
          { id: 'step1', type: 'agent', agentId: '@test/agent1' },
          {
            id: 'step2',
            type: 'agent',
            agentId: '@test/agent2',
            dependsOn: ['nonexistent'],
          },
        ],
      }
      expect(() => validateWorkflow(workflow)).toThrow(
        'depends on non-existent step: nonexistent',
      )
    })

    it('should reject workflow with self-dependency', () => {
      const workflow = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: '@test/agent1',
            dependsOn: ['step1'],
          },
        ],
      }
      expect(() => validateWorkflow(workflow)).toThrow(
        'Step step1 cannot depend on itself',
      )
    })

    it('should validate fallback step references', () => {
      const workflow = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: '@test/agent1',
            onError: 'fallback',
            fallbackStepId: 'fallback',
          },
          { id: 'fallback', type: 'agent', agentId: '@test/fallback-agent' },
        ],
      }
      const result = validateWorkflow(workflow)
      expect(result.steps[0].onError).toBe('fallback')
      expect(result.steps[0].fallbackStepId).toBe('fallback')
    })

    it('should reject workflow with invalid fallback reference', () => {
      const workflow = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: [
          {
            id: 'step1',
            type: 'agent',
            agentId: '@test/agent1',
            onError: 'fallback',
            fallbackStepId: 'missing',
          },
        ],
      }
      expect(() => validateWorkflow(workflow)).toThrow(
        'fallback references non-existent step: missing',
      )
    })
  })

  describe('Utility Functions', () => {
    it('should compute schema hash', () => {
      const hash = computeWorkflowSchemaHash()
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should check workflow validity', () => {
      const validWorkflow = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: [{ id: 'step1', type: 'agent', agentId: '@test/agent' }],
      }
      expect(isValidWorkflow(validWorkflow)).toBe(true)

      const invalidWorkflow = { id: '', steps: [] }
      expect(isValidWorkflow(invalidWorkflow)).toBe(false)
    })
  })

  describe('Expression Validation', () => {
    describe('Expression Syntax Validation', () => {
      it('should validate correct expression syntax', () => {
        const validExpressions = [
          '${steps.step1.output.data}',
          '${variables.userName}',
          '${env.API_KEY}',
          '${steps.step1.output.nested.value ?? "default"}',
          '${variables.config ?? null}',
        ]

        for (const expr of validExpressions) {
          const result = ExpressionValidator.validateExpressionSyntax(expr)
          expect(result.isValid).toBe(true)
          expect(result.errors).toHaveLength(0)
        }
      })

      it('should reject invalid expression syntax', () => {
        const invalidExpressions = [
          'not an expression',
          '${invalid}',
          '${steps.step1}', // missing .output
          '${env.}', // missing variable name
          '${variables.}', // missing variable name
        ]

        for (const expr of invalidExpressions) {
          const result = ExpressionValidator.validateExpressionSyntax(expr)
          expect(result.isValid).toBe(false)
          expect(result.errors.length).toBeGreaterThan(0)
        }
      })

      it('should detect prototype pollution attempts', () => {
        const maliciousExpressions = [
          '${variables.__proto__.test}',
          '${steps.step1.output.prototype.constructor}',
        ]

        for (const expr of maliciousExpressions) {
          const result = ExpressionValidator.validateExpressionSyntax(expr)
          expect(result.isValid).toBe(false)
          expect(
            result.errors.some((err) => err.includes('Prototype pollution')),
          ).toBe(true)
        }
      })

      it('should warn about deep nesting', () => {
        const deepExpression =
          '${variables.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z}'
        const result =
          ExpressionValidator.validateExpressionSyntax(deepExpression)
        expect(
          result.warnings.some((warn) => warn.includes('Deep property access')),
        ).toBe(true)
      })
    })

    describe('Expression Resolution', () => {
      const context = {
        steps: {
          step1: { output: { data: 'test-data', nested: { value: 42 } } },
          step2: { output: { items: [1, 2, 3], config: { name: 'test' } } },
        },
        variables: { userName: 'john', config: { theme: 'dark' } },
        env: { API_KEY: 'secret-key', NODE_ENV: 'test' },
      }

      it('should resolve step output references', () => {
        expect(
          ExpressionValidator.resolveExpression(
            '${steps.step1.output.data}',
            context,
          ),
        ).toBe('test-data')
        expect(
          ExpressionValidator.resolveExpression(
            '${steps.step1.output.nested.value}',
            context,
          ),
        ).toBe(42)
      })

      it('should resolve variable references', () => {
        expect(
          ExpressionValidator.resolveExpression(
            '${variables.userName}',
            context,
          ),
        ).toBe('john')
        expect(
          ExpressionValidator.resolveExpression(
            '${variables.config.theme}',
            context,
          ),
        ).toBe('dark')
      })

      it('should resolve environment references', () => {
        expect(
          ExpressionValidator.resolveExpression('${env.API_KEY}', context),
        ).toBe('secret-key')
        expect(
          ExpressionValidator.resolveExpression('${env.NODE_ENV}', context),
        ).toBe('test')
      })

      it('should handle array access', () => {
        expect(
          ExpressionValidator.resolveExpression(
            '${steps.step2.output.items[0]}',
            context,
          ),
        ).toBe(1)
        expect(
          ExpressionValidator.resolveExpression(
            '${steps.step2.output.items[2]}',
            context,
          ),
        ).toBe(3)
      })

      it('should handle default values', () => {
        expect(
          ExpressionValidator.resolveExpression(
            '${variables.missing ?? "default"}',
            context,
          ),
        ).toBe('default')
        expect(
          ExpressionValidator.resolveExpression(
            '${steps.step1.output.missing ?? 123}',
            context,
          ),
        ).toBe(123)
        expect(
          ExpressionValidator.resolveExpression(
            '${env.MISSING ?? null}',
            context,
          ),
        ).toBe(null)
      })

      it('should handle complex default values', () => {
        expect(
          ExpressionValidator.resolveExpression(
            '${variables.missing ?? true}',
            context,
          ),
        ).toBe(true)
        expect(
          ExpressionValidator.resolveExpression(
            '${variables.missing ?? false}',
            context,
          ),
        ).toBe(false)
        expect(
          ExpressionValidator.resolveExpression(
            '${variables.missing ?? [1,2,3]}',
            context,
          ),
        ).toEqual([1, 2, 3])
      })

      it('should throw on missing references without defaults', () => {
        expect(() =>
          ExpressionValidator.resolveExpression(
            '${variables.missing}',
            context,
          ),
        ).toThrow()
        expect(() =>
          ExpressionValidator.resolveExpression(
            '${steps.missing.output.data}',
            context,
          ),
        ).toThrow('not found or not completed')
      })

      it('should enforce security limits', () => {
        const secureContext = {
          ...context,
          security: {
            maxExpansionDepth: 2,
            maxExpansionSize: 100,
            allowEnvAccess: true,
          },
        }

        // This should fail due to depth limit
        expect(() =>
          ExpressionValidator.resolveExpression(
            '${variables.config.deep.nested.value}',
            secureContext,
          ),
        ).toThrow('Maximum expansion depth')

        // This should fail due to size limit with a large object
        const largeContext = {
          steps: { step1: { output: { data: 'x'.repeat(200) } } },
          variables: {},
          env: {},
          security: {
            maxExpansionDepth: 10,
            maxExpansionSize: 50,
            allowEnvAccess: true,
          },
        }
        expect(() =>
          ExpressionValidator.resolveExpression(
            '${steps.step1.output.data}',
            largeContext,
          ),
        ).toThrow('exceeds maximum allowed size')
      })

      it('should respect environment access controls', () => {
        const restrictedContext = {
          ...context,
          security: {
            maxExpansionDepth: 10,
            maxExpansionSize: 65536,
            allowEnvAccess: false,
          },
        }
        expect(() =>
          ExpressionValidator.resolveExpression(
            '${env.API_KEY}',
            restrictedContext,
          ),
        ).toThrow('Environment variable access is disabled')
      })

      it('should enforce allowedEnvVars whitelist from security config', () => {
        const whitelistContext = {
          steps: {},
          variables: {},
          env: {
            ALLOWED_VAR: 'allowed-value',
            DENIED_VAR: 'denied-value',
            PUBLIC_API_URL: 'https://api.example.com',
          },
          security: {
            maxExpansionDepth: 10,
            maxExpansionSize: 65536,
            allowEnvAccess: true,
            allowedEnvVars: ['ALLOWED_VAR', 'PUBLIC_API_URL'],
          },
        }

        // Should allow whitelisted env vars
        expect(
          ExpressionValidator.resolveExpression(
            '${env.ALLOWED_VAR}',
            whitelistContext,
          ),
        ).toBe('allowed-value')

        expect(
          ExpressionValidator.resolveExpression(
            '${env.PUBLIC_API_URL}',
            whitelistContext,
          ),
        ).toBe('https://api.example.com')

        // Should deny non-whitelisted env vars
        expect(() =>
          ExpressionValidator.resolveExpression(
            '${env.DENIED_VAR}',
            whitelistContext,
          ),
        ).toThrow(
          "Environment variable 'DENIED_VAR' is not in the allowed list",
        )

        // Should deny unknown env vars
        expect(() =>
          ExpressionValidator.resolveExpression(
            '${env.UNKNOWN_VAR}',
            whitelistContext,
          ),
        ).toThrow(
          "Environment variable 'UNKNOWN_VAR' is not in the allowed list",
        )
      })

      it('should use workflow allowedEnvVars when security config does not specify', () => {
        // Context with allowedEnvVars passed as workflow config
        const workflowConfig = {
          allowedEnvVars: ['WORKFLOW_ALLOWED', 'API_KEY'],
        }

        const workflowContext = {
          steps: {},
          variables: {},
          env: {
            WORKFLOW_ALLOWED: 'workflow-value',
            API_KEY: 'secret-key',
            NOT_ALLOWED: 'blocked-value',
          },
          security: {
            maxExpansionDepth: 10,
            maxExpansionSize: 65536,
            allowEnvAccess: true,
            // allowedEnvVars undefined means check workflow config
          },
          workflowConfig,
        }

        // Should allow vars from workflow allowedEnvVars
        expect(
          ExpressionValidator.resolveExpression(
            '${env.WORKFLOW_ALLOWED}',
            workflowContext,
          ),
        ).toBe('workflow-value')

        expect(
          ExpressionValidator.resolveExpression(
            '${env.API_KEY}',
            workflowContext,
          ),
        ).toBe('secret-key')

        // Should deny non-whitelisted env vars
        expect(() =>
          ExpressionValidator.resolveExpression(
            '${env.NOT_ALLOWED}',
            workflowContext,
          ),
        ).toThrow(
          "Environment variable 'NOT_ALLOWED' is not in the allowed list",
        )
      })

      it('should allow all env vars when no whitelist is specified', () => {
        const noWhitelistContext = {
          steps: {},
          variables: {},
          env: {
            ANY_VAR: 'any-value',
            ANOTHER_VAR: 'another-value',
          },
          security: {
            maxExpansionDepth: 10,
            maxExpansionSize: 65536,
            allowEnvAccess: true,
            // No allowedEnvVars specified
          },
          // No workflowConfig specified
        }

        // Should allow any env var when no whitelist
        expect(
          ExpressionValidator.resolveExpression(
            '${env.ANY_VAR}',
            noWhitelistContext,
          ),
        ).toBe('any-value')

        expect(
          ExpressionValidator.resolveExpression(
            '${env.ANOTHER_VAR}',
            noWhitelistContext,
          ),
        ).toBe('another-value')
      })
    })

    describe('Input Mapping Validation', () => {
      it('should validate input mapping with expressions', () => {
        const mapping = {
          username: '${variables.userName}',
          data: '${steps.step1.output.data}',
          nested: {
            value: '${steps.step1.output.nested.value ?? 0}',
          },
          plain: 'not an expression',
        }

        const result = ExpressionValidator.validateInputMapping(mapping)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should detect invalid expressions in mapping', () => {
        const mapping = {
          valid: '${variables.test}',
          invalid: '${invalid.reference}',
          malicious: '${variables.__proto__.test}',
        }

        const result = ExpressionValidator.validateInputMapping(mapping)
        expect(result.isValid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
        expect(
          result.errors.some((err) => err.includes('invalid.reference')),
        ).toBe(true)
        expect(
          result.errors.some((err) => err.includes('Prototype pollution')),
        ).toBe(true)
      })

      it('should extract all expressions from mapping', () => {
        const mapping = {
          a: '${variables.a}',
          b: {
            c: '${steps.step1.output.c}',
            d: ['${env.API_KEY}', 'plain string'],
          },
          plain: 'not an expression',
        }

        const expressions = ExpressionValidator.extractExpressions(mapping)
        expect(expressions).toEqual([
          '${variables.a}',
          '${steps.step1.output.c}',
          '${env.API_KEY}',
        ])
      })
    })
  })
})
