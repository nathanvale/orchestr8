import type { ExecutionContext, Workflow, StepResult } from '@orchestr8/schema'

import { createExecutionError } from '@orchestr8/schema'
import { describe, expect, it, beforeEach } from 'vitest'

import {
  evaluateCondition,
  resolveMapping,
  clearExpressionCache,
  SECURITY_LIMITS,
  PROTOTYPE_POLLUTION_KEYS,
} from './expression-evaluator.js'

describe('Expression Evaluator', () => {
  let context: ExecutionContext

  beforeEach(() => {
    clearExpressionCache()

    const workflow: Workflow = {
      id: 'test-workflow',
      version: '1.0.0',
      name: 'Test Workflow',
      steps: [],
      allowedEnvVars: ['NODE_ENV', 'TEST_VAR'],
    }

    context = {
      executionId: 'exec-123',
      workflow,
      variables: {
        testVar: 'test value',
        nested: {
          value: 42,
          array: [1, 2, 3],
        },
      },
      steps: {
        step1: {
          stepId: 'step1',
          status: 'completed',
          output: { result: 'success', data: { id: 123 } },
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-01T00:00:01Z',
        },
        step2: {
          stepId: 'step2',
          status: 'failed',
          error: createExecutionError('UNKNOWN', 'Step failed'),
          startTime: '2024-01-01T00:00:01Z',
          endTime: '2024-01-01T00:00:02Z',
        },
      },
    }

    // Set test environment variables
    process.env.NODE_ENV = 'test'
    process.env.TEST_VAR = 'env-value'
    process.env.SECRET_VAR = 'should-not-be-accessible'
  })

  describe('evaluateCondition', () => {
    it('should return true when no expression is provided', () => {
      expect(evaluateCondition('', context)).toBe(true)
    })

    it('should evaluate JMESPath expressions using search (not compile)', () => {
      // This tests that we're using jmespath.search correctly
      expect(
        evaluateCondition('steps.step1.status == `completed`', context),
      ).toBe(true)
      expect(
        evaluateCondition('steps.step2.status == `completed`', context),
      ).toBe(false)
    })

    it('should handle complex JMESPath queries', () => {
      expect(evaluateCondition('variables.nested.value > `40`', context)).toBe(
        true,
      )
      expect(evaluateCondition('variables.nested.value < `40`', context)).toBe(
        false,
      )
      expect(
        evaluateCondition('length(variables.nested.array) == `3`', context),
      ).toBe(true)
    })

    it('should access whitelisted environment variables', () => {
      expect(evaluateCondition('env.NODE_ENV == `test`', context)).toBe(true)
      expect(evaluateCondition('env.TEST_VAR == `env-value`', context)).toBe(
        true,
      )
    })

    it('should not access non-whitelisted environment variables', () => {
      expect(evaluateCondition('env.SECRET_VAR', context)).toBe(false)
      expect(
        evaluateCondition(
          'env.SECRET_VAR == `should-not-be-accessible`',
          context,
        ),
      ).toBe(false)
    })

    it('should cache expressions for performance', () => {
      const expression = 'steps.step1.status == `completed`'

      // First evaluation
      expect(evaluateCondition(expression, context)).toBe(true)

      // Second evaluation should use cache
      expect(evaluateCondition(expression, context)).toBe(true)
    })

    it('should return false for invalid expressions', () => {
      expect(evaluateCondition('invalid..syntax', context)).toBe(false)
      expect(evaluateCondition('[unclosed', context)).toBe(false)
    })
  })

  describe('resolveMapping', () => {
    it('should resolve step output references', () => {
      const input = '${steps.step1.output.result}'
      expect(resolveMapping(input, context)).toBe('success')
    })

    it('should resolve nested step output references', () => {
      const input = '${steps.step1.output.data.id}'
      expect(resolveMapping(input, context)).toBe(123)
    })

    it('should resolve variable references', () => {
      const input = '${variables.testVar}'
      expect(resolveMapping(input, context)).toBe('test value')
    })

    it('should resolve nested variable references', () => {
      const input = '${variables.nested.value}'
      expect(resolveMapping(input, context)).toBe(42)
    })

    it('should resolve environment variables (whitelisted only)', () => {
      const input = '${env.NODE_ENV}'
      expect(resolveMapping(input, context)).toBe('test')
    })

    it('should not resolve non-whitelisted environment variables', () => {
      const input = '${env.SECRET_VAR}'
      expect(resolveMapping(input, context)).toBe(undefined)
    })

    it('should handle default values with ?? operator', () => {
      expect(
        resolveMapping('${steps.nonexistent.output ?? "default"}', context),
      ).toBe('default')
      expect(
        resolveMapping('${variables.missing ?? "fallback"}', context),
      ).toBe('fallback')
      expect(
        resolveMapping('${env.MISSING_VAR ?? "env-default"}', context),
      ).toBe('env-default')
    })

    it('should resolve multiple expressions in a string', () => {
      const input =
        'Step ${steps.step1.stepId} had output: ${steps.step1.output.result}'
      expect(resolveMapping(input, context)).toBe(
        'Step step1 had output: success',
      )
    })

    it('should resolve expressions in objects', () => {
      const input = {
        stepOutput: '${steps.step1.output.result}',
        variable: '${variables.testVar}',
        nested: {
          value: '${variables.nested.value}',
        },
      }

      expect(resolveMapping(input, context)).toEqual({
        stepOutput: 'success',
        variable: 'test value',
        nested: {
          value: 42,
        },
      })
    })

    it('should resolve expressions in arrays', () => {
      const input = [
        '${steps.step1.output.result}',
        '${variables.nested.value}',
        'literal string',
      ]

      expect(resolveMapping(input, context)).toEqual([
        'success',
        42,
        'literal string',
      ])
    })

    it('should enforce depth limit', () => {
      // Create a deeply nested object
      let deeplyNested: Record<string, unknown> = { value: 'deep' }
      for (let i = 0; i < SECURITY_LIMITS.maxDepth + 2; i++) {
        deeplyNested = { nested: deeplyNested }
      }
      context.variables.deeplyNested = deeplyNested

      // Try to access the deeply nested value
      let deepPath = 'variables.deeplyNested'
      for (let i = 0; i < SECURITY_LIMITS.maxDepth + 1; i++) {
        deepPath += '.nested'
      }

      const input = `\${${deepPath}}`
      expect(() => resolveMapping(input, context)).toThrow(
        'depth exceeds limit',
      )
    })

    it('should block prototype pollution keys', () => {
      // Test blocking __proto__
      expect(() => resolveMapping('${variables.__proto__}', context)).toThrow(
        "Access to dangerous property '__proto__' is not allowed",
      )

      // Test blocking constructor
      expect(() => resolveMapping('${variables.constructor}', context)).toThrow(
        "Access to dangerous property 'constructor' is not allowed",
      )

      // Test blocking prototype
      expect(() => resolveMapping('${variables.prototype}', context)).toThrow(
        "Access to dangerous property 'prototype' is not allowed",
      )
    })

    it('should block prototype pollution keys in array access', () => {
      expect(() =>
        resolveMapping('${variables.__proto__[0]}', context),
      ).toThrow("Access to dangerous property '__proto__' is not allowed")
    })

    it('should handle array index access', () => {
      const input = '${variables.nested.array[1]}'
      expect(resolveMapping(input, context)).toBe(2) // Second element of [1, 2, 3]
    })

    it('should return undefined for invalid array access', () => {
      expect(resolveMapping('${variables.nested.array[10]}', context)).toBe(
        undefined,
      )
      expect(resolveMapping('${variables.notAnArray[0]}', context)).toBe(
        undefined,
      )
    })

    it('should follow precedence order: steps > variables > env', () => {
      // Set up conflicting names
      context.variables.NODE_ENV = 'from-variables'
      context.steps.NODE_ENV = {
        stepId: 'NODE_ENV',
        status: 'completed',
        output: 'from-steps',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T00:00:01Z',
      } as StepResult

      // Steps should take precedence
      expect(resolveMapping('${steps.NODE_ENV.output}', context)).toBe(
        'from-steps',
      )

      // Variables come next
      expect(resolveMapping('${variables.NODE_ENV}', context)).toBe(
        'from-variables',
      )

      // Env comes last
      expect(resolveMapping('${env.NODE_ENV}', context)).toBe('test')
    })
  })

  describe('Security Limits', () => {
    it('should enforce 500ms timeout', () => {
      expect(SECURITY_LIMITS.timeout).toBe(500)
    })

    it('should enforce 10 level depth limit', () => {
      expect(SECURITY_LIMITS.maxDepth).toBe(10)
    })

    it('should enforce 64KB size limit', () => {
      expect(SECURITY_LIMITS.maxSize).toBe(64 * 1024)
    })

    it('should block all dangerous prototype keys', () => {
      expect(PROTOTYPE_POLLUTION_KEYS).toEqual([
        '__proto__',
        'constructor',
        'prototype',
      ])
    })
  })

  describe('Timeout Enforcement', () => {
    it('should allow fast expressions within timeout limit', () => {
      // This should complete quickly and not timeout
      expect(
        evaluateCondition('steps.step1.status == `completed`', context),
      ).toBe(true)
    })

    it('should have timeout mechanism ready for long expressions', () => {
      // Test that the timeout function exists and can be called
      // The actual timeout testing would require complex JMESPath expressions
      // that take longer than 500ms to evaluate, which is difficult to create reliably
      expect(SECURITY_LIMITS.timeout).toBe(500)
    })
  })

  describe('Expression Size Limits', () => {
    it('should enforce 64KB expansion size limit', () => {
      // Create a large string that will exceed 64KB when expanded
      const largeString = 'x'.repeat(70 * 1024) // 70KB string
      context.variables.largeData = largeString

      const input = '${variables.largeData}'

      // This should throw a VALIDATION error when size limit is exceeded
      expect(() => resolveMapping(input, context)).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/expansion size exceeds limit/i),
        }),
      )
    })

    it('should allow expansions under 64KB limit', () => {
      // Create a string under the limit
      const mediumString = 'x'.repeat(32 * 1024) // 32KB string
      context.variables.mediumData = mediumString

      const input = '${variables.mediumData}'

      // This should work fine
      expect(resolveMapping(input, context)).toBe(mediumString)
    })

    it('should count UTF-8 bytes correctly for size limit', () => {
      // Create string with multi-byte UTF-8 characters
      const unicodeString = '🚀'.repeat(20 * 1024) // Each emoji is 4 bytes = 80KB total
      context.variables.unicodeData = unicodeString

      const input = '${variables.unicodeData}'

      // This should throw due to UTF-8 byte size exceeding limit
      expect(() => resolveMapping(input, context)).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/expansion size exceeds limit/i),
        }),
      )
    })

    it('should handle nested object expansions approaching size limit', () => {
      // Create nested object that when stringified approaches limit
      const largeNestedObject = {
        data: 'x'.repeat(60 * 1024), // 60KB
        metadata: {
          info: 'additional data that pushes over limit',
          moreData: 'x'.repeat(10 * 1024), // Additional 10KB = total ~70KB
        },
      }
      context.variables.largeObject = largeNestedObject

      const input = '${variables.largeObject}'

      // Should throw when full object serialization exceeds limit
      expect(() => resolveMapping(input, context)).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/expansion size exceeds limit/i),
        }),
      )
    })
  })

  describe('Pathological Expression Security', () => {
    it('should prevent circular reference exploits', () => {
      // Create circular reference object
      const circularObj: Record<string, unknown> = { name: 'circular' }
      circularObj.self = circularObj
      context.variables.circularData = circularObj

      const input = '${variables.circularData}'

      // Should throw VALIDATION error due to circular reference
      expect(() => resolveMapping(input, context)).toThrow(
        expect.objectContaining({
          code: 'VALIDATION',
          message: expect.stringMatching(/could not be serialized/i),
        }),
      )
    })

    it('should handle large array expansions', () => {
      // Create large array that exceeds size limit when serialized
      const largeArray = new Array(20000).fill('x'.repeat(100)) // ~2MB array
      context.variables.largeArray = largeArray

      const input = '${variables.largeArray}'

      // Should throw due to size limit
      expect(() => resolveMapping(input, context)).toThrow(
        expect.objectContaining({
          code: 'VALIDATION',
          message: expect.stringMatching(/expansion size exceeds limit/i),
        }),
      )
    })

    it('should prevent prototype pollution attempts', () => {
      // Test all dangerous keys are blocked
      const dangerousKeys = ['__proto__', 'constructor', 'prototype']

      dangerousKeys.forEach((key) => {
        expect(() => resolveMapping(`\${variables.${key}}`, context)).toThrow(
          `Access to dangerous property '${key}' is not allowed`,
        )
      })
    })

    it('should handle deeply nested objects within depth limit', () => {
      // Create object at depth limit minus path overhead
      // We need to account for 'maxDepthData' being one level in the path
      let nested: Record<string, unknown> = { value: 'deep' }
      for (let i = 0; i < SECURITY_LIMITS.maxDepth - 2; i++) {
        // -2 for maxDepthData and value
        nested = { level: nested }
      }
      context.variables.maxDepthData = nested

      // Build path within limit
      let path = 'variables.maxDepthData'
      for (let i = 0; i < SECURITY_LIMITS.maxDepth - 2; i++) {
        path += '.level'
      }
      path += '.value'

      const input = `\${${path}}`

      // This should work - within limit
      expect(resolveMapping(input, context)).toBe('deep')
    })

    it('should block access beyond depth limit', () => {
      // Create deeply nested object beyond limit
      let deepNested: Record<string, unknown> = { value: 'too-deep' }
      for (let i = 0; i < SECURITY_LIMITS.maxDepth + 5; i++) {
        deepNested = { level: deepNested }
      }
      context.variables.tooDeepData = deepNested

      // Try to access beyond depth limit
      let deepPath = 'variables.tooDeepData'
      for (let i = 0; i < SECURITY_LIMITS.maxDepth + 1; i++) {
        deepPath += '.level'
      }

      const input = `\${${deepPath}}`

      // Should throw depth limit error
      expect(() => resolveMapping(input, context)).toThrow(
        'depth exceeds limit',
      )
    })

    it('should handle malformed default expressions safely', () => {
      // Test various malformed default expressions
      const malformedExpressions = [
        '${nonexistent ?? }',
        '${nonexistent ?? "unclosed quote}',
        '${nonexistent ?? nested ?? default}',
        '${?? "no-expression"}',
      ]

      malformedExpressions.forEach((expr) => {
        // Should not crash, should handle gracefully
        expect(() => resolveMapping(expr, context)).not.toThrow()
        // Result can be undefined, but shouldn't crash
      })
    })

    it('should prevent environment variable enumeration', () => {
      // Try to access non-whitelisted env vars
      expect(resolveMapping('${env.PATH}', context)).toBe(undefined)
      expect(resolveMapping('${env.HOME}', context)).toBe(undefined)
      expect(resolveMapping('${env.SECRET_KEY}', context)).toBe(undefined)

      // Only whitelisted vars should work
      expect(resolveMapping('${env.NODE_ENV}', context)).toBe('test')
      expect(resolveMapping('${env.TEST_VAR}', context)).toBe('env-value')
    })
  })
})
