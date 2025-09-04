/**
 * Shared type definitions
 * ~30 lines total
 */

export interface QualityCheckOptions {
  file?: string
  fix?: boolean
  eslint?: boolean
  prettier?: boolean
  typescript?: boolean
  silent?: boolean
  debug?: boolean
  timeout?: number
  parallel?: boolean
  respectGitignore?: boolean
  hookMode?: boolean
  preCommit?: boolean
  cacheDir?: string
  correlationId?: string
}

export interface CheckerResult {
  success: boolean
  errors?: string[]
  warnings?: string[]
  fixable?: boolean
}

export interface QualityCheckResult {
  success: boolean
  file?: string
  checkers: {
    eslint?: CheckerResult
    prettier?: CheckerResult
    typescript?: CheckerResult
  }
}

export interface FixResult {
  success: boolean
  count: number
  fixed: string[]
  error?: string
}
