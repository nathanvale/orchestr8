/**
 * Core random control utilities for deterministic testing
 * Provides Math.random replacement, sequence mocking, and restoration
 */

import { vi } from 'vitest'
import {
  SeededRandom,
  createSeededRandom,
  normalizeSeed,
  createSeedContext,
  type SeedContext,
} from './seed.js'

/**
 * Random context interface for controlling randomness
 */
export interface RandomContext {
  /** Set new seed value */
  seed(value: number | string): void
  /** Reset to current seed */
  reset(): void
  /** Get next random value [0, 1) */
  next(): number
  /** Get random integer in range [min, max] */
  nextInt(min: number, max: number): number
  /** Get random float in range [min, max) */
  nextFloat(min: number, max: number): number
  /** Get random boolean */
  nextBoolean(probability?: number): boolean
  /** Choose random element from array */
  choice<T>(array: T[]): T
  /** Shuffle array in place */
  shuffle<T>(array: T[]): T[]
  /** Restore original Math.random */
  restore(): void
  /** Get current seed value */
  getSeed(): number
  /** Get underlying SeededRandom instance */
  getGenerator(): SeededRandom
}

/**
 * Random mocker for simple value/sequence mocking
 */
export interface RandomMocker {
  /** Mock Math.random to return fixed value */
  mockValue(value: number): () => void
  /** Mock Math.random to return sequence of values */
  mockSequence(values: number[]): () => void
  /** Mock Math.random with custom implementation */
  mockImplementation(fn: () => number): () => void
  /** Restore original Math.random */
  restore(): void
}

/**
 * Create a random context with deterministic control
 */
export function controlRandomness(seed?: number | string): RandomContext {
  const originalRandom = Math.random
  let currentSeed = normalizeSeed(seed)
  let generator = new SeededRandom(currentSeed)

  // Replace Math.random with seeded version
  Math.random = () => generator.next()

  return {
    seed(value: number | string): void {
      currentSeed = normalizeSeed(value)
      generator = new SeededRandom(currentSeed)
      Math.random = () => generator.next()
    },

    reset(): void {
      generator = new SeededRandom(currentSeed)
      Math.random = () => generator.next()
    },

    next(): number {
      return generator.next()
    },

    nextInt(min: number, max: number): number {
      return generator.nextInt(min, max)
    },

    nextFloat(min: number, max: number): number {
      return generator.nextFloat(min, max)
    },

    nextBoolean(probability = 0.5): boolean {
      return generator.nextBoolean(probability)
    },

    choice<T>(array: T[]): T {
      return generator.choice(array)
    },

    shuffle<T>(array: T[]): T[] {
      return generator.shuffle(array)
    },

    restore(): void {
      Math.random = originalRandom
    },

    getSeed(): number {
      return currentSeed
    },

    getGenerator(): SeededRandom {
      return generator
    },
  }
}

/**
 * Create a random mocker for simple mocking scenarios
 */
export function createRandomMocker(): RandomMocker {
  const originalRandom = Math.random
  let restoreFn: (() => void) | null = null

  return {
    mockValue(value: number): () => void {
      if (restoreFn) {
        restoreFn()
      }

      const spy = vi.spyOn(Math, 'random').mockReturnValue(value)
      restoreFn = () => spy.mockRestore()

      return restoreFn
    },

    mockSequence(values: number[]): () => void {
      if (restoreFn) {
        restoreFn()
      }

      let index = 0
      const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
        const value = values[index % values.length]
        index++
        return value
      })

      restoreFn = () => spy.mockRestore()
      return restoreFn
    },

    mockImplementation(fn: () => number): () => void {
      if (restoreFn) {
        restoreFn()
      }

      const spy = vi.spyOn(Math, 'random').mockImplementation(fn)
      restoreFn = () => spy.mockRestore()

      return restoreFn
    },

    restore(): void {
      if (restoreFn) {
        restoreFn()
        restoreFn = null
      } else {
        Math.random = originalRandom
      }
    },
  }
}

/**
 * Random helpers for quick setup patterns
 */
export const randomHelpers = {
  /**
   * Mock Math.random to return fixed value
   */
  mockRandom(value = 0.5): () => void {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(value)
    return () => spy.mockRestore()
  },

  /**
   * Mock Math.random to return sequence of values
   */
  mockRandomSequence(values: number[]): () => void {
    let index = 0
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      const value = values[index % values.length]
      index++
      return value
    })
    return () => spy.mockRestore()
  },

  /**
   * Create seeded random generator without replacing Math.random
   */
  createSeededRandom,

  /**
   * Create seed context for managing multiple generators
   */
  createSeedContext,

  /**
   * Control Math.random with deterministic values
   */
  controlRandomness,

  /**
   * Create random mocker instance
   */
  createMocker: createRandomMocker,
}

/**
 * Global random controller for convenient access
 */
let globalController: RandomContext | null = null

/**
 * Get or create global random controller
 */
export function getGlobalRandomController(seed?: number | string): RandomContext {
  if (!globalController) {
    globalController = controlRandomness(seed)
  }
  return globalController
}

/**
 * Setup automatic random control with test lifecycle management
 */
export function setupRandomControl(seed?: number | string): RandomContext {
  const controller = getGlobalRandomController(seed)

  // Reset before each test
  if (typeof beforeEach !== 'undefined') {
    beforeEach(() => {
      controller.reset()
    })
  }

  // Restore after all tests
  if (typeof afterAll !== 'undefined') {
    afterAll(() => {
      controller.restore()
      globalController = null
    })
  }

  return controller
}

/**
 * Quick helpers for common randomization scenarios
 */
export const quickRandom = {
  /**
   * Mock Math.random for predictable values
   */
  predictable: (seed = 12345) => {
    return controlRandomness(seed)
  },

  /**
   * Mock Math.random with fixed sequence
   */
  sequence: (values: number[]) => {
    const mocker = createRandomMocker()
    return mocker.mockSequence(values)
  },

  /**
   * Mock Math.random with single value
   */
  fixed: (value = 0.5) => {
    const mocker = createRandomMocker()
    return mocker.mockValue(value)
  },

  /**
   * Create deterministic test environment
   */
  deterministic: (seed?: number | string) => {
    return setupRandomControl(seed)
  },

  /**
   * Restore all random mocking
   */
  restore: () => {
    if (globalController) {
      globalController.restore()
      globalController = null
    }
    vi.restoreAllMocks()
  },
}

// Export types and classes
export { SeededRandom, createSeedContext, normalizeSeed }
export type { SeedContext }
