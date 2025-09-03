/**
 * OpenAI TTS Provider implementation
 * Uses OpenAI's Text-to-Speech API for high-quality voice synthesis
 */

import { spawn } from 'node:child_process'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import OpenAI from 'openai'

import type { SpeakResult, TTSProviderConfig, TTSProviderInfo, Voice } from './tts-provider.js'

import { createLogger } from '../../utils/logger.js'
import { AudioCache } from './audio-cache.js'
import { translateAudioCacheConfig } from './cache-config-adapter.js'
import { BaseTTSProvider } from './tts-provider.js'

/**
 * OpenAI-specific configuration
 */
export interface OpenAIConfig extends TTSProviderConfig {
  apiKey?: string
  model?: 'tts-1' | 'tts-1-hd'
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  speed?: number // 0.25 to 4.0
  format?: 'mp3' | 'opus' | 'aac' | 'flac'
  audioCache?: {
    enabled?: boolean
    maxSizeMB?: number
    maxAgeDays?: number
    maxEntries?: number
  }
}

/**
 * OpenAI TTS Provider
 */
export class OpenAIProvider extends BaseTTSProvider {
  private client: OpenAI | null = null
  private openaiConfig: {
    apiKey: string
    model: 'tts-1' | 'tts-1-hd'
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
    speed: number
    format: 'mp3' | 'opus' | 'aac' | 'flac'
  }
  private tempDir: string
  private lastRequestTime = 0
  private readonly minRequestInterval = 1000 // 1 second between requests (default)
  private currentRateLimitDelay = process.env.CI ? 500 : 1000 // Adaptive rate limit delay
  private retryCount = 0
  private readonly maxRetries = 3
  private readonly retryDelay = process.env.CI ? 500 : 1000 // Faster retries in CI
  private cache: AudioCache
  private debug: boolean
  private logger = createLogger('OpenAI TTS', false)

  constructor(config: OpenAIConfig = {}) {
    super(config)

    // Get API key from config or environment
    const apiKey = config.apiKey || process.env['OPENAI_API_KEY'] || ''

    // Set debug flag from environment
    this.debug = process.env['CLAUDE_HOOKS_DEBUG'] === 'true'
    this.logger = createLogger('OpenAI TTS', this.debug)

    // Set defaults
    this.openaiConfig = {
      apiKey,
      model: config.model || 'tts-1',
      voice: config.voice || 'alloy',
      speed: this.clampSpeed(config.speed || 1.0),
      format: config.format || 'mp3',
    }

    // Initialize OpenAI client if API key is available
    if (this.openaiConfig.apiKey) {
      this.client = new OpenAI({
        apiKey: this.openaiConfig.apiKey,
      })
    }

    // Set up temp directory for audio files
    this.tempDir = join(tmpdir(), 'claude-hooks-tts')

    // Initialize audio cache with configuration
    const cacheConfig = translateAudioCacheConfig(config.audioCache)
    this.cache = new AudioCache(cacheConfig)
  }

  async speak(text: string, options?: { detached?: boolean }): Promise<SpeakResult> {
    const detached = options?.detached ?? false
    this.logger.debug(`speak() called with text length: ${text.length} chars`)

    // Validate text
    const cleanText = this.validateText(text)
    if (!cleanText) {
      this.logger.debug('Empty text, returning error')
      return this.createErrorResult('Empty text')
    }

    // Check if client is available
    if (!this.client) {
      this.logger.debug('No OpenAI client (API key missing), returning error')
      return this.createErrorResult('OpenAI API key not configured')
    }

    this.logger.debug('Client available, proceeding with TTS generation')

    return this.speakWithRetry(cleanText, detached)
  }

