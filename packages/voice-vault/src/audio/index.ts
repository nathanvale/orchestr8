/**
 * Voice Vault Audio System
 * Simple, ADHD-friendly cross-platform audio playback with comprehensive logging
 *
 * @example Simple usage (with console logging)
 * ```typescript
 * import { createAudioPlayerWithConsoleLogger } from '@claude-hooks/voice-vault/audio'
 *
 * const player = createAudioPlayerWithConsoleLogger()
 * const result = await player.playAudio('/path/to/audio.mp3')
 * console.log(result.success ? 'Played!' : `Failed: ${result.error}`)
 * ```
 *
 * @example With configuration
 * ```typescript
 * import { createAudioPlayer } from '@template/voice-vault/audio'
 *
 * const player = createAudioPlayer(myLogger)
 * const result = await player.playAudio('/path/to/audio.mp3', {
 *   volume: 0.8,
 *   correlationId: 'my-operation-123'
 * })
 * ```
 */

// Core audio player
export {
  VoiceVaultAudioPlayer,
  createAudioPlayer,
  createAudioPlayerWithConsoleLogger,
} from './player.js'

// Platform utilities
export {
  Platform,
  detectPlatform,
  getCurrentPlatformInfo,
  getPlatformCapabilities,
  getPlatformName,
  isPlatformSupported,
  type PlatformCapabilities,
} from './platform.js'

// Audio types (re-export from types.ts)
export type {
  AudioEncodingParams,
  AudioFileInfo,
  AudioFormat,
  AudioMetadata,
  AudioPlaybackConfig,
  AudioPlaybackResult,
  AudioQuality,
} from './types.js'
