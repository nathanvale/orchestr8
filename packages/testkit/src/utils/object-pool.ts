/**
 * Object Pool Implementation for Performance Optimization
 *
 * @module utils/object-pool
 *
 * Provides generic and specialized object pooling for frequently allocated objects
 * to reduce garbage collection pressure and improve performance. Supports automatic
 * pool size management, statistics monitoring, and proper resource cleanup.
 *
 * ## Features
 *
 * - **Generic Object Pooling** - Reusable pool implementation for any object type
 * - **Specialized Pools** - Optimized pools for buffers, arrays, and promises
 * - **Automatic Size Management** - Dynamic pool sizing based on usage patterns
 * - **Statistics Monitoring** - Detailed metrics for performance analysis
 * - **Memory Management** - WeakMap/WeakSet for better garbage collection
 * - **Resource Cleanup** - Proper cleanup and disposal of pooled objects
 * - **Thread Safety** - Safe for concurrent usage in testing environments
 *
 * ## Usage
 *
 * ```typescript
 * import { ObjectPool, BufferPool, ArrayPool } from '@orchestr8/testkit/utils'
 *
 * // Generic object pool
 * const objectPool = new ObjectPool(
 *   () => ({ data: null }),  // factory
 *   (obj) => { obj.data = null }, // reset
 *   { maxSize: 100 }
 * )
 *
 * const obj = objectPool.acquire()
 * try {
 *   // Use object
 *   obj.data = 'some data'
 * } finally {
 *   objectPool.release(obj)
 * }
 *
 * // Specialized buffer pool
 * const bufferPool = new BufferPool({ defaultSize: 1024 })
 * const buffer = bufferPool.acquire(2048)
 * try {
 *   // Use buffer
 * } finally {
 *   bufferPool.release(buffer)
 * }
 * ```
 *
 * ## Safety Considerations
 *
 * - Always release objects back to the pool to prevent leaks
 * - Objects are automatically reset when returned to prevent data leakage
 * - Pool enforces size limits to prevent memory exhaustion
 * - Weak references are used where appropriate for better GC
 */

import { registerResource, ResourceCategory } from '../resources/index.js'
import { resourceCleanupManager } from './concurrency.js'

/**
 * Factory function for creating new objects
 */
export type ObjectFactory<T> = () => T

/**
 * Function to reset object state when returned to pool
 */
export type ObjectResetter<T> = (obj: T) => void

/**
 * Function to dispose of objects when removed from pool
 */
export type ObjectDisposer<T> = (obj: T) => void | Promise<void>

/**
 * Validator function to check if object is still usable
 */
export type ObjectValidator<T> = (obj: T) => boolean

/**
 * Configuration options for object pool
 */
export interface ObjectPoolOptions {
  /** Maximum number of objects to keep in pool (default: 50) */
  maxSize: number
  /** Minimum number of objects to maintain (default: 0) */
  minSize: number
  /** Time in milliseconds before unused objects are disposed (default: 300000 = 5 minutes) */
  idleTimeout: number
  /** Enable automatic pool size adjustment based on usage (default: true) */
  autoResize: boolean
  /** Target hit rate for pool resizing (default: 0.8) */
  targetHitRate: number
  /** Enable statistics collection (default: true) */
  enableStats: boolean
  /** Enable object validation before reuse (default: false) */
  validateObjects: boolean
}

/**
 * Default pool configuration optimized for testing scenarios
 */
export const DEFAULT_POOL_OPTIONS: ObjectPoolOptions = {
  maxSize: 50,
  minSize: 0,
  idleTimeout: 300000, // 5 minutes
  autoResize: true,
  targetHitRate: 0.8,
  enableStats: true,
  validateObjects: false,
}

/**
 * Pooled object wrapper with metadata
 */