  private async speakWithRetry(text: string, detached = false): Promise<SpeakResult> {
    try {
      // Apply rate limiting on each attempt (including retries)
      await this.applyRateLimit()

      // Truncate very long text to API limit (4096 chars)
      const inputText = text.length > 4096 ? `${text.substring(0, 4093)}...` : text

      // Generate cache key with provider name and format to prevent collisions
      const cacheKey = await this.cache.generateKey(
        'openai',
        inputText,
        this.openaiConfig.model,
        this.openaiConfig.voice,
        this.openaiConfig.speed,
        this.openaiConfig.format,
      )

      this.logger.debug(`Generated cache key: ${cacheKey.substring(0, 16)}...`)

      // Check cache first
      const cachedEntry = await this.cache.get(cacheKey)
      if (cachedEntry) {
        this.logger.debug(`Cache HIT! Using cached audio (${cachedEntry.data.length} bytes)`)
        // Use cached audio
        await this.playCachedAudio(cachedEntry.data, detached)

        // Reset retry count on success
        this.retryCount = 0

        return this.createSuccessResult({
          duration: cachedEntry.data.length / 1000, // Approximate duration in seconds
        })
      }

      // Call OpenAI API
      const response = await this.client!.audio.speech.create({
        model: this.openaiConfig.model,
        input: inputText,
        voice: this.openaiConfig.voice,
        speed: this.openaiConfig.speed,
        response_format: this.openaiConfig.format,
      })

      // Convert response to buffer
      const buffer = Buffer.from(await response.arrayBuffer())

      this.logger.debug(`Caching new audio (${buffer.length} bytes)`)

      // Cache the result
      await this.cache.set(cacheKey, buffer, {
        provider: 'openai',
        voice: this.openaiConfig.voice,
        model: this.openaiConfig.model,
        speed: this.openaiConfig.speed,
        format: this.openaiConfig.format,
        text: inputText,
      })

      // Play the audio
      await this.playCachedAudio(buffer, detached)

      // Reset retry count and adaptive rate limit on success
      this.retryCount = 0
      this.currentRateLimitDelay = Math.max(
        this.minRequestInterval,
        this.currentRateLimitDelay * 0.9, // Gradually reduce delay on success
      )

      return this.createSuccessResult({
        duration: buffer.length / 1000, // Approximate duration in seconds
      })
    } catch (error) {
      // Check if we should retry
      if (this.shouldRetry(error)) {
        this.retryCount++

        // Adaptive backoff for rate limiting
        if (error && typeof error === 'object' && (error as { status?: number }).status === 429) {
          // Double the rate limit delay on 429 errors
          this.currentRateLimitDelay = Math.min(
            this.currentRateLimitDelay * 2,
            60000, // Cap at 60 seconds
          )
          this.logger.debug(`Rate limit hit - increasing delay to ${this.currentRateLimitDelay}ms`)
        }

        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1) // Exponential backoff
        await this.sleep(delay)
        return this.speakWithRetry(text, detached)
      }

      // Reset retry count on final failure
      this.retryCount = 0
      return this.handleError(error)
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.openaiConfig.apiKey
  }

  getProviderInfo(): TTSProviderInfo {
    return {
      name: 'openai',
      displayName: 'OpenAI TTS',
      version: '1.0.0',
      requiresApiKey: true,
      supportedFeatures: ['speak', 'voices', 'speed', 'formats'],
    }
  }

  async getVoices(): Promise<Voice[]> {
    return [
      {
        id: 'alloy',
        name: 'Alloy',
        language: 'en-US',
        gender: 'neutral',
        description: 'Neutral and balanced',
      },
      {
        id: 'echo',
        name: 'Echo',
        language: 'en-US',
        gender: 'male',
        description: 'Warm and conversational',
      },
      {
        id: 'fable',
        name: 'Fable',
        language: 'en-US',
        gender: 'neutral',
        description: 'Expressive and dynamic',
      },
      {
        id: 'onyx',
        name: 'Onyx',
        language: 'en-US',
        gender: 'male',
        description: 'Deep and authoritative',
      },
      {
        id: 'nova',
        name: 'Nova',
        language: 'en-US',
        gender: 'female',
        description: 'Friendly and upbeat',
      },
      {
        id: 'shimmer',
        name: 'Shimmer',
        language: 'en-US',
        gender: 'female',
        description: 'Soft and pleasant',
      },
    ]
  }

  override getConfiguration(): TTSProviderConfig {
    return { ...this.openaiConfig }
  }

  override configure(config: TTSProviderConfig): void {
    const openaiConfig = config as OpenAIConfig

    if (openaiConfig.apiKey !== undefined) {
      this.openaiConfig.apiKey = openaiConfig.apiKey
      // Reinitialize client with new API key
      if (this.openaiConfig.apiKey) {
        this.client = new OpenAI({
          apiKey: this.openaiConfig.apiKey,
        })
      } else {
        this.client = null
      }
    }

    if (openaiConfig.model !== undefined) {
      this.openaiConfig.model = openaiConfig.model
    }

    if (openaiConfig.voice !== undefined) {
      this.openaiConfig.voice = openaiConfig.voice
    }

    if (openaiConfig.speed !== undefined) {
      this.openaiConfig.speed = this.clampSpeed(openaiConfig.speed)
    }

    if (openaiConfig.format !== undefined) {
      this.openaiConfig.format = openaiConfig.format
    }
  }

