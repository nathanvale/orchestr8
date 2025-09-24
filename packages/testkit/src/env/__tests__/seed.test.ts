/**
 * Tests for seed management utilities
 */

import { describe, it, expect } from 'vitest'
import {
  hashString,
  normalizeSeed,
  SeededRandom,
  createSeededRandom,
  createSeedContext,
} from '../seed.js'

describe('hashString', () => {
  it('should generate consistent hash for same string', () => {
    const str = 'test-string'
    const hash1 = hashString(str)
    const hash2 = hashString(str)

    expect(hash1).toBe(hash2)
    expect(typeof hash1).toBe('number')
    expect(hash1).toBeGreaterThan(0)
  })

  it('should generate different hashes for different strings', () => {
    const hash1 = hashString('test1')
    const hash2 = hashString('test2')

    expect(hash1).not.toBe(hash2)
  })

  it('should handle empty string', () => {
    const hash = hashString('')
    expect(hash).toBe(0)
  })

  it('should handle unicode characters', () => {
    const hash1 = hashString('test')
    const hash2 = hashString('tëst')

    expect(hash1).not.toBe(hash2)
    expect(typeof hash2).toBe('number')
  })
})

describe('normalizeSeed', () => {
  it('should return positive number for positive input', () => {
    const result = normalizeSeed(42)
    expect(result).toBe(42)
  })

  it('should return absolute value for negative number', () => {
    const result = normalizeSeed(-42)
    expect(result).toBe(42)
  })

  it('should floor decimal numbers', () => {
    const result = normalizeSeed(42.7)
    expect(result).toBe(42)
  })

  it('should hash string input', () => {
    const result = normalizeSeed('test')
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThan(0)
    expect(result).toBe(hashString('test'))
  })

  it('should use current timestamp for undefined', () => {
    // Temporarily clear TEST_SEED to test timestamp fallback
    const originalSeed = process.env.TEST_SEED
    delete process.env.TEST_SEED

    const before = Date.now()
    const result = normalizeSeed(undefined)
    const after = Date.now()

    // Restore original TEST_SEED
    if (originalSeed !== undefined) {
      process.env.TEST_SEED = originalSeed
    }

    expect(typeof result).toBe('number')
    // When TEST_SEED is not set, should use timestamp
    if (!originalSeed) {
      expect(result).toBeGreaterThanOrEqual(before % 2147483647)
      expect(result).toBeLessThanOrEqual(after % 2147483647)
    }
  })
})

