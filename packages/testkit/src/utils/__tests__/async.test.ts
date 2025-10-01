/**
 * Tests for async utility functions: retry and withTimeout
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { retry, withTimeout } from '../index'

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('exponential backoff progression', () => {
    it('should use exponential backoff with correct timing (100ms, 200ms, 400ms)', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockRejectedValueOnce(new Error('Third failure'))
        .mockResolvedValueOnce('success')

      const retryPromise = retry(mockFn, 4, 100)

      // First call should be immediate
      expect(mockFn).toHaveBeenCalledTimes(1)

      // Fast-forward to first retry (100ms)
      await vi.advanceTimersByTimeAsync(100)
      expect(mockFn).toHaveBeenCalledTimes(2)

      // Fast-forward to second retry (200ms from second call)
      await vi.advanceTimersByTimeAsync(200)
      expect(mockFn).toHaveBeenCalledTimes(3)

      // Fast-forward to third retry (400ms from third call)
      await vi.advanceTimersByTimeAsync(400)
      expect(mockFn).toHaveBeenCalledTimes(4)

      const result = await retryPromise
      expect(result).toBe('success')
    })

    it('should calculate backoff delays correctly for each attempt', async () => {
      const delays: number[] = []

      // Spy on setTimeout to capture delays, but use real timers
      vi.useRealTimers()
      const originalSetTimeout = globalThis.setTimeout
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(((
        callback: () => void,
        delay: number,
      ) => {
        delays.push(delay)
        // Execute immediately for test speed using original setTimeout
        return originalSetTimeout(callback, 0)
      }) as any)

      const failingFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success')

      await retry(failingFn, 3, 100)

      // Filter out delays from SQLite pool maintenance timers (60s = 60000ms)
      // which may run in background during tests
      const retryDelays = delays.filter((d) => d !== 60000)

      // Should have delays: 100ms (2^0), 200ms (2^1)
      expect(retryDelays).toEqual([100, 200])

      setTimeoutSpy.mockRestore()
      vi.useFakeTimers()
    })
  })

  describe('successful retry after failures', () => {
    it('should succeed on second attempt after one failure', async () => {
      vi.useRealTimers()

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success on second try')

      const result = await retry(mockFn, 3, 10) // Use shorter delay for faster test

      expect(result).toBe('success on second try')
      expect(mockFn).toHaveBeenCalledTimes(2)

      vi.useFakeTimers()
    })

    it('should succeed on third attempt after two failures', async () => {
      vi.useRealTimers()

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('third time is the charm')

      const result = await retry(mockFn, 3, 10) // Use shorter delay for faster test

      expect(result).toBe('third time is the charm')
      expect(mockFn).toHaveBeenCalledTimes(3)

      vi.useFakeTimers()
    })

    it('should return complex objects correctly', async () => {
      vi.useRealTimers()

      const complexResult = { data: [1, 2, 3], status: 'ok', metadata: { version: '1.0' } }
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(complexResult)

      const result = await retry(mockFn, 3, 10) // Use shorter delay for faster test

      expect(result).toEqual(complexResult)
      expect(result).toBe(complexResult) // Same reference

      vi.useFakeTimers()
    })
  })

  describe('max attempts behavior', () => {
    it('should respect default max attempts (3)', async () => {
      vi.useRealTimers()

      const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'))

      await expect(retry(mockFn, 3, 10)).rejects.toThrow('Always fails')
      expect(mockFn).toHaveBeenCalledTimes(3)

      vi.useFakeTimers()
    })

    it('should respect custom max attempts', async () => {
      vi.useRealTimers()

      const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'))

      await expect(retry(mockFn, 5, 10)).rejects.toThrow('Always fails')
      expect(mockFn).toHaveBeenCalledTimes(5)

      vi.useFakeTimers()
    })

    it('should work with max attempts of 1 (no retries)', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Immediate failure'))

      await expect(retry(mockFn, 1)).rejects.toThrow('Immediate failure')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should handle max attempts of 0 gracefully', async () => {
      const mockFn = vi.fn().mockResolvedValue('never called')

      await expect(retry(mockFn, 0)).rejects.toThrow()
      expect(mockFn).toHaveBeenCalledTimes(0)
    })
  })

  describe('error propagation after all retries', () => {
    it('should propagate the last error after all retries exhausted', async () => {
      vi.useRealTimers()

      const errors = [new Error('First error'), new Error('Second error'), new Error('Final error')]

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(errors[0])
        .mockRejectedValueOnce(errors[1])
        .mockRejectedValueOnce(errors[2])

      await expect(retry(mockFn, 3, 10)).rejects.toThrow('Final error')
      expect(mockFn).toHaveBeenCalledTimes(3)

      vi.useFakeTimers()
    })

    it('should preserve error properties', async () => {
      vi.useRealTimers()

      class CustomError extends Error {
        constructor(
          message: string,
          public code: number,
        ) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const customError = new CustomError('Custom failure', 500)
      const mockFn = vi.fn().mockRejectedValue(customError)

      try {
        await retry(mockFn, 2, 10)
      } catch (error) {
        expect(error).toBeInstanceOf(CustomError)
        expect((error as CustomError).code).toBe(500)
        expect((error as CustomError).message).toBe('Custom failure')
      }

      vi.useFakeTimers()
    })

    it('should handle non-Error rejections', async () => {
      vi.useRealTimers()

      const mockFn = vi.fn().mockRejectedValue('string error')

      await expect(retry(mockFn, 2, 10)).rejects.toBe('string error')

      vi.useFakeTimers()
    })
  })

  describe('async and sync functions', () => {
    it('should work with async functions', async () => {
      vi.useRealTimers()

      const asyncFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return 'async result'
      })

      const result = await retry(asyncFn, 3, 10)
      expect(result).toBe('async result')

      vi.useFakeTimers()
    })

    it('should work with sync functions wrapped in Promise', async () => {
      const syncFn = vi.fn(() => Promise.resolve('sync result'))

      const result = await retry(syncFn)
      expect(result).toBe('sync result')
    })

    it('should handle sync functions that throw', async () => {
      vi.useRealTimers()

      const syncThrowFn = vi.fn(() => Promise.reject(new Error('Sync throw')))

      await expect(retry(syncThrowFn, 2, 10)).rejects.toThrow('Sync throw')

      vi.useFakeTimers()
    })
  })

  describe('immediate success (no retry needed)', () => {
    it('should return immediately on first success', async () => {
      const mockFn = vi.fn().mockResolvedValue('immediate success')

      const result = await retry(mockFn)

      expect(result).toBe('immediate success')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should not create any timers on immediate success', async () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
      const mockFn = vi.fn().mockResolvedValue('success')

      await retry(mockFn)

      expect(setTimeoutSpy).not.toHaveBeenCalled()
    })

    it('should work with different return types', async () => {
      const numberFn = vi.fn().mockResolvedValue(42)
      const arrayFn = vi.fn().mockResolvedValue([1, 2, 3])
      const objectFn = vi.fn().mockResolvedValue({ key: 'value' })
      const nullFn = vi.fn().mockResolvedValue(null)
      const undefinedFn = vi.fn().mockResolvedValue(undefined)

      expect(await retry(numberFn)).toBe(42)
      expect(await retry(arrayFn)).toEqual([1, 2, 3])
      expect(await retry(objectFn)).toEqual({ key: 'value' })
      expect(await retry(nullFn)).toBe(null)
      expect(await retry(undefinedFn)).toBe(undefined)
    })
  })

  describe('custom base delay', () => {
    it('should use custom base delay for backoff calculation', async () => {
      const delays: number[] = []

      vi.useRealTimers()
      const originalSetTimeout = globalThis.setTimeout
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(((
        callback: () => void,
        delay: number,
      ) => {
        delays.push(delay)
        return originalSetTimeout(callback, 0)
      }) as any)

      const failingFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success')

      await retry(failingFn, 3, 50) // 50ms base delay

      // Should have delays: 50ms (50 * 2^0), 100ms (50 * 2^1)
      expect(delays).toEqual([50, 100])

      setTimeoutSpy.mockRestore()
      vi.useFakeTimers()
    })
  })
})

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('timeout error message contains "timeout" (lowercase)', () => {
    it('should reject with timeout error message containing "timeout"', async () => {
      const slowPromise = new Promise(() => {}) // Never resolves

      const timeoutPromise = withTimeout(slowPromise, 1000)

      vi.advanceTimersByTime(1000)

      await expect(timeoutPromise).rejects.toThrow(/timeout/)
    })

    it('should include the timeout duration in error message', async () => {
      const slowPromise = new Promise(() => {})

      const timeoutPromise = withTimeout(slowPromise, 2500)

      vi.advanceTimersByTime(2500)

      await expect(timeoutPromise).rejects.toThrow('timeout after 2500ms')
    })

    it('should use lowercase "timeout" in error message', async () => {
      const slowPromise = new Promise(() => {})

      const timeoutPromise = withTimeout(slowPromise, 1000)

      vi.advanceTimersByTime(1000)

      try {
        await timeoutPromise
      } catch (error) {
        expect((error as Error).message).toMatch(/^timeout/)
        expect((error as Error).message).not.toMatch(/^Timeout/)
      }
    })
  })

  describe('promise resolution before timeout', () => {
    it('should resolve with promise value before timeout', async () => {
      const fastPromise = Promise.resolve('fast result')

      const result = await withTimeout(fastPromise, 1000)

      expect(result).toBe('fast result')
    })

    it('should resolve with complex objects', async () => {
      const complexData = { users: [{ id: 1, name: 'John' }], total: 1 }
      const fastPromise = Promise.resolve(complexData)

      const result = await withTimeout(fastPromise, 1000)

      expect(result).toEqual(complexData)
      expect(result).toBe(complexData) // Same reference
    })

    it('should handle async function resolution', async () => {
      const asyncFunction = async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 100)
        })
        return 'async complete'
      }

      const timeoutPromise = withTimeout(asyncFunction(), 500)

      // Advance by 100ms to complete the async function
      vi.advanceTimersByTime(100)

      const result = await timeoutPromise
      expect(result).toBe('async complete')
    })
  })

  describe('promise rejection before timeout', () => {
    it('should reject with original error before timeout', async () => {
      const failingPromise = Promise.reject(new Error('Original error'))

      await expect(withTimeout(failingPromise, 1000)).rejects.toThrow('Original error')
    })

    it('should preserve error properties', async () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public statusCode: number,
        ) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const customError = new CustomError('API Error', 404)
      const failingPromise = Promise.reject(customError)

      try {
        await withTimeout(failingPromise, 1000)
      } catch (error) {
        expect(error).toBeInstanceOf(CustomError)
        expect((error as CustomError).statusCode).toBe(404)
        expect(error.message).toBe('API Error')
      }
    })

    it('should handle non-Error rejections', async () => {
      const failingPromise = Promise.reject('string rejection')

      await expect(withTimeout(failingPromise, 1000)).rejects.toBe('string rejection')
    })
  })

  describe('actual timeout behavior', () => {
    it('should timeout exactly at specified time', async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(resolve, 2000) // Takes 2 seconds
      })

      const timeoutPromise = withTimeout(slowPromise, 1000) // Timeout at 1 second

      // Advance to just before timeout
      vi.advanceTimersByTime(999)

      // Advance to exactly timeout
      vi.advanceTimersByTime(1)

      await expect(timeoutPromise).rejects.toThrow('timeout after 1000ms')
    })

    it('should work with very short timeouts', async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(resolve, 100)
      })

      const timeoutPromise = withTimeout(slowPromise, 1) // 1ms timeout

      vi.advanceTimersByTime(1)

      await expect(timeoutPromise).rejects.toThrow('timeout after 1ms')
    })

    it('should work with very long timeouts', async () => {
      const fastPromise = Promise.resolve('quick')

      const result = await withTimeout(fastPromise, 999999) // Very long timeout

      expect(result).toBe('quick')
    })
  })

  describe('cleanup on timeout', () => {
    it('should not resolve original promise after timeout', async () => {
      let originalResolved = false
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => {
          originalResolved = true
          resolve('too late')
        }, 2000)
      })

      const timeoutPromise = withTimeout(slowPromise, 1000)

      // Trigger timeout
      vi.advanceTimersByTime(1000)

      await expect(timeoutPromise).rejects.toThrow('timeout')

      // Original promise should not have resolved yet
      expect(originalResolved).toBe(false)

      // Even if original promise resolves later, it shouldn't affect anything
      vi.advanceTimersByTime(1000)
      expect(originalResolved).toBe(true) // Now resolved, but too late
    })

    it('should not interfere with subsequent operations', async () => {
      // First operation times out
      const slowPromise1 = new Promise(() => {}) // Never resolves
      const timeout1 = withTimeout(slowPromise1, 100)

      vi.advanceTimersByTime(100)
      await expect(timeout1).rejects.toThrow()

      // Second operation should work normally
      const fastPromise2 = Promise.resolve('second operation')
      const result = await withTimeout(fastPromise2, 100)

      expect(result).toBe('second operation')
    })
  })

  describe('different timeout values', () => {
    it('should handle zero timeout', async () => {
      const promise = new Promise((resolve) => setTimeout(resolve, 100))

      const timeoutPromise = withTimeout(promise, 0)

      vi.advanceTimersByTime(0)

      await expect(timeoutPromise).rejects.toThrow('timeout after 0ms')
    })

    it('should handle negative timeout', async () => {
      const promise = Promise.resolve('immediate')

      const timeoutPromise = withTimeout(promise, -1)

      // Even with negative timeout, if promise resolves immediately, it should work
      const result = await timeoutPromise
      expect(result).toBe('immediate')
    })

    it('should handle fractional timeouts', async () => {
      const slowPromise = new Promise(() => {})

      const timeoutPromise = withTimeout(slowPromise, 100.5)

      vi.advanceTimersByTime(100.5)

      await expect(timeoutPromise).rejects.toThrow('timeout after 100.5ms')
    })
  })

  describe('race condition handling', () => {
    it('should handle promise resolving at exact timeout moment', async () => {
      let resolvePromise: (value: string) => void
      const racePromise = new Promise<string>((resolve) => {
        resolvePromise = resolve
      })

      const timeoutPromise = withTimeout(racePromise, 1000)

      // Set up both to happen at same time
      vi.advanceTimersByTime(1000)
      resolvePromise!('resolved at timeout')

      // Since Promise.race behavior with simultaneous resolution/rejection
      // is implementation-dependent, we just verify one of them happens
      try {
        const result = await timeoutPromise
        expect(result).toBe('resolved at timeout')
      } catch (error) {
        expect((error as Error).message).toBe('timeout after 1000ms')
      }
    })
  })
})
