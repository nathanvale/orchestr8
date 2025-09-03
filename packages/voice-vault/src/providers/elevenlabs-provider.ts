/**
 * ElevenLabs TTS Provider for Voice Vault
 *
 * High-quality voice cloning and synthesis using ElevenLabs API with:
 * - Comprehensive caching via AudioCache
 * - Correlation ID tracking
 * - Voice library access
 * - Performance monitoring
 * - Audio playback capabilities
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { spawn } from 'node:child_process'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

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
 * ElevenLabs-specific configuration
 */
export interface ElevenLabsProviderConfig extends TTSProviderConfig {
  apiKey?: string
  voiceId?: string // Required by ElevenLabs for generation
  modelId?: 'eleven_multilingual_v2' | 'eleven_flash_v2_5' | 'eleven_monolingual_v1' | string
  outputFormat?:
    | 'mp3_44100_128'
    | 'mp3_44100_192'
    | 'mp3_22050_32'
    | 'pcm_16000'
    | 'ulaw_8000'
    | 'alaw_8000'
    | 'opus_48000_128'
    | string
  // Voice settings
  stability?: number // 0-1
  similarityBoost?: number // 0-1
  speed?: number // 0.5 - 2.0
  enableLogging?: boolean // Zero-retention mode
  tempDir?: string
}

/**
 * ElevenLabs TTS Provider with comprehensive observability
 */
export class ElevenLabsProvider extends BaseTTSProvider {
  private client: ElevenLabsClient | null = null
  private readonly elConfig: {
    apiKey: string
    voiceId: string
    modelId: string
    outputFormat: string
    stability: number
    similarityBoost: number
    speed: number
    enableLogging: boolean
    tempDir: string
  }

  // Rate limiting
  protected override lastRequestTime = 0
  protected readonly minRequestInterval = 750 // Be conservative with ElevenLabs
  protected retryCount = 0
  protected readonly maxRetries = 3

  constructor(
    private readonly cache: AudioCache,
    config: ElevenLabsProviderConfig = {},
    logger: Logger,
  ) {
    super(config, logger)

    const apiKey = config.apiKey || process.env['ELEVENLABS_API_KEY'] || ''

    this.elConfig = {
      apiKey,
      voiceId: config.voiceId || '',
      modelId: config.modelId || 'eleven_multilingual_v2',
      outputFormat: config.outputFormat || 'mp3_44100_128',
      stability: this.clamp01(config.stability ?? 0.5),
      similarityBoost: this.clamp01(config.similarityBoost ?? 0.75),
      speed: this.clampSpeed(config.speed ?? 1.0),
      enableLogging: config.enableLogging ?? true,
      tempDir: config.tempDir || join(tmpdir(), 'voice-vault-elevenlabs'),
    }

    if (this.elConfig.apiKey) {
      this.client = new ElevenLabsClient({ apiKey: this.elConfig.apiKey })
    }

    this.logger.debug('ElevenLabs provider configured', {
      correlationId: this.instanceCorrelationId,
      component: 'provider',
      operation: 'configure',
      provider: 'elevenlabs',
      modelId: this.elConfig.modelId,
      outputFormat: this.elConfig.outputFormat,
      hasApiKey: !!this.elConfig.apiKey,
      hasVoiceId: !!this.elConfig.voiceId,
    } satisfies VoiceVaultLogFields)
  }

  override async speak(text: string, options: TTSRequestOptions = {}): Promise<SpeakResult> {
    const correlationId = options.correlationId || generateCorrelationId()
    const startTime = Date.now()

    this.logger.info('Starting ElevenLabs TTS synthesis', {
      correlationId,
      component: 'provider',
      operation: 'speak',
      provider: 'elevenlabs',
      textLength: text.length,
      voiceId: options.voice || this.elConfig.voiceId,
      modelId: options.model || this.elConfig.modelId,
      useCache: options.useCache ?? true,
    } satisfies VoiceVaultLogFields)

    // Validate text
    const cleanText = this.validateText(text)
    if (!cleanText) {
      this.logger.warn('Empty text provided', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'elevenlabs',
      } satisfies VoiceVaultLogFields)
      return this.createErrorResult('Empty text', correlationId, 'invalid_request')
    }

