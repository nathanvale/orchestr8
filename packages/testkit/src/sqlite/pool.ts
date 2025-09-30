/**
 * SQLite Connection Pool Implementation
 *
 * @module sqlite/pool
 *
 * Provides connection pooling for SQLite databases to improve performance
 * and resource management. Supports connection lifecycle management,
 * health checks, shared cache mode, and automatic resource cleanup.
 *
 * ## Features
 *
 * - **Connection Lifecycle Management** - Automatic connection creation and cleanup
 * - **Connection Health Checks** - Validates connections before reuse
 * - **Shared Cache Mode** - Enables SQLite shared cache for better memory usage
 * - **Connection Recycling** - Reuses healthy connections within idle timeout
 * - **Graceful Shutdown** - Properly closes all connections on pool drain
 * - **Resource Management** - Integrates with testkit resource manager
 * - **Statistics Tracking** - Monitors pool usage and performance metrics
 *
 * ## Usage
 *
 * ```typescript
 * import { SQLiteConnectionPool } from '@orchestr8/testkit/sqlite'
 *
 * const pool = new SQLiteConnectionPool('/tmp/test.db', {
 *   maxConnections: 10,
 *   minConnections: 2,
 *   idleTimeout: 30000,
 *   enableSharedCache: true
 * })
 *
 * // Acquire connection
 * const db = await pool.acquire()
 * try {
 *   // Use connection
 *   db.exec('SELECT 1')
 * } finally {
 *   // Always release back to pool
 *   await pool.release(db)
 * }
 *
 * // Cleanup
 * await pool.drain()
 * ```
 *
 * ## Safety Considerations
 *
 * - Always release connections back to the pool to prevent leaks
 * - Pool enforces maximum connection limits to prevent resource exhaustion
 * - Idle connections are automatically validated before reuse
 * - Failed connections are automatically removed from the pool
 */

import Database from 'better-sqlite3'
import { registerResource, ResourceCategory } from '../resources/index.js'
import { betterSqlite3Adapter, type BetterSqlite3DbLike } from './adapters/better-sqlite3.js'
import { databaseOperationsManager, resourceCleanupManager } from '../utils/concurrency.js'

/**
 * Configuration options for SQLite connection pool
 */
export interface PoolOptions {
  /** Maximum number of connections in the pool (default: 10) */
  maxConnections: number
  /** Minimum number of connections to maintain (default: 2) */
  minConnections: number
  /** Time in milliseconds before idle connections are closed (default: 30000) */
  idleTimeout: number
  /** Time in milliseconds to wait for an available connection (default: 5000) */
  acquireTimeout: number
  /** Enable SQLite shared cache mode for better memory usage (default: true) */
  enableSharedCache: boolean
  /** Pragma settings to apply to new connections */
  pragmaSettings?: Record<string, string>
  /** Enable connection validation before reuse (default: true) */
  validateConnections: boolean
}

/**
 * Default pool configuration optimized for testing scenarios
 */
export const DEFAULT_POOL_OPTIONS: PoolOptions = {
  maxConnections: 10,
  minConnections: 2,
  idleTimeout: 30000, // 30 seconds
  acquireTimeout: 5000, // 5 seconds
  enableSharedCache: true,
  validateConnections: true,
  pragmaSettings: {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    foreign_keys: 'ON',
    temp_store: 'MEMORY',
  },
}

/**
 * Internal connection wrapper with metadata
 */
interface PooledConnection {
  /** The underlying database connection */
  database: Database.Database
  /** Timestamp when connection was created */
  createdAt: number
  /** Timestamp of last usage */
  lastUsedAt: number
  /** Whether connection is currently in use */
  inUse: boolean
  /** Connection ID for tracking */
  id: string
}

/**
 * Connection acquisition request waiting in queue
 */
interface AcquisitionRequest {
  /** Promise resolve function */
  resolve: (db: Database.Database) => void
  /** Promise reject function */
  reject: (error: Error) => void
  /** Timestamp when request was made */
  requestedAt: number
}

/**
 * Pool statistics for monitoring and debugging
 */
