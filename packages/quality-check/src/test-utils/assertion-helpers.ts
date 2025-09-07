/**
 * Standardized assertion helpers for engine results
 * Provides consistent and readable assertions for QualityChecker results
 */

import { expect } from 'vitest'
import type { QualityCheckResult, CheckerResult, FixResult } from '../types.js'
import type { ExpectedEngineResult } from './modern-fixtures.js'

/**
 * Assertion helper for QualityCheckResult
 */
export class QualityResultAssertions {
  constructor(private result: QualityCheckResult) {}

  /**
   * Assert overall success/failure
   */
  shouldSucceed(): this {
    expect(this.result.success).toBe(true)
    return this
  }

  shouldFail(): this {
    expect(this.result.success).toBe(false)
    return this
  }

  /**
   * Assert specific engine results
   */
  shouldHaveESLintResults(): ESLintResultAssertions {
    expect(this.result.checkers.eslint).toBeDefined()
    return new ESLintResultAssertions(this.result.checkers.eslint!)
  }

  shouldHaveTypeScriptResults(): TypeScriptResultAssertions {
    expect(this.result.checkers.typescript).toBeDefined()
    return new TypeScriptResultAssertions(this.result.checkers.typescript!)
  }

  shouldHavePrettierResults(): PrettierResultAssertions {
    expect(this.result.checkers.prettier).toBeDefined()
    return new PrettierResultAssertions(this.result.checkers.prettier!)
  }

  /**
   * Assert result matches expected structure
   */
  shouldMatch(expected: {
    success: boolean
    eslint?: ExpectedEngineResult
    typescript?: ExpectedEngineResult
    prettier?: ExpectedEngineResult
  }): this {
    expect(this.result.success).toBe(expected.success)

    if (expected.eslint) {
      this.shouldHaveESLintResults().shouldMatch(expected.eslint)
    }

    if (expected.typescript) {
      this.shouldHaveTypeScriptResults().shouldMatch(expected.typescript)
    }

    if (expected.prettier) {
      this.shouldHavePrettierResults().shouldMatch(expected.prettier)
    }

    return this
  }
}

/**
 * ESLint-specific result assertions
 */
export class ESLintResultAssertions {
  constructor(private result: CheckerResult) {}

  shouldSucceed(): this {
    expect(this.result.success).toBe(true)
    expect(this.result.errors || []).toHaveLength(0)
    return this
  }

  shouldFail(): this {
    expect(this.result.success).toBe(false)
    expect((this.result.errors || []).length).toBeGreaterThan(0)
    return this
  }

  shouldHaveErrors(count: number): this {
    expect(this.result.errors || []).toHaveLength(count)
    return this
  }

  shouldHaveWarnings(count: number): this {
    expect(this.result.warnings || []).toHaveLength(count)
    return this
  }

  shouldContainError(ruleOrMessage: string): this {
    const errors = this.result.errors || []
    const hasError = errors.some((error) => error.includes(ruleOrMessage))
    expect(hasError).toBe(true)
    return this
  }

  shouldContainWarning(ruleOrMessage: string): this {
    const warnings = this.result.warnings || []
    const hasWarning = warnings.some((warning) => warning.includes(ruleOrMessage))
    expect(hasWarning).toBe(true)
    return this
  }

  shouldMatch(expected: ExpectedEngineResult): this {
    expect(this.result.success).toBe(expected.success)

    if (expected.errorCount !== undefined) {
      expect(this.result.errors || []).toHaveLength(expected.errorCount)
    }

    if (expected.warningCount !== undefined) {
      expect(this.result.warnings || []).toHaveLength(expected.warningCount)
    }

    if (expected.containsErrors) {
      for (const errorPattern of expected.containsErrors) {
        this.shouldContainError(errorPattern)
      }
    }

    if (expected.containsWarnings) {
      for (const warningPattern of expected.containsWarnings) {
        this.shouldContainWarning(warningPattern)
      }
    }

    return this
  }
}

/**
 * TypeScript-specific result assertions
 */
export class TypeScriptResultAssertions {
  constructor(private result: CheckerResult) {}

  shouldSucceed(): this {
    expect(this.result.success).toBe(true)
    expect(this.result.errors || []).toHaveLength(0)
    return this
  }

  shouldFail(): this {
    expect(this.result.success).toBe(false)
    expect((this.result.errors || []).length).toBeGreaterThan(0)
    return this
  }

  shouldHaveErrors(count: number): this {
    expect(this.result.errors || []).toHaveLength(count)
    return this
  }

