/**
 * Enhanced Audio Cache System
 * Provides file-based caching for TTS audio files with comprehensive observability
 * and correlation ID tracking for every operation
 */

import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateCorrelationId } from '../logging/index.js'
import type {
  CacheEntry,
  CacheEntryFile,
  CacheEntryMetadata,
  CacheHealthStatus,
  CacheKeyParams,
  CacheOperationContext,
  CacheStats,
  CacheValidationResult,
  Logger,
  VoiceVaultCacheConfig,
  VoiceVaultLogFields,
} from '../types/index.js'
import { TextNormalizer } from './text-normalizer.js'

/**
 * Enhanced Audio Cache with comprehensive logging and observability
 */
export class AudioCache {
  private readonly config: Required<VoiceVaultCacheConfig>
  private readonly logger: Logger
  private readonly textNormalizer: TextNormalizer

  // Performance tracking
  private hitCount = 0
  private requestCount = 0
  private totalOperationTime = 0
  private fastestOperation = Number.MAX_SAFE_INTEGER
  private slowestOperation = 0

  // Initialization state
  private initializationPromise: Promise<void> | null = null
  private readonly instanceId: string
  private readonly instanceCorrelationId: string

  // Concurrent cache handling
  private pendingWrites = new Map<string, Promise<CacheEntry | null>>()

