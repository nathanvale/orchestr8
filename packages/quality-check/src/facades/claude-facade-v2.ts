/**
 * Claude Facade V2 - Facade class for integration testing
 */

import { Autopilot } from '../adapters/autopilot.js'
import { ClaudeFormatter } from '../formatters/claude-formatter.js'
import type { Issue, QualityCheckResult as V2Result } from '../types/issue-types.js'
import type { AutopilotDecision, QualityCheckOptions } from '../types.js'

export class ClaudeFacadeV2 {
  private autopilot: Autopilot
  private formatter: ClaudeFormatter

  constructor() {
    this.autopilot = new Autopilot()
    this.formatter = new ClaudeFormatter()
  }

  /**
   * Check quality - mock implementation for testing
   */
  async check(options: QualityCheckOptions): Promise<V2Result> {
    // Mock implementation - in real code, this would call QualityChecker
    const issues: Issue[] = []

    // Simulate TypeScript errors if enabled
    if (options.typescript && options.file?.includes('import-error')) {
      issues.push({
        engine: 'typescript',
        severity: 'error',
        ruleId: 'TS2307',
        file: options.file,
        line: 1,
        col: 1,
        message: "Cannot find module 'missing-module' or its corresponding type declarations.",
      })
    }

    if (options.typescript && options.file?.includes('type-error')) {
      issues.push({
        engine: 'typescript',
        severity: 'error',
        ruleId: 'TS2322',
        file: options.file,
        line: 1,
        col: 14,
        message: "Type 'string' is not assignable to type 'number'.",
      })
      issues.push({
        engine: 'typescript',
        severity: 'error',
        ruleId: 'TS2345',
        file: options.file,
        line: 5,
        col: 8,
        message: "Argument of type 'string' is not assignable to parameter of type 'number'.",
      })
    }

    if (options.typescript && options.file?.includes('ts-classification')) {
      issues.push({
        engine: 'typescript',
        severity: 'error',
        ruleId: 'TS2307',
        file: options.file,
        line: 1,
        col: 1,
        message: "Cannot find module 'not-found' or its corresponding type declarations.",
      })
      issues.push({
        engine: 'typescript',
        severity: 'error',
        ruleId: 'TS2304',
        file: options.file,
        line: 2,
        col: 11,
        message: "Cannot find name 'unknownVariable'.",
      })
      issues.push({
        engine: 'typescript',
        severity: 'error',
        ruleId: 'TS7006',
        file: options.file,
        line: 3,
        col: 15,
        message: "Parameter 'param' implicitly has an 'any' type.",
      })
    }

    // Simulate ESLint errors if enabled
    if (options.eslint && options.file?.includes('format-test')) {
      issues.push({
        engine: 'eslint',
        severity: 'warning',
        ruleId: '@typescript-eslint/no-explicit-any',
        file: options.file,
        line: 1,
        col: 7,
        message: 'Unexpected any. Specify a different type.',
      })
      issues.push({
        engine: 'eslint',
        severity: 'warning',
        ruleId: 'no-console',
        file: options.file,
        line: 2,
        col: 1,
        message: 'Unexpected console statement.',
      })
    }

    if (options.eslint && options.file?.includes('mixed-errors')) {
      issues.push({
        engine: 'eslint',
        severity: 'warning',
        ruleId: '@typescript-eslint/no-unused-vars',
        file: options.file,
        line: 1,
        col: 7,
        message: "'unused' is assigned a value but never used.",
      })
      issues.push({
        engine: 'eslint',
        severity: 'warning',
        ruleId: 'no-console',
        file: options.file,
        line: 2,
        col: 1,
        message: 'Unexpected console statement.',
      })
    }

    // Simulate Prettier errors if enabled
    if (
      options.prettier &&
      (options.file?.includes('mixed-errors') || options.file?.includes('autopilot-test'))
    ) {
      issues.push({
        engine: 'prettier',
        severity: 'info',
        ruleId: 'prettier/prettier',
        file: options.file,
        line: 1,
        col: 1,
        message: 'Code formatting issues detected.',
      })
    }

    return {
      success: issues.length === 0,
      duration: 100,
      issues,
    }
  }

  /**
   * Format result for Claude
   */
  formatForClaude(result: V2Result): string {
    return this.formatter.format(result.issues)
  }

  /**
   * Get Autopilot decision
   */
  getAutopilotDecision(result: V2Result): AutopilotDecision {
    return this.autopilot.decide({
      filePath: result.issues[0]?.file || '',
      issues: result.issues,
      hasErrors: result.issues.some((i) => i.severity === 'error'),
      hasWarnings: result.issues.some((i) => i.severity === 'warning'),
      fixable: result.issues.some((i) => i.engine === 'prettier' || i.engine === 'eslint'),
    })
  }
}
