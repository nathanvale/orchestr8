/**
 * Provider Factory for Voice Vault TTS
 *
 * Centralized factory for creating and managing TTS provider instances with:
 * - Provider registration and discovery
 * - Selection criteria handling
 * - Fallback mechanisms
 * - Configuration management
 * - Performance monitoring
 */

import type { AudioCache } from '../cache/audio-cache.js'
import { generateCorrelationId, type Logger, type VoiceVaultLogFields } from '../logging/index.js'
import { ElevenLabsProvider } from './elevenlabs-provider.js'
import { OpenAIProvider } from './openai-provider.js'
import { SystemProvider } from './system-provider.js'
import type {
  ProviderRegistryEntry,
  ProviderSelectionCriteria,
  ProviderSelectionResult,
  TTSProvider,
  TTSProviderConfig,
  TTSProviderFactory,
} from './types.js'

/**
 * Configuration for the provider factory
 */
export interface ProviderFactoryConfig {
  correlationId?: string
  enabledProviders?: string[] // List of provider names to enable
  fallbackEnabled?: boolean // Whether to enable fallback selection
  selectionTimeoutMs?: number // Timeout for provider selection
  healthCheckInterval?: number // Interval for periodic health checks
}

/**
 * Provider Factory for managing TTS providers
 */
export class ProviderFactory {
  private readonly registry: Map<string, ProviderRegistryEntry> = new Map()
  private readonly providerInstances: Map<string, TTSProvider> = new Map()
  private readonly factoryConfig: Required<ProviderFactoryConfig>
  private readonly instanceCorrelationId: string

  constructor(
    private readonly cache: AudioCache,
    private readonly logger: Logger,
    config: ProviderFactoryConfig = {},
  ) {
    this.instanceCorrelationId = config.correlationId || generateCorrelationId()

    this.factoryConfig = {
      correlationId: this.instanceCorrelationId,
      enabledProviders: config.enabledProviders ?? ['openai', 'elevenlabs', 'system'],
      fallbackEnabled: config.fallbackEnabled ?? true,
      selectionTimeoutMs: config.selectionTimeoutMs ?? 10000,
      healthCheckInterval: config.healthCheckInterval ?? 5 * 60 * 1000, // 5 minutes
    }

    this.logger.info('TTS Provider Factory initialized', {
      correlationId: this.instanceCorrelationId,
      component: 'provider',
      operation: 'factory-init',
      enabledProviders: this.factoryConfig.enabledProviders,
      fallbackEnabled: this.factoryConfig.fallbackEnabled,
    } satisfies VoiceVaultLogFields)

    // Register built-in providers
    this.registerDefaultProviders()
  }

  /**
   * Register a provider factory function
   */
  registerProvider(entry: ProviderRegistryEntry): void {
    const correlationId = generateCorrelationId()

    this.logger.debug('Registering TTS provider', {
      correlationId,
      component: 'provider',
      operation: 'register-provider',
      providerName: entry.name,
      priority: entry.priority,
      enabledByDefault: entry.enabledByDefault,
    } satisfies VoiceVaultLogFields)

    this.registry.set(entry.name, entry)
  }

  /**
   * Get a provider instance with optional selection criteria
   */
  async getProvider(
    providerName?: string,
    config: TTSProviderConfig = {},
    criteria: ProviderSelectionCriteria = {},
  ): Promise<ProviderSelectionResult> {
    const correlationId = criteria.correlationId || generateCorrelationId()
    const startTime = Date.now()

    this.logger.info('Selecting TTS provider', {
      correlationId,
      component: 'provider',
      operation: 'provider-selection',
      requestedProvider: providerName,
      enabledProviders: this.factoryConfig.enabledProviders,
      allowFallback: criteria.allowFallback ?? this.factoryConfig.fallbackEnabled,
    } satisfies VoiceVaultLogFields)

    try {
      // If specific provider requested, try that first
      if (providerName) {
        const result = await this.tryGetProvider(providerName, config, criteria, correlationId)
        if (result) {
          const duration = Date.now() - startTime

          this.logger.info('Provider selected successfully', {
            correlationId,
            component: 'provider',
            operation: 'provider-selection',
            selectedProvider: result.providerName,
            selectionTime: duration,
            isFallback: result.isFallback,
          } satisfies VoiceVaultLogFields)

          return result
        }

        // If fallback is disabled, fail here
        if (!criteria.allowFallback && !this.factoryConfig.fallbackEnabled) {
          throw new Error(`Provider '${providerName}' not available and fallback disabled`)
        }
      }

      // Try providers in priority order
      const availableProviders = this.getAvailableProviders()
      const sortedProviders = availableProviders.sort((a, b) => b.priority - a.priority)
      const alternativesConsidered: string[] = []

      for (const entry of sortedProviders) {
        alternativesConsidered.push(entry.name)

        if (!this.factoryConfig.enabledProviders.includes(entry.name)) {
          continue
        }

        const result = await this.tryGetProvider(entry.name, config, criteria, correlationId)
        if (result) {
          const duration = Date.now() - startTime

          result.isFallback = !!providerName && providerName !== entry.name
          result.alternativesConsidered = alternativesConsidered

          this.logger.info('Provider selected via fallback', {
            correlationId,
            component: 'provider',
            operation: 'provider-selection',
            requestedProvider: providerName,
            selectedProvider: result.providerName,
            selectionTime: duration,
            isFallback: result.isFallback,
            alternativesConsidered: alternativesConsidered.length,
          } satisfies VoiceVaultLogFields)

          return result
        }
      }

      // No provider available
      const duration = Date.now() - startTime

      this.logger.error('No TTS provider available', {
        correlationId,
        component: 'provider',
        operation: 'provider-selection',
        requestedProvider: providerName,
        enabledProviders: this.factoryConfig.enabledProviders,
        alternativesConsidered: alternativesConsidered.length,
        selectionTime: duration,
      } satisfies VoiceVaultLogFields)

      throw new Error(
        `No available TTS provider found (tried: ${alternativesConsidered.join(', ')})`,
      )
    } catch (error) {
      const duration = Date.now() - startTime

      this.logger.error('Provider selection failed', {
        correlationId,
        component: 'provider',
        operation: 'provider-selection',
        error: (error as Error).message,
        selectionTime: duration,
      } satisfies VoiceVaultLogFields)

      throw error
    }
  }