interface PooledObject<T> {
  /** The actual object */
  object: T
  /** Timestamp when object was created */
  createdAt: number
  /** Timestamp of last usage */
  lastUsedAt: number
  /** Number of times object has been reused */
  reuseCount: number
  /** Unique identifier for tracking */
  id: string
}

/**
 * Pool statistics for monitoring and debugging
 */
export interface PoolStats {
  /** Current number of objects in pool */
  poolSize: number
  /** Number of objects currently acquired */
  objectsInUse: number
  /** Number of objects available for reuse */
  objectsAvailable: number
  /** Total objects created since pool start */
  objectsCreated: number
  /** Total objects disposed since pool start */
  objectsDisposed: number
  /** Number of successful acquisitions from pool */
  poolHits: number
  /** Number of acquisitions requiring new object creation */
  poolMisses: number
  /** Pool hit rate (hits / (hits + misses)) */
  hitRate: number
  /** Average object age in milliseconds */
  averageObjectAge: number
  /** Average reuse count per object */
  averageReuseCount: number
  /** Number of validation failures */
  validationFailures: number
  /** Current memory usage estimate in bytes */
  estimatedMemoryUsage: number
}

/**
 * Generic Object Pool implementation
 *
 * Provides a reusable pool for any object type with configurable lifecycle
 * management, automatic resizing, and comprehensive statistics.
 */
export class ObjectPool<T extends object> {
  private pool: Map<string, PooledObject<T>> = new Map()
  private inUse: WeakSet<T> = new WeakSet<T>()
  private objectToId: WeakMap<T, string> = new WeakMap<T, string>()
  private options: ObjectPoolOptions
  private factory: ObjectFactory<T>
  private resetter?: ObjectResetter<T>
  private disposer?: ObjectDisposer<T>
  private validator?: ObjectValidator<T>
  private poolId: string
  private isShuttingDown = false
  private maintenanceInterval?: NodeJS.Timeout
  private stats = {
    objectsCreated: 0,
    objectsDisposed: 0,
    poolHits: 0,
    poolMisses: 0,
    validationFailures: 0,
    lastResizeTime: Date.now(),
  }

  /**
   * Create a new object pool
   *
   * @param factory - Function to create new objects
   * @param resetter - Optional function to reset object state
   * @param options - Pool configuration options
   * @param disposer - Optional function to dispose objects
   * @param validator - Optional function to validate objects
   */
  constructor(
    factory: ObjectFactory<T>,
    resetter?: ObjectResetter<T>,
    options: Partial<ObjectPoolOptions> = {},
    disposer?: ObjectDisposer<T>,
    validator?: ObjectValidator<T>,
  ) {
    this.factory = factory
    this.resetter = resetter
    this.disposer = disposer
    this.validator = validator
    this.options = { ...DEFAULT_POOL_OPTIONS, ...options }
    this.poolId = `object-pool-${Math.random().toString(36).substr(2, 9)}`

    // Validate options
    this.validateOptions()

    // Register with resource manager for automatic cleanup
    registerResource(this.poolId, () => this.drain(), {
      category: ResourceCategory.DATABASE, // Use existing category since OTHER doesn't exist
      description: `Object pool: ${this.poolId}`,
    })

    // Start maintenance tasks
    this.startMaintenance()

    // Initialize minimum objects if specified
    if (this.options.minSize > 0) {
      this.warmUp()
    }
  }

  /**
   * Acquire an object from the pool
   *
   * @returns Object from pool or newly created object
   */
  acquire(): T {
    if (this.isShuttingDown) {
      throw new Error('Cannot acquire object from shutting down pool')
    }

    // Try to get an object from the pool
    const pooledObject = this.findAvailableObject()
    if (pooledObject) {
      if (this.validateObject(pooledObject)) {
        pooledObject.lastUsedAt = Date.now()
        pooledObject.reuseCount++
        this.inUse.add(pooledObject.object)
        this.stats.poolHits++
        return pooledObject.object
      } else {
        // Remove invalid object
        this.removeObject(pooledObject.id)
      }
    }

    // Create new object
    const newObject = this.createObject()
    this.stats.poolMisses++
    return newObject.object
  }

