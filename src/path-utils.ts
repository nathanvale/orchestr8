/**
 * Minimal cross-platform path utilities
 * Provides basic path operations that work across Windows, macOS, and Linux
 */

/**
 * Platform-specific path separator
 * Uses forward slash for Unix-like systems, backslash for Windows
 */
export const pathSeparator = typeof process !== 'undefined' && process.platform === 'win32' ? '\\' : '/';

/**
 * Join path segments with the appropriate separator for the current platform
 * @param segments - Path segments to join
 * @returns Joined path string
 */
export function joinPath(...segments: string[]): string {
  // Filter out empty strings and join with the platform separator
  const filtered = segments.filter(Boolean);
  if (filtered.length === 0) return '';
  
  // Normalize separators in each segment to the current platform
  const normalized = filtered.map(segment => 
    segment.replace(/[/\\]+/g, pathSeparator)
  );
  
  // Join segments and remove duplicate separators
  const joined = normalized.join(pathSeparator);
  const cleaned = joined.replace(new RegExp(`\\${pathSeparator}{2,}`, 'g'), pathSeparator);
  
  return cleaned;
}

/**
 * Normalize a path to use consistent separators for the current platform
 * @param path - Path to normalize
 * @returns Normalized path string
 */
export function normalizePath(path: string): string {
  if (!path) return '';
  
  // Replace all separators with the current platform's separator
  const normalized = path.replace(/[/\\]+/g, pathSeparator);
  
  // Remove trailing separator unless it's the root
  if (normalized.length > 1 && normalized.endsWith(pathSeparator)) {
    return normalized.slice(0, -1);
  }
  
  return normalized;
}

/**
 * Get the directory name from a path
 * @param path - Full path
 * @returns Directory portion of the path
 */
export function dirname(path: string): string {
  if (!path) return '.';
  
  const normalized = normalizePath(path);
  const lastSepIndex = normalized.lastIndexOf(pathSeparator);
  
  if (lastSepIndex === -1) return '.';
  if (lastSepIndex === 0) {
    // For root paths like '/' or '/file', return '/'
    // But for just '/', we need special handling
    return normalized.length === 1 ? '/' : pathSeparator;
  }
  
  return normalized.slice(0, lastSepIndex);
}

/**
 * Get the base name (filename) from a path
 * @param path - Full path
 * @returns Base name portion of the path
 */
export function basename(path: string): string {
  if (!path) return '';
  
  const normalized = normalizePath(path);
  const lastSepIndex = normalized.lastIndexOf(pathSeparator);
  
  if (lastSepIndex === -1) return normalized;
  return normalized.slice(lastSepIndex + 1);
}

/**
 * Check if a path is absolute
 * @param path - Path to check
 * @returns True if the path is absolute
 */
export function isAbsolute(path: string): boolean {
  if (!path) return false;
  
  // Unix-like systems: starts with /
  if (path.startsWith('/')) return true;
  
  // Windows: starts with drive letter (C:\) or UNC path (\\)
  if (typeof process !== 'undefined' && process.platform === 'win32') {
    // Check for drive letter (e.g., C:\)
    if (/^[a-zA-Z]:[\\/]/.test(path)) return true;
    // Check for UNC path (\\server\share)
    if (path.startsWith('\\\\')) return true;
  }
  
  return false;
}

/**
 * Convert a path to use forward slashes (Unix-style)
 * Useful for URLs or when consistency is needed
 * @param path - Path to convert
 * @returns Path with forward slashes
 */
export function toPosixPath(path: string): string {
  if (!path) return '';
  return path.replace(/\\/g, '/');
}

/**
 * Convert a path to use the current platform's separators
 * @param path - Path to convert
 * @returns Path with platform-appropriate separators
 */
export function toPlatformPath(path: string): string {
  return normalizePath(path);
}