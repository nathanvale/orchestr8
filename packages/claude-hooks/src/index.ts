/**
 * @template/claude-hooks - Claude Code hooks for task completion and quality checks
 */

// Main hook classes
export { BaseHook } from './base-hook.js'
export { NotificationHook } from './notification/notification.js'
export { StopHook } from './stop/stop.js'
export { SubagentStopHook } from './subagent-stop/subagent-stop.js'

// Hook configuration interfaces
export type { HookConfig } from './base-hook.js'
export type { NotificationHookConfig } from './notification/notification.js'
export type { StopHookConfig } from './stop/stop.js'
export type { SubagentStopHookConfig } from './subagent-stop/subagent-stop.js'

// TTS and Speech
export { TTSProviderFactory } from './speech/providers/provider-factory.js'
export type { TTSProvider, TTSProviderConfig } from './speech/providers/tts-provider.js'

// Audio system
export { AudioPlayer } from './audio/audio-player.js'
export { Platform, detectPlatform } from './audio/platform.js'

// Configuration
export { loadConfigFromEnv } from './config/env-config.js'
export { loadAutoConfig } from './utils/auto-config.js'

// Claude event types
export type {
  ClaudeNotificationEvent,
  ClaudePostToolUseEvent,
  ClaudeStopEvent,
  ClaudeSubagentStopEvent,
  FileToolInput,
} from './types/claude.js'

// Utility types
export { HookExitCode } from './types/claude.js'

// Export specific utilities
export { loadConfig } from './utils/config-loader.js'
export { createLogger, type Logger } from './utils/logger.js'
