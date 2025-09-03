/**
 * Voice Vault Cache System
 * Central export point for all caching functionality with comprehensive observability
 */

// Core cache implementation
export { AudioCache } from './audio-cache.js'
export { TextNormalizer } from './text-normalizer.js'

// Import classes and types for function returns
import { AudioCache } from './audio-cache.js'
import type {
  CacheKeyParams,
  CacheNormalizationConfig,
  VoiceVaultCacheConfig,
} from './cache-config.js'
import { TextNormalizer } from './text-normalizer.js'

// Re-export cache types for convenience
export type {
  CacheEntry,
  CacheEntryFile,
  CacheEntryMetadata,
  CacheHealthStatus,
  CacheKeyParams,
  CacheLimits,
  CacheNormalizationConfig,
  CacheOperationContext,
  CacheOperationResult,
  CachePerformanceConfig,
  CacheStats,
  CacheStorageConfig,
  CacheValidationResult,
  VoiceVaultCacheConfig,
} from './cache-config.js'

// Re-export text normalization result
export type { TextNormalizationResult } from './text-normalizer.js'

/**
 * Create a pre-configured AudioCache instance with logging
 *
 * @param config Cache configuration options
 * @param logger Logger instance for observability
 * @returns Configured AudioCache instance
 *
 * @example
 * ```typescript
 * import { createAudioCache, createVoiceVaultLoggerSync } from '@voice-vault/core'
 *
 * const logger = createVoiceVaultLoggerSync()
 * const cache = createAudioCache({
 *   maxSizeBytes: 512 * 1024 * 1024, // 512MB
 *   maxEntries: 5000,
 *   enableHitLogging: true,
 * }, logger)
 *
 * // Generate cache key
 * const key = await cache.generateKey({
 *   provider: 'openai',
 *   text: 'Hello, world!',
 *   model: 'tts-1',
 *   voice: 'nova',
 *   speed: 1.0,
 *   format: 'mp3'
 * })
 *
 * // Try to get from cache
 * const cached = await cache.get(key)
 * if (cached) {
 *   console.log('Cache hit!', cached.metadata)
 * } else {
 *   // Generate audio and cache it
 *   const audioData = await generateAudio(...)
 *   await cache.set(key, audioData, metadata)
 * }
 *
 * // Get cache statistics
 * const stats = await cache.getStats()
 * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)
 * ```
 */
export function createAudioCache(
  config: VoiceVaultCacheConfig = {},
  logger: import('../types/index.js').Logger,
): AudioCache {
  return new AudioCache(config, logger)
}

/**
 * Create a TextNormalizer instance for standalone text processing
 *
 * @param config Text normalization configuration
 * @param logger Logger instance for observability
 * @returns Configured TextNormalizer instance
 *
 * @example
 * ```typescript
 * import { createTextNormalizer, createVoiceVaultLoggerSync } from '@voice-vault/core'
 *
 * const logger = createVoiceVaultLoggerSync()
 * const normalizer = createTextNormalizer({
 *   caseSensitive: false,
 *   stripPriorityPrefixes: true,
 *   normalizeWhitespace: true,
 * }, logger)
 *
 * const result = normalizer.normalizeText('  High priority: Hello World!  ', 'corr-123')
 * console.log(result.normalizedText) // "hello world!"
 * console.log(result.stepsApplied) // ["normalize-whitespace", "strip-priority-prefixes", "lowercase"]
 * ```
 */
export function createTextNormalizer(
  config: CacheNormalizationConfig = {},
  logger: import('../types/index.js').Logger,
): TextNormalizer {
  return new TextNormalizer(config, logger)
}

/**
 * Utility function to create a cache key from TTS parameters without instantiating a full cache
 *
 * @param params TTS parameters for key generation
 * @param config Optional normalization configuration
 * @param logger Logger instance
 * @param correlationId Optional correlation ID for tracing
 * @returns Promise resolving to cache key string
 *
 * @example
 * ```typescript
 * import { generateCacheKey, createVoiceVaultLoggerSync } from '@voice-vault/core'
 *
 * const logger = createVoiceVaultLoggerSync()
 * const key = await generateCacheKey({
 *   provider: 'elevenlabs',
 *   text: 'Welcome to Voice Vault!',
 *   model: 'eleven_monolingual_v1',
 *   voice: 'rachel',
 *   speed: 1.2,
 *   format: 'mp3'
 * }, {}, logger)
 *
 * console.log('Generated key:', key)
 * ```
 */
export async function generateCacheKey(
  params: CacheKeyParams,
  config: CacheNormalizationConfig = {},
  logger: import('../types/index.js').Logger,
  correlationId?: string,
): Promise<string> {
  const normalizer = new TextNormalizer(config, logger)
  const result = normalizer.generateCacheKey(params, correlationId || `gen-${Date.now()}`)
  return result.cacheKey
}

