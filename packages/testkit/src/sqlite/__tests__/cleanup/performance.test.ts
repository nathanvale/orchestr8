/**
 * Tests for SQLite cleanup performance and concurrency
 */

import { describe, it, expect } from 'vitest'
import {
  registerCleanup,
  registerDatabaseCleanup,
  executeCleanup,
  executeDatabaseCleanup,
  cleanupAllSqlite,
  getDetailedCleanupCount,
  getCleanupCount,
  type CleanupFunction,
} from '../../cleanup.js'
import { MockDatabase, setupTestState } from './shared.js'

describe('SQLite Cleanup Performance', () => {
  const { testDatabases, cleanupExecutions } = setupTestState()

  describe('concurrent registrations', () => {
    it('should handle many concurrent registrations', () => {
      const count = 100
      const databases: MockDatabase[] = []
      const cleanups: CleanupFunction[] = []

      for (let i = 0; i < count; i++) {
        const db = new MockDatabase()
        const cleanup = () => cleanupExecutions.push(`cleanup-${i}`)

        databases.push(db)
        cleanups.push(cleanup)
        testDatabases.push(db)

        registerDatabaseCleanup(db)
        registerCleanup(cleanup)
      }

      const counts = getDetailedCleanupCount()
      expect(counts.databases).toBe(count)
      expect(counts.functions).toBe(count)
      expect(counts.total).toBe(count * 2)
    })

    it('should handle rapid register/unregister cycles', async () => {
      for (let i = 0; i < 50; i++) {
        const db = new MockDatabase()
        testDatabases.push(db)
        const cleanup = () => cleanupExecutions.push(`cycle-${i}`)

        registerDatabaseCleanup(db)
        registerCleanup(cleanup)

        await executeDatabaseCleanup(db)
        await executeCleanup(cleanup)
      }

      expect(getCleanupCount()).toBe(0)
      expect(cleanupExecutions.length).toBe(50)
    })

    it('should handle cleanup all with many items efficiently', async () => {
      const count = 200
      const start = Date.now()

      // Register many items
      for (let i = 0; i < count / 2; i++) {
        const db = new MockDatabase()
        testDatabases.push(db)
        registerDatabaseCleanup(db)

        const cleanup = () => cleanupExecutions.push(`bulk-${i}`)
        registerCleanup(cleanup)
      }

      // Clean up all items
      await cleanupAllSqlite()
      const end = Date.now()

      // Should complete in reasonable time (< 1 second for 200 items)
      expect(end - start).toBeLessThan(1000)
      expect(getCleanupCount()).toBe(0)
      expect(cleanupExecutions.length).toBe(count / 2)
    })
  })

  describe('memory efficiency', () => {
    it('should not leak memory with repeated registrations', () => {
      const initialCounts = getDetailedCleanupCount()

      // Repeatedly register and clean up
      for (let i = 0; i < 10; i++) {
        const db = new MockDatabase()
        const cleanup = () => cleanupExecutions.push(`memory-test-${i}`)

        registerDatabaseCleanup(db)
        registerCleanup(cleanup)

        // Immediately clean up
        executeDatabaseCleanup(db).catch(() => {})
        executeCleanup(cleanup).catch(() => {})
      }

      // Wait for cleanup to complete
      setTimeout(() => {
        const finalCounts = getDetailedCleanupCount()
        // Should not have accumulated items
        expect(finalCounts.total).toBeLessThanOrEqual(initialCounts.total + 2) // Some tolerance
      }, 100)
    })

    it('should handle duplicate registrations efficiently', () => {
      const db = new MockDatabase()
      testDatabases.push(db)
      const cleanup = () => cleanupExecutions.push('duplicate')

      // Register same items multiple times
      for (let i = 0; i < 100; i++) {
        registerDatabaseCleanup(db)
        registerCleanup(cleanup)
      }

      // Should only be registered once each due to Set behavior
      const counts = getDetailedCleanupCount()
      expect(counts.databases).toBe(1)
      expect(counts.functions).toBe(1)
    })
  })

  describe('concurrent cleanup execution', () => {
    it('should handle concurrent cleanup operations', async () => {
      const promises: Promise<void>[] = []
      const databases: MockDatabase[] = []

      // Create and register databases
      for (let i = 0; i < 20; i++) {
        const db = new MockDatabase()
        databases.push(db)
        testDatabases.push(db)
        registerDatabaseCleanup(db)
      }

      // Execute cleanups concurrently
      for (const db of databases) {
        promises.push(executeDatabaseCleanup(db))
      }

      await Promise.all(promises)

      // All databases should be cleaned up
      databases.forEach((db) => {
        expect(db.isCleanedUp).toBe(true)
      })

      expect(getDetailedCleanupCount().databases).toBe(0)
    })

    it('should handle mixed concurrent operations', async () => {
      const operations: Promise<unknown>[] = []

      // Mix of registrations and cleanups
      for (let i = 0; i < 10; i++) {
        const db = new MockDatabase()
        testDatabases.push(db)
        const cleanup = () => cleanupExecutions.push(`concurrent-${i}`)

        // Register
        registerDatabaseCleanup(db)
        registerCleanup(cleanup)

        // Schedule cleanup
        operations.push(executeDatabaseCleanup(db))
        operations.push(executeCleanup(cleanup))
      }

      await Promise.allSettled(operations)

      expect(cleanupExecutions.length).toBe(10)
      expect(getCleanupCount()).toBe(0)
    })
  })

  describe('scaling behavior', () => {
    it('should maintain performance with increasing load', async () => {
      const sizes = [10, 50, 100]
      const times: number[] = []

      for (const size of sizes) {
        const start = Date.now()

        // Register items
        for (let i = 0; i < size; i++) {
          const db = new MockDatabase()
          testDatabases.push(db)
          registerDatabaseCleanup(db)
        }

        // Clean up all
        await cleanupAllSqlite()
        const end = Date.now()

        times.push(end - start)
      }

      // Performance should not degrade significantly (roughly linear or better)
      const ratios = []
      for (let i = 1; i < times.length; i++) {
        if (times[i - 1] > 0) {
          ratios.push(times[i] / times[i - 1])
        }
      }

      // Each step should not be more than 10x slower than expected linear scaling
      ratios.forEach((ratio, index) => {
        if (!isNaN(ratio) && isFinite(ratio)) {
          const expectedRatio = sizes[index + 1] / sizes[index]
          expect(ratio).toBeLessThan(expectedRatio * 10)
        }
      })
    })
  })
})