  /**
   * Release an object back to the pool
   *
   * @param obj - Object to release
   */
  release(obj: T): void {
    if (this.isShuttingDown) {
      return
    }

    if (!this.inUse.has(obj)) {
      console.warn('Attempted to release object that was not acquired from pool')
      return
    }

    this.inUse.delete(obj)

    const objectId = this.objectToId.get(obj)
    if (!objectId) {
      console.warn('Could not find object ID for released object')
      return
    }

    const pooledObject = this.pool.get(objectId)
    if (!pooledObject) {
      console.warn('Could not find pooled object for released object')
      return
    }

    // Reset object state if resetter provided
    if (this.resetter) {
      try {
        this.resetter(obj)
      } catch (error) {
        console.warn('Error resetting object, removing from pool:', error)
        this.removeObject(objectId)
        return
      }
    }

    // Check if we should keep the object in pool
    if (this.pool.size >= this.options.maxSize) {
      this.removeObject(objectId)
    } else {
      pooledObject.lastUsedAt = Date.now()
    }
  }

  /**
   * Get current pool statistics
   *
   * @returns Pool statistics object
   */
  getStats(): PoolStats {
    const now = Date.now()
    let totalAge = 0
    let totalReuseCount = 0
    let inUseCount = 0

    for (const pooledObject of Array.from(this.pool.values())) {
      totalAge += now - pooledObject.createdAt
      totalReuseCount += pooledObject.reuseCount

      if (this.inUse.has(pooledObject.object)) {
        inUseCount++
      }
    }

    const poolSize = this.pool.size
    const objectsAvailable = poolSize - inUseCount
    const totalAcquisitions = this.stats.poolHits + this.stats.poolMisses
    const hitRate = totalAcquisitions > 0 ? this.stats.poolHits / totalAcquisitions : 0
    const averageObjectAge = poolSize > 0 ? totalAge / poolSize : 0
    const averageReuseCount = poolSize > 0 ? totalReuseCount / poolSize : 0

    return {
      poolSize,
      objectsInUse: inUseCount,
      objectsAvailable,
      objectsCreated: this.stats.objectsCreated,
      objectsDisposed: this.stats.objectsDisposed,
      poolHits: this.stats.poolHits,
      poolMisses: this.stats.poolMisses,
      hitRate,
      averageObjectAge,
      averageReuseCount,
      validationFailures: this.stats.validationFailures,
      estimatedMemoryUsage: this.estimateMemoryUsage(),
    }
  }

  /**
   * Warm up the pool by creating minimum objects
   */
  async warmUp(): Promise<void> {
    const objectsToCreate = Math.max(0, this.options.minSize - this.pool.size)

    for (let i = 0; i < objectsToCreate; i++) {
      this.createObject()
    }
  }

