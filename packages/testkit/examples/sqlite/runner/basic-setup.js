/* eslint-disable no-undef */
/**
 * Executable Example: Basic SQLite Test Setup with better-sqlite3
 *
 * This demonstrates the fundamental setup patterns from example 1
 * using real better-sqlite3 connections.
 */

import Database from 'better-sqlite3'
import { createFileDatabase, seedWithSql } from '../../../src/sqlite/index.js'

// Helper to adapt better-sqlite3 to our migration interface
function adaptDatabase(db) {
  return {
    exec: (sql) => db.exec(sql),
    execute: (sql) => db.exec(sql), // better-sqlite3 uses exec for both
    get: (sql, params) => db.prepare(sql).get(...(params || [])),
    all: (sql, params) => db.prepare(sql).all(...(params || [])),
    close: () => db.close(),
  }
}

async function runBasicSetupExample() {
  console.log('🚀 Running Basic Setup Example with better-sqlite3\n')

  // 1. Create a fresh database
  console.log('📁 Creating file database...')
  const fileDb = await createFileDatabase('example.db')
  console.log(`   Database created at: ${fileDb.path}`)

  // 2. Connect to the database
  console.log('🔌 Connecting to database...')
  const sqliteDb = new Database(fileDb.path)
  const db = adaptDatabase(sqliteDb)
  console.log('   Connected successfully')

  try {
    // 3. Create schema manually (normally you'd use migration files)
    console.log('📋 Setting up schema...')
    await db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      );

      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        author_id INTEGER NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users(id)
      );
    `)
    console.log('   Schema created')

    // 4. Seed with test data
    console.log('🌱 Seeding test data...')
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
    console.log('   Test data seeded')

    // 5. Query and verify data
    console.log('🔍 Querying data...')

    const user = db.get('SELECT * FROM users WHERE id = ?', [1])
    console.log('   Found user:', user)

    const users = db.all('SELECT * FROM users')
    console.log(`   Total users: ${users.length}`)

    const postsWithAuthors = db.all(`
      SELECT p.title, u.name as author_name
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ORDER BY p.id
    `)
    console.log('   Posts with authors:')
    postsWithAuthors.forEach((post, i) => {
      console.log(`     ${i + 1}. "${post.title}" by ${post.author_name}`)
    })

    // 6. Test isolation by adding more data
    console.log('📝 Testing data modifications...')
    db.exec(`INSERT INTO users (name, email) VALUES ('Charlie', 'charlie@example.com')`)

    const updatedUsers = db.all('SELECT * FROM users')
    console.log(`   Users after addition: ${updatedUsers.length}`)

    console.log('\n✅ Basic setup example completed successfully!')
  } catch (error) {
    console.error('❌ Error running example:', error.message)
    throw error
  } finally {
    // 7. Cleanup
    console.log('🧹 Cleaning up...')
    await db.close()
    await fileDb.cleanup()
    console.log('   Cleanup completed')
  }
}

// Run the example
runBasicSetupExample().catch(console.error)
