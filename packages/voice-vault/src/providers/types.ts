/**
 * Voice Vault Provider Types
 * Defines interfaces and types for TTS providers with correlation ID support
 */

/**
 * Voice information for TTS providers
 */
export interface Voice {
  /** Unique voice identifier */
  id: string
  /** Human-readable voice name */
  name: string
  /** Language code (e.g., 'en-US', 'es-ES') */
  language: string
  /** Voice gender classification */
  gender?: 'male' | 'female' | 'neutral'
  /** Voice description */
  description?: string
  /** Voice quality rating (1-5) */
  quality?: number
  /** Whether voice supports SSML */
  supportsSSML?: boolean
  /** Supported audio formats */
  supportedFormats?: string[]
  /** Voice category or style */
  category?: string
}

/**
 * Provider capabilities and information
 */
export interface TTSProviderInfo {
  /** Internal provider identifier */
  name: string
  /** Human-readable display name */
  displayName: string
  /** Provider version */
  version: string
  /** Whether provider requires API key */
  requiresApiKey: boolean
  /** List of supported features */
  supportedFeatures: string[]
  /** Supported audio formats */
  supportedFormats: string[]
  /** Rate limits (requests per minute) */
  rateLimit?: number
  /** Whether provider supports streaming */
  supportsStreaming?: boolean
  /** Whether provider supports SSML */
  supportsSSML?: boolean
}

/**
 * Provider configuration base interface
 */
export interface TTSProviderConfig {
  /** Correlation ID for configuration tracking */
  correlationId?: string
  /** Provider-specific configuration */
  [key: string]: unknown
}

/**
 * TTS request options
 */
export interface TTSRequestOptions {
  /** Correlation ID for request tracing */
  correlationId?: string
  /** Voice to use for synthesis */
  voice?: string
  /** Model or engine to use */
  model?: string
  /** Speech speed multiplier (0.25-4.0) */
  speed?: number
  /** Audio output format */
  format?: string
  /** Whether to run synthesis in detached mode */
  detached?: boolean
  /** Request timeout in milliseconds */
  timeoutMs?: number
  /** Request priority (1-5, 5 being highest) */
  priority?: number
  /** Whether to use caching for this request */
  useCache?: boolean
  /** Additional provider-specific options */
  providerOptions?: Record<string, unknown>
}

/**
 * Result from TTS synthesis operation
 */
export interface SpeakResult {
  /** Operation success status */
  success: boolean
  /** Provider that handled the request */
  provider: string
  /** Actual provider used (for fallback scenarios) */
  providerUsed?: string
  /** Whether result was served from cache */
  cached?: boolean
  /** Operation duration in milliseconds */
  duration?: number
  /** Error message if operation failed */
  error?: string
  /** Audio data (if successful and not detached) */
  audioData?: Buffer
  /** Audio format of returned data */
  audioFormat?: string
  /** Size of audio data in bytes */
  audioSize?: number
  /** Correlation ID for this operation */
  correlationId: string
  /** Cache key used (if cached) */
  cacheKey?: string
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>
}

/**
 * Provider availability check result
 */
export interface ProviderAvailabilityResult {
  /** Whether provider is available */
  available: boolean
  /** Reason if not available */
  reason?: string
  /** Response time in milliseconds */
  responseTimeMs?: number
  /** Correlation ID for this check */
  correlationId: string
  /** Last checked timestamp */
  lastChecked: number
}

/**
 * Provider health status
 */
export interface ProviderHealthStatus {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  /** Health check timestamp */
  timestamp: number
  /** Correlation ID for this health check */
  correlationId: string
  /** Response time in milliseconds */
  responseTimeMs?: number
  /** Recent error rate (0-1) */
  errorRate?: number
  /** Detailed status information */
  details: {
    /** API connectivity status */
    apiConnectable: boolean
    /** Authentication status */
    authenticated: boolean
    /** Rate limit status */
    rateLimited: boolean
    /** Recent errors count */
    recentErrors: number
  }
  /** Any status messages */
  messages: string[]
}

/**
 * Provider performance metrics
 */
export interface ProviderMetrics {
  /** Total requests made */
  totalRequests: number
  /** Successful requests count */
  successfulRequests: number
  /** Failed requests count */
  failedRequests: number
  /** Average response time in milliseconds */
  avgResponseTimeMs: number
  /** Success rate (0-1) */
  successRate: number
  /** Last request timestamp */
  lastRequestTime: number
  /** Correlation IDs of recent requests */
  recentCorrelationIds: string[]
  /** Provider-specific metrics */
  providerSpecific?: Record<string, number>
}

