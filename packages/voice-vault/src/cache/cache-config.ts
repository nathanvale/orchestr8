/**
 * Voice Vault Cache Configuration
 * Defines configuration types and interfaces for the TTS caching system
 */

/**
 * Cache entry metadata for storing TTS request information
 */
export interface CacheEntryMetadata {
  /** TTS provider used (e.g., 'openai', 'elevenlabs', 'macos') */
  provider: string
  /** Voice identifier used for generation */
  voice: string
  /** Model or engine used (optional) */
  model?: string
  /** Speed multiplier (optional) */
  speed?: number
  /** Audio format (e.g., 'mp3', 'opus', 'wav') */
  format?: string
  /** Original text that was synthesized */
  text?: string
  /** Timestamp when entry was created */
  createdAt: number
  /** Size of the audio file in bytes */
  sizeBytes: number
  /** Correlation ID for tracing this operation */
  correlationId: string
  /** Allow additional properties */
  [key: string]: unknown
}

/**
 * Cache entry structure with audio data and metadata
 */
export interface CacheEntry {
  /** Raw audio data */
  data: Buffer
  /** Associated metadata */
  metadata: CacheEntryMetadata
}

/**
 * Internal cache entry file structure
 */
export interface CacheEntryFile {
  /** Timestamp when entry was last accessed */
  timestamp: number
  /** Entry metadata without audio data */
  metadata: CacheEntryMetadata
  /** Relative path to audio file */
  audioFile: string
  /** Cache key hash */
  key: string
}

/**
 * Text normalization configuration for cache key generation
 */
export interface CacheNormalizationConfig {
  /** Whether text comparison should be case-sensitive (default: false) */
  caseSensitive?: boolean
  /** Whether to strip priority prefixes from text (default: true) */
  stripPriorityPrefixes?: boolean
  /** Whether to normalize whitespace (default: true) */
  normalizeWhitespace?: boolean
  /** Whether to strip punctuation for caching (default: false) */
  stripPunctuation?: boolean
  /** Custom normalization function */
  customNormalizer?: (text: string) => string
}

/**
 * Cache size and retention limits
 */
export interface CacheLimits {
  /** Maximum cache size in bytes (default: 1GB) */
  maxSizeBytes?: number
  /** Maximum age of cache entries in milliseconds (default: 30 days) */
  maxAgeMs?: number
  /** Maximum number of cache entries (default: 10000) */
  maxEntries?: number
  /** Minimum free disk space to maintain in bytes (default: 100MB) */
  minFreeDiskBytes?: number
}

/**
 * Cache storage configuration
 */
export interface CacheStorageConfig {
  /** Base cache directory path */
  cacheDir?: string
  /** Directory for storing entry metadata files */
  entriesSubdir?: string
  /** Directory for storing audio files */
  audioSubdir?: string
  /** File permissions for cache files (octal) */
  fileMode?: number
  /** Directory permissions for cache directories (octal) */
  dirMode?: number
}

/**
 * Cache performance and monitoring configuration
 */
export interface CachePerformanceConfig {
  /** Enable performance monitoring (default: true) */
  enableMonitoring?: boolean
  /** Statistics collection interval in milliseconds (default: 5 minutes) */
  statsInterval?: number
  /** Enable detailed operation timing (default: false) */
  enableTiming?: boolean
  /** Enable cache hit/miss logging (default: true) */
  enableHitLogging?: boolean
  /** Background cleanup interval in milliseconds (default: 1 hour) */
  cleanupInterval?: number
}

/**
 * Comprehensive cache configuration
 */
export interface VoiceVaultCacheConfig
  extends CacheLimits,
    CacheStorageConfig,
    CachePerformanceConfig {
  /** Enable/disable caching entirely (default: true) */
  enabled?: boolean
  /** Text normalization settings */
  normalization?: CacheNormalizationConfig
  /** Global correlation ID for this cache instance */
  correlationId?: string
  /** Cache instance identifier */
  instanceId?: string
}

/**
 * Cache operation context
 */
export interface CacheOperationContext {
  /** Correlation ID for tracing */
  correlationId: string
  /** Operation type */
  operation: 'get' | 'set' | 'delete' | 'cleanup' | 'stats' | 'validate'
  /** Optional operation metadata */
  metadata?: Record<string, unknown>
  /** Start time for performance measurement */
  startTime: number
}

/**
 * Cache statistics snapshot
 */
export interface CacheStats {
  /** Total number of entries in cache */
  entryCount: number
  /** Total cache size in bytes */
  totalSize: number
  /** Total cache size in bytes (alias for compatibility) */
  totalSizeBytes: number
  /** Cache hit rate (0-1) */
  hitRate: number
  /** Timestamp of oldest entry */
  oldestEntry: number
  /** Timestamp of newest entry */
  newestEntry: number
  /** Total requests processed */
  totalRequests: number
  /** Cache hits count */
  cacheHits: number
  /** Cache misses count */
  cacheMisses: number
  /** Cache hits count (alias for compatibility) */
  hits: number
  /** Cache misses count (alias for compatibility) */
  misses: number
  /** Estimated API calls saved */
  apiCallsSaved: number
  /** Average entry size in bytes */
  averageEntrySize: number
  /** Cache directory disk usage */
  diskUsage: {
    /** Used space in bytes */
    used: number
    /** Available space in bytes */
    available: number
    /** Total space in bytes */
    total: number
  }
  /** Performance metrics */
  performance: {
    /** Average operation duration in milliseconds */
    avgOperationMs: number
    /** Fastest operation in milliseconds */
    fastestOperationMs: number
    /** Slowest operation in milliseconds */
    slowestOperationMs: number
  }
}

/**
 * Cache health status
 */
export interface CacheHealthStatus {
  /** Overall health status */
  status: 'healthy' | 'warning' | 'error' | 'disabled'
  /** Health check timestamp */
  timestamp: number
  /** Correlation ID for this health check */
  correlationId: string
  /** Detailed status information */
  details: {
    /** Cache directory accessibility */
    directoryAccessible: boolean
    /** Disk space status */
    diskSpaceOk: boolean
    /** Configuration validity */
    configValid: boolean
    /** Recent error count */
    recentErrors: number
  }
  /** Any warning or error messages */
  messages: string[]
}

/**
 * Cache operation result
 */
export interface CacheOperationResult<T = unknown> {
  /** Operation success status */
  success: boolean
  /** Result data (if successful) */
  data?: T
  /** Error message (if failed) */
  error?: string
  /** Operation correlation ID */
  correlationId: string
  /** Operation duration in milliseconds */
  durationMs: number
  /** Whether operation was cached */
  fromCache?: boolean
}

/**
 * Cache key generation parameters
 */
export interface CacheKeyParams {
  /** TTS provider identifier */
  provider: string
  /** Text to synthesize */
  text: string
  /** Model or engine */
  model: string
  /** Voice identifier */
  voice: string
  /** Speed multiplier */
  speed: number
  /** Audio format */
  format?: string
  /** Additional parameters for key generation */
  extraParams?: Record<string, string | number | boolean>
}

/**
 * Cache validation result
 */
export interface CacheValidationResult {
  /** Validation success status */
  valid: boolean
  /** Validation errors found */
  errors: string[]
  /** Validation warnings */
  warnings: string[]
  /** Statistics about validation */
  stats: {
    /** Total entries checked */
    totalChecked: number
    /** Valid entries count */
    validEntries: number
    /** Invalid entries count */
    invalidEntries: number
    /** Corrupted files count */
    corruptedFiles: number
  }
  /** Correlation ID for this validation */
  correlationId: string
}
