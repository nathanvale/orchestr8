/**
 * Semantic exit codes for quality check system
 * These codes communicate specific states to Claude Code and other consumers
 */
export enum ExitCodes {
  /**
   * Success - all checks passed OR all issues were auto-fixed silently
   * No output is produced in silent fix mode
   */
  SUCCESS = 0,

  /**
   * Hook/system error - the hook itself failed (not quality issues)
   * This tells Claude Code that the hook crashed, not that code has issues
   */
  HOOK_ERROR = 1,

  /**
   * Quality issues found that need fixing
   * This tells Claude Code there are code quality problems to address
   */
  QUALITY_ISSUES = 2,

  /**
   * Configuration error - invalid config or missing required settings
   */
  CONFIG_ERROR = 3,

  /**
   * File access error - couldn't read/write files
   */
  FILE_ACCESS_ERROR = 4,

  /**
   * Timeout exceeded - operation took too long
   */
  TIMEOUT_EXCEEDED = 5,

  /**
   * Hard timeout - killed by system (standard timeout exit code)
   */
  HARD_TIMEOUT = 124,
}

/**
 * Helper to determine if exit code indicates success
 */
export function isSuccessCode(code: number): boolean {
  return code === ExitCodes.SUCCESS
}

/**
 * Helper to determine if exit code indicates quality issues
 */
export function isQualityIssueCode(code: number): boolean {
  return code === ExitCodes.QUALITY_ISSUES
}