  /**
   * Get list of registered providers
   */
  getRegisteredProviders(): ProviderRegistryEntry[] {
    return Array.from(this.registry.values())
  }

  /**
   * Get list of available (enabled) providers
   */
  getAvailableProviders(): ProviderRegistryEntry[] {
    return Array.from(this.registry.values()).filter(
      (entry) => entry.enabledByDefault || this.factoryConfig.enabledProviders.includes(entry.name),
    )
  }

  /**
   * Check health of all providers
   */
  async checkProvidersHealth(
    correlationId?: string,
  ): Promise<Record<string, { available: boolean; error?: string }>> {
    const opCorrelationId = correlationId || generateCorrelationId()
    const results: Record<string, { available: boolean; error?: string }> = {}

    this.logger.info('Checking health of all providers', {
      correlationId: opCorrelationId,
      component: 'provider',
      operation: 'health-check-all',
      providerCount: this.factoryConfig.enabledProviders.length,
    } satisfies VoiceVaultLogFields)

    for (const providerName of this.factoryConfig.enabledProviders) {
      try {
        const result = await this.tryGetProvider(
          providerName,
          {},
          { correlationId: opCorrelationId },
          opCorrelationId,
        )
        if (result) {
          const availability = await result.provider.isAvailable(opCorrelationId)
          results[providerName] = {
            available: availability.available,
            error: availability.reason,
          }
        } else {
          results[providerName] = {
            available: false,
            error: 'Provider instance creation failed',
          }
        }
      } catch (error) {
        results[providerName] = {
          available: false,
          error: (error as Error).message,
        }
      }
    }

    const healthyCount = Object.values(results).filter((r) => r.available).length

    this.logger.info('Provider health check completed', {
      correlationId: opCorrelationId,
      component: 'provider',
      operation: 'health-check-all',
      totalProviders: this.factoryConfig.enabledProviders.length,
      healthyProviders: healthyCount,
      healthyRatio: healthyCount / this.factoryConfig.enabledProviders.length,
    } satisfies VoiceVaultLogFields)

    return results
  }

  /**
   * Clean up all provider instances
   */
  async cleanup(correlationId?: string): Promise<void> {
    const opCorrelationId = correlationId || generateCorrelationId()

    this.logger.info('Cleaning up provider factory', {
      correlationId: opCorrelationId,
      component: 'provider',
      operation: 'cleanup',
      instanceCount: this.providerInstances.size,
    } satisfies VoiceVaultLogFields)

    const cleanupPromises = Array.from(this.providerInstances.values()).map(async (provider) => {
      try {
        if (provider.cleanup) {
          await provider.cleanup()
        }
      } catch (error) {
        this.logger.warn('Provider cleanup error', {
          correlationId: opCorrelationId,
          component: 'provider',
          operation: 'cleanup',
          error: (error as Error).message,
        } satisfies VoiceVaultLogFields)
      }
    })

    await Promise.allSettled(cleanupPromises)
    this.providerInstances.clear()
  }

  // Private methods

