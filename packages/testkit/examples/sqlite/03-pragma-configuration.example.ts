/**
 * Example 3: Pragma Configuration for Test Stability
 *
 * This example shows how to configure SQLite pragmas for optimal
 * test performance and stability, including WAL mode and foreign keys.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import {
  createFileDatabase,
  applyRecommendedPragmas,
  probeEnvironment,
  type FileDatabase,
  type AppliedPragmas,
} from '@template/testkit/sqlite'

// Example database interface
interface Database {
  pragma?(sql: string): unknown
  prepare?(sql: string): { get(): unknown }
  exec(sql: string): void
  get<T = unknown>(sql: string, params?: unknown[]): T | undefined
  close(): Promise<void>
}

// Mock connection function
declare function connectToDatabase(url: string): Promise<Database>

describe('Pragma Configuration', () => {
  let db: Database
  let fileDb: FileDatabase
  let pragmas: AppliedPragmas

  beforeEach(async () => {
    // Create file database (WAL requires file-based DB)
    fileDb = await createFileDatabase('test.db')
    db = await connectToDatabase(fileDb.url)

    // Apply recommended pragmas
    pragmas = await applyRecommendedPragmas(db, {
      busyTimeoutMs: 5000, // 5 second timeout for concurrent access
    })

    // Create schema with foreign keys
    db.exec(`
      CREATE TABLE authors (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE books (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        author_id INTEGER NOT NULL,
        FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
      );
    `)
  })

  afterEach(async () => {
    await db.close()
    await fileDb.cleanup()
  })

  test('should verify pragmas are applied', () => {
    expect(pragmas.journal_mode).toBe('wal')
    expect(pragmas.foreign_keys).toBe('on')
    expect(pragmas.busy_timeout).toBe(5000)
  })

  test('should enforce foreign key constraints', async () => {
    // Add an author
    db.exec(`INSERT INTO authors (id, name) VALUES (1, 'Jane Austen')`)

    // This should succeed
    db.exec(`INSERT INTO books (title, author_id) VALUES ('Pride and Prejudice', 1)`)

    // This should fail due to foreign key constraint
    expect(() => {
      db.exec(`INSERT INTO books (title, author_id) VALUES ('Invalid Book', 999)`)
    }).toThrow(/FOREIGN KEY constraint failed/)
  })

  test('should handle concurrent access with busy timeout', async () => {
    // Simulate concurrent access scenario
    db.exec('BEGIN EXCLUSIVE')

    // Create another connection
    const db2 = await connectToDatabase(fileDb.url)
    await applyRecommendedPragmas(db2, { busyTimeoutMs: 100 }) // Short timeout for test

    // This would normally fail immediately without busy_timeout
    // With timeout, it will wait up to 100ms
    const startTime = Date.now()

    expect(() => {
      db2.exec('BEGIN EXCLUSIVE')
    }).toThrow(/database is locked/)

    const elapsed = Date.now() - startTime
    expect(elapsed).toBeGreaterThanOrEqual(90) // Should have waited ~100ms

    db.exec('COMMIT')
    await db2.close()
  })

  test('should cascade deletes with foreign keys', async () => {
    // Setup data
    db.exec(`
      INSERT INTO authors (id, name) VALUES
        (1, 'Author One'),
        (2, 'Author Two');

      INSERT INTO books (title, author_id) VALUES
        ('Book 1', 1),
        ('Book 2', 1),
        ('Book 3', 2);
    `)

    // Delete author should cascade to books
    db.exec('DELETE FROM authors WHERE id = 1')

    const remainingBooks = db.get<{ count: number }>(`
      SELECT COUNT(*) as count FROM books WHERE author_id = 1
    `)

    expect(remainingBooks?.count).toBe(0) // Books were deleted

    const totalBooks = db.get<{ count: number }>('SELECT COUNT(*) as count FROM books')
    expect(totalBooks?.count).toBe(1) // Only book 3 remains
  })
})

/**
 * Example usage of the exported probeEnvironment function
 */
export async function runEnvironmentProbe(db: Database): Promise<void> {
  // Use the exported probeEnvironment function
  const result = await probeEnvironment(db, {
    logLevel: 'info',
    required: ['foreign_keys'], // Require foreign keys for this example
    pragmaOptions: { busyTimeoutMs: 5000 },
  })

  // Access the detailed results
  console.log('📊 Detailed probe results:')
  console.log('   Pragmas applied:', result.pragmas)
  console.log('   Capabilities:', result.capabilities)

  // Example of conditional logic based on capabilities
  if (!result.capabilities.json1) {
    console.warn('   JSON1 not available - some features may be limited')
  }

  if (!result.capabilities.fts5) {
    console.warn('   FTS5 not available - full-text search disabled')
  }
}
