import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BufferPool, GlobalBufferPools, createBufferPool, StreamBufferPool } from './buffer-pool'

describe('BufferPool', () => {
  let pool: BufferPool

  beforeEach(() => {
    pool = new BufferPool({
      bufferSize: 1024,
      maxPoolSize: 5,
      initialPoolSize: 2,
    })
  })

  afterEach(() => {
    pool.clear()
  })

  describe('constructor', () => {
    it('should create with default options', () => {
      const defaultPool = new BufferPool()
      expect(defaultPool).toBeDefined()
      defaultPool.clear()
    })

    it('should create with custom options', () => {
      const customPool = new BufferPool({
        bufferSize: 2048,
        maxPoolSize: 10,
        autoGrow: false,
        initialPoolSize: 3,
      })

      expect(customPool.isHealthy()).toBe(true)
      customPool.clear()
    })
  })

  describe('acquire and release', () => {
    it('should acquire and release buffers', () => {
      const pooledBuffer = pool.acquire()

      expect(pooledBuffer.buffer).toBeInstanceOf(Buffer)
      expect(pooledBuffer.size).toBe(1024)
      expect(typeof pooledBuffer.release).toBe('function')

      pooledBuffer.release()

      const stats = pool.getStats()
      expect(stats.inUse).toBe(0)
    })

    it('should reuse released buffers', () => {
      const buffer1 = pool.acquire()
      const originalBuffer = buffer1.buffer

      buffer1.release()

      const buffer2 = pool.acquire()
      expect(buffer2.buffer).toBe(originalBuffer)

      buffer2.release()
    })

    it('should track buffer usage statistics', () => {
      const buffer1 = pool.acquire()
      const buffer2 = pool.acquire()

      const stats = pool.getStats()
      expect(stats.inUse).toBe(2)
      expect(stats.totalReused).toBeGreaterThanOrEqual(0)

      buffer1.release()
      buffer2.release()

      const finalStats = pool.getStats()
      expect(finalStats.inUse).toBe(0)
    })

    it('should handle multiple acquisitions and releases', () => {
      const buffers = []

      // Acquire multiple buffers
      for (let i = 0; i < 3; i++) {
        buffers.push(pool.acquire())
      }

      expect(pool.getStats().inUse).toBe(3)

      // Release all buffers
      for (const buffer of buffers) {
        buffer.release()
      }

      expect(pool.getStats().inUse).toBe(0)
    })
  })

  describe('withBuffer', () => {
    it('should automatically manage buffer lifecycle', async () => {
      let capturedBuffer: Buffer | null = null

      await pool.withBuffer(async (pooledBuffer) => {
        capturedBuffer = pooledBuffer.buffer
        expect(pooledBuffer.size).toBe(1024)
        return 'success'
      })

      // Buffer should be released after operation
      expect(pool.getStats().inUse).toBe(0)
      expect(capturedBuffer).toBeInstanceOf(Buffer)
    })

    it('should handle synchronous operations', async () => {
      const result = await pool.withBuffer((pooledBuffer) => {
        expect(pooledBuffer.buffer).toBeInstanceOf(Buffer)
        return 42
      })

      expect(result).toBe(42)
      expect(pool.getStats().inUse).toBe(0)
    })

    it('should release buffer even if operation throws', async () => {
      await expect(
        pool.withBuffer(() => {
          throw new Error('Test error')
        }),
      ).rejects.toThrow('Test error')

      expect(pool.getStats().inUse).toBe(0)
    })
  })

  describe('withBuffers', () => {
    it('should manage multiple buffers automatically', async () => {
      const result = await pool.withBuffers(3, async (pooledBuffers) => {
        expect(pooledBuffers).toHaveLength(3)
        expect(pooledBuffers.every((pb) => pb.buffer instanceof Buffer)).toBe(true)
        return pooledBuffers.length
      })

      expect(result).toBe(3)
      expect(pool.getStats().inUse).toBe(0)
    })

    it('should release all buffers even if operation throws', async () => {
      await expect(
        pool.withBuffers(2, () => {
          throw new Error('Test error')
        }),
      ).rejects.toThrow('Test error')

      expect(pool.getStats().inUse).toBe(0)
    })
  })

  describe('pool limits', () => {
    it('should respect max pool size', () => {
      const smallPool = new BufferPool({
        bufferSize: 1024,
        maxPoolSize: 2,
        autoGrow: false,
      })

      try {
        const buffer1 = smallPool.acquire()
        const buffer2 = smallPool.acquire()

        // Should throw when trying to acquire beyond max size
        expect(() => smallPool.acquire()).toThrow('Buffer pool exhausted')

        buffer1.release()
        buffer2.release()
      } finally {
        smallPool.clear()
      }
    })

    it('should auto-grow when enabled', () => {
      const growPool = new BufferPool({
        bufferSize: 1024,
        maxPoolSize: 2,
        autoGrow: true,
      })

      try {
        const buffer1 = growPool.acquire()
        const buffer2 = growPool.acquire()
        const buffer3 = growPool.acquire() // Should succeed with auto-grow

        expect(buffer3.buffer).toBeInstanceOf(Buffer)

        buffer1.release()
        buffer2.release()
        buffer3.release()
      } finally {
        growPool.clear()
      }
    })
  })

  describe('resize', () => {
    it('should resize pool capacity', () => {
      pool.resize(10)
      expect(pool.isHealthy()).toBe(true)

      pool.resize(1)
      expect(pool.isHealthy()).toBe(true)
    })

    it('should reject negative sizes', () => {
      expect(() => pool.resize(-1)).toThrow('Pool size cannot be negative')
    })
  })

  describe('warmUp', () => {
    it('should pre-allocate buffers', () => {
      const emptyPool = new BufferPool({ initialPoolSize: 0, maxPoolSize: 10 })

      try {
        emptyPool.warmUp(5)
        const stats = emptyPool.getStats()
        expect(stats.poolSize).toBe(5)
      } finally {
        emptyPool.clear()
      }
    })
  })

  describe('getUtilization', () => {
    it('should calculate utilization percentage', () => {
      const buffer1 = pool.acquire()
      const buffer2 = pool.acquire()

      const utilization = pool.getUtilization()
      expect(utilization).toBe(40) // 2/5 = 40%

      buffer1.release()
      buffer2.release()

      expect(pool.getUtilization()).toBe(0)
    })
  })

  describe('clear', () => {
    it('should clear all buffers and statistics', () => {
      const buffer = pool.acquire()
      buffer.release()

      pool.clear()

      const stats = pool.getStats()
      expect(stats.poolSize).toBe(0)
      expect(stats.inUse).toBe(0)
      expect(stats.totalAllocated).toBe(0)
      expect(stats.totalReused).toBe(0)
    })
  })
})