export interface PoolStats {
  /** Total number of connections in pool */
  totalConnections: number
  /** Number of connections currently in use */
  connectionsInUse: number
  /** Number of idle connections available */
  idleConnections: number
  /** Number of requests waiting for connections */
  waitingRequests: number
  /** Number of connections created since pool start */
  connectionsCreated: number
  /** Number of connections destroyed since pool start */
  connectionsDestroyed: number
  /** Number of connection validation failures */
  validationFailures: number
  /** Average connection age in milliseconds */
  averageConnectionAge: number
  /** Pool hit rate (successful reuse vs new connections) */
  hitRate: number
}

/**
 * SQLite Connection Pool with automatic lifecycle management
 *
 * Manages a pool of SQLite database connections for improved performance
 * and resource utilization. Supports connection validation, shared cache mode,
 * and automatic cleanup.
 */
export class SQLiteConnectionPool {
  private connections: Map<string, PooledConnection> = new Map()
  private waitingQueue: AcquisitionRequest[] = []
  private options: PoolOptions
  private databasePath: string
  private isShuttingDown = false
  private poolId: string
  private stats = {
    connectionsCreated: 0,
    connectionsDestroyed: 0,
    validationFailures: 0,
    acquisitions: 0,
    hits: 0,
  }
  private cleanupInterval?: NodeJS.Timeout
  private warmupInterval?: NodeJS.Timeout

  /**
   * Create a new SQLite connection pool
   *
   * @param databasePath - Path to SQLite database file
   * @param options - Pool configuration options
   */
  constructor(databasePath: string, options: Partial<PoolOptions> = {}) {
    this.databasePath = databasePath
    this.options = { ...DEFAULT_POOL_OPTIONS, ...options }
    this.poolId = `sqlite-pool-${Math.random().toString(36).substr(2, 9)}`

    // Validate options
    if (this.options.maxConnections < 1) {
      throw new Error('maxConnections must be at least 1')
    }
    if (this.options.minConnections < 0) {
      throw new Error('minConnections cannot be negative')
    }
    if (this.options.minConnections > this.options.maxConnections) {
      throw new Error('minConnections cannot exceed maxConnections')
    }
    if (this.options.idleTimeout < 1000) {
      throw new Error('idleTimeout must be at least 1000ms')
    }
    if (this.options.acquireTimeout < 1000) {
      throw new Error('acquireTimeout must be at least 1000ms')
    }

    // Register with resource manager for automatic cleanup
    registerResource(this.poolId, () => this.drain(), {
      category: ResourceCategory.DATABASE,
      description: `SQLite connection pool: ${databasePath}`,
    })

    // Start background maintenance tasks
    this.startMaintenanceTasks()
  }

  /**
   * Acquire a connection from the pool
   *
   * @returns Promise that resolves to a database connection
   * @throws Error if acquisition times out or pool is shutting down
   */
  async acquire(): Promise<Database.Database> {
    if (this.isShuttingDown) {
      throw new Error('Cannot acquire connection from shutting down pool')
    }

    this.stats.acquisitions++

    // Try to get an existing idle connection
    const idleConnection = this.findIdleConnection()
    if (idleConnection) {
      if (await this.validateConnection(idleConnection)) {
        idleConnection.inUse = true
        idleConnection.lastUsedAt = Date.now()
        this.stats.hits++
        return idleConnection.database
      } else {
        // Remove invalid connection
        await this.destroyConnection(idleConnection.id)
      }
    }

    // Try to create a new connection if under limit
    if (this.connections.size < this.options.maxConnections) {
      const connection = await this.createConnection()
      connection.inUse = true
      return connection.database
    }

    // Wait for a connection to become available
    return this.waitForConnection()
  }

  /**
   * Release a connection back to the pool
   *
   * @param db - Database connection to release
   */
  async release(db: Database.Database): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    const connection = this.findConnectionByDatabase(db)
    if (!connection) {
      console.warn('Attempted to release unknown connection to pool')
      return
    }

    if (!connection.inUse) {
      console.warn('Attempted to release connection that was not in use')
      return
    }

    connection.inUse = false
    connection.lastUsedAt = Date.now()