/**
 * Base interface for all TTS providers
 */
export interface TTSProvider {
  /**
   * Synthesize speech from text
   */
  speak(text: string, options?: TTSRequestOptions): Promise<SpeakResult>

  /**
   * Check if the provider is currently available
   */
  isAvailable(correlationId?: string): Promise<ProviderAvailabilityResult>

  /**
   * Get provider information and capabilities
   */
  getProviderInfo(): TTSProviderInfo

  /**
   * Configure the provider
   */
  configure(config: TTSProviderConfig): Promise<void>

  /**
   * Get current provider configuration
   */
  getConfiguration(): TTSProviderConfig

  /**
   * Get provider health status
   */
  getHealthStatus(correlationId?: string): Promise<ProviderHealthStatus>

  /**
   * Get provider performance metrics
   */
  getMetrics(): ProviderMetrics

  /**
   * Optional: Get available voices for this provider
   */
  getVoices?(correlationId?: string): Promise<Voice[]>

  /**
   * Optional: Preload audio for given text
   */
  preloadAudio?(text: string, options?: TTSRequestOptions): Promise<void>

  /**
   * Optional: Cancel any ongoing speech operations
   */
  cancelSpeech?(correlationId?: string): Promise<void>

  /**
   * Optional: Validate provider configuration
   */
  validateConfiguration?(): Promise<{ valid: boolean; errors: string[] }>

  /**
   * Optional: Clean up provider resources
   */
  cleanup?(): Promise<void>
}

/**
 * Provider factory function type
 */
export type TTSProviderFactory = (config: TTSProviderConfig) => Promise<TTSProvider>

/**
 * Provider registry entry
 */
export interface ProviderRegistryEntry {
  /** Provider identifier */
  name: string
  /** Provider factory function */
  factory: TTSProviderFactory
  /** Provider priority (higher numbers have higher priority) */
  priority: number
  /** Whether provider is enabled by default */
  enabledByDefault: boolean
  /** Provider configuration schema */
  configSchema?: Record<string, unknown>
}

/**
 * Provider selection criteria
 */
export interface ProviderSelectionCriteria {
  /** Preferred provider name */
  preferredProvider?: string
  /** Required features */
  requiredFeatures?: string[]
  /** Maximum acceptable response time in ms */
  maxResponseTimeMs?: number
  /** Required voice language */
  requiredLanguage?: string
  /** Quality threshold (1-5) */
  minQuality?: number
  /** Whether to allow fallback to other providers */
  allowFallback?: boolean
  /** Correlation ID for selection process */
  correlationId?: string
}

/**
 * Provider selection result
 */
export interface ProviderSelectionResult {
  /** Selected provider instance */
  provider: TTSProvider
  /** Provider name */
  providerName: string
  /** Selection reason */
  reason: string
  /** Whether this was a fallback selection */
  isFallback: boolean
  /** Selection correlation ID */
  correlationId: string
  /** Alternative providers considered */
  alternativesConsidered: string[]
}

/**
 * Provider error types
 */
export type ProviderErrorType =
  | 'authentication'
  | 'rate_limit'
  | 'network'
  | 'invalid_request'
  | 'service_unavailable'
  | 'configuration'
  | 'timeout'
  | 'unknown'

/**
 * Structured provider error
 */
export interface ProviderError extends Error {
  /** Error type classification */
  type: ProviderErrorType
  /** Provider that generated the error */
  provider: string
  /** Correlation ID for error tracking */
  correlationId: string
  /** Whether error is retryable */
  retryable: boolean
  /** Retry delay suggestion in milliseconds */
  retryAfterMs?: number
  /** HTTP status code (if applicable) */
  statusCode?: number
  /** Additional error context */
  context?: Record<string, unknown>
}

/**
 * Provider fallback configuration
 */
export interface ProviderFallbackConfig {
  /** Enable fallback mechanism */
  enabled: boolean
  /** Maximum fallback attempts */
  maxAttempts: number
  /** Delay between attempts in milliseconds */
  retryDelayMs: number
  /** Exponential backoff factor */
  backoffFactor: number
  /** Error types that should trigger fallback */
  fallbackTriggers: ProviderErrorType[]
  /** Correlation ID for fallback configuration */
  correlationId?: string
}
