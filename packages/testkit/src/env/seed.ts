/**
 * Seed management utilities for deterministic random number generation
 * Provides seeded PRNG implementation and seed normalization
 */

/**
 * Simple hash function to convert strings to deterministic seeds
 */
export function hashString(str: string): number {
  let hash = 0
  if (str.length === 0) return hash

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return Math.abs(hash)
}

/**
 * Normalize various input types to a consistent seed value
 */
export function normalizeSeed(seed: number | string | undefined): number {
  if (typeof seed === 'number') {
    return Math.abs(Math.floor(seed))
  }

  if (typeof seed === 'string') {
    return hashString(seed)
  }

  // Use current timestamp as fallback
  return Date.now() % 2147483647 // Keep within 32-bit range
}

/**
 * Mulberry32 PRNG - Simple, fast, and high-quality seeded random number generator
 * Implementation based on https://stackoverflow.com/a/47593316
 */
export class SeededRandom {
  private state: number
  private originalSeed: number

  constructor(seed: number | string) {
    this.originalSeed = normalizeSeed(seed)
    this.state = this.originalSeed

    // If seed is 0, use a non-zero default to avoid degenerate sequences
    if (this.state === 0) {
      this.state = 1
      this.originalSeed = 1
    }
  }

  /**
   * Generate next random number in range [0, 1)
   */
  next(): number {
    this.state |= 0 // Ensure 32-bit integer
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /**
   * Generate random integer in range [min, max] (inclusive)
   */
  nextInt(min: number, max: number): number {
    if (min > max) {
      throw new Error('min must be <= max')
    }

    return Math.floor(this.next() * (max - min + 1)) + min
  }

  /**
   * Generate random float in range [min, max)
   */
  nextFloat(min: number, max: number): number {
    if (min > max) {
      throw new Error('min must be <= max')
    }

    return this.next() * (max - min) + min
  }

  /**
   * Generate random boolean with optional probability
   */
  nextBoolean(probability = 0.5): boolean {
    return this.next() < probability
  }

  /**
   * Choose random element from array
   */
  choice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot choose from empty array')
    }

    return array[this.nextInt(0, array.length - 1)]
  }

  /**
   * Shuffle array in place using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i)
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  /**
   * Get current internal state (for debugging/reproduction)
   */
  getState(): number {
    return this.state
  }

  /**
   * Set internal state (for restoring saved state)
   */
  setState(state: number): void {
    this.state = state
  }

  /**
   * Reset to initial seed value
   */
  reset(newSeed?: number | string): void {
    if (newSeed !== undefined) {
      this.originalSeed = normalizeSeed(newSeed)
      this.state = this.originalSeed
      if (this.state === 0) {
        this.state = 1
        this.originalSeed = 1
      }
    } else {
      this.state = this.originalSeed
    }
  }
}

/**
 * Create a seeded random function compatible with Math.random()
 */
export function createSeededRandom(seed: number | string): () => number {
  const rng = new SeededRandom(seed)
  return () => rng.next()
}

/**
 * Seed context for managing multiple random generators
 */
export interface SeedContext {
  /** Primary seed value */
  seed: number
  /** Create new seeded random generator */
  createRandom(): SeededRandom
  /** Create seeded random function */
  createRandomFn(): () => number
  /** Create derived seed from string */
  deriveSeed(key: string): number
  /** Reset context with new seed */
  reset(newSeed?: number | string): void
}

/**
 * Create a seed context for managing related random generators
 */
export function createSeedContext(seed?: number | string): SeedContext {
  let currentSeed = normalizeSeed(seed)

  return {
    get seed() {
      return currentSeed
    },

    createRandom(): SeededRandom {
      return new SeededRandom(currentSeed)
    },

    createRandomFn(): () => number {
      return createSeededRandom(currentSeed)
    },

    deriveSeed(key: string): number {
      // Combine current seed with key to create derived seed
      const combined = `${currentSeed}_${key}`
      return hashString(combined)
    },

    reset(newSeed?: number | string): void {
      currentSeed = normalizeSeed(newSeed ?? currentSeed)
    },
  }
}
