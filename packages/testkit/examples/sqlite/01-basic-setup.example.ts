/**
 * Example 1: Basic SQLite Test Setup
 *
 * This example shows the fundamental setup for SQLite testing
 * with proper initialization, cleanup, and isolation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import {
  createFileDatabase,
  migrateDatabase as _migrateDatabase,
  seedDatabase as _seedDatabase,
  applyRecommendedPragmas,
  type FileDatabase
} from '@orchestr8/testkit/sqlite'
import Database from 'better-sqlite3'

// Note: This example assumes you have better-sqlite3 installed
// Install with: npm install better-sqlite3 @types/better-sqlite3

describe('Basic SQLite Test Setup', () => {
  let db: Database.Database
  let fileDb: FileDatabase

  beforeEach(async () => {
    // 1. Create a fresh database for each test
    fileDb = await createFileDatabase('test.db')

    // 2. Connect to the database
    db = new Database(fileDb.path)

    // 3. Apply recommended SQLite settings
    await applyRecommendedPragmas(db, {
      journalMode: 'WAL',
      foreignKeys: true,
      busyTimeoutMs: 5000
    })

    // 4. Create schema (in real app, use migrateDatabase)
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        author_id INTEGER NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users(id)
      );
    `)

    // 5. Seed with test data
    const seedSql = `
      INSERT INTO users (id, name, email) VALUES
        (1, 'Alice', 'alice@example.com'),
        (2, 'Bob', 'bob@example.com');

      INSERT INTO posts (id, title, author_id) VALUES
        (1, 'First Post', 1),
        (2, 'Second Post', 2);
    `
    db.exec(seedSql)
  })

  afterEach(async () => {
    // Important: Close database before cleanup
    db.close()
    await fileDb.cleanup()
  })

  test('should create and query users', () => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(1) as 
      { id: number; name: string; email: string } | undefined

    expect(user).toBeDefined()
    expect(user?.name).toBe('Alice')
    expect(user?.email).toBe('alice@example.com')
  })

  test('should handle foreign key constraints', () => {
    // Try to insert post with invalid author_id
    expect(() => {
      db.prepare('INSERT INTO posts (title, author_id) VALUES (?, ?)')
        .run('Invalid Post', 999)
    }).toThrow() // Should fail due to foreign key constraint
  })

  test('should have isolated data between tests', () => {
    // This test has its own fresh database
    const users = db.prepare('SELECT * FROM users').all()
    expect(users).toHaveLength(2) // Only seeded data

    // Add test-specific data
    db.prepare('INSERT INTO users (name, email) VALUES (?, ?)')
      .run('Charlie', 'charlie@example.com')

    const updatedUsers = db.prepare('SELECT * FROM users').all()
    expect(updatedUsers).toHaveLength(3)

    // This change won't affect other tests
  })

  test('should support transactions', () => {
    const insertUser = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)')
    const insertPost = db.prepare('INSERT INTO posts (title, author_id) VALUES (?, ?)')
    
    const transaction = db.transaction(() => {
      const result = insertUser.run('David', 'david@example.com')
      insertPost.run('David\'s Post', result.lastInsertRowid)
    })
    
    transaction()
    
    const users = db.prepare('SELECT * FROM users').all()
    const posts = db.prepare('SELECT * FROM posts').all()
    
    expect(users).toHaveLength(3) // 2 seeded + 1 new
    expect(posts).toHaveLength(3) // 2 seeded + 1 new
  })
})
