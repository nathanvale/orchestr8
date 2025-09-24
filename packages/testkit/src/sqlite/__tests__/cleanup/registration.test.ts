/**
 * Tests for SQLite cleanup registry registration functionality
 */

import { describe, it, expect } from 'vitest'
import {
  registerCleanup,
  registerDatabaseCleanup,
  getCleanupCount,
  getDetailedCleanupCount,
} from '../../cleanup.js'
import { MockDatabase, setupTestState } from './shared.js'

describe('SQLite Cleanup Registration', () => {
  const { testDatabases, cleanupExecutions } = setupTestState()

  describe('registerCleanup', () => {
    it('should register cleanup functions', () => {
      const initialCount = getCleanupCount()

      const cleanup1 = () => {
        cleanupExecutions.push('cleanup1')
      }
      const cleanup2 = () => {
        cleanupExecutions.push('cleanup2')
      }

      registerCleanup(cleanup1)
      registerCleanup(cleanup2)

      expect(getCleanupCount()).toBe(initialCount + 2)

      const details = getDetailedCleanupCount()
      expect(details.functions).toBe(2)
      expect(details.databases).toBe(0)
      expect(details.total).toBe(2)
    })

    it('should register the same function only once', () => {
      const initialCount = getCleanupCount()

      const cleanup = () => {
        cleanupExecutions.push('cleanup')
      }

      registerCleanup(cleanup)
      registerCleanup(cleanup) // Register same function again
      registerCleanup(cleanup) // And again

      // Should only be registered once due to Set behavior
      expect(getCleanupCount()).toBe(initialCount + 1)
    })
  })

  describe('registerDatabaseCleanup', () => {
    it('should register database objects', () => {
      const initialCount = getCleanupCount()

      const db1 = new MockDatabase()
      const db2 = new MockDatabase()
      testDatabases.push(db1, db2)

      registerDatabaseCleanup(db1)
      registerDatabaseCleanup(db2)

      expect(getCleanupCount()).toBe(initialCount + 2)

      const details = getDetailedCleanupCount()
      expect(details.functions).toBe(0)
      expect(details.databases).toBe(2)
      expect(details.total).toBe(2)
    })

    it('should register the same database only once', () => {
      const initialCount = getCleanupCount()

      const db = new MockDatabase()
      testDatabases.push(db)

      registerDatabaseCleanup(db)
      registerDatabaseCleanup(db) // Register same database again
      registerDatabaseCleanup(db) // And again

      // Should only be registered once due to Set behavior
      expect(getCleanupCount()).toBe(initialCount + 1)
    })
  })

  describe('detailed cleanup counts', () => {
    it('should provide accurate counts for different cleanup types', () => {
      const initialCounts = getDetailedCleanupCount()

      const db1 = new MockDatabase()
      const db2 = new MockDatabase()
      testDatabases.push(db1, db2)

      const cleanup1 = () => cleanupExecutions.push('cleanup1')
      const cleanup2 = () => cleanupExecutions.push('cleanup2')
      const cleanup3 = () => cleanupExecutions.push('cleanup3')

      registerDatabaseCleanup(db1)
      registerDatabaseCleanup(db2)
      registerCleanup(cleanup1)
      registerCleanup(cleanup2)
      registerCleanup(cleanup3)

      const finalCounts = getDetailedCleanupCount()
      expect(finalCounts.databases).toBe(initialCounts.databases + 2)
      expect(finalCounts.functions).toBe(initialCounts.functions + 3)
      expect(finalCounts.total).toBe(initialCounts.total + 5)
    })
  })
})
