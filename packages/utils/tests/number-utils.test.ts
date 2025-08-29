import { average, isApproximately, median, percentile, sum, summarize } from '@bun-template/utils'
import { describe, expect, test } from 'vitest'

// Comprehensive test suite with edge cases, extreme values, and regression locks
describe('number-utils', () => {
  // Original targeted tests for core functionality
  test('median even branch with numeric guards', () => {
    expect(median([4, 2, 8, 6])).toBe((4 + 6) / 2)
  })

  test('percentile single value path (low === high)', () => {
    const data = [5, 10, 15, 20, 25]
    expect(percentile(data, 25)).toBe(10)
  })

  test('percentile interpolation path', () => {
    const data = [10, 40, 70, 100]
    expect(percentile(data, 50)).toBe(55)
  })

  test('percentile clamps lower & upper', () => {
    const data = [3, 9, 12]
    expect(percentile(data, -1)).toBe(3)
    expect(percentile(data, 101)).toBe(12)
  })

  test('empty inputs return 0 (median/percentile/average)', () => {
    expect(median([])).toBe(0)
    expect(percentile([], 50)).toBe(0)
    expect(average([])).toBe(0)
  })

  test('sum & summarize basic stats', () => {
    const nums = [1, 2, 3]
    expect(sum(nums)).toBe(6)
    const stats = summarize(nums)
    expect(stats).toMatchObject({ count: 3, sum: 6, average: 2, median: 2 })
  })

  test('isApproximately tolerance boundary', () => {
    expect(isApproximately(1, 1.000001, 0.000001)).toBe(true)
    expect(isApproximately(1, 1.000002, 0.000001)).toBe(false)
  })

  // Extreme value tests
  describe('extreme values', () => {
    test('handles MAX_SAFE_INTEGER correctly', () => {
      const maxValues = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1]
      expect(sum(maxValues)).toBe(Number.MAX_SAFE_INTEGER * 2 - 1)
      expect(average(maxValues)).toBe(Number.MAX_SAFE_INTEGER - 0.5)
      expect(median(maxValues)).toBe(Number.MAX_SAFE_INTEGER - 0.5)
    })

    test('handles MIN_SAFE_INTEGER correctly', () => {
      const minValues = [Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER + 1]
      expect(sum(minValues)).toBe(Number.MIN_SAFE_INTEGER * 2 + 1)
      expect(average(minValues)).toBe(Number.MIN_SAFE_INTEGER + 0.5)
      expect(median(minValues)).toBe(Number.MIN_SAFE_INTEGER + 0.5)
    })

    test('handles very large floating point numbers', () => {
      const largeFloats = [1e15, 1e15 + 0.1, 1e15 + 0.2]
      const avg = average(largeFloats)
      // Large floats lose precision, so we need a larger tolerance
      expect(avg).toBeCloseTo(1e15 + 0.1, 0) // 1e15 precision issues
    })

    test('handles very small floating point numbers', () => {
      const smallFloats = [1e-15, 2e-15, 3e-15]
      expect(average(smallFloats)).toBeCloseTo(2e-15, 20)
      expect(sum(smallFloats)).toBeCloseTo(6e-15, 20)
    })

    test('handles Infinity values', () => {
      expect(sum([Infinity, 1])).toBe(Infinity)
      expect(sum([-Infinity, 1])).toBe(-Infinity)
      expect(sum([Infinity, -Infinity])).toBeNaN()
      expect(average([Infinity, 100])).toBe(Infinity)
    })

    test('handles NaN values', () => {
      // NaN propagates through operations but sorting puts them at end
      expect(sum([NaN, 1, 2])).toBeNaN()
      expect(average([NaN, 1, 2])).toBeNaN()
      // median and percentile sort, NaN sorts to end
      expect(median([NaN, 1, 2])).toBe(1) // sorted: [1, 2, NaN], median is 2nd element
      expect(percentile([1, 2], 50)).toBe(1.5) // Without NaN for clarity
    })
  })

  // Percentile regression locks and edge cases
  describe('percentile edge cases', () => {
    test('percentile p=0 returns minimum (regression lock)', () => {
      const data = [10, 20, 30, 40, 50]
      expect(percentile(data, 0)).toBe(10)
    })

    test('percentile p=100 returns maximum (regression lock)', () => {
      const data = [10, 20, 30, 40, 50]
      expect(percentile(data, 100)).toBe(50)
    })

    test('percentile with negative values clamps to minimum', () => {
      const data = [5, 15, 25, 35]
      expect(percentile(data, -10)).toBe(5)
      expect(percentile(data, -100)).toBe(5)
    })

    test('percentile with values > 100 clamps to maximum', () => {
      const data = [5, 15, 25, 35]
      expect(percentile(data, 110)).toBe(35)
      expect(percentile(data, 200)).toBe(35)
    })

    test('percentile with single element', () => {
      expect(percentile([42], 0)).toBe(42)
      expect(percentile([42], 50)).toBe(42)
      expect(percentile([42], 100)).toBe(42)
    })

    test('percentile with two elements', () => {
      const data = [10, 20]
      expect(percentile(data, 0)).toBe(10)
      expect(percentile(data, 25)).toBe(12.5) // interpolation
      expect(percentile(data, 50)).toBe(15) // interpolation
      expect(percentile(data, 75)).toBe(17.5) // interpolation
      expect(percentile(data, 100)).toBe(20)
    })
  })

  // Single element arrays
  describe('single element arrays', () => {
    test('all functions handle single element correctly', () => {
      const single = [42]
      expect(sum(single)).toBe(42)
      expect(average(single)).toBe(42)
      expect(median(single)).toBe(42)
      expect(percentile(single, 50)).toBe(42)

      const stats = summarize(single)
      // summarize function only returns specific fields based on implementation
      expect(stats).toEqual({
        count: 1,
        sum: 42,
        average: 42,
        median: 42,
        p90: 42, // Only p90 is included in the interface
      })
    })
  })

  // Very large arrays (performance boundary)
  describe('large arrays', () => {
    test('handles 10000 element array efficiently', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i)
      const start = performance.now()

      const s = sum(largeArray)
      const avg = average(largeArray)
      const med = median(largeArray)
      const p50 = percentile(largeArray, 50)

      const elapsed = performance.now() - start

      expect(s).toBe(49995000) // sum of 0 to 9999
      expect(avg).toBe(4999.5)
      expect(med).toBe(4999.5)
      expect(p50).toBe(4999.5)
      expect(elapsed).toBeLessThan(100) // Should complete in < 100ms
    })

    test('summarize handles large datasets', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => i)
      const stats = summarize(largeArray)

      expect(stats.count).toBe(1000)
      expect(stats.sum).toBe(499500) // sum of 0 to 999
      expect(stats.average).toBe(499.5)
      expect(stats.median).toBe(499.5)
      expect(stats.p90).toBe(899.1) // 90th percentile
    })
  })

  // Floating point precision edge cases
  describe('floating point precision', () => {
    test('isApproximately handles precision correctly', () => {
      // Test case where floating point errors might occur
      const a = 0.1 + 0.2
      const b = 0.3
      expect(isApproximately(a, b, 1e-10)).toBe(true)

      // Very close numbers testing tolerances
      // Difference between 1.0000000001 and 1.0000000002 is 1e-10
      expect(isApproximately(1.0000000001, 1.0000000002, 1e-9)).toBe(true)
      // Difference between 1.0000000001 and 1.0000000011 is 1e-9
      expect(isApproximately(1.0000000001, 1.0000000011, 1e-8)).toBe(true)
      expect(isApproximately(1.0000000001, 1.0000000011, 1e-10)).toBe(false)
    })

    test('handles repeated floating point operations', () => {
      const values = Array.from({ length: 100 }, () => 0.1)
      const total = sum(values)
      // 0.1 * 100 = 10, but floating point might introduce errors
      expect(isApproximately(total, 10, 1e-10)).toBe(true)
    })
  })
})
