/**
 * Platform detection utilities for cross-platform audio support
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
 * Check if the current platform is supported
 */
export function isPlatformSupported(): boolean {
  return detectPlatform() !== Platform.Unsupported
}

/**
 * Get platform display name
 */
export function getPlatformName(platform: Platform): string {
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
