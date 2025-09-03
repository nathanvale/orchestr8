/**
 * OpenAI TTS Provider for Voice Vault
 *
 * High-quality text-to-speech using OpenAI's TTS API with:
 * - Comprehensive caching via AudioCache
 * - Correlation ID tracking
 * - Rate limiting and retry logic
 * - Performance metrics
 * - Audio playback capabilities
 */

import { spawn } from 'node:child_process'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import OpenAI from 'openai'

import type { AudioCache } from '../cache/audio-cache.js'
import { generateCorrelationId, type Logger, type VoiceVaultLogFields } from '../logging/index.js'
import { BaseTTSProvider } from './base-provider.js'
import type {
  ProviderAvailabilityResult,
  SpeakResult,
  TTSProviderConfig,
  TTSProviderInfo,
  TTSRequestOptions,
  Voice,
} from './types.js'

/**
 * OpenAI-specific configuration
 */
export interface OpenAIProviderConfig extends TTSProviderConfig {
  apiKey?: string
  model?: 'tts-1' | 'tts-1-hd'
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  speed?: number // 0.25 to 4.0
  format?: 'mp3' | 'opus' | 'aac' | 'flac'
  tempDir?: string
}

/**
 * OpenAI TTS Provider with comprehensive observability
 */
export class OpenAIProvider extends BaseTTSProvider {
  private client: OpenAI | null = null
  private readonly openaiConfig: {
    apiKey: string
    model: 'tts-1' | 'tts-1-hd'
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
    speed: number
    format: 'mp3' | 'opus' | 'aac' | 'flac'
    tempDir: string
  }

  // Rate limiting and concurrent request management
  protected override lastRequestTime = 0
  protected readonly minRequestInterval = 100 // 100ms between requests
  protected currentRateLimitDelay = 1000
  protected retryCount = 0
  protected readonly maxRetries = 3
  protected readonly maxConcurrentRequests = 3
  protected currentRequests = 0
  protected readonly requestQueue: Array<() => void> = []

  constructor(
    private readonly cache: AudioCache,
    config: OpenAIProviderConfig = {},
    logger: Logger,
  ) {
    super(config, logger)

    // Get API key from config or environment
    const apiKey = config.apiKey || process.env['OPENAI_API_KEY'] || ''

    this.openaiConfig = {
      apiKey,
      model: config.model || 'tts-1',
      voice: config.voice || 'alloy',
      speed: this.clampSpeed(config.speed || 1.0),
      format: config.format || 'mp3',
      tempDir: config.tempDir || join(tmpdir(), 'voice-vault-openai'),
    }

    // Initialize OpenAI client if API key is available
    if (this.openaiConfig.apiKey) {
      this.client = new OpenAI({
        apiKey: this.openaiConfig.apiKey,
      })
    }

    this.logger.debug('OpenAI provider configured', {
      correlationId: this.instanceCorrelationId,
      component: 'provider',
      operation: 'configure',
      provider: 'openai',
      model: this.openaiConfig.model,
      voice: this.openaiConfig.voice,
      format: this.openaiConfig.format,
      hasApiKey: !!this.openaiConfig.apiKey,
    } satisfies VoiceVaultLogFields)
  }

  override async speak(text: string, options: TTSRequestOptions = {}): Promise<SpeakResult> {
    const correlationId = options.correlationId || generateCorrelationId()
    const startTime = Date.now()

    this.logger.info('Starting TTS synthesis', {
      correlationId,
      component: 'provider',
      operation: 'speak',
      provider: 'openai',
      textLength: text.length,
      voice: options.voice || this.openaiConfig.voice,
      model: options.model || this.openaiConfig.model,
      useCache: options.useCache ?? true,
    } satisfies VoiceVaultLogFields)

    // Validate text
    const cleanText = this.validateText(text)
    if (!cleanText) {
      this.logger.warn('Empty text provided', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'openai',
      } satisfies VoiceVaultLogFields)
      return this.createErrorResult('Empty text', correlationId, 'invalid_request')
    }

