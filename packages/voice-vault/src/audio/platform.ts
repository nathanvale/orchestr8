/**
 * Voice Vault Platform Detection Utilities
 * Simple cross-platform detection for audio playback support
 */

/**
 * Supported platforms for audio playback
 */
export enum Platform {
  macOS = 'darwin',
  Windows = 'win32',
  Linux = 'linux',
  Unsupported = 'unsupported',
}

/**
 * Platform capabilities for audio features
 */
export interface PlatformCapabilities {
  /** Platform supports native audio playback */
  nativePlayback: boolean
  /** Available audio players/commands */
  audioPlayers: string[]
  /** Default system sounds available */
  systemSounds: boolean
  /** Platform display name */
  displayName: string
}

/**
 * Detect the current platform
 */
export function detectPlatform(): Platform {
  const platform = process.platform

  switch (platform) {
    case 'darwin':
      return Platform.macOS
    case 'win32':
      return Platform.Windows
    case 'linux':
    case 'freebsd':
    case 'openbsd':
    case 'sunos':
      return Platform.Linux
    default:
      return Platform.Unsupported
  }
}

/**
 * Check if the current platform supports audio playback
 */
export function isPlatformSupported(): boolean {
  return detectPlatform() !== Platform.Unsupported
}

/**
 * Get platform display name
 */
export function getPlatformName(platform: Platform = detectPlatform()): string {
  switch (platform) {
    case Platform.macOS:
      return 'macOS'
    case Platform.Windows:
      return 'Windows'
    case Platform.Linux:
      return 'Linux'
    case Platform.Unsupported:
      return 'Unsupported'
  }
}

/**
 * Get platform capabilities for audio features
 */
export function getPlatformCapabilities(
  platform: Platform = detectPlatform(),
): PlatformCapabilities {
  switch (platform) {
    case Platform.macOS:
      return {
        nativePlayback: true,
        audioPlayers: ['afplay'],
        systemSounds: true,
        displayName: 'macOS',
      }
    case Platform.Windows:
      return {
        nativePlayback: true,
        audioPlayers: ['powershell'],
        systemSounds: true,
        displayName: 'Windows',
      }
    case Platform.Linux:
      return {
        nativePlayback: true,
        audioPlayers: ['aplay', 'paplay', 'play', 'mpg123', 'sox'],
        systemSounds: false,
        displayName: 'Linux',
      }
    case Platform.Unsupported:
      return {
        nativePlayback: false,
        audioPlayers: [],
        systemSounds: false,
        displayName: 'Unsupported',
      }
  }
}

/**
 * Get current platform information (ADHD-friendly single call)
 */
export function getCurrentPlatformInfo(): {
  platform: Platform
  supported: boolean
  capabilities: PlatformCapabilities
} {
  const platform = detectPlatform()
  return {
    platform,
    supported: platform !== Platform.Unsupported,
    capabilities: getPlatformCapabilities(platform),
  }
}