    // Check if client is available
    if (!this.client) {
      this.logger.error('ElevenLabs client not configured', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'elevenlabs',
        error: 'Missing API key',
      } satisfies VoiceVaultLogFields)
      return this.createErrorResult(
        'ElevenLabs API key not configured',
        correlationId,
        'authentication',
      )
    }

    // Check if voiceId is provided
    const voiceId = options.voice || this.elConfig.voiceId
    if (!voiceId) {
      this.logger.error('ElevenLabs voiceId required', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'elevenlabs',
        error: 'Missing voiceId',
      } satisfies VoiceVaultLogFields)
      return this.createErrorResult(
        'ElevenLabs voiceId is required',
        correlationId,
        'configuration',
      )
    }

    try {
      return await this.synthesizeWithRetry(cleanText, voiceId, options, correlationId, startTime)
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('TTS synthesis failed', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'elevenlabs',
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

    this.logger.debug('Checking ElevenLabs provider availability', {
      correlationId: opCorrelationId,
      component: 'provider',
      operation: 'availability-check',
      provider: 'elevenlabs',
    } satisfies VoiceVaultLogFields)

    // Only require API key for basic availability - voiceId can be provided at runtime
    const available = !!this.elConfig.apiKey
    const responseTime = Date.now() - startTime

    let reason: string | undefined
    if (!this.elConfig.apiKey) {
      reason = 'ElevenLabs API key not configured'
    }

    return {
      available,
      reason,
      responseTimeMs: responseTime,
      correlationId: opCorrelationId,
      lastChecked: Date.now(),
    }
  }

  override getProviderInfo(): TTSProviderInfo {
    return {
      name: 'elevenlabs',
      displayName: 'ElevenLabs TTS',
      version: '1.0.0',
      requiresApiKey: true,
      supportedFeatures: ['speak', 'voices', 'formats', 'speed', 'voice-cloning'],
      supportedFormats: [
        'mp3_44100_128',
        'mp3_44100_192',
        'mp3_22050_32',
        'pcm_16000',
        'ulaw_8000',
        'alaw_8000',
        'opus_48000_128',
      ],
      rateLimit: 60, // Conservative estimate
      supportsStreaming: false,
      supportsSSML: false,
    }
  }

  async getVoices(correlationId?: string): Promise<Voice[]> {
    const opCorrelationId = correlationId || generateCorrelationId()

    this.logger.debug('Getting ElevenLabs voices', {
      correlationId: opCorrelationId,
      component: 'provider',
      operation: 'get-voices',
      provider: 'elevenlabs',
    } satisfies VoiceVaultLogFields)

    if (!this.client) {
      this.logger.warn('Cannot get voices - client not configured', {
        correlationId: opCorrelationId,
        component: 'provider',
        operation: 'get-voices',
        provider: 'elevenlabs',
      } satisfies VoiceVaultLogFields)
      return []
    }

    try {
      type VoiceApi = {
        voiceId?: string
        voice_id?: string
        id?: string
        name?: string
        language?: string
        description?: string
        category?: string
      }

      const result = (await this.client.voices.search({})) as {
        voices?: Array<VoiceApi>
      }

      const list: Array<VoiceApi> = Array.isArray(result?.voices) ? result.voices : []

      const voices: Array<Voice> = list.map((v) => ({
        id: v.voiceId || v.voice_id || v.id || 'unknown',
        name: v.name || 'Voice',
        language: v.language || 'en',
        description: v.description || v.category || undefined,
        quality: 5, // ElevenLabs is typically high quality
        supportsSSML: false,
        supportedFormats: this.getProviderInfo().supportedFormats,
        category: v.category,
      }))

      this.logger.info('Retrieved ElevenLabs voices', {
        correlationId: opCorrelationId,
        component: 'provider',
        operation: 'get-voices',
        provider: 'elevenlabs',
        voiceCount: voices.length,
      } satisfies VoiceVaultLogFields)

      return voices
    } catch (error) {
      this.logger.error('Failed to retrieve ElevenLabs voices', {
        correlationId: opCorrelationId,
        component: 'provider',
        operation: 'get-voices',
        provider: 'elevenlabs',
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)
      return []
    }
  }

  override async configure(config: TTSProviderConfig): Promise<void> {
    await super.configure(config)

    const elConfig = config as ElevenLabsProviderConfig
    const correlationId = config.correlationId || generateCorrelationId()

    this.logger.info('Reconfiguring ElevenLabs provider', {
      correlationId,
      component: 'provider',
      operation: 'reconfigure',
      provider: 'elevenlabs',
      configKeys: Object.keys(elConfig),
    } satisfies VoiceVaultLogFields)

    // Update configuration
    if (elConfig.apiKey !== undefined) {
      this.elConfig.apiKey = elConfig.apiKey
      if (this.elConfig.apiKey) {
        this.client = new ElevenLabsClient({ apiKey: this.elConfig.apiKey })
      } else {
        this.client = null
      }
    }

    if (elConfig.voiceId !== undefined) this.elConfig.voiceId = elConfig.voiceId
    if (elConfig.modelId !== undefined) this.elConfig.modelId = elConfig.modelId
    if (elConfig.outputFormat !== undefined) this.elConfig.outputFormat = elConfig.outputFormat
    if (elConfig.stability !== undefined) this.elConfig.stability = this.clamp01(elConfig.stability)
    if (elConfig.similarityBoost !== undefined)
      this.elConfig.similarityBoost = this.clamp01(elConfig.similarityBoost)
    if (elConfig.speed !== undefined) this.elConfig.speed = this.clampSpeed(elConfig.speed)
    if (elConfig.enableLogging !== undefined) this.elConfig.enableLogging = elConfig.enableLogging
    if (elConfig.tempDir !== undefined) this.elConfig.tempDir = elConfig.tempDir
  }

  // Private implementation methods

  private async synthesizeWithRetry(
    text: string,
    voiceId: string,
    options: TTSRequestOptions,
    correlationId: string,
    startTime: number,
  ): Promise<SpeakResult> {
    // Apply rate limiting on each attempt
    await this.applyRateLimit(correlationId)

    // Truncate excessive text (EL supports large inputs; we still bound it)
    const inputText = text.length > 8000 ? `${text.substring(0, 7997)}...` : text

    // Use provided options or fallback to instance config
    const modelId = options.model || this.elConfig.modelId
    const speed = options.speed || this.elConfig.speed
    const format = options.format || this.elConfig.outputFormat

    // Generate cache key if caching is enabled
    let cacheKey: string | undefined
    if (options.useCache !== false) {
      cacheKey = await this.cache.generateKey(
        {
          provider: 'elevenlabs',
          text: inputText,
          voice: voiceId,
          model: modelId,
          speed: speed,
          format,
        },
        correlationId,
      )

      this.logger.debug('Generated cache key', {
        correlationId,
        component: 'provider',
        operation: 'cache-key-gen',
        provider: 'elevenlabs',
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
          provider: 'elevenlabs',
          cacheStatus: 'hit',
          durationMs: duration,
          audioSize: cachedEntry.data.length,
          apiCallsSaved: 1,
        } satisfies VoiceVaultLogFields)

        // Play cached audio if not detached
        if (!options.detached) {
          await this.playAudio(
            cachedEntry.data,
            this.getFileExtension(format),
            correlationId,
            false,
          )
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
      // Call ElevenLabs API
      this.logger.debug('Calling ElevenLabs TTS API', {
        correlationId,
        component: 'provider',
        operation: 'api-call',
        provider: 'elevenlabs',
        voiceId,
        modelId,
        outputFormat: format,
        textLength: inputText.length,
      } satisfies VoiceVaultLogFields)

      const response = await this.client!.textToSpeech.convert(voiceId, {
        text: inputText,
        modelId,
        outputFormat: format as
          | 'mp3_44100_128'
          | 'mp3_44100_192'
          | 'mp3_22050_32'
          | 'pcm_16000'
          | 'ulaw_8000'
          | 'alaw_8000'
          | 'opus_48000_128',
        voiceSettings: {
          stability: this.elConfig.stability,
          similarityBoost: this.elConfig.similarityBoost,
          style: 0,
          useSpeakerBoost: true,
          speed: this.elConfig.speed,
          quality: undefined,
        } as unknown as Record<string, unknown>,
        enableLogging: this.elConfig.enableLogging,
      })

      // Convert ReadableStream<Uint8Array> to Buffer
      const chunks: Buffer[] = []
      for await (const chunk of response as unknown as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk))
      }
      const buffer = Buffer.concat(chunks)
      const duration = Date.now() - startTime

      this.logger.info('ElevenLabs API call successful', {
        correlationId,
        component: 'provider',
        operation: 'api-call',
        provider: 'elevenlabs',
        durationMs: duration,
        audioSize: buffer.length,
        voiceId,
        modelId,
      } satisfies VoiceVaultLogFields)

      // Cache the result if caching is enabled
      if (options.useCache !== false && cacheKey) {
        await this.cache.set(
          cacheKey,
          buffer,
          {
            provider: 'elevenlabs',
            voice: voiceId,
            model: modelId,
            format,
            speed: speed,
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
        await this.playAudio(buffer, this.getFileExtension(format), correlationId, false)
      }

      // Reset retry count on success
      this.retryCount = 0

      return this.createSuccessResult(correlationId, {
        duration,
        audioData: options.detached ? undefined : buffer,
        audioFormat: format,
        audioSize: buffer.length,
        cacheKey,
        metadata: {
          voiceId,
          modelId,
          outputFormat: format,
          textLength: inputText.length,
        },
      })
    } catch (error) {
      return this.handleAPIError(error, text, voiceId, options, correlationId, startTime)
    }
  }

  private async handleAPIError(
    error: unknown,
    text: string,
    voiceId: string,
    options: TTSRequestOptions,
    correlationId: string,
    startTime: number,
  ): Promise<SpeakResult> {
    const duration = Date.now() - startTime

    // Check if we should retry
    if (this.shouldRetry(error)) {
      this.retryCount++

      this.logger.warn('Retrying ElevenLabs API call', {
        correlationId,
        component: 'provider',
        operation: 'retry',
        provider: 'elevenlabs',
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)

      const delay = 800 * Math.pow(2, this.retryCount - 1) // Exponential backoff
      await this.sleep(delay)
      return this.synthesizeWithRetry(text, voiceId, options, correlationId, startTime)
    }

    // Reset retry count on final failure
    this.retryCount = 0

    const errorType = this.classifyError(error)
    const errorMessage = this.getErrorMessage(error)

    this.logger.error('ElevenLabs API call failed', {
      correlationId,
      component: 'provider',
      operation: 'api-call',
      provider: 'elevenlabs',
      error: errorMessage,
      errorType,
      durationMs: duration,
      retryCount: this.retryCount,
    } satisfies VoiceVaultLogFields)

    return this.createErrorResult(errorMessage, correlationId, errorType)
  }

  private async applyRateLimit(correlationId: string): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest

      this.logger.debug('Applying rate limit', {
        correlationId,
        component: 'provider',
        operation: 'rate-limit',
        provider: 'elevenlabs',
        waitTimeMs: waitTime,
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

    return 'ElevenLabs TTS failed'
  }

  private getFileExtension(format: string): string {
    const f = format.toLowerCase()
    if (f.startsWith('mp3')) return 'mp3'
    if (f.startsWith('opus')) return 'opus'
    if (f.startsWith('pcm')) return 'wav' // raw PCM; we write as .wav for convenience
    if (f.startsWith('ulaw') || f.startsWith('alaw')) return 'wav'
    return 'mp3'
  }

  private async playAudio(
    audioData: Buffer,
    extension: string,
    correlationId: string,
    detached: boolean,
  ): Promise<void> {
    try {
      await mkdir(this.elConfig.tempDir, { recursive: true })
      const filename = `elevenlabs-${Date.now()}.${extension}`
      const filepath = join(this.elConfig.tempDir, filename)
      await writeFile(filepath, audioData)

      this.logger.debug('Playing audio', {
        correlationId,
        component: 'provider',
        operation: 'play-audio',
        provider: 'elevenlabs',
        filePath: filename,
        audioSize: audioData.length,
        detached,
      } satisfies VoiceVaultLogFields)

      await this.playAudioFile(filepath, detached, correlationId)

      if (!detached) {
        await this.cleanupFile(filepath, correlationId)
      }
    } catch (error) {
      this.logger.warn('Audio playback failed', {
        correlationId,
        component: 'provider',
        operation: 'play-audio',
        provider: 'elevenlabs',
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
      let cmd: string

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

      const child = spawn(cmd, args, { detached: true, stdio: 'ignore' })
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
            provider: 'elevenlabs',
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
        provider: 'elevenlabs',
        filePath: filepath,
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)
    }
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value))
  }

  private clampSpeed(value: number): number {
    return Math.max(0.5, Math.min(2.0, value))
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
