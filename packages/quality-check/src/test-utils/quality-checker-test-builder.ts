/**
 * Quality Checker Test Builder
 * Reduces mock complexity from 71+ instances to <20 per test file
 */

import { vi } from 'vitest'
import type { QualityChecker } from '../core/quality-checker'

interface TestScenario {
  checker?: QualityChecker
  typescript?: {
    check?: ReturnType<typeof vi.fn>
    fix?: ReturnType<typeof vi.fn>
    error?: Error
  }
  eslint?: {
    check?: ReturnType<typeof vi.fn>
    fix?: ReturnType<typeof vi.fn>
    error?: Error
  }
  prettier?: {
    check?: ReturnType<typeof vi.fn>
    format?: ReturnType<typeof vi.fn>
    error?: Error
  }
  logger?: {
    debug?: ReturnType<typeof vi.fn>
    info?: ReturnType<typeof vi.fn>
    warn?: ReturnType<typeof vi.fn>
    error?: ReturnType<typeof vi.fn>
  }
  console?: {
    error?: ReturnType<typeof vi.spyOn>
    warn?: ReturnType<typeof vi.spyOn>
  }
}

export class QualityCheckerTestBuilder {
  private scenario: TestScenario = {}

  /**
   * Setup standard error handling test scenario
   * Replaces 15-20 lines of mock setup
   */
  withErrorHandling() {
    this.scenario.console = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    }
    this.scenario.logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    return this
  }

  /**
   * Setup TypeScript error scenario
   * Replaces 8-10 lines of mock setup
   */
  withTypeScriptError(error: Error) {
    this.scenario.typescript = {
      check: vi.fn().mockRejectedValue(error),
      fix: vi.fn().mockRejectedValue(error),
      error,
    }
    return this
  }

  /**
   * Setup ESLint error scenario
   * Replaces 8-10 lines of mock setup
   */
  withESLintError(error: Error) {
    this.scenario.eslint = {
      check: vi.fn().mockRejectedValue(error),
      fix: vi.fn().mockRejectedValue(error),
      error,
    }
    return this
  }

  /**
   * Setup Prettier error scenario
   * Replaces 6-8 lines of mock setup
   */
  withPrettierError(error: Error) {
    this.scenario.prettier = {
      check: vi.fn().mockRejectedValue(error),
      format: vi.fn().mockRejectedValue(error),
      error,
    }
    return this
  }

  /**
   * Setup successful check scenario
   * Replaces 12-15 lines of mock setup
   */
  withSuccessfulCheck() {
    this.scenario.typescript = {
      check: vi.fn().mockResolvedValue({ issues: [] }),
      fix: vi.fn().mockResolvedValue({ issues: [], fixed: 0 }),
    }
    this.scenario.eslint = {
      check: vi.fn().mockResolvedValue({ issues: [] }),
      fix: vi.fn().mockResolvedValue({ issues: [], fixed: 0 }),
    }
    this.scenario.prettier = {
      check: vi.fn().mockResolvedValue({ formatted: false }),
      format: vi.fn().mockResolvedValue({ formatted: true }),
    }
    return this
  }

  /**
   * Setup timeout scenario
   * Replaces 10-12 lines of mock setup
   */
  withTimeout(engine: 'typescript' | 'eslint' | 'prettier') {
    const timeoutError = new Error(`${engine} operation timeout`)
    switch (engine) {
      case 'typescript':
        return this.withTypeScriptError(timeoutError)
      case 'eslint':
        return this.withESLintError(timeoutError)
      case 'prettier':
        return this.withPrettierError(timeoutError)
    }
  }

  /**
   * Setup missing tool scenario
   * Replaces 6-8 lines of mock setup
   */
  withMissingTool(tool: string) {
    const error = new Error(`Tool ${tool} is not installed`)
    return this.withTypeScriptError(error)
  }

  /**
   * Build the test scenario
   * Returns all configured mocks
   */
  build(): TestScenario {
    // Set defaults for any unconfigured mocks
    if (!this.scenario.logger) {
      this.scenario.logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
    }

    return this.scenario
  }

  /**
   * Cleanup all mocks
   * Call in afterEach
   */
  cleanup() {
    if (this.scenario.console?.error) {
      this.scenario.console.error.mockRestore()
    }
    if (this.scenario.console?.warn) {
      this.scenario.console.warn.mockRestore()
    }
    vi.clearAllMocks()
    vi.resetModules()
  }
}

/**
 * Common test scenarios as static builders
 * Each replaces 20-30 lines of mock setup
 */
export class TestScenarios {
  static errorHandling() {
    return new QualityCheckerTestBuilder().withErrorHandling().build()
  }

  static typeScriptFailure() {
    return new QualityCheckerTestBuilder()
      .withErrorHandling()
      .withTypeScriptError(new Error('TypeScript compilation failed'))
      .build()
  }

  static eslintFailure() {
    return new QualityCheckerTestBuilder()
      .withErrorHandling()
      .withESLintError(new Error('ESLint check failed'))
      .build()
  }

  static prettierFailure() {
    return new QualityCheckerTestBuilder()
      .withErrorHandling()
      .withPrettierError(new Error('Prettier format failed'))
      .build()
  }

  static allEnginesSuccess() {
    return new QualityCheckerTestBuilder().withErrorHandling().withSuccessfulCheck().build()
  }

  static timeout(engine: 'typescript' | 'eslint' | 'prettier' = 'typescript') {
    return new QualityCheckerTestBuilder().withErrorHandling().withTimeout(engine).build()
  }

  static missingTool(tool: string) {
    return new QualityCheckerTestBuilder().withErrorHandling().withMissingTool(tool).build()
  }
}
