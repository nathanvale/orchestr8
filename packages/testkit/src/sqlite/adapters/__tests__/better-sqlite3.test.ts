/**
 * Tests for better-sqlite3 adapter
 *
 * These tests are gated behind the TEST_SQLITE_BETTER_SQLITE3 environment variable
 * to avoid requiring the better-sqlite3 dependency unless explicitly testing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  betterSqlite3Adapter,
  betterSqlite3Utils,
  TransactionRollbackError,
  type BetterSqlite3DbLike,
  type BetterSqlite3Transaction,
} from '../better-sqlite3.js'

// Skip all tests if better-sqlite3 testing is not enabled
const isEnabled = process.env.TEST_SQLITE_BETTER_SQLITE3 === 'true'

// Mock database class for testing
class MockBetterSqlite3Database implements BetterSqlite3DbLike {
  public open = true
  public executedSQL: string[] = []
  public pragmaResults = new Map<string, unknown>()
  public shouldThrowOnExec = false
  public shouldThrowOnPragma = false
  public memory = { used: 1024, highwater: 2048 }

  pragma(sql: string): unknown {
    if (this.shouldThrowOnPragma) {
      throw new Error(`Pragma error: ${sql}`)
    }
    this.executedSQL.push(`PRAGMA ${sql}`)
    return this.pragmaResults.get(sql) || null
  }

  prepare(sql: string) {
    this.executedSQL.push(sql)
    return {
      run: (...args: unknown[]) => ({
        changes: 1,
        lastInsertRowid: 1,
      }),
      all: (...args: unknown[]) => [],
      get: (...args: unknown[]) => null,
    }
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.executedSQL.push('BEGIN TRANSACTION')
      try {
        const result = fn()
        this.executedSQL.push('COMMIT')
        return result
      } catch (error) {
        this.executedSQL.push('ROLLBACK')
        throw error
      }
    }
  }

  exec(sql: string): void {
    if (this.shouldThrowOnExec) {
      throw new Error(`Exec error: ${sql}`)
    }
    this.executedSQL.push(sql)
  }

  close(): void {
    this.open = false
  }

  reset(): void {
    this.executedSQL = []
    this.pragmaResults.clear()
    this.shouldThrowOnExec = false
    this.shouldThrowOnPragma = false
    this.open = true
  }

  setPragmaResult(pragma: string, result: unknown): void {
    this.pragmaResults.set(pragma, result)
  }
}

describe.skipIf(!isEnabled)('better-sqlite3 adapter', () => {
  let mockDb: MockBetterSqlite3Database

  beforeEach(() => {
    mockDb = new MockBetterSqlite3Database()
  })

  afterEach(() => {
    mockDb.reset()
  })

  describe('betterSqlite3Adapter.begin', () => {
    it('should create a transaction object', async () => {
      const tx = await betterSqlite3Adapter.begin(mockDb)

      expect(tx).toMatchObject({
        db: mockDb,
        active: true,
      })
      expect(typeof tx.txFn).toBe('function')
      expect(typeof tx.execute).toBe('function')
    })

    it('should throw when database is closed', async () => {
      mockDb.open = false

      await expect(betterSqlite3Adapter.begin(mockDb)).rejects.toThrow(
        'Cannot begin transaction on closed database',
      )
    })
  })

  describe('betterSqlite3Adapter.commit', () => {
    it('should mark transaction as inactive', async () => {
      const tx = await betterSqlite3Adapter.begin(mockDb)
      expect(tx.active).toBe(true)

      await betterSqlite3Adapter.commit(tx)
      expect(tx.active).toBe(false)
    })

    it('should throw when transaction is already inactive', async () => {
      const tx = await betterSqlite3Adapter.begin(mockDb)
      await betterSqlite3Adapter.commit(tx)

      await expect(betterSqlite3Adapter.commit(tx)).rejects.toThrow(
        'Cannot commit inactive transaction',
      )
    })
  })

  describe('betterSqlite3Adapter.rollback', () => {
    it('should mark transaction as inactive and throw rollback error', async () => {
      const tx = await betterSqlite3Adapter.begin(mockDb)
      expect(tx.active).toBe(true)

      await expect(betterSqlite3Adapter.rollback(tx)).rejects.toThrow(TransactionRollbackError)
      expect(tx.active).toBe(false)
    })

    it('should throw when transaction is already inactive', async () => {
      const tx = await betterSqlite3Adapter.begin(mockDb)
      await betterSqlite3Adapter.commit(tx) // Make it inactive

      await expect(betterSqlite3Adapter.rollback(tx)).rejects.toThrow(
        'Cannot rollback inactive transaction',
      )
    })
  })

  describe('betterSqlite3Adapter.pragma', () => {
    it('should execute pragma statements', () => {
      mockDb.setPragmaResult('journal_mode', 'WAL')

      const result = betterSqlite3Adapter.pragma(mockDb, 'journal_mode')

      expect(result).toBe('WAL')
      expect(mockDb.executedSQL).toContain('PRAGMA journal_mode')
    })

    it('should throw when database is closed', () => {
      mockDb.open = false

      expect(() => betterSqlite3Adapter.pragma(mockDb, 'journal_mode')).toThrow(
        'Cannot execute pragma on closed database',
      )
    })

    it('should handle pragma errors', () => {
      mockDb.shouldThrowOnPragma = true

      expect(() => betterSqlite3Adapter.pragma(mockDb, 'invalid_pragma')).toThrow(
        'Pragma execution failed: Pragma error: invalid_pragma',
      )
    })
  })

  describe('betterSqlite3Adapter.exec', () => {
    it('should execute SQL statements', () => {
      const sql = 'CREATE TABLE test (id INTEGER PRIMARY KEY)'

      betterSqlite3Adapter.exec(mockDb, sql)

      expect(mockDb.executedSQL).toContain(sql)
    })

    it('should throw when database is closed', () => {
      mockDb.open = false

      expect(() => betterSqlite3Adapter.exec(mockDb, 'SELECT 1')).toThrow(
        'Cannot execute SQL on closed database',
      )
    })

    it('should handle SQL execution errors', () => {
      mockDb.shouldThrowOnExec = true

      expect(() => betterSqlite3Adapter.exec(mockDb, 'INVALID SQL')).toThrow(
        'SQL execution failed: Exec error: INVALID SQL',
      )
    })
  })

  describe('betterSqlite3Adapter.isHealthy', () => {
    it('should return true for healthy database', () => {
      expect(betterSqlite3Adapter.isHealthy(mockDb)).toBe(true)
    })

    it('should return false for closed database', () => {
      mockDb.open = false
      expect(betterSqlite3Adapter.isHealthy(mockDb)).toBe(false)
    })

    it('should handle exceptions gracefully', () => {
      // Create a mock that throws on property access
      const problematicDb = {
        get open() {
          throw new Error('Property access error')
        },
      } as any

      expect(betterSqlite3Adapter.isHealthy(problematicDb)).toBe(false)
    })
  })

  describe('betterSqlite3Adapter.getStats', () => {
    it('should return complete stats for healthy database', () => {
      mockDb.setPragmaResult('journal_mode', 'WAL')
      mockDb.setPragmaResult('synchronous', 'NORMAL')
      mockDb.setPragmaResult('foreign_keys', 'ON')

      const stats = betterSqlite3Adapter.getStats(mockDb)

      expect(stats).toMatchObject({
        isOpen: true,
        memoryUsed: 1024,
        memoryHighwater: 2048,
        pragmaSettings: expect.objectContaining({
          journalmode: 'WAL',
          synchronous: 'NORMAL',
          foreignkeys: 'ON',
        }),
      })
    })

    it('should return minimal stats for closed database', () => {
      mockDb.open = false

      const stats = betterSqlite3Adapter.getStats(mockDb)

      expect(stats).toEqual({
        isOpen: false,
        pragmaSettings: {},
        memoryUsed: undefined,
        memoryHighwater: undefined,
      })
    })

    it('should handle databases without memory info', () => {
      mockDb.memory = undefined

      const stats = betterSqlite3Adapter.getStats(mockDb)

      expect(stats.memoryUsed).toBeUndefined()
      expect(stats.memoryHighwater).toBeUndefined()
      expect(stats.isOpen).toBe(true)
    })

    it('should handle pragma failures gracefully', () => {
      mockDb.shouldThrowOnPragma = true

      const stats = betterSqlite3Adapter.getStats(mockDb)

      expect(stats.isOpen).toBe(true)
      expect(stats.pragmaSettings).toEqual({})
    })
  })

  describe('transaction execution', () => {
    it('should execute work within transaction', async () => {
      const tx = await betterSqlite3Adapter.begin(mockDb)

      const result = tx.execute(() => {
        mockDb.exec('INSERT INTO test VALUES (1)')
        return 'success'
      })

      expect(result).toBe('success')
      expect(mockDb.executedSQL).toContain('BEGIN TRANSACTION')
      expect(mockDb.executedSQL).toContain('INSERT INTO test VALUES (1)')
      expect(mockDb.executedSQL).toContain('COMMIT')
    })

    it('should rollback transaction on error', async () => {
      const tx = await betterSqlite3Adapter.begin(mockDb)

      expect(() => {
        tx.execute(() => {
          mockDb.exec('INSERT INTO test VALUES (1)')
          throw new Error('Transaction error')
        })
      }).toThrow('Transaction error')

      expect(mockDb.executedSQL).toContain('BEGIN TRANSACTION')
      expect(mockDb.executedSQL).toContain('INSERT INTO test VALUES (1)')
      expect(mockDb.executedSQL).toContain('ROLLBACK')
    })

    it('should throw when executing on inactive transaction', async () => {
      const tx = await betterSqlite3Adapter.begin(mockDb)
      await betterSqlite3Adapter.commit(tx)

      expect(() => {
        tx.execute(() => 'work')
      }).toThrow('Cannot execute on inactive transaction')
    })
  })

  describe('betterSqlite3Utils.withTransaction', () => {
    it('should execute work within transaction and commit', async () => {
      const result = await betterSqlite3Utils.withTransaction(mockDb, (tx) => {
        mockDb.exec('INSERT INTO test VALUES (1)')
        return 'success'
      })

      expect(result).toBe('success')
      expect(mockDb.executedSQL).toContain('BEGIN TRANSACTION')
      expect(mockDb.executedSQL).toContain('INSERT INTO test VALUES (1)')
      expect(mockDb.executedSQL).toContain('COMMIT')
    })

    it('should rollback transaction on error', async () => {
      await expect(
        betterSqlite3Utils.withTransaction(mockDb, (tx) => {
          mockDb.exec('INSERT INTO test VALUES (1)')
          throw new Error('Work failed')
        }),
      ).rejects.toThrow('Work failed')

      expect(mockDb.executedSQL).toContain('BEGIN TRANSACTION')
      expect(mockDb.executedSQL).toContain('INSERT INTO test VALUES (1)')
      expect(mockDb.executedSQL).toContain('ROLLBACK')
    })

    it('should handle async work', async () => {
      const result = await betterSqlite3Utils.withTransaction(mockDb, async (tx) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        mockDb.exec('INSERT INTO test VALUES (1)')
        return 'async success'
      })

      expect(result).toBe('async success')
      expect(mockDb.executedSQL).toContain('INSERT INTO test VALUES (1)')
    })
  })

  describe('betterSqlite3Utils.execMultiple', () => {
    it('should execute multiple SQL statements', () => {
      const statements = [
        'CREATE TABLE users (id INTEGER PRIMARY KEY)',
        'CREATE TABLE posts (id INTEGER PRIMARY KEY)',
        'CREATE INDEX idx_posts_user ON posts(user_id)',
      ]

      betterSqlite3Utils.execMultiple(mockDb, statements)

      expect(mockDb.executedSQL).toContain(statements[0])
      expect(mockDb.executedSQL).toContain(statements[1])
      expect(mockDb.executedSQL).toContain(statements[2])
    })

    it('should skip empty statements', () => {
      const statements = [
        'CREATE TABLE test (id INTEGER)',
        '',
        '   ',
        'INSERT INTO test VALUES (1)',
      ]

      betterSqlite3Utils.execMultiple(mockDb, statements)

      expect(mockDb.executedSQL).toHaveLength(2) // Only non-empty statements
      expect(mockDb.executedSQL).toContain('CREATE TABLE test (id INTEGER)')
      expect(mockDb.executedSQL).toContain('INSERT INTO test VALUES (1)')
    })
  })

  describe('betterSqlite3Utils.setTestingPragmas', () => {
    it('should set recommended testing pragmas', () => {
      betterSqlite3Utils.setTestingPragmas(mockDb)

      expect(mockDb.executedSQL).toContain('PRAGMA journal_mode = MEMORY')
      expect(mockDb.executedSQL).toContain('PRAGMA synchronous = OFF')
      expect(mockDb.executedSQL).toContain('PRAGMA foreign_keys = ON')
      expect(mockDb.executedSQL).toContain('PRAGMA temp_store = MEMORY')
    })

    it('should handle pragma failures gracefully', () => {
      mockDb.shouldThrowOnPragma = true

      // Should not throw, just log warnings
      expect(() => betterSqlite3Utils.setTestingPragmas(mockDb)).not.toThrow()
    })
  })

  describe('betterSqlite3Utils.setProductionPragmas', () => {
    it('should set recommended production pragmas', () => {
      betterSqlite3Utils.setProductionPragmas(mockDb)

      expect(mockDb.executedSQL).toContain('PRAGMA journal_mode = WAL')
      expect(mockDb.executedSQL).toContain('PRAGMA synchronous = NORMAL')
      expect(mockDb.executedSQL).toContain('PRAGMA foreign_keys = ON')
      expect(mockDb.executedSQL).toContain('PRAGMA temp_store = FILE')
    })

    it('should handle pragma failures gracefully', () => {
      mockDb.shouldThrowOnPragma = true

      // Should not throw, just log warnings
      expect(() => betterSqlite3Utils.setProductionPragmas(mockDb)).not.toThrow()
    })
  })

  describe('betterSqlite3Utils.optimize', () => {
    it('should execute PRAGMA optimize', () => {
      betterSqlite3Utils.optimize(mockDb)

      expect(mockDb.executedSQL).toContain('PRAGMA optimize')
    })

    it('should handle optimization failures gracefully', () => {
      mockDb.shouldThrowOnExec = true

      expect(() => betterSqlite3Utils.optimize(mockDb)).not.toThrow()
    })
  })

  describe('betterSqlite3Utils.vacuum', () => {
    it('should execute VACUUM', () => {
      betterSqlite3Utils.vacuum(mockDb)

      expect(mockDb.executedSQL).toContain('VACUUM')
    })

    it('should handle vacuum failures gracefully', () => {
      mockDb.shouldThrowOnExec = true

      expect(() => betterSqlite3Utils.vacuum(mockDb)).not.toThrow()
    })
  })

  describe('TransactionRollbackError', () => {
    it('should create error with default message', () => {
      const error = new TransactionRollbackError()

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('TransactionRollbackError')
      expect(error.message).toBe('Transaction rollback requested')
    })

    it('should create error with custom message', () => {
      const error = new TransactionRollbackError('Custom rollback message')

      expect(error.message).toBe('Custom rollback message')
      expect(error.name).toBe('TransactionRollbackError')
    })
  })
})

// Conditional describe block for when testing is disabled
describe.skipIf(isEnabled)('better-sqlite3 adapter (skipped)', () => {
  it('should skip tests when TEST_SQLITE_BETTER_SQLITE3 is not set', () => {
    console.log(
      '⚠️  better-sqlite3 adapter tests are skipped. ' +
        'Set TEST_SQLITE_BETTER_SQLITE3=true to run these tests.',
    )
    expect(process.env.TEST_SQLITE_BETTER_SQLITE3).not.toBe('true')
  })
})
