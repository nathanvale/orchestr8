/**
 * API Facade - Programmatic interface for quality checking
 * ~30 lines
 */

import { QualityCheckerV2 } from '../core/quality-checker-v2.js'
import type { QualityCheckOptions, FixResult } from '../types.js'
import type { QualityCheckResult } from '../types/issue-types.js'

export class QualityCheckAPI {
  private checker: QualityCheckerV2

  constructor() {
    this.checker = new QualityCheckerV2()
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
