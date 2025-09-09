/**
 * API Facade - Programmatic interface for quality checking
 * ~30 lines
 */

import { QualityChecker } from '../core/quality-checker.js'
import type { QualityCheckOptions, FixResult } from '../types.js'
import type { QualityCheckResult } from '../types/issue-types.js'

export class QualityCheckAPI {
  private checker: QualityChecker

  constructor() {
    this.checker = new QualityChecker()
  }

  /**
   * Check files for quality issues
   */
  async check(files: string[], options?: QualityCheckOptions): Promise<QualityCheckResult> {
    return this.checker.check(files, options || {})
  }

  /**
   * Fix quality issues in files
   */
  async fix(files: string[], options?: { safe?: boolean }): Promise<FixResult> {
    return this.checker.fix(files, options || { safe: true })
  }

  /**
   * Check a single file
   */
  async checkFile(path: string, options?: QualityCheckOptions): Promise<QualityCheckResult> {
    return this.check([path], options)
  }

  /**
   * Fix a single file
   */
  async fixFile(path: string, options?: { safe?: boolean }): Promise<FixResult> {
    return this.fix([path], options)
  }
}
