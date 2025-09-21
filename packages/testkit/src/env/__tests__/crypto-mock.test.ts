/**
 * Tests for crypto mocking utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createCryptoMocker,
  cryptoMocks,
  generateUUIDFromSeed,
  createSequentialUUID,
  setupCryptoControl,
  getGlobalCryptoController,
  type UUID,
} from '../crypto-mock.js'
import { SeededRandom } from '../seed.js'

describe('crypto-mock', () => {
  describe('generateUUIDFromSeed', () => {
    it('should generate valid UUID v4 format', () => {
      const uuid = generateUUIDFromSeed(12345)
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('should generate deterministic UUIDs from same seed', () => {
      const uuid1 = generateUUIDFromSeed(12345)
      const uuid2 = generateUUIDFromSeed(12345)
      expect(uuid1).toBe(uuid2)
    })

    it('should generate different UUIDs from different seeds', () => {
      const uuid1 = generateUUIDFromSeed(12345)
      const uuid2 = generateUUIDFromSeed(54321)
      expect(uuid1).not.toBe(uuid2)
    })

    it('should handle string seeds', () => {
      const uuid1 = generateUUIDFromSeed('test-seed')
      const uuid2 = generateUUIDFromSeed('test-seed')
      const uuid3 = generateUUIDFromSeed('different-seed')

      expect(uuid1).toBe(uuid2)
      expect(uuid1).not.toBe(uuid3)
    })

    it('should have correct version and variant bits', () => {
      const uuid = generateUUIDFromSeed(12345)
      const parts = uuid.split('-')

      // Version 4 in the 13th hex character
      expect(parts[2][0]).toBe('4')

      // Variant bits (8, 9, a, or b) in the 17th hex character
      expect(parts[3][0]).toMatch(/[89ab]/i)
    })
  })

  describe('createSequentialUUID', () => {
    it('should generate sequential UUIDs', () => {
      const generator = createSequentialUUID()
      const uuid1 = generator()
      const uuid2 = generator()
      const uuid3 = generator()

      expect(uuid1).toMatch(/^00000000-0000-4000-8000-000000000001$/)
      expect(uuid2).toMatch(/^00000000-0000-4000-8000-000000000002$/)
      expect(uuid3).toMatch(/^00000000-0000-4000-8000-000000000003$/)
    })

    it('should use custom prefix', () => {
      const generator = createSequentialUUID('deadbeef')
      const uuid = generator()
      expect(uuid.startsWith('deadbeef')).toBe(true)
    })

    it('should handle many sequential calls', () => {
      const generator = createSequentialUUID()
      const uuids = new Set<string>()

      for (let i = 0; i < 100; i++) {
        const uuid = generator()
        expect(uuids.has(uuid)).toBe(false)
        uuids.add(uuid)
      }

      expect(uuids.size).toBe(100)
    })
  })

  describe('CryptoMocker', () => {
    let mocker: ReturnType<typeof createCryptoMocker>

    beforeEach(() => {
      mocker = createCryptoMocker()
    })

    afterEach(() => {
      mocker.restore()
    })

    describe('mockUUID', () => {
      it('should mock crypto.randomUUID with sequence', () => {
        const sequence = [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
          '550e8400-e29b-41d4-a716-446655440003',
        ] as UUID[]

        mocker.mockUUID(sequence)

        expect(crypto.randomUUID()).toBe(sequence[0])
        expect(crypto.randomUUID()).toBe(sequence[1])
        expect(crypto.randomUUID()).toBe(sequence[2])
        expect(crypto.randomUUID()).toBe(sequence[0]) // Cycles back
      })

      it('should validate UUID format', () => {
        expect(() => {
          mocker.mockUUID(['invalid-uuid'])
        }).toThrow('Invalid UUID v4 format')
      })

      it('should reject empty sequence', () => {
        expect(() => {
          mocker.mockUUID([])
        }).toThrow('UUID sequence cannot be empty')
      })

      it('should restore original function', () => {
        const original = crypto.randomUUID
        const restore = mocker.mockUUID(['550e8400-e29b-41d4-a716-446655440001'])

        expect(crypto.randomUUID).not.toBe(original)
        restore()
        expect(crypto.randomUUID).toBe(original)
      })
    })

    describe('mockUUIDGenerator', () => {
      it('should mock with custom generator', () => {
        let counter = 0
        const generator = (): UUID => {
          counter++
          return `00000000-0000-4000-8000-${counter.toString().padStart(12, '0')}` as UUID
        }

        mocker.mockUUIDGenerator(generator)

        expect(crypto.randomUUID()).toBe('00000000-0000-4000-8000-000000000001')
        expect(crypto.randomUUID()).toBe('00000000-0000-4000-8000-000000000002')
        expect(crypto.randomUUID()).toBe('00000000-0000-4000-8000-000000000003')
      })
    })

    describe('mockRandomValues', () => {
      it('should mock with incrementing pattern', () => {
        mocker.mockRandomValues()

        const array = new Uint8Array(10)
        crypto.getRandomValues(array)

        expect(Array.from(array)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      })

      it('should mock with custom pattern', () => {
        mocker.mockRandomValues([42, 100, 255])

        const array = new Uint8Array(6)
        crypto.getRandomValues(array)

        expect(Array.from(array)).toEqual([42, 100, 255, 42, 100, 255])
      })

      it('should mock with SeededRandom', () => {
        const rng = new SeededRandom(12345)
        mocker.mockRandomValues(rng)

        const array1 = new Uint8Array(5)
        crypto.getRandomValues(array1)

        const rng2 = new SeededRandom(12345)
        const expected = Array.from({ length: 5 }, () => rng2.nextInt(0, 255))

        expect(Array.from(array1)).toEqual(expected)
      })

      it('should handle different typed arrays', () => {
        mocker.mockRandomValues([1, 2, 3])

        const uint8 = new Uint8Array(3)
        const uint16 = new Uint16Array(3)
        const uint32 = new Uint32Array(3)

        crypto.getRandomValues(uint8)
        crypto.getRandomValues(uint16)
        crypto.getRandomValues(uint32)

        // All should be filled with the pattern
        expect(Array.from(uint8)).toEqual([1, 2, 3])
      })

      it('should handle null input gracefully', () => {
        mocker.mockRandomValues()
        const result = crypto.getRandomValues(null as any)
        expect(result).toBe(null)
      })
    })

    describe('deterministicUUID', () => {
      it('should generate deterministic UUID', () => {
        const uuid1 = mocker.deterministicUUID(12345)
        const uuid2 = mocker.deterministicUUID(12345)

        expect(uuid1).toBe(uuid2)
        expect(uuid1).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        )
      })
    })

    describe('sequentialUUID', () => {
      it('should create sequential generator', () => {
        const generator = mocker.sequentialUUID('test')
        const uuid1 = generator()
        const uuid2 = generator()

        expect(uuid1).not.toBe(uuid2)
        expect(uuid1.startsWith('test')).toBe(true)
      })
    })

    describe('restore', () => {
      it('should restore all mocked functions', () => {
        const originalUUID = crypto.randomUUID
        const originalRandom = crypto.getRandomValues

        mocker.mockUUID(['550e8400-e29b-41d4-a716-446655440001'])
        mocker.mockRandomValues([1, 2, 3])

        expect(crypto.randomUUID).not.toBe(originalUUID)
        expect(crypto.getRandomValues).not.toBe(originalRandom)

        mocker.restore()

        expect(crypto.randomUUID).toBe(originalUUID)
        expect(crypto.getRandomValues).toBe(originalRandom)
      })

      it('should clear restore functions', () => {
        mocker.mockUUID(['550e8400-e29b-41d4-a716-446655440001'])
        mocker.restore()

        // Should not throw when restoring again
        expect(() => mocker.restore()).not.toThrow()
      })
    })
  })

  describe('cryptoMocks helpers', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    describe('mockRandomUUID', () => {
      it('should provide quick UUID mocking', () => {
        const restore = cryptoMocks.mockRandomUUID([
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
        ])

        expect(crypto.randomUUID()).toBe('550e8400-e29b-41d4-a716-446655440001')
        expect(crypto.randomUUID()).toBe('550e8400-e29b-41d4-a716-446655440002')

        restore()
      })
    })

    describe('mockSequentialUUID', () => {
      it('should provide quick sequential UUID mocking', () => {
        const restore = cryptoMocks.mockSequentialUUID('abcd')

        const uuid1 = crypto.randomUUID()
        const uuid2 = crypto.randomUUID()

        expect(uuid1.startsWith('abcd')).toBe(true)
        expect(uuid2.startsWith('abcd')).toBe(true)
        expect(uuid1).not.toBe(uuid2)

        restore()
      })
    })

    describe('mockSeededUUID', () => {
      it('should provide seeded UUID generation', () => {
        const restore = cryptoMocks.mockSeededUUID(12345)

        const uuid1 = crypto.randomUUID()
        const uuid2 = crypto.randomUUID()
        const uuid3 = crypto.randomUUID()

        // Should be different (advancing internal state)
        expect(uuid1).not.toBe(uuid2)
        expect(uuid2).not.toBe(uuid3)

        // All should be valid UUIDs
        expect(uuid1).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        )

        restore()
      })
    })

    describe('mockGetRandomValues', () => {
      it('should provide quick random values mocking', () => {
        const restore = cryptoMocks.mockGetRandomValues([10, 20, 30])

        const array = new Uint8Array(6)
        crypto.getRandomValues(array)

        expect(Array.from(array)).toEqual([10, 20, 30, 10, 20, 30])

        restore()
      })
    })
  })

  describe('setupCryptoControl', () => {
    afterEach(() => {
      const controller = getGlobalCryptoController()
      controller.restore()
    })

    it('should setup crypto mocking with seed', () => {
      const controller = setupCryptoControl(12345)

      // Should mock both UUID and random values
      const uuid1 = crypto.randomUUID()
      const uuid2 = crypto.randomUUID()

      expect(uuid1).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(uuid1).not.toBe(uuid2) // Different due to advancing state

      const array = new Uint8Array(5)
      crypto.getRandomValues(array)

      // Should be filled with deterministic values
      expect(Array.from(array).every((v) => v >= 0 && v <= 255)).toBe(true)

      controller.restore()
    })

    it('should work without seed', () => {
      const controller = setupCryptoControl()

      // Should not throw
      expect(() => {
        controller.mockUUID(['550e8400-e29b-41d4-a716-446655440001'])
      }).not.toThrow()

      controller.restore()
    })
  })

  describe('Integration tests', () => {
    it('should work with multiple mockers', () => {
      const mocker1 = createCryptoMocker()
      const mocker2 = createCryptoMocker()

      const restore1 = mocker1.mockUUID(['550e8400-e29b-41d4-a716-446655440001'])
      expect(crypto.randomUUID()).toBe('550e8400-e29b-41d4-a716-446655440001')
      restore1()

      const restore2 = mocker2.mockUUID(['650e8400-e29b-41d4-a716-446655440002'])
      expect(crypto.randomUUID()).toBe('650e8400-e29b-41d4-a716-446655440002')
      restore2()

      mocker1.restore()
      mocker2.restore()
    })

    it('should handle complex mocking scenarios', () => {
      const mocker = createCryptoMocker()

      // Mock multiple functions
      mocker.mockUUID(['550e8400-e29b-41d4-a716-446655440001'])
      mocker.mockRandomValues([42])

      // Use mocked functions
      expect(crypto.randomUUID()).toBe('550e8400-e29b-41d4-a716-446655440001')

      const array = new Uint8Array(3)
      crypto.getRandomValues(array)
      expect(Array.from(array)).toEqual([42, 42, 42])

      // Restore everything
      mocker.restore()
    })
  })
})
