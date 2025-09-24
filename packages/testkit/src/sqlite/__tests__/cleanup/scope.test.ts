/**
 * Tests for SQLite cleanup scoped functionality
 */

import { describe, it, expect } from 'vitest'
import {
  registerCleanup,
  registerDatabaseCleanup,
  withSqliteCleanupScope,
  useSqliteCleanup,
  createCleanableDatabase,
  createCleanableFileDatabase,
  getCleanupCount,
} from '../../cleanup.js'
import { MockDatabase, MockFileDatabaseImpl, setupTestState } from './shared.js'

describe('SQLite Cleanup Scope', () => {
  const { testDatabases, cleanupExecutions } = setupTestState()

  describe('withSqliteCleanupScope', () => {
    it('should execute function and clean up scoped resources', async () => {
      const db = new MockDatabase()
      testDatabases.push(db)
      let functionExecuted = false

      const result = await withSqliteCleanupScope(async () => {
        registerDatabaseCleanup(db)
        registerCleanup(() => cleanupExecutions.push('scoped'))
        functionExecuted = true
        return 'test result'
      })

      expect(result).toBe('test result')
      expect(functionExecuted).toBe(true)
      expect(db.isCleanedUp).toBe(true)
      expect(cleanupExecutions).toContain('scoped')
    })

    it('should clean up even if scoped function throws', async () => {
      const db = new MockDatabase()
      testDatabases.push(db)

      await expect(
        withSqliteCleanupScope(async () => {
          registerDatabaseCleanup(db)
          registerCleanup(() => cleanupExecutions.push('scoped before error'))
          throw new Error('Scoped function failed')
        }),
      ).rejects.toThrow('Scoped function failed')

      expect(db.isCleanedUp).toBe(true)
      expect(cleanupExecutions).toContain('scoped before error')
    })

    it('should handle nested scopes', async () => {
      const outerDb = new MockDatabase()
      const innerDb = new MockDatabase()
      testDatabases.push(outerDb, innerDb)

      await withSqliteCleanupScope(async () => {
        registerDatabaseCleanup(outerDb)
        registerCleanup(() => cleanupExecutions.push('outer'))

        await withSqliteCleanupScope(async () => {
          registerDatabaseCleanup(innerDb)
          registerCleanup(() => cleanupExecutions.push('inner'))
        })

        // Inner scope should have cleaned up its resources
        expect(innerDb.isCleanedUp).toBe(true)
        expect(cleanupExecutions).toContain('inner')
      })

      expect(outerDb.isCleanedUp).toBe(true)
      expect(cleanupExecutions).toContain('outer')
    })

    it('should return synchronous values', async () => {
      const result = await withSqliteCleanupScope(() => {
        return 42
      })

      expect(result).toBe(42)
    })

    it('should handle empty scopes', async () => {
      const result = await withSqliteCleanupScope(async () => {
        return 'empty scope'
      })

      expect(result).toBe('empty scope')
    })
  })

  describe('useSqliteCleanup', () => {
    it('should create databases with automatic cleanup', async () => {
      const useDatabase = useSqliteCleanup(async () => {
        const db = new MockDatabase()
        testDatabases.push(db)
        return db
      })

      const db = await useDatabase()

      expect(db).toBeInstanceOf(MockDatabase)
      expect(getCleanupCount()).toBeGreaterThan(0) // Should be registered
    })

    it('should handle async database creation', async () => {
      const useAsyncDatabase = useSqliteCleanup(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        const db = new MockDatabase()
        testDatabases.push(db)
        return db
      })

      const db = await useAsyncDatabase()

      expect(db).toBeInstanceOf(MockDatabase)
      expect(getCleanupCount()).toBeGreaterThan(0) // Should be registered
    })

    it('should handle database creation errors', async () => {
      const useFailingDatabase = useSqliteCleanup(() => {
        throw new Error('Database creation failed')
      })

      await expect(useFailingDatabase()).rejects.toThrow('Database creation failed')
    })
  })

  describe('createCleanableDatabase', () => {
    it('should create and register database for cleanup', async () => {
      const db = await createCleanableDatabase(async () => {
        const mockDb = new MockDatabase()
        testDatabases.push(mockDb)
        return mockDb
      })

      expect(db).toBeInstanceOf(MockDatabase)
      expect(getCleanupCount()).toBeGreaterThan(0) // Should be registered
    })

    it('should handle async database creation', async () => {
      const db = await createCleanableDatabase(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        const mockDb = new MockDatabase()
        testDatabases.push(mockDb)
        return mockDb
      })

      expect(db).toBeInstanceOf(MockDatabase)
      expect(getCleanupCount()).toBeGreaterThan(0) // Should be registered
    })

    it('should propagate database creation errors', async () => {
      await expect(
        createCleanableDatabase(() => {
          throw new Error('Creation failed')
        }),
      ).rejects.toThrow('Creation failed')
    })
  })

  describe('createCleanableFileDatabase', () => {
    it('should create and register file database for cleanup', async () => {
      const db = await createCleanableFileDatabase(async () => {
        const mockDb = new MockFileDatabaseImpl('/tmp/test.db')
        return mockDb
      })

      expect(db).toBeInstanceOf(MockFileDatabaseImpl)
      expect(db.path).toBe('/tmp/test.db')
      expect(getCleanupCount()).toBeGreaterThan(0) // Should be registered
    })

    it('should handle async file database creation', async () => {
      const db = await createCleanableFileDatabase(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return new MockFileDatabaseImpl('/tmp/async.db')
      })

      expect(db).toBeInstanceOf(MockFileDatabaseImpl)
      expect(db.path).toBe('/tmp/async.db')
      expect(getCleanupCount()).toBeGreaterThan(0) // Should be registered
    })
  })
})