  constructor(config: VoiceVaultCacheConfig = {}, logger: Logger) {
    this.logger = logger
    this.instanceId =
      config.instanceId || `cache-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    this.instanceCorrelationId = config.correlationId || generateCorrelationId()

    // Set comprehensive default configuration
    this.config = {
      // Cache limits
      enabled: config.enabled ?? true,
      maxSizeBytes: config.maxSizeBytes ?? 1024 * 1024 * 1024, // 1GB
      maxAgeMs: config.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000, // 30 days
      maxEntries: config.maxEntries ?? 10000,
      minFreeDiskBytes: config.minFreeDiskBytes ?? 100 * 1024 * 1024, // 100MB

      // Storage configuration
      cacheDir: config.cacheDir ?? join(tmpdir(), 'voice-vault-cache'),
      entriesSubdir: config.entriesSubdir ?? 'entries',
      audioSubdir: config.audioSubdir ?? 'audio',
      fileMode: config.fileMode ?? 0o644,
      dirMode: config.dirMode ?? 0o755,

      // Performance and monitoring
      enableMonitoring: config.enableMonitoring ?? true,
      statsInterval: config.statsInterval ?? 5 * 60 * 1000, // 5 minutes
      enableTiming: config.enableTiming ?? false,
      enableHitLogging: config.enableHitLogging ?? true,
      cleanupInterval: config.cleanupInterval ?? 60 * 60 * 1000, // 1 hour

      // Instance identifiers
      correlationId: this.instanceCorrelationId,
      instanceId: this.instanceId,

      // Text normalization (defaults will be set by TextNormalizer)
      normalization: config.normalization ?? {},
    }

    this.textNormalizer = new TextNormalizer(this.config.normalization, logger)

    this.logger.info('AudioCache instance created', {
      correlationId: this.instanceCorrelationId,
      component: 'cache',
      operation: 'initialize',
      instanceId: this.instanceId,
      config: {
        enabled: this.config.enabled,
        maxSizeBytes: this.config.maxSizeBytes,
        maxEntries: this.config.maxEntries,
        cacheDir: this.config.cacheDir,
      },
    } satisfies VoiceVaultLogFields)
  }

  /**
   * Generate cache key from TTS parameters with full observability
   */
  async generateKey(params: CacheKeyParams, correlationId?: string): Promise<string> {
    const opCorrelationId = correlationId || generateCorrelationId()
    const context = this.createOperationContext('get', opCorrelationId)

    try {
      const result = this.textNormalizer.generateCacheKey(params, opCorrelationId)

      this.logOperationSuccess(context, {
        cacheKey: result.cacheKey,
        provider: params.provider,
        voice: params.voice,
        textLength: params.text.length,
      })

      return result.cacheKey
    } catch (error) {
      this.logOperationError(context, error as Error, {
        provider: params.provider,
        voice: params.voice,
        textLength: params.text.length,
      })
      throw error
    }
  }

  /**
   * Get cached audio data with comprehensive logging
   */
  async get(key: string, correlationId?: string): Promise<CacheEntry | null> {
    const opCorrelationId = correlationId || generateCorrelationId()
    const context = this.createOperationContext('get', opCorrelationId)

    this.requestCount++

    if (!this.config.enabled) {
      this.logger.debug('Cache disabled, skipping get operation', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'get',
        cacheStatus: 'skip',
        cacheKey: key,
      } satisfies VoiceVaultLogFields)
      return null
    }

    // Check for pending write operations for this key
    const pendingWrite = this.pendingWrites.get(key)
    if (pendingWrite) {
      this.logger.debug('Awaiting pending write for cache key', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'get',
        cacheKey: key,
      } satisfies VoiceVaultLogFields)
      try {
        const result = await pendingWrite
        if (result) {
          this.hitCount++
          this.logOperationSuccess(context, {
            cacheStatus: 'hit-pending',
            provider: result.metadata.provider,
          })
          return result
        }
      } catch (error) {
        this.logger.debug('Pending write failed', {
          correlationId: opCorrelationId,
          component: 'cache',
          operation: 'get',
          cacheKey: key,
          error: (error as Error).message,
        } satisfies VoiceVaultLogFields)
      }
    }

    try {
      // Ensure directories are initialized before accessing cache
      await this.ensureInitialized()

      const entryPath = join(this.config.cacheDir, this.config.entriesSubdir, `${key}.json`)

      // Check if entry file exists and get metadata
      const entryStat = await stat(entryPath)

      // Check if entry is expired
      const age = Date.now() - entryStat.mtime.getTime()
      if (age > this.config.maxAgeMs) {
        this.logger.info('Cache entry expired, removing', {
          correlationId: opCorrelationId,
          component: 'cache',
          operation: 'get',
          cacheStatus: 'miss',
          cacheKey: key,
          ageMs: age,
          maxAgeMs: this.config.maxAgeMs,
        } satisfies VoiceVaultLogFields)

        // Entry is expired, clean it up
        await this.removeEntry(key, opCorrelationId)
        this.logOperationSuccess(context, { cacheStatus: 'miss', reason: 'expired' })
        return null
      }

      // Read entry metadata
      const entryData = await readFile(entryPath, 'utf8')
      const entry: CacheEntryFile = JSON.parse(entryData)

      // Validate entry structure
      if (!this.validateEntry(entry)) {
        this.logger.warn('Invalid cache entry structure, removing', {
          correlationId: opCorrelationId,
          component: 'cache',
          operation: 'get',
          cacheStatus: 'miss',
          cacheKey: key,
          error: 'invalid-structure',
        } satisfies VoiceVaultLogFields)

        await this.removeEntry(key, opCorrelationId)
        this.logOperationSuccess(context, { cacheStatus: 'miss', reason: 'invalid-structure' })
        return null
      }

      // Read audio data
      const audioPath = join(this.config.cacheDir, this.config.audioSubdir, entry.audioFile)
      const audioData = await readFile(audioPath)

      this.hitCount++

      const cacheEntry: CacheEntry = {
        data: audioData,
        metadata: entry.metadata,
      }

      if (this.config.enableHitLogging) {
        this.logger.info('Cache hit', {
          correlationId: opCorrelationId,
          component: 'cache',
          operation: 'get',
          cacheStatus: 'hit',
          cacheKey: key,
          provider: entry.metadata.provider,
          voice: entry.metadata.voice,
          format: entry.metadata.format,
          sizeBytes: audioData.length,
          ageMs: age,
          apiCallsSaved: 1,
        } satisfies VoiceVaultLogFields)
      }

      this.logOperationSuccess(context, {
        cacheStatus: 'hit',
        sizeBytes: audioData.length,
        provider: entry.metadata.provider,
      })

      return cacheEntry
    } catch (error) {
      // File doesn't exist or other error - this is a cache miss
      this.logger.debug('Cache miss', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'get',
        cacheStatus: 'miss',
        cacheKey: key,
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)

      this.logOperationSuccess(context, { cacheStatus: 'miss', reason: 'file-not-found' })
      return null
    }
  }

  /**
   * Store audio data in cache with comprehensive logging
   */
  async set(
    key: string,
    data: Buffer,
    metadata: CacheEntryMetadata,
    correlationId?: string,
  ): Promise<void> {
    const opCorrelationId = correlationId || generateCorrelationId()
    const context = this.createOperationContext('set', opCorrelationId)

    if (!this.config.enabled) {
      this.logger.debug('Cache disabled, skipping set operation', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'set',
        cacheStatus: 'skip',
        cacheKey: key,
      } satisfies VoiceVaultLogFields)
      return
    }

    // Create a promise for this write operation
    const writePromise = this.performWrite(key, data, metadata, opCorrelationId, context)
    this.pendingWrites.set(key, writePromise)

    try {
      await writePromise
    } finally {
      // Clean up pending write after completion or error
      this.pendingWrites.delete(key)
    }
  }

  private async performWrite(
    key: string,
    data: Buffer,
    metadata: CacheEntryMetadata,
    opCorrelationId: string,
    context: CacheOperationContext,
  ): Promise<CacheEntry> {
    try {
      // Ensure directories exist
      await this.ensureInitialized()

      // Check cache size limits and clean up if necessary
      await this.enforceLimits(opCorrelationId)

      // Create entry with correct format extension
      const format = metadata.format || 'mp3'
      const extension = this.getFileExtension(format)
      const audioFile = `${key}.${extension}`

      const entry: CacheEntryFile = {
        timestamp: Date.now(),
        metadata: {
          ...metadata,
          createdAt: Date.now(),
          sizeBytes: data.length,
          correlationId: opCorrelationId,
        },
        audioFile,
        key,
      }

      // Write entry metadata
      const entryPath = join(this.config.cacheDir, this.config.entriesSubdir, `${key}.json`)
      await writeFile(entryPath, JSON.stringify(entry, null, 2), 'utf8')

      // Write audio data
      const audioPath = join(this.config.cacheDir, this.config.audioSubdir, audioFile)
      await writeFile(audioPath, data)

      this.logger.info('Cache entry stored', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'set',
        cacheKey: key,
        provider: metadata.provider,
        voice: metadata.voice,
        format: metadata.format,
        sizeBytes: data.length,
        textLength: metadata.text?.length,
        filePath: audioFile,
      } satisfies VoiceVaultLogFields)

      this.logOperationSuccess(context, {
        sizeBytes: data.length,
        provider: metadata.provider,
        filePath: audioFile,
      })

      // Return the cache entry for concurrent read access
      return {
        data,
        metadata: entry.metadata,
      }
    } catch (error) {
      this.logger.error('Failed to store cache entry', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'set',
        cacheStatus: 'error',
        cacheKey: key,
        error: (error as Error).message,
        provider: metadata.provider,
        sizeBytes: data.length,
      } satisfies VoiceVaultLogFields)

      this.logOperationError(context, error as Error, {
        provider: metadata.provider,
        sizeBytes: data.length,
      })

      throw error // Throw to signal failure to concurrent readers
    }
  }

  /**
   * Clean up expired and excess entries with comprehensive logging
   */
  async cleanup(correlationId?: string): Promise<void> {
    const opCorrelationId = correlationId || generateCorrelationId()
    const context = this.createOperationContext('cleanup', opCorrelationId)

    if (!this.config.enabled) {
      this.logger.debug('Cache disabled, skipping cleanup', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'cleanup',
        cacheStatus: 'skip',
      } satisfies VoiceVaultLogFields)
      return
    }

    try {
      // Ensure directories are initialized before cleanup
      await this.ensureInitialized()

      const entriesDir = join(this.config.cacheDir, this.config.entriesSubdir)
      const entryFiles = await readdir(entriesDir)
      const now = Date.now()

      let expiredCount = 0
      let corruptedCount = 0

      this.logger.info('Starting cache cleanup', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'cleanup',
        totalEntries: entryFiles.filter((f) => f.endsWith('.json')).length,
      } satisfies VoiceVaultLogFields)

      for (const entryFile of entryFiles) {
        if (!entryFile.endsWith('.json')) continue

        const entryPath = join(entriesDir, entryFile)

        try {
          const entryStat = await stat(entryPath)
          const age = now - entryStat.mtime.getTime()

          // Remove expired entries
          if (age > this.config.maxAgeMs) {
            const key = entryFile.replace('.json', '')
            await this.removeEntry(key, opCorrelationId)
            expiredCount++
          }
        } catch {
          // Remove corrupted entries
          const key = entryFile.replace('.json', '')
          await this.removeEntry(key, opCorrelationId)
          corruptedCount++
        }
      }

      // Enforce size and count limits
      await this.enforceLimits(opCorrelationId)

      this.logger.info('Cache cleanup completed', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'cleanup',
        expiredCount,
        corruptedCount,
        totalProcessed: entryFiles.length,
      } satisfies VoiceVaultLogFields)

      this.logOperationSuccess(context, {
        expiredCount,
        corruptedCount,
        totalProcessed: entryFiles.length,
      })
    } catch (error) {
      this.logOperationError(context, error as Error)
    }
  }

  /**
   * Get comprehensive cache statistics with logging
   */
  async getStats(correlationId?: string): Promise<CacheStats> {
    const opCorrelationId = correlationId || generateCorrelationId()
    const context = this.createOperationContext('stats', opCorrelationId)

    if (!this.config.enabled) {
      const emptyStats: CacheStats = {
        entryCount: 0,
        totalSize: 0,
        totalSizeBytes: 0, // Alias for compatibility
        hitRate: 0,
        oldestEntry: 0,
        newestEntry: 0,
        totalRequests: this.requestCount,
        cacheHits: this.hitCount,
        cacheMisses: this.requestCount - this.hitCount,
        hits: this.hitCount, // Alias for compatibility
        misses: this.requestCount - this.hitCount, // Alias for compatibility
        apiCallsSaved: this.hitCount,
        averageEntrySize: 0,
        diskUsage: { used: 0, available: 0, total: 0 },
        performance: {
          avgOperationMs: this.requestCount > 0 ? this.totalOperationTime / this.requestCount : 0,
          fastestOperationMs:
            this.fastestOperation === Number.MAX_SAFE_INTEGER ? 0 : this.fastestOperation,
          slowestOperationMs: this.slowestOperation,
        },
      }

      this.logOperationSuccess(context, { status: 'disabled' })
      return emptyStats
    }

    try {
      await this.ensureInitialized()

      const entriesDir = join(this.config.cacheDir, this.config.entriesSubdir)
      const audioDir = join(this.config.cacheDir, this.config.audioSubdir)

      const entryFiles = await readdir(entriesDir)
      let totalSize = 0
      let oldestEntry = Date.now()
      let newestEntry = 0
      let validEntryCount = 0

      for (const entryFile of entryFiles) {
        if (!entryFile.endsWith('.json')) continue

        try {
          const entryPath = join(entriesDir, entryFile)
          const entryData = await readFile(entryPath, 'utf8')
          const entry: CacheEntryFile = JSON.parse(entryData)
          const entryStat = await stat(entryPath)
          const audioPath = join(audioDir, entry.audioFile)
          const audioStat = await stat(audioPath)

          totalSize += entryStat.size + audioStat.size
          const mtime = entryStat.mtime.getTime()
          if (mtime < oldestEntry) oldestEntry = mtime
          if (mtime > newestEntry) newestEntry = mtime
          validEntryCount++
        } catch {
          // Skip corrupted entries
        }
      }

      // Get disk usage information
      const diskUsage = await this.getDiskUsage()

      const stats: CacheStats = {
        entryCount: validEntryCount,
        totalSize,
        totalSizeBytes: totalSize, // Alias for compatibility
        hitRate: this.requestCount > 0 ? this.hitCount / this.requestCount : 0,
        oldestEntry,
        newestEntry,
        totalRequests: this.requestCount,
        cacheHits: this.hitCount,
        cacheMisses: this.requestCount - this.hitCount,
        hits: this.hitCount, // Alias for compatibility
        misses: this.requestCount - this.hitCount, // Alias for compatibility
        apiCallsSaved: this.hitCount,
        averageEntrySize: validEntryCount > 0 ? totalSize / validEntryCount : 0,
        diskUsage,
        performance: {
          avgOperationMs: this.requestCount > 0 ? this.totalOperationTime / this.requestCount : 0,
          fastestOperationMs:
            this.fastestOperation === Number.MAX_SAFE_INTEGER ? 0 : this.fastestOperation,
          slowestOperationMs: this.slowestOperation,
        },
      }

      this.logger.info('Cache statistics generated', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'stats',
        entryCount: stats.entryCount,
        totalSize: stats.totalSize,
        hitRate: Math.round(stats.hitRate * 100),
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        apiCallsSaved: stats.apiCallsSaved,
      } satisfies VoiceVaultLogFields)

      this.logOperationSuccess(context, {
        entryCount: stats.entryCount,
        hitRate: stats.hitRate,
        totalSize: stats.totalSize,
      })

      return stats
    } catch (error) {
      this.logOperationError(context, error as Error)

      // Return basic stats on error
      return {
        entryCount: 0,
        totalSize: 0,
        totalSizeBytes: 0, // Alias for compatibility
        hitRate: this.requestCount > 0 ? this.hitCount / this.requestCount : 0,
        oldestEntry: 0,
        newestEntry: 0,
        totalRequests: this.requestCount,
        cacheHits: this.hitCount,
        cacheMisses: this.requestCount - this.hitCount,
        hits: this.hitCount, // Alias for compatibility
        misses: this.requestCount - this.hitCount, // Alias for compatibility
        apiCallsSaved: this.hitCount,
        averageEntrySize: 0,
        diskUsage: { used: 0, available: 0, total: 0 },
        performance: {
          avgOperationMs: this.requestCount > 0 ? this.totalOperationTime / this.requestCount : 0,
          fastestOperationMs:
            this.fastestOperation === Number.MAX_SAFE_INTEGER ? 0 : this.fastestOperation,
          slowestOperationMs: this.slowestOperation,
        },
      }
    }
  }

  /**
   * Perform cache health check with comprehensive logging
   */
  async healthCheck(correlationId?: string): Promise<CacheHealthStatus> {
    const opCorrelationId = correlationId || generateCorrelationId()
    const context = this.createOperationContext('stats', opCorrelationId)

    const healthStatus: CacheHealthStatus = {
      status: 'healthy',
      timestamp: Date.now(),
      correlationId: opCorrelationId,
      details: {
        directoryAccessible: false,
        diskSpaceOk: false,
        configValid: false,
        recentErrors: 0,
      },
      messages: [],
    }

    try {
      if (!this.config.enabled) {
        healthStatus.status = 'disabled'
        healthStatus.messages.push('Cache is disabled')
        this.logOperationSuccess(context, { status: 'disabled' })
        return healthStatus
      }

      // Check directory accessibility
      try {
        await this.ensureInitialized()
        await stat(this.config.cacheDir)
        healthStatus.details.directoryAccessible = true
      } catch {
        healthStatus.status = 'error'
        healthStatus.messages.push('Cache directory not accessible')
      }

      // Check disk space
      try {
        const diskUsage = await this.getDiskUsage()
        if (diskUsage.available >= this.config.minFreeDiskBytes) {
          healthStatus.details.diskSpaceOk = true
        } else {
          healthStatus.status = healthStatus.status === 'error' ? 'error' : 'warning'
          healthStatus.messages.push(
            `Low disk space: ${Math.round(diskUsage.available / 1024 / 1024)}MB available`,
          )
        }
      } catch {
        healthStatus.status = 'warning'
        healthStatus.messages.push('Cannot determine disk space')
      }

      // Validate configuration
      healthStatus.details.configValid = this.validateConfig()
      if (!healthStatus.details.configValid) {
        healthStatus.status = 'warning'
        healthStatus.messages.push('Configuration validation issues detected')
      }

      this.logger.info('Cache health check completed', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'health-check',
        status: healthStatus.status,
        directoryAccessible: healthStatus.details.directoryAccessible,
        diskSpaceOk: healthStatus.details.diskSpaceOk,
        configValid: healthStatus.details.configValid,
        messages: healthStatus.messages,
      } satisfies VoiceVaultLogFields)

      this.logOperationSuccess(context, { healthStatus: healthStatus.status })
      return healthStatus
    } catch (error) {
      healthStatus.status = 'error'
      healthStatus.messages.push(`Health check failed: ${(error as Error).message}`)
      this.logOperationError(context, error as Error)
      return healthStatus
    }
  }

  /**
   * Validate cache entries with comprehensive logging
   */
  async validateCache(correlationId?: string): Promise<CacheValidationResult> {
    const opCorrelationId = correlationId || generateCorrelationId()
    const context = this.createOperationContext('stats', opCorrelationId)

    const validationResult: CacheValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      stats: {
        totalChecked: 0,
        validEntries: 0,
        invalidEntries: 0,
        corruptedFiles: 0,
      },
      correlationId: opCorrelationId,
    }

    try {
      if (!this.config.enabled) {
        this.logOperationSuccess(context, { status: 'disabled' })
        return validationResult
      }

      await this.ensureInitialized()

      const entriesDir = join(this.config.cacheDir, this.config.entriesSubdir)
      const audioDir = join(this.config.cacheDir, this.config.audioSubdir)
      const entryFiles = await readdir(entriesDir)

      this.logger.info('Starting cache validation', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'validate',
        totalEntries: entryFiles.filter((f) => f.endsWith('.json')).length,
      } satisfies VoiceVaultLogFields)

      for (const entryFile of entryFiles) {
        if (!entryFile.endsWith('.json')) continue

        validationResult.stats.totalChecked++
        const entryPath = join(entriesDir, entryFile)

        try {
          // Validate entry file
          const entryData = await readFile(entryPath, 'utf8')
          const entry: CacheEntryFile = JSON.parse(entryData)

          if (!this.validateEntry(entry)) {
            validationResult.stats.invalidEntries++
            validationResult.errors.push(`Invalid entry structure: ${entryFile}`)
            validationResult.valid = false
            continue
          }

          // Validate audio file exists
          const audioPath = join(audioDir, entry.audioFile)
          await stat(audioPath)

          validationResult.stats.validEntries++
        } catch {
          validationResult.stats.corruptedFiles++
          validationResult.warnings.push(`Corrupted or missing files for: ${entryFile}`)
        }
      }

      this.logger.info('Cache validation completed', {
        correlationId: opCorrelationId,
        component: 'cache',
        operation: 'validate',
        valid: validationResult.valid,
        totalChecked: validationResult.stats.totalChecked,
        validEntries: validationResult.stats.validEntries,
        invalidEntries: validationResult.stats.invalidEntries,
        corruptedFiles: validationResult.stats.corruptedFiles,
        errorsCount: validationResult.errors.length,
        warningsCount: validationResult.warnings.length,
      } satisfies VoiceVaultLogFields)

      this.logOperationSuccess(context, {
        valid: validationResult.valid,
        validEntries: validationResult.stats.validEntries,
        invalidEntries: validationResult.stats.invalidEntries,
      })

      return validationResult
    } catch (error) {
      validationResult.valid = false
      validationResult.errors.push(`Validation failed: ${(error as Error).message}`)
      this.logOperationError(context, error as Error)
      return validationResult
    }
  }

  /**
   * Get cache configuration
   */
  getConfiguration(): VoiceVaultCacheConfig {
    return { ...this.config }
  }

  // Private helper methods

  /**
   * Create operation context for consistent logging
   */
  private createOperationContext(
    operation: 'get' | 'set' | 'delete' | 'cleanup' | 'stats' | 'validate',
    correlationId: string,
  ): CacheOperationContext {
    return {
      correlationId,
      operation,
      startTime: Date.now(),
      metadata: {
        instanceId: this.instanceId,
      },
    }
  }

  /**
   * Log successful operation completion
   */
  private logOperationSuccess(
    context: CacheOperationContext,
    additionalData: Record<string, unknown> = {},
  ): void {
    const durationMs = Date.now() - context.startTime

    // Update performance metrics
    if (this.config.enableTiming) {
      this.totalOperationTime += durationMs
      this.fastestOperation = Math.min(this.fastestOperation, durationMs)
      this.slowestOperation = Math.max(this.slowestOperation, durationMs)
    }

    if (this.config.enableMonitoring) {
      this.logger.debug('Operation completed successfully', {
        correlationId: context.correlationId,
        component: 'cache',
        operation: context.operation,
        durationMs,
        ...additionalData,
      } satisfies VoiceVaultLogFields)
    }
  }

  /**
   * Log operation error
   */
  private logOperationError(
    context: CacheOperationContext,
    error: Error,
    additionalData: Record<string, unknown> = {},
  ): void {
    const durationMs = Date.now() - context.startTime

    this.logger.error('Operation failed', {
      correlationId: context.correlationId,
      component: 'cache',
      operation: context.operation,
      error: error.message,
      durationMs,
      ...additionalData,
    } satisfies VoiceVaultLogFields)
  }

  /**
   * Ensure cache directories are initialized (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeDirectories()
    }
    await this.initializationPromise
  }

  /**
   * Initialize cache directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await mkdir(join(this.config.cacheDir, this.config.entriesSubdir), { recursive: true })
      await mkdir(join(this.config.cacheDir, this.config.audioSubdir), { recursive: true })

      this.logger.debug('Cache directories initialized', {
        correlationId: this.instanceCorrelationId,
        component: 'cache',
        operation: 'initialize-dirs',
        cacheDir: this.config.cacheDir,
        entriesSubdir: this.config.entriesSubdir,
        audioSubdir: this.config.audioSubdir,
      } satisfies VoiceVaultLogFields)
    } catch (error) {
      this.logger.error('Failed to initialize cache directories', {
        correlationId: this.instanceCorrelationId,
        component: 'cache',
        operation: 'initialize-dirs',
        error: (error as Error).message,
        cacheDir: this.config.cacheDir,
      } satisfies VoiceVaultLogFields)
      throw error
    }
  }

  /**
   * Validate cache entry structure
   */
  private validateEntry(entry: unknown): entry is CacheEntryFile {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as CacheEntryFile).timestamp === 'number' &&
      typeof (entry as CacheEntryFile).metadata === 'object' &&
      (entry as CacheEntryFile).metadata !== null &&
      typeof (entry as CacheEntryFile).metadata.provider === 'string' &&
      typeof (entry as CacheEntryFile).metadata.voice === 'string' &&
      typeof (entry as CacheEntryFile).audioFile === 'string' &&
      typeof (entry as CacheEntryFile).key === 'string'
    )
  }

  /**
   * Remove a cache entry with logging
   */
  private async removeEntry(key: string, correlationId: string): Promise<void> {
    try {
      const entryPath = join(this.config.cacheDir, this.config.entriesSubdir, `${key}.json`)

      try {
        const entryData = await readFile(entryPath, 'utf8')
        const entry: CacheEntryFile = JSON.parse(entryData)
        const audioPath = join(this.config.cacheDir, this.config.audioSubdir, entry.audioFile)

        await Promise.all([unlink(entryPath).catch(() => {}), unlink(audioPath).catch(() => {})])

        this.logger.debug('Cache entry removed', {
          correlationId,
          component: 'cache',
          operation: 'remove-entry',
          cacheKey: key,
          audioFile: entry.audioFile,
        } satisfies VoiceVaultLogFields)
      } catch {
        // If we can't read the entry, try to remove with common extensions
        const audioDir = join(this.config.cacheDir, this.config.audioSubdir)
        const possibleExtensions = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm', 'ulaw', 'alaw']

        await unlink(entryPath).catch(() => {})

        // Try to remove audio files with various extensions
        await Promise.all(
          possibleExtensions.map((ext) => unlink(join(audioDir, `${key}.${ext}`)).catch(() => {})),
        )

        this.logger.debug('Cache entry removed (with fallback cleanup)', {
          correlationId,
          component: 'cache',
          operation: 'remove-entry',
          cacheKey: key,
          method: 'fallback',
        } satisfies VoiceVaultLogFields)
      }
    } catch (error) {
      this.logger.warn('Failed to remove cache entry', {
        correlationId,
        component: 'cache',
        operation: 'remove-entry',
        cacheKey: key,
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)
    }
  }

  /**
   * Get file extension from format string
   */
  private getFileExtension(format: string): string {
    const normalizedFormat = format.toLowerCase()

    // Handle various format strings from different providers
    if (normalizedFormat.includes('mp3')) return 'mp3'
    if (normalizedFormat.includes('opus')) return 'opus'
    if (normalizedFormat.includes('aac')) return 'aac'
    if (normalizedFormat.includes('flac')) return 'flac'
    if (normalizedFormat.includes('wav')) return 'wav'
    if (normalizedFormat.includes('pcm')) return 'pcm'
    if (normalizedFormat.includes('ulaw')) return 'ulaw'
    if (normalizedFormat.includes('alaw')) return 'alaw'

    // Default to mp3 if format is unknown
    return 'mp3'
  }

  /**
   * Enforce cache size and count limits with logging
   */
  private async enforceLimits(correlationId: string): Promise<void> {
    try {
      const stats = await this.getStats(correlationId)

      // Check if limits are exceeded
      if (
        stats.entryCount <= this.config.maxEntries &&
        stats.totalSize <= this.config.maxSizeBytes
      ) {
        return
      }

      this.logger.info('Cache limits exceeded, enforcing cleanup', {
        correlationId,
        component: 'cache',
        operation: 'enforce-limits',
        currentEntries: stats.entryCount,
        maxEntries: this.config.maxEntries,
        currentSize: stats.totalSize,
        maxSize: this.config.maxSizeBytes,
      } satisfies VoiceVaultLogFields)

      // Get all entries sorted by modification time (oldest first)
      const entriesDir = join(this.config.cacheDir, this.config.entriesSubdir)
      const entryFiles = await readdir(entriesDir)

      const entries: Array<{ key: string; mtime: number; size: number }> = []

      for (const entryFile of entryFiles) {
        if (!entryFile.endsWith('.json')) continue

        try {
          const key = entryFile.replace('.json', '')
          const entryPath = join(entriesDir, entryFile)
          const entryData = await readFile(entryPath, 'utf8')
          const entry: CacheEntryFile = JSON.parse(entryData)
          const audioPath = join(this.config.cacheDir, this.config.audioSubdir, entry.audioFile)

          const [entryStat, audioStat] = await Promise.all([stat(entryPath), stat(audioPath)])

          entries.push({
            key,
            mtime: entryStat.mtime.getTime(),
            size: entryStat.size + audioStat.size,
          })
        } catch {
          // Skip corrupted entries
        }
      }

      // Sort by modification time (oldest first) for LRU eviction
      entries.sort((a, b) => a.mtime - b.mtime)

      // Remove entries until we're under limits
      let currentSize = stats.totalSize
      let currentCount = stats.entryCount
      let removedCount = 0

      for (const entry of entries) {
        if (currentCount <= this.config.maxEntries && currentSize <= this.config.maxSizeBytes) {
          break
        }

        await this.removeEntry(entry.key, correlationId)
        currentSize -= entry.size
        currentCount--
        removedCount++
      }

      this.logger.info('Cache limit enforcement completed', {
        correlationId,
        component: 'cache',
        operation: 'enforce-limits',
        entriesRemoved: removedCount,
        finalEntryCount: currentCount,
        finalSize: currentSize,
      } satisfies VoiceVaultLogFields)
    } catch (error) {
      this.logger.error('Failed to enforce cache limits', {
        correlationId,
        component: 'cache',
        operation: 'enforce-limits',
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)
    }
  }

  /**
   * Get disk usage information
   */
  private async getDiskUsage(): Promise<{ used: number; available: number; total: number }> {
    try {
      const { statfs } = await import('node:fs')
      return new Promise((resolve) => {
        statfs(this.config.cacheDir, (err, stats) => {
          if (err) {
            resolve({ used: 0, available: 0, total: 0 })
          } else {
            const total = stats.blocks * stats.bsize
            const available = stats.bavail * stats.bsize
            const used = total - available
            resolve({ used, available, total })
          }
        })
      })
    } catch {
      return { used: 0, available: 0, total: 0 }
    }
  }

  /**
   * Validate cache configuration
   */
  private validateConfig(): boolean {
    return (
      this.config.maxSizeBytes > 0 &&
      this.config.maxAgeMs > 0 &&
      this.config.maxEntries > 0 &&
      this.config.minFreeDiskBytes >= 0 &&
      typeof this.config.cacheDir === 'string' &&
      this.config.cacheDir.length > 0
    )
  }
}