  /**
   * Drain the pool, disposing all objects
   */
  async drain(): Promise<void> {
    this.isShuttingDown = true

    // Clear maintenance interval
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval)
      this.maintenanceInterval = undefined
    }

    // Dispose all objects
    const objectIds = Array.from(this.pool.keys())
    const disposeFunctions = objectIds.map((id) => () => {
      this.removeObject(id)
      return Promise.resolve()
    })
    await resourceCleanupManager.batch(disposeFunctions, async (fn) => await fn())

    this.pool.clear()
    this.inUse = new WeakSet<T>()
    this.objectToId = new WeakMap<T, string>()
  }

  /**
   * Force garbage collection of unused objects
   */
  gc(): void {
    const now = Date.now()
    const objectsToRemove: string[] = []

    for (const [id, pooledObject] of Array.from(this.pool.entries())) {
      if (
        !this.inUse.has(pooledObject.object) &&
        now - pooledObject.lastUsedAt > this.options.idleTimeout
      ) {
        objectsToRemove.push(id)
      }
    }

    objectsToRemove.forEach((id) => this.removeObject(id))
  }

  /**
   * Resize pool based on usage patterns
   */
  private autoResize(): void {
    if (!this.options.autoResize) {
      return
    }

    const stats = this.getStats()
    const now = Date.now()

    // Only resize if enough time has passed since last resize
    if (now - this.stats.lastResizeTime < 30000) {
      // 30 seconds minimum between resizes
      return
    }

    // If hit rate is too low, consider increasing pool size
    if (stats.hitRate < this.options.targetHitRate && this.pool.size < this.options.maxSize) {
      const increaseAmount = Math.min(5, this.options.maxSize - this.pool.size)
      for (let i = 0; i < increaseAmount; i++) {
        this.createObject()
      }
      this.stats.lastResizeTime = now
    }

    // If pool is underutilized, consider decreasing size
    if (
      stats.hitRate > this.options.targetHitRate + 0.1 &&
      stats.objectsAvailable > this.options.minSize + 5
    ) {
      const decreaseAmount = Math.min(5, stats.objectsAvailable - this.options.minSize)
      let removed = 0

      for (const [id, pooledObject] of Array.from(this.pool.entries())) {
        if (removed >= decreaseAmount) {
          break
        }
        if (!this.inUse.has(pooledObject.object)) {
          this.removeObject(id)
          removed++
        }
      }

      if (removed > 0) {
        this.stats.lastResizeTime = now
      }
    }
  }

  /**
   * Validate options and throw if invalid
   */
  private validateOptions(): void {
    if (this.options.maxSize < 1) {
      throw new Error('maxSize must be at least 1')
    }
    if (this.options.minSize < 0) {
      throw new Error('minSize cannot be negative')
    }
    if (this.options.minSize > this.options.maxSize) {
      throw new Error('minSize cannot exceed maxSize')
    }
    if (this.options.idleTimeout < 1000) {
      throw new Error('idleTimeout must be at least 1000ms')
    }
    if (this.options.targetHitRate < 0 || this.options.targetHitRate > 1) {
      throw new Error('targetHitRate must be between 0 and 1')
    }
  }

  /**
   * Find an available object in the pool
   */
  private findAvailableObject(): PooledObject<T> | null {
    for (const pooledObject of Array.from(this.pool.values())) {
      if (!this.inUse.has(pooledObject.object)) {
        return pooledObject
      }
    }
    return null
  }

  /**
   * Create a new object and add to pool
   */
  private createObject(): PooledObject<T> {
    const obj = this.factory()
    const objectId = `obj-${this.stats.objectsCreated}`

    const pooledObject: PooledObject<T> = {
      object: obj,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      reuseCount: 0,
      id: objectId,
    }

    this.pool.set(objectId, pooledObject)
    this.objectToId.set(obj, objectId)
    this.inUse.add(obj)
    this.stats.objectsCreated++

    return pooledObject
  }

  /**
   * Remove and dispose an object from the pool
   */
  private removeObject(objectId: string): void {
    const pooledObject = this.pool.get(objectId)
    if (!pooledObject) {
      return
    }

    // Remove from tracking
    this.pool.delete(objectId)
    this.inUse.delete(pooledObject.object)
    this.objectToId.delete(pooledObject.object)

    // Dispose if disposer provided
    if (this.disposer) {
      try {
        const result = this.disposer(pooledObject.object)
        if (result && typeof result.then === 'function') {
          ;(result as Promise<void>).catch((error) => {
            console.warn('Error disposing object:', error)
          })
        }
      } catch (error) {
        console.warn('Error disposing object:', error)
      }
    }

    this.stats.objectsDisposed++
  }

  /**
   * Validate an object before reuse
   */
  private validateObject(pooledObject: PooledObject<T>): boolean {
    if (!this.options.validateObjects || !this.validator) {
      return true
    }

    try {
      const isValid = this.validator(pooledObject.object)
      if (!isValid) {
        this.stats.validationFailures++
      }
      return isValid
    } catch {
      this.stats.validationFailures++
      return false
    }
  }

  /**
   * Start maintenance tasks
   */
  private startMaintenance(): void {
    // Run maintenance every 60 seconds
    this.maintenanceInterval = setInterval(() => {
      if (this.isShuttingDown) {
        if (this.maintenanceInterval) {
          clearInterval(this.maintenanceInterval)
          this.maintenanceInterval = undefined
        }
        return
      }

      this.gc()
      this.autoResize()
    }, 60000)
  }

  /**
   * Estimate memory usage of pooled objects
   */
  private estimateMemoryUsage(): number {
    // This is a rough estimate - in real scenarios you might want
    // to provide a custom memory calculator
    const baseObjectSize = 64 // Base object overhead
    const poolSize = this.pool.size
    const metadataSize = poolSize * 128 // Estimated metadata per object

    return poolSize * baseObjectSize + metadataSize
  }
}

