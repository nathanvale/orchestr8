/**
 * Audio Cache System
 * Provides file-based caching for TTS audio files to improve performance and reduce API costs
 */

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Cache entry metadata
 */
export interface CacheEntry {
  data: Buffer
  metadata: {
    provider: string
    voice: string
    model?: string
    speed?: number
    format?: string
    text?: string
  }
}

/**
 * Internal cache entry structure
 */
interface CacheEntryFile {
  timestamp: number
  metadata: CacheEntry['metadata']
  audioFile: string
}

/**
 * Text normalization options for cache keys
 */
export interface CacheNormalizationConfig {
  caseSensitive?: boolean // Whether text should be case-sensitive (default: false)
  stripPriorityPrefixes?: boolean // Whether to remove priority prefixes (default: true)
  normalizeWhitespace?: boolean // Whether to normalize whitespace (default: true)
}

/**
 * Audio cache configuration
 */
export interface AudioCacheConfig {
  maxSizeBytes?: number // Maximum cache size in bytes
  maxAgeMs?: number // Maximum age of cache entries in milliseconds
  maxEntries?: number // Maximum number of cache entries
  enabled?: boolean // Enable/disable caching
  cacheDir?: string // Cache directory path
  normalization?: CacheNormalizationConfig // Text normalization options
}

/**
 * Cache statistics
 */
export interface CacheStats {
  entryCount: number
  totalSize: number
  hitRate: number
  oldestEntry: number
  newestEntry: number
}

/**
 * Audio Cache implementation with LRU eviction and TTL expiration
 */
export class AudioCache {
  private config: Required<AudioCacheConfig>
  private hitCount = 0
  private requestCount = 0
  private initializationPromise: Promise<void> | null = null

  constructor(config: AudioCacheConfig = {}) {
    // Set default configuration
    this.config = {
      maxSizeBytes: config.maxSizeBytes ?? 100 * 1024 * 1024, // 100MB
      maxAgeMs: config.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000, // 30 days
      maxEntries: config.maxEntries ?? 1000,
      enabled: config.enabled ?? true,
      cacheDir: config.cacheDir ?? join(tmpdir(), 'claude-hooks-audio-cache'),
      normalization: {
        caseSensitive: config.normalization?.caseSensitive ?? false,
        stripPriorityPrefixes: config.normalization?.stripPriorityPrefixes ?? true,
        normalizeWhitespace: config.normalization?.normalizeWhitespace ?? true,
      },
    }

    // Don't initialize directories in constructor to avoid race conditions
    // Directories will be initialized lazily on first use
  }

  /**
   * Normalize text for cache key generation based on configuration
   */
  private normalizeText(text: string): string {
    let normalized = text

    // Normalize whitespace if enabled
    if (this.config.normalization.normalizeWhitespace) {
      normalized = normalized.trim().replace(/\s+/g, ' ')
    }

    // Strip priority prefixes if enabled
    if (this.config.normalization.stripPriorityPrefixes) {
      const priorityPrefixPattern = /^(low|medium|high)\s+priority:\s*/i
      normalized = normalized.replace(priorityPrefixPattern, '')
    }

    // Convert to lowercase if case-insensitive
    if (!this.config.normalization.caseSensitive) {
      normalized = normalized.toLowerCase()
    }

    return normalized
  }

  /**
   * Generate cache key from TTS parameters
   */
  async generateKey(
    provider: string,
    text: string,
    model: string,
    voice: string,
    speed: number,
    format?: string,
  ): Promise<string> {
    // Normalize text based on configuration
    const normalizedText = this.normalizeText(text)

    // Normalize format string to lowercase to prevent cache duplicates
    const normalizedFormat = (format || 'mp3').toLowerCase()

    // Include provider and format in the cache key to prevent collisions
    const input = `${provider}|${normalizedText}|${model}|${voice}|${speed}|${normalizedFormat}`
    const hash = createHash('sha256')
    hash.update(input, 'utf8')
    return hash.digest('hex')
  }

  /**
   * Get cached audio data
   */
  async get(key: string): Promise<CacheEntry | null> {
    this.requestCount++

    if (!this.config.enabled) {
      return null
    }

    try {
      // Ensure directories are initialized before accessing cache
      await this.ensureInitialized()

      const entryPath = join(this.config.cacheDir, 'entries', `${key}.json`)

      // Check if entry file exists and get metadata
      const entryStat = await stat(entryPath)

      // Check if entry is expired
      const age = Date.now() - entryStat.mtime.getTime()
      if (age > this.config.maxAgeMs) {
        // Entry is expired, clean it up
        await this.removeEntry(key)
        return null
      }

      // Read entry metadata
      const entryData = await readFile(entryPath, 'utf8')
      const entry: CacheEntryFile = JSON.parse(entryData)

      // Validate entry structure
      if (!this.validateEntry(entry)) {
        await this.removeEntry(key)
        return null
      }

      // Read audio data
      const audioPath = join(this.config.cacheDir, 'audio', entry.audioFile)
      const audioData = await readFile(audioPath)

      this.hitCount++
      return {
        data: audioData,
        metadata: entry.metadata,
      }
    } catch {
      // File doesn't exist or other error
      return null
    }
  }

