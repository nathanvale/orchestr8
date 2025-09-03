/**
 * TTS Providers
 * Exports all TTS providers and registers them with the factory
 */

// Export all providers
export { ElevenLabsProvider } from './elevenlabs-provider.js'
export type { ElevenLabsConfig } from './elevenlabs-provider.js'
export { MacOSProvider } from './macos-provider.js'
export type { MacOSConfig } from './macos-provider.js'
export { OpenAIProvider } from './openai-provider.js'
export type { OpenAIConfig } from './openai-provider.js'
export { TTSProviderFactory } from './provider-factory.js'
export type { FactoryConfig } from './provider-factory.js'

// Export audio cache
export { AudioCache } from './audio-cache.js'
export type { AudioCacheConfig, CacheEntry, CacheStats } from './audio-cache.js'

// Export base types
export type {
  SpeakResult,
  TTSProvider,
  TTSProviderConfig,
  TTSProviderInfo,
  Voice,
} from './tts-provider.js'

import { ElevenLabsProvider } from './elevenlabs-provider.js'
import { MacOSProvider } from './macos-provider.js'
import { OpenAIProvider } from './openai-provider.js'
import { TTSProviderFactory } from './provider-factory.js'

// Ensure providers are registered when the factory is first used
let providersRegistered = false

/**
 * Initialize the provider factory with default providers
 */
export function initializeProviders(): void {
  if (providersRegistered) return

  // Check if TTSProviderFactory and registerProvider method exist
  if (typeof TTSProviderFactory?.registerProvider !== 'function') {
    console.error('TTSProviderFactory.registerProvider is not a function:', {
      TTSProviderFactory,
      registerProvider: TTSProviderFactory?.registerProvider,
      type: typeof TTSProviderFactory?.registerProvider,
    })
    return
  }

  TTSProviderFactory.registerProvider('openai', OpenAIProvider)
  TTSProviderFactory.registerProvider('macos', MacOSProvider)
  TTSProviderFactory.registerProvider('elevenlabs', ElevenLabsProvider)
  providersRegistered = true
}

// Auto-initialize on module load
initializeProviders()
