/**
 * TTS Provider abstraction for speech synthesis
 * Defines the interface for all TTS providers (OpenAI, macOS, etc.)
 */

/**
 * Result returned from speaking text
 */
export interface SpeakResult {
  success: boolean
  provider: string
  providerUsed?: string // The actual provider used (useful when fallback occurs)
  cached?: boolean
  duration?: number
  error?: string
}

/**
 * Voice information for TTS providers
 */
export interface Voice {
  id: string
  name: string
  language: string
  gender?: 'male' | 'female' | 'neutral'
  description?: string
}

/**
 * Provider information
 */
export interface TTSProviderInfo {
  name: string
  displayName: string
  version: string
  requiresApiKey: boolean
  supportedFeatures: string[]
}

/**
 * Configuration for TTS providers
 */
export interface TTSProviderConfig {
  [key: string]: unknown
}

/**
 * Base interface for all TTS providers
 */
export interface TTSProvider {
  /**
   * Speak the given text
   */
  speak(text: string, options?: { detached?: boolean }): Promise<SpeakResult>

  /**
   * Check if the provider is available
   */
  isAvailable(): Promise<boolean>

  /**
   * Get provider information
   */
  getProviderInfo(): TTSProviderInfo

  /**
   * Configure the provider
   */
  configure(config: TTSProviderConfig): void

  /**
   * Get current configuration
   */
  getConfiguration(): TTSProviderConfig

  /**
   * Optional: Get available voices
   */
  getVoices?(): Promise<Voice[]>

  /**
   * Optional: Preload audio for text
   */
  preloadAudio?(text: string): Promise<void>

  /**
   * Optional: Cancel ongoing speech
   */
  cancelSpeech?(): void
}

/**
 * Abstract base class for TTS providers
 * Provides common functionality and ensures interface compliance
 */
export abstract class BaseTTSProvider implements TTSProvider {
  protected config: TTSProviderConfig = {}

  constructor(config: TTSProviderConfig = {}) {
    this.config = { ...config }
  }

  abstract speak(text: string, options?: { detached?: boolean }): Promise<SpeakResult>
  abstract isAvailable(): Promise<boolean>
  abstract getProviderInfo(): TTSProviderInfo

  configure(config: TTSProviderConfig): void {
    this.config = { ...this.config, ...config }
  }

  getConfiguration(): TTSProviderConfig {
    return { ...this.config }
  }

  /**
   * Validate text input
   */
  protected validateText(text: string): string | null {
    const trimmed = text.trim()
    if (!trimmed) {
      return null
    }
    return trimmed
  }

  /**
   * Create a standard error result
   */
  protected createErrorResult(error: string): SpeakResult {
    return {
      success: false,
      provider: this.getProviderInfo().name,
      error,
    }
  }

  /**
   * Create a standard success result
   */
  protected createSuccessResult(
    options: {
      cached?: boolean
      duration?: number
    } = {},
  ): SpeakResult {
    return {
      success: true,
      provider: this.getProviderInfo().name,
      ...options,
    }
  }
}
