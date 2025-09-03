/**
 * Audio Cache Configuration Adapter
 * Translates environment variable configuration to AudioCache configuration
 */

import type { AudioCacheConfig } from './audio-cache.js'

/**
 * Environment configuration shape
 */
export interface EnvAudioCacheConfig {
  enabled?: boolean
  maxSizeMB?: number
  maxAgeDays?: number
  maxEntries?: number
}

/**
 * Translate environment configuration to AudioCache configuration
 */
export function translateAudioCacheConfig(
  envConfig?: EnvAudioCacheConfig,
): AudioCacheConfig | undefined {
  if (!envConfig) {
    return undefined
  }

  const config: AudioCacheConfig = {}

  // Direct mappings
  if (envConfig.enabled !== undefined) {
    config.enabled = envConfig.enabled
  }

  if (envConfig.maxEntries !== undefined) {
    config.maxEntries = envConfig.maxEntries
  }

  // Translated mappings
  // Note: env-config.ts already converts MB to bytes and days to ms in the parser
  // But the config path stores them as maxSizeMB and maxAgeDays
  // So we need to check if they're already converted or not
  if (envConfig.maxSizeMB !== undefined) {
    // If the value is already large (> 1000), it's likely already in bytes
    // Otherwise, it's in MB and needs conversion
    const value = envConfig.maxSizeMB
    config.maxSizeBytes = value > 1000 ? value : value * 1024 * 1024
  }

  if (envConfig.maxAgeDays !== undefined) {
    // If the value is already large (> 1000), it's likely already in milliseconds
    // Otherwise, it's in days and needs conversion
    const value = envConfig.maxAgeDays
    config.maxAgeMs = value > 1000 ? value : value * 24 * 60 * 60 * 1000
  }

  return config
}
