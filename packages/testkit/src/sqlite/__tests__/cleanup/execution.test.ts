/**
 * Tests for SQLite cleanup registry execution functionality
 */

import { describe, it, expect } from 'vitest'
import {
  registerCleanup,
  registerDatabaseCleanup,
  executeCleanup,
  executeDatabaseCleanup,
  cleanupAllSqlite,
  getDetailedCleanupCount,
} from '../../cleanup.js'
import { MockDatabase, MockFailingDatabase, setupTestState } from './shared.js'

describe('SQLite Cleanup Execution', () => {
  const { testDatabases, cleanupExecutions } = setupTestState()

  describe('executeCleanup', () => {
    it('should execute and unregister cleanup functions', async () => {
      const cleanup = () => {
        cleanupExecutions.push('executed')
      }

      registerCleanup(cleanup)
      expect(getDetailedCleanupCount().functions).toBeGreaterThan(0)

      await executeCleanup(cleanup)

      expect(cleanupExecutions).toEqual(['executed'])
      // Should be unregistered after execution
      expect(getDetailedCleanupCount().functions).toBe(0)
    })

    it('should handle async cleanup functions', async () => {
      const asyncCleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        cleanupExecutions.push('async executed')
      }

      registerCleanup(asyncCleanup)
      await executeCleanup(asyncCleanup)

      expect(cleanupExecutions).toEqual(['async executed'])
    })

    it('should unregister cleanup function even if it throws', async () => {
      const cleanup = () => {
        cleanupExecutions.push('throwing cleanup')
        throw new Error('Cleanup failed')
      }

      registerCleanup(cleanup)
      const initialCount = getDetailedCleanupCount().functions

      await expect(executeCleanup(cleanup)).rejects.toThrow('Cleanup failed')
      expect(cleanupExecutions).toEqual(['throwing cleanup'])

      // Should still be unregistered
      expect(getDetailedCleanupCount().functions).toBe(initialCount - 1)
    })
  })

  describe('executeDatabaseCleanup', () => {
    it('should execute and unregister database cleanup', async () => {
      const db = new MockDatabase()
      testDatabases.push(db)

      registerDatabaseCleanup(db)
      expect(getDetailedCleanupCount().databases).toBeGreaterThan(0)

      await executeDatabaseCleanup(db)

      expect(db.isCleanedUp).toBe(true)
      // Should be unregistered after execution
      expect(getDetailedCleanupCount().databases).toBe(0)
    })

    it('should unregister database even if cleanup throws', async () => {
      const db = new MockDatabase()
      testDatabases.push(db)
      db.shouldThrowOnCleanup = true

      registerDatabaseCleanup(db)
      const initialCount = getDetailedCleanupCount().databases

      await expect(executeDatabaseCleanup(db)).rejects.toThrow('Mock cleanup error')

      // Should still be unregistered
      expect(getDetailedCleanupCount().databases).toBe(initialCount - 1)
    })
  })

  describe('cleanupAllSqlite', () => {
    it('should execute all registered cleanups', async () => {
      const db1 = new MockDatabase()
      const db2 = new MockDatabase()
      testDatabases.push(db1, db2)

      const cleanup1 = () => cleanupExecutions.push('cleanup1')
      const cleanup2 = () => cleanupExecutions.push('cleanup2')

      registerDatabaseCleanup(db1)
      registerDatabaseCleanup(db2)
      registerCleanup(cleanup1)
      registerCleanup(cleanup2)

      await cleanupAllSqlite()

      expect(db1.isCleanedUp).toBe(true)
      expect(db2.isCleanedUp).toBe(true)
      expect(cleanupExecutions).toEqual(expect.arrayContaining(['cleanup1', 'cleanup2']))

      // Registry should be empty after cleanup all
      const counts = getDetailedCleanupCount()
      expect(counts.databases).toBe(0)
      expect(counts.functions).toBe(0)
      expect(counts.total).toBe(0)
    })

    it('should handle mixed success and failure cleanups', async () => {
      const successDb = new MockDatabase()
      const failingDb = new MockFailingDatabase()
      testDatabases.push(successDb)

      const successCleanup = () => cleanupExecutions.push('success')
      const failingCleanup = () => {
        cleanupExecutions.push('failing')
        throw new Error('Function cleanup failed')
      }

      registerDatabaseCleanup(successDb)
      registerDatabaseCleanup(failingDb)
      registerCleanup(successCleanup)
      registerCleanup(failingCleanup)

      // Should not throw - handles failures gracefully
      await expect(cleanupAllSqlite()).resolves.not.toThrow()

      // Successful cleanups should have executed
      expect(successDb.isCleanedUp).toBe(true)
      expect(cleanupExecutions).toEqual(expect.arrayContaining(['success', 'failing']))

      // Registry should be empty even after failures
      const counts = getDetailedCleanupCount()
      expect(counts.total).toBe(0)
    })

    it('should handle empty registry', async () => {
      // Ensure registry is empty
      await cleanupAllSqlite()

      // Should not throw on empty registry
      await expect(cleanupAllSqlite()).resolves.not.toThrow()

      expect(getDetailedCleanupCount().total).toBe(0)
    })

    it('should collect and report cleanup errors without throwing', async () => {
      const successDb = new MockDatabase()
      const failingDb1 = new MockFailingDatabase()
      const failingDb2 = new MockFailingDatabase()
      testDatabases.push(successDb)

      const successCleanup = () => cleanupExecutions.push('success')
      const failingCleanup1 = () => {
        cleanupExecutions.push('failing1')
        throw new Error('First cleanup failed')
      }
      const failingCleanup2 = () => {
        cleanupExecutions.push('failing2')
        throw new Error('Second cleanup failed')
      }

      registerDatabaseCleanup(successDb)
      registerDatabaseCleanup(failingDb1)
      registerDatabaseCleanup(failingDb2)
      registerCleanup(successCleanup)
      registerCleanup(failingCleanup1)
      registerCleanup(failingCleanup2)

      // Capture console.warn calls to verify error reporting
      const originalWarn = console.warn
      const warnCalls: string[] = []
      console.warn = (msg: string) => {
        warnCalls.push(msg)
      }

      try {
        // Should complete without throwing despite multiple failures
        await expect(cleanupAllSqlite()).resolves.not.toThrow()

        // All cleanups should have been attempted
        expect(successDb.isCleanedUp).toBe(true)
        expect(cleanupExecutions).toEqual(
          expect.arrayContaining(['success', 'failing1', 'failing2']),
        )

        // Should have logged individual failures and summary
        expect(warnCalls.some((msg) => msg.includes('Failed to cleanup SQLite database'))).toBe(
          true,
        )
        expect(
          warnCalls.some((msg) => msg.includes('Failed to execute SQLite cleanup function')),
        ).toBe(true)
        expect(
          warnCalls.some(
            (msg) => msg.includes('SQLite cleanup completed with') && msg.includes('error(s)'),
          ),
        ).toBe(true)

        // Registry should be completely cleared despite errors
        expect(getDetailedCleanupCount().total).toBe(0)
      } finally {
        console.warn = originalWarn
      }
    })
  })

  describe('membership checking', () => {
    it('executeCleanup should return false for unregistered functions', async () => {
      const unregisteredCleanup = () => {
        cleanupExecutions.push('unregistered')
      }

      const result = await executeCleanup(unregisteredCleanup)

      expect(result).toBe(false)
      expect(cleanupExecutions).not.toContain('unregistered')
    })

    it('executeCleanup should return true for registered functions', async () => {
      const registeredCleanup = () => {
        cleanupExecutions.push('registered')
      }

      registerCleanup(registeredCleanup)
      const result = await executeCleanup(registeredCleanup)

      expect(result).toBe(true)
      expect(cleanupExecutions).toContain('registered')
    })

    it('executeDatabaseCleanup should return false for unregistered databases', async () => {
      const unregisteredDb = new MockDatabase()
      testDatabases.push(unregisteredDb)

      const result = await executeDatabaseCleanup(unregisteredDb)

      expect(result).toBe(false)
      expect(unregisteredDb.isCleanedUp).toBe(false)
    })

    it('executeDatabaseCleanup should return true for registered databases', async () => {
      const registeredDb = new MockDatabase()
      testDatabases.push(registeredDb)

      registerDatabaseCleanup(registeredDb)
      const result = await executeDatabaseCleanup(registeredDb)

      expect(result).toBe(true)
      expect(registeredDb.isCleanedUp).toBe(true)
    })

    it('should not execute cleanup for function after unregistration', async () => {
      const cleanup = () => {
        cleanupExecutions.push('should not execute')
      }

      registerCleanup(cleanup)
      // First execution should work
      const firstResult = await executeCleanup(cleanup)
      expect(firstResult).toBe(true)

      // Second execution should return false (already unregistered)
      const secondResult = await executeCleanup(cleanup)
      expect(secondResult).toBe(false)
      expect(cleanupExecutions.filter((msg) => msg === 'should not execute')).toHaveLength(1)
    })
  })
})
