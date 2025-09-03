/**
 * Text Normalizer for Cache Keys
 * Provides consistent text normalization for cache key generation with full observability
 */

import { createHash } from 'node:crypto'
import type {
  CacheKeyParams,
  CacheNormalizationConfig,
  Logger,
  VoiceVaultLogFields,
} from '../types/index.js'

/**
 * Text normalization result with observability
 */
export interface TextNormalizationResult {
  /** Original text */
  originalText: string
  /** Normalized text */
  normalizedText: string
  /** Cache key hash */
  cacheKey: string
  /** Correlation ID for tracing */
  correlationId: string
  /** Normalization steps applied */
  stepsApplied: string[]
  /** Text length before normalization */
  originalLength: number
  /** Text length after normalization */
  normalizedLength: number
  /** Processing time in milliseconds */
  processingTimeMs: number
}

/**
 * Text normalizer class with comprehensive logging
 */
export class TextNormalizer {
  private readonly config: Required<CacheNormalizationConfig>
  private readonly logger: Logger

  constructor(config: CacheNormalizationConfig = {}, logger: Logger) {
    this.config = {
      caseSensitive: config.caseSensitive ?? false,
      stripPriorityPrefixes: config.stripPriorityPrefixes ?? true,
      normalizeWhitespace: config.normalizeWhitespace ?? true,
      stripPunctuation: config.stripPunctuation ?? false,
      customNormalizer: config.customNormalizer || ((text: string) => text),
    }
    this.logger = logger
  }

  /**
   * Normalize text for cache key generation with full observability
   */
  normalizeText(text: string, correlationId: string): TextNormalizationResult {
    const startTime = Date.now()
    const originalText = text
    const originalLength = text.length
    const stepsApplied: string[] = []

    this.logger.debug('Starting text normalization', {
      correlationId,
      component: 'cache',
      operation: 'normalize-text',
      textLength: originalLength,
      config: this.config,
    } satisfies VoiceVaultLogFields)

    let normalized = text

    // Step 1: Normalize whitespace if enabled
    if (this.config.normalizeWhitespace) {
      const beforeWhitespace = normalized
      normalized = normalized.trim().replace(/\s+/g, ' ')
      if (beforeWhitespace !== normalized) {
        stepsApplied.push('normalize-whitespace')
      }
    }

    // Step 2: Strip priority prefixes if enabled
    if (this.config.stripPriorityPrefixes) {
      const beforePriority = normalized
      const priorityPrefixPattern = /^(low|medium|high)\s+priority:\s*/i
      normalized = normalized.replace(priorityPrefixPattern, '')
      if (beforePriority !== normalized) {
        stepsApplied.push('strip-priority-prefixes')
      }
    }

    // Step 3: Strip punctuation if enabled
    if (this.config.stripPunctuation) {
      const beforePunctuation = normalized
      normalized = normalized.replace(/[^\w\s]/g, '')
      if (beforePunctuation !== normalized) {
        stepsApplied.push('strip-punctuation')
      }
    }

    // Step 4: Convert to lowercase if case-insensitive
    if (!this.config.caseSensitive) {
      const beforeCase = normalized
      normalized = normalized.toLowerCase()
      if (beforeCase !== normalized) {
        stepsApplied.push('lowercase')
      }
    }

    // Step 5: Apply custom normalizer if provided
    if (this.config.customNormalizer) {
      const beforeCustom = normalized
      normalized = this.config.customNormalizer(normalized)
      if (beforeCustom !== normalized) {
        stepsApplied.push('custom-normalizer')
      }
    }

    const normalizedLength = normalized.length
    const processingTimeMs = Date.now() - startTime

    this.logger.debug('Text normalization completed', {
      correlationId,
      component: 'cache',
      operation: 'normalize-text',
      originalLength,
      normalizedLength,
      stepsApplied,
      durationMs: processingTimeMs,
    } satisfies VoiceVaultLogFields)

    return {
      originalText,
      normalizedText: normalized,
      cacheKey: '', // Will be set by generateCacheKey
      correlationId,
      stepsApplied,
      originalLength,
      normalizedLength,
      processingTimeMs,
    }
  }

  /**
   * Generate cache key from TTS parameters with full observability
   */
  generateCacheKey(params: CacheKeyParams, correlationId: string): TextNormalizationResult {
    const startTime = Date.now()

    this.logger.debug('Starting cache key generation', {
      correlationId,
      component: 'cache',
      operation: 'generate-key',
      provider: params.provider,
      voice: params.voice,
      model: params.model,
      speed: params.speed,
      format: params.format,
      textLength: params.text.length,
      extraParams: params.extraParams,
    } satisfies VoiceVaultLogFields)

    // Normalize text first
    const normalizationResult = this.normalizeText(params.text, correlationId)

    // Normalize format string to lowercase to prevent cache duplicates
    const normalizedFormat = (params.format || 'mp3').toLowerCase()

    // Build cache key input string with all parameters
    const keyComponents = [
      params.provider,
      normalizationResult.normalizedText,
      params.model,
      params.voice,
      params.speed.toString(),
      normalizedFormat,
    ]

    // Add extra parameters if provided (sorted for consistency)
    if (params.extraParams && Object.keys(params.extraParams).length > 0) {
      const extraParamString = Object.keys(params.extraParams)
        .sort()
        .map((key) => `${key}=${params.extraParams![key]}`)
        .join('&')
      keyComponents.push(extraParamString)
    }

    const input = keyComponents.join('|')

    // Generate hash
    const hash = createHash('sha256')
    hash.update(input, 'utf8')
    const cacheKey = hash.digest('hex')

    const totalProcessingTimeMs = Date.now() - startTime

    this.logger.info('Cache key generated', {
      correlationId,
      component: 'cache',
      operation: 'generate-key',
      cacheKey,
      provider: params.provider,
      voice: params.voice,
      textLength: params.text.length,
      normalizedLength: normalizationResult.normalizedLength,
      stepsApplied: normalizationResult.stepsApplied,
      durationMs: totalProcessingTimeMs,
    } satisfies VoiceVaultLogFields)

    return {
      ...normalizationResult,
      cacheKey,
      processingTimeMs: totalProcessingTimeMs,
    }
  }

  /**
   * Get current normalization configuration
   */
  getConfiguration(): CacheNormalizationConfig {
    return { ...this.config }
  }

  /**
   * Update normalization configuration
   */
  updateConfiguration(config: Partial<CacheNormalizationConfig>, correlationId: string): void {
    const oldConfig = { ...this.config }
    Object.assign(this.config, config)

    this.logger.info('Normalization configuration updated', {
      correlationId,
      component: 'cache',
      operation: 'update-config',
      oldConfig,
      newConfig: this.config,
    } satisfies VoiceVaultLogFields)
  }
}
