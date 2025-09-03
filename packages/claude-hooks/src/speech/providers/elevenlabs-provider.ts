/**
 * ElevenLabs TTS Provider implementation
 * Uses @elevenlabs/elevenlabs-js for high-quality voice synthesis
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { exec, spawn } from 'node:child_process'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import type { SpeakResult, TTSProviderConfig, TTSProviderInfo, Voice } from './tts-provider.js'

import { AudioCache } from './audio-cache.js'
import { translateAudioCacheConfig } from './cache-config-adapter.js'
import { BaseTTSProvider } from './tts-provider.js'

const execAsync = promisify(exec)

/**
 * ElevenLabs-specific configuration
 */
export interface ElevenLabsConfig extends TTSProviderConfig {
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
  // Voice settings (subset)
  stability?: number // 0-1
  similarityBoost?: number // 0-1
  speed?: number // 0.5 - 2.0
  enableLogging?: boolean // Zero-retention mode
  audioCache?: {
    enabled?: boolean
    maxSizeMB?: number
    maxAgeDays?: number
    maxEntries?: number
  }
}

/**
 * ElevenLabs TTS Provider
 */
export class ElevenLabsProvider extends BaseTTSProvider {
  private client: ElevenLabsClient | null = null
  private elConfig: {
    apiKey: string
    voiceId: string
    modelId: string
    outputFormat: string
    stability: number
    similarityBoost: number
    speed: number
    enableLogging: boolean
  }
  private tempDir: string
  private lastRequestTime = 0
  private readonly minRequestInterval = 750 // be polite
  private retryCount = 0
  private readonly maxRetries = 3
  private readonly retryDelay = 800
  private cache: AudioCache

  constructor(config: ElevenLabsConfig = {}) {
    super(config)

    const apiKey = config.apiKey || process.env['ELEVENLABS_API_KEY'] || ''

    this.elConfig = {
      apiKey,
      // Use a sensible default voice if not provided (will error on speak if missing)
      voiceId: config.voiceId || '',
      modelId: config.modelId || 'eleven_multilingual_v2',
      outputFormat: config.outputFormat || 'mp3_44100_128',
      stability: this.clamp01(config.stability ?? 0.5),
      similarityBoost: this.clamp01(config.similarityBoost ?? 0.75),
      speed: this.clampSpeed(config.speed ?? 1.0),
      enableLogging: config.enableLogging ?? true,
    }

    if (this.elConfig.apiKey) {
      this.client = new ElevenLabsClient({ apiKey: this.elConfig.apiKey })
    }

    this.tempDir = join(tmpdir(), 'claude-hooks-tts')
    // Initialize audio cache with configuration
    const cacheConfig = translateAudioCacheConfig(config.audioCache)
    this.cache = new AudioCache(cacheConfig)
  }

  async speak(text: string, options?: { detached?: boolean }): Promise<SpeakResult> {
    const detached = options?.detached ?? false

    const cleanText = this.validateText(text)
    if (!cleanText) return this.createErrorResult('Empty text')

    if (!this.client) {
      return this.createErrorResult('ElevenLabs API key not configured')
    }
    if (!this.elConfig.voiceId) {
      return this.createErrorResult('ElevenLabs voiceId is required')
    }

    await this.applyRateLimit()
    return this.speakWithRetry(cleanText, detached)
  }

