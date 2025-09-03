/**
 * Voice Vault Cross-Platform Audio Player
 * Simple, ADHD-friendly audio playback with comprehensive logging
 */

import { exec } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { promisify } from 'node:util'

import {
  createChildLogger,
  generateCorrelationId,
  type Logger,
  type VoiceVaultLogFields,
} from '../logging/index.js'
import { Platform, detectPlatform, getPlatformCapabilities } from './platform.js'
import type { AudioPlaybackConfig, AudioPlaybackResult } from './types.js'

const execAsync = promisify(exec)

/**
 * Voice Vault Audio Player
 * Zero-config cross-platform audio playback with detailed logging
 */
export class VoiceVaultAudioPlayer {
  private readonly platform: Platform
  private readonly logger: Logger

  constructor(logger: Logger) {
    this.platform = detectPlatform()
    this.logger = createChildLogger(logger, 'audio')
  }

  /**
   * Play an audio file (ADHD-friendly: just works)
   * @param filePath - Path to audio file
   * @param config - Optional playback configuration
   * @returns Promise<AudioPlaybackResult>
   */
  async playAudio(
    filePath: string,
    config: AudioPlaybackConfig = {},
  ): Promise<AudioPlaybackResult> {
    const correlationId = config.correlationId || generateCorrelationId()
    const startTime = Date.now()

    // Create operation logger with correlation ID
    const operationLogger = this.logger.child({ correlationId })

    operationLogger.info('Starting audio playback', {
      correlationId,
      operation: 'playAudio',
      filePath,
      platform: this.platform,
      config,
    } as VoiceVaultLogFields)

    try {
      // Validate file exists
      if (!existsSync(filePath)) {
        const error = `Audio file not found: ${filePath}`
        operationLogger.error('Audio file validation failed', {
          correlationId,
          operation: 'playAudio',
          filePath,
          error,
        } as VoiceVaultLogFields)

        return {
          success: false,
          error,
          correlationId,
          startedAt: startTime,
        }
      }

      // Get file info for logging
      const fileStats = statSync(filePath)
      const fileSizeKB = Math.round(fileStats.size / 1024)

      operationLogger.debug('Audio file validated', {
        correlationId,
        operation: 'playAudio',
        filePath,
        fileSizeKB,
      } as VoiceVaultLogFields)

      // Play audio using platform-specific method
      const playbackSuccess = await this.playByPlatform(filePath, config, operationLogger)
      const endTime = Date.now()
      const durationMs = endTime - startTime

      if (playbackSuccess) {
        operationLogger.info('Audio playback completed successfully', {
          correlationId,
          operation: 'playAudio',
          filePath,
          durationMs,
          fileSizeKB,
        } as VoiceVaultLogFields)

        return {
          success: true,
          durationMs,
          deviceUsed: await this.getAudioDevice(),
          correlationId,
          startedAt: startTime,
          endedAt: endTime,
        }
      } else {
        const error = `Audio playback failed on ${this.platform}`
        operationLogger.warn('Audio playback failed', {
          correlationId,
          operation: 'playAudio',
          filePath,
          durationMs,
          error,
        } as VoiceVaultLogFields)

        return {
          success: false,
          error,
          correlationId,
          startedAt: startTime,
          endedAt: endTime,
        }
      }
    } catch (err) {
      const endTime = Date.now()
      const error = err instanceof Error ? err.message : 'Unknown playback error'

      operationLogger.error('Audio playback exception', {
        correlationId,
        operation: 'playAudio',
        filePath,
        durationMs: endTime - startTime,
        error,
      } as VoiceVaultLogFields)

      return {
        success: false,
        error,
        correlationId,
        startedAt: startTime,
        endedAt: endTime,
      }
    }
  }

  /**
   * Play audio using platform-specific commands
   */
  private async playByPlatform(
    filePath: string,
    config: AudioPlaybackConfig,
    logger: Logger,
  ): Promise<boolean> {
    try {
      switch (this.platform) {
        case Platform.macOS:
          return await this.playMacOS(filePath, config, logger)
        case Platform.Windows:
          return await this.playWindows(filePath, config, logger)
        case Platform.Linux:
          return await this.playLinux(filePath, config, logger)
        default:
          logger.error('Unsupported platform for audio playback', {
            correlationId: config.correlationId || generateCorrelationId(),
            operation: 'playByPlatform',
            platform: this.platform,
          } as VoiceVaultLogFields)
          return false
      }
    } catch (err) {
      logger.error('Platform-specific playback failed', {
        correlationId: config.correlationId || generateCorrelationId(),
        operation: 'playByPlatform',
        platform: this.platform,
        error: err instanceof Error ? err.message : 'Unknown error',
      } as VoiceVaultLogFields)
      return false
    }
  }

  /**
   * Play audio on macOS using afplay
   */
  private async playMacOS(
    filePath: string,
    config: AudioPlaybackConfig,
    logger: Logger,
  ): Promise<boolean> {
    let command = `afplay "${filePath}"`

    // Add volume control if specified
    if (config.volume !== undefined) {
      const volume = Math.max(0, Math.min(1, config.volume))
      command += ` -v ${volume}`
    }

    logger.debug('Executing macOS audio command', {
      correlationId: config.correlationId || generateCorrelationId(),
      operation: 'playMacOS',
      command,
    } as VoiceVaultLogFields)

    try {
      await execAsync(command)
      return true
    } catch (err) {
      logger.error('macOS afplay command failed', {
        correlationId: config.correlationId || generateCorrelationId(),
        operation: 'playMacOS',
        command,
        error: err instanceof Error ? err.message : 'Unknown error',
      } as VoiceVaultLogFields)
      return false
    }
  }