/**
 * Specialized Buffer Pool for efficient buffer reuse
 */
export class BufferPool extends ObjectPool<Buffer> {
  private sizeToPool: Map<number, Buffer[]> = new Map()

  constructor(options: Partial<ObjectPoolOptions> & { defaultSize?: number } = {}) {
    const defaultSize = options.defaultSize || 1024

    super(
      () => Buffer.allocUnsafe(defaultSize),
      (buffer) => buffer.fill(0), // Reset buffer contents
      options,
      undefined, // No special disposal needed for buffers
      (buffer) => Buffer.isBuffer(buffer) && buffer.length > 0,
    )
  }

  /**
   * Acquire a buffer of specific size
   */
  acquireSize(size: number): Buffer {
    // For common sizes, try to get from size-specific pools
    if (size <= 64 || size === 1024 || size === 4096 || size === 8192) {
      const sizedBuffers = this.sizeToPool.get(size)
      if (sizedBuffers && sizedBuffers.length > 0) {
        const buffer = sizedBuffers.pop()!
        buffer.fill(0)
        return buffer
      }
    }

    // Fall back to creating new buffer
    return Buffer.allocUnsafe(size)
  }

  /**
   * Release a buffer back to size-specific pool if appropriate
   */
  releaseSize(buffer: Buffer): void {
    const size = buffer.length

    // Only pool common sizes to avoid memory fragmentation
    if (size <= 64 || size === 1024 || size === 4096 || size === 8192) {
      let sizedBuffers = this.sizeToPool.get(size)
      if (!sizedBuffers) {
        sizedBuffers = []
        this.sizeToPool.set(size, sizedBuffers)
      }

      // Limit pool size per buffer size
      if (sizedBuffers.length < 10) {
        buffer.fill(0) // Clear buffer contents
        sizedBuffers.push(buffer)
        return
      }
    }

    // Fall back to regular release for uncommon sizes
    this.release(buffer)
  }
}

/**
 * Specialized Array Pool for efficient array reuse
 */
export class ArrayPool<T = unknown> extends ObjectPool<T[]> {
  constructor(options: Partial<ObjectPoolOptions> = {}) {
    super(
      () => [],
      (array) => {
        array.length = 0 // Clear array contents
      },
      options,
      undefined, // No special disposal needed for arrays
      (array) => Array.isArray(array),
    )
  }

  /**
   * Acquire an array with initial capacity
   */
  acquireWithCapacity(capacity: number): T[] {
    const array = this.acquire()
    if (capacity > 0) {
      array.length = capacity
      array.fill(undefined as T)
    }
    return array
  }
}

/**
 * Specialized Promise Pool for efficient promise reuse
 * Useful for test scenarios with many async operations
 */
