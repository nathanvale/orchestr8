/**
 * Example 4: Migrations and Seeding Patterns
 *
 * This example demonstrates how to use migrations and seeding
 * for consistent test database setup across your test suite.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import {
  createFileDatabase,
  applyMigrations,
  resetDatabase,
  seedWithSql,
  seedWithFiles,
  type FileDatabase,
} from '@template/testkit/sqlite'

// Example database interface
interface Database {
  exec(sql: string): void
  get<T = unknown>(sql: string, params?: unknown[]): T | undefined
  all<T = unknown>(sql: string, params?: unknown[]): T[]
  close(): Promise<void>
}

// Mock connection function
declare function connectToDatabase(url: string): Promise<Database>

/**
 * Example migration files structure:
 *
 * migrations/
 * ├── 001_create_users.sql
 * ├── 002_create_posts.sql
 * ├── 003_add_comments.sql
 * └── 004_add_indexes.sql
 *
 * seeds/
 * ├── 01_users.sql
 * ├── 02_posts.sql
 * └── 03_comments.sql
 */

describe('Migration and Seeding Patterns', () => {
  let db: Database
  let fileDb: FileDatabase

  beforeEach(async () => {
    fileDb = await createFileDatabase('test.db')
    db = await connectToDatabase(fileDb.url)
  })

  afterEach(async () => {
    await db.close()
    await fileDb.cleanup()
  })

  test('should apply migrations in order', async () => {
    // Apply migrations from directory
    await applyMigrations(db, {
      dir: './migrations',
      glob: '*.sql', // optional, defaults to *.sql
    })

    // Verify schema was created
    const tables = db.all<{ name: string }>(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)

    expect(tables.map((t) => t.name)).toEqual(['comments', 'posts', 'users'])
  })

  test('should handle migration failures gracefully', async () => {
    // Create a migration that will fail
    db.exec('CREATE TABLE existing_table (id INTEGER)')

    // Mock migration directory with conflicting migration
    await expect(
      applyMigrations(db, {
        dir: './migrations-with-conflict',
      }),
    ).rejects.toThrow(/Migration failed/)

    // Verify transaction rollback (table should still exist)
    const table = db.get<{ name: string }>(`
      SELECT name FROM sqlite_master WHERE name = 'existing_table'
    `)
    expect(table).toBeDefined()
  })

  test('should reset database completely', async () => {
    // Setup initial schema
    db.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT);
      INSERT INTO users (name) VALUES ('Test User');
    `)

    // Reset database
    await resetDatabase(db)

    // Verify all tables are gone
    const tables = db.all<{ name: string }>(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `)

    expect(tables).toHaveLength(0)
  })

  test('should seed with direct SQL', async () => {
    // Setup schema
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Seed with SQL
    await seedWithSql(
      db,
      `
      INSERT INTO users (id, name, email) VALUES
        (1, 'Alice', 'alice@example.com'),
        (2, 'Bob', 'bob@example.com'),
        (3, 'Charlie', 'charlie@example.com');

      -- Can include multiple statements
      UPDATE users SET created_at = '2024-01-01' WHERE id = 1;
    `,
    )

    const users = db.all('SELECT * FROM users ORDER BY id')
    expect(users).toHaveLength(3)

    const alice = db.get<{ created_at: string }>('SELECT created_at FROM users WHERE id = 1')
    expect(alice?.created_at).toBe('2024-01-01')
  })

  test('should seed from files in order', async () => {
    // Setup schema
    await applyMigrations(db, { dir: './migrations' })

    // Seed from files
    await seedWithFiles(db, {
      dir: './seeds',
    })

    // Verify seeding occurred in lexicographic order
    // Files are processed as: 01_users.sql, 02_posts.sql, 03_comments.sql

    const counts = {
      users: db.get<{ count: number }>('SELECT COUNT(*) as count FROM users')?.count,
      posts: db.get<{ count: number }>('SELECT COUNT(*) as count FROM posts')?.count,
      comments: db.get<{ count: number }>('SELECT COUNT(*) as count FROM comments')?.count,
    }

    expect(counts.users).toBeGreaterThan(0)
    expect(counts.posts).toBeGreaterThan(0)
    expect(counts.comments).toBeGreaterThan(0)
  })

  test('should handle idempotent seeding', async () => {
    // Setup schema
    db.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      );
    `)

    // Idempotent seed SQL using INSERT OR IGNORE
    const idempotentSeed = `
      INSERT OR IGNORE INTO categories (id, name) VALUES
        (1, 'Technology'),
        (2, 'Science'),
        (3, 'Arts');
    `

    // Run seed multiple times
    await seedWithSql(db, idempotentSeed)
    await seedWithSql(db, idempotentSeed)
    await seedWithSql(db, idempotentSeed)

    // Should still have only 3 categories
    const count = db.get<{ count: number }>('SELECT COUNT(*) as count FROM categories')
    expect(count?.count).toBe(3)
  })
})

/**
 * Best Practices for Migrations and Seeding
 */
export const migrationBestPractices = {
  // 1. Use numbered prefixes for ordering
  namingConvention: [
    '001_initial_schema.sql',
    '002_add_users_table.sql',
    '003_add_posts_table.sql',
  ],

  // 2. Make migrations atomic
  atomicMigration: `
    -- Each migration file is wrapped in a transaction automatically
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE INDEX idx_users_name ON users(name);
  `,

  // 3. Use idempotent patterns for seeds
  idempotentSeed: `
    -- Use INSERT OR IGNORE for idempotency
    INSERT OR IGNORE INTO roles (id, name) VALUES
      (1, 'admin'),
      (2, 'user'),
      (3, 'guest');

    -- Or use INSERT OR REPLACE for updates
    INSERT OR REPLACE INTO settings (key, value) VALUES
      ('app_name', 'Test App'),
      ('version', '1.0.0');
  `,

  // 4. Separate concerns
  fileStructure: {
    migrations: 'Schema changes only',
    seeds: 'Test data only',
    fixtures: 'Complex test scenarios',
  },

  // 5. Handle errors gracefully
  errorHandling: async (db: Database) => {
    try {
      await applyMigrations(db, { dir: './migrations' })
    } catch (error) {
      console.error('Migration failed:', error)
      // Migrations are transactional, so partial changes are rolled back
      throw error
    }
  },
}