    // Check if client is available
    if (!this.client) {
      this.logger.error('OpenAI client not configured', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'openai',
        error: 'Missing API key',
      } satisfies VoiceVaultLogFields)
      return this.createErrorResult(
        'OpenAI API key not configured',
        correlationId,
        'authentication',
        {
          configuredApiKey: !!this.config.apiKey,
          suggestedAction:
            'Set OPENAI_API_KEY environment variable or configure apiKey in VoiceVaultConfig',
        },
      )
    }

    // Validate voice for OpenAI
    const voice = options.voice || this.openaiConfig.voice
    const validOpenAIVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
    if (voice && !validOpenAIVoices.includes(voice)) {
      this.logger.warn('Invalid OpenAI voice provided', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'openai',
        voice,
        validVoices: validOpenAIVoices,
      } satisfies VoiceVaultLogFields)
      return this.createErrorResult(
        `Invalid OpenAI voice "${voice}". Valid voices: ${validOpenAIVoices.join(', ')}`,
        correlationId,
        'invalid_request',
        {
          providedVoice: voice,
          validVoices: validOpenAIVoices,
          configuredVoice: this.openaiConfig.voice,
          suggestedAction: `Use one of the valid OpenAI voices: ${validOpenAIVoices.join(', ')}`,
        },
      )
    }

    try {
      return await this.synthesizeWithRetry(cleanText, options, correlationId, startTime)
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('TTS synthesis failed', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'openai',
        error: (error as Error).message,
        durationMs: duration,
      } satisfies VoiceVaultLogFields)

      return this.createErrorResult(
        (error as Error).message,
        correlationId,
        this.classifyError(error),
      )
    }
  }

  override async isAvailable(correlationId?: string): Promise<ProviderAvailabilityResult> {
    const opCorrelationId = correlationId || generateCorrelationId()
    const startTime = Date.now()

    this.logger.debug('Checking OpenAI provider availability', {
      correlationId: opCorrelationId,
      component: 'provider',
      operation: 'availability-check',
      provider: 'openai',
    } satisfies VoiceVaultLogFields)

    const available = !!this.openaiConfig.apiKey
    const responseTime = Date.now() - startTime

    return {
      available,
      reason: available ? undefined : 'OpenAI API key not configured',
      responseTimeMs: responseTime,
      correlationId: opCorrelationId,
      lastChecked: Date.now(),
    }
  }

  override getProviderInfo(): TTSProviderInfo {
    return {
      name: 'openai',
      displayName: 'OpenAI TTS',
      version: '1.0.0',
      requiresApiKey: true,
      supportedFeatures: ['speak', 'voices', 'speed', 'formats'],
      supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
      rateLimit: 60, // Roughly 1 request per second
      supportsStreaming: false,
      supportsSSML: false,
    }
  }

  async getVoices(correlationId?: string): Promise<Voice[]> {
    const opCorrelationId = correlationId || generateCorrelationId()

    this.logger.debug('Getting available voices', {
      correlationId: opCorrelationId,
      component: 'provider',
      operation: 'get-voices',
      provider: 'openai',
    } satisfies VoiceVaultLogFields)

    return [
      {
        id: 'alloy',
        name: 'Alloy',
        language: 'en-US',
        gender: 'neutral',
        description: 'Neutral and balanced voice',
        quality: 4,
        supportsSSML: false,
        supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
      },
      {
        id: 'echo',
        name: 'Echo',
        language: 'en-US',
        gender: 'male',
        description: 'Warm and conversational male voice',
        quality: 4,
        supportsSSML: false,
        supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
      },
      {
        id: 'fable',
        name: 'Fable',
        language: 'en-US',
        gender: 'neutral',
        description: 'Expressive and dynamic voice',
        quality: 4,
        supportsSSML: false,
        supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
      },
      {
        id: 'onyx',
        name: 'Onyx',
        language: 'en-US',
        gender: 'male',
        description: 'Deep and authoritative male voice',
        quality: 4,
        supportsSSML: false,
        supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
      },
      {
        id: 'nova',
        name: 'Nova',
        language: 'en-US',
        gender: 'female',
        description: 'Friendly and upbeat female voice',
        quality: 4,
        supportsSSML: false,
        supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
      },
      {
        id: 'shimmer',
        name: 'Shimmer',
        language: 'en-US',
        gender: 'female',
        description: 'Soft and pleasant female voice',
        quality: 4,
        supportsSSML: false,
        supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
      },
    ]
  }

  override async configure(config: TTSProviderConfig): Promise<void> {
    await super.configure(config)

    const openaiConfig = config as OpenAIProviderConfig
    const correlationId = config.correlationId || generateCorrelationId()

    this.logger.info('Reconfiguring OpenAI provider', {
      correlationId,
      component: 'provider',
      operation: 'reconfigure',
      provider: 'openai',
      configKeys: Object.keys(openaiConfig),
    } satisfies VoiceVaultLogFields)

    // Update configuration
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

    if (openaiConfig.tempDir !== undefined) {
      this.openaiConfig.tempDir = openaiConfig.tempDir
    }
  }

  // Private implementation methods

  private async synthesizeWithRetry(
    text: string,
    options: TTSRequestOptions,
    correlationId: string,
    startTime: number,
  ): Promise<SpeakResult> {
    // Apply rate limiting on each attempt
    await this.applyRateLimit(correlationId)

    // Truncate very long text to API limit (4096 chars)
    const inputText = text.length > 4096 ? `${text.substring(0, 4093)}...` : text

    // Use provided options or fallback to instance config
    const voice = (options.voice as typeof this.openaiConfig.voice) || this.openaiConfig.voice
    const model = (options.model as typeof this.openaiConfig.model) || this.openaiConfig.model
    const speed = options.speed || this.openaiConfig.speed
    const format = (options.format as typeof this.openaiConfig.format) || this.openaiConfig.format

    // Generate cache key if caching is enabled
    let cacheKey: string | undefined
    if (options.useCache !== false) {
      cacheKey = await this.cache.generateKey(
        {
          provider: 'openai',
          text: inputText,
          voice,
          model,
          speed: speed,
          format,
        },
        correlationId,
      )

      this.logger.debug('Generated cache key', {
        correlationId,
        component: 'provider',
        operation: 'cache-key-gen',
        provider: 'openai',
        cacheKey: cacheKey.substring(0, 16) + '...',
      } satisfies VoiceVaultLogFields)

      // Check cache first
      const cachedEntry = await this.cache.get(cacheKey, correlationId)
      if (cachedEntry) {
        const duration = Date.now() - startTime

        this.logger.info('Cache hit - using cached audio', {
          correlationId,
          component: 'provider',
          operation: 'speak',
          provider: 'openai',
          cacheStatus: 'hit',
          durationMs: duration,
          audioSize: cachedEntry.data.length,
          apiCallsSaved: 1,
        } satisfies VoiceVaultLogFields)

        // Play cached audio if not detached
        if (!options.detached) {
          await this.playAudio(cachedEntry.data, format, correlationId, false)
        }

        return this.createSuccessResult(correlationId, {
          cached: true,
          duration,
          audioData: options.detached ? undefined : cachedEntry.data,
          audioFormat: format,
          audioSize: cachedEntry.data.length,
          cacheKey,
          metadata: cachedEntry.metadata,
        })
      }
    }

    try {
      // Call OpenAI API
      this.logger.debug('Calling OpenAI TTS API', {
        correlationId,
        component: 'provider',
        operation: 'api-call',
        provider: 'openai',
        model,
        voice,
        speed,
        format,
        textLength: inputText.length,
      } satisfies VoiceVaultLogFields)

      const response = await this.client!.audio.speech.create({
        model,
        input: inputText,
        voice,
        speed,
        response_format: format,
      })

      // Convert response to buffer
      const buffer = Buffer.from(await response.arrayBuffer())
      const duration = Date.now() - startTime

      this.logger.info('OpenAI API call successful', {
        correlationId,
        component: 'provider',
        operation: 'api-call',
        provider: 'openai',
        durationMs: duration,
        audioSize: buffer.length,
        model,
        voice,
      } satisfies VoiceVaultLogFields)

      // Cache the result if caching is enabled
      if (options.useCache !== false && cacheKey) {
        await this.cache.set(
          cacheKey,
          buffer,
          {
            provider: 'openai',
            voice,
            model,
            speed: speed,
            format,
            text: inputText,
            correlationId,
            createdAt: Date.now(),
            sizeBytes: buffer.length,
          },
          correlationId,
        )
      }

      // Play the audio if not detached
      if (!options.detached) {
        await this.playAudio(buffer, format, correlationId, false)
      }

      // Reset retry count on success and release request slot
      this.retryCount = 0
      this.currentRateLimitDelay = Math.max(
        this.minRequestInterval,
        this.currentRateLimitDelay * 0.9,
      )
      this.releaseRequestSlot()

      return this.createSuccessResult(correlationId, {
        duration,
        audioData: options.detached ? undefined : buffer,
        audioFormat: format,
        audioSize: buffer.length,
        cacheKey,
        metadata: {
          model,
          voice,
          speed,
          textLength: inputText.length,
        },
      })
    } catch (error) {
      this.releaseRequestSlot()
      return this.handleAPIError(error, text, options, correlationId, startTime)
    }
  }

  private async handleAPIError(
    error: unknown,
    text: string,
    options: TTSRequestOptions,
    correlationId: string,
    startTime: number,
  ): Promise<SpeakResult> {
    const duration = Date.now() - startTime

    // Check if we should retry
    if (this.shouldRetry(error)) {
      this.retryCount++

      this.logger.warn('Retrying OpenAI API call', {
        correlationId,
        component: 'provider',
        operation: 'retry',
        provider: 'openai',
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)

      // Adaptive backoff for rate limiting
      if (error && typeof error === 'object' && (error as { status?: number }).status === 429) {
        this.currentRateLimitDelay = Math.min(this.currentRateLimitDelay * 2, 60000)

        this.logger.info('Rate limit hit - increasing delay', {
          correlationId,
          component: 'provider',
          operation: 'rate-limit-backoff',
          provider: 'openai',
          newDelayMs: this.currentRateLimitDelay,
        } satisfies VoiceVaultLogFields)
      }

      const delay = 1000 * Math.pow(2, this.retryCount - 1) // Exponential backoff
      await this.sleep(delay)
      return this.synthesizeWithRetry(text, options, correlationId, startTime)
    }

    // Reset retry count on final failure and release request slot
    this.retryCount = 0
    this.releaseRequestSlot()

    const errorType = this.classifyError(error)
    const errorMessage = this.getErrorMessage(error)

    this.logger.error('OpenAI API call failed', {
      correlationId,
      component: 'provider',
      operation: 'api-call',
      provider: 'openai',
      error: errorMessage,
      errorType,
      durationMs: duration,
      retryCount: this.retryCount,
    } satisfies VoiceVaultLogFields)

    return this.createErrorResult(errorMessage, correlationId, errorType)
  }

  private async applyRateLimit(correlationId: string): Promise<void> {
    // Wait for available slot if at max concurrent requests
    if (this.currentRequests >= this.maxConcurrentRequests) {
      this.logger.debug('Waiting for available request slot', {
        correlationId,
        component: 'provider',
        operation: 'concurrent-limit',
        provider: 'openai',
        currentRequests: this.currentRequests,
        maxConcurrent: this.maxConcurrentRequests,
      } satisfies VoiceVaultLogFields)

      await new Promise<void>((resolve) => {
        this.requestQueue.push(resolve)
      })
    }

    this.currentRequests++

    // Apply time-based rate limiting
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const effectiveInterval = Math.max(this.minRequestInterval, this.currentRateLimitDelay)

    if (timeSinceLastRequest < effectiveInterval) {
      const waitTime = effectiveInterval - timeSinceLastRequest

      this.logger.debug('Applying rate limit', {
        correlationId,
        component: 'provider',
        operation: 'rate-limit',
        provider: 'openai',
        waitTimeMs: waitTime,
        currentRequests: this.currentRequests,
      } satisfies VoiceVaultLogFields)

      await this.sleep(waitTime)
    }

    this.lastRequestTime = Date.now()
  }

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

  private classifyError(
    error: unknown,
  ): 'authentication' | 'rate_limit' | 'network' | 'service_unavailable' | 'unknown' {
    if (error && typeof error === 'object') {
      const err = error as { status?: number; message?: string }

      if (err.status === 401) return 'authentication'
      if (err.status === 429) return 'rate_limit'
      if (err.status === 500 || err.status === 503) return 'service_unavailable'
      if (
        err.message?.includes('ETIMEDOUT') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ENOTFOUND')
      ) {
        return 'network'
      }
    }

    return 'unknown'
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object') {
      const err = error as { status?: number; message?: string }

      if (err.status === 401) return 'Invalid API key'
      if (err.status === 429) return 'Rate limit exceeded'
      if (err.status === 500 || err.status === 503) return 'Server error - try again later'
      if (err.message?.includes('ETIMEDOUT') || err.message?.includes('ECONNREFUSED')) {
        return 'Network error - check connection'
      }
      if (err.message) return err.message
    }

    return 'OpenAI TTS failed'
  }

  private async playAudio(
    audioData: Buffer,
    format: string,
    correlationId: string,
    detached: boolean,
  ): Promise<void> {
    try {
      // Ensure temp directory exists
      await mkdir(this.openaiConfig.tempDir, { recursive: true })

      // Write audio data to temp file for playback
      const filename = `openai-${Date.now()}.${format}`
      const filepath = join(this.openaiConfig.tempDir, filename)
      await writeFile(filepath, audioData)

      this.logger.debug('Playing audio', {
        correlationId,
        component: 'provider',
        operation: 'play-audio',
        provider: 'openai',
        filePath: filename,
        audioSize: audioData.length,
        detached,
      } satisfies VoiceVaultLogFields)

      // Play the audio file
      await this.playAudioFile(filepath, detached, correlationId)

      // Don't clean up immediately if detached (let audio finish)
      if (!detached) {
        await this.cleanupFile(filepath, correlationId)
      }
    } catch (error) {
      this.logger.warn('Audio playback failed', {
        correlationId,
        component: 'provider',
        operation: 'play-audio',
        provider: 'openai',
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)
    }
  }

  private async playAudioFile(
    filepath: string,
    detached: boolean,
    correlationId: string,
  ): Promise<void> {
    const platform = process.platform

    if (detached) {
      // Use spawn for detached process
      let args: string[] = []
      let cmd = ''

      if (platform === 'darwin') {
        cmd = 'afplay'
        args = [filepath]
      } else if (platform === 'win32') {
        const escapedPath = filepath
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "''")
          .replace(/`/g, '``')
          .replace(/\$/g, '`$')
        cmd = 'powershell'
        args = [
          '-NoProfile',
          '-Command',
          `(New-Object Media.SoundPlayer '${escapedPath}').PlaySync()`,
        ]
      } else {
        // Linux - find available player
        cmd = 'sh'
        args = [
          '-c',
          `if command -v aplay >/dev/null 2>&1; then aplay "${filepath}"; elif command -v paplay >/dev/null 2>&1; then paplay "${filepath}"; elif command -v ffplay >/dev/null 2>&1; then ffplay -nodisp -autoexit "${filepath}"; fi`,
        ]
      }

      const child = spawn(cmd, args, {
        detached: true,
        stdio: 'ignore',
      })
      child.unref()
    } else {
      // Use execFile for normal playback
      const { execFile } = await import('node:child_process')
      const execFileAsync = promisify(execFile)

      if (platform === 'darwin') {
        await execFileAsync('afplay', [filepath])
      } else if (platform === 'win32') {
        const escapedPath = filepath
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "''")
          .replace(/`/g, '``')
          .replace(/\$/g, '`$')
        await execFileAsync('powershell', [
          '-NoProfile',
          '-Command',
          `(New-Object Media.SoundPlayer '${escapedPath}').PlaySync()`,
        ])
      } else {
        // Linux - try players in order
        const players = ['aplay', 'paplay', 'ffplay']
        let played = false

        for (const player of players) {
          try {
            if (player === 'ffplay') {
              await execFileAsync('ffplay', ['-nodisp', '-autoexit', filepath])
            } else {
              await execFileAsync(player, [filepath])
            }
            played = true
            break
          } catch {
            continue
          }
        }

        if (!played) {
          this.logger.warn('No audio player found on Linux', {
            correlationId,
            component: 'provider',
            operation: 'play-audio',
            provider: 'openai',
          } satisfies VoiceVaultLogFields)
        }
      }
    }
  }

  private async cleanupFile(filepath: string, correlationId: string): Promise<void> {
    try {
      await unlink(filepath)
    } catch (error) {
      this.logger.debug('Failed to cleanup temp file', {
        correlationId,
        component: 'provider',
        operation: 'cleanup',
        provider: 'openai',
        filePath: filepath,
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)
    }
  }

  private clampSpeed(speed: number): number {
    return Math.max(0.25, Math.min(4.0, speed))
  }

  private releaseRequestSlot(): void {
    this.currentRequests--

    // Process queued request if any
    const next = this.requestQueue.shift()
    if (next) {
      next()
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