  shouldContainError(errorCode: string): this {
    const errors = this.result.errors || []
    const hasError = errors.some((error) => error.includes(errorCode))
    expect(hasError).toBe(true)
    return this
  }

  shouldHaveStrictModeErrors(): this {
    const strictErrors = ['TS2533', 'TS2531', 'TS2345', 'TS7006']
    const errors = this.result.errors || []
    const hasStrictError = errors.some((error) => strictErrors.some((code) => error.includes(code)))
    expect(hasStrictError).toBe(true)
    return this
  }

  shouldHaveUnusedErrors(): this {
    const errors = this.result.errors || []
    const hasUnusedError = errors.some(
      (error) => error.includes('TS6133') || error.includes('unused'),
    )
    expect(hasUnusedError).toBe(true)
    return this
  }

  shouldMatch(expected: ExpectedEngineResult): this {
    expect(this.result.success).toBe(expected.success)

    if (expected.errorCount !== undefined) {
      expect(this.result.errors || []).toHaveLength(expected.errorCount)
    }

    if (expected.containsErrors) {
      for (const errorCode of expected.containsErrors) {
        this.shouldContainError(errorCode)
      }
    }

    return this
  }
}

/**
 * Prettier-specific result assertions
 */
export class PrettierResultAssertions {
  constructor(private result: CheckerResult) {}

  shouldSucceed(): this {
    expect(this.result.success).toBe(true)
    expect(this.result.errors || []).toHaveLength(0)
    return this
  }

  shouldFail(): this {
    expect(this.result.success).toBe(false)
    expect((this.result.errors || []).length).toBeGreaterThan(0)
    return this
  }

  shouldHaveFormattingIssues(count: number): this {
    expect(this.result.errors || []).toHaveLength(count)
    return this
  }

  shouldContainFormattingError(fileOrPattern: string): this {
    const errors = this.result.errors || []
    const hasError = errors.some(
      (error) => error.includes(fileOrPattern) || error.includes('formatting'),
    )
    expect(hasError).toBe(true)
    return this
  }

  shouldMatch(expected: ExpectedEngineResult): this {
    expect(this.result.success).toBe(expected.success)

    if (expected.errorCount !== undefined) {
      expect(this.result.errors || []).toHaveLength(expected.errorCount)
    }

    return this
  }
}

/**
 * Fix result assertions
 */
export class FixResultAssertions {
  constructor(private result: FixResult) {}

  shouldSucceed(): this {
    expect(this.result.success).toBe(true)
    return this
  }

  shouldFail(): this {
    expect(this.result.success).toBe(false)
    return this
  }

  shouldHaveFixedCount(count: number): this {
    expect(this.result.count).toBe(count)
    return this
  }

  shouldHaveFixed(tools: string[]): this {
    for (const tool of tools) {
      expect(this.result.fixed).toContain(tool)
    }
    return this
  }

  shouldHaveError(message: string): this {
    expect(this.result.error).toBeDefined()
    expect(this.result.error).toContain(message)
    return this
  }
}

/**
 * Main assertion factory for creating typed assertions
 */
export class QualityAssertions {
  /**
   * Create assertions for QualityCheckResult
   */
  static forResult(result: QualityCheckResult): QualityResultAssertions {
    return new QualityResultAssertions(result)
  }

  /**
   * Create assertions for FixResult
   */
  static forFixResult(result: FixResult): FixResultAssertions {
    return new FixResultAssertions(result)
  }

  /**
   * Create assertions for ESLint CheckerResult
   */
  static forESLintResult(result: CheckerResult): ESLintResultAssertions {
    return new ESLintResultAssertions(result)
  }

  /**
   * Create assertions for TypeScript CheckerResult
   */
  static forTypeScriptResult(result: CheckerResult): TypeScriptResultAssertions {
    return new TypeScriptResultAssertions(result)
  }

  /**
   * Create assertions for Prettier CheckerResult
   */
  static forPrettierResult(result: CheckerResult): PrettierResultAssertions {
    return new PrettierResultAssertions(result)
  }
}

/**
 * Convenience function for creating quality result assertions
 */
export function assertQualityResult(result: QualityCheckResult): QualityResultAssertions {
  return QualityAssertions.forResult(result)
}

/**
 * Convenience function for creating fix result assertions
 */
export function assertFixResult(result: FixResult): FixResultAssertions {
  return QualityAssertions.forFixResult(result)
}