  /**
   * Store audio data in cache
   */
  async set(key: string, data: Buffer, metadata: CacheEntry['metadata']): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    try {
      // Ensure directories exist
      await this.ensureInitialized()

      // Check cache size limits and clean up if necessary
      await this.enforceLimits()

      // Create entry with correct format extension
      const format = metadata.format || 'mp3'
      const extension = this.getFileExtension(format)
      const audioFile = `${key}.${extension}`
      const entry: CacheEntryFile = {
        timestamp: Date.now(),
        metadata,
        audioFile,
      }

      // Write entry metadata
      const entryPath = join(this.config.cacheDir, 'entries', `${key}.json`)
      await writeFile(entryPath, JSON.stringify(entry), 'utf8')

      // Write audio data
      const audioPath = join(this.config.cacheDir, 'audio', audioFile)
      await writeFile(audioPath, data)
    } catch {
      // Ignore cache write errors to avoid breaking TTS functionality
    }
  }

  /**
   * Clean up expired and excess entries
   */
  async cleanup(): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    try {
      // Ensure directories are initialized before cleanup
      await this.ensureInitialized()

      const entriesDir = join(this.config.cacheDir, 'entries')

      // Read all entry files
      const entryFiles = await readdir(entriesDir)
      const now = Date.now()

      for (const entryFile of entryFiles) {
        if (!entryFile.endsWith('.json')) continue

        const entryPath = join(entriesDir, entryFile)

        try {
          const entryStat = await stat(entryPath)
          const age = now - entryStat.mtime.getTime()

          // Remove expired entries
          if (age > this.config.maxAgeMs) {
            const key = entryFile.replace('.json', '')
            await this.removeEntry(key)
          }
        } catch {
          // Remove corrupted entries
          const key = entryFile.replace('.json', '')
          await this.removeEntry(key)
        }
      }

      // Enforce size and count limits
      await this.enforceLimits()
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (!this.config.enabled) {
      return {
        entryCount: 0,
        totalSize: 0,
        hitRate: 0,
        oldestEntry: 0,
        newestEntry: 0,
      }
    }

    try {
      // Ensure directories are initialized before getting stats
      await this.ensureInitialized()

      const entriesDir = join(this.config.cacheDir, 'entries')
      const audioDir = join(this.config.cacheDir, 'audio')

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

      return {
        entryCount: validEntryCount,
        totalSize,
        hitRate: this.requestCount > 0 ? this.hitCount / this.requestCount : 0,
        oldestEntry,
        newestEntry,
      }
    } catch {
      return {
        entryCount: 0,
        totalSize: 0,
        hitRate: this.requestCount > 0 ? this.hitCount / this.requestCount : 0,
        oldestEntry: 0,
        newestEntry: 0,
      }
    }
  }

  /**
   * Get cache configuration
   */
  getConfiguration(): AudioCacheConfig {
    return { ...this.config }
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
      await mkdir(join(this.config.cacheDir, 'entries'), { recursive: true })
      await mkdir(join(this.config.cacheDir, 'audio'), { recursive: true })
    } catch {
      // Ignore directory creation errors
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
      typeof (entry as CacheEntryFile).audioFile === 'string'
    )
  }

  /**
   * Remove a cache entry
   */
  private async removeEntry(key: string): Promise<void> {
    try {
      const entryPath = join(this.config.cacheDir, 'entries', `${key}.json`)

      // Read entry to get the actual audio filename
      try {
        const entryData = await readFile(entryPath, 'utf8')
        const entry: CacheEntryFile = JSON.parse(entryData)
        const audioPath = join(this.config.cacheDir, 'audio', entry.audioFile)

        await Promise.all([unlink(entryPath).catch(() => {}), unlink(audioPath).catch(() => {})])
      } catch {
        // If we can't read the entry, try to remove with common extensions
        const audioDir = join(this.config.cacheDir, 'audio')
        const possibleExtensions = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm', 'ulaw', 'alaw']

        await unlink(entryPath).catch(() => {})

        // Try to remove audio files with various extensions
        await Promise.all(
          possibleExtensions.map((ext) => unlink(join(audioDir, `${key}.${ext}`)).catch(() => {})),
        )
      }
    } catch {
      // Ignore removal errors
    }
  }

  /**
   * Get file extension from format string
   */
  private getFileExtension(format: string): string {
    // Normalize format to lowercase for consistent matching
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
   * Enforce cache size and count limits
   * TODO: Optimize by combining stats gathering and eviction into a single pass
   * to avoid double I/O operations on the cache directory
   */
  private async enforceLimits(): Promise<void> {
    try {
      const stats = await this.getStats()

      // Check if limits are exceeded
      if (
        stats.entryCount <= this.config.maxEntries &&
        stats.totalSize <= this.config.maxSizeBytes
      ) {
        return
      }

      // Get all entries sorted by modification time (oldest first)
      const entriesDir = join(this.config.cacheDir, 'entries')
      const entryFiles = await readdir(entriesDir)

      const entries: Array<{ key: string; mtime: number; size: number }> = []

      for (const entryFile of entryFiles) {
        if (!entryFile.endsWith('.json')) continue

        try {
          const key = entryFile.replace('.json', '')
          const entryPath = join(entriesDir, entryFile)
          const entryData = await readFile(entryPath, 'utf8')
          const entry: CacheEntryFile = JSON.parse(entryData)
          const audioPath = join(this.config.cacheDir, 'audio', entry.audioFile)

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

      for (const entry of entries) {
        if (currentCount <= this.config.maxEntries && currentSize <= this.config.maxSizeBytes) {
          break
        }

        await this.removeEntry(entry.key)
        currentSize -= entry.size
        currentCount--
      }
    } catch {
      // Ignore limit enforcement errors
    }
  }
}
