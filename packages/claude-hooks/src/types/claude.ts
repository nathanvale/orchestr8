/**
 * Types for Claude Code hook integration
 */

/**
 * Tool names that Claude Code can execute
 */
export type ClaudeToolName =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'MultiEdit'
  | 'Bash'
  | 'LS'
  | 'Glob'
  | 'Grep'
  | 'NotebookEdit'
  | 'WebFetch'
  | 'WebSearch'
  | 'Task'
  | 'ExitPlanMode'
  | 'TodoWrite'

/**
 * Base structure for Claude tool input
 */
export interface ClaudeToolInput {
  tool_name: ClaudeToolName
  tool_input?: Record<string, unknown>
  tool_result?: unknown
}

/**
 * File-related tool input
 */
export interface FileToolInput extends ClaudeToolInput {
  tool_input?: {
    file_path?: string
    path?: string
    notebook_path?: string
    [key: string]: unknown
  }
}

/**
 * Exit codes for Claude hooks
 */
export enum HookExitCode {
  Success = 0,
  GeneralError = 1,
  QualityIssues = 2,
}

/**
 * Hook event types supported by Claude Code
 */
export type HookEventType = 'Notification' | 'Stop' | 'SubagentStop' | 'PostToolUse'

/**
 * Base structure for Claude hook events
 */
export interface ClaudeHookEventBase {
  type: HookEventType
  data?: Record<string, unknown>
}

/**
 * Notification event - Claude needs user attention
 * Supports both actual Claude Code format and test format
 */
export interface ClaudeNotificationEvent extends ClaudeHookEventBase {
  type: 'Notification'
  // Actual Claude Code format fields
  session_id?: string
  transcript_path?: string
  cwd?: string
  message?: string // Root level message in Claude format
  hook_event_name?: 'Notification'
  // Test format fields (backward compatibility)
  data?: {
    message?: string
    priority?: 'low' | 'medium' | 'high'
    [key: string]: unknown
  }
}

/**
 * Stop event - Claude has completed a task
 * Supports both actual Claude Code format and test format
 */
export interface ClaudeStopEvent extends ClaudeHookEventBase {
  type: 'Stop'
  // Actual Claude Code format fields
  session_id?: string
  transcript_path?: string
  hook_event_name?: 'Stop'
  stop_hook_active?: boolean
  // Test format fields (backward compatibility)
  data?: {
    duration?: number
    task?: string
    success?: boolean
    exitCode?: number
    executionTimeMs?: number
    [key: string]: unknown
  }
}

/**
 * SubagentStop event - A subagent has completed its task
 * Supports both actual Claude Code format and test format
 */
export interface ClaudeSubagentStopEvent extends ClaudeHookEventBase {
  type: 'SubagentStop'
  // Actual Claude Code format fields
  session_id?: string
  transcript_path?: string
  hook_event_name?: 'SubagentStop'
  stop_hook_active?: boolean
  // Test format fields (backward compatibility)
  data?: {
    subagentId?: string
    subagentType?: string
    result?: unknown
    [key: string]: unknown
  }
}

/**
 * PostToolUse event - Claude has executed a tool
 * Supports both actual Claude Code format and test format
 */
export interface ClaudePostToolUseEvent extends ClaudeHookEventBase {
  type: 'PostToolUse'
  // Actual Claude Code format fields
  session_id?: string
  transcript_path?: string
  hook_event_name?: 'PostToolUse'
  cwd?: string
  tool_name?: ClaudeToolName
  tool_input?: Record<string, unknown>
  tool_result?: unknown
  // Test format fields (backward compatibility)
  data?: {
    tool?: string
    success?: boolean
    file_path?: string
    [key: string]: unknown
  }
}

/**
 * Union type for all Claude hook events
 */
export type ClaudeHookEvent =
  | ClaudeNotificationEvent
  | ClaudeStopEvent
  | ClaudeSubagentStopEvent
  | ClaudePostToolUseEvent

/**
 * Type alias for backward compatibility
 */
export type ClaudeEvent = ClaudeHookEvent
