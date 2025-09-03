/**
 * macOS TTS Provider implementation
 * Uses the built-in macOS 'say' command for text-to-speech
 */

import { spawn } from 'node:child_process'

import type { SpeakResult, TTSProviderConfig, TTSProviderInfo, Voice } from './tts-provider.js'

import { createLogger } from '../../utils/logger.js'
import { BaseTTSProvider } from './tts-provider.js'

/**
 * macOS-specific configuration
 */
export interface MacOSConfig extends TTSProviderConfig {
  voice?: string // Voice name (e.g., 'Alex', 'Samantha', 'Daniel')
  rate?: number // Speech rate (50-500 words per minute)
}

/**
 * macOS TTS Provider
 */
export class MacOSProvider extends BaseTTSProvider {
  private macosConfig: Required<MacOSConfig>
  private logger = createLogger('macOS TTS', false)

  constructor(config: MacOSConfig = {}) {
    super(config)

    // Set defaults with validation
    const voice = this.validateVoice(config.voice)
    if (config.voice && !voice) {
      // Warn when an invalid voice was configured
      const logger = createLogger('macOS TTS', true)
      logger.warning(`Invalid voice '${config.voice}' configured, using default 'Samantha'`)
    }

    this.macosConfig = {
      voice: voice || 'Samantha',
      rate: this.clampRate(config.rate || 200),
    }

    // Initialize logger with debug mode from environment
    const debug = process.env['CLAUDE_HOOKS_DEBUG'] === 'true'
    this.logger = createLogger('macOS TTS', debug)
  }

  async speak(text: string, _options?: { detached?: boolean }): Promise<SpeakResult> {
    const startTime = Date.now()

    // Validate text
    const cleanText = this.validateText(text)
    if (!cleanText) {
      return this.createErrorResult('Empty text')
    }

    // Check if platform is supported
    if (!(await this.isAvailable())) {
      return this.createErrorResult('macOS TTS not available on this platform')
    }

    try {
      // Execute say command securely with spawn
      this.logger.debug(
        `Executing say with voice: ${this.macosConfig.voice}, rate: ${this.macosConfig.rate}`,
      )

      await new Promise<void>((resolve, reject) => {
        const sayProcess = spawn('say', [
          '-v',
          this.macosConfig.voice,
          '-r',
          String(this.macosConfig.rate),
          cleanText,
        ])

        sayProcess.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`say command failed with exit code ${code}`))
          }
        })

        sayProcess.on('error', (error) => {
          reject(error)
        })
      })

      const duration = Date.now() - startTime

      return this.createSuccessResult({
        duration,
      })
    } catch (error) {
      return this.handleError(error)
    }
  }

  async isAvailable(): Promise<boolean> {
    return process.platform === 'darwin'
  }

  getProviderInfo(): TTSProviderInfo {
    return {
      name: 'macos',
      displayName: 'macOS Say',
      version: '1.0.0',
      requiresApiKey: false,
      supportedFeatures: ['speak', 'voices', 'rate'],
    }
  }

  async getVoices(): Promise<Voice[]> {
    // Common macOS voices - these should be available on most macOS systems
    return [
      {
        id: 'Alex',
        name: 'Alex',
        language: 'en-US',
        gender: 'male',
        description: 'American English male voice',
      },
      {
        id: 'Samantha',
        name: 'Samantha',
        language: 'en-US',
        gender: 'female',
        description: 'American English female voice',
      },
      {
        id: 'Daniel',
        name: 'Daniel',
        language: 'en-GB',
        gender: 'male',
        description: 'British English male voice',
      },
      {
        id: 'Karen',
        name: 'Karen',
        language: 'en-AU',
        gender: 'female',
        description: 'Australian English female voice',
      },
      {
        id: 'Moira',
        name: 'Moira',
        language: 'en-IE',
        gender: 'female',
        description: 'Irish English female voice',
      },
      {
        id: 'Tessa',
        name: 'Tessa',
        language: 'en-ZA',
        gender: 'female',
        description: 'South African English female voice',
      },
      {
        id: 'Victoria',
        name: 'Victoria',
        language: 'en-US',
        gender: 'female',
        description: 'American English female voice',
      },
      {
        id: 'Fiona',
        name: 'Fiona',
        language: 'en-GB',
        gender: 'female',
        description: 'Scottish English female voice',
      },
    ]
  }

  override getConfiguration(): TTSProviderConfig {
    return { ...this.macosConfig }
  }

  override configure(config: TTSProviderConfig): void {
    const macosConfig = config as MacOSConfig

    if (macosConfig.voice !== undefined) {
      const validatedVoice = this.validateVoice(macosConfig.voice)
      if (validatedVoice) {
        this.macosConfig.voice = validatedVoice
      }
    }

    if (macosConfig.rate !== undefined) {
      this.macosConfig.rate = this.clampRate(macosConfig.rate)
    }
  }

  /**
   * Clamp speech rate to valid range (50-500 words per minute)
   */
  private clampRate(rate: number): number {
    return Math.max(50, Math.min(500, rate))
  }

  /**
   * Validate voice name against allowed list to prevent injection
   */
  private validateVoice(voice: string | undefined): string | undefined {
    if (!voice) return undefined

    // List of known safe macOS voices
    const allowedVoices = [
      'Alex',
      'Alice',
      'Allison',
      'Ava',
      'Bahh',
      'Bells',
      'Boing',
      'Bruce',
      'Bubbles',
      'Cellos',
      'Daniel',
      'Deranged',
      'Diego',
      'Ellen',
      'Fiona',
      'Fred',
      'Good News',
      'Hysterical',
      'Ioana',
      'Joana',
      'Junior',
      'Kanya',
      'Karen',
      'Kathy',
      'Kyoko',
      'Laura',
      'Lekha',
      'Luca',
      'Luciana',
      'Maged',
      'Mariska',
      'Mei-Jia',
      'Melina',
      'Milena',
      'Moira',
      'Monica',
      'Nora',
      'Paulina',
      'Rishi',
      'Samantha',
      'Sara',
      'Satu',
      'Sin-ji',
      'Tessa',
      'Thomas',
      'Ting-Ting',
      'Veena',
      'Victoria',
      'Xander',
      'Yelda',
      'Yuna',
      'Yuri',
      'Zosia',
      'Zuzana',
    ]

    // Only allow alphanumeric characters, spaces, and hyphens for voice names
    if (!/^[a-zA-Z0-9\s\-]+$/.test(voice)) {
      return undefined
    }

    // Check against allowed voices list (case insensitive)
    const normalizedVoice = voice.trim()
    const isAllowed = allowedVoices.some(
      (allowedVoice) => allowedVoice.toLowerCase() === normalizedVoice.toLowerCase(),
    )

    return isAllowed ? normalizedVoice : undefined
  }

  /**
   * Handle system command errors
   */
  private handleError(error: unknown): SpeakResult {
    let errorMessage = 'macOS TTS failed'

    if (error && typeof error === 'object') {
      const err = error as { message?: string; code?: string }

      if (err.message?.includes('Command not found')) {
        errorMessage = 'Command not found'
      } else if (err.message?.includes('Voice')) {
        errorMessage = 'Voice not available'
      } else if (err.message) {
        errorMessage = err.message
      }
    }

    return this.createErrorResult(errorMessage)
  }
}
