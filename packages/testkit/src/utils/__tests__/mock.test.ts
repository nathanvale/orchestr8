/**
 * Tests for createMockFn utility function
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createMockFn } from '../index'

describe('createMockFn', () => {
  // Store original vi to restore after tests
  let originalVi: unknown
  let hasOriginalVi = false

  beforeEach(() => {
    // Store original vi if it exists
    if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
      originalVi = (globalThis as any).vi
      hasOriginalVi = true
    }
  })

  afterEach(() => {
    // Restore original vi
    if (hasOriginalVi) {
      ;(globalThis as any).vi = originalVi
    } else {
      // Remove vi if it didn't exist originally
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }
    }
  })

  describe('vitest detection when vi is available', () => {
    it('should use vitest mock when vi.fn is available', () => {
      const mockFn = vi.fn() // Create a mock function reference
      const vitestMock = {
        fn: vi.fn().mockReturnValue(mockFn),
      }

      // Set up global vi
      ;(globalThis as any).vi = vitestMock

      const implementation = (x: number) => x * 2
      const result = createMockFn(implementation)

      expect(vitestMock.fn).toHaveBeenCalledWith(implementation)
      expect(result).toBe(mockFn)
    })

    it('should use vitest mock when vi.fn is available without implementation', () => {
      const mockFn = vi.fn()
      const vitestMock = {
        fn: vi.fn().mockReturnValue(mockFn),
      }

      ;(globalThis as any).vi = vitestMock

      const result = createMockFn()

      expect(vitestMock.fn).toHaveBeenCalledWith(undefined)
      expect(result).toBe(mockFn)
    })

    it('should fallback when vi exists but fn is not available', () => {
      ;(globalThis as any).vi = {} // vi exists but no fn method

      const mockFn = createMockFn((x: number) => x + 1)

      // Should be our fallback implementation
      expect(typeof mockFn).toBe('function')
      expect(mockFn).toHaveProperty('calls')
      expect(mockFn).toHaveProperty('results')
      expect(mockFn).toHaveProperty('mockClear')
    })

    it('should fallback when vi.fn is not a function', () => {
      ;(globalThis as any).vi = { fn: 'not a function' }

      const mockFn = createMockFn((x: string) => x.toUpperCase())

      // Should be our fallback implementation
      expect(typeof mockFn).toBe('function')
      expect(mockFn).toHaveProperty('calls')
      expect(mockFn).toHaveProperty('results')
    })
  })

  describe('fallback implementation when vi is not available', () => {
    beforeEach(() => {
      // Ensure vi is not available
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }
    })

    it('should create fallback mock when vi is not available', () => {
      const mockFn = createMockFn((x: number) => x * 3)

      expect(typeof mockFn).toBe('function')
      expect(mockFn).toHaveProperty('calls')
      expect(mockFn).toHaveProperty('results')
      expect(mockFn).toHaveProperty('mockClear')
      expect(mockFn).toHaveProperty('mockReset')
      expect(mockFn).toHaveProperty('mockRestore')
    })

    it('should create fallback mock without implementation', () => {
      const mockFn = createMockFn<[number], string>()

      expect(typeof mockFn).toBe('function')
      expect(mockFn).toHaveProperty('calls')
      expect(mockFn).toHaveProperty('results')
    })

    it('should work when globalThis is undefined', () => {
      // Test with no vi property at all (simulating environments without globalThis.vi)
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn((x: number) => x + 5)

      expect(typeof mockFn).toBe('function')
      expect(mockFn).toHaveProperty('calls')

      const result = mockFn(10)
      expect(result).toBe(15)
      expect(mockFn.calls[0]).toEqual([10])
    })
  })

  describe('mock call tracking', () => {
    it('should track function calls with arguments', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn((x: number, y: string) => `${y}: ${x}`)

      mockFn(42, 'answer')
      mockFn(100, 'percentage')

      expect(mockFn.calls).toHaveLength(2)
      expect(mockFn.calls[0]).toEqual([42, 'answer'])
      expect(mockFn.calls[1]).toEqual([100, 'percentage'])
    })

    it('should track function results', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn((x: number) => x * x)

      const result1 = mockFn(3)
      const result2 = mockFn(4)

      expect(result1).toBe(9)
      expect(result2).toBe(16)
      expect(mockFn.results).toEqual([9, 16])
    })

    it('should track calls with no arguments', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn(() => 'constant')

      mockFn()
      mockFn()

      expect(mockFn.calls).toHaveLength(2)
      expect(mockFn.calls[0]).toEqual([])
      expect(mockFn.calls[1]).toEqual([])
      expect(mockFn.results).toEqual(['constant', 'constant'])
    })

    it('should track calls with multiple argument types', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn((a: number, b: string, c: boolean, d: object) => ({ a, b, c, d }))

      const obj = { test: true }
      const result = mockFn(1, 'hello', false, obj)

      expect(mockFn.calls[0]).toEqual([1, 'hello', false, obj])
      expect(result).toEqual({ a: 1, b: 'hello', c: false, d: obj })
      expect(mockFn.results[0]).toEqual({ a: 1, b: 'hello', c: false, d: obj })
    })
  })

  describe('mockClear functionality', () => {
    it('should clear calls and results arrays', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn((x: number) => x + 1)

      // Add some calls
      mockFn(1)
      mockFn(2)
      mockFn(3)

      expect(mockFn.calls).toHaveLength(3)
      expect(mockFn.results).toHaveLength(3)

      // Clear the mock
      mockFn.mockClear()

      expect(mockFn.calls).toHaveLength(0)
      expect(mockFn.results).toHaveLength(0)
    })

    it('should allow new calls after clearing', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn((x: string) => x.toLowerCase())

      mockFn('HELLO')
      mockFn.mockClear()

      mockFn('WORLD')

      expect(mockFn.calls).toHaveLength(1)
      expect(mockFn.calls[0]).toEqual(['WORLD'])
      expect(mockFn.results[0]).toBe('world')
    })

    it('should clear empty arrays', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn((x: number) => x)

      // Clear without any calls
      mockFn.mockClear()

      expect(mockFn.calls).toHaveLength(0)
      expect(mockFn.results).toHaveLength(0)
    })
  })

  describe('mockReset functionality', () => {
    it('should reset calls and results arrays', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn((x: number) => x * 2)

      // Add some calls
      mockFn(5)
      mockFn(10)

      expect(mockFn.calls).toHaveLength(2)
      expect(mockFn.results).toHaveLength(2)

      // Reset the mock
      mockFn.mockReset()

      expect(mockFn.calls).toHaveLength(0)
      expect(mockFn.results).toHaveLength(0)
    })

    it('should work identically to mockClear', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn1 = createMockFn((x: string) => x)
      const mockFn2 = createMockFn((x: string) => x)

      // Add identical calls
      mockFn1('test')
      mockFn2('test')

      expect(mockFn1.calls).toEqual(mockFn2.calls)
      expect(mockFn1.results).toEqual(mockFn2.results)

      // Use different clear methods
      mockFn1.mockClear()
      mockFn2.mockReset()

      // Should both be empty
      expect(mockFn1.calls).toEqual(mockFn2.calls)
      expect(mockFn1.results).toEqual(mockFn2.results)
      expect(mockFn1.calls).toHaveLength(0)
      expect(mockFn2.calls).toHaveLength(0)
    })
  })

  describe('with implementation function', () => {
    it('should execute provided implementation', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const implementation = (a: number, b: number) => a + b
      const mockFn = createMockFn(implementation)

      const result = mockFn(3, 4)

      expect(result).toBe(7)
      expect(mockFn.results[0]).toBe(7)
    })

    it('should handle complex implementations', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const implementation = (items: number[]) => {
        return items.filter((x) => x > 0).map((x) => x * 2)
      }

      const mockFn = createMockFn(implementation)

      const result = mockFn([-1, 2, -3, 4])

      expect(result).toEqual([4, 8])
      expect(mockFn.results[0]).toEqual([4, 8])
    })

    it('should handle async implementations', async () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const implementation = async (x: number) => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return x * 3
      }

      const mockFn = createMockFn(implementation)

      const result = await mockFn(5)

      expect(result).toBe(15)
      expect(mockFn.results[0]).toBeInstanceOf(Promise)
    })

    it('should handle implementations that throw', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const implementation = (x: number) => {
        if (x < 0) throw new Error('Negative not allowed')
        return x
      }

      const mockFn = createMockFn(implementation)

      expect(() => mockFn(-1)).toThrow('Negative not allowed')
      expect(mockFn.calls[0]).toEqual([-1])
    })
  })

  describe('without implementation function', () => {
    it('should return undefined when no implementation provided', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn<[number], string>()

      const result = mockFn(42)

      expect(result).toBeUndefined()
      expect(mockFn.results[0]).toBeUndefined()
      expect(mockFn.calls[0]).toEqual([42])
    })

    it('should track calls even without implementation', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn<[string, number], boolean>()

      mockFn('hello', 123)
      mockFn('world', 456)

      expect(mockFn.calls).toHaveLength(2)
      expect(mockFn.calls[0]).toEqual(['hello', 123])
      expect(mockFn.calls[1]).toEqual(['world', 456])
      expect(mockFn.results).toEqual([undefined, undefined])
    })

    it('should work with complex argument types', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      interface ComplexArg {
        id: number
        data: string[]
        metadata?: { version: string }
      }

      const mockFn = createMockFn<[ComplexArg], void>()

      const arg: ComplexArg = {
        id: 1,
        data: ['a', 'b', 'c'],
        metadata: { version: '1.0' },
      }

      mockFn(arg)

      expect(mockFn.calls[0]).toEqual([arg])
      expect(mockFn.results[0]).toBeUndefined()
    })
  })

  describe('vitest compatibility', () => {
    it('should have all vitest-like properties', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn((x: number) => x)

      // Check all expected properties exist
      expect(mockFn).toHaveProperty('calls')
      expect(mockFn).toHaveProperty('results')
      expect(mockFn).toHaveProperty('mockClear')
      expect(mockFn).toHaveProperty('mockReset')
      expect(mockFn).toHaveProperty('mockRestore')

      // Check they are the right types
      expect(Array.isArray(mockFn.calls)).toBe(true)
      expect(Array.isArray(mockFn.results)).toBe(true)
      expect(typeof mockFn.mockClear).toBe('function')
      expect(typeof mockFn.mockReset).toBe('function')
      expect(typeof mockFn.mockRestore).toBe('function')
    })

    it('should have mockRestore function that works like mockClear', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn((x: number) => x + 1)

      mockFn(1)
      mockFn(2)

      expect(mockFn.calls).toHaveLength(2)
      expect(mockFn.results).toHaveLength(2)

      mockFn.mockRestore()

      expect(mockFn.calls).toHaveLength(0)
      expect(mockFn.results).toHaveLength(0)
    })

    it('should maintain reference equality for arrays', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn((x: number) => x)

      const callsRef = mockFn.calls
      const resultsRef = mockFn.results

      mockFn(1)

      // Same array references should be maintained
      expect(mockFn.calls).toBe(callsRef)
      expect(mockFn.results).toBe(resultsRef)
    })
  })

  describe('edge cases and error conditions', () => {
    it('should handle vi being null', () => {
      ;(globalThis as any).vi = null

      const mockFn = createMockFn((x: number) => x)

      expect(typeof mockFn).toBe('function')
      expect(mockFn).toHaveProperty('calls')
    })

    it('should handle vi.fn being null', () => {
      ;(globalThis as any).vi = { fn: null }

      const mockFn = createMockFn((x: number) => x)

      expect(typeof mockFn).toBe('function')
      expect(mockFn).toHaveProperty('calls')
    })

    it('should handle very large number of calls', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn((x: number) => x)

      // Add many calls
      for (let i = 0; i < 1000; i++) {
        mockFn(i)
      }

      expect(mockFn.calls).toHaveLength(1000)
      expect(mockFn.results).toHaveLength(1000)
      expect(mockFn.calls[999]).toEqual([999])
      expect(mockFn.results[999]).toBe(999)

      // Clear should still work
      mockFn.mockClear()
      expect(mockFn.calls).toHaveLength(0)
      expect(mockFn.results).toHaveLength(0)
    })

    it('should handle function that returns undefined explicitly', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn(() => undefined)

      const result = mockFn()

      expect(result).toBeUndefined()
      expect(mockFn.results[0]).toBeUndefined()
    })

    it('should handle function that returns null', () => {
      // Remove vi to ensure fallback behavior
      if (typeof globalThis !== 'undefined' && 'vi' in globalThis) {
        delete (globalThis as any).vi
      }

      const mockFn = createMockFn(() => null)

      const result = mockFn()

      expect(result).toBeNull()
      expect(mockFn.results[0]).toBeNull()
    })
  })
})
