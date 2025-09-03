/**
 * Abstract Base Provider for Voice Vault TTS
 *
 * Provides common functionality for all TTS providers including:
 * - Correlation ID threading
 * - Performance metrics tracking
 * - Error handling patterns
 * - Text validation
 * - Result creation helpers
 */

import { generateCorrelationId, type Logger, type VoiceVaultLogFields } from '../logging/index.js'
import type {
  ProviderError,
  ProviderErrorType,
  ProviderHealthStatus,
  ProviderMetrics,
  SpeakResult,
  TTSProvider,
  TTSProviderConfig,
  TTSProviderInfo,
  TTSRequestOptions,
} from './types.js'

/**
 * Abstract base class implementing common TTS provider functionality
 */
export abstract class BaseTTSProvider implements TTSProvider {
  protected config: TTSProviderConfig = {}
  protected logger: Logger
  protected readonly instanceId: string
  protected readonly instanceCorrelationId: string

  // Performance tracking
  protected totalRequests = 0
  protected successfulRequests = 0
  protected failedRequests = 0
  protected totalResponseTime = 0
  protected recentCorrelationIds: string[] = []
  protected readonly maxRecentIds = 50

  // Health tracking
  protected lastRequestTime = 0
  protected recentErrors = 0
  protected readonly errorWindow = 5 * 60 * 1000 // 5 minutes
  protected errorTimestamps: number[] = []

