/**
 * Voice Vault Types
 * Central export point for all Voice Vault TypeScript interfaces and types
 */

// Cache configuration and types
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
} from '../cache/index.js'

// Import cache types for local use
import type { CacheHealthStatus, VoiceVaultCacheConfig } from '../cache/index.js'

// Provider types
export type {
  ProviderAvailabilityResult,
  ProviderError,
  ProviderErrorType,
  ProviderFallbackConfig,
  ProviderHealthStatus,
  ProviderMetrics,
  ProviderRegistryEntry,
  ProviderSelectionCriteria,
  ProviderSelectionResult,
  SpeakResult,
  TTSProvider,
  TTSProviderConfig,
  TTSProviderFactory,
  TTSProviderInfo,
  TTSRequestOptions,
  Voice,
} from '../providers/types.js'

// Import provider types for local use
import type {
  ProviderHealthStatus,
  ProviderSelectionCriteria,
  TTSProviderConfig,
} from '../providers/types.js'

// Audio system types
export type {
  AudioAnalysisResult,
  AudioAnalyzerConfig,
  AudioCacheEntry,
  AudioConversionResult,
  AudioConverterConfig,
  AudioEncodingParams,
  AudioFileInfo,
  AudioFormat,
  AudioMetadata,
  AudioPlaybackConfig,
  AudioPlaybackResult,
  AudioProcessingOptions,
  AudioProcessingResult,
  AudioQuality,
  AudioStreamChunk,
  AudioStreamConfig,
  AudioValidationResult,
} from '../audio/types.js'

// Logging types (re-export from logging module)
export type {
  LogFields,
  Logger,
  VoiceVaultLogFields,
  VoiceVaultLoggerConfig,
} from '../logging/index.js'

// Import logging types for local use
import type { VoiceVaultLoggerConfig } from '../logging/index.js'

/**
 * Core Voice Vault configuration interface
 */
export interface VoiceVaultConfig {
  /** Cache configuration */
  cache?: VoiceVaultCacheConfig
  /** Logging configuration */
  logging?: VoiceVaultLoggerConfig
  /** Provider configurations */
  providers?: Record<string, TTSProviderConfig>
  /** Default provider selection criteria */
  defaultProviderCriteria?: ProviderSelectionCriteria
  /** Global correlation ID */
  correlationId?: string
  /** Instance identifier */
  instanceId?: string
}

/**
 * Voice Vault initialization result
 */
export interface VoiceVaultInitResult {
  /** Initialization success status */
  success: boolean
  /** Voice Vault instance ID */
  instanceId: string
  /** Initialization correlation ID */
  correlationId: string
  /** Configured providers count */
  providersConfigured: number
  /** Cache initialization status */
  cacheInitialized: boolean
  /** Error message if failed */
  error?: string
  /** Initialization duration in milliseconds */
  initTimeMs: number
}

/**
 * Voice Vault operation context
 */
export interface VoiceVaultOperationContext {
  /** Operation correlation ID */
  correlationId: string
  /** Operation type */
  operation: string
  /** Voice Vault instance ID */
  instanceId: string
  /** Operation start time */
  startTime: number
  /** Additional context metadata */
  metadata?: Record<string, unknown>
}

/**
 * Voice Vault health check result
 */
export interface VoiceVaultHealthResult {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy'
  /** Health check timestamp */
  timestamp: number
  /** Health check correlation ID */
  correlationId: string
  /** Individual component health */
  components: {
    /** Cache system health */
    cache: CacheHealthStatus
    /** Provider health statuses */
    providers: Record<string, ProviderHealthStatus>
    /** Logging system health */
    logging: { status: 'healthy' | 'error'; message?: string }
  }
  /** Overall performance metrics */
  metrics: {
    /** Average operation time in ms */
    avgOperationTimeMs: number
    /** Total operations processed */
    totalOperations: number
    /** Error rate (0-1) */
    errorRate: number
    /** Cache hit rate (0-1) */
    cacheHitRate: number
  }
  /** Health check messages */
  messages: string[]
}