describe('GlobalBufferPools', () => {
  afterEach(() => {
    GlobalBufferPools.clearAll()
  })

  it('should provide singleton pools for different sizes', () => {
    const pool1 = GlobalBufferPools.getPool(1024)
    const pool2 = GlobalBufferPools.getPool(1024)
    const pool3 = GlobalBufferPools.getPool(2048)

    expect(pool1).toBe(pool2) // Same instance for same size
    expect(pool1).not.toBe(pool3) // Different instance for different size
  })

  it('should provide convenience methods for common sizes', () => {
    const filePool = GlobalBufferPools.getFilePool()
    const smallPool = GlobalBufferPools.getSmallPool()
    const largePool = GlobalBufferPools.getLargePool()

    expect(filePool).toBeDefined()
    expect(smallPool).toBeDefined()
    expect(largePool).toBeDefined()
    expect(filePool).not.toBe(smallPool)
    expect(smallPool).not.toBe(largePool)
  })

  it('should provide statistics for all pools', () => {
    const filePool = GlobalBufferPools.getFilePool()
    const buffer = filePool.acquire()

    const allStats = GlobalBufferPools.getAllStats()
    expect(Object.keys(allStats).length).toBeGreaterThan(0)
    expect(allStats['65536B']).toBeDefined() // 64KB file pool

    buffer.release()
  })

  it('should clear all pools', () => {
    const filePool = GlobalBufferPools.getFilePool()
    const buffer = filePool.acquire()
    buffer.release()

    GlobalBufferPools.clearAll()

    const allStats = GlobalBufferPools.getAllStats()
    expect(Object.keys(allStats)).toHaveLength(0)
  })
})

