/**
 * Tests for random control utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  controlRandomness,
  createRandomMocker,
  randomHelpers,
  getGlobalRandomController,
  setupRandomControl,
  quickRandom,
} from '../random.js'

describe('controlRandomness', () => {
  let originalRandom: () => number

  beforeEach(() => {
    originalRandom = Math.random
  })

  afterEach(() => {
    Math.random = originalRandom
  })

  it('should replace Math.random with deterministic version', () => {
    const controller = controlRandomness(12345)

    // Math.random should now be deterministic
    const value1 = Math.random()
    const value2 = Math.random()

    // Reset and check for same sequence
    controller.reset()
    expect(Math.random()).toBe(value1)
    expect(Math.random()).toBe(value2)

    controller.restore()
  })

  it('should generate consistent sequence for same seed', () => {
    const controller1 = controlRandomness(12345)
    const values1 = Array.from({ length: 10 }, () => controller1.next())
    controller1.restore()

    const controller2 = controlRandomness(12345)
    const values2 = Array.from({ length: 10 }, () => controller2.next())
    controller2.restore()

    expect(values1).toEqual(values2)
  })

  it('should change seed and produce different sequence', () => {
    const controller = controlRandomness(12345)

    const values1 = Array.from({ length: 5 }, () => controller.next())

    controller.seed(54321)
    const values2 = Array.from({ length: 5 }, () => controller.next())

    expect(values1).not.toEqual(values2)

    controller.restore()
  })

  it('should reset to current seed', () => {
    const controller = controlRandomness(12345)

    const firstValue = controller.next()
    controller.next() // Advance state

    controller.reset()
    expect(controller.next()).toBe(firstValue)

    controller.restore()
  })

  it('should provide utility methods', () => {
    const controller = controlRandomness(12345)

    expect(typeof controller.nextInt(1, 10)).toBe('number')
    expect(typeof controller.nextFloat(1, 10)).toBe('number')
    expect(typeof controller.nextBoolean()).toBe('boolean')

    const array = [1, 2, 3, 4, 5]
    expect(array).toContain(controller.choice(array))

    const shuffled = controller.shuffle([...array])
    expect(shuffled.sort()).toEqual(array.sort())

    controller.restore()
  })

  it('should restore original Math.random', () => {
    const controller = controlRandomness(12345)

    // Verify Math.random is replaced
    expect(Math.random).not.toBe(originalRandom)

    controller.restore()

    // Verify Math.random is restored
    expect(Math.random).toBe(originalRandom)
  })

  it('should provide access to current seed and generator', () => {
    const controller = controlRandomness(12345)

    expect(controller.getSeed()).toBe(12345)
    expect(controller.getGenerator()).toBeDefined()

    controller.restore()
  })

  it('should handle string seeds', () => {
    const controller = controlRandomness('test-seed')

    expect(typeof controller.getSeed()).toBe('number')
    expect(controller.getSeed()).toBeGreaterThan(0)

    controller.restore()
  })
})

describe('createRandomMocker', () => {
  let originalRandom: () => number

  beforeEach(() => {
    originalRandom = Math.random
  })

  afterEach(() => {
    Math.random = originalRandom
    vi.restoreAllMocks()
  })

  it('should mock single value', () => {
    const mocker = createRandomMocker()
    const restore = mocker.mockValue(0.42)

    expect(Math.random()).toBe(0.42)
    expect(Math.random()).toBe(0.42)

    restore()
    expect(Math.random).toBe(originalRandom)
  })

  it('should mock sequence of values', () => {
    const mocker = createRandomMocker()
    const values = [0.1, 0.2, 0.3]
    const restore = mocker.mockSequence(values)

    expect(Math.random()).toBe(0.1)
    expect(Math.random()).toBe(0.2)
    expect(Math.random()).toBe(0.3)
    expect(Math.random()).toBe(0.1) // Cycles

    restore()
    expect(Math.random).toBe(originalRandom)
  })

  it('should mock with custom implementation', () => {
    const mocker = createRandomMocker()
    let counter = 0
    const restore = mocker.mockImplementation(() => {
      return ++counter * 0.1
    })

    expect(Math.random()).toBeCloseTo(0.1, 10)
    expect(Math.random()).toBeCloseTo(0.2, 10)
    expect(Math.random()).toBeCloseTo(0.3, 10)

    restore()
    expect(Math.random).toBe(originalRandom)
  })

  it('should replace existing mock when new one is set', () => {
    const mocker = createRandomMocker()

    mocker.mockValue(0.1)
    expect(Math.random()).toBe(0.1)

    mocker.mockValue(0.2)
    expect(Math.random()).toBe(0.2)

    mocker.restore()
  })

  it('should restore properly', () => {
    const mocker = createRandomMocker()

    mocker.mockValue(0.5)
    expect(Math.random()).toBe(0.5)

    mocker.restore()
    expect(Math.random).toBe(originalRandom)
  })
})

describe('randomHelpers', () => {
  let originalRandom: () => number

  beforeEach(() => {
    originalRandom = Math.random
  })

  afterEach(() => {
    Math.random = originalRandom
    vi.restoreAllMocks()
  })

  it('should mock random with default value', () => {
    const restore = randomHelpers.mockRandom()

    expect(Math.random()).toBe(0.5)

    restore()
  })

  it('should mock random with custom value', () => {
    const restore = randomHelpers.mockRandom(0.42)

    expect(Math.random()).toBe(0.42)

    restore()
  })

  it('should mock random sequence', () => {
    const values = [0.1, 0.2, 0.3]
    const restore = randomHelpers.mockRandomSequence(values)

    expect(Math.random()).toBe(0.1)
    expect(Math.random()).toBe(0.2)
    expect(Math.random()).toBe(0.3)
    expect(Math.random()).toBe(0.1) // Cycles

    restore()
  })

  it('should provide access to control functions', () => {
    expect(typeof randomHelpers.controlRandomness).toBe('function')
    expect(typeof randomHelpers.createSeededRandom).toBe('function')
    expect(typeof randomHelpers.createSeedContext).toBe('function')
    expect(typeof randomHelpers.createMocker).toBe('function')
  })
})

describe('getGlobalRandomController', () => {
  afterEach(() => {
    quickRandom.restore()
  })

  it('should create global controller on first call', () => {
    const controller1 = getGlobalRandomController(12345)
    const controller2 = getGlobalRandomController()

    expect(controller1).toBe(controller2)
  })

  it('should use provided seed on first call', () => {
    const controller = getGlobalRandomController(12345)

    expect(controller.getSeed()).toBe(12345)
  })
})

describe('setupRandomControl', () => {
  afterEach(() => {
    quickRandom.restore()
  })

  it('should setup automatic lifecycle management', () => {
    const controller = setupRandomControl(12345)

    expect(controller).toBeDefined()
    expect(controller.getSeed()).toBe(12345)
  })

  it('should use global controller', () => {
    const controller1 = setupRandomControl(12345)
    const controller2 = getGlobalRandomController()

    expect(controller1).toBe(controller2)
  })
})

describe('quickRandom', () => {
  let originalRandom: () => number

  beforeEach(() => {
    originalRandom = Math.random
  })

  afterEach(() => {
    Math.random = originalRandom
    quickRandom.restore()
  })

  it('should create predictable random', () => {
    const controller = quickRandom.predictable(12345)

    expect(controller.getSeed()).toBe(12345)

    const value1 = Math.random()
    controller.reset()
    expect(Math.random()).toBe(value1)
  })

  it('should create sequence mock', () => {
    const values = [0.1, 0.2, 0.3]
    const restore = quickRandom.sequence(values)

    expect(Math.random()).toBe(0.1)
    expect(Math.random()).toBe(0.2)
    expect(Math.random()).toBe(0.3)
    expect(Math.random()).toBe(0.1) // Cycles

    restore()
  })

  it('should create fixed value mock', () => {
    const restore = quickRandom.fixed(0.42)

    expect(Math.random()).toBe(0.42)
    expect(Math.random()).toBe(0.42)

    restore()
  })

  it('should create fixed value with default', () => {
    const restore = quickRandom.fixed()

    expect(Math.random()).toBe(0.5)

    restore()
  })

  it('should create deterministic environment', () => {
    const controller = quickRandom.deterministic(12345)

    expect(controller.getSeed()).toBe(12345)
  })

  it('should restore all mocking', () => {
    // Set up multiple mocks
    quickRandom.predictable(12345)
    quickRandom.sequence([0.1, 0.2])

    // Verify something is mocked
    expect(Math.random).not.toBe(originalRandom)

    quickRandom.restore()

    // Verify everything is restored
    expect(Math.random).toBe(originalRandom)
  })
})

describe('Math.random integration', () => {
  let originalRandom: () => number

  beforeEach(() => {
    originalRandom = Math.random
  })

  afterEach(() => {
    Math.random = originalRandom
    vi.restoreAllMocks()
  })

  it('should work with existing code that uses Math.random', () => {
    const controller = controlRandomness(12345)

    // Simulate existing code that uses Math.random
    function generateRandomArray(length: number): number[] {
      return Array.from({ length }, () => Math.random())
    }

    const array1 = generateRandomArray(5)

    controller.reset()
    const array2 = generateRandomArray(5)

    expect(array1).toEqual(array2)

    controller.restore()
  })

  it('should work with libraries that use Math.random', () => {
    const controller = controlRandomness(42)

    // Simulate library code
    function shuffle<T>(array: T[]): T[] {
      const result = [...array]
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
      }
      return result
    }

    const original = [1, 2, 3, 4, 5]
    const shuffled1 = shuffle(original)

    controller.reset()
    const shuffled2 = shuffle(original)

    expect(shuffled1).toEqual(shuffled2)

    controller.restore()
  })

  it('should maintain determinism across test boundaries', () => {
    // First test scenario
    const controller1 = controlRandomness(12345)
    const values1 = [Math.random(), Math.random(), Math.random()]
    controller1.restore()

    // Second test scenario (fresh start)
    const controller2 = controlRandomness(12345)
    const values2 = [Math.random(), Math.random(), Math.random()]
    controller2.restore()

    expect(values1).toEqual(values2)
  })
})

describe('error handling', () => {
  afterEach(() => {
    quickRandom.restore()
  })

  it('should handle edge cases gracefully', () => {
    const controller = controlRandomness(0) // Edge case: zero seed

    expect(typeof controller.next()).toBe('number')
    expect(controller.getSeed()).toBe(0)

    controller.restore()
  })

  it('should handle very large seeds', () => {
    const largeSeed = Number.MAX_SAFE_INTEGER
    const controller = controlRandomness(largeSeed)

    expect(typeof controller.next()).toBe('number')
    expect(controller.getSeed()).toBe(largeSeed)

    controller.restore()
  })

  it('should handle negative seeds', () => {
    const controller = controlRandomness(-12345)

    expect(controller.getSeed()).toBe(12345) // Should be normalized to positive
    expect(typeof controller.next()).toBe('number')

    controller.restore()
  })
})