    // Process waiting queue if we have requests
    this.processWaitingQueue()
  }

  /**
   * Gracefully drain the pool, closing all connections
   *
   * @returns Promise that resolves when all connections are closed
   */
  async drain(): Promise<void> {
    this.isShuttingDown = true

    // Reject all waiting requests
    const waitingRequests = [...this.waitingQueue]
    this.waitingQueue.length = 0

    for (const request of waitingRequests) {
      request.reject(new Error('Pool is shutting down'))
    }

    // Close all connections
    const connectionIds = Array.from(this.connections.keys())
    const destroyFunctions = connectionIds.map((id) => () => this.destroyConnection(id))
    await resourceCleanupManager.batch(destroyFunctions, (fn) => fn())

    this.connections.clear()
  }

  /**
   * Get current pool statistics
   *
   * @returns Pool statistics object
   */
  getStats(): PoolStats {
    const now = Date.now()
    let totalAge = 0
    let inUseCount = 0
    let idleCount = 0

    for (const conn of this.connections.values()) {
      totalAge += now - conn.createdAt
      if (conn.inUse) {
        inUseCount++
      } else {
        idleCount++
      }
    }

    const totalConnections = this.connections.size
    const averageConnectionAge = totalConnections > 0 ? totalAge / totalConnections : 0
    const hitRate = this.stats.acquisitions > 0 ? this.stats.hits / this.stats.acquisitions : 0

    return {
      totalConnections,
      connectionsInUse: inUseCount,
      idleConnections: idleCount,
      waitingRequests: this.waitingQueue.length,
      connectionsCreated: this.stats.connectionsCreated,
      connectionsDestroyed: this.stats.connectionsDestroyed,
      validationFailures: this.stats.validationFailures,
      averageConnectionAge,
      hitRate,
    }
  }

  /**
   * Warm up the pool by creating minimum connections
   */
  async warmUp(): Promise<void> {
    const connectionsToCreate = Math.max(0, this.options.minConnections - this.connections.size)

    const createFunctions = Array.from(
      { length: connectionsToCreate },
      () => () => this.createConnection(),
    )
    await databaseOperationsManager.batch(createFunctions, (fn) => fn())
  }

  /**
   * Find an idle connection that can be reused
   */
  private findIdleConnection(): PooledConnection | null {
    for (const connection of this.connections.values()) {
      if (!connection.inUse) {
        return connection
      }
    }
    return null
  }

  /**
   * Find connection by database instance
   */
  private findConnectionByDatabase(db: Database.Database): PooledConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.database === db) {
        return connection
      }
    }
    return null
  }

  /**
   * Create a new database connection
   */
  private async createConnection(): Promise<PooledConnection> {
    // Note: better-sqlite3 v12+ doesn't support shared cache via constructor options
    // Shared cache is enabled globally or via pragma
    const database = new Database(this.databasePath)

    // Apply pragma settings including shared cache if requested
    if (this.options.pragmaSettings) {
      for (const [pragma, value] of Object.entries(this.options.pragmaSettings)) {
        try {
          betterSqlite3Adapter.pragma(
            database as unknown as BetterSqlite3DbLike,
            `${pragma} = ${value}`,
          )
        } catch (error) {
          console.warn(`Failed to set pragma ${pragma}=${value}:`, error)
        }
      }
    }

    // Enable shared cache if requested via pragma
    if (this.options.enableSharedCache) {
      try {
        betterSqlite3Adapter.pragma(database as unknown as BetterSqlite3DbLike, 'cache=shared')
      } catch (error) {
        console.warn('Failed to enable shared cache:', error)
      }
    }

    const connection: PooledConnection = {
      database,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      inUse: false,
      id: `conn-${this.stats.connectionsCreated}`,
    }

    this.connections.set(connection.id, connection)
    this.stats.connectionsCreated++

    return connection
  }

  /**
   * Destroy a connection and remove it from the pool
   */
  private async destroyConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return
    }

    try {
      if (connection.database.open) {
        connection.database.close()
      }
    } catch (error) {
      console.warn(`Error closing connection ${connectionId}:`, error)
    }

    this.connections.delete(connectionId)
    this.stats.connectionsDestroyed++
  }

  /**
   * Validate that a connection is healthy and ready for use
   */
  private async validateConnection(connection: PooledConnection): Promise<boolean> {
    if (!this.options.validateConnections) {
      return true
    }

    try {
      // Check if connection is healthy using adapter
      const isHealthy = betterSqlite3Adapter.isHealthy(
        connection.database as unknown as BetterSqlite3DbLike,
      )

      if (!isHealthy) {
        this.stats.validationFailures++
        return false
      }

      // Additional validation - try a simple query
      connection.database.prepare('SELECT 1').get()
      return true
    } catch {
      this.stats.validationFailures++
      return false
    }
  }

  /**
   * Wait for a connection to become available
   */
  private async waitForConnection(): Promise<Database.Database> {
    return new Promise((resolve, reject) => {
      const request: AcquisitionRequest = {
        resolve,
        reject,
        requestedAt: Date.now(),
      }

      this.waitingQueue.push(request)

      // Set timeout for acquisition
      setTimeout(() => {
        const index = this.waitingQueue.indexOf(request)
        if (index !== -1) {
          this.waitingQueue.splice(index, 1)
          reject(new Error(`Connection acquisition timeout after ${this.options.acquireTimeout}ms`))
        }
      }, this.options.acquireTimeout)
    })
  }

  /**
   * Process waiting queue when connections become available
   */
  private processWaitingQueue(): void {
    if (this.waitingQueue.length === 0) {
      return
    }

    const idleConnection = this.findIdleConnection()
    if (!idleConnection) {
      return
    }

    const request = this.waitingQueue.shift()
    if (request) {
      idleConnection.inUse = true
      idleConnection.lastUsedAt = Date.now()
      this.stats.hits++
      request.resolve(idleConnection.database)
    }
  }

  /**
   * Start background maintenance tasks
   */
  private startMaintenanceTasks(): void {
    // Clean up idle connections periodically
    const cleanupInterval = setInterval(() => {
      if (this.isShuttingDown) {
        clearInterval(cleanupInterval)
        return
      }

      this.cleanupIdleConnections()
    }, this.options.idleTimeout / 2) // Check twice per idle timeout period

    // Ensure we have minimum connections
    const warmupInterval = setInterval(() => {
      if (this.isShuttingDown) {
        clearInterval(warmupInterval)
        return
      }

      this.maintainMinimumConnections()
    }, 10000) // Check every 10 seconds
  }

  /**
   * Clean up connections that have been idle too long
   */
  private cleanupIdleConnections(): void {
    const now = Date.now()
    const connectionsToRemove: string[] = []

    for (const [id, connection] of this.connections.entries()) {
      if (
        !connection.inUse &&
        now - connection.lastUsedAt > this.options.idleTimeout &&
        this.connections.size > this.options.minConnections
      ) {
        connectionsToRemove.push(id)
      }
    }

    // Remove idle connections
    connectionsToRemove.forEach((id) => {
      this.destroyConnection(id)
    })
  }

  /**
   * Ensure we maintain minimum number of connections
   */
  private async maintainMinimumConnections(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    const currentConnections = this.connections.size
    const minConnections = this.options.minConnections

    if (currentConnections < minConnections) {
      const connectionsToCreate = minConnections - currentConnections

      try {
        const createFunctions = Array.from(
          { length: connectionsToCreate },
          () => () => this.createConnection(),
        )
        await databaseOperationsManager.batch(createFunctions, (fn) => fn())
      } catch (error) {
        console.warn('Failed to maintain minimum connections:', error)
      }
    }
  }
}

