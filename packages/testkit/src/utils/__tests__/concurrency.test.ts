/**
 * Tests for concurrency control utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  ConcurrencyManager,
  ConcurrencyError,
  limitConcurrency,
  limitedPromiseAll,
  limitedAll,
  limitedAllSettled,
  fileOperationsManager,
  databaseOperationsManager,
  networkOperationsManager,
  processSpawningManager,
  resourceCleanupManager,
  DEFAULT_CONCURRENCY_LIMITS,
} from '../concurrency.js'

describe('ConcurrencyManager', () => {
  let manager: ConcurrencyManager

  beforeEach(() => {
    manager = new ConcurrencyManager({ limit: 2 })
  })

  afterEach(async () => {
    await manager.drain()
  })

  describe('basic functionality', () => {
    it('should limit concurrent executions', async () => {
      const results: number[] = []
      const promises: Promise<void>[] = []
      let concurrentCount = 0
      let maxConcurrent = 0

      // Create 5 tasks that track concurrency
      for (let i = 0; i < 5; i++) {
        promises.push(
          manager.execute(async () => {
            concurrentCount++
            maxConcurrent = Math.max(maxConcurrent, concurrentCount)

            // Simulate async work
            await new Promise((resolve) => setTimeout(resolve, 50))

            results.push(i)
            concurrentCount--

            return i
          }),
        )
      }

      await Promise.all(promises)

      expect(maxConcurrent).toBeLessThanOrEqual(2)
      expect(results).toHaveLength(5)
      expect(results.sort()).toEqual([0, 1, 2, 3, 4])
    })

    it('should handle errors without breaking the queue', async () => {
      const results: (number | Error)[] = []

      const promises = [
        manager.execute(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          results.push(1)
          return 1
        }),
        manager.execute(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          throw new Error('Test error')
        }),
        manager.execute(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          results.push(3)
          return 3
        }),
      ]

      const settledResults = await Promise.allSettled(promises)

      expect(settledResults[0].status).toBe('fulfilled')
      expect(settledResults[1].status).toBe('rejected')
      expect(settledResults[2].status).toBe('fulfilled')
      expect(results).toEqual([1, 3])
    })

    it('should return correct statistics', async () => {
      const slowPromise = manager.execute(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return 'slow'
      })

      // Give the promise time to start
      await new Promise((resolve) => setTimeout(resolve, 10))

      const stats = manager.getStats()
      expect(stats.pending).toBe(1)
      expect(stats.limit).toBe(2)

      await slowPromise

      const finalStats = manager.getStats()
      expect(finalStats.pending).toBe(0)
    })
  })

  describe('batch operations', () => {
    it('should process items in batches while preserving order', async () => {
      const items = [1, 2, 3, 4, 5]
      const results = await manager.batch(items, async (item) => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 20))
        return item * 2
      })

      expect(results).toEqual([2, 4, 6, 8, 10])
    })

    it('should handle mixed success and failure in batches', async () => {
      const items = [1, 2, 3, 4, 5]

      const batchPromise = manager.batch(items, async (item) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        if (item === 3) {
          throw new Error(`Error for item ${item}`)
        }
        return item * 2
      })

      await expect(batchPromise).rejects.toThrow('Error for item 3')
    })

    it('should support map operation with custom limits', async () => {
      const items = Array.from({ length: 10 }, (_, i) => i)
      let maxConcurrent = 0
      let currentConcurrent = 0

      const results = await manager.map(
        items,
        async (item) => {
          currentConcurrent++
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent)

          await new Promise((resolve) => setTimeout(resolve, 20))

          currentConcurrent--
          return item * 2
        },
        3,
      ) // Custom limit of 3

      expect(results).toEqual(items.map((i) => i * 2))
      expect(maxConcurrent).toBeLessThanOrEqual(3)
    })
  })

  describe('timeout handling', () => {
    it('should handle timeouts when configured', async () => {
      const timeoutManager = new ConcurrencyManager({
        limit: 1,
        timeout: 50,
        throwOnTimeout: true,
      })

      const promise = timeoutManager.execute(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return 'result'
      })

      await expect(promise).rejects.toThrow('Operation timed out after 50ms')
    })

    it('should not throw on timeout when throwOnTimeout is false', async () => {
      const timeoutManager = new ConcurrencyManager({
        limit: 1,
        timeout: 50,
        throwOnTimeout: false,
      })

      const promise = timeoutManager.execute(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return 'result'
      })

      // Should not throw, but might resolve or be cancelled
      const result = await promise
      expect(result).toBe('result')
    })
  })

  describe('drain functionality', () => {
    it('should wait for all operations to complete', async () => {
      let completed = 0

      // Start several operations
      const promises = Array.from({ length: 5 }, (_, i) =>
        manager.execute(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          completed++
          return i
        }),
      )

      // Drain should wait for all to complete
      await manager.drain()
      expect(completed).toBe(5)

      // All promises should also be resolved
      const results = await Promise.all(promises)
      expect(results.sort()).toEqual([0, 1, 2, 3, 4])
    })
  })
})

describe('limitConcurrency function', () => {
  it('should create a limited function', async () => {
    let concurrentCount = 0
    let maxConcurrent = 0

    const limitedFn = limitConcurrency(async (value: number) => {
      concurrentCount++
      maxConcurrent = Math.max(maxConcurrent, concurrentCount)

      await new Promise((resolve) => setTimeout(resolve, 50))

      concurrentCount--
      return value * 2
    }, 2)

    const promises = Array.from({ length: 5 }, (_, i) => limitedFn(i))
    const results = await Promise.all(promises)

    expect(results).toEqual([0, 2, 4, 6, 8])
    expect(maxConcurrent).toBeLessThanOrEqual(2)
  })
})

describe('utility functions', () => {
  describe('limitedAll', () => {
    it('should execute promise functions with concurrency limit', async () => {
      let concurrentCount = 0
      let maxConcurrent = 0

      const promiseFns = Array.from({ length: 10 }, (_, i) => async () => {
        concurrentCount++
        maxConcurrent = Math.max(maxConcurrent, concurrentCount)

        await new Promise((resolve) => setTimeout(resolve, 20))

        concurrentCount--
        return i
      })

      const results = await limitedAll(promiseFns, 3)

      expect(results).toEqual(Array.from({ length: 10 }, (_, i) => i))
      expect(maxConcurrent).toBeLessThanOrEqual(3)
    })
  })

  describe('limitedAllSettled', () => {
    it('should handle mixed success and failure results', async () => {
      const promiseFns = [
        async () => 'success1',
        async () => {
          throw new Error('error1')
        },
        async () => 'success2',
        async () => {
          throw new Error('error2')
        },
      ]

      const results = await limitedAllSettled(promiseFns, 2)

      expect(results).toHaveLength(4)
      expect(results[0]).toEqual({ status: 'fulfilled', value: 'success1' })
      expect(results[1]).toEqual({ status: 'rejected', reason: expect.any(Error) })
      expect(results[2]).toEqual({ status: 'fulfilled', value: 'success2' })
      expect(results[3]).toEqual({ status: 'rejected', reason: expect.any(Error) })
    })
  })

  describe('limitedPromiseAll', () => {
    it('should execute with batch options', async () => {
      const promiseFns = Array.from({ length: 5 }, (_, i) => async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        return i * 2
      })

      const results = await limitedPromiseAll(promiseFns, {
        concurrency: 2,
        timeout: 1000,
        preserveOrder: true,
      })

      expect(results).toEqual([0, 2, 4, 6, 8])
    })
  })
})

describe('global managers', () => {
  it('should have correct default limits', () => {
    expect(DEFAULT_CONCURRENCY_LIMITS.FILE_OPERATIONS).toBe(10)
    expect(DEFAULT_CONCURRENCY_LIMITS.DATABASE_OPERATIONS).toBe(5)
    expect(DEFAULT_CONCURRENCY_LIMITS.NETWORK_OPERATIONS).toBe(3)
    expect(DEFAULT_CONCURRENCY_LIMITS.PROCESS_SPAWNING).toBe(2)
    expect(DEFAULT_CONCURRENCY_LIMITS.RESOURCE_CLEANUP).toBe(8)
  })

  it('should provide working global managers', async () => {
    const managers = [
      fileOperationsManager,
      databaseOperationsManager,
      networkOperationsManager,
      processSpawningManager,
      resourceCleanupManager,
    ]

    for (const manager of managers) {
      const result = await manager.execute(async () => 'test')
      expect(result).toBe('test')
    }
  })
})

describe('error scenarios', () => {
  it('should handle ConcurrencyError correctly', () => {
    const error = new ConcurrencyError('Test message', 'TEST_CODE')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ConcurrencyError)
    expect(error.message).toBe('Test message')
    expect(error.code).toBe('TEST_CODE')
    expect(error.name).toBe('ConcurrencyError')
  })

  it('should handle manager overflow gracefully', async () => {
    const manager = new ConcurrencyManager({ limit: 1 })

    const results: number[] = []

    // Queue up many operations
    const promises = Array.from({ length: 100 }, (_, i) =>
      manager.execute(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        results.push(i)
        return i
      }),
    )

    await Promise.all(promises)

    expect(results).toHaveLength(100)
    expect(results.sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i))
  })
})

describe('memory pressure prevention', () => {
  it('should prevent memory exhaustion with large batches', async () => {
    const manager = new ConcurrencyManager({ limit: 5 })

    // Create a large number of operations that would normally cause memory issues
    const largeArray = Array.from({ length: 1000 }, (_, i) => i)

    const startMemory = process.memoryUsage().heapUsed

    const results = await manager.batch(largeArray, async (item) => {
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 1))
      return item * 2
    })

    const endMemory = process.memoryUsage().heapUsed
    const memoryIncrease = endMemory - startMemory

    expect(results).toHaveLength(1000)
    expect(results[0]).toBe(0)
    expect(results[999]).toBe(1998)

    // Memory increase should be reasonable (less than 50MB for this test)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
  })

  it('should handle resource cleanup under pressure', async () => {
    const resources: { id: number; cleanup: () => Promise<void> }[] = []

    // Create many resources
    for (let i = 0; i < 500; i++) {
      resources.push({
        id: i,
        cleanup: async () => {
          await new Promise((resolve) => setTimeout(resolve, 1))
        },
      })
    }

    const startTime = Date.now()

    // Clean them up with concurrency control
    const cleanupFunctions = resources.map((r) => () => r.cleanup())
    await resourceCleanupManager.batch(cleanupFunctions, (fn) => fn())

    const duration = Date.now() - startTime

    // Should complete reasonably quickly (within 5 seconds)
    expect(duration).toBeLessThan(5000)
  })
})