interface ControlledPromise {
  promise: Promise<unknown>
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

export class PromisePool extends ObjectPool<ControlledPromise> {
  constructor(options: Partial<ObjectPoolOptions> = {}) {
    super(
      () => {
        let resolve: (value: unknown) => void
        let reject: (reason?: unknown) => void
        const promise = new Promise((res, rej) => {
          resolve = res
          reject = rej
        })
        return { promise, resolve: resolve!, reject: reject! }
      },
      () => {
        // Promises can't be reset, so we don't do anything here
        // The factory will create fresh promises as needed
      },
      options,
    )
  }

  /**
   * Create a new controlled promise
   */
  createPromise<T>(): {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (reason?: unknown) => void
  } {
    const controlled = this.acquire()
    return {
      promise: controlled.promise as Promise<T>,
      resolve: controlled.resolve as (value: T) => void,
      reject: controlled.reject,
    }
  }
}

/**
 * Pool Manager for maintaining multiple named pools
 */
export class PoolManager {
  private pools = new Map<string, ObjectPool<object>>()

  /**
   * Register a named pool
   */
  register<T extends object>(name: string, pool: ObjectPool<T>): void {
    this.pools.set(name, pool as unknown as ObjectPool<object>)
  }

  /**
   * Get a named pool
   */
  get<T extends object>(name: string): ObjectPool<T> | undefined {
    return this.pools.get(name) as unknown as ObjectPool<T>
  }

  /**
   * Remove and drain a named pool
   */
  async remove(name: string): Promise<void> {
    const pool = this.pools.get(name)
    if (pool) {
      await pool.drain()
      this.pools.delete(name)
    }
  }

  /**
   * Get statistics for all pools
   */
  getAllStats(): Record<string, PoolStats> {
    const stats: Record<string, PoolStats> = {}

    for (const [name, pool] of Array.from(this.pools.entries())) {
      stats[name] = pool.getStats()
    }

    return stats
  }

  /**
   * Drain all pools
   */
  async drainAll(): Promise<void> {
    const drainFunctions = Array.from(this.pools.values()).map((pool) => () => pool.drain())
    await resourceCleanupManager.batch(drainFunctions, (fn) => fn())
    this.pools.clear()
  }

  /**
   * Force garbage collection on all pools
   */
  gcAll(): void {
    for (const pool of Array.from(this.pools.values())) {
      pool.gc()
    }
  }
}

/**
 * Global pool manager instance
 */
export const poolManager = new PoolManager()

/**
 * Utility functions for common pooling scenarios
 */
export const PoolUtils = {
  /**
   * Create a buffer pool with common configurations
   */
  createBufferPool: (defaultSize = 1024, maxSize = 50) => new BufferPool({ defaultSize, maxSize }),

  /**
   * Create an array pool with common configurations
   */
  createArrayPool: <T>(maxSize = 50) => new ArrayPool<T>({ maxSize }),

  /**
   * Create a promise pool for test scenarios
   */
  createPromisePool: (maxSize = 20) => new PromisePool({ maxSize }),

  /**
   * Create a generic object pool with factory
   */
  createObjectPool: <T extends object>(
    factory: ObjectFactory<T>,
    resetter?: ObjectResetter<T>,
    maxSize = 50,
  ) => new ObjectPool(factory, resetter, { maxSize }),
}

/**
 * Pre-configured global pools for common use cases
 */
export const GlobalPools = {
  /** Global buffer pool for small buffers (≤ 1KB) */
  smallBuffers: new BufferPool({ defaultSize: 1024, maxSize: 100 }),

  /** Global buffer pool for medium buffers (4KB) */
  mediumBuffers: new BufferPool({ defaultSize: 4096, maxSize: 50 }),

  /** Global array pool for generic arrays */
  arrays: new ArrayPool({ maxSize: 50 }),

  /** Global promise pool for test scenarios */
  promises: new PromisePool({ maxSize: 30 }),
} as const
