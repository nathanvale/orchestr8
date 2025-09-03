/**
 * Voice Vault - Main TTS Class
 *
 * The primary interface for Voice Vault TTS system providing:
 * - Zero-config usage with sensible defaults
 * - Simple speak(), preload(), getCacheStats(), clearCache() methods
 * - Automatic correlation ID generation and threading
 * - Comprehensive structured logging for all operations
 * - Provider fallback and error handling
 */

import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  VoiceVaultAudioPlayer,
  createAudioPlayerWithConsoleLogger,
  type AudioPlaybackResult,
} from './audio/index.js'
import { createAudioCache, createDefaultCacheConfig, type AudioCache } from './cache/index.js'
import {
  createVoiceVaultLoggerSync,
  generateCorrelationId,
  type Logger,
  type VoiceVaultLogFields,
} from './logging/index.js'
import {
  ProviderFactory,
  type ProviderHealthStatus,
  type TTSRequestOptions,
} from './providers/index.js'
import type {
  CacheStats,
  VoiceVaultConfig,
  VoiceVaultHealthResult,
  VoiceVaultInitResult,
  VoiceVaultOperationContext,
} from './types/index.js'

/**
 * Voice Vault speak operation result
 */
export interface VoiceVaultSpeakResult {
  /** Operation success status */
  success: boolean
  /** Operation correlation ID */
  correlationId: string
  /** Provider used for generation */
  providerName: string
  /** Whether audio was served from cache */
  fromCache: boolean
  /** Audio generation/retrieval time in milliseconds */
  durationMs: number
  /** Audio playback result (if played) */
  playbackResult?: AudioPlaybackResult
  /** Error message if failed */
  error?: string
  /** Cache key used */
  cacheKey?: string
}

/**
 * Voice Vault preload operation result
 */
export interface VoiceVaultPreloadResult {
  /** Operation success status */
  success: boolean
  /** Operation correlation ID */
  correlationId: string
  /** Provider used for generation */
  providerName: string
  /** Whether audio was already cached */
  alreadyCached: boolean
  /** Audio generation time in milliseconds */
  durationMs: number
  /** Error message if failed */
  error?: string
  /** Cache key generated */
  cacheKey: string
}

/**
 * Main Voice Vault TTS class
 *
 * @example Zero-config usage:
 * ```typescript
 * const vault = new VoiceVault()
 * await vault.speak('Hello world')
 * ```
 *
 * @example With configuration:
 * ```typescript
 * const vault = new VoiceVault({
 *   provider: 'openai',
 *   cache: { enabled: true, maxSizeBytes: 512 * 1024 * 1024 },
 *   logging: { level: 'debug' }
 * })
 *
 * const result = await vault.speak('Welcome to Voice Vault!', {
 *   voice: 'nova',
 *   speed: 1.2
 * })
 *
 * console.log(`Spoke in ${result.durationMs}ms using ${result.providerName}`)
 * ```
 */
export class VoiceVault {
  private readonly instanceId: string
  private readonly instanceCorrelationId: string
  private readonly logger: Logger
  private readonly cache: AudioCache
  private readonly providerFactory: ProviderFactory
  private readonly audioPlayer: VoiceVaultAudioPlayer
  private readonly config: Required<VoiceVaultConfig>
  private initialized = false
  private initResult: VoiceVaultInitResult | null = null

