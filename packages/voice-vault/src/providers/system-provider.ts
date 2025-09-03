/**
 * System TTS Provider for Voice Vault
 *
 * Native system text-to-speech using platform-specific commands with:
 * - macOS 'say' command support
 * - Windows SAPI integration
 * - Linux festival/espeak support
 * - Correlation ID tracking
 * - Performance monitoring
 */

import { spawn } from 'node:child_process'

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
 * System TTS specific configuration
 */
export interface SystemProviderConfig extends TTSProviderConfig {
  voice?: string // Voice name (e.g., 'Alex', 'Samantha', 'Daniel' on macOS)
  rate?: number // Speech rate (platform specific ranges)
  volume?: number // Volume level (0-1)
  pitch?: number // Pitch adjustment (platform specific)
}

/**
 * System TTS Provider using native OS capabilities
 */
export class SystemProvider extends BaseTTSProvider {
  private readonly systemConfig: {
    voice: string
    rate: number
    volume: number
    pitch: number
  }

  constructor(config: SystemProviderConfig = {}, logger: Logger) {
    super(config, logger)

    // Set platform-specific defaults
    const platform = process.platform
    let defaultVoice = 'default'
    let defaultRate = 200

    if (platform === 'darwin') {
      defaultVoice = 'Samantha'
      defaultRate = 200 // Words per minute
    } else if (platform === 'win32') {
      defaultVoice = 'Microsoft Zira Desktop'
      defaultRate = 0 // Normal rate
    } else {
      // Linux - espeak/festival defaults
      defaultVoice = 'en'
      defaultRate = 175
    }

    this.systemConfig = {
      voice: this.validateVoice(config.voice) || defaultVoice,
      rate: this.clampRate(config.rate || defaultRate),
      volume: this.clampVolume(config.volume || 1.0),
      pitch: this.clampPitch(config.pitch || 0.0),
    }

    this.logger.debug('System provider configured', {
      correlationId: this.instanceCorrelationId,
      component: 'provider',
      operation: 'configure',
      provider: 'system',
      platform,
      voice: this.systemConfig.voice,
      rate: this.systemConfig.rate,
    } satisfies VoiceVaultLogFields)
  }

  override async speak(text: string, options: TTSRequestOptions = {}): Promise<SpeakResult> {
    const correlationId = options.correlationId || generateCorrelationId()
    const startTime = Date.now()

    this.logger.info('Starting system TTS synthesis', {
      correlationId,
      component: 'provider',
      operation: 'speak',
      provider: 'system',
      textLength: text.length,
      voice: options.voice || this.systemConfig.voice,
      platform: process.platform,
    } satisfies VoiceVaultLogFields)

    // Validate text
    const cleanText = this.validateText(text)
    if (!cleanText) {
      this.logger.warn('Empty text provided', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'system',
      } satisfies VoiceVaultLogFields)
      return this.createErrorResult('Empty text', correlationId, 'invalid_request')
    }

