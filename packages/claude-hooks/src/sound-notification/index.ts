/**
 * Task Completion Sound Hook
 * Plays notification sounds when tasks complete successfully
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import type { ClaudeToolInput } from '../types/claude.js'

import { HookExitCode } from '../types/claude.js'
import { parseJsonInput } from '../utils/file-utils.js'
import { createLogger } from '../utils/logger.js'
import { loadSoundConfig, type ResolvedSoundConfig } from './config.js'

// Cooldown tracking
let lastSoundTime = 0

/**
 * Check if we're in quiet hours
 */
function isQuietHours(config: ResolvedSoundConfig): boolean {
  const quietConfig = config.fileConfig.filters?.quietHours
  if (!quietConfig?.enabled) return false

  const now = new Date()
  const currentTime = now.getHours() * 100 + now.getMinutes()

  const startTime = parseInt(quietConfig.start?.replace(':', '') ?? '0')
  const endTime = parseInt(quietConfig.end?.replace(':', '') ?? '0')

  if (startTime > endTime) {
    // Crosses midnight (e.g., 22:00 to 08:00)
    return currentTime >= startTime || currentTime <= endTime
  } else {
    // Same day (e.g., 13:00 to 17:00)
    return currentTime >= startTime && currentTime <= endTime
  }
}

/**
 * Check cooldown period
 */
function checkCooldown(config: ResolvedSoundConfig, log: ReturnType<typeof createLogger>): boolean {
  const now = Date.now()
  const timeSinceLastSound = now - lastSoundTime

  if (timeSinceLastSound < config.cooldown) {
    log.debug(`Cooldown active: ${config.cooldown - timeSinceLastSound}ms remaining`)
    return false
  }

  return true
}

/**
 * Play system sound
 */
function playSound(
  soundFile: string,
  config: ResolvedSoundConfig,
  log: ReturnType<typeof createLogger>,
): boolean {
  try {
    // Check if sound file exists
    if (!existsSync(soundFile)) {
      log.debug(`Sound file not found: ${soundFile}`)
      return false
    }

    // Play sound using afplay (macOS)
    if (config.delay > 0) {
      log.debug(`Waiting ${config.delay}ms before playing sound`)
      setTimeout(() => {
        execSync(`afplay "${soundFile}"`, { stdio: 'ignore' })
      }, config.delay)
    } else {
      execSync(`afplay "${soundFile}"`, { stdio: 'ignore' })
    }

    lastSoundTime = Date.now()
    log.success(`Played sound: ${path.basename(soundFile)}`)
    return true
  } catch (error) {
    log.debug(`Failed to play sound: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return false
  }
}

/**
 * Determine sound type based on tool result
 */
function determineSoundType(
  input: ClaudeToolInput,
  config: ResolvedSoundConfig,
  log: ReturnType<typeof createLogger>,
): string | null {
  const { tool_name, tool_result } = input

  // Skip excluded tools
  const excludeTools = config.fileConfig.filters?.excludeTools || []
  if (excludeTools.includes(tool_name)) {
    log.debug(`Tool ${tool_name} is excluded from sound notifications`)
    return null
  }

  // Check for error indicators
  if (tool_result) {
    const resultStr = JSON.stringify(tool_result).toLowerCase()

    if (resultStr.includes('error') || resultStr.includes('failed') || resultStr.includes('❌')) {
      return config.playOnError ? 'error' : null
    }

    if (resultStr.includes('warning') || resultStr.includes('⚠️')) {
      return config.playOnWarning ? 'warning' : null
    }
  }

  // Check for success indicators
  const successTools = config.fileConfig.triggers?.successTools || []
  if (successTools.includes(tool_name)) {
    return config.playOnSuccess ? 'success' : null
  }

  // Check completion patterns in tool result
  if (tool_result) {
    const patterns = config.fileConfig.triggers?.completionPatterns || []
    const resultStr = JSON.stringify(tool_result).toLowerCase()

    for (const pattern of patterns) {
      if (resultStr.includes(pattern.toLowerCase())) {
        return config.playOnSuccess ? 'success' : null
      }
    }
  }

  return null
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Load configuration
  // When built, this will be in hooks/ directory, so we need to go up to find .claude/hooks
  const configPath = path.join(process.cwd(), '.claude/hooks/task-completion/hook-config.json')
  const config = await loadSoundConfig(configPath)
  const log = createLogger('SOUND', config.debug)

  log.debug('🔊 Task Completion Sound Hook - Starting...')

  // Check quiet hours
  if (isQuietHours(config)) {
    log.debug('Quiet hours active - sounds disabled')
    process.exit(HookExitCode.Success)
  }

  // Check cooldown
  if (!checkCooldown(config, log)) {
    log.debug('Cooldown active - skipping sound')
    process.exit(HookExitCode.Success)
  }

  // Parse input
  const input = await parseJsonInput<ClaudeToolInput>()
  if (!input) {
    log.debug('No valid input - exiting silently')
    process.exit(HookExitCode.Success)
  }

  log.debug(`Processing tool: ${input.tool_name}`)

  // Determine what sound to play
  const soundType = determineSoundType(input, config, log)
  if (!soundType) {
    log.debug('No sound notification needed for this tool/result')
    process.exit(HookExitCode.Success)
  }

  // Get sound configuration
  const soundConfig = config.fileConfig.sounds?.[soundType as keyof typeof config.fileConfig.sounds]
  if (!soundConfig?.enabled) {
    log.debug(`Sound type '${soundType}' is disabled`)
    process.exit(HookExitCode.Success)
  }

  // Try to play the sound
  let soundPlayed = false

  // Try primary sound file
  if (soundConfig.file) {
    soundPlayed = playSound(soundConfig.file, config, log)
  }

  // Try fallback if primary failed
  if (!soundPlayed && soundConfig.fallback) {
    log.debug('Trying fallback sound...')
    soundPlayed = playSound(soundConfig.fallback, config, log)
  }

  if (!soundPlayed) {
    log.warning(`Failed to play ${soundType} sound notification`)
    process.exit(HookExitCode.GeneralError)
  }

  process.exit(HookExitCode.Success)
}

// Handle errors
process.on('unhandledRejection', (error) => {
  const log = createLogger('SOUND', false)
  log.error(`Unhandled error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  process.exit(HookExitCode.GeneralError)
})

// Run main
main().catch((error) => {
  const log = createLogger('SOUND', false)
  log.error(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  process.exit(HookExitCode.GeneralError)
})