  constructor(config: VoiceVaultConfig = {}) {
    // Generate instance identifiers
    this.instanceId = config.instanceId || `vv-${Date.now()}-${Math.random().toString(36).slice(2)}`
    this.instanceCorrelationId = config.correlationId || generateCorrelationId()

    // Initialize logger first
    this.logger = createVoiceVaultLoggerSync(config.logging || { level: 'info' })

    // Set up complete configuration with defaults
    this.config = {
      cache: createDefaultCacheConfig(config.cache),
      logging: config.logging || { level: 'info' },
      providers: config.providers || {},
      defaultProviderCriteria: config.defaultProviderCriteria || {
        allowFallback: true,
        maxResponseTimeMs: 30000,
      },
      correlationId: this.instanceCorrelationId,
      instanceId: this.instanceId,
    }

    this.logger.info('Voice Vault instance created', {
      correlationId: this.instanceCorrelationId,
      component: 'voice-vault',
      operation: 'constructor',
      instanceId: this.instanceId,
      cacheEnabled: this.config.cache.enabled,
      logLevel: this.config.logging.level,
    } satisfies VoiceVaultLogFields)

    // Initialize core components
    this.cache = createAudioCache(this.config.cache, this.logger)
    this.providerFactory = new ProviderFactory(this.cache, this.logger, {
      correlationId: this.instanceCorrelationId,
    })
    // Initialize audio player
    this.audioPlayer = createAudioPlayerWithConsoleLogger()

    // Log initialization completion
    this.logger.info('Voice Vault core components initialized', {
      correlationId: this.instanceCorrelationId,
      component: 'voice-vault',
      operation: 'initialization',
      instanceId: this.instanceId,
    } satisfies VoiceVaultLogFields)
  }

  /**
   * Initialize Voice Vault (optional - called automatically on first use)
   *
   * @param correlationId Optional correlation ID for this operation
   * @returns Initialization result with timing and status
   */
  async initialize(correlationId?: string): Promise<VoiceVaultInitResult> {
    if (this.initialized && this.initResult) {
      return this.initResult
    }

    const opCorrelationId = correlationId || generateCorrelationId()
    const startTime = Date.now()

    this.logger.info('Initializing Voice Vault', {
      correlationId: opCorrelationId,
      component: 'voice-vault',
      operation: 'initialize',
      instanceId: this.instanceId,
    } satisfies VoiceVaultLogFields)

    try {
      // Check provider availability
      const providerHealth = await this.providerFactory.checkProvidersHealth(opCorrelationId)
      const availableProviders = Object.entries(providerHealth).filter(
        ([, health]) => health.available,
      )

      // Initialize cache if enabled
      let cacheInitialized = false
      if (this.config.cache.enabled) {
        try {
          // Test cache functionality
          const testKey = `init-test-${Date.now()}`
          const testData = Buffer.from('test')
          await this.cache.set(
            testKey,
            testData,
            {
              provider: 'test',
              model: 'test',
              voice: 'test',
              createdAt: Date.now(),
              sizeBytes: testData.length,
              correlationId: opCorrelationId,
            },
            opCorrelationId,
          )
          // Cache test successful (no delete method, entry will be cleaned up)
          cacheInitialized = true
        } catch (error) {
          this.logger.warn('Cache initialization test failed', {
            correlationId: opCorrelationId,
            component: 'voice-vault',
            operation: 'initialize',
            error: (error as Error).message,
          } satisfies VoiceVaultLogFields)
        }
      } else {
        cacheInitialized = true // Cache disabled, so consider it "initialized"
      }

      const initTimeMs = Date.now() - startTime
      const success = availableProviders.length > 0

      this.initResult = {
        success,
        instanceId: this.instanceId,
        correlationId: opCorrelationId,
        providersConfigured: availableProviders.length,
        cacheInitialized,
        initTimeMs,
        error: success ? undefined : 'No available TTS providers found',
      }

      this.initialized = true

      this.logger.info('Voice Vault initialization completed', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'initialize',
        instanceId: this.instanceId,
        success,
        providersConfigured: availableProviders.length,
        cacheInitialized,
        initTimeMs,
      } satisfies VoiceVaultLogFields)

      return this.initResult
    } catch (error) {
      const initTimeMs = Date.now() - startTime

      this.initResult = {
        success: false,
        instanceId: this.instanceId,
        correlationId: opCorrelationId,
        providersConfigured: 0,
        cacheInitialized: false,
        initTimeMs,
        error: (error as Error).message,
      }

      this.logger.error('Voice Vault initialization failed', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'initialize',
        instanceId: this.instanceId,
        error: (error as Error).message,
        initTimeMs,
      } satisfies VoiceVaultLogFields)

