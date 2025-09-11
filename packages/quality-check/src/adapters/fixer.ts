/**
 * Fixer Adapter - Applies safe auto-fixes
 * ~30 lines
 */

import { execSync } from 'node:child_process'
import type { FixResult } from '../types.js'
import type { QualityCheckResult } from '../types/issue-types.js'

export class Fixer {
  /**
   * Apply safe auto-fixes to a file
   */
  async autoFix(path: string, result: QualityCheckResult): Promise<FixResult> {
    let fixCount = 0
    const fixed: string[] = []

    try {
      // Check if there are ESLint issues that can be fixed
      const hasESLintIssues = result.issues.some((issue) => issue.engine === 'eslint')
      if (hasESLintIssues) {
        execSync(`npx eslint --fix "${path}"`, { stdio: 'pipe' })
        fixed.push('ESLint')
        fixCount++
      }

      // Check if there are Prettier issues that can be fixed
      const hasPrettierIssues = result.issues.some((issue) => issue.engine === 'prettier')
      if (hasPrettierIssues) {
        execSync(`npx prettier --write "${path}"`, { stdio: 'pipe' })
        fixed.push('Prettier')
        fixCount++
      }

      return {
        success: true,
        count: fixCount,
        fixed,
      }
    } catch (error) {
      return {
        success: false,
        count: 0,
        fixed: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
