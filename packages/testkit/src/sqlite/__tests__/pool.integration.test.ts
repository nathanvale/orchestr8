/**
 * Basic integration test for SQLite Connection Pool
 * Verifies core functionality without complex test setup
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { SQLiteConnectionPool } from '../pool.js'
import { createManagedTempDirectory } from '../../fs/index.js'

describe('SQLiteConnectionPool - Integration', () => {
  let tempDir: Awaited<ReturnType<typeof createManagedTempDirectory>>
  let dbPath: string
  let pool: SQLiteConnectionPool

  beforeEach(async () => {
    tempDir = await createManagedTempDirectory({ prefix: 'pool-test-' })
    dbPath = tempDir.getPath('test.db')
  })

  afterEach(async () => {
    if (pool) {
      await pool.drain()
    }
    await tempDir.cleanup()
  })

  it('should create and use connection pool successfully', async () => {
    pool = new SQLiteConnectionPool(dbPath, {
      maxConnections: 2,
      minConnections: 1,
    })

    // Test basic acquisition and release
    const db = await pool.acquire()
    expect(db).toBeInstanceOf(Database)
    expect(db.open).toBe(true)

    // Test database operations
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
    db.exec("INSERT INTO test (name) VALUES ('pool test')")

    const result = db.prepare('SELECT name FROM test WHERE id = 1').get() as { name: string }
    expect(result.name).toBe('pool test')

    await pool.release(db)

    // Test statistics
    const stats = pool.getStats()
    expect(stats.totalConnections).toBe(1)
    expect(stats.connectionsInUse).toBe(0)
    expect(stats.idleConnections).toBe(1)
  })

  it('should reuse connections efficiently', async () => {
    pool = new SQLiteConnectionPool(dbPath, {
      maxConnections: 2,
    })

    const db1 = await pool.acquire()
    await pool.release(db1)

    const db2 = await pool.acquire()
    expect(db2).toBe(db1) // Should reuse the same connection

    await pool.release(db2)

    const stats = pool.getStats()
    expect(stats.hitRate).toBeGreaterThan(0)
  })

  it('should handle concurrent access', async () => {
    pool = new SQLiteConnectionPool(dbPath, {
      maxConnections: 3,
    })

    // Acquire multiple connections concurrently
    const promises = [pool.acquire(), pool.acquire(), pool.acquire()]

    const connections = await Promise.all(promises)

    // All should be valid but different instances
    expect(connections).toHaveLength(3)
    connections.forEach((conn) => {
      expect(conn).toBeInstanceOf(Database)
      expect(conn.open).toBe(true)
    })

    // Release all
    await Promise.all(connections.map((conn) => pool.release(conn)))

    const stats = pool.getStats()
    expect(stats.connectionsInUse).toBe(0)
    expect(stats.totalConnections).toBe(3)
  })

  it('should apply pragma settings correctly', async () => {
    pool = new SQLiteConnectionPool(dbPath, {
      pragmaSettings: {
        foreign_keys: 'ON',
        journal_mode: 'WAL',
      },
    })

    const db = await pool.acquire()

    // Check that pragmas were applied
    const foreignKeys = db.pragma('foreign_keys')
    expect(foreignKeys).toBe(1) // ON = 1

    const journalMode = db.pragma('journal_mode')
    expect(journalMode).toBe('wal')

    await pool.release(db)
  })

  it('should drain pool gracefully', async () => {
    pool = new SQLiteConnectionPool(dbPath, {
      maxConnections: 2,
    })

    const db1 = await pool.acquire()
    const db2 = await pool.acquire()

    await pool.release(db1)
    await pool.release(db2)

    const statsBefore = pool.getStats()
    expect(statsBefore.totalConnections).toBe(2)

    await pool.drain()

    const statsAfter = pool.getStats()
    expect(statsAfter.totalConnections).toBe(0)

    // Should reject new acquisitions
    await expect(pool.acquire()).rejects.toThrow(
      'Cannot acquire connection from shutting down pool',
    )
  })
})
