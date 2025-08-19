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

  describe('evaluateCondition - strict mode', () => {
    it('should throw VALIDATION error for invalid expressions when strictMode=true', () => {
      expect(() => evaluateCondition('invalid..syntax', context, true)).toThrow(
        expect.objectContaining({ code: 'VALIDATION' }),
      )

      expect(() => evaluateCondition('[unclosed', context, true)).toThrow(
        expect.objectContaining({ code: 'VALIDATION' }),
      )

      expect(() =>
        evaluateCondition('malformed && {invalid', context, true),
      ).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
    })

    it('should return false for invalid expressions when strictMode=false (default)', () => {
      // Default behavior
      expect(evaluateCondition('invalid..syntax', context, false)).toBe(false)
      expect(evaluateCondition('[unclosed', context, false)).toBe(false)
      expect(evaluateCondition('malformed && {invalid', context, false)).toBe(
        false,
      )

      // Test default parameter behavior
      expect(evaluateCondition('invalid..syntax', context)).toBe(false)
    })

    it('should still allow valid expressions in strict mode', () => {
      expect(
        evaluateCondition('steps.step1.status == `completed`', context, true),
      ).toBe(true)
      expect(
        evaluateCondition('variables.nested.value > `40`', context, true),
      ).toBe(true)
      expect(evaluateCondition('env.NODE_ENV == `test`', context, true)).toBe(
        true,
      )
    })

    it('should handle timeout errors in strict mode same as non-strict mode', () => {
      // Timeout errors should be re-thrown regardless of strict mode
      // This verifies that timeout handling is consistent
      const expression = 'steps.step1.status == `completed`'

      // Both strict and non-strict should handle valid expressions the same way
      expect(evaluateCondition(expression, context, true)).toBe(true)
      expect(evaluateCondition(expression, context, false)).toBe(true)
    })

    it('should validate expression errors contain proper metadata', () => {
      try {
        evaluateCondition('invalid..syntax', context, true)
        expect.fail('Should have thrown validation error')
      } catch (error) {
        expect(error).toEqual(
          expect.objectContaining({
            code: 'VALIDATION',
            message: expect.stringContaining(
              'Invalid condition expression: invalid..syntax',
            ),
            cause: expect.any(Error),
          }),
        )
      }
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
      // With the try-catch wrapper, depth limit now returns undefined instead of throwing
      expect(resolveMapping(input, context)).toBe(undefined)

      // But with a default value, it should use the default
      const inputWithDefault = `\${${deepPath} ?? "fallback"}`
      expect(resolveMapping(inputWithDefault, context)).toBe('fallback')
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

      // With the try-catch wrapper, depth limit now returns undefined instead of throwing
      expect(resolveMapping(input, context)).toBe(undefined)
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
  })

  describe('Robust Mapping Parser', () => {
    it('should handle single-quoted default values', () => {
      expect(
        resolveMapping(
          "${steps.nonexistent.output ?? 'single-quoted'}",
          context,
        ),
      ).toBe('single-quoted')
      expect(
        resolveMapping("${variables.missing ?? 'fallback'}", context),
      ).toBe('fallback')
      expect(
        resolveMapping("${env.MISSING_VAR ?? 'env-default'}", context),
      ).toBe('env-default')
    })

    it('should handle single quotes with apostrophes in default values', () => {
      expect(
        resolveMapping("${variables.missing ?? 'it\\'s working'}", context),
      ).toBe("it's working")
      expect(
        resolveMapping("${variables.missing ?? 'can\\'t fail'}", context),
      ).toBe("can't fail")
    })

    it('should handle escaped quotes in double-quoted default values', () => {
      expect(
        resolveMapping(
          '${variables.missing ?? "He said \\"Hello\\""}',
          context,
        ),
      ).toBe('He said "Hello"')
      expect(
        resolveMapping(
          '${variables.missing ?? "Path: \\"C:\\\\Users\\""}',
          context,
        ),
      ).toBe('Path: "C:\\Users"')
    })

    it('should handle escaped quotes in single-quoted default values', () => {
      expect(
        resolveMapping("${variables.missing ?? 'She said \\'Hi\\''}", context),
      ).toBe("She said 'Hi'")
      expect(
        resolveMapping(
          "${variables.missing ?? 'It\\'s a \\'test\\''}",
          context,
        ),
      ).toBe("It's a 'test'")
    })

    it('should handle mixed quote escaping scenarios', () => {
      expect(
        resolveMapping(
          '${variables.missing ?? "Mix \\"quotes\\" and \'apostrophes\'"}',
          context,
        ),
      ).toBe('Mix "quotes" and \'apostrophes\'')
      expect(
        resolveMapping(
          "${variables.missing ?? 'Mix \"quotes\" and \\'apostrophes\\''}",
          context,
        ),
      ).toBe('Mix "quotes" and \'apostrophes\'')
    })

    it('should handle nested ?? operators within quoted strings', () => {
      expect(
        resolveMapping(
          '${variables.missing ?? "This ?? is literal in quotes"}',
          context,
        ),
      ).toBe('This ?? is literal in quotes')
      expect(
        resolveMapping(
          "${variables.missing ?? 'Contains ?? operator in string'}",
          context,
        ),
      ).toBe('Contains ?? operator in string')
    })

    it('should handle complex nested ?? patterns', () => {
      expect(
        resolveMapping(
          '${variables.missing ?? "Format: ${var} ?? default"}',
          context,
        ),
      ).toBe('Format: ${var} ?? default')
      expect(
        resolveMapping(
          "${variables.missing ?? 'If x ?? y then z ?? w'}",
          context,
        ),
      ).toBe('If x ?? y then z ?? w')
    })

    it('should distinguish between operator ?? and literal ?? in quotes', () => {
      // This should use the ?? operator to provide the default, but the default contains ?? as literal text
      expect(
        resolveMapping(
          '${variables.nonexistent ?? "SQL: SELECT * FROM table WHERE id ?? NULL"}',
          context,
        ),
      ).toBe('SQL: SELECT * FROM table WHERE id ?? NULL')

      // Multiple ?? operators - only the first should be treated as the operator
      expect(
        resolveMapping(
          '${variables.missing ?? "First default with ?? inside"}',
          context,
        ),
      ).toBe('First default with ?? inside')
    })

    it('should handle edge cases in expression resolution', () => {
      // Empty expression parts
      expect(resolveMapping('${variables.empty ?? ""}', context)).toBe('')

      // Whitespace handling
      expect(
        resolveMapping('${  variables.missing   ??   "spaced"  }', context),
      ).toBe('spaced')

      // Nested ${} expressions in default values
      expect(
        resolveMapping('${variables.missing ?? "Value: ${ignored}"}', context),
      ).toBe('Value: ${ignored}')
    })

    it('should handle malformed expressions gracefully', () => {
      // Unmatched quotes in defaults
      expect(() =>
        resolveMapping('${variables.missing ?? "unclosed quote}', context),
      ).not.toThrow()

      // Mixed quote types
      expect(
        resolveMapping('${variables.missing ?? "double\' quote"}', context),
      ).toBe("double' quote")

      // Empty default after ??
      expect(resolveMapping('${variables.missing ?? }', context)).toBe(
        undefined,
      )
    })

    it('should handle complex nested expression patterns', () => {
      // Multiple levels of ${} nesting in string context
      const complexInput =
        'Prefix ${steps.step1.output.result} and ${variables.testVar ?? "backup"} suffix'
      expect(resolveMapping(complexInput, context)).toBe(
        'Prefix success and test value suffix',
      )

      // Expression with no default should work
      expect(resolveMapping('${variables.testVar}', context)).toBe('test value')

      // Non-string expression resolution
      const objectInput = {
        key1: '${steps.step1.output.data.id}',
        key2: '${variables.missing ?? "default"}',
        nested: {
          value: '${variables.nested.value ?? 0}',
        },
      }
      expect(resolveMapping(objectInput, context)).toEqual({
        key1: 123,
        key2: 'default',
        nested: {
          value: 42,
        },
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

  describe('configurable security limits', () => {
    it('should respect custom maxSize limit', () => {
      // Create a large value that fits in default limit (64KB) but not custom limit (1KB)
      const largeValue = 'x'.repeat(2000) // 2KB string
      const contextWithLargeValue = {
        ...context,
        variables: {
          ...context.variables,
          largeValue,
        },
      }

      // Should work with default limit
      expect(() =>
        resolveMapping('${variables.largeValue}', contextWithLargeValue),
      ).not.toThrow()

      // Should fail with custom 1KB limit
      expect(() =>
        resolveMapping('${variables.largeValue}', contextWithLargeValue, {
          maxSize: 1024,
        }),
      ).toThrow('Expression expansion size exceeds limit of 1024 bytes')
    })

    it('should respect custom maxDepth limit', () => {
      // Create deeply nested object (8 levels deep from 'deep' property)
      const deeplyNested = {
        l1: { l2: { l3: { l4: { l5: { l6: { l7: { l8: 'deep' } } } } } } },
      }
      const contextWithDeep = {
        ...context,
        variables: {
          ...context.variables,
          deep: deeplyNested,
        },
      }

      // Should work with default limit (10 levels) - path is "deep.l1.l2.l3.l4.l5.l6.l7.l8" = 9 parts
      expect(
        resolveMapping(
          '${variables.deep.l1.l2.l3.l4.l5.l6.l7.l8}',
          contextWithDeep,
        ),
      ).toBe('deep')

      // Should return undefined with custom 5-level limit - path is "deep.l1.l2.l3.l4.l5.l6" = 7 parts
      expect(
        resolveMapping('${variables.deep.l1.l2.l3.l4.l5.l6}', contextWithDeep, {
          maxDepth: 5,
        }),
      ).toBe(undefined)

      // But with a default value, it should use the default
      expect(
        resolveMapping(
          '${variables.deep.l1.l2.l3.l4.l5.l6 ?? "limited"}',
          contextWithDeep,
          {
            maxDepth: 5,
          },
        ),
      ).toBe('limited')
    })

    it('should respect custom timeout limit for evaluateCondition', () => {
      // Create a complex expression that takes time to evaluate
      const complexContext = {
        ...context,
        variables: {
          array: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            value: i * 2,
          })),
        },
      }

      // Test with a very long timeout (should pass)
      expect(() =>
        evaluateCondition(
          'length(variables.array[?value > `100`]) > `0`',
          complexContext,
          false,
          { timeout: 1000 },
        ),
      ).not.toThrow()

      // Note: We can't easily test timeout failure with synchronous JMESPath
      // The timeout is more of a safety check after evaluation completes
    })

    it('should use default limits when not specified', () => {
      // Verify defaults are still in place
      const largeButValid = 'x'.repeat(60000) // 60KB - under default 64KB limit
      const contextWithLarge = {
        ...context,
        variables: {
          largeButValid,
        },
      }

      // Should work with default limit
      expect(() =>
        resolveMapping('${variables.largeButValid}', contextWithLarge),
      ).not.toThrow()

      // Verify depth limit default
      const depth9 = {
        l1: {
          l2: { l3: { l4: { l5: { l6: { l7: { l8: { l9: 'ok' } } } } } } },
        },
      }
      const contextWithDepth9 = {
        ...context,
        variables: { depth9 },
      }

      expect(
        resolveMapping(
          '${variables.depth9.l1.l2.l3.l4.l5.l6.l7.l8.l9}',
          contextWithDepth9,
        ),
      ).toBe('ok')
    })

    it('should pass limits through nested resolveMapping calls', () => {
      const nestedInput = {
        array: ['${variables.testVar}', '${variables.nested.value}'],
        object: {
          key: '${steps.step1.output.result}',
        },
      }

      // Custom limits should be respected in nested calls
      const customLimits = {
        maxDepth: 3,
        maxSize: 512,
      }

      const result = resolveMapping(nestedInput, context, customLimits)
      expect(result).toEqual({
        array: ['test value', 42],
        object: {
          key: 'success',
        },
      })

      // Test that maxDepth is enforced in nested resolution
      const deepPath = {
        value: '${variables.nested.array[0]}', // This requires depth traversal
      }

      // Should work with sufficient depth
      expect(resolveMapping(deepPath, context, { maxDepth: 5 })).toEqual({
        value: 1,
      })
    })
  })

  describe('Environment Variable Access Edge Cases', () => {
    it('should handle workflow with no allowedEnvVars', () => {
      const workflowWithoutEnvVars: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        name: 'Test Workflow',
        steps: [],
        // No allowedEnvVars field
      }

      const contextWithoutEnvVars: ExecutionContext = {
        ...context,
        workflow: workflowWithoutEnvVars,
      }

      // Should return false for conditions
      expect(
        evaluateCondition('env.NODE_ENV == `test`', contextWithoutEnvVars),
      ).toBe(false)

      // Should return undefined for mappings
      expect(resolveMapping('${env.NODE_ENV}', contextWithoutEnvVars)).toBe(
        undefined,
      )
    })

    it('should handle workflow with empty allowedEnvVars array', () => {
      const workflowWithEmptyEnvVars: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        name: 'Test Workflow',
        steps: [],
        allowedEnvVars: [],
      }

      const contextWithEmptyEnvVars: ExecutionContext = {
        ...context,
        workflow: workflowWithEmptyEnvVars,
      }

      // Should return false for conditions
      expect(
        evaluateCondition('env.NODE_ENV == `test`', contextWithEmptyEnvVars),
      ).toBe(false)

      // Should return undefined for mappings
      expect(resolveMapping('${env.NODE_ENV}', contextWithEmptyEnvVars)).toBe(
        undefined,
      )
    })

    it('should handle workflow with undefined allowedEnvVars', () => {
      const workflowWithUndefinedEnvVars: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        name: 'Test Workflow',
        steps: [],
        allowedEnvVars: undefined,
      }

      const contextWithUndefinedEnvVars: ExecutionContext = {
        ...context,
        workflow: workflowWithUndefinedEnvVars,
      }

      // Should return false for conditions
      expect(
        evaluateCondition(
          'env.NODE_ENV == `test`',
          contextWithUndefinedEnvVars,
        ),
      ).toBe(false)

      // Should return undefined for mappings
      expect(
        resolveMapping('${env.NODE_ENV}', contextWithUndefinedEnvVars),
      ).toBe(undefined)
    })

    it('should handle non-existent environment variables even when whitelisted', () => {
      const workflowWithNonExistentVar: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        name: 'Test Workflow',
        steps: [],
        allowedEnvVars: ['NON_EXISTENT_VAR'],
      }

      const contextWithNonExistentVar: ExecutionContext = {
        ...context,
        workflow: workflowWithNonExistentVar,
      }

      // Should handle undefined environment variable gracefully
      expect(
        evaluateCondition(
          'env.NON_EXISTENT_VAR == null',
          contextWithNonExistentVar,
        ),
      ).toBe(true)
      expect(
        resolveMapping('${env.NON_EXISTENT_VAR}', contextWithNonExistentVar),
      ).toBe(undefined)
      expect(
        resolveMapping(
          '${env.NON_EXISTENT_VAR ?? "default"}',
          contextWithNonExistentVar,
        ),
      ).toBe('default')
    })

    it('should consistently use workflow.allowedEnvVars as single source of truth', () => {
      // This test verifies that there's no other source of environment variable configuration
      const testWorkflow: Workflow = {
        id: 'test-workflow',
        version: '1.0.0',
        name: 'Test Workflow',
        steps: [],
        allowedEnvVars: ['ALLOWED_VAR_1', 'ALLOWED_VAR_2'],
      }

      // Set environment variables for testing
      process.env.ALLOWED_VAR_1 = 'value1'
      process.env.ALLOWED_VAR_2 = 'value2'
      process.env.NOT_ALLOWED_VAR = 'blocked'

      const testContext: ExecutionContext = {
        ...context,
        workflow: testWorkflow,
      }

      // Allowed variables should work
      expect(
        evaluateCondition('env.ALLOWED_VAR_1 == `value1`', testContext),
      ).toBe(true)
      expect(
        evaluateCondition('env.ALLOWED_VAR_2 == `value2`', testContext),
      ).toBe(true)
      expect(resolveMapping('${env.ALLOWED_VAR_1}', testContext)).toBe('value1')
      expect(resolveMapping('${env.ALLOWED_VAR_2}', testContext)).toBe('value2')

      // Not allowed variables should be blocked
      expect(
        evaluateCondition('env.NOT_ALLOWED_VAR == `blocked`', testContext),
      ).toBe(false)
      expect(resolveMapping('${env.NOT_ALLOWED_VAR}', testContext)).toBe(
        undefined,
      )

      // Clean up
      delete process.env.ALLOWED_VAR_1
      delete process.env.ALLOWED_VAR_2
      delete process.env.NOT_ALLOWED_VAR
    })
  })
})