describe('StreamBufferPool', () => {
  let streamPool: StreamBufferPool

  beforeEach(() => {
    streamPool = new StreamBufferPool({
      bufferSize: 1024,
      maxPoolSize: 5,
      readaheadSize: 2,
    })
  })

  afterEach(() => {
    streamPool.clear()
  })

  it('should acquire buffers for streaming operations', () => {
    const buffer = streamPool.acquireForStream()

    expect(buffer.buffer).toBeInstanceOf(Buffer)
    expect(buffer.size).toBe(1024)

    buffer.release()
    expect(streamPool.getStats().inUse).toBe(0)
  })

  it('should manage readahead buffers', () => {
    const buffer1 = streamPool.acquireForStream()
    const buffer2 = streamPool.acquireForStream()
    const buffer3 = streamPool.acquireForStream() // Should use regular pool

    expect(buffer1.buffer).toBeInstanceOf(Buffer)
    expect(buffer2.buffer).toBeInstanceOf(Buffer)
    expect(buffer3.buffer).toBeInstanceOf(Buffer)

    buffer1.release()
    buffer2.release()
    buffer3.release()
  })

  it('should override clear method properly', () => {
    const buffer = streamPool.acquireForStream()
    buffer.release()

    streamPool.clear()

    const stats = streamPool.getStats()
    expect(stats.poolSize).toBe(0)
    expect(stats.inUse).toBe(0)
  })
})

describe('createBufferPool utility', () => {
  it('should create a buffer pool with options', () => {
    const pool = createBufferPool({
      bufferSize: 2048,
      maxPoolSize: 10,
    })

    expect(pool).toBeInstanceOf(BufferPool)

    const buffer = pool.acquire()
    expect(buffer.size).toBe(2048)
    buffer.release()

    pool.clear()
  })

  it('should create a buffer pool with defaults', () => {
    const pool = createBufferPool()
    expect(pool).toBeInstanceOf(BufferPool)
    pool.clear()
  })
})

describe('Error handling', () => {
  it('should handle double release gracefully', () => {
    const pool = new BufferPool({ maxPoolSize: 2 })

    try {
      const buffer = pool.acquire()
      buffer.release()
      buffer.release() // Should not throw

      expect(pool.getStats().inUse).toBe(0)
    } finally {
      pool.clear()
    }
  })

  it('should handle operations on cleared pool', () => {
    const pool = new BufferPool()

    const buffer = pool.acquire()
    pool.clear()

    // Release after clear should not throw
    expect(() => buffer.release()).not.toThrow()
  })

  it('should handle concurrent operations', async () => {
    const pool = new BufferPool({ maxPoolSize: 10 })

    try {
      const operations = []

      for (let i = 0; i < 5; i++) {
        operations.push(
          pool.withBuffer(async (buffer) => {
            // Simulate some async work
            await new Promise((resolve) => setTimeout(resolve, 10))
            return buffer.size
          }),
        )
      }

      const results = await Promise.all(operations)
      expect(results.every((size) => typeof size === 'number')).toBe(true)
      expect(pool.getStats().inUse).toBe(0)
    } finally {
      pool.clear()
    }
  })
})
