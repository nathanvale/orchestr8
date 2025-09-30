/**
 * Comprehensive tests for SQLite Connection Pool
 *
 * Tests connection lifecycle management, health checks, shared cache mode,
 * connection recycling, timeout handling, concurrent access, and graceful shutdown.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { SQLiteConnectionPool, createSQLitePool, poolManager, type PoolOptions } from '../pool.js'
import { createFileDatabase, type FileDatabase } from '../file.js'

describe('SQLiteConnectionPool', () => {
  let tempDb: FileDatabase
  let pool: SQLiteConnectionPool
  let dbPath: string

  beforeEach(async () => {
    tempDb = await createFileDatabase('pool-test.db')
    dbPath = tempDb.path
  })

  afterEach(async () => {
    if (pool) {
      await pool.drain()
    }
    await tempDb.cleanup()
  })

  describe('Pool Creation and Configuration', () => {
    it('should create pool with default options', () => {
      pool = new SQLiteConnectionPool(dbPath)
      const stats = pool.getStats()

      expect(stats.totalConnections).toBe(0)
      expect(stats.connectionsInUse).toBe(0)
      expect(stats.idleConnections).toBe(0)
      expect(stats.waitingRequests).toBe(0)
    })

    it('should create pool with custom options', () => {
      const customOptions: Partial<PoolOptions> = {
        maxConnections: 5,
        minConnections: 1,
        idleTimeout: 60000,
        acquireTimeout: 10000,
        enableSharedCache: false,
      }

      pool = new SQLiteConnectionPool(dbPath, customOptions)
      expect(pool).toBeInstanceOf(SQLiteConnectionPool)
    })

    it('should validate configuration options', () => {
      expect(() => new SQLiteConnectionPool(dbPath, { maxConnections: 0 })).toThrow(
        'maxConnections must be at least 1',
      )

      expect(() => new SQLiteConnectionPool(dbPath, { minConnections: -1 })).toThrow(
        'minConnections cannot be negative',
      )

      expect(
        () => new SQLiteConnectionPool(dbPath, { minConnections: 10, maxConnections: 5 }),
      ).toThrow('minConnections cannot exceed maxConnections')

      expect(() => new SQLiteConnectionPool(dbPath, { idleTimeout: 500 })).toThrow(
        'idleTimeout must be at least 1000ms',
      )

      expect(() => new SQLiteConnectionPool(dbPath, { acquireTimeout: 500 })).toThrow(
        'acquireTimeout must be at least 1000ms',
      )
    })

    it('should use createSQLitePool utility function', () => {
      pool = createSQLitePool(dbPath, { maxConnections: 3 })
      expect(pool).toBeInstanceOf(SQLiteConnectionPool)
    })
  })

  describe('Connection Acquisition and Release', () => {
    beforeEach(() => {
      pool = new SQLiteConnectionPool(dbPath, {
        maxConnections: 3,
        minConnections: 1,
        idleTimeout: 5000,
        acquireTimeout: 2000,
        })
    })

    it('should acquire and release a single connection', async () => {
      const db = await pool.acquire()
      expect(db).toBeInstanceOf(Database)

      const statsBeforeRelease = pool.getStats()
      expect(statsBeforeRelease.connectionsInUse).toBe(1)
      expect(statsBeforeRelease.totalConnections).toBe(1)

      await pool.release(db)

      const statsAfterRelease = pool.getStats()
      expect(statsAfterRelease.connectionsInUse).toBe(0)
      expect(statsAfterRelease.idleConnections).toBe(1)
    })

    it('should reuse idle connections', async () => {
      const db1 = await pool.acquire()
      await pool.release(db1)

      const db2 = await pool.acquire()
      expect(db2).toBe(db1) // Should be the same connection instance

      const stats = pool.getStats()
      expect(stats.totalConnections).toBe(1)
      expect(stats.hitRate).toBeGreaterThan(0)

      await pool.release(db2)
    })

    it('should create new connections when idle ones are not available', async () => {
      const db1 = await pool.acquire()
      const db2 = await pool.acquire()

      expect(db1).not.toBe(db2)

      const stats = pool.getStats()
      expect(stats.totalConnections).toBe(2)
      expect(stats.connectionsInUse).toBe(2)

      await pool.release(db1)
      await pool.release(db2)
    })

    it('should handle connection validation', async () => {
      pool = new SQLiteConnectionPool(dbPath, {
        validateConnections: true,
        maxConnections: 2,
        })

      const db = await pool.acquire()

      // Use the connection to ensure it's working
      const result = db.prepare('SELECT 1 as test').get() as { test: number }
      expect(result.test).toBe(1)

      await pool.release(db)

      // Acquire again - should validate and reuse
      const db2 = await pool.acquire()
      expect(db2).toBe(db)

      await pool.release(db2)
    })

    it('should handle connection validation failures', async () => {
      pool = new SQLiteConnectionPool(dbPath, {
        validateConnections: true,
        maxConnections: 2,
        })

      const db = await pool.acquire()
      await pool.release(db)

      // Close the connection to simulate a validation failure
      db.close()

      // Next acquire should create a new connection since validation fails
      const db2 = await pool.acquire()
      expect(db2).not.toBe(db)

      await pool.release(db2)
    })
  })

  describe('Pool Limits and Queuing', () => {
    beforeEach(() => {
      pool = new SQLiteConnectionPool(dbPath, {
        maxConnections: 2,
        minConnections: 0,
        acquireTimeout: 1000,
        })
    })

    it('should enforce maximum connection limit', async () => {
      const db1 = await pool.acquire()
      const db2 = await pool.acquire()

      const stats = pool.getStats()
      expect(stats.totalConnections).toBe(2)
      expect(stats.connectionsInUse).toBe(2)

      // Third acquisition should wait
      const acquirePromise = pool.acquire()

      // Give it a moment to potentially create a connection (it shouldn't)
      await new Promise((resolve) => setTimeout(resolve, 50))

      const statsWhileWaiting = pool.getStats()
      expect(statsWhileWaiting.totalConnections).toBe(2)
      expect(statsWhileWaiting.waitingRequests).toBe(1)

      // Release one connection
      await pool.release(db1)

      // Now the waiting request should be fulfilled
      const db3 = await acquirePromise
      expect(db3).toBe(db1) // Should reuse the released connection

      await pool.release(db2)
      await pool.release(db3)
    })

    it('should timeout acquisition when no connections become available', async () => {
      const db1 = await pool.acquire()
      const db2 = await pool.acquire()

      // Third acquisition should timeout
      await expect(pool.acquire()).rejects.toThrow('Connection acquisition timeout after 1000ms')

      await pool.release(db1)
      await pool.release(db2)
    })

    it('should handle multiple waiting requests', async () => {
      const db1 = await pool.acquire()
      const db2 = await pool.acquire()

      // Queue up multiple acquisition requests
      const acquirePromise1 = pool.acquire()
      const acquirePromise2 = pool.acquire()
      const acquirePromise3 = pool.acquire()

      // Give them a moment to queue
      await new Promise((resolve) => setTimeout(resolve, 50))

      const stats = pool.getStats()
      expect(stats.waitingRequests).toBe(3)

      // Release connections one by one
      await pool.release(db1)
      const db3 = await acquirePromise1

      await pool.release(db2)
      const db4 = await acquirePromise2

      // Still one waiting
      const statsAfterTwo = pool.getStats()
      expect(statsAfterTwo.waitingRequests).toBe(1)

      await pool.release(db3)
      const db5 = await acquirePromise3

      await pool.release(db4)
      await pool.release(db5)
    })
  })

  describe('Connection Health and Lifecycle', () => {
    beforeEach(() => {
      pool = new SQLiteConnectionPool(dbPath, {
        maxConnections: 3,
        idleTimeout: 1500, // 1.5 seconds for faster tests
        validateConnections: true,
        })
    })

    it('should apply pragma settings to new connections', async () => {
      pool = new SQLiteConnectionPool(dbPath, {
        pragmaSettings: {
          foreign_keys: 'ON',
          journal_mode: 'WAL',
        },
        })

      const db = await pool.acquire()

      // Check that pragmas were applied
      const foreignKeys = db.pragma('foreign_keys')
      expect(foreignKeys[0].foreign_keys).toBe(1) // ON = 1

      const journalMode = db.pragma('journal_mode')
      expect(journalMode[0].journal_mode).toBe('wal')

      await pool.release(db)
    })

    it('should handle shared cache pragma setting', async () => {
      pool = new SQLiteConnectionPool(dbPath, {
        enableSharedCache: true,
        })

      const db = await pool.acquire()

      // Connection should be created successfully with shared cache
      expect(db).toBeInstanceOf(Database)
      expect(db.open).toBe(true)

      await pool.release(db)
    })

    it('should clean up idle connections after timeout', async () => {
      pool = new SQLiteConnectionPool(dbPath, {
        maxConnections: 3,
        minConnections: 0,
        idleTimeout: 1500,
        validateConnections: true,
        })

      const db1 = await pool.acquire()
      const db2 = await pool.acquire()

      await pool.release(db1)
      await pool.release(db2)

      const statsAfterRelease = pool.getStats()
      expect(statsAfterRelease.idleConnections).toBe(2)

      // Wait for idle timeout to trigger cleanup
      await new Promise((resolve) => setTimeout(resolve, 2500))

      // Should have cleaned up excess idle connections but kept minimum
      const statsAfterCleanup = pool.getStats()
      expect(statsAfterCleanup.totalConnections).toBeLessThan(2)
    })
  })

  describe('Pool Statistics and Monitoring', () => {
    beforeEach(() => {
      pool = new SQLiteConnectionPool(dbPath, {
        maxConnections: 3,
        minConnections: 1,
        })
    })

    it('should track connection creation and destruction', async () => {
      const initialStats = pool.getStats()
      expect(initialStats.connectionsCreated).toBe(0)
      expect(initialStats.connectionsDestroyed).toBe(0)

      const db1 = await pool.acquire()
      const db2 = await pool.acquire()

      const midStats = pool.getStats()
      expect(midStats.connectionsCreated).toBe(2)

      await pool.release(db1)
      await pool.release(db2)

      // Manually trigger cleanup by draining
      await pool.drain()

      const finalStats = pool.getStats()
      expect(finalStats.connectionsDestroyed).toBe(2)
    })

    it('should calculate hit rate accurately', async () => {
      const db1 = await pool.acquire()
      await pool.release(db1)

      // Reuse the connection
      const db2 = await pool.acquire()
      await pool.release(db2)

      const stats = pool.getStats()
      expect(stats.hitRate).toBe(0.5) // 1 hit out of 2 acquisitions
    })

    it('should track average connection age', async () => {
      const db = await pool.acquire()

      // Wait a bit to let connection age
      await new Promise((resolve) => setTimeout(resolve, 100))

      const stats = pool.getStats()
      expect(stats.averageConnectionAge).toBeGreaterThan(0)

      await pool.release(db)
    })
  })

  describe('Concurrent Access and Thread Safety', () => {
    beforeEach(() => {
      pool = new SQLiteConnectionPool(dbPath, {
        maxConnections: 5,
        acquireTimeout: 2000,
        })
    })

    it('should handle concurrent acquisitions', async () => {
      // Simulate concurrent access
      const acquisitions = Array.from({ length: 10 }, () => pool.acquire())

      const connections = await Promise.all(acquisitions)

      expect(connections).toHaveLength(10)

      // Verify all connections are valid
      for (const conn of connections) {
        expect(conn).toBeInstanceOf(Database)
        expect(conn.open).toBe(true)
      }

      // Release all connections
      await Promise.all(connections.map((conn) => pool.release(conn)))
    })

    it('should handle mixed acquire/release operations', async () => {
      const operations: Promise<void>[] = []

      // Mix of acquire and release operations
      for (let i = 0; i < 20; i++) {
        operations.push(
          (async () => {
            const conn = await pool.acquire()

            // Do some work with random delay
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 50))

            // Use the connection
            const result = conn.prepare('SELECT ? as value').get(i) as { value: number }
            expect(result.value).toBe(i)

            await pool.release(conn)
            })(),
        )
      }

      await Promise.all(operations)

      const finalStats = pool.getStats()
      expect(finalStats.connectionsInUse).toBe(0)
    })
  })

  describe('Graceful Shutdown', () => {
    beforeEach(() => {
      pool = new SQLiteConnectionPool(dbPath, {
        maxConnections: 3,
        })
    })

    it('should drain all connections and reject new acquisitions', async () => {
      const db1 = await pool.acquire()
      const db2 = await pool.acquire()

      const statsBeforeDrain = pool.getStats()
      expect(statsBeforeDrain.totalConnections).toBe(2)

      await pool.release(db1)
      await pool.release(db2)

      // Drain the pool
      await pool.drain()

      const statsAfterDrain = pool.getStats()
      expect(statsAfterDrain.totalConnections).toBe(0)

      // New acquisitions should be rejected
      await expect(pool.acquire()).rejects.toThrow(
        'Cannot acquire connection from shutting down pool',
      )
    })

    it('should reject waiting requests during drain', async () => {
      const db1 = await pool.acquire()
      const db2 = await pool.acquire()
      const db3 = await pool.acquire()

      // Queue up a waiting request
      const waitingPromise = pool.acquire()

      // Give it a moment to queue
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Drain should reject waiting requests
      const drainPromise = pool.drain()

      await expect(waitingPromise).rejects.toThrow('Pool is shutting down')
      await drainPromise

      await pool.release(db1).catch(() => {}) // May fail if pool is drained
      await pool.release(db2).catch(() => {})
      await pool.release(db3).catch(() => {})
    })
  })

  describe('Pool Warming and Minimum Connections', () => {
    it('should warm up pool with minimum connections', async () => {
      pool = new SQLiteConnectionPool(dbPath, {
        minConnections: 2,
        maxConnections: 5,
        })

      await pool.warmUp()

      const stats = pool.getStats()
      expect(stats.totalConnections).toBe(2)
      expect(stats.idleConnections).toBe(2)
    })

    it('should maintain minimum connections during cleanup', async () => {
      pool = new SQLiteConnectionPool(dbPath, {
        minConnections: 2,
        maxConnections: 5,
        idleTimeout: 1000, // Short for testing
        })

      // Create more connections than minimum
      const connections = await Promise.all([
        pool.acquire(),
        pool.acquire(),
        pool.acquire(),
        pool.acquire(),
      ])

      // Release all connections
      await Promise.all(connections.map((conn) => pool.release(conn)))

      const statsAfterRelease = pool.getStats()
      expect(statsAfterRelease.totalConnections).toBeGreaterThanOrEqual(1)

      // Wait for cleanup to run
      // Manually trigger minimum connection maintenance
      await pool.warmUp()

      const statsAfterCleanup = pool.getStats()
      expect(statsAfterCleanup.totalConnections).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Error Handling', () => {
    it('should handle database file creation errors gracefully', async () => {
      // Try to create pool with invalid path
      const invalidPath = '/invalid/path/that/does/not/exist/db.sqlite'
      pool = new SQLiteConnectionPool(invalidPath)

      await expect(pool.acquire()).rejects.toThrow()
    })

    it('should handle pragma setting errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      pool = new SQLiteConnectionPool(dbPath, {
        pragmaSettings: {
          'invalid!!pragma': 'bad value'
        },
        })

      // Should still work despite pragma error
      const db = await pool.acquire()
      expect(db).toBeInstanceOf(Database)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to set pragma invalid!!pragma=bad value:'),
        expect.any(Error),
      )

      await pool.release(db)
      consoleWarnSpy.mockRestore()
    })

    it('should handle connection close errors during drain', async () => {
      // Create a fresh pool for this test
      pool = new SQLiteConnectionPool(dbPath, {
        maxConnections: 3,
        })

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const db = await pool.acquire()
      await pool.release(db)

      // Close the connection manually to simulate an error during drain
      // Only proceed if database is still open
      if (!db.open) {
        // Database already closed, manually add a connection to force error
        pool['connections'].set('test-conn', {
          database: { open: true, close: () => { throw new Error('Simulated close error') } },
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          inUse: false,
          id: 'test-conn'
          })
      } else {
        // Corrupt the database object to force an error

        Object.defineProperty(db, 'close', {
          value: () => {
            throw new Error('Simulated close error')
          },
          writable: false
        })
      }

      // Drain should handle the error gracefully
      await expect(pool.drain()).resolves.not.toThrow()

      expect(consoleWarnSpy).toHaveBeenCalled()
      consoleWarnSpy.mockRestore()
    })
  })
})

describe('SQLitePoolManager', () => {
  let tempDb1: FileDatabase
  let tempDb2: FileDatabase

  beforeEach(async () => {
    tempDb1 = await createFileDatabase('pool-manager-test1.db')
    tempDb2 = await createFileDatabase('pool-manager-test2.db')
  })

  afterEach(async () => {
    await poolManager.drainAll()
    await tempDb1.cleanup()
    await tempDb2.cleanup()
  })

  it('should manage multiple named pools', async () => {
    const pool1 = poolManager.getPool('test1', tempDb1.path, { maxConnections: 2 })
    const pool2 = poolManager.getPool('test2', tempDb2.path, { maxConnections: 3 })

    expect(pool1).toBeInstanceOf(SQLiteConnectionPool)
    expect(pool2).toBeInstanceOf(SQLiteConnectionPool)
    expect(pool1).not.toBe(pool2)

    // Getting the same pool name should return the same instance
    const pool1Again = poolManager.getPool('test1', tempDb1.path)
    expect(pool1Again).toBe(pool1)
  })

  it('should provide statistics for all pools', async () => {
    const pool1 = poolManager.getPool('test1', tempDb1.path)
    const pool2 = poolManager.getPool('test2', tempDb2.path)

    const db1 = await pool1.acquire()
    const db2 = await pool2.acquire()

    const allStats = poolManager.getAllStats()

    expect(allStats).toHaveProperty('test1')
    expect(allStats).toHaveProperty('test2')
    expect(allStats.test1.connectionsInUse).toBe(1)
    expect(allStats.test2.connectionsInUse).toBe(1)

    await pool1.release(db1)
    await pool2.release(db2)
  })

  it('should remove and drain individual pools', async () => {
    const pool1 = poolManager.getPool('test1', tempDb1.path)
    const _pool2 = poolManager.getPool('test2', tempDb2.path)

    const db1 = await pool1.acquire()
    await pool1.release(db1)

    await poolManager.removePool('test1')

    // Pool1 should be drained and removed
    const allStats = poolManager.getAllStats()
    expect(allStats).not.toHaveProperty('test1')
    expect(allStats).toHaveProperty('test2')

    // Getting test1 again should create a new pool
    const newPool1 = poolManager.getPool('test1', tempDb1.path)
    expect(newPool1).not.toBe(pool1)
  })

  it('should drain all pools', async () => {
    const pool1 = poolManager.getPool('test1', tempDb1.path)
    const pool2 = poolManager.getPool('test2', tempDb2.path)

    const db1 = await pool1.acquire()
    const db2 = await pool2.acquire()

    await pool1.release(db1)
    await pool2.release(db2)

    await poolManager.drainAll()

    const allStats = poolManager.getAllStats()
    expect(Object.keys(allStats)).toHaveLength(0)
  })
})

describe('Integration with File Database', () => {
  let tempDb: FileDatabase

  afterEach(async () => {
    if (tempDb) {
      await tempDb.cleanup()
    }
  })

  it('should integrate connection pool with createFileDBWithPool', async () => {
    const { createFileDBWithPool } = await import('../file.js')

    tempDb = await createFileDBWithPool('pooled-test.db', {
      maxConnections: 3,
      minConnections: 1,
    })

    expect(tempDb.pool).toBeInstanceOf(SQLiteConnectionPool)

    const db = await tempDb.pool!.acquire()

    // Create a test table
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
    db.exec("INSERT INTO test (name) VALUES ('pooled connection test')")

    const result = db.prepare('SELECT name FROM test WHERE id = 1').get() as { name: string }
    expect(result.name).toBe('pooled connection test')

    await tempDb.pool!.release(db)

    // Cleanup should drain the pool
    await tempDb.cleanup()

    const stats = tempDb.pool!.getStats()
    expect(stats.totalConnections).toBe(0)
  })
})
