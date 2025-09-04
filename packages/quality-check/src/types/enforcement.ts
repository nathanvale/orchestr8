/**
 * Enforcement type definitions for the Critical Stop Enforcement System
 * Part of Phase 1: Transform quality-check from passive reporter to active enforcer
 */

/**
 * Configuration options for enforcement behavior
 */
export interface EnforcementOptions {
  /** Enable enforcement (default: true) */
  enabled: boolean
  /** Create block files on errors (default: true) */
  blockOnErrors: boolean
  /** Automatically fix fixable issues (default: true) */
  autoFix: boolean
  /** Provide educational content for errors (default: true) */
  educate: boolean
  /** Custom block file locations (default: ['.claude/ENFORCEMENT_BLOCK.md', '.ai/enforcement.md', 'QUALITY_BLOCK.md']) */
  blockFileLocations?: string[]
  /** Verbose output for debugging (default: false) */
  verbose?: boolean
}

/**
 * Classification result for all errors found during quality check
 */
export interface ErrorClassification {
  /** Unique session identifier */
  sessionId: string
  /** Timestamp of classification */
  timestamp: number
  /** Total number of errors found */
  totalErrors: number
  /** Errors that were automatically fixed */
  autoFixedErrors: ProcessedError[]
  /** Errors that could be quick-fixed (Phase 2 feature) */
  quickFixableErrors: ProcessedError[]
  /** Errors requiring manual intervention */
  unfixableErrors: ProcessedError[]
  /** True if all errors were auto-fixed */
  allAutoFixed: boolean
  /** True if there are quick-fixable errors */
  hasQuickFixable: boolean
  /** True if there are unfixable errors */
  hasUnfixableErrors: boolean
  /** True if auto-fix was applied during this session */
  autoFixApplied: boolean
}

/**
 * Detailed information about a processed error
 */
export interface ProcessedError {
  /** Error code (e.g., 'TS2304', 'no-unused-vars', 'prettier/prettier') */
  code: string
  /** Human-readable error message */
  message: string
  /** Source checker that found the error */
  source: 'eslint' | 'prettier' | 'typescript' | 'unknown'
  /** File path where error occurred */
  file: string
  /** Line number (1-based) */
  line: number
  /** Column number (1-based) */
  column: number
  /** Error severity */
  severity: 'error' | 'warning'
  /** True if this error can be auto-fixed */
  autoFixable: boolean
  /** True if this error was actually auto-fixed in this run */
  wasAutoFixed: boolean
  /** True if this error can be quick-fixed (Phase 2) */
  quickFixable: boolean
  /** Educational content about this error */
  education?: ErrorEducation
  /** Suggested fix code snippet */
  suggestedFix?: string
}

/**
 * Educational content to help developers understand and fix errors
 */
export interface ErrorEducation {
  /** Why this error matters */
  why: string
  /** Impact of not fixing this error */
  impact: string
  /** How to fix this error */
  fix: string
  /** How to prevent this error in the future */
  prevention: string
  /** Optional links to documentation */
  links?: string[]
}

/**
 * Result of enforcement action
 */
export interface EnforcementResult {
  /** Whether development was blocked */
  blocked: boolean
  /** Exit code to use (0 = success, 1 = blocked, 2 = quick-fixes available) */
  exitCode: 0 | 1 | 2
  /** Whether to suppress output (for silent auto-fixes) */
  silent?: boolean
  /** Message to display to user */
  message?: string
  /** Paths to created block files */
  blockFiles?: string[]
  /** Full classification details */
  classification?: ErrorClassification
}

/**
 * Content structure for block files
 */
export interface BlockFileContent {
  /** ISO timestamp when block was created */
  timestamp: string
  /** Session ID for tracking */
  sessionId: string
  /** Exit code that triggered this block (2 = quality issues) */
  exitCode: 0 | 1 | 2
  /** All errors that need fixing */
  errors: ProcessedError[]
  /** List of required actions */
  requiredActions: string[]
  /** Instructions for fixing */
  fixInstructions: string
}

/**
 * Database record for tracking enforcement sessions
 */
export interface EnforcementSession {
  /** Unique session ID */
  id: string
  /** Correlation ID from quality check */
  correlationId: string
  /** When enforcement started */
  startedAt: Date
  /** When enforcement ended (if completed) */
  endedAt?: Date
  /** Current status */
  status: 'active' | 'resolved' | 'timeout'
  /** Total errors found */
  totalErrors: number
  /** Errors that were auto-fixed */
  autoFixed: number
  /** Errors that were manually fixed */
  manuallyFixed: number
}

/**
 * Error occurrence record for pattern tracking
 */
export interface ErrorOccurrence {
  /** Session ID this error belongs to */
  sessionId: string
  /** Error code */
  errorCode: string
  /** Error message */
  errorMessage: string
  /** Source of error */
  source: 'eslint' | 'prettier' | 'typescript' | 'unknown'
  /** File path */
  filePath: string
  /** Line number */
  line: number
  /** Column number */
  column: number
  /** Severity */
  severity: 'error' | 'warning'
  /** Whether this was fixed */
  wasFixed: boolean
  /** How it was fixed */
  fixType?: 'auto' | 'manual' | 'ignored'
  /** Time taken to fix in milliseconds */
  fixDurationMs?: number
  /** When this occurred */
  createdAt: Date
}

/**
 * Pattern information for learning system (Phase 2 preparation)
 */
export interface ErrorPattern {
  /** Error code */
  errorCode: string
  /** Hash of pattern for deduplication */
  patternHash: string
  /** How many times this pattern has occurred */
  occurrenceCount: number
  /** When first seen */
  firstSeen: Date
  /** When last seen */
  lastSeen: Date
  /** Whether this can be auto-fixed */
  autoFixable: boolean
  /** Success rate of fixes (0.0 to 1.0) */
  fixSuccessRate: number
}