  private async speakWithRetry(text: string, detached = false): Promise<SpeakResult> {
    try {
      // Truncate excessive text (EL supports large inputs; we still bound it)
      const inputText = text.length > 8000 ? `${text.substring(0, 7997)}...` : text

      const cacheKey = await this.cache.generateKey(
        'elevenlabs',
        inputText,
        this.elConfig.modelId,
        this.elConfig.voiceId,
        this.elConfig.speed,
        this.elConfig.outputFormat,
      )

      const cachedEntry = await this.cache.get(cacheKey)
      if (cachedEntry) {
        await this.playCachedAudio(cachedEntry.data, this.extFromFormat(), detached)
        this.retryCount = 0
        return this.createSuccessResult({
          duration: cachedEntry.data.length / 1000, // Approximate duration in seconds
        })
      }

      // Call ElevenLabs API
      const response = await this.client!.textToSpeech.convert(this.elConfig.voiceId, {
        text: inputText,
        modelId: this.elConfig.modelId,
        outputFormat: this.elConfig.outputFormat as
          | 'mp3_44100_128'
          | 'mp3_44100_192'
          | 'mp3_22050_32'
          | 'pcm_16000'
          | 'ulaw_8000'
          | 'alaw_8000'
          | 'opus_48000_128',
        // Map voice settings where applicable (SDK tolerates extras)
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

      // Cache it
      await this.cache.set(cacheKey, buffer, {
        provider: 'elevenlabs',
        voice: this.elConfig.voiceId,
        model: this.elConfig.modelId,
        format: this.elConfig.outputFormat,
        speed: this.elConfig.speed,
        text: inputText,
      })

      await this.playCachedAudio(buffer, this.extFromFormat(), detached)
      this.retryCount = 0
      return this.createSuccessResult({
        duration: buffer.length / 1000, // Approximate duration in seconds
      })
    } catch (error) {
      if (this.shouldRetry(error)) {
        this.retryCount++
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1)
        await this.sleep(delay)
        return this.speakWithRetry(text, detached)
      }

      this.retryCount = 0
      return this.handleError(error)
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.elConfig.apiKey && !!this.elConfig.voiceId
  }

  getProviderInfo(): TTSProviderInfo {
    return {
      name: 'elevenlabs',
      displayName: 'ElevenLabs TTS',
      version: '1.0.0',
      requiresApiKey: true,
      supportedFeatures: ['speak', 'voices', 'formats', 'speed'],
    }
  }

  async getVoices(): Promise<Voice[]> {
    if (!this.client) return []
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
      const list: Array<VoiceApi> = Array.isArray(result?.voices) ? result.voices! : []
      const voices: Array<Voice> = list.map((v) => ({
        id: v.voiceId || v.voice_id || v.id || 'unknown',
        name: v.name || 'Voice',
        language: v.language || 'en',
        description: v.description || v.category || undefined,
      }))
      return voices
    } catch {
      return []
    }
  }

  override getConfiguration(): TTSProviderConfig {
    return { ...this.elConfig }
  }

  override configure(config: TTSProviderConfig): void {
    const c = config as ElevenLabsConfig

    if (c.apiKey !== undefined) {
      this.elConfig.apiKey = c.apiKey
      if (this.elConfig.apiKey) {
        this.client = new ElevenLabsClient({ apiKey: this.elConfig.apiKey })
      } else {
        this.client = null
      }
    }
    if (c.voiceId !== undefined) this.elConfig.voiceId = c.voiceId
    if (c.modelId !== undefined) this.elConfig.modelId = c.modelId
    if (c.outputFormat !== undefined) this.elConfig.outputFormat = c.outputFormat
    if (c.stability !== undefined) this.elConfig.stability = this.clamp01(c.stability)
    if (c.similarityBoost !== undefined)
      this.elConfig.similarityBoost = this.clamp01(c.similarityBoost)
    if (c.speed !== undefined) this.elConfig.speed = this.clampSpeed(c.speed)
    if (c.enableLogging !== undefined) this.elConfig.enableLogging = c.enableLogging
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value))
  }

  private clampSpeed(value: number): number {
    return Math.max(0.5, Math.min(2.0, value))
  }

  private async applyRateLimit(): Promise<void> {
    const now = Date.now()
    const delta = now - this.lastRequestTime
    if (delta < this.minRequestInterval) {
      await this.sleep(this.minRequestInterval - delta)
    }
    this.lastRequestTime = Date.now()
  }

  private shouldRetry(error: unknown): boolean {
    if (this.retryCount >= this.maxRetries) return false
    if (error && typeof error === 'object') {
      const err = error as { status?: number; message?: string }
      if (err.status === 429 || err.status === 500 || err.status === 503) return true
      if (
        err.message?.includes('ETIMEDOUT') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ENOTFOUND')
      )
        return true
    }
    return false
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private extFromFormat(): string {
    const f = this.elConfig.outputFormat.toLowerCase()
    if (f.startsWith('mp3')) return 'mp3'
    if (f.startsWith('opus')) return 'opus'
    if (f.startsWith('pcm')) return 'wav' // raw PCM; we still write .wav for convenience
    if (f.startsWith('ulaw') || f.startsWith('alaw')) return 'wav'
    return 'mp3'
  }

  private async playCachedAudio(audioData: Buffer, ext: string, detached = false): Promise<void> {
    try {
      await mkdir(this.tempDir, { recursive: true })
      const filename = `elevenlabs-cached-${Date.now()}.${ext}`
      const filepath = join(this.tempDir, filename)
      await writeFile(filepath, audioData)
      await this.playAudio(filepath, detached)
      if (!detached) await this.cleanupFile(filepath)
    } catch {
      // ignore playback errors
    }
  }

  private async playAudio(filepath: string, detached = false): Promise<void> {
    try {
      const platform = process.platform
      if (detached) {
        let args: Array<string> = []
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
          cmd = 'sh'
          args = [
            '-c',
            `if command -v aplay >/dev/null 2>&1; then aplay "${filepath}"; elif command -v paplay >/dev/null 2>&1; then paplay "${filepath}"; elif command -v ffplay >/dev/null 2>&1; then ffplay -nodisp -autoexit "${filepath}"; else exit 0; fi`,
          ]
        }
        const child = spawn(cmd, args, { detached: true, stdio: 'ignore' })
        child.unref()
      } else {
        let command: string
        if (platform === 'darwin') {
          command = `afplay "${filepath}"`
        } else if (platform === 'win32') {
          const escapedPath = filepath
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "''")
            .replace(/`/g, '``')
            .replace(/\$/g, '`$')
          command = `powershell -NoProfile -Command "(New-Object Media.SoundPlayer '${escapedPath}').PlaySync()"`
        } else {
          command = `if command -v aplay >/dev/null 2>&1; then aplay "${filepath}"; elif command -v paplay >/dev/null 2>&1; then paplay "${filepath}"; elif command -v ffplay >/dev/null 2>&1; then ffplay -nodisp -autoexit "${filepath}"; else exit 0; fi`
        }
        await execAsync(command)
      }
    } catch {
      // ignore playback errors
    }
  }

  private async cleanupFile(filepath: string): Promise<void> {
    try {
      await unlink(filepath)
    } catch {}
  }

  private handleError(error: unknown): SpeakResult {
    let message = 'ElevenLabs TTS failed'
    if (error && typeof error === 'object') {
      const err = error as { status?: number; message?: string }
      if (err.status === 401) message = 'Invalid API key'
      else if (err.status === 429) message = 'Rate limit exceeded'
      else if (err.status === 500 || err.status === 503) message = 'Server error - try again later'
      else if (err.message?.includes('ETIMEDOUT') || err.message?.includes('ECONNREFUSED'))
        message = 'Network error - check connection'
      else if (err.message) message = err.message
    }
    return this.createErrorResult(message)
  }
}