/**
 * Utility function to create default cache configuration with sensible defaults
 *
 * @param overrides Optional configuration overrides
 * @returns Complete cache configuration
 *
 * @example
 * ```typescript
 * import { createDefaultCacheConfig } from '@voice-vault/core'
 *
 * const config = createDefaultCacheConfig({
 *   maxSizeBytes: 2 * 1024 * 1024 * 1024, // 2GB
 *   enableHitLogging: false, // Disable hit logging for performance
 * })
 *
 * console.log(config.maxEntries) // 10000 (default)
 * console.log(config.maxAgeMs) // 30 days (default)
 * ```
 */
export function createDefaultCacheConfig(
  overrides: Partial<VoiceVaultCacheConfig> = {},
): VoiceVaultCacheConfig {
  const tmpDir = '/tmp' // Default to /tmp, will be overridden if needed

  return {
    // Cache limits
    enabled: true,
    maxSizeBytes: 1024 * 1024 * 1024, // 1GB
    maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxEntries: 10000,
    minFreeDiskBytes: 100 * 1024 * 1024, // 100MB

    // Storage configuration
    cacheDir: `${tmpDir}/voice-vault-cache`,
    entriesSubdir: 'entries',
    audioSubdir: 'audio',
    fileMode: 0o644,
    dirMode: 0o755,

    // Performance and monitoring
    enableMonitoring: true,
    statsInterval: 5 * 60 * 1000, // 5 minutes
    enableTiming: false,
    enableHitLogging: true,
    cleanupInterval: 60 * 60 * 1000, // 1 hour

    // Text normalization
    normalization: {
      caseSensitive: false,
      stripPriorityPrefixes: true,
      normalizeWhitespace: true,
      stripPunctuation: false,
    },

    // Apply overrides
    ...overrides,
  }
}

/**
 * Cache health check utility that can be used without a cache instance
 *
 * @param cacheDir Directory to check
 * @param logger Logger instance
 * @param correlationId Optional correlation ID
 * @returns Basic health status information
 *
 * @example
 * ```typescript
 * import { checkCacheHealth, createVoiceVaultLoggerSync } from '@voice-vault/core'
 * import { tmpdir } from 'node:os'
 * import { join } from 'node:path'
 *
 * const logger = createVoiceVaultLoggerSync()
 * const health = await checkCacheHealth(
 *   join(tmpdir(), 'voice-vault-cache'),
 *   logger
 * )
 *
 * if (health.accessible) {
 *   console.log('Cache directory is accessible')
 * } else {
 *   console.error('Cache directory issues:', health.error)
 * }
 * ```
 */
export async function checkCacheHealth(
  cacheDir: string,
  logger: import('../types/index.js').Logger,
  correlationId?: string,
): Promise<{
  accessible: boolean
  exists: boolean
  writable: boolean
  error?: string
  correlationId: string
}> {
  const opCorrelationId = correlationId || `health-${Date.now()}`

  try {
    const { access, stat, mkdir } = await import('node:fs/promises')
    const { constants } = await import('node:fs')

    // Check if directory exists
    let exists = false
    try {
      await stat(cacheDir)
      exists = true
    } catch {
      // Directory doesn't exist, try to create it
      try {
        await mkdir(cacheDir, { recursive: true })
        exists = true
      } catch (createError) {
        logger.error('Failed to create cache directory', {
          correlationId: opCorrelationId,
          component: 'cache',
          operation: 'health-check',
          cacheDir,
          error: (createError as Error).message,
        })
        return {
          accessible: false,
          exists: false,
          writable: false,
          error: `Cannot create directory: ${(createError as Error).message}`,
          correlationId: opCorrelationId,
        }
      }
    }

    // Check if directory is writable
    let writable = false
    try {
      await access(cacheDir, constants.W_OK)
      writable = true
    } catch {
      logger.warn('Cache directory not writable', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'health-check',
        cacheDir,
      })
    }

    logger.debug('Cache directory health check completed', {
      correlationId: opCorrelationId,
      component: 'cache',
      operation: 'health-check',
      cacheDir,
      exists,
      writable,
      accessible: exists && writable,
    })

    return {
      accessible: exists && writable,
      exists,
      writable,
      correlationId: opCorrelationId,
    }
  } catch (error) {
    logger.error('Cache health check failed', {
      correlationId: opCorrelationId,
      component: 'cache',
      operation: 'health-check',
      cacheDir,
      error: (error as Error).message,
    })

    return {
      accessible: false,
      exists: false,
      writable: false,
      error: (error as Error).message,
      correlationId: opCorrelationId,
    }
  }
}