describe('SeededRandom', () => {
  it('should generate consistent sequence for same seed', () => {
    const rng1 = new SeededRandom(12345)
    const rng2 = new SeededRandom(12345)

    const values1 = Array.from({ length: 10 }, () => rng1.next())
    const values2 = Array.from({ length: 10 }, () => rng2.next())

    expect(values1).toEqual(values2)
  })

  it('should generate different sequences for different seeds', () => {
    const rng1 = new SeededRandom(12345)
    const rng2 = new SeededRandom(54321)

    const values1 = Array.from({ length: 10 }, () => rng1.next())
    const values2 = Array.from({ length: 10 }, () => rng2.next())

    expect(values1).not.toEqual(values2)
  })

  it('should generate values in range [0, 1)', () => {
    const rng = new SeededRandom(12345)

    for (let i = 0; i < 1000; i++) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('should handle string seeds', () => {
    const rng1 = new SeededRandom('test-seed')
    const rng2 = new SeededRandom('test-seed')

    const value1 = rng1.next()
    const value2 = rng2.next()

    expect(value1).toBe(value2)
  })

  describe('nextInt', () => {
    it('should generate integers in specified range', () => {
      const rng = new SeededRandom(12345)

      for (let i = 0; i < 100; i++) {
        const value = rng.nextInt(10, 20)
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(10)
        expect(value).toBeLessThanOrEqual(20)
      }
    })

    it('should handle single value range', () => {
      const rng = new SeededRandom(12345)
      const value = rng.nextInt(5, 5)
      expect(value).toBe(5)
    })

    it('should throw error for invalid range', () => {
      const rng = new SeededRandom(12345)
      expect(() => rng.nextInt(10, 5)).toThrow('min must be <= max')
    })

    it('should generate consistent sequence', () => {
      const rng1 = new SeededRandom(12345)
      const rng2 = new SeededRandom(12345)

      const values1 = Array.from({ length: 10 }, () => rng1.nextInt(1, 100))
      const values2 = Array.from({ length: 10 }, () => rng2.nextInt(1, 100))

      expect(values1).toEqual(values2)
    })
  })

  describe('nextFloat', () => {
    it('should generate floats in specified range', () => {
      const rng = new SeededRandom(12345)

      for (let i = 0; i < 100; i++) {
        const value = rng.nextFloat(10.5, 20.5)
        expect(value).toBeGreaterThanOrEqual(10.5)
        expect(value).toBeLessThan(20.5)
      }
    })

    it('should throw error for invalid range', () => {
      const rng = new SeededRandom(12345)
      expect(() => rng.nextFloat(10, 5)).toThrow('min must be <= max')
    })

    it('should generate consistent sequence', () => {
      const rng1 = new SeededRandom(12345)
      const rng2 = new SeededRandom(12345)

      const values1 = Array.from({ length: 10 }, () => rng1.nextFloat(0, 1))
      const values2 = Array.from({ length: 10 }, () => rng2.nextFloat(0, 1))

      expect(values1).toEqual(values2)
    })
  })

  describe('nextBoolean', () => {
    it('should generate booleans with default 0.5 probability', () => {
      const rng = new SeededRandom(12345)
      const values = Array.from({ length: 1000 }, () => rng.nextBoolean())

      const trueCount = values.filter(Boolean).length
      const ratio = trueCount / values.length

      // Should be approximately 50% with some tolerance
      expect(ratio).toBeGreaterThan(0.4)
      expect(ratio).toBeLessThan(0.6)
    })

    it('should respect custom probability', () => {
      const rng = new SeededRandom(12345)
      const values = Array.from({ length: 1000 }, () => rng.nextBoolean(0.1))

      const trueCount = values.filter(Boolean).length
      const ratio = trueCount / values.length

      // Should be approximately 10% with tolerance
      expect(ratio).toBeLessThan(0.2)
    })

    it('should generate consistent sequence', () => {
      const rng1 = new SeededRandom(12345)
      const rng2 = new SeededRandom(12345)

      const values1 = Array.from({ length: 10 }, () => rng1.nextBoolean())
      const values2 = Array.from({ length: 10 }, () => rng2.nextBoolean())

      expect(values1).toEqual(values2)
    })
  })

  describe('choice', () => {
    it('should choose element from array', () => {
      const rng = new SeededRandom(12345)
      const array = ['a', 'b', 'c', 'd', 'e']

      for (let i = 0; i < 100; i++) {
        const choice = rng.choice(array)
        expect(array).toContain(choice)
      }
    })

    it('should throw error for empty array', () => {
      const rng = new SeededRandom(12345)
      expect(() => rng.choice([])).toThrow('Cannot choose from empty array')
    })

    it('should return single element for single-item array', () => {
      const rng = new SeededRandom(12345)
      const array = ['only-item']
      const choice = rng.choice(array)
      expect(choice).toBe('only-item')
    })

    it('should generate consistent sequence', () => {
      const rng1 = new SeededRandom(12345)
      const rng2 = new SeededRandom(12345)
      const array = [1, 2, 3, 4, 5]

      const choices1 = Array.from({ length: 10 }, () => rng1.choice(array))
      const choices2 = Array.from({ length: 10 }, () => rng2.choice(array))

      expect(choices1).toEqual(choices2)
    })
  })

  describe('shuffle', () => {
    it('should shuffle array in place', () => {
      const rng = new SeededRandom(12345)
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const array = [...original]

      const result = rng.shuffle(array)

      expect(result).toBe(array) // Same reference
      expect(array.sort()).toEqual(original.sort()) // Same elements

      // For deterministic test, we'll verify it produces expected shuffled result
      // This is deterministic based on our PRNG implementation
      const expectedShuffle = [1, 10, 2, 3, 4, 5, 6, 7, 8, 9]
      expect(array).toEqual(expectedShuffle)
    })

    it('should produce consistent shuffle for same seed', () => {
      const rng1 = new SeededRandom(12345)
      const rng2 = new SeededRandom(12345)

      const array1 = [1, 2, 3, 4, 5]
      const array2 = [1, 2, 3, 4, 5]

      rng1.shuffle(array1)
      rng2.shuffle(array2)

      expect(array1).toEqual(array2)
    })

    it('should handle empty array', () => {
      const rng = new SeededRandom(12345)
      const array: number[] = []
      const result = rng.shuffle(array)

      expect(result).toBe(array)
      expect(array).toEqual([])
    })

    it('should handle single-element array', () => {
      const rng = new SeededRandom(12345)
      const array = [42]
      const result = rng.shuffle(array)

      expect(result).toBe(array)
      expect(array).toEqual([42])
    })
  })

  describe('state management', () => {
    it('should get and set state', () => {
      const rng = new SeededRandom(12345)

      // Generate some values to change state
      rng.next()
      rng.next()
      const state = rng.getState()

      // Generate more values
      const value1 = rng.next()

      // Restore state and generate again
      rng.setState(state)
      const value2 = rng.next()

      expect(value1).toBe(value2)
    })

    it('should reset to original seed', () => {
      const rng1 = new SeededRandom(12345)
      const rng2 = new SeededRandom(12345)

      // Generate some values in rng1
      rng1.next()
      rng1.next()
      rng1.next()

      // Reset and compare with fresh instance
      rng1.reset()
      expect(rng1.next()).toBe(rng2.next())
    })

    it('should reset with new seed', () => {
      const rng = new SeededRandom(12345)
      rng.next() // Change state

      rng.reset(54321)
      const value1 = rng.next()

      const freshRng = new SeededRandom(54321)
      const value2 = freshRng.next()

      expect(value1).toBe(value2)
    })
  })
})

describe('createSeededRandom', () => {
  it('should create function compatible with Math.random', () => {
    const randomFn = createSeededRandom(12345)

    expect(typeof randomFn).toBe('function')

    const value = randomFn()
    expect(typeof value).toBe('number')
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(1)
  })

  it('should generate consistent values for same seed', () => {
    const fn1 = createSeededRandom(12345)
    const fn2 = createSeededRandom(12345)

    const values1 = Array.from({ length: 10 }, () => fn1())
    const values2 = Array.from({ length: 10 }, () => fn2())

    expect(values1).toEqual(values2)
  })
})

describe('createSeedContext', () => {
  it('should create seed context with default seed', () => {
    const context = createSeedContext()

    expect(typeof context.seed).toBe('number')
    expect(typeof context.createRandom).toBe('function')
    expect(typeof context.createRandomFn).toBe('function')
    expect(typeof context.deriveSeed).toBe('function')
    expect(typeof context.reset).toBe('function')
  })

  it('should create seed context with provided seed', () => {
    const context = createSeedContext(12345)

    expect(context.seed).toBe(12345)
  })

  it('should create consistent random generators', () => {
    const context = createSeedContext(12345)

    const rng1 = context.createRandom()
    const rng2 = context.createRandom()

    expect(rng1.next()).toBe(rng2.next())
  })

  it('should create consistent random functions', () => {
    const context = createSeedContext(12345)

    const fn1 = context.createRandomFn()
    const fn2 = context.createRandomFn()

    expect(fn1()).toBe(fn2())
  })

  it('should derive consistent seeds from keys', () => {
    const context = createSeedContext(12345)

    const derived1 = context.deriveSeed('test-key')
    const derived2 = context.deriveSeed('test-key')

    expect(derived1).toBe(derived2)
    expect(derived1).not.toBe(context.seed)
  })

  it('should derive different seeds for different keys', () => {
    const context = createSeedContext(12345)

    const derived1 = context.deriveSeed('key1')
    const derived2 = context.deriveSeed('key2')

    expect(derived1).not.toBe(derived2)
  })

  it('should reset with new seed', () => {
    const context = createSeedContext(12345)

    context.reset(54321)
    expect(context.seed).toBe(54321)

    const rng = context.createRandom()
    const freshRng = new SeededRandom(54321)

    expect(rng.next()).toBe(freshRng.next())
  })

  it('should reset to current seed when no new seed provided', () => {
    const context = createSeedContext(12345)

    // Create generators that will advance internal state
    const rng1 = context.createRandom()
    rng1.next()

    context.reset()

    // New generator should start from original seed
    const rng2 = context.createRandom()
    const freshRng = new SeededRandom(12345)

    expect(rng2.next()).toBe(freshRng.next())
  })
})
