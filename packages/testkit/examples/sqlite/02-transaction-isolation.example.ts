/**
 * Example 2: Transaction-based Test Isolation
 *
 * This example demonstrates how to use transactions for test isolation,
 * ensuring each test runs in a rolled-back transaction for perfect isolation.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { createMemoryUrl, withTransaction, type TransactionAdapter } from '@template/testkit/sqlite'

// Example database types
interface Database {
  exec(sql: string): void
  get<T = unknown>(sql: string, params?: unknown[]): T | undefined
  all<T = unknown>(sql: string, params?: unknown[]): T[]
}

interface Transaction extends Database {
  commit(): Promise<void>
  rollback(): Promise<void>
}

// Mock connection function
declare function connectToDatabase(url: string): Promise<Database>

// Example adapter implementation
const sqliteAdapter: TransactionAdapter<Database, Transaction> = {
  async begin(db: Database): Promise<Transaction> {
    db.exec('BEGIN')
    return {
      ...db,
      commit: async () => db.exec('COMMIT'),
      rollback: async () => db.exec('ROLLBACK'),
    }
  },
  async commit(tx: Transaction): Promise<void> {
    await tx.commit()
  },
  async rollback(tx: Transaction): Promise<void> {
    await tx.rollback()
  },
}

describe('Transaction Isolation Pattern', () => {
  let db: Database

  beforeEach(async () => {
    // Create shared database once
    const url = createMemoryUrl('raw')
    db = await connectToDatabase(url)

    // Setup schema once
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        author_id INTEGER,
        FOREIGN KEY (author_id) REFERENCES users(id)
      );
    `)

    // Add base test data
    db.exec(`
      INSERT INTO users (id, name, email) VALUES
        (1, 'Alice', 'alice@example.com'),
        (2, 'Bob', 'bob@example.com');
    `)
  })

  test('should isolate changes in transaction', async () => {
    await expect(
      withTransaction(db, sqliteAdapter, async (tx) => {
        // Changes made in transaction
        tx.exec(`INSERT INTO users (name, email) VALUES ('Charlie', 'charlie@example.com')`)

        const users = tx.all('SELECT * FROM users')
        expect(users).toHaveLength(3) // Sees the change

        // Force rollback by throwing
        throw new Error('Rollback for test isolation')
      }),
    ).rejects.toThrow('Rollback for test isolation')

    // Verify changes were rolled back
    const users = db.all('SELECT * FROM users')
    expect(users).toHaveLength(2) // Only original data remains
  })

  test('should commit successful transactions', async () => {
    const result = await withTransaction(db, sqliteAdapter, async (tx) => {
      tx.exec(`INSERT INTO posts (title, author_id) VALUES ('Test Post', 1)`)

      const post = tx.get<{ id: number; title: string }>('SELECT * FROM posts WHERE title = ?', [
        'Test Post',
      ])
      return post
    })

    expect(result).toBeDefined()
    expect(result?.title).toBe('Test Post')

    // Verify changes were committed
    const posts = db.all('SELECT * FROM posts')
    expect(posts).toHaveLength(1)
  })

  test('should handle nested data operations', async () => {
    await expect(
      withTransaction(db, sqliteAdapter, async (tx) => {
        // Complex operations that should be isolated
        tx.exec(`UPDATE users SET name = 'Alice Updated' WHERE id = 1`)
        tx.exec(`INSERT INTO posts (title, author_id) VALUES ('Alice Post', 1)`)
        tx.exec(`DELETE FROM users WHERE id = 2`)

        const alice = tx.get<{ name: string }>('SELECT name FROM users WHERE id = 1')
        expect(alice?.name).toBe('Alice Updated')

        const userCount = tx.get<{ count: number }>('SELECT COUNT(*) as count FROM users')
        expect(userCount?.count).toBe(1) // Bob was deleted

        // Force rollback
        throw new Error('Test complete')
      }),
    ).rejects.toThrow('Test complete')

    // Verify all changes were rolled back
    const alice = db.get<{ name: string }>('SELECT name FROM users WHERE id = 1')
    expect(alice?.name).toBe('Alice') // Original name

    const users = db.all('SELECT * FROM users')
    expect(users).toHaveLength(2) // Both users still exist
  })
})
