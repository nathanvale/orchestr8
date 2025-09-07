/**
 * Claude Settings Configuration Handler
 * Handles .claude/settings.json reading, validation, and environment processing
 * ~100 lines with comprehensive error handling
 */

import fs from 'node:fs/promises'
import path from 'node:path'

export interface ClaudeHookConfig {
  type: string
  command: string
  timeout?: number
  description?: string
  continueOnError?: boolean
}

export interface ClaudePostToolUseConfig {
  matcher: string
  hooks: ClaudeHookConfig[]
}

export interface ClaudeSettings {
  hooks: {
    PostToolUse: ClaudePostToolUseConfig[]
  }
}

/**
 * Read and parse Claude settings from .claude/settings.json
 */
export async function readClaudeSettings(projectDir?: string): Promise<ClaudeSettings | null> {
  try {
    const baseDir = projectDir || process.cwd()
    const settingsPath = path.join(baseDir, '.claude', 'settings.json')

    await fs.access(settingsPath)
    const content = await fs.readFile(settingsPath, 'utf8')
    const settings = JSON.parse(content)

    if (!validateClaudeHookConfig(settings)) {
      return null
    }

    return settings
  } catch {
    return null
  }
}

/**
 * Validate Claude hook configuration structure
 */
export function validateClaudeHookConfig(settings: unknown): boolean {
  if (typeof settings !== 'object' || settings === null) {
    return false
  }

  const settingsObj = settings as Record<string, unknown>

  if (
    !settingsObj['hooks'] ||
    typeof settingsObj['hooks'] !== 'object' ||
    settingsObj['hooks'] === null
  ) {
    return false
  }

  const hooks = settingsObj['hooks'] as Record<string, unknown>

  if (
    !hooks['PostToolUse'] ||
    !Array.isArray(hooks['PostToolUse']) ||
    hooks['PostToolUse'].length === 0
  ) {
    return false
  }

  for (const postToolUse of hooks['PostToolUse']) {
    if (typeof postToolUse !== 'object' || postToolUse === null) {
      return false
    }

    const postToolUseObj = postToolUse as Record<string, unknown>

    if (
      !postToolUseObj['matcher'] ||
      typeof postToolUseObj['matcher'] !== 'string' ||
      !postToolUseObj['matcher'].trim()
    ) {
      return false
    }

    if (
      !postToolUseObj['hooks'] ||
      !Array.isArray(postToolUseObj['hooks']) ||
      postToolUseObj['hooks'].length === 0
    ) {
      return false
    }

    for (const hook of postToolUseObj['hooks']) {
      if (typeof hook !== 'object' || hook === null) {
        return false
      }

      const hookObj = hook as Record<string, unknown>

      if (!hookObj['type'] || hookObj['type'] !== 'command') {
        return false
      }
      if (!hookObj['command'] || typeof hookObj['command'] !== 'string') {
        return false
      }
    }
  }

  return true
}

/**
 * Resolve hook command path (npm binary, absolute, or relative)
 */
export function resolveHookCommand(command: string): string {
  if (command.startsWith('/') || command.startsWith('./') || command.startsWith('../')) {
    return command
  }
  return `npx ${command}`
}

/**
 * Expand environment variables in command strings
 */
export function expandEnvironmentVariables(command: string): string {
  return command.replace(/\$([A-Z_]+)/g, (match, varName) => {
    return process.env[varName] || match
  })
}

/**
 * Normalize hook configuration with defaults
 */
export function normalizeHookConfig(hookConfig: ClaudeHookConfig): ClaudeHookConfig {
  return {
    ...hookConfig,
    timeout: hookConfig.timeout ?? 10,
    continueOnError: hookConfig.continueOnError ?? false,
    description: hookConfig.description ?? 'Quality check enforcement',
  }
}

/**
 * Get effective hook configuration with all processing applied
 */
export function getEffectiveHookConfig(
  settings: ClaudeSettings,
  toolName: string,
): ClaudeHookConfig[] | null {
  for (const postToolUse of settings.hooks.PostToolUse) {
    const regex = new RegExp(postToolUse.matcher)
    if (regex.test(toolName)) {
      return postToolUse.hooks.map((hook) => {
        const normalized = normalizeHookConfig(hook)
        const resolvedCommand = resolveHookCommand(normalized.command)
        const expandedCommand = expandEnvironmentVariables(resolvedCommand)

        return {
          ...normalized,
          command: expandedCommand,
        }
      })
    }
  }

  return null
}

/**
 * Check if quality check hook is enabled for a tool
 */
export async function isQualityCheckEnabled(
  toolName: string,
  projectDir?: string,
): Promise<boolean> {
  // Environment variable override
  if (process.env['QUALITY_CHECK_DISABLED'] === 'true') {
    return false
  }

  // Check for hook configuration
  try {
    const settings = await readClaudeSettings(projectDir)
    if (!settings) return false
    const configs = getEffectiveHookConfig(settings, toolName)
    return configs !== null && configs.length > 0
  } catch {
    return false
  }
}

/**
 * Get configuration with graceful fallbacks
 */
export async function getClaudeConfiguration(
  options: {
    projectDir?: string
    toolName?: string
    fallbackTimeout?: number
  } = {},
): Promise<{
  enabled: boolean
  hooks: ClaudeHookConfig[]
  settings: ClaudeSettings | null
}> {
  const { projectDir, toolName = 'Write', fallbackTimeout = 10 } = options

  try {
    const settings = await readClaudeSettings(projectDir)

    if (!settings) {
      // Graceful fallback - return default configuration
      return {
        enabled: false,
        hooks: [],
        settings: null,
      }
    }

    const hooks = getEffectiveHookConfig(settings, toolName) || []

    // Apply fallback timeout if any hook is missing it
    const normalizedHooks = hooks.map((hook) => ({
      ...hook,
      timeout: hook.timeout ?? fallbackTimeout,
    }))

    return {
      enabled: normalizedHooks.length > 0,
      hooks: normalizedHooks,
      settings,
    }
  } catch {
    // Graceful fallback on any error
    return {
      enabled: false,
      hooks: [],
      settings: null,
    }
  }
}