/**
 * Utility function to create a connection pool with common defaults
 *
 * @param databasePath - Path to SQLite database file
 * @param options - Optional pool configuration
 * @returns Configured SQLite connection pool
 */
export function createSQLitePool(
  databasePath: string,
  options: Partial<PoolOptions> = {},
): SQLiteConnectionPool {
  return new SQLiteConnectionPool(databasePath, options)
}

/**
 * Pool manager for maintaining multiple named pools
 */
export class SQLitePoolManager {
  private pools = new Map<string, SQLiteConnectionPool>()

  /**
   * Get or create a named pool
   */
  getPool(
    name: string,
    databasePath: string,
    options: Partial<PoolOptions> = {},
  ): SQLiteConnectionPool {
    let pool = this.pools.get(name)

    if (!pool) {
      pool = new SQLiteConnectionPool(databasePath, options)
      this.pools.set(name, pool)
    }

    return pool
  }

  /**
   * Remove and drain a named pool
   */
  async removePool(name: string): Promise<void> {
    const pool = this.pools.get(name)
    if (pool) {
      await pool.drain()
      this.pools.delete(name)
    }
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
   * Get statistics for all pools
   */
  getAllStats(): Record<string, PoolStats> {
    const stats: Record<string, PoolStats> = {}

    for (const [name, pool] of this.pools.entries()) {
      stats[name] = pool.getStats()
    }

    return stats
  }
}

/**
 * Global pool manager instance
 */
export const poolManager = new SQLitePoolManager()
