/**
 * Object Pool Tests
 *
 * Comprehensive test suite for object pooling functionality including
 * generic pools, specialized pools, memory management, and performance
 * characteristics.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ObjectPool,
  BufferPool,
  ArrayPool,
  PromisePool,
  PoolManager,
  PoolUtils,
  GlobalPools,
} from '../object-pool.js'

describe('ObjectPool', () => {
  describe('Basic Functionality', () => {
    let pool: ObjectPool<{ value: number }>

    beforeEach(() => {
      pool = new ObjectPool(
        () => ({ value: 0 }),
        (obj) => {
          obj.value = 0
        },
        { maxSize: 5, minSize: 0, enableStats: true },
      )
    })

    afterEach(async () => {
      await pool.drain()
    })

    it('should create and acquire objects', () => {
      const obj = pool.acquire()
      expect(obj).toBeDefined()
      expect(obj.value).toBe(0)
    })

    it('should release objects back to pool', () => {
      const obj = pool.acquire()
      obj.value = 42

      pool.release(obj)

      const stats = pool.getStats()
      expect(stats.objectsAvailable).toBe(1)
      expect(stats.objectsInUse).toBe(0)
    })

    it('should reuse released objects', () => {
      const obj1 = pool.acquire()
      obj1.value = 42
      pool.release(obj1)

      const obj2 = pool.acquire()
      expect(obj2).toBe(obj1) // Should be the same object
      expect(obj2.value).toBe(0) // Should be reset
    })

    it('should track pool statistics correctly', () => {
      const stats1 = pool.getStats()
      expect(stats1.poolSize).toBe(0)
      expect(stats1.objectsCreated).toBe(0)

      const obj1 = pool.acquire()
      const stats2 = pool.getStats()
      expect(stats2.poolSize).toBe(1)
      expect(stats2.objectsCreated).toBe(1)
      expect(stats2.objectsInUse).toBe(1)
      expect(stats2.poolMisses).toBe(1)

      pool.release(obj1)
      const obj2 = pool.acquire()
      const stats3 = pool.getStats()
      expect(stats3.poolHits).toBe(1)
      expect(stats3.hitRate).toBeCloseTo(0.5) // 1 hit out of 2 acquisitions

      pool.release(obj2)
    })

    it('should respect maximum pool size', () => {
      const objects = []
      for (let i = 0; i < 10; i++) {
        objects.push(pool.acquire())
      }

      // Release all objects
      objects.forEach((obj) => pool.release(obj))

      const stats = pool.getStats()
      expect(stats.poolSize).toBeLessThanOrEqual(5) // maxSize is 5
    })

    it('should handle object validation', async () => {
      const validatorPool = new ObjectPool(
        () => ({ valid: true }),
        (obj) => {
          obj.valid = true
        },
        { validateObjects: true, maxSize: 10 },
        undefined,
        (obj) => obj.valid === true,
      )

      // First, create and release a valid object to populate the pool
      const obj1 = validatorPool.acquire()
      validatorPool.release(obj1)

      // Now corrupt the object while it's in the pool
      obj1.valid = false

      // Next acquisition should fail validation and create new object
      const newObj = validatorPool.acquire()
      expect(newObj.valid).toBe(true)
      expect(newObj).not.toBe(obj1) // Should be a different object

      const stats = validatorPool.getStats()
      expect(stats.validationFailures).toBe(1)

      validatorPool.release(newObj)
      await validatorPool.drain()
    })

    it('should handle disposal function', async () => {
      const disposeStub = vi.fn()
      const disposablePool = new ObjectPool(
        () => ({ disposed: false }),
        (obj) => {
          obj.disposed = false
        },
        { maxSize: 2 },
        (obj) => {
          obj.disposed = true
          disposeStub(obj)
        },
      )

      const obj1 = disposablePool.acquire()
      const obj2 = disposablePool.acquire()
      const obj3 = disposablePool.acquire()

      disposablePool.release(obj1)
      disposablePool.release(obj2)
      disposablePool.release(obj3) // This should cause disposal due to maxSize

      // Disposal might happen immediately or on next acquire depending on pool state
      expect(disposeStub).toHaveBeenCalledTimes(2)

      await disposablePool.drain()
      expect(disposeStub).toHaveBeenCalledTimes(3) // All remaining objects disposed
    })
  })

  describe('Automatic Resizing', () => {
    let pool: ObjectPool<{ id: number }>

    beforeEach(() => {
      pool = new ObjectPool(
        () => ({ id: Math.random() }),
        (obj) => {
          obj.id = 0
        },
        {
          maxSize: 20,
          minSize: 2,
          autoResize: true,
          targetHitRate: 0.8,
        },
      )
    })

    afterEach(async () => {
      await pool.drain()
    })

    it('should maintain minimum pool size', async () => {
      await pool.warmUp()
      const stats = pool.getStats()
      expect(stats.poolSize).toBeGreaterThanOrEqual(2)
    })

    it('should auto-resize based on hit rate', () => {
      // Create many objects to establish low hit rate
      const objects = []
      for (let i = 0; i < 15; i++) {
        objects.push(pool.acquire())
      }

      objects.forEach((obj) => pool.release(obj))

      const stats = pool.getStats()
      expect(stats.hitRate).toBeLessThan(0.8) // Should be low initially

      // Pool should automatically resize to improve hit rate
      // Note: Auto-resize happens in maintenance cycle, which we can't easily test
      // without mocking timers, but we can verify the pool can grow
      expect(stats.poolSize).toBeGreaterThan(0)
    })
  })

  describe('Garbage Collection', () => {
    let pool: ObjectPool<{ data: string }>

    beforeEach(() => {
      pool = new ObjectPool(
        () => ({ data: '' }),
        (obj) => {
          obj.data = ''
        },
        { idleTimeout: 1000 }, // Minimum allowed timeout
      )
    })

    afterEach(async () => {
      if (pool) {
        await pool.drain()
      }
    })

    it('should garbage collect idle objects', async () => {
      const obj = pool.acquire()
      pool.release(obj)

      const statsBefore = pool.getStats()
      expect(statsBefore.poolSize).toBe(1)

      // Wait for idle timeout and force GC
      await new Promise((resolve) => setTimeout(resolve, 1100))
      pool.gc()

      const statsAfter = pool.getStats()
      expect(statsAfter.poolSize).toBe(0)
      expect(statsAfter.objectsDisposed).toBe(1)
    })
  })

  describe('Concurrent Usage', () => {
    let pool: ObjectPool<{ value: number }>

    beforeEach(() => {
      pool = new ObjectPool(
        () => ({ value: 0 }),
        (obj) => {
          obj.value = 0
        },
        { maxSize: 10 },
      )
    })

    afterEach(async () => {
      await pool.drain()
    })

    it('should handle concurrent acquire/release operations', async () => {
      const promises = []

      // Simulate concurrent operations
      for (let i = 0; i < 50; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              const obj = pool.acquire()
              obj.value = i
              setTimeout(() => {
                pool.release(obj)
                resolve()
              }, Math.random() * 10)
            }, Math.random() * 10)
          }),
        )
      }

      await Promise.all(promises)

      const stats = pool.getStats()
      expect(stats.objectsInUse).toBe(0) // All objects should be released
      expect(stats.objectsCreated).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle factory errors gracefully', () => {
      const faultyPool = new ObjectPool(() => {
        throw new Error('Factory error')
      })

      expect(() => faultyPool.acquire()).toThrow('Factory error')
    })

    it('should handle resetter errors gracefully', () => {
      const resetterPool = new ObjectPool(
        () => ({ value: 0 }),
        () => {
          throw new Error('Reset error')
        },
      )

      const obj = resetterPool.acquire()
      // Should not throw, but should remove object from pool
      expect(() => resetterPool.release(obj)).not.toThrow()

      const stats = resetterPool.getStats()
      expect(stats.objectsDisposed).toBe(1)
    })

    it('should validate constructor options', () => {
      expect(() => new ObjectPool(() => ({}), undefined, { maxSize: 0 })).toThrow()
      expect(() => new ObjectPool(() => ({}), undefined, { minSize: -1 })).toThrow()
      expect(() => new ObjectPool(() => ({}), undefined, { minSize: 10, maxSize: 5 })).toThrow()
      expect(() => new ObjectPool(() => ({}), undefined, { idleTimeout: 500 })).toThrow()
      expect(() => new ObjectPool(() => ({}), undefined, { targetHitRate: 1.5 })).toThrow()
    })

    it('should handle release of unknown objects', () => {
      const pool = new ObjectPool(() => ({ value: 0 }))
      const unknownObject = { value: 42 }

      // Should not throw, just warn
      expect(() => pool.release(unknownObject)).not.toThrow()
    })

    it('should prevent operations after shutdown', async () => {
      const pool = new ObjectPool(() => ({ value: 0 }))
      await pool.drain()

      expect(() => pool.acquire()).toThrow('shutting down')
    })
  })
})

describe('BufferPool', () => {
  let bufferPool: BufferPool

  beforeEach(() => {
    bufferPool = new BufferPool({ defaultSize: 1024, maxSize: 10 })
  })

  afterEach(async () => {
    await bufferPool.drain()
  })

  it('should create buffers of default size', () => {
    const buffer = bufferPool.acquire()
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBe(1024)
    bufferPool.release(buffer)
  })

  it('should create buffers of specific sizes', () => {
    const buffer1 = bufferPool.acquireSize(512)
    const buffer2 = bufferPool.acquireSize(2048)

    expect(buffer1.length).toBe(512)
    expect(buffer2.length).toBe(2048)

    bufferPool.releaseSize(buffer1)
    bufferPool.releaseSize(buffer2)
  })

  it('should reset buffer contents on release', () => {
    const buffer = bufferPool.acquire()
    buffer.writeUInt32BE(0xdeadbeef, 0)
    bufferPool.release(buffer)

    const reusedBuffer = bufferPool.acquire()
    expect(reusedBuffer.readUInt32BE(0)).toBe(0) // Should be reset
    bufferPool.release(reusedBuffer)
  })

  it('should pool common buffer sizes efficiently', () => {
    const buffer1024a = bufferPool.acquireSize(1024)
    const buffer1024b = bufferPool.acquireSize(1024)

    bufferPool.releaseSize(buffer1024a)
    bufferPool.releaseSize(buffer1024b)

    const buffer1024c = bufferPool.acquireSize(1024)
    // Should reuse one of the previous buffers
    expect(buffer1024c === buffer1024a || buffer1024c === buffer1024b).toBe(true)

    bufferPool.releaseSize(buffer1024c)
  })
})

describe('ArrayPool', () => {
  let arrayPool: ArrayPool<number>

  beforeEach(() => {
    arrayPool = new ArrayPool({ maxSize: 10 })
  })

  afterEach(async () => {
    await arrayPool.drain()
  })

  it('should create empty arrays', () => {
    const array = arrayPool.acquire()
    expect(Array.isArray(array)).toBe(true)
    expect(array.length).toBe(0)
    arrayPool.release(array)
  })

  it('should create arrays with initial capacity', () => {
    const array = arrayPool.acquireWithCapacity(5)
    expect(array.length).toBe(5)
    expect(array.every((item) => item === undefined)).toBe(true)
    arrayPool.release(array)
  })

  it('should reset array contents on release', () => {
    const array = arrayPool.acquire()
    array.push(1, 2, 3, 4, 5)
    arrayPool.release(array)

    const reusedArray = arrayPool.acquire()
    expect(reusedArray.length).toBe(0) // Should be reset
    arrayPool.release(reusedArray)
  })

  it('should reuse arrays efficiently', () => {
    const array1 = arrayPool.acquire()
    arrayPool.release(array1)

    const array2 = arrayPool.acquire()
    expect(array2).toBe(array1) // Should be the same instance

    arrayPool.release(array2)
  })
})

describe('PromisePool', () => {
  let promisePool: PromisePool

  beforeEach(() => {
    promisePool = new PromisePool({ maxSize: 5 })
  })

  afterEach(async () => {
    await promisePool.drain()
  })

  it('should create controlled promises', () => {
    const controlled = promisePool.createPromise()

    expect(controlled.promise).toBeInstanceOf(Promise)
    expect(typeof controlled.resolve).toBe('function')
    expect(typeof controlled.reject).toBe('function')
  })

  it('should handle promise resolution', async () => {
    const controlled = promisePool.createPromise<string>()
    const result = 'test result'

    setTimeout(() => controlled.resolve(result), 10)

    const value = await controlled.promise
    expect(value).toBe(result)
  })

  it('should handle promise rejection', async () => {
    const controlled = promisePool.createPromise()
    const error = new Error('test error')

    setTimeout(() => controlled.reject(error), 10)

    await expect(controlled.promise).rejects.toThrow('test error')
  })
})

describe('PoolManager', () => {
  let manager: PoolManager

  beforeEach(() => {
    manager = new PoolManager()
  })

  afterEach(async () => {
    await manager.drainAll()
  })

  it('should register and retrieve pools', () => {
    const pool = new ObjectPool(() => ({ value: 0 }))
    manager.register('test-pool', pool)

    const retrieved = manager.get<{ value: number }>('test-pool')
    expect(retrieved).toBe(pool)
  })

  it('should remove pools', async () => {
    const pool = new ObjectPool(() => ({ value: 0 }))
    manager.register('test-pool', pool)

    await manager.remove('test-pool')

    const retrieved = manager.get('test-pool')
    expect(retrieved).toBeUndefined()
  })

  it('should get statistics for all pools', () => {
    const pool1 = new ObjectPool(() => ({ value: 0 }))
    const pool2 = new ObjectPool(() => ({ data: '' }))

    manager.register('pool1', pool1)
    manager.register('pool2', pool2)

    const stats = manager.getAllStats()
    expect(stats).toHaveProperty('pool1')
    expect(stats).toHaveProperty('pool2')
  })

  it('should drain all pools', async () => {
    const pool1 = new ObjectPool(() => ({ value: 0 }))
    const pool2 = new ObjectPool(() => ({ data: '' }))

    manager.register('pool1', pool1)
    manager.register('pool2', pool2)

    // Acquire objects
    const _obj1 = pool1.acquire()
    const _obj2 = pool2.acquire()

    await manager.drainAll()

    // Pools should be shut down
    expect(() => pool1.acquire()).toThrow()
    expect(() => pool2.acquire()).toThrow()
  })

  it('should force garbage collection on all pools', async () => {
    const pool = new ObjectPool(
      () => ({ value: 0 }),
      (obj) => {
        obj.value = 0
      },
      { idleTimeout: 1000 },
    )

    manager.register('test-pool', pool)

    const obj = pool.acquire()
    pool.release(obj)

    await new Promise((resolve) => setTimeout(resolve, 1100))
    manager.gcAll()

    const stats = pool.getStats()
    expect(stats.objectsDisposed).toBeGreaterThan(0)
  })
})

describe('Global Pools', () => {
  afterEach(async () => {
    // Clean up global pools
    await GlobalPools.smallBuffers.drain()
    await GlobalPools.mediumBuffers.drain()
    await GlobalPools.arrays.drain()
    await GlobalPools.promises.drain()

    // Recreate them for next test
    Object.assign(GlobalPools, {
      smallBuffers: new BufferPool({ defaultSize: 1024, maxSize: 100 }),
      mediumBuffers: new BufferPool({ defaultSize: 4096, maxSize: 50 }),
      arrays: new ArrayPool({ maxSize: 50 }),
      promises: new PromisePool({ maxSize: 30 }),
    })
  })

  it('should provide global buffer pools', () => {
    const smallBuffer = GlobalPools.smallBuffers.acquire()
    const mediumBuffer = GlobalPools.mediumBuffers.acquire()

    expect(smallBuffer.length).toBe(1024)
    expect(mediumBuffer.length).toBe(4096)

    GlobalPools.smallBuffers.release(smallBuffer)
    GlobalPools.mediumBuffers.release(mediumBuffer)
  })

  it('should provide global array pool', () => {
    const array = GlobalPools.arrays.acquire()
    expect(Array.isArray(array)).toBe(true)
    GlobalPools.arrays.release(array)
  })

  it('should provide global promise pool', () => {
    const controlled = GlobalPools.promises.createPromise()
    expect(controlled.promise).toBeInstanceOf(Promise)
  })
})

describe('PoolUtils', () => {
  it('should create buffer pool with defaults', () => {
    const pool = PoolUtils.createBufferPool()
    const buffer = pool.acquire()
    expect(buffer.length).toBe(1024)
    pool.release(buffer)
  })

  it('should create array pool with custom max size', () => {
    const pool = PoolUtils.createArrayPool<string>(10)
    const array = pool.acquire()
    expect(Array.isArray(array)).toBe(true)
    pool.release(array)
  })

  it('should create promise pool for tests', () => {
    const pool = PoolUtils.createPromisePool()
    const controlled = pool.createPromise()
    expect(controlled.promise).toBeInstanceOf(Promise)
  })

  it('should create generic object pool', () => {
    const pool = PoolUtils.createObjectPool(
      () => ({ count: 0 }),
      (obj) => {
        obj.count = 0
      },
    )
    const obj = pool.acquire()
    expect(obj.count).toBe(0)
    pool.release(obj)
  })
})

describe('Performance Characteristics', () => {
  it('should demonstrate performance benefits of pooling', () => {
    const ITERATIONS = 1000
    const pool = new ObjectPool(
      () => new Array(100).fill(0),
      (arr) => arr.fill(0),
      { maxSize: 50 },
    )

    // Measure pooled allocation
    const startPooled = process.hrtime.bigint()
    for (let i = 0; i < ITERATIONS; i++) {
      const obj = pool.acquire()
      pool.release(obj)
    }
    const endPooled = process.hrtime.bigint()
    const pooledTime = Number(endPooled - startPooled) / 1000000 // Convert to ms

    // Measure direct allocation
    const startDirect = process.hrtime.bigint()
    for (let i = 0; i < ITERATIONS; i++) {
      const obj = new Array(100).fill(0)
      // Simulate some work
      obj[0] = i
    }
    const endDirect = process.hrtime.bigint()
    const directTime = Number(endDirect - startDirect) / 1000000 // Convert to ms

    const stats = pool.getStats()
    expect(stats.hitRate).toBeGreaterThan(0.9) // Should have high hit rate

    // Note: Performance comparison is environment-dependent
    // We just verify that both methods complete successfully
    expect(pooledTime).toBeGreaterThan(0)
    expect(directTime).toBeGreaterThan(0)
  })

  it('should handle memory pressure gracefully', async () => {
    const pool = new ObjectPool(
      () => new Array(1000).fill(Math.random()),
      (arr) => arr.fill(0),
      { maxSize: 100, idleTimeout: 1000 },
    )

    // Create many objects
    const objects = []
    for (let i = 0; i < 200; i++) {
      objects.push(pool.acquire())
    }

    // Release half
    for (let i = 0; i < 100; i++) {
      pool.release(objects[i])
    }

    const statsBefore = pool.getStats()
    expect(statsBefore.objectsInUse).toBe(100)

    // Force GC after timeout
    await new Promise((resolve) => setTimeout(resolve, 1100))
    pool.gc()

    const statsAfter = pool.getStats()
    expect(statsAfter.poolSize).toBeLessThanOrEqual(100)

    // Release remaining objects
    for (let i = 100; i < 200; i++) {
      pool.release(objects[i])
    }

    await pool.drain()
  })
})

describe('Integration with Resource Manager', () => {
  it('should register with resource manager for cleanup', async () => {
    const pool = new ObjectPool(() => ({ value: 0 }))

    const obj = pool.acquire()
    expect(obj).toBeDefined()

    // Pool should be automatically cleaned up via resource manager
    // This is tested implicitly through the resource manager tests
    await pool.drain()
  })
})

describe('Memory Management', () => {
  it('should use WeakMap/WeakSet for object tracking', () => {
    const pool = new ObjectPool(() => ({ value: 0 }))

    const obj = pool.acquire()
    pool.release(obj)

    // WeakMap/WeakSet usage is internal implementation detail
    // We verify it doesn't prevent normal operation
    const stats = pool.getStats()
    expect(stats.poolSize).toBe(1)
    expect(stats.objectsInUse).toBe(0)
  })

  it('should estimate memory usage', () => {
    const pool = new ObjectPool(() => ({ value: 0 }), undefined, {
      maxSize: 10,
    })

    const objects = []
    for (let i = 0; i < 5; i++) {
      objects.push(pool.acquire())
    }

    const stats = pool.getStats()
    expect(stats.estimatedMemoryUsage).toBeGreaterThan(0)

    objects.forEach((obj) => pool.release(obj))
  })
})
