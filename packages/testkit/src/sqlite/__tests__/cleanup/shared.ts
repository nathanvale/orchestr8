/**
 * Shared test utilities for SQLite cleanup registry tests
 */

import { afterEach, beforeEach } from 'vitest'
import { cleanupAllSqlite, getCleanupCount, type DatabaseLike } from '../../cleanup.js'

/**
 * Mock database for testing cleanup behavior
 */
export class MockDatabase implements DatabaseLike {
  public isCleanedUp = false
  public shouldThrowOnCleanup = false

  cleanup = async (): Promise<void> => {
    if (this.shouldThrowOnCleanup) {
      throw new Error('Mock cleanup error')
    }
    this.isCleanedUp = true
  }
}

/**
 * Mock database that throws during cleanup
 */
export class MockFailingDatabase implements DatabaseLike {
  cleanup = async (): Promise<void> => {
    throw new Error('Mock cleanup error')
  }
}

/**
 * Mock file database interface for testing
 */
export interface MockFileDatabase extends DatabaseLike {
  path: string
}

/**
 * Mock file database implementation
 */
export class MockFileDatabaseImpl implements MockFileDatabase {
  public isCleanedUp = false

  constructor(public path: string) {}

  cleanup = async (): Promise<void> => {
    this.isCleanedUp = true
  }
}

/**
 * Mock database with synchronous cleanup method
 */
export class MockSyncDatabase implements DatabaseLike {
  public isCleanedUp = false
  public shouldThrowOnCleanup = false

  cleanup = (): void => {
    if (this.shouldThrowOnCleanup) {
      throw new Error('Sync cleanup error')
    }
    this.isCleanedUp = true
  }
}

/**
 * Shared test state
 */
export interface TestState {
  testDatabases: MockDatabase[]
  cleanupExecutions: string[]
}

/**
 * Setup test state for each test
 */
export function setupTestState(): TestState {
  const testDatabases: MockDatabase[] = []
  const cleanupExecutions: string[] = []

  beforeEach(() => {
    // Clear test state
    testDatabases.length = 0
    cleanupExecutions.length = 0
  })

  afterEach(async () => {
    // Clean up any remaining registrations
    await cleanupAllSqlite()

    // Verify cleanup registry is empty
    const remaining = getCleanupCount()
    if (remaining > 0) {
      console.warn(`Test left ${remaining} items in cleanup registry`)
    }
  })

  return { testDatabases, cleanupExecutions }
}
