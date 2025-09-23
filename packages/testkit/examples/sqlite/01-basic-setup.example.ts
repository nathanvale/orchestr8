/**
 * Example 1: Basic SQLite Test Setup
 *
 * This example shows the fundamental setup for SQLite testing
 * with proper initialization, cleanup, and isolation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { createFileDatabase, applyMigrations, seedWithSql } from '@template/testkit/sqlite'
import type { FileDatabase } from '@template/testkit/sqlite'

// Example types for demonstration
interface Database {
  exec(sql: string): void
  get<T = unknown>(sql: string, params?: unknown[]): T | undefined
  all<T = unknown>(sql: string, params?: unknown[]): T[]
  close(): Promise<void>
}

// Mock database connection function for example
declare function connectToDatabase(url: string): Promise<Database>

describe('Basic SQLite Test Setup', () => {
  let db: Database
  let fileDb: FileDatabase

  beforeEach(async () => {
    // 1. Create a fresh database for each test
    fileDb = await createFileDatabase('test.db')

    // 2. Connect to the database
    db = await connectToDatabase(fileDb.url)

    // 3. Apply schema migrations
    await applyMigrations(db, {
      dir: './migrations',
      glob: '*.sql',
    })

    // 4. Seed with test data
    await seedWithSql(
      db,
      `
      INSERT INTO users (id, name, email) VALUES
        (1, 'Alice', 'alice@example.com'),
        (2, 'Bob', 'bob@example.com');

      INSERT INTO posts (id, title, author_id) VALUES
        (1, 'First Post', 1),
        (2, 'Second Post', 2);
    `,
    )
  })

  afterEach(async () => {
    // Important: Close database before cleanup
    await db.close()
    await fileDb.cleanup()
  })

  test('should create and query users', async () => {
    const user = db.get<{ id: number; name: string; email: string }>(
      'SELECT * FROM users WHERE id = ?',
      [1],
    )

    expect(user).toBeDefined()
    expect(user?.name).toBe('Alice')
    expect(user?.email).toBe('alice@example.com')
  })

  test('should have isolated data between tests', async () => {
    // This test has its own fresh database
    const users = db.all('SELECT * FROM users')
    expect(users).toHaveLength(2) // Only seeded data

    // Add test-specific data
    db.exec(`INSERT INTO users (name, email) VALUES ('Charlie', 'charlie@example.com')`)

    const updatedUsers = db.all('SELECT * FROM users')
    expect(updatedUsers).toHaveLength(3)

    // This change won't affect other tests
  })
})
