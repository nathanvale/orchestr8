/**
 * Command normalization utilities for consistent mock registration/lookup
 *
 * These utilities ensure that commands are normalized the same way during both
 * registration and lookup to prevent mismatches.
 */

import type { ProcessMockConfig } from './process-mock.js'

/**
 * Normalize command string for consistent matching
 * - Trims and collapses whitespace
 * - Strips wrapping quotes from tokens
 * - Normalizes path separators
 */
export function normalize(input: string): string {
  return (
    input
      .trim()
      // Collapse multiple whitespace into single spaces
      .replace(/\s+/g, ' ')
      // Strip wrapping quotes from tokens but preserve spaces between tokens
      .replace(/(['"])((?:(?!\1)[^\\\\]|\\\\.)*)(\1)/g, '$2')
      // Normalize path separators to forward slashes
      .replace(/\\/g, '/')
  )
}

/**
 * Normalize command parts into a single string
 * Combines command and arguments with proper normalization
 */
export function normalizeParts(cmd: string, args?: string[]): string {
  const fullCommand = args ? `${cmd} ${args.join(' ')}` : cmd
  return normalize(fullCommand)
}

/**
 * Find matching mock configuration with unified lookup strategy
 * Uses exact → regex → includes strategy consistently
 */
export function findConfig(
  map: Map<string | RegExp, ProcessMockConfig>,
  input: string,
): ProcessMockConfig | undefined {
  const normalizedInput = normalize(input)

  // Debug logging
  const debugMode = process.env.DEBUG_TESTKIT || false
  if (debugMode) {
    console.log('findConfig:', {
      input,
      normalizedInput,
      mapSize: map.size,
      mapKeys: Array.from(map.keys()),
    })
  }

  // First pass: exact matches (both normalized and original)
  for (const [pattern, config] of map) {
    if (typeof pattern === 'string') {
      const normalizedPattern = normalize(pattern)
      if (debugMode) {
        console.log('Checking exact pattern:', {
          pattern,
          normalizedPattern,
          inputMatches: input === pattern,
          normalizedMatches: normalizedInput === normalizedPattern,
        })
      }
      if (normalizedInput === normalizedPattern || input === pattern) {
        if (debugMode) console.log('Found exact match!')
        return config
      }
    }
  }

  // Second pass: regex matches
  for (const [pattern, config] of map) {
    if (pattern instanceof RegExp) {
      const matchesInput = pattern.test(input)
      const matchesNormalized = pattern.test(normalizedInput)
      if (debugMode) {
        console.log('Checking regex pattern:', {
          pattern: pattern.source,
          matchesInput,
          matchesNormalized,
        })
      }
      if (matchesInput || matchesNormalized) {
        if (debugMode) console.log('Found regex match!')
        return config
      }
    }
  }

  // Third pass: includes matches (least specific)
  for (const [pattern, config] of map) {
    if (typeof pattern === 'string') {
      const normalizedPattern = normalize(pattern)
      const includesChecks = [
        normalizedInput.includes(normalizedPattern),
        input.includes(pattern),
        normalizedInput.includes(pattern),
        input.includes(normalizedPattern),
      ]
      if (debugMode) {
        console.log('Checking includes pattern:', {
          pattern,
          normalizedPattern,
          includesChecks,
        })
      }
      if (includesChecks.some(Boolean)) {
        if (debugMode) console.log('Found includes match!')
        return config
      }
    }
  }

  if (debugMode) console.log('No match found')
  return undefined
}