  /**
   * Clamp speed to valid range (0.25 to 4.0)
   */
  private clampSpeed(speed: number): number {
    return Math.max(0.25, Math.min(4.0, speed))
  }

  /**
   * Apply rate limiting to prevent API overuse
   * Uses adaptive delay based on recent 429 responses
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const effectiveInterval = Math.max(this.minRequestInterval, this.currentRateLimitDelay)

    if (timeSinceLastRequest < effectiveInterval) {
      const waitTime = effectiveInterval - timeSinceLastRequest
      this.logger.debug(`Rate limiting: waiting ${waitTime}ms before next request`)
      await this.sleep(waitTime)
    }

    this.lastRequestTime = Date.now()
  }

  /**
   * Check if error is retryable
   */
  private shouldRetry(error: unknown): boolean {
    if (this.retryCount >= this.maxRetries) {
      return false
    }

    if (error && typeof error === 'object') {
      const err = error as { status?: number; message?: string }

      // Retry on rate limit or server errors
      if (err.status === 429 || err.status === 500 || err.status === 503) {
        return true
      }

      // Retry on network errors
      if (
        err.message?.includes('ETIMEDOUT') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ENOTFOUND')
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Play cached audio data directly
   */
  private async playCachedAudio(audioData: Buffer, detached = false): Promise<void> {
    try {
      // Ensure temp directory exists
      await mkdir(this.tempDir, { recursive: true })

      // Write audio data to temp file for playback
      const filename = `openai-cached-${Date.now()}.${this.openaiConfig.format}`
      const filepath = join(this.tempDir, filename)
      await writeFile(filepath, audioData)

      this.logger.debug(`Playing cached audio from: ${filepath}, size: ${audioData.length} bytes`)

      // Play the audio file
      await this.playAudio(filepath, detached)

      // Don't clean up immediately if detached (let audio finish)
      if (!detached) {
        await this.cleanupFile(filepath)
      }
    } catch (error) {
      // Log the error for debugging
      this.logger.warning(`Error playing cached audio: ${String(error)}`)
      // Playback failed, but TTS generation succeeded
      // Don't fail the whole operation
    }
  }

  /**
   * Validate filepath to prevent command injection
   */
  private validateFilepath(filepath: string): boolean {
    // Must not contain .. (parent directory traversal)
    if (filepath.includes('..')) return false

    const platform = process.platform

    if (platform === 'win32') {
      // Windows path validation
      // Allow drive letters, backslashes, forward slashes, and common path characters
      // Examples: C:\temp\file.mp3, C:/temp/file.mp3, .\file.mp3
      const windowsPathRegex = /^([a-zA-Z]:[\\/]|\.[\\/]|[\\/])?[a-zA-Z0-9\s\\/\\_\-\.]+$/
      return windowsPathRegex.test(filepath)
    } else {
      // POSIX path validation (Linux, macOS)
      // Must start with / or ./ (absolute or relative path)
      // Allow alphanumeric, dash, underscore, period, and forward slash
      const posixPathRegex = /^(\/|\.\/)[a-zA-Z0-9\/_\-\.]+$/
      return posixPathRegex.test(filepath)
    }
  }

  /**
   * Play audio file using system command
   */
  private async playAudio(filepath: string, detached = false): Promise<void> {
    // Validate filepath to prevent injection
    if (!this.validateFilepath(filepath)) {
      this.logger.warning(`Invalid filepath detected, skipping playback: ${filepath}`)
      return
    }
    try {
      const platform = process.platform

      if (detached) {
        // Use spawn for detached process that continues after parent exits
        let args: string[] = []
        let cmd = ''

        if (platform === 'darwin') {
          cmd = 'afplay'
          args = [filepath]
        } else if (platform === 'win32') {
          // Windows - properly escape the filepath for PowerShell
          // Escape special characters that could break PowerShell syntax
          const escapedPath = filepath
            .replace(/\\/g, '\\\\') // Escape backslashes
            .replace(/'/g, "''") // Escape single quotes for PowerShell
            .replace(/`/g, '``') // Escape backticks
            .replace(/\$/g, '`$') // Escape dollar signs

          cmd = 'powershell'
          args = [
            '-NoProfile',
            '-Command',
            `(New-Object Media.SoundPlayer '${escapedPath}').PlaySync()`,
          ]
        } else {
          // Linux - try to find and use available audio player
          // Use direct execution without shell to avoid injection risks
          const players = [
            { cmd: 'aplay', args: [filepath] },
            { cmd: 'paplay', args: [filepath] },
            { cmd: 'ffplay', args: ['-nodisp', '-autoexit', filepath] },
          ]

          // Try each player in order
          let playerFound = false
          for (const player of players) {
            try {
              // Check if player exists using which command
              const { execSync } = await import('node:child_process')
              try {
                execSync(`which ${player.cmd}`, { stdio: 'ignore' })
                // Player exists, use it
                cmd = player.cmd
                args = player.args
                playerFound = true
                break
              } catch {
                // Player not found, try next
                continue
              }
            } catch {
              // Error checking, try next player
              continue
            }
          }

          if (!playerFound) {
            this.logger.warning('No audio player found on Linux (tried aplay, paplay, ffplay)')
            return
          }
        }

        this.logger.debug(`Playing audio (detached) with ${cmd}: ${filepath}`)

        const child = spawn(cmd, args, {
          detached: true,
          stdio: 'ignore',
        })

        // Unref allows parent to exit independently
        child.unref()
      } else {
        // Use execFile for normal playback (waits for completion) - more secure than exec
        const { execFile } = await import('node:child_process')
        const execFileAsync = promisify(execFile)

        if (platform === 'darwin') {
          // macOS
          this.logger.debug(`Playing audio with afplay: ${filepath}`)
          await execFileAsync('afplay', [filepath])
        } else if (platform === 'win32') {
          // Windows - use execFile with PowerShell
          const escapedPath = filepath
            .replace(/\\/g, '\\\\') // Escape backslashes
            .replace(/'/g, "''") // Escape single quotes
            .replace(/`/g, '``') // Escape backticks
            .replace(/\$/g, '`$') // Escape dollar signs

          this.logger.debug(`Playing audio with PowerShell: ${filepath}`)
          await execFileAsync('powershell', [
            '-NoProfile',
            '-Command',
            `(New-Object Media.SoundPlayer '${escapedPath}').PlaySync()`,
          ])
        } else {
          // Linux - try to find and use available audio player with execFile
          const players = [
            { cmd: 'aplay', args: [filepath] },
            { cmd: 'paplay', args: [filepath] },
            { cmd: 'ffplay', args: ['-nodisp', '-autoexit', filepath] },
          ]

          // Try each player in order
          let playerExecuted = false
          for (const player of players) {
            try {
              // Try to execute the player directly
              await execFileAsync(player.cmd, player.args)
              playerExecuted = true
              this.logger.debug(`Playing audio on Linux with ${player.cmd}: ${filepath}`)
              break
            } catch {
              // Player not found or failed, try next
              continue
            }
          }

          if (!playerExecuted) {
            this.logger.warning('No audio player found on Linux (tried aplay, paplay, ffplay)')
            return
          }
        }
      }
    } catch (error) {
      this.logger.warning(`Error in playAudio: ${String(error)}`)
      // Playback failed, but TTS generation succeeded
      // Don't fail the whole operation
    }
  }

  /**
   * Clean up temporary audio file
   */
  private async cleanupFile(filepath: string): Promise<void> {
    try {
      await unlink(filepath)
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Handle API errors
   */
  private handleError(error: unknown): SpeakResult {
    let errorMessage = 'OpenAI TTS failed'

    if (error && typeof error === 'object') {
      const err = error as { status?: number; message?: string }

      if (err.status === 401) {
        errorMessage = 'Invalid API key'
      } else if (err.status === 429) {
        errorMessage = 'Rate limit exceeded'
      } else if (err.status === 500 || err.status === 503) {
        errorMessage = 'Server error - try again later'
      } else if (err.message?.includes('ETIMEDOUT') || err.message?.includes('ECONNREFUSED')) {
        errorMessage = 'Network error - check connection'
      } else if (err.message) {
        errorMessage = err.message
      }
    }

    return this.createErrorResult(errorMessage)
  }
}