  private registerDefaultProviders(): void {
    // Register OpenAI TTS Provider
    this.registerProvider({
      name: 'openai',
      factory: this.createOpenAIProviderFactory(),
      priority: 100,
      enabledByDefault: true,
      configSchema: {
        apiKey: 'string',
        model: ['tts-1', 'tts-1-hd'],
        voice: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
        speed: 'number',
        format: ['mp3', 'opus', 'aac', 'flac'],
      },
    })

    // Register ElevenLabs TTS Provider
    this.registerProvider({
      name: 'elevenlabs',
      factory: this.createElevenLabsProviderFactory(),
      priority: 90,
      enabledByDefault: true,
      configSchema: {
        apiKey: 'string',
        voiceId: 'string',
        modelId: 'string',
        outputFormat: 'string',
        stability: 'number',
        similarityBoost: 'number',
        speed: 'number',
      },
    })

    // Register System TTS Provider
    this.registerProvider({
      name: 'system',
      factory: this.createSystemProviderFactory(),
      priority: 50,
      enabledByDefault: true,
      configSchema: {
        voice: 'string',
        rate: 'number',
        volume: 'number',
        pitch: 'number',
      },
    })
  }

  private createOpenAIProviderFactory(): TTSProviderFactory {
    return async (config: TTSProviderConfig) => {
      return new OpenAIProvider(this.cache, config, this.logger)
    }
  }

  private createElevenLabsProviderFactory(): TTSProviderFactory {
    return async (config: TTSProviderConfig) => {
      return new ElevenLabsProvider(this.cache, config, this.logger)
    }
  }

  private createSystemProviderFactory(): TTSProviderFactory {
    return async (config: TTSProviderConfig) => {
      return new SystemProvider(config, this.logger)
    }
  }

  private async tryGetProvider(
    providerName: string,
    config: TTSProviderConfig,
    criteria: ProviderSelectionCriteria,
    correlationId: string,
  ): Promise<ProviderSelectionResult | null> {
    try {
      const entry = this.registry.get(providerName)
      if (!entry) {
        this.logger.debug('Provider not registered', {
          correlationId,
          component: 'provider',
          operation: 'provider-lookup',
          providerName,
        } satisfies VoiceVaultLogFields)
        return null
      }

      // Check if we already have an instance
      let provider = this.providerInstances.get(providerName)
      if (!provider) {
        // Create new instance
        this.logger.debug('Creating new provider instance', {
          correlationId,
          component: 'provider',
          operation: 'provider-create',
          providerName,
        } satisfies VoiceVaultLogFields)

        provider = await entry.factory({ ...config, correlationId })
        this.providerInstances.set(providerName, provider)
      } else if (Object.keys(config).length > 0) {
        // Update existing instance configuration
        await provider.configure({ ...config, correlationId })
      }

      // Check availability
      const availability = await provider.isAvailable(correlationId)
      if (!availability.available) {
        this.logger.debug('Provider not available', {
          correlationId,
          component: 'provider',
          operation: 'provider-availability',
          providerName,
          reason: availability.reason,
        } satisfies VoiceVaultLogFields)
        return null
      }

      // Apply selection criteria
      if (!this.meetsSelectionCriteria(provider, criteria)) {
        this.logger.debug('Provider does not meet selection criteria', {
          correlationId,
          component: 'provider',
          operation: 'provider-criteria',
          providerName,
        } satisfies VoiceVaultLogFields)
        return null
      }

      return {
        provider,
        providerName,
        reason: 'Provider available and meets criteria',
        isFallback: false,
        correlationId,
        alternativesConsidered: [],
      }
    } catch (error) {
      this.logger.warn('Provider creation/check failed', {
        correlationId,
        component: 'provider',
        operation: 'provider-try',
        providerName,
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)
      return null
    }
  }

  private async meetsSelectionCriteria(
    provider: TTSProvider,
    criteria: ProviderSelectionCriteria,
  ): Promise<boolean> {
    const info = provider.getProviderInfo()

    // Check required features
    if (criteria.requiredFeatures) {
      const hasAllFeatures = criteria.requiredFeatures.every((feature) =>
        info.supportedFeatures.includes(feature),
      )
      if (!hasAllFeatures) return false
    }

    // Check response time if specified
    if (criteria.maxResponseTimeMs) {
      try {
        const startTime = Date.now()
        await provider.isAvailable(criteria.correlationId)
        const responseTime = Date.now() - startTime
        if (responseTime > criteria.maxResponseTimeMs) return false
      } catch {
        return false
      }
    }

    // Check voice language support
    if (criteria.requiredLanguage && provider.getVoices) {
      try {
        const voices = await provider.getVoices(criteria.correlationId)
        const hasLanguage = voices.some((voice) =>
          voice.language.startsWith(criteria.requiredLanguage!),
        )
        if (!hasLanguage) return false
      } catch {
        // If we can't get voices, assume language is supported
      }
    }

    // Check quality threshold
    if (criteria.minQuality && provider.getVoices) {
      try {
        const voices = await provider.getVoices(criteria.correlationId)
        const hasQuality = voices.some((voice) => (voice.quality || 1) >= criteria.minQuality!)
        if (!hasQuality) return false
      } catch {
        // If we can't get voices, assume quality is acceptable
      }
    }

    return true
  }
}
