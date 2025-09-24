/**
 * Tests for SQLite cleanup error handling and resilience
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
import { MockDatabase, MockSyncDatabase, setupTestState } from './shared.js'

describe('SQLite Cleanup Error Handling', () => {
  const { testDatabases, cleanupExecutions } = setupTestState()

  describe('synchronous cleanup handling', () => {
    it('should handle synchronous database cleanup methods', async () => {
      const syncDb = new MockSyncDatabase()
      registerDatabaseCleanup(syncDb)

      await executeDatabaseCleanup(syncDb)
      expect(syncDb.isCleanedUp).toBe(true)
    })

    it('should handle synchronous cleanup functions', async () => {
      const syncCleanup = () => {
        cleanupExecutions.push('sync cleanup')
      }

      registerCleanup(syncCleanup)
      await executeCleanup(syncCleanup)

      expect(cleanupExecutions).toContain('sync cleanup')
    })

    it('should handle mixed sync and async cleanups in cleanupAll', async () => {
      const asyncDb = new MockDatabase()
      const syncDb = new MockSyncDatabase()
      testDatabases.push(asyncDb)

      const asyncCleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        cleanupExecutions.push('async function')
      }
      const syncCleanup = () => cleanupExecutions.push('sync function')

      registerDatabaseCleanup(asyncDb)
      registerDatabaseCleanup(syncDb)
      registerCleanup(asyncCleanup)
      registerCleanup(syncCleanup)

      await cleanupAllSqlite()

      expect(asyncDb.isCleanedUp).toBe(true)
      expect(syncDb.isCleanedUp).toBe(true)
      expect(cleanupExecutions).toContain('async function')
      expect(cleanupExecutions).toContain('sync function')
    })

    it('should handle database cleanup method errors', async () => {
      const syncDb = new MockSyncDatabase()
      syncDb.shouldThrowOnCleanup = true

      registerDatabaseCleanup(syncDb)

      await expect(executeDatabaseCleanup(syncDb)).rejects.toThrow('Sync cleanup error')

      // Should still unregister even after error
      expect(getDetailedCleanupCount().databases).toBe(0)
    })
  })

  describe('error resilience', () => {
    it('should continue cleanup after individual failures in cleanupAll', async () => {
      const successDb = new MockDatabase()
      const failingDb = new MockSyncDatabase()
      failingDb.shouldThrowOnCleanup = true
      testDatabases.push(successDb)

      const successCleanup = () => cleanupExecutions.push('success')
      const failingCleanup = () => {
        cleanupExecutions.push('failing')
        throw new Error('Cleanup function failed')
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

    it('should handle promise rejection in async cleanup functions', async () => {
      const rejectingCleanup = async () => {
        cleanupExecutions.push('rejecting')
        throw new Error('Async cleanup failed')
      }

      registerCleanup(rejectingCleanup)

      await expect(executeCleanup(rejectingCleanup)).rejects.toThrow('Async cleanup failed')
      expect(cleanupExecutions).toContain('rejecting')

      // Should still unregister
      expect(getDetailedCleanupCount().functions).toBe(0)
    })

    it('should handle cleanup functions that return rejected promises', async () => {
      const promiseRejectingCleanup = () => {
        cleanupExecutions.push('promise rejecting')
        return Promise.reject(new Error('Promise rejection'))
      }

      registerCleanup(promiseRejectingCleanup)

      await expect(executeCleanup(promiseRejectingCleanup)).rejects.toThrow('Promise rejection')
      expect(cleanupExecutions).toContain('promise rejecting')

      // Should still unregister
      expect(getDetailedCleanupCount().functions).toBe(0)
    })

    it('should handle non-Error thrown values', async () => {
      const stringThrowingCleanup = () => {
        cleanupExecutions.push('string throwing')
        throw 'String error'
      }

      registerCleanup(stringThrowingCleanup)

      await expect(executeCleanup(stringThrowingCleanup)).rejects.toThrow('String error')
      expect(cleanupExecutions).toContain('string throwing')

      // Should still unregister
      expect(getDetailedCleanupCount().functions).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle cleanup function that modifies cleanupExecutions array', async () => {
      const arrayModifyingCleanup = () => {
        // Clear the array during cleanup
        cleanupExecutions.length = 0
        cleanupExecutions.push('modified')
      }

      registerCleanup(arrayModifyingCleanup)
      cleanupExecutions.push('before')

      await executeCleanup(arrayModifyingCleanup)

      expect(cleanupExecutions).toEqual(['modified'])
    })

    it('should handle cleanup function that takes significant time', async () => {
      const slowCleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        cleanupExecutions.push('slow cleanup done')
      }

      registerCleanup(slowCleanup)

      const startTime = Date.now()
      await executeCleanup(slowCleanup)
      const endTime = Date.now()

      expect(endTime - startTime).toBeGreaterThanOrEqual(45) // Allow some margin
      expect(cleanupExecutions).toContain('slow cleanup done')
    })
  })
})