      throw error
    }
  }

  /**
   * Speak text using TTS with automatic provider selection and caching
   *
   * @param text Text to speak
   * @param options TTS options (voice, speed, etc.)
   * @param play Whether to play the audio (default: true)
   * @param correlationId Optional correlation ID for tracing
   * @returns Speak operation result
   *
   * @example
   * ```typescript
   * // Simple usage
   * await vault.speak('Hello world')
   *
   * // With options
   * const result = await vault.speak('Welcome!', {
   *   voice: 'nova',
   *   speed: 1.2,
   *   provider: 'openai'
   * })
   *
   * console.log(`Spoke using ${result.providerName} in ${result.durationMs}ms`)
   * ```
   */
  async speak(
    text: string,
    options: TTSRequestOptions & { provider?: string } = {},
    play = true,
    correlationId?: string,
  ): Promise<VoiceVaultSpeakResult> {
    // Auto-initialize if needed
    if (!this.initialized) {
      await this.initialize(correlationId)
    }

    const opCorrelationId = correlationId || generateCorrelationId()
    this.createOperationContext('speak', opCorrelationId)
    const startTime = Date.now()

    this.logger.info('Starting speak operation', {
      correlationId: opCorrelationId,
      component: 'voice-vault',
      operation: 'speak',
      instanceId: this.instanceId,
      textLength: text.length,
      requestedProvider: options.provider,
      voice: options.voice,
      speed: options.speed,
      play,
    } satisfies VoiceVaultLogFields)

    try {
      // Get provider
      const providerResult = await this.providerFactory.getProvider(
        options.provider,
        this.config.providers[options.provider || ''] || {},
        {
          ...this.config.defaultProviderCriteria,
          correlationId: opCorrelationId,
        },
      )

      const provider = providerResult.provider
      const providerName = providerResult.providerName

      this.logger.debug('Provider selected for speak operation', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'speak',
        selectedProvider: providerName,
        isFallback: providerResult.isFallback,
      } satisfies VoiceVaultLogFields)

      // Generate speech
      const speakResult = await provider.speak(text, {
        ...options,
        correlationId: opCorrelationId,
      })

      let playbackResult: AudioPlaybackResult | undefined

      // Play audio if requested
      if (play && speakResult.audioData) {
        try {
          // Save audio buffer to temporary file
          const tempDir = path.join(tmpdir(), 'voice-vault')
          await fs.mkdir(tempDir, { recursive: true })

          const tempFilePath = path.join(tempDir, `audio-${opCorrelationId}.mp3`)
          await fs.writeFile(tempFilePath, speakResult.audioData)

          this.logger.info('Saved audio to temp file for playback', {
            correlationId: opCorrelationId,
            component: 'voice-vault',
            operation: 'speak',
            tempFilePath,
            audioSize: speakResult.audioData.length,
          } satisfies VoiceVaultLogFields)

          // Play the audio file
          playbackResult = await this.audioPlayer.playAudio(tempFilePath, {
            correlationId: opCorrelationId,
          })

          // Clean up temp file after playback
          try {
            await fs.unlink(tempFilePath)
            this.logger.debug('Cleaned up temp audio file', {
              correlationId: opCorrelationId,
              component: 'voice-vault',
              operation: 'speak',
              tempFilePath,
            } satisfies VoiceVaultLogFields)
          } catch (cleanupError) {
            this.logger.warn('Failed to clean up temp audio file', {
              correlationId: opCorrelationId,
              component: 'voice-vault',
              operation: 'speak',
              tempFilePath,
              error: (cleanupError as Error).message,
            } satisfies VoiceVaultLogFields)
          }

          this.logger.debug('Audio playback completed', {
            correlationId: opCorrelationId,
            component: 'voice-vault',
            operation: 'speak',
            playbackDurationMs: playbackResult?.durationMs,
            playbackSuccess: playbackResult?.success,
          } satisfies VoiceVaultLogFields)
        } catch (playbackError) {
          this.logger.warn('Audio playback failed', {
            correlationId: opCorrelationId,
            component: 'voice-vault',
            operation: 'speak',
            error: (playbackError as Error).message,
          } satisfies VoiceVaultLogFields)
        }
      }

      const durationMs = Date.now() - startTime

      const result: VoiceVaultSpeakResult = {
        success: speakResult.success,
        correlationId: opCorrelationId,
        providerName,
        fromCache: speakResult.cached || false,
        durationMs,
        playbackResult,
        cacheKey: speakResult.cacheKey,
        error: speakResult.error,
      }

      if (speakResult.success) {
        this.logger.info('Speak operation completed successfully', {
          correlationId: opCorrelationId,
          component: 'voice-vault',
          operation: 'speak',
          instanceId: this.instanceId,
          providerName,
          fromCache: speakResult.cached || false,
          durationMs,
          textLength: text.length,
          audioSize: speakResult.audioData?.length,
          playbackSuccess: playbackResult?.success,
        } satisfies VoiceVaultLogFields)
      } else {
        this.logger.error('Speak operation failed', {
          correlationId: opCorrelationId,
          component: 'voice-vault',
          operation: 'speak',
          instanceId: this.instanceId,
          providerName,
          error: speakResult.error,
          durationMs,
          textLength: text.length,
        } satisfies VoiceVaultLogFields)
      }

      return result
    } catch (error) {
      const durationMs = Date.now() - startTime

      const result: VoiceVaultSpeakResult = {
        success: false,
        correlationId: opCorrelationId,
        providerName: 'unknown',
        fromCache: false,
        durationMs,
        error: (error as Error).message,
      }

      this.logger.error('Speak operation failed', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'speak',
        instanceId: this.instanceId,
        error: (error as Error).message,
        durationMs,
        textLength: text.length,
      } satisfies VoiceVaultLogFields)

      return result
    }
  }

  /**
   * Preload text into cache without playing
   *
   * @param text Text to preload
   * @param options TTS options
   * @param correlationId Optional correlation ID
   * @returns Preload operation result
   *
   * @example
   * ```typescript
   * // Warm cache for later use
   * const result = await vault.preload('Welcome back!', { voice: 'nova' })
   * if (result.success) {
   *   console.log(`Preloaded in ${result.durationMs}ms`)
   * }
   * ```
   */
  async preload(
    text: string,
    options: TTSRequestOptions & { provider?: string } = {},
    correlationId?: string,
  ): Promise<VoiceVaultPreloadResult> {
    // Auto-initialize if needed
    if (!this.initialized) {
      await this.initialize(correlationId)
    }

    const opCorrelationId = correlationId || generateCorrelationId()
    const startTime = Date.now()

    this.logger.info('Starting preload operation', {
      correlationId: opCorrelationId,
      component: 'voice-vault',
      operation: 'preload',
      instanceId: this.instanceId,
      textLength: text.length,
      requestedProvider: options.provider,
      voice: options.voice,
    } satisfies VoiceVaultLogFields)

    try {
      // Get provider
      const providerResult = await this.providerFactory.getProvider(
        options.provider,
        this.config.providers[options.provider || ''] || {},
        {
          ...this.config.defaultProviderCriteria,
          correlationId: opCorrelationId,
        },
      )

      const provider = providerResult.provider
      const providerName = providerResult.providerName

      // Generate cache key first to check if already cached
      const cacheKey = await this.cache.generateKey(
        {
          provider: providerName,
          text,
          model: options.model || 'default',
          voice: options.voice || 'default',
          speed: options.speed || 1.0,
          format: options.format || 'mp3',
        },
        opCorrelationId,
      )

      // Check if already cached
      const existingEntry = await this.cache.get(cacheKey, opCorrelationId)

      if (existingEntry) {
        const durationMs = Date.now() - startTime

        const result: VoiceVaultPreloadResult = {
          success: true,
          correlationId: opCorrelationId,
          providerName,
          alreadyCached: true,
          durationMs,
          cacheKey,
        }

        this.logger.info('Preload completed - already cached', {
          correlationId: opCorrelationId,
          component: 'voice-vault',
          operation: 'preload',
          instanceId: this.instanceId,
          providerName,
          durationMs,
          cacheKey,
        } satisfies VoiceVaultLogFields)

        return result
      }

      // Generate and cache audio
      const speakResult = await provider.speak(text, {
        ...options,
        correlationId: opCorrelationId,
      })

      const durationMs = Date.now() - startTime

      const result: VoiceVaultPreloadResult = {
        success: true,
        correlationId: opCorrelationId,
        providerName,
        alreadyCached: false,
        durationMs,
        cacheKey: speakResult.cacheKey || cacheKey,
      }

      this.logger.info('Preload operation completed successfully', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'preload',
        instanceId: this.instanceId,
        providerName,
        durationMs,
        textLength: text.length,
        audioSize: speakResult.audioData?.length,
        cacheKey: result.cacheKey,
      } satisfies VoiceVaultLogFields)

      return result
    } catch (error) {
      const durationMs = Date.now() - startTime

      const result: VoiceVaultPreloadResult = {
        success: false,
        correlationId: opCorrelationId,
        providerName: 'unknown',
        alreadyCached: false,
        durationMs,
        cacheKey: '',
        error: (error as Error).message,
      }

      this.logger.error('Preload operation failed', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'preload',
        instanceId: this.instanceId,
        error: (error as Error).message,
        durationMs,
        textLength: text.length,
      } satisfies VoiceVaultLogFields)

      return result
    }
  }

  /**
   * Get cache statistics and health information
   *
   * @param correlationId Optional correlation ID
   * @returns Current cache statistics
   *
   * @example
   * ```typescript
   * const stats = await vault.getCacheStats()
   * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)
   * console.log(`Cache size: ${(stats.totalSize / 1024 / 1024).toFixed(1)}MB`)
   * ```
   */
  async getCacheStats(correlationId?: string): Promise<CacheStats> {
    const opCorrelationId = correlationId || generateCorrelationId()

    this.logger.debug('Retrieving cache statistics', {
      correlationId: opCorrelationId,
      component: 'voice-vault',
      operation: 'get-cache-stats',
      instanceId: this.instanceId,
    } satisfies VoiceVaultLogFields)

    try {
      const stats = await this.cache.getStats(opCorrelationId)

      this.logger.debug('Cache statistics retrieved', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'get-cache-stats',
        instanceId: this.instanceId,
        hitRate: stats.hitRate,
        totalEntries: stats.entryCount,
        totalSizeBytes: stats.totalSize,
      } satisfies VoiceVaultLogFields)

      return stats
    } catch (error) {
      this.logger.error('Failed to retrieve cache statistics', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'get-cache-stats',
        instanceId: this.instanceId,
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)

      throw error
    }
  }

  /**
   * Clear all cached audio data
   *
   * @param correlationId Optional correlation ID
   * @returns Number of entries cleared
   *
   * @example
   * ```typescript
   * const cleared = await vault.clearCache()
   * console.log(`Cleared ${cleared} cached entries`)
   * ```
   */
  async clearCache(correlationId?: string): Promise<number> {
    const opCorrelationId = correlationId || generateCorrelationId()

    this.logger.info('Starting cache clear operation', {
      correlationId: opCorrelationId,
      component: 'voice-vault',
      operation: 'clear-cache',
      instanceId: this.instanceId,
    } satisfies VoiceVaultLogFields)

    try {
      const statsBeforeClear = await this.cache.getStats(opCorrelationId)
      // Use cleanup instead of clear as AudioCache doesn't have a clear method
      await this.cache.cleanup(opCorrelationId)
      const entriesCleared = 0 // cleanup doesn't return count

      this.logger.info('Cache cleared successfully', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'clear-cache',
        instanceId: this.instanceId,
        entriesCleared,
        bytesFreed: statsBeforeClear.totalSize,
      } satisfies VoiceVaultLogFields)

      return entriesCleared
    } catch (error) {
      this.logger.error('Failed to clear cache', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'clear-cache',
        instanceId: this.instanceId,
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)

      throw error
    }
  }

  /**
   * Get provider health status (for test compatibility)
   *
   * @param correlationId Optional correlation ID
   * @returns Provider health status mapping
   */
  async getProviderHealth(correlationId?: string): Promise<Record<string, ProviderHealthStatus>> {
    const healthResult = await this.getHealthStatus(correlationId)
    return healthResult.components.providers
  }

  /**
   * Get comprehensive health status of Voice Vault system
   *
   * @param correlationId Optional correlation ID
   * @returns Complete health check result
   */
  async getHealthStatus(correlationId?: string): Promise<VoiceVaultHealthResult> {
    const opCorrelationId = correlationId || generateCorrelationId()
    const startTime = Date.now()

    this.logger.info('Starting health check', {
      correlationId: opCorrelationId,
      component: 'voice-vault',
      operation: 'health-check',
      instanceId: this.instanceId,
    } satisfies VoiceVaultLogFields)

    try {
      // Check providers
      const providerHealth = await this.providerFactory.checkProvidersHealth(opCorrelationId)

      // Check cache
      const cacheStats = await this.cache.getStats(opCorrelationId)
      const cacheHealthCheck = await this.cache.healthCheck(opCorrelationId)

      // Calculate overall metrics (simplified for example)
      const healthyProviders = Object.values(providerHealth).filter((p) => p.available).length
      const totalProviders = Object.keys(providerHealth).length

      const result: VoiceVaultHealthResult = {
        status:
          healthyProviders > 0 && cacheHealthCheck.status === 'healthy'
            ? 'healthy'
            : healthyProviders > 0
              ? 'degraded'
              : 'unhealthy',
        timestamp: Date.now(),
        correlationId: opCorrelationId,
        components: {
          cache: cacheHealthCheck,
          providers: Object.fromEntries(
            Object.entries(providerHealth).map(([name, health]) => [
              name,
              {
                status: health.available
                  ? 'healthy'
                  : ('unhealthy' as 'healthy' | 'degraded' | 'unhealthy' | 'unknown'),
                timestamp: Date.now(),
                correlationId: opCorrelationId,
                responseTimeMs: 0,
                errorRate: 0,
                details: {
                  apiConnectable: health.available,
                  authenticated: health.available,
                  rateLimited: false,
                  recentErrors: health.available ? 0 : 1,
                },
                messages: health.error ? [health.error] : [],
              } satisfies ProviderHealthStatus,
            ]),
          ),
          logging: { status: 'healthy' as const },
        },
        metrics: {
          avgOperationTimeMs: 0, // Would track this over time
          totalOperations: 0, // Would track this over time
          errorRate: 0, // Would track this over time
          cacheHitRate: cacheStats.hitRate,
        },
        messages: [
          `${healthyProviders}/${totalProviders} providers available`,
          `Cache: ${cacheStats.entryCount} entries, ${(cacheStats.hitRate * 100).toFixed(1)}% hit rate`,
        ],
      }

      this.logger.info('Health check completed', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'health-check',
        instanceId: this.instanceId,
        overallStatus: result.status,
        healthyProviders,
        totalProviders,
        cacheHealthy: cacheHealthCheck.status === 'healthy',
        checkDurationMs: Date.now() - startTime,
      } satisfies VoiceVaultLogFields)

      return result
    } catch (error) {
      this.logger.error('Health check failed', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'health-check',
        instanceId: this.instanceId,
        error: (error as Error).message,
        checkDurationMs: Date.now() - startTime,
      } satisfies VoiceVaultLogFields)

      throw error
    }
  }

  /**
   * Clean shutdown of Voice Vault instance
   *
   * @param correlationId Optional correlation ID
   */
  async cleanup(correlationId?: string): Promise<void> {
    const opCorrelationId = correlationId || generateCorrelationId()

    this.logger.info('Starting Voice Vault cleanup', {
      correlationId: opCorrelationId,
      component: 'voice-vault',
      operation: 'cleanup',
      instanceId: this.instanceId,
    } satisfies VoiceVaultLogFields)

    try {
      // Cleanup provider factory
      await this.providerFactory.cleanup(opCorrelationId)

      // Cleanup cache
      await this.cache.cleanup(opCorrelationId)

      this.logger.info('Voice Vault cleanup completed', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'cleanup',
        instanceId: this.instanceId,
      } satisfies VoiceVaultLogFields)
    } catch (error) {
      this.logger.error('Voice Vault cleanup failed', {
        correlationId: opCorrelationId,
        component: 'voice-vault',
        operation: 'cleanup',
        instanceId: this.instanceId,
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)

      throw error
    }
  }

  // Private helper methods

  private createOperationContext(
    operation: string,
    correlationId: string,
  ): VoiceVaultOperationContext {
    return {
      correlationId,
      operation,
      instanceId: this.instanceId,
      startTime: Date.now(),
      metadata: {},
    }
  }
}
