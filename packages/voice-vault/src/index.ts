/**
 * Voice Vault - TTS Caching Package
 * High-performance TTS audio caching system with correlation ID support
 */

// Export all types
export * from './types/index.js'

// Export logging utilities
export {
  createChildLogger,
  createVoiceVaultLogger,
  createVoiceVaultLoggerSync,
  extractCorrelationId,
  generateCorrelationId,
  logCacheStatistics,
} from './logging/index.js'

// Export audio system (✅ COMPLETED)
export {
  Platform,
  VoiceVaultAudioPlayer,
  createAudioPlayer,
  createAudioPlayerWithConsoleLogger,
  detectPlatform,
  getCurrentPlatformInfo,
  getPlatformCapabilities,
  getPlatformName,
  isPlatformSupported,
} from './audio/index.js'

// Main Voice Vault class (✅ COMPLETED)
export {
  VoiceVault,
  type VoiceVaultPreloadResult,
  type VoiceVaultSpeakResult,
} from './voice-vault.js'

// Default export for easy usage
export { VoiceVault as default } from './voice-vault.js'

// Core functionality exports
export {
  checkCacheHealth,
  createAudioCache,
  createDefaultCacheConfig,
  createTextNormalizer,
  generateCacheKey,
  type AudioCache,
} from './cache/index.js'

export {
  BaseTTSProvider,
  ElevenLabsProvider,
  OpenAIProvider,
  ProviderFactory,
  SystemProvider,
  type ProviderSelectionResult,
  type TTSProvider,
  type TTSProviderConfig,
} from './providers/index.js'
