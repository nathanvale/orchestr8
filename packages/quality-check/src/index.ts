/**
 * Main entry point for @template/quality-check
 * ~10 lines - just exports
 */

// Export facades for different usage patterns
export { runCLI } from './facades/cli.js'
export { runGitHook } from './facades/git-hook.js'
export { runClaudeHook } from './facades/claude.js'
export { QualityCheckAPI } from './facades/api.js'

// Export core for advanced usage
export { QualityChecker } from './core/quality-checker.js'
export { QualityChecker as QualityCheckerV2 } from './core/quality-checker.js' // Backward compatibility alias
export { IssueReporter } from './core/issue-reporter.js'

// Export types
export type * from './types.js'
