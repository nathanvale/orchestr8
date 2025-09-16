/**
 * Buffer pool for efficient memory management during file operations
 */
export interface BufferPoolOptions {
  bufferSize?: number
  maxPoolSize?: number
  autoGrow?: boolean
  initialPoolSize?: number
}

export interface PooledBuffer {
  buffer: Buffer
  size: number
  release(): void
}

/**
 * Buffer pool implementation for reusing buffers in file operations
 */
export class BufferPool {
  private static readonly DEFAULT_BUFFER_SIZE = 64 * 1024 // 64KB
  private static readonly DEFAULT_MAX_POOL_SIZE = 50
  private static readonly DEFAULT_INITIAL_POOL_SIZE = 5

  private readonly bufferSize: number
  private readonly maxPoolSize: number
  private readonly autoGrow: boolean
  private readonly pool: Buffer[] = []
  private readonly inUse = new Set<Buffer>()
  private totalAllocated = 0
  private totalReused = 0
  private peakUsage = 0

  constructor(options: BufferPoolOptions = {}) {
    this.bufferSize = options.bufferSize ?? BufferPool.DEFAULT_BUFFER_SIZE
    this.maxPoolSize = options.maxPoolSize ?? BufferPool.DEFAULT_MAX_POOL_SIZE
    this.autoGrow = options.autoGrow ?? true

    // Pre-allocate initial buffers
    const initialSize = options.initialPoolSize ?? BufferPool.DEFAULT_INITIAL_POOL_SIZE
    for (let i = 0; i < Math.min(initialSize, this.maxPoolSize); i++) {
      this.pool.push(Buffer.allocUnsafe(this.bufferSize))
    }
  }

  /**
   * Get a buffer from the pool
   */
  acquire(): PooledBuffer {
    let buffer: Buffer

    if (this.pool.length > 0) {
      buffer = this.pool.pop()!
      this.totalReused++
    } else if (this.autoGrow || this.inUse.size < this.maxPoolSize) {
      buffer = Buffer.allocUnsafe(this.bufferSize)
      this.totalAllocated++
    } else {
      throw new Error('Buffer pool exhausted and auto-grow is disabled')
    }

    this.inUse.add(buffer)
    this.peakUsage = Math.max(this.peakUsage, this.inUse.size)

    return {
      buffer,
      size: this.bufferSize,
      release: () => this.release(buffer),
    }
  }

  /**
   * Release a buffer back to the pool
   */
  private release(buffer: Buffer): void {
    if (!this.inUse.has(buffer)) {
      return // Already released or not from this pool
    }

    this.inUse.delete(buffer)

    // Return to pool if there's space
    if (this.pool.length < this.maxPoolSize) {
      // Clear the buffer before returning to pool
      buffer.fill(0)
      this.pool.push(buffer)
    }
    // Otherwise, let it be garbage collected
  }

  /**
   * Get a buffer with automatic cleanup
   */
  async withBuffer<T>(operation: (pooledBuffer: PooledBuffer) => Promise<T> | T): Promise<T> {
    const pooledBuffer = this.acquire()
    try {
      return await operation(pooledBuffer)
    } finally {
      pooledBuffer.release()
    }
  }