    // Check text length to prevent system TTS hangs
    const MAX_TEXT_LENGTH = 5000
    if (cleanText.length > MAX_TEXT_LENGTH) {
      this.logger.warn('Text too long for system TTS', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'system',
        textLength: cleanText.length,
        maxLength: MAX_TEXT_LENGTH,
      } satisfies VoiceVaultLogFields)
      return this.createErrorResult(
        `Text too long (${cleanText.length} chars). System TTS supports max ${MAX_TEXT_LENGTH} characters.`,
        correlationId,
        'invalid_request',
      )
    }

    // Check if platform is supported
    const availability = await this.isAvailable(correlationId)
    if (!availability.available) {
      this.logger.error('System TTS not available', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'system',
        platform: process.platform,
        reason: availability.reason,
      } satisfies VoiceVaultLogFields)
      return this.createErrorResult(
        availability.reason || 'System TTS not available on this platform',
        correlationId,
        'service_unavailable',
      )
    }

    try {
      return await this.synthesizeSystemTTS(cleanText, options, correlationId, startTime)
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('System TTS synthesis failed', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'system',
        error: (error as Error).message,
        durationMs: duration,
      } satisfies VoiceVaultLogFields)

      return this.createErrorResult((error as Error).message, correlationId, 'unknown')
    }
  }

  override async isAvailable(correlationId?: string): Promise<ProviderAvailabilityResult> {
    const opCorrelationId = correlationId || generateCorrelationId()
    const startTime = Date.now()

    this.logger.debug('Checking system TTS availability', {
      correlationId: opCorrelationId,
      component: 'provider',
      operation: 'availability-check',
      provider: 'system',
      platform: process.platform,
    } satisfies VoiceVaultLogFields)

    const platform = process.platform
    let available = false
    let reason: string | undefined

    switch (platform) {
      case 'darwin':
        available = true // macOS always has 'say'
        break
      case 'win32':
        available = true // Windows always has SAPI
        break
      case 'linux':
        // Linux availability depends on installed TTS engines
        available = true // We'll try multiple fallbacks
        break
      default:
        available = false
        reason = `Platform ${platform} not supported`
        break
    }

    const responseTime = Date.now() - startTime

    return {
      available,
      reason,
      responseTimeMs: responseTime,
      correlationId: opCorrelationId,
      lastChecked: Date.now(),
    }
  }

  override getProviderInfo(): TTSProviderInfo {
    const platform = process.platform
    let displayName = 'System TTS'

    if (platform === 'darwin') {
      displayName = 'macOS Say'
    } else if (platform === 'win32') {
      displayName = 'Windows SAPI'
    } else if (platform === 'linux') {
      displayName = 'Linux TTS'
    }

    return {
      name: 'system',
      displayName,
      version: '1.0.0',
      requiresApiKey: false,
      supportedFeatures: ['speak', 'voices', 'rate', 'volume', 'pitch'],
      supportedFormats: ['native'], // Direct audio output
      rateLimit: undefined, // No API rate limits
      supportsStreaming: false,
      supportsSSML: false,
    }
  }

  async getVoices(correlationId?: string): Promise<Voice[]> {
    const opCorrelationId = correlationId || generateCorrelationId()

    this.logger.debug('Getting system voices', {
      correlationId: opCorrelationId,
      component: 'provider',
      operation: 'get-voices',
      provider: 'system',
      platform: process.platform,
    } satisfies VoiceVaultLogFields)

    const platform = process.platform

    if (platform === 'darwin') {
      return this.getMacOSVoices()
    } else if (platform === 'win32') {
      return this.getWindowsVoices()
    } else if (platform === 'linux') {
      return this.getLinuxVoices()
    }

    return []
  }

  override async configure(config: TTSProviderConfig): Promise<void> {
    await super.configure(config)

    const systemConfig = config as SystemProviderConfig
    const correlationId = config.correlationId || generateCorrelationId()

    this.logger.info('Reconfiguring system provider', {
      correlationId,
      component: 'provider',
      operation: 'reconfigure',
      provider: 'system',
      configKeys: Object.keys(systemConfig),
    } satisfies VoiceVaultLogFields)

    if (systemConfig.voice !== undefined) {
      const validatedVoice = this.validateVoice(systemConfig.voice)
      if (validatedVoice) {
        this.systemConfig.voice = validatedVoice
      }
    }

    if (systemConfig.rate !== undefined) {
      this.systemConfig.rate = this.clampRate(systemConfig.rate)
    }

    if (systemConfig.volume !== undefined) {
      this.systemConfig.volume = this.clampVolume(systemConfig.volume)
    }

    if (systemConfig.pitch !== undefined) {
      this.systemConfig.pitch = this.clampPitch(systemConfig.pitch)
    }
  }

  // Private implementation methods

  private async synthesizeSystemTTS(
    text: string,
    options: TTSRequestOptions,
    correlationId: string,
    startTime: number,
  ): Promise<SpeakResult> {
    const platform = process.platform

    // Use provided options or fallback to instance config
    const voice = options.voice || this.systemConfig.voice
    const speed = options.speed || this.systemConfig.rate / 200 // Normalize to speed multiplier

    this.logger.debug('Executing system TTS command', {
      correlationId,
      component: 'provider',
      operation: 'system-command',
      provider: 'system',
      platform,
      voice,
      textLength: text.length,
    } satisfies VoiceVaultLogFields)

    try {
      await this.executePlatformTTS(platform, text, voice, speed, correlationId)

      const duration = Date.now() - startTime

      this.logger.info('System TTS synthesis successful', {
        correlationId,
        component: 'provider',
        operation: 'speak',
        provider: 'system',
        platform,
        durationMs: duration,
        voice,
      } satisfies VoiceVaultLogFields)

      return this.createSuccessResult(correlationId, {
        duration,
        metadata: {
          platform,
          voice,
          textLength: text.length,
        },
      })
    } catch (error) {
      throw new Error(`System TTS failed: ${(error as Error).message}`)
    }
  }

  private async executePlatformTTS(
    platform: string,
    text: string,
    voice: string,
    speed: number,
    correlationId: string,
  ): Promise<void> {
    switch (platform) {
      case 'darwin':
        await this.executeMacOSTTS(text, voice, speed, correlationId)
        break
      case 'win32':
        await this.executeWindowsTTS(text, voice, speed, correlationId)
        break
      case 'linux':
        await this.executeLinuxTTS(text, voice, speed, correlationId)
        break
      default:
        throw new Error(`Platform ${platform} not supported`)
    }
  }

  private async executeMacOSTTS(
    text: string,
    voice: string,
    speed: number,
    correlationId: string,
  ): Promise<void> {
    // Convert speed multiplier to words per minute
    const rate = Math.round(speed * 200)

    return new Promise<void>((resolve, reject) => {
      // Just play the audio directly - no caching needed for free system TTS
      const sayProcess = spawn('say', ['-v', voice, '-r', String(rate), text])

      sayProcess.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`macOS 'say' command failed with exit code ${code}`))
        }
      })

      sayProcess.on('error', (error) => {
        this.logger.error('macOS TTS command error', {
          correlationId,
          component: 'provider',
          operation: 'macos-tts',
          provider: 'system',
          error: error.message,
        } satisfies VoiceVaultLogFields)
        reject(error)
      })
    })
  }

  private async executeWindowsTTS(
    text: string,
    voice: string,
    speed: number,
    correlationId: string,
  ): Promise<void> {
    // Convert speed multiplier to SAPI rate (-10 to 10)
    const rate = Math.round((speed - 1) * 5)

    // Escape text for PowerShell
    const escapedText = text.replace(/'/g, "''").replace(/`/g, '``').replace(/\$/g, '`$')

    return new Promise<void>((resolve, reject) => {
      const psScript = `
        Add-Type -AssemblyName System.Speech;
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $synth.SelectVoice('${voice}');
        $synth.Rate = ${rate};
        $synth.Speak('${escapedText}');
      `

      const psProcess = spawn('powershell', ['-NoProfile', '-Command', psScript])

      psProcess.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Windows SAPI command failed with exit code ${code}`))
        }
      })

      psProcess.on('error', (error) => {
        this.logger.error('Windows TTS command error', {
          correlationId,
          component: 'provider',
          operation: 'windows-tts',
          provider: 'system',
          error: error.message,
        } satisfies VoiceVaultLogFields)
        reject(error)
      })
    })
  }

  private async executeLinuxTTS(
    text: string,
    voice: string,
    speed: number,
    correlationId: string,
  ): Promise<void> {
    // Try different TTS engines in order of preference
    const engines = [
      {
        command: 'espeak',
        args: ['-v', voice, '-s', String(Math.round(speed * 175)), text],
      },
      {
        command: 'festival',
        args: ['--tts'],
        input: text,
      },
      {
        command: 'spd-say',
        args: ['-r', String(Math.round((speed - 1) * 50)), text],
      },
    ]

    for (const engine of engines) {
      try {
        await this.tryLinuxEngine(engine)
        return // Success with this engine
      } catch (error) {
        this.logger.debug('Linux TTS engine failed, trying next', {
          correlationId,
          component: 'provider',
          operation: 'linux-tts-fallback',
          provider: 'system',
          engine: engine.command,
          error: (error as Error).message,
        } satisfies VoiceVaultLogFields)
        continue
      }
    }

    throw new Error('No working TTS engine found on Linux')
  }

  private async tryLinuxEngine(engine: {
    command: string
    args: string[]
    input?: string
  }): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const process = spawn(engine.command, engine.args)

      if (engine.input) {
        process.stdin.write(engine.input)
        process.stdin.end()
      }

      process.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`${engine.command} failed with exit code ${code}`))
        }
      })

      process.on('error', (error) => {
        reject(error)
      })
    })
  }

  private getMacOSVoices(): Voice[] {
    // Common macOS voices - these should be available on most macOS systems
    return [
      {
        id: 'Alex',
        name: 'Alex',
        language: 'en-US',
        gender: 'male',
        description: 'American English male voice',
        quality: 3,
        supportsSSML: false,
        supportedFormats: ['native'],
      },
      {
        id: 'Samantha',
        name: 'Samantha',
        language: 'en-US',
        gender: 'female',
        description: 'American English female voice',
        quality: 3,
        supportsSSML: false,
        supportedFormats: ['native'],
      },
      {
        id: 'Daniel',
        name: 'Daniel',
        language: 'en-GB',
        gender: 'male',
        description: 'British English male voice',
        quality: 3,
        supportsSSML: false,
        supportedFormats: ['native'],
      },
      {
        id: 'Karen',
        name: 'Karen',
        language: 'en-AU',
        gender: 'female',
        description: 'Australian English female voice',
        quality: 3,
        supportsSSML: false,
        supportedFormats: ['native'],
      },
      {
        id: 'Moira',
        name: 'Moira',
        language: 'en-IE',
        gender: 'female',
        description: 'Irish English female voice',
        quality: 3,
        supportsSSML: false,
        supportedFormats: ['native'],
      },
    ]
  }

  private getWindowsVoices(): Voice[] {
    // Common Windows SAPI voices
    return [
      {
        id: 'Microsoft Zira Desktop',
        name: 'Zira',
        language: 'en-US',
        gender: 'female',
        description: 'American English female voice',
        quality: 3,
        supportsSSML: false,
        supportedFormats: ['native'],
      },
      {
        id: 'Microsoft David Desktop',
        name: 'David',
        language: 'en-US',
        gender: 'male',
        description: 'American English male voice',
        quality: 3,
        supportsSSML: false,
        supportedFormats: ['native'],
      },
      {
        id: 'Microsoft Mark',
        name: 'Mark',
        language: 'en-US',
        gender: 'male',
        description: 'American English male voice',
        quality: 3,
        supportsSSML: false,
        supportedFormats: ['native'],
      },
    ]
  }

  private getLinuxVoices(): Voice[] {
    // Common espeak voices for Linux
    return [
      {
        id: 'en',
        name: 'English',
        language: 'en-US',
        description: 'Default English voice',
        quality: 2,
        supportsSSML: false,
        supportedFormats: ['native'],
      },
      {
        id: 'en-us',
        name: 'American English',
        language: 'en-US',
        description: 'American English voice',
        quality: 2,
        supportsSSML: false,
        supportedFormats: ['native'],
      },
      {
        id: 'en-uk',
        name: 'British English',
        language: 'en-GB',
        description: 'British English voice',
        quality: 2,
        supportsSSML: false,
        supportedFormats: ['native'],
      },
    ]
  }

  private validateVoice(voice: string | undefined): string | undefined {
    if (!voice) return undefined

    const platform = process.platform

    // Only allow alphanumeric characters, spaces, and hyphens
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(voice)) {
      return undefined
    }

    const normalizedVoice = voice.trim()

    if (platform === 'darwin') {
      // List of known safe macOS voices
      const allowedVoices = [
        'Alex',
        'Alice',
        'Allison',
        'Ava',
        'Daniel',
        'Fiona',
        'Karen',
        'Moira',
        'Samantha',
        'Victoria',
        'Veena',
        'Yuna',
        'Zuzana',
      ]

      const isAllowed = allowedVoices.some(
        (allowedVoice) => allowedVoice.toLowerCase() === normalizedVoice.toLowerCase(),
      )
      return isAllowed ? normalizedVoice : undefined
    } else if (platform === 'win32') {
      // Allow common Windows SAPI voice names
      if (normalizedVoice.toLowerCase().includes('microsoft')) {
        return normalizedVoice
      }
      return undefined
    } else if (platform === 'linux') {
      // Allow espeak language codes
      const allowedVoices = ['en', 'en-us', 'en-uk', 'en-au', 'es', 'fr', 'de', 'it']
      return allowedVoices.includes(normalizedVoice.toLowerCase()) ? normalizedVoice : undefined
    }

    return undefined
  }

  private clampRate(rate: number): number {
    const platform = process.platform

    if (platform === 'darwin') {
      // macOS: 50-500 words per minute
      return Math.max(50, Math.min(500, rate))
    } else if (platform === 'win32') {
      // Windows SAPI: -10 to 10
      return Math.max(-10, Math.min(10, rate))
    } else {
      // Linux espeak: 80-450 words per minute
      return Math.max(80, Math.min(450, rate))
    }
  }

  private clampVolume(volume: number): number {
    return Math.max(0, Math.min(1, volume))
  }

  private clampPitch(pitch: number): number {
    // Pitch adjustment in semitones (-12 to +12)
    return Math.max(-12, Math.min(12, pitch))
  }
}
