/**
 * Fixer Adapter - Applies safe auto-fixes
 * ~30 lines
 */

import { execSync } from 'node:child_process'
import type { QualityCheckResult, FixResult } from '../types.js'

export class Fixer {
  /**
   * Apply safe auto-fixes to a file
   */
  async autoFix(path: string, result: QualityCheckResult): Promise<FixResult> {
    let fixCount = 0
    const fixed: string[] = []

    try {
      // Fix ESLint issues if present
      if (result.checkers.eslint && !result.checkers.eslint.success) {
        execSync(`npx eslint --fix "${path}"`, { stdio: 'pipe' })
        fixed.push('ESLint')
        fixCount++
      }

      // Fix Prettier issues if present
      if (result.checkers.prettier && !result.checkers.prettier.success) {
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
