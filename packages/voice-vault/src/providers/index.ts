/**
 * Voice Vault TTS Providers
 *
 * Central exports for all TTS providers and related functionality.
 * This module provides a complete interface for text-to-speech operations
 * with multiple provider backends, caching, and observability.
 */

// Core types and interfaces
export * from './types.js'

// Abstract base provider
export { BaseTTSProvider } from './base-provider.js'

// Concrete provider implementations
export { ElevenLabsProvider, type ElevenLabsProviderConfig } from './elevenlabs-provider.js'
export { OpenAIProvider, type OpenAIProviderConfig } from './openai-provider.js'
export { SystemProvider, type SystemProviderConfig } from './system-provider.js'

// Provider factory and management
export { ProviderFactory, type ProviderFactoryConfig } from './provider-factory.js'

// Re-export cache and logging for convenience
export type { AudioCache } from '../cache/audio-cache.js'
export type { Logger, VoiceVaultLogFields } from '../logging/index.js'
