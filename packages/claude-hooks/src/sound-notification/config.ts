/**
 * Configuration management for sound notification hook
 */

import { promises as fs } from 'node:fs'

import type { SoundNotificationConfig } from '../types/config.js'

import { parseBoolean, parseInteger } from '../utils/config-loader.js'

export interface ResolvedSoundConfig {
  playOnSuccess: boolean
  playOnWarning: boolean
  playOnError: boolean
  volume: 'low' | 'medium' | 'high'
  delay: number
  cooldown: number
  minExecutionTime: number
  debug: boolean
  fileConfig: SoundNotificationConfig
}

/**
 * Load configuration from JSON file with environment variable overrides
 */
export async function loadSoundConfig(configPath: string): Promise<ResolvedSoundConfig> {
  let fileConfig: SoundNotificationConfig = {}

  try {
    const content = await fs.readFile(configPath, 'utf8')
    fileConfig = JSON.parse(content) as SoundNotificationConfig
  } catch {
    // Config file not found or invalid, use defaults
  }

  return {
    // Sound settings
    playOnSuccess:
      process.env.CLAUDE_HOOKS_SOUND_SUCCESS !== undefined
        ? parseBoolean(process.env.CLAUDE_HOOKS_SOUND_SUCCESS)
        : (fileConfig.settings?.playOnSuccess ?? true),

    playOnWarning:
      parseBoolean(process.env.CLAUDE_HOOKS_SOUND_WARNING, false) ||
      (fileConfig.settings?.playOnWarning ?? false),

    playOnError:
      parseBoolean(process.env.CLAUDE_HOOKS_SOUND_ERROR, false) ||
      (fileConfig.settings?.playOnError ?? false),

    // Volume control
    volume:
      (process.env.CLAUDE_HOOKS_SOUND_VOLUME as 'low' | 'medium' | 'high') ||
      (fileConfig.settings?.volume ?? 'medium'),

    // Timing
    delay: parseInteger(process.env.CLAUDE_HOOKS_SOUND_DELAY) || (fileConfig.settings?.delay ?? 0),

    cooldown:
      parseInteger(process.env.CLAUDE_HOOKS_SOUND_COOLDOWN) ||
      (fileConfig.settings?.cooldown ?? 2000),

    // Filters
    minExecutionTime:
      parseInteger(process.env.CLAUDE_HOOKS_MIN_EXEC_TIME) ||
      (fileConfig.filters?.minExecutionTime ?? 1000),

    // Debug
    debug: parseBoolean(process.env.CLAUDE_HOOKS_DEBUG),

    // Store full config for access
    fileConfig,
  }
}
