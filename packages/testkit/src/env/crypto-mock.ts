/**
 * Crypto API mocking utilities for deterministic testing
 * Provides mocks for crypto.randomUUID and crypto.getRandomValues
 */

import { vi } from 'vitest'
import { SeededRandom } from './seed.js'

/**
 * UUID v4 validation regex
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Generate a deterministic UUID v4 from a seed
 */
export function generateUUIDFromSeed(seed: number | string): UUID {
  const rng = new SeededRandom(seed)

  // Generate 16 random bytes
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    bytes[i] = rng.nextInt(0, 255)
  }

  // Set version (4) and variant bits per UUID v4 spec
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // Variant 10

  // Convert to hex string with dashes
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-') as UUID
}

/**
 * UUID type matching crypto.randomUUID return type
 */
export type UUID = `${string}-${string}-${string}-${string}-${string}`

/**
 * Create a sequential UUID generator
 */
export function createSequentialUUID(prefix = '00000000'): () => UUID {
  let counter = 0

  return () => {
    counter++
    const paddedCounter = counter.toString(16).padStart(12, '0')
    // Take first 8 chars of prefix, then fixed middle, then padded counter
    return `${prefix.slice(0, 8)}-0000-4000-8000-${paddedCounter}` as UUID
  }
}

/**
 * Fill typed array with deterministic values
 */
function fillDeterministic(
  array: ArrayBufferView,
  pattern?: number[] | SeededRandom,
): ArrayBufferView {
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)

  if (pattern instanceof SeededRandom) {
    // Use seeded random for values
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = pattern.nextInt(0, 255)
    }
  } else if (Array.isArray(pattern)) {
    // Use pattern array, cycling if needed
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = pattern[i % pattern.length]
    }
  } else {
    // Default: incrementing values
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = i % 256
    }
  }

  return array
}

/**
 * Crypto mocking interface
 */
export interface CryptoMocker {
  /** Mock crypto.randomUUID with fixed sequence */
  mockUUID(sequence: string[]): () => void
  /** Mock crypto.randomUUID with generator function */
  mockUUIDGenerator(generator: () => UUID): () => void
  /** Mock crypto.getRandomValues with pattern */
  mockRandomValues(pattern?: number[] | SeededRandom): () => void
  /** Generate deterministic UUID from seed */
  deterministicUUID(seed: number | string): string
  /** Create sequential UUID generator */
  sequentialUUID(prefix?: string): () => UUID
  /** Restore all crypto mocks */
  restore(): void
}

/**
 * Create crypto mocker instance
 */
export function createCryptoMocker(): CryptoMocker {
  const restoreFns: Array<() => void> = []

  return {
    mockUUID(sequence: string[]): () => void {
      if (sequence.length === 0) {
        throw new Error('UUID sequence cannot be empty')
      }

      // Validate all UUIDs in sequence
      for (const uuid of sequence) {
        if (!UUID_V4_REGEX.test(uuid)) {
          throw new Error(`Invalid UUID v4 format: ${uuid}`)
        }
      }

      let index = 0
      const spy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
        const uuid = sequence[index % sequence.length]
        index++
        return uuid as UUID
      })

      const restore = () => spy.mockRestore()
      restoreFns.push(restore)
      return restore
    },

    mockUUIDGenerator(generator: () => UUID): () => void {
      const spy = vi.spyOn(crypto, 'randomUUID').mockImplementation(generator)
      const restore = () => spy.mockRestore()
      restoreFns.push(restore)
      return restore
    },

    mockRandomValues(pattern?: number[] | SeededRandom): () => void {
      const spy = vi
        .spyOn(crypto, 'getRandomValues')
        .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
          if (array === null) return array
          return fillDeterministic(array, pattern) as T
        })

      const restore = () => spy.mockRestore()
      restoreFns.push(restore)
      return restore
    },

    deterministicUUID(seed: number | string): UUID {
      return generateUUIDFromSeed(seed)
    },

    sequentialUUID(prefix?: string): () => UUID {
      return createSequentialUUID(prefix)
    },

    restore(): void {
      restoreFns.forEach((fn) => fn())
      restoreFns.length = 0
    },
  }
}

/**
 * Crypto mock helpers for quick setup
 */
export const cryptoMocks = {
  /**
   * Mock crypto.randomUUID with fixed sequence
   */
  mockRandomUUID(sequence: string[]): () => void {
    const mocker = createCryptoMocker()
    return mocker.mockUUID(sequence)
  },

  /**
   * Mock crypto.randomUUID with sequential UUIDs
   */
  mockSequentialUUID(prefix = '00000000'): () => void {
    const generator = createSequentialUUID(prefix)
    const mocker = createCryptoMocker()
    return mocker.mockUUIDGenerator(generator)
  },

  /**
   * Mock crypto.randomUUID with deterministic seed
   */
  mockSeededUUID(seed: number | string): () => void {
    const mocker = createCryptoMocker()
    const rng = new SeededRandom(seed)

    return mocker.mockUUIDGenerator(() => {
      // Generate new UUID from seeded random
      const bytes = new Uint8Array(16)
      for (let i = 0; i < 16; i++) {
        bytes[i] = rng.nextInt(0, 255)
      }

      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80

      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
      ].join('-') as UUID
    })
  },

  /**
   * Generate deterministic UUID from seed
   */
  deterministicUUID: generateUUIDFromSeed,

  /**
   * Mock crypto.getRandomValues with pattern
   */
  mockGetRandomValues(pattern?: number[] | SeededRandom): () => void {
    const mocker = createCryptoMocker()
    return mocker.mockRandomValues(pattern)
  },

  /**
   * Create crypto mocker instance
   */
  createMocker: createCryptoMocker,
}

/**
 * Global crypto controller for convenient access
 */
let globalCryptoController: CryptoMocker | null = null

/**
 * Get or create global crypto controller
 */
export function getGlobalCryptoController(): CryptoMocker {
  if (!globalCryptoController) {
    globalCryptoController = createCryptoMocker()
  }
  return globalCryptoController
}

/**
 * Setup automatic crypto mocking with test lifecycle
 */
export function setupCryptoControl(seed?: number | string): CryptoMocker {
  const controller = getGlobalCryptoController()

  // Setup default mocking if seed provided
  if (seed !== undefined) {
    controller.mockUUIDGenerator(() => generateUUIDFromSeed(seed))
    controller.mockRandomValues(new SeededRandom(seed))
  }

  // Restore after all tests
  if (typeof afterAll !== 'undefined') {
    afterAll(() => {
      controller.restore()
      globalCryptoController = null
    })
  }

  return controller
}