  /**
   * Play audio on Windows using PowerShell
   */
  private async playWindows(
    filePath: string,
    config: AudioPlaybackConfig,
    logger: Logger,
  ): Promise<boolean> {
    // Use SoundPlayer for synchronous playback
    const command = `powershell -c "(New-Object System.Media.SoundPlayer '${filePath}').PlaySync()"`

    logger.debug('Executing Windows audio command', {
      correlationId: config.correlationId || generateCorrelationId(),
      operation: 'playWindows',
      command,
    } as VoiceVaultLogFields)

    try {
      await execAsync(command)
      return true
    } catch (err) {
      // Fallback to Media.Audio if SoundPlayer fails
      try {
        const fallbackCommand = `powershell -c "Add-Type -AssemblyName presentationCore; (New-Object System.Media.MediaPlayer).Open('${filePath}'); Start-Sleep -Seconds 1"`
        await execAsync(fallbackCommand)
        return true
      } catch (fallbackErr) {
        logger.error('Windows PowerShell audio commands failed', {
          correlationId: config.correlationId || generateCorrelationId(),
          operation: 'playWindows',
          command,
          error: err instanceof Error ? err.message : 'Unknown error',
          fallbackError:
            fallbackErr instanceof Error ? fallbackErr.message : 'Unknown fallback error',
        } as VoiceVaultLogFields)
        return false
      }
    }
  }

  /**
   * Play audio on Linux with fallback chain
   */
  private async playLinux(
    filePath: string,
    config: AudioPlaybackConfig,
    logger: Logger,
  ): Promise<boolean> {
    const capabilities = getPlatformCapabilities(Platform.Linux)
    const players = capabilities.audioPlayers

    logger.debug('Attempting Linux audio playback', {
      correlationId: config.correlationId || generateCorrelationId(),
      operation: 'playLinux',
      availablePlayers: players,
    } as VoiceVaultLogFields)

    // Try each player in order
    for (const player of players) {
      if (await this.checkCommand(player)) {
        try {
          let command = `${player} "${filePath}"`

          // Add player-specific options
          if (player === 'aplay' && config.volume !== undefined) {
            // aplay doesn't support volume directly, but we can try
            command = `${player} "${filePath}"`
          }

          logger.debug(`Trying ${player} for audio playback`, {
            correlationId: config.correlationId || generateCorrelationId(),
            operation: 'playLinux',
            player,
            command,
          } as VoiceVaultLogFields)

          await execAsync(command)

          logger.debug(`Successfully played audio with ${player}`, {
            correlationId: config.correlationId || generateCorrelationId(),
            operation: 'playLinux',
            player,
          } as VoiceVaultLogFields)

          return true
        } catch (err) {
          logger.debug(`${player} failed, trying next player`, {
            correlationId: config.correlationId || generateCorrelationId(),
            operation: 'playLinux',
            player,
            error: err instanceof Error ? err.message : 'Unknown error',
          } as VoiceVaultLogFields)
          continue
        }
      }
    }

    logger.error('No working audio players found on Linux', {
      correlationId: config.correlationId || generateCorrelationId(),
      operation: 'playLinux',
      attemptedPlayers: players,
    } as VoiceVaultLogFields)

    return false
  }

  /**
   * Check if a command exists on the system
   */
  private async checkCommand(command: string): Promise<boolean> {
    try {
      await execAsync(`which ${command}`)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get current audio device info (best effort)
   */
  private async getAudioDevice(): Promise<string | undefined> {
    try {
      switch (this.platform) {
        case Platform.macOS: {
          const { stdout } = await execAsync(
            'system_profiler SPAudioDataType | grep "Default Output Device" | head -1',
          )
          return stdout.trim() || 'Default macOS Device'
        }
        case Platform.Windows:
          return 'Default Windows Device'
        case Platform.Linux: {
          const { stdout: linuxOut } = await execAsync('pactl info | grep "Default Sink"')
          return linuxOut.trim() || 'Default Linux Device'
        }
        default:
          return undefined
      }
    } catch {
      return 'Unknown Device'
    }
  }

  /**
   * Check if audio playback is supported on current platform
   */
  isPlaybackSupported(): boolean {
    return this.platform !== Platform.Unsupported
  }

  /**
   * Get platform info for debugging
   */
  getPlatformInfo(): { platform: Platform; displayName: string; supported: boolean } {
    const capabilities = getPlatformCapabilities(this.platform)
    return {
      platform: this.platform,
      displayName: capabilities.displayName,
      supported: capabilities.nativePlayback,
    }
  }
}

/**
 * Create a simple audio player instance (ADHD-friendly: zero config)
 * @param logger - Logger instance (required for proper correlation tracking)
 */
export function createAudioPlayer(logger: Logger): VoiceVaultAudioPlayer {
  return new VoiceVaultAudioPlayer(logger)
}

/**
 * Create audio player with default console logger (for testing/simple usage)
 */
export function createAudioPlayerWithConsoleLogger(): VoiceVaultAudioPlayer {
  // Simple console-based logger for basic usage
  const consoleLogger: Logger = {
    info: (message: string, fields?: unknown) => console.log(`[INFO] ${message}`, fields),
    warn: (message: string, fields?: unknown) => console.warn(`[WARN] ${message}`, fields),
    error: (message: string, fields?: unknown) => console.error(`[ERROR] ${message}`, fields),
    debug: (message: string, fields?: unknown) => console.debug(`[DEBUG] ${message}`, fields),
    trace: (message: string, fields?: unknown) => console.trace(`[TRACE] ${message}`, fields),
    child: () => consoleLogger,
  }

  return new VoiceVaultAudioPlayer(consoleLogger)
}