  constructor(config: TTSProviderConfig = {}, logger: Logger) {
    this.logger = logger
    this.instanceId = `${this.getProviderInfo().name}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    this.instanceCorrelationId = config.correlationId || generateCorrelationId()
    this.config = { ...config, correlationId: this.instanceCorrelationId }

    this.logger.info('TTS Provider initialized', {
      correlationId: this.instanceCorrelationId,
      component: 'provider',
      operation: 'initialize',
      provider: this.getProviderInfo().name,
      instanceId: this.instanceId,
    } satisfies VoiceVaultLogFields)
  }

  // Abstract methods that must be implemented by concrete providers
  abstract speak(text: string, options?: TTSRequestOptions): Promise<SpeakResult>
  abstract isAvailable(correlationId?: string): Promise<{
    available: boolean
    reason?: string
    responseTimeMs?: number
    correlationId: string
    lastChecked: number
  }>
  abstract getProviderInfo(): TTSProviderInfo

  /**
   * Configure the provider
   */
  async configure(config: TTSProviderConfig): Promise<void> {
    const correlationId = config.correlationId || generateCorrelationId()

    this.logger.debug('Configuring provider', {
      correlationId,
      component: 'provider',
      operation: 'configure',
      provider: this.getProviderInfo().name,
      configKeys: Object.keys(config),
    } satisfies VoiceVaultLogFields)

    this.config = { ...this.config, ...config }
  }

  /**
   * Get current provider configuration
   */
  getConfiguration(): TTSProviderConfig {
    return { ...this.config }
  }

  /**
   * Get provider health status with comprehensive checks
   */
  async getHealthStatus(correlationId?: string): Promise<ProviderHealthStatus> {
    const opCorrelationId = correlationId || generateCorrelationId()
    const startTime = Date.now()

    this.logger.debug('Checking provider health', {
      correlationId: opCorrelationId,
      component: 'provider',
      operation: 'health-check',
      provider: this.getProviderInfo().name,
    } satisfies VoiceVaultLogFields)

    try {
      // Check availability
      const availability = await this.isAvailable(opCorrelationId)
      const responseTime = Date.now() - startTime

      // Calculate recent error rate
      const now = Date.now()
      const recentErrorCount = this.errorTimestamps.filter(
        (timestamp) => now - timestamp < this.errorWindow,
      ).length
      const errorRate = this.totalRequests > 0 ? recentErrorCount / this.totalRequests : 0

      let status: ProviderHealthStatus['status'] = 'healthy'
      const messages: string[] = []

      if (!availability.available) {
        status = 'unhealthy'
        messages.push(availability.reason || 'Provider not available')
      } else if (errorRate > 0.5) {
        status = 'degraded'
        messages.push(`High error rate: ${Math.round(errorRate * 100)}%`)
      } else if (responseTime > 5000) {
        status = 'degraded'
        messages.push(`Slow response time: ${responseTime}ms`)
      }

      const healthStatus: ProviderHealthStatus = {
        status,
        timestamp: now,
        correlationId: opCorrelationId,
        responseTimeMs: responseTime,
        errorRate,
        details: {
          apiConnectable: availability.available,
          authenticated: availability.available, // Simplified for now
          rateLimited: false, // Would need provider-specific implementation
          recentErrors: recentErrorCount,
        },
        messages,
      }

      this.logger.info('Provider health check completed', {
        correlationId: opCorrelationId,
        component: 'provider',
        operation: 'health-check',
        provider: this.getProviderInfo().name,
        status: healthStatus.status,
        responseTimeMs: responseTime,
        errorRate: Math.round(errorRate * 100),
      } satisfies VoiceVaultLogFields)

      return healthStatus
    } catch (error) {
      const healthStatus: ProviderHealthStatus = {
        status: 'unknown',
        timestamp: Date.now(),
        correlationId: opCorrelationId,
        details: {
          apiConnectable: false,
          authenticated: false,
          rateLimited: false,
          recentErrors: this.recentErrors,
        },
        messages: [`Health check failed: ${(error as Error).message}`],
      }

      this.logger.error('Provider health check failed', {
        correlationId: opCorrelationId,
        component: 'provider',
        operation: 'health-check',
        provider: this.getProviderInfo().name,
        error: (error as Error).message,
      } satisfies VoiceVaultLogFields)

      return healthStatus
    }
  }

  /**
   * Get provider performance metrics
   */
  getMetrics(): ProviderMetrics {
    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      avgResponseTimeMs: this.totalRequests > 0 ? this.totalResponseTime / this.totalRequests : 0,
      successRate: this.totalRequests > 0 ? this.successfulRequests / this.totalRequests : 0,
      lastRequestTime: this.lastRequestTime,
      recentCorrelationIds: [...this.recentCorrelationIds],
    }
  }

  /**
   * Clean up provider resources
   */
  async cleanup(): Promise<void> {
    const correlationId = generateCorrelationId()

    this.logger.info('Cleaning up provider', {
      correlationId,
      component: 'provider',
      operation: 'cleanup',
      provider: this.getProviderInfo().name,
      totalRequests: this.totalRequests,
      successRate: this.totalRequests > 0 ? this.successfulRequests / this.totalRequests : 0,
    } satisfies VoiceVaultLogFields)
  }

  // Protected helper methods

  /**
   * Validate and clean text input
   */
  protected validateText(text: string): string | null {
    const trimmed = text.trim()
    if (!trimmed) {
      return null
    }
    return trimmed
  }

  /**
   * Create a standardized error result with correlation ID
   */
  protected createErrorResult(
    error: string,
    correlationId: string,
    errorType: ProviderErrorType = 'unknown',
    additionalDetails?: Record<string, unknown>,
  ): SpeakResult {
    this.trackFailure(correlationId)

    const providerInfo = this.getProviderInfo()

    return {
      success: false,
      provider: providerInfo.name,
      error,
      correlationId,
      metadata: {
        errorType,
        timestamp: Date.now(),
        providerVersion: providerInfo.version,
        providerStatus: 'available', // TTSProviderInfo doesn't have available property
        ...additionalDetails,
      },
    }
  }

  /**
   * Create a standardized success result with correlation ID
   */
  protected createSuccessResult(
    correlationId: string,
    options: {
      cached?: boolean
      duration?: number
      audioData?: Buffer
      audioFormat?: string
      audioSize?: number
      cacheKey?: string
      providerUsed?: string
      metadata?: Record<string, unknown>
    } = {},
  ): SpeakResult {
    this.trackSuccess(correlationId, options.duration)

    return {
      success: true,
      provider: this.getProviderInfo().name,
      correlationId,
      ...options,
    }
  }

  /**
   * Create a structured provider error
   */
  protected createProviderError(
    message: string,
    type: ProviderErrorType,
    correlationId: string,
    options: {
      retryable?: boolean
      retryAfterMs?: number
      statusCode?: number
      context?: Record<string, unknown>
    } = {},
  ): ProviderError {
    const error = new Error(message) as ProviderError
    error.type = type
    error.provider = this.getProviderInfo().name
    error.correlationId = correlationId
    error.retryable = options.retryable ?? false
    error.retryAfterMs = options.retryAfterMs
    error.statusCode = options.statusCode
    error.context = options.context

    return error
  }

  /**
   * Track successful request
   */
  protected trackSuccess(correlationId: string, duration?: number): void {
    this.totalRequests++
    this.successfulRequests++
    this.lastRequestTime = Date.now()

    if (duration != null) {
      this.totalResponseTime += duration
    }

    this.addRecentCorrelationId(correlationId)
  }

  /**
   * Track failed request
   */
  protected trackFailure(correlationId: string, duration?: number): void {
    this.totalRequests++
    this.failedRequests++
    this.lastRequestTime = Date.now()

    if (duration != null) {
      this.totalResponseTime += duration
    }

    this.addRecentCorrelationId(correlationId)
    this.trackError()
  }

  /**
   * Track error occurrence for health monitoring
   */
  private trackError(): void {
    const now = Date.now()
    this.errorTimestamps.push(now)

    // Clean old error timestamps
    this.errorTimestamps = this.errorTimestamps.filter(
      (timestamp) => now - timestamp < this.errorWindow,
    )

    this.recentErrors = this.errorTimestamps.length
  }

  /**
   * Add correlation ID to recent list
   */
  private addRecentCorrelationId(correlationId: string): void {
    this.recentCorrelationIds.unshift(correlationId)

    if (this.recentCorrelationIds.length > this.maxRecentIds) {
      this.recentCorrelationIds = this.recentCorrelationIds.slice(0, this.maxRecentIds)
    }
  }
}
