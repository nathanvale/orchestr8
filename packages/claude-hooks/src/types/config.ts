/**
 * Configuration types for Claude hooks
 */

/**
 * Sound notification configuration
 */
export interface SoundNotificationConfig {
  version?: string
  name?: string
  description?: string
  triggers?: {
    successTools?: string[]
    completionPatterns?: string[]
  }
  sounds?: {
    success?: SoundConfig
    warning?: SoundConfig
    error?: SoundConfig
  }
  settings?: {
    playOnSuccess?: boolean
    playOnWarning?: boolean
    playOnError?: boolean
    volume?: 'low' | 'medium' | 'high'
    delay?: number
    cooldown?: number
  }
  filters?: {
    minExecutionTime?: number
    excludeTools?: string[]
    quietHours?: {
      enabled?: boolean
      start?: string
      end?: string
    }
  }
}

export interface SoundConfig {
  enabled?: boolean
  file?: string
  fallback?: string
}

/**
 * Quality check configuration
 */
export interface QualityCheckConfig {
  version?: string
  name?: string
  description?: string
  projectType?: string
  typescript?: {
    enabled?: boolean
    showDependencyErrors?: boolean
    jsx?: 'react' | 'react-jsx' | 'react-jsxdev' | 'preserve' | 'react-native'
  }
  eslint?: {
    enabled?: boolean
    autofix?: boolean
    extends?: string[]
  }
  prettier?: {
    enabled?: boolean
    autofix?: boolean
  }
  general?: {
    autofixSilent?: boolean
    debug?: boolean
  }
  rules?: {
    console?: RuleConfig
    asAny?: RuleConfig
    debugger?: RuleConfig
    todos?: RuleConfig & { patterns?: string[] }
  }
  fileTypes?: Record<string, FileTypeConfig>
  ignore?: {
    paths?: string[]
    patterns?: string[]
  }
}

export interface RuleConfig {
  enabled?: boolean
  severity?: 'error' | 'warning' | 'info'
  message?: string
  allowIn?: {
    paths?: string[]
    fileTypes?: string[]
    patterns?: string[]
  }
}

export interface FileTypeConfig {
  patterns?: string[]
  paths?: string[]
}

/**
 * Environment configuration with defaults
 */
export interface EnvironmentConfig {
  // Sound notification env vars
  CLAUDE_HOOKS_SOUND_SUCCESS?: string
  CLAUDE_HOOKS_SOUND_WARNING?: string
  CLAUDE_HOOKS_SOUND_ERROR?: string
  CLAUDE_HOOKS_SOUND_VOLUME?: string
  CLAUDE_HOOKS_SOUND_DELAY?: string
  CLAUDE_HOOKS_SOUND_COOLDOWN?: string
  CLAUDE_HOOKS_MIN_EXEC_TIME?: string

  // Quality check env vars
  CLAUDE_HOOKS_TYPESCRIPT_ENABLED?: string
  CLAUDE_HOOKS_SHOW_DEPENDENCY_ERRORS?: string
  CLAUDE_HOOKS_ESLINT_ENABLED?: string
  CLAUDE_HOOKS_ESLINT_AUTOFIX?: string
  CLAUDE_HOOKS_PRETTIER_ENABLED?: string
  CLAUDE_HOOKS_PRETTIER_AUTOFIX?: string
  CLAUDE_HOOKS_AUTOFIX_SILENT?: string

  // General env vars
  CLAUDE_HOOKS_DEBUG?: string
}
