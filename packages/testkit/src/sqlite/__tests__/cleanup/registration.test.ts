/**
 * Tests for SQLite cleanup registry registration functionality
 */

import { describe, it, expect } from 'vitest'
import {
  registerCleanup,
  registerDatabaseCleanup,
  unregisterCleanup,
  unregisterDatabaseCleanup,
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

  describe('unregisterCleanup', () => {
    it('should unregister a registered cleanup function', () => {
      const initialCount = getCleanupCount()

      const cleanup = () => {
        cleanupExecutions.push('cleanup')
      }

      // Register the cleanup function
      registerCleanup(cleanup)
      expect(getCleanupCount()).toBe(initialCount + 1)

      // Unregister the cleanup function
      const result = unregisterCleanup(cleanup)
      expect(result).toBe(true)
      expect(getCleanupCount()).toBe(initialCount)

      // Verify detailed counts are updated
      const details = getDetailedCleanupCount()
      expect(details.functions).toBe(0)
    })

    it('should return false when trying to unregister a non-registered function', () => {
      const cleanup = () => {
        cleanupExecutions.push('cleanup')
      }

      // Try to unregister a function that was never registered
      const result = unregisterCleanup(cleanup)
      expect(result).toBe(false)
    })

    it('should return false when trying to unregister an already unregistered function', () => {
      const cleanup = () => {
        cleanupExecutions.push('cleanup')
      }

      // Register and then unregister
      registerCleanup(cleanup)
      const firstUnregister = unregisterCleanup(cleanup)
      expect(firstUnregister).toBe(true)

      // Try to unregister again
      const secondUnregister = unregisterCleanup(cleanup)
      expect(secondUnregister).toBe(false)
    })

    it('should unregister only the specified function', () => {
      const initialCount = getCleanupCount()

      const cleanup1 = () => cleanupExecutions.push('cleanup1')
      const cleanup2 = () => cleanupExecutions.push('cleanup2')

      // Register both functions
      registerCleanup(cleanup1)
      registerCleanup(cleanup2)
      expect(getCleanupCount()).toBe(initialCount + 2)

      // Unregister only the first one
      const result = unregisterCleanup(cleanup1)
      expect(result).toBe(true)
      expect(getCleanupCount()).toBe(initialCount + 1)

      // Verify the second function is still registered
      const details = getDetailedCleanupCount()
      expect(details.functions).toBe(1)
    })
  })

  describe('unregisterDatabaseCleanup', () => {
    it('should unregister a registered database', () => {
      const initialCount = getCleanupCount()

      const db = new MockDatabase()
      testDatabases.push(db)

      // Register the database
      registerDatabaseCleanup(db)
      expect(getCleanupCount()).toBe(initialCount + 1)

      // Unregister the database
      const result = unregisterDatabaseCleanup(db)
      expect(result).toBe(true)
      expect(getCleanupCount()).toBe(initialCount)

      // Verify detailed counts are updated
      const details = getDetailedCleanupCount()
      expect(details.databases).toBe(0)
    })

    it('should return false when trying to unregister a non-registered database', () => {
      const db = new MockDatabase()
      testDatabases.push(db)

      // Try to unregister a database that was never registered
      const result = unregisterDatabaseCleanup(db)
      expect(result).toBe(false)
    })

    it('should return false when trying to unregister an already unregistered database', () => {
      const db = new MockDatabase()
      testDatabases.push(db)

      // Register and then unregister
      registerDatabaseCleanup(db)
      const firstUnregister = unregisterDatabaseCleanup(db)
      expect(firstUnregister).toBe(true)

      // Try to unregister again
      const secondUnregister = unregisterDatabaseCleanup(db)
      expect(secondUnregister).toBe(false)
    })

    it('should unregister only the specified database', () => {
      const initialCount = getCleanupCount()

      const db1 = new MockDatabase()
      const db2 = new MockDatabase()
      testDatabases.push(db1, db2)

      // Register both databases
      registerDatabaseCleanup(db1)
      registerDatabaseCleanup(db2)
      expect(getCleanupCount()).toBe(initialCount + 2)

      // Unregister only the first one
      const result = unregisterDatabaseCleanup(db1)
      expect(result).toBe(true)
      expect(getCleanupCount()).toBe(initialCount + 1)

      // Verify the second database is still registered
      const details = getDetailedCleanupCount()
      expect(details.databases).toBe(1)
    })
  })

  describe('mixed register/unregister operations', () => {
    it('should handle mixed cleanup function and database operations', () => {
      const initialCount = getCleanupCount()

      const cleanup1 = () => cleanupExecutions.push('cleanup1')
      const cleanup2 = () => cleanupExecutions.push('cleanup2')
      const db1 = new MockDatabase()
      const db2 = new MockDatabase()
      testDatabases.push(db1, db2)

      // Register all items
      registerCleanup(cleanup1)
      registerCleanup(cleanup2)
      registerDatabaseCleanup(db1)
      registerDatabaseCleanup(db2)
      expect(getCleanupCount()).toBe(initialCount + 4)

      // Unregister some items
      expect(unregisterCleanup(cleanup1)).toBe(true)
      expect(unregisterDatabaseCleanup(db1)).toBe(true)
      expect(getCleanupCount()).toBe(initialCount + 2)

      // Verify detailed counts
      const details = getDetailedCleanupCount()
      expect(details.functions).toBe(1)
      expect(details.databases).toBe(1)
      expect(details.total).toBe(2)
    })

    it('should maintain registry integrity after multiple operations', () => {
      const cleanup = () => cleanupExecutions.push('cleanup')
      const db = new MockDatabase()
      testDatabases.push(db)

      // Register, unregister, register again
      registerCleanup(cleanup)
      registerDatabaseCleanup(db)
      expect(getCleanupCount()).toBe(2)

      unregisterCleanup(cleanup)
      unregisterDatabaseCleanup(db)
      expect(getCleanupCount()).toBe(0)

      registerCleanup(cleanup)
      registerDatabaseCleanup(db)
      expect(getCleanupCount()).toBe(2)

      // Final cleanup
      expect(unregisterCleanup(cleanup)).toBe(true)
      expect(unregisterDatabaseCleanup(db)).toBe(true)
      expect(getCleanupCount()).toBe(0)
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