  /**
   * Get multiple buffers with automatic cleanup
   */
  async withBuffers<T>(
    count: number,
    operation: (pooledBuffers: PooledBuffer[]) => Promise<T> | T,
  ): Promise<T> {
    const pooledBuffers: PooledBuffer[] = []

    try {
      for (let i = 0; i < count; i++) {
        pooledBuffers.push(this.acquire())
      }
      return await operation(pooledBuffers)
    } finally {
      for (const pooledBuffer of pooledBuffers) {
        pooledBuffer.release()
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    poolSize: number
    inUse: number
    totalAllocated: number
    totalReused: number
    peakUsage: number
    reuseRate: number
    memoryUsage: number
  } {
    const total = this.totalAllocated + this.totalReused
    const reuseRate = total > 0 ? this.totalReused / total : 0
    const memoryUsage = (this.pool.length + this.inUse.size) * this.bufferSize

    return {
      poolSize: this.pool.length,
      inUse: this.inUse.size,
      totalAllocated: this.totalAllocated,
      totalReused: this.totalReused,
      peakUsage: this.peakUsage,
      reuseRate,
      memoryUsage,
    }
  }

  /**
   * Clear all buffers from the pool
   */
  clear(): void {
    this.pool.length = 0
    this.inUse.clear()
    this.totalAllocated = 0
    this.totalReused = 0
    this.peakUsage = 0
  }

  /**
   * Resize the pool (shrink or grow)
   */
  resize(newMaxSize: number): void {
    if (newMaxSize < 0) {
      throw new Error('Pool size cannot be negative')
    }

    // If shrinking, remove excess buffers
    if (newMaxSize < this.pool.length) {
      this.pool.splice(newMaxSize)
    }

    // Update max size - growing will happen automatically on acquire()
    Object.defineProperty(this, 'maxPoolSize', {
      value: newMaxSize,
      writable: false,
    })
  }

  /**
   * Check if pool is healthy (not exhausted)
   */
  isHealthy(): boolean {
    return this.pool.length > 0 || (this.autoGrow && this.inUse.size < this.maxPoolSize)
  }

  /**
   * Warm up the pool by pre-allocating buffers
   */
  warmUp(targetSize: number = this.maxPoolSize): void {
    const needed = Math.min(targetSize, this.maxPoolSize) - this.pool.length

    for (let i = 0; i < needed; i++) {
      this.pool.push(Buffer.allocUnsafe(this.bufferSize))
    }
  }

  /**
   * Get buffer utilization as percentage
   */
  getUtilization(): number {
    const totalCapacity = this.maxPoolSize
    const inUse = this.inUse.size
    return totalCapacity > 0 ? (inUse / totalCapacity) * 100 : 0
  }
}

/**
 * Global buffer pool instance with common sizes
 */
export class GlobalBufferPools {
  private static pools = new Map<number, BufferPool>()

  /**
   * Get or create a buffer pool for a specific size
   */
  static getPool(size: number, options?: Omit<BufferPoolOptions, 'bufferSize'>): BufferPool {
    if (!this.pools.has(size)) {
      this.pools.set(
        size,
        new BufferPool({
          ...options,
          bufferSize: size,
        }),
      )
    }
    return this.pools.get(size)!
  }

  /**
   * Get pool for common file operations (64KB)
   */
  static getFilePool(): BufferPool {
    return this.getPool(64 * 1024)
  }

  /**
   * Get pool for small operations (4KB)
   */
  static getSmallPool(): BufferPool {
    return this.getPool(4 * 1024)
  }

  /**
   * Get pool for large operations (1MB)
   */
  static getLargePool(): BufferPool {
    return this.getPool(1024 * 1024)
  }

  /**
   * Clear all global pools
   */
  static clearAll(): void {
    for (const pool of this.pools.values()) {
      pool.clear()
    }
    this.pools.clear()
  }

  /**
   * Get statistics for all pools
   */
  static getAllStats(): Record<string, ReturnType<BufferPool['getStats']>> {
    const stats: Record<string, ReturnType<BufferPool['getStats']>> = {}

    for (const [size, pool] of this.pools.entries()) {
      stats[`${size}B`] = pool.getStats()
    }

    return stats
  }
}

/**
 * Utility function to create a buffer pool with sensible defaults
 */
export function createBufferPool(options?: BufferPoolOptions): BufferPool {
  return new BufferPool(options)
}

/**
 * Decorator for automatic buffer management
 */
export function withBufferPool(poolOrSize?: BufferPool | number) {
  return function <T extends unknown[], R>(
    target: unknown,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>,
  ): TypedPropertyDescriptor<(...args: T) => Promise<R>> {
    const originalMethod = descriptor.value!

    descriptor.value = async function (...args: T): Promise<R> {
      let pool: BufferPool

      if (poolOrSize instanceof BufferPool) {
        pool = poolOrSize
      } else if (typeof poolOrSize === 'number') {
        pool = GlobalBufferPools.getPool(poolOrSize)
      } else {
        pool = GlobalBufferPools.getFilePool()
      }

      return pool.withBuffer(async () => {
        return originalMethod.apply(this, args)
      })
    }

    return descriptor
  }
}

/**
 * Stream-aware buffer pool for processing streams
 */
export class StreamBufferPool extends BufferPool {
  private readonly readaheadBuffers: Buffer[] = []
  private readaheadSize: number

  constructor(options: BufferPoolOptions & { readaheadSize?: number } = {}) {
    super(options)
    this.readaheadSize = options.readaheadSize ?? 3

    // Pre-allocate readahead buffers
    for (let i = 0; i < this.readaheadSize; i++) {
      this.readaheadBuffers.push(Buffer.allocUnsafe(this.bufferSize))
    }
  }

  /**
   * Get next buffer for streaming operations
   */
  acquireForStream(): PooledBuffer {
    // Try to use readahead buffer first
    if (this.readaheadBuffers.length > 0) {
      const buffer = this.readaheadBuffers.pop()!
      this.inUse.add(buffer)

      return {
        buffer,
        size: this.bufferSize,
        release: () => this.releaseFromStream(buffer),
      }
    }

    // Fall back to regular acquisition
    return this.acquire()
  }

  /**
   * Release buffer from stream operations
   */
  private releaseFromStream(buffer: Buffer): void {
    if (!this.inUse.has(buffer)) {
      return
    }

    this.inUse.delete(buffer)

    // Return to readahead if there's space
    if (this.readaheadBuffers.length < this.readaheadSize) {
      buffer.fill(0)
      this.readaheadBuffers.push(buffer)
    } else {
      // Return to regular pool
      this.release(buffer)
    }
  }

  /**
   * Clear readahead buffers
   */
  clear(): void {
    super.clear()
    this.readaheadBuffers.length = 0
  }
}
