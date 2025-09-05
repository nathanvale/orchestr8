/**
 * Quality check issue reported by TypeScript, ESLint, or Prettier
 */
export interface Issue {
  /** The quality check engine that reported the issue */
  engine: 'typescript' | 'eslint' | 'prettier'

  /** The severity level of the issue */
  severity: 'error' | 'warning' | 'info'

  /** The rule identifier (e.g., TS2307, no-unused-vars) */
  ruleId?: string

  /** Absolute path to the file containing the issue */
  file: string

  /** Line number where the issue occurs (1-based) */
  line: number

  /** Column number where the issue starts (1-based) */
  col: number

  /** Line number where the issue ends (1-based) */
  endLine?: number

  /** Column number where the issue ends (1-based) */
  endCol?: number

  /** Human-readable description of the issue */
  message: string

  /** Optional suggestion for fixing the issue */
  suggestion?: string
}

/**
 * Performance metrics for a single engine
 */
export interface EngineMetrics {
  /** Whether this engine was enabled for the check */
  enabled: boolean

  /** Duration for this engine in milliseconds */
  durationMs: number

  /** Cache directory used by this engine */
  cacheDir?: string

  /** Number of issues found by this engine */
  issueCount?: number
}

/**
 * Performance benchmark results
 */
export interface PerfMetrics {
  /** ISO 8601 timestamp of the benchmark */
  timestamp: string

  /** Whether this was a cold or warm run */
  type: 'cold' | 'warm'

  /** Total duration in milliseconds */
  durationMs: number

  /** Metrics for each engine */
  engines?: {
    typescript?: EngineMetrics
    eslint?: EngineMetrics
    prettier?: EngineMetrics
  }

  /** Number of files checked */
  fileCount?: number

  /** Whether cache was used */
  cacheHit?: boolean

  /** Total number of issues found */
  issueCount?: number
}

/**
 * Aggregated result from all quality checkers
 */
export interface QualityCheckResult {
  /** Whether the check passed without errors */
  success: boolean

  /** Total duration in milliseconds */
  duration: number

  /** Array of all issues found */
  issues: Issue[]

  /** Performance metrics if tracking is enabled */
  metrics?: PerfMetrics

  /** Correlation ID for tracking */
  correlationId?: string
}

/**
 * Result from a single checker engine
 */
export interface CheckerResult {
  /** Whether the check passed */
  success: boolean

  /** Issues found by this checker */
  issues: Issue[]

  /** Duration in milliseconds */
  duration?: number

  /** Whether issues are fixable */
  fixable?: boolean

  /** Number of fixed issues */
  fixedCount?: number
}
