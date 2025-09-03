/**
 * Core type definitions for quality-check package
 */

export interface QualityCheckResult {
  success: boolean
  errors: string[]
  warnings: string[]
  autofixes: string[]
  correlationId: string
  duration: number
  checkers: {
    eslint?: CheckerResult
    prettier?: CheckerResult
    typescript?: CheckerResult
  }
}

export interface CheckerResult {
  success: boolean
  errors: string[]
  warnings?: string[]
  autofixes?: string[]
  duration: number
}

export interface QualityCheckOptions {
  // Mode options
  hook?: boolean // Auto-detected from stdin
  file?: string // Direct file path
  preCommit?: boolean // Check only staged files

  // Feature flags
  eslint?: boolean
  prettier?: boolean
  typescript?: boolean

  // Auto-fix options
  fix?: boolean
  autofixSilent?: boolean

  // Logging options
  debug?: boolean
  silent?: boolean
  correlationId?: string

  // Performance options
  timeout?: number // Default: 5000ms
  parallel?: boolean // Default: true

  // Git options
  respectGitignore?: boolean // Default: true
}

export interface HookPayload {
  tool: string
  path?: string
  filePath?: string
  projectDir?: string
  timestamp?: string
}

export interface FileBackup {
  originalPath: string
  backupPath: string
  hash: string
  timestamp: number
}

export interface SecurityOptions {
  maxFileSize?: number // Default: 10MB
  allowedExtensions?: string[]
  preventTraversal?: boolean // Default: true
}
