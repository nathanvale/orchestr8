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

export interface ParsedError {
  file: string
  line: number
  column: number
  code: string
  message: string
  severity: 'error' | 'warning'
  source: 'eslint' | 'prettier' | 'typescript'
  fixable: boolean
  category?: 'style' | 'type' | 'complexity' | 'syntax'
}

export interface QualityCheckResult {
  success: boolean
  file?: string
  checkers: {
    eslint?: CheckerResult
    prettier?: CheckerResult
    typescript?: CheckerResult
  }
  parsedErrors?: ParsedError[]
}

export interface FixResult {
  success: boolean
  count: number
  fixed: string[]
  error?: string
}

// Autopilot-specific types

export interface Issue {
  rule: string
  fixable: boolean
  message?: string
  file: string
}

export interface CheckResult {
  filePath: string
  issues: Issue[]
  hasErrors: boolean
  hasWarnings: boolean
  fixable: boolean
}

export interface ContextCheck {
  shouldAutoFix: boolean
  reason: string
  confidence: number
}

export interface AutopilotDecision {
  action: 'FIX_SILENTLY' | 'FIX_AND_REPORT' | 'REPORT_ONLY' | 'CONTINUE'
  fixes?: Issue[]
  issues?: Issue[]
  confidence: number
}

export interface Classification {
  autoFixable: Issue[]
  contextFixable: Issue[]
  unfixable: Issue[]
  allAutoFixable: boolean
  hasAutoFixable: boolean
  hasUnfixable: boolean
}

// Three-tier classification system types
export interface ClaudeInstruction {
  message: string
  instruction: string
  example: string
  location: string
  code?: string
}

export interface EducationalContent {
  explanation: string
  learningPath: string
  nextSteps: string
  category: 'complexity' | 'security' | 'architecture' | 'type-safety' | 'performance' | 'general'
}

export interface ThreeTierClassification {
  tier: 'auto-fixable' | 'claude-fixable' | 'human-required'
  action: 'silent-fix' | 'block-and-fix' | 'stop-and-educate'
  shouldBlock: boolean
  shouldEducate: boolean
  instructions?: ClaudeInstruction
  educational?: EducationalContent
}
