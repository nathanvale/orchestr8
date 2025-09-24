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
  CleanupTimeoutError,
  DEFAULT_CLEANUP_TIMEOUT,
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

  describe('timeout functionality', () => {
    it('should use default timeout value when no timeout is specified', () => {
      expect(DEFAULT_CLEANUP_TIMEOUT).toBe(5000)
    })

    it('should timeout cleanup functions that exceed timeout limit', async () => {
      const slowCleanup = async () => {
        // This cleanup takes longer than our custom timeout
        await new Promise((resolve) => setTimeout(resolve, 200))
        cleanupExecutions.push('slow cleanup completed')
      }

      registerCleanup(slowCleanup)

      // Use a very short timeout to force timeout
      await expect(executeCleanup(slowCleanup, { timeoutMs: 50 })).rejects.toThrow(
        CleanupTimeoutError,
      )

      // Should still unregister the cleanup function even after timeout
      expect(getDetailedCleanupCount().functions).toBe(0)

      // The slow cleanup should not have completed
      expect(cleanupExecutions).not.toContain('slow cleanup completed')
    })

    it('should timeout database cleanup that exceeds timeout limit', async () => {
      const slowDatabase = new MockDatabase()
      // Override the cleanup method to be slow
      slowDatabase.cleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
        slowDatabase.isCleanedUp = true
      }

      registerDatabaseCleanup(slowDatabase)

      // Use a very short timeout to force timeout
      await expect(executeDatabaseCleanup(slowDatabase, { timeoutMs: 50 })).rejects.toThrow(
        CleanupTimeoutError,
      )

      // Should still unregister the database even after timeout
      expect(getDetailedCleanupCount().databases).toBe(0)

      // The database should not have been cleaned up
      expect(slowDatabase.isCleanedUp).toBe(false)
    })

    it('should include timeout details in CleanupTimeoutError', async () => {
      const slowCleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      registerCleanup(slowCleanup)

      try {
        await executeCleanup(slowCleanup, { timeoutMs: 100 })
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(CleanupTimeoutError)
        const timeoutError = error as CleanupTimeoutError
        expect(timeoutError.name).toBe('CleanupTimeoutError')
        expect(timeoutError.timeoutMs).toBe(100)
        expect(timeoutError.message).toContain('Cleanup function timed out after 100ms')
      }
    })

    it('should include database timeout details in CleanupTimeoutError', async () => {
      const slowDatabase = new MockDatabase()
      slowDatabase.cleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
        slowDatabase.isCleanedUp = true
      }

      registerDatabaseCleanup(slowDatabase)

      try {
        await executeDatabaseCleanup(slowDatabase, { timeoutMs: 75 })
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(CleanupTimeoutError)
        const timeoutError = error as CleanupTimeoutError
        expect(timeoutError.name).toBe('CleanupTimeoutError')
        expect(timeoutError.timeoutMs).toBe(75)
        expect(timeoutError.message).toContain('Database cleanup timed out after 75ms')
      }
    })

    it('should respect custom timeout values in cleanupAll', async () => {
      const fastCleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 25))
        cleanupExecutions.push('fast cleanup done')
      }

      const slowCleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 150))
        cleanupExecutions.push('slow cleanup done')
      }

      const fastDatabase = new MockDatabase()
      const slowDatabase = new MockDatabase()
      slowDatabase.cleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 150))
        slowDatabase.isCleanedUp = true
      }

      testDatabases.push(fastDatabase, slowDatabase)
      registerCleanup(fastCleanup)
      registerCleanup(slowCleanup)
      registerDatabaseCleanup(fastDatabase)
      registerDatabaseCleanup(slowDatabase)

      // Use timeout that allows fast operations but not slow ones
      await cleanupAllSqlite({ timeoutMs: 100 })

      // Fast operations should have completed
      expect(fastDatabase.isCleanedUp).toBe(true)
      expect(cleanupExecutions).toContain('fast cleanup done')

      // Slow operations should have timed out (cleanupAll doesn't throw, just logs warnings)
      expect(slowDatabase.isCleanedUp).toBe(false)
      expect(cleanupExecutions).not.toContain('slow cleanup done')

      // All items should still be removed from registry despite timeouts
      const counts = getDetailedCleanupCount()
      expect(counts.total).toBe(0)
    })

    it('should handle mixed timeout and success scenarios in cleanupAll', async () => {
      const successfulCleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        cleanupExecutions.push('successful cleanup')
      }

      const timeoutCleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
        cleanupExecutions.push('timeout cleanup')
      }

      const errorCleanup = () => {
        cleanupExecutions.push('error cleanup')
        throw new Error('Cleanup error')
      }

      const successDatabase = new MockDatabase()
      const timeoutDatabase = new MockDatabase()
      timeoutDatabase.cleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
        timeoutDatabase.isCleanedUp = true
      }

      testDatabases.push(successDatabase, timeoutDatabase)
      registerCleanup(successfulCleanup)
      registerCleanup(timeoutCleanup)
      registerCleanup(errorCleanup)
      registerDatabaseCleanup(successDatabase)
      registerDatabaseCleanup(timeoutDatabase)

      // Should complete without throwing despite mixed failures
      await expect(cleanupAllSqlite({ timeoutMs: 100 })).resolves.not.toThrow()

      // Successful operations should complete
      expect(successDatabase.isCleanedUp).toBe(true)
      expect(cleanupExecutions).toContain('successful cleanup')
      expect(cleanupExecutions).toContain('error cleanup')

      // Timeout operations should not complete
      expect(timeoutDatabase.isCleanedUp).toBe(false)
      expect(cleanupExecutions).not.toContain('timeout cleanup')

      // Registry should be clear
      const counts = getDetailedCleanupCount()
      expect(counts.total).toBe(0)
    })

    it('should handle synchronous cleanup functions with timeout (should not timeout)', async () => {
      const syncCleanup = () => {
        cleanupExecutions.push('sync cleanup')
      }

      registerCleanup(syncCleanup)

      // Sync cleanup should complete immediately regardless of timeout
      await executeCleanup(syncCleanup, { timeoutMs: 1 })

      expect(cleanupExecutions).toContain('sync cleanup')
      expect(getDetailedCleanupCount().functions).toBe(0)
    })

    it('should handle synchronous database cleanup with timeout (should not timeout)', async () => {
      const syncDatabase = new MockSyncDatabase()

      registerDatabaseCleanup(syncDatabase)

      // Sync cleanup should complete immediately regardless of timeout
      await executeDatabaseCleanup(syncDatabase, { timeoutMs: 1 })

      expect(syncDatabase.isCleanedUp).toBe(true)
      expect(getDetailedCleanupCount().databases).toBe(0)
    })
  })
})
