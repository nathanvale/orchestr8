/* eslint-disable no-undef */
/**
 * Executable Example: Pragma Configuration with better-sqlite3
 *
 * This demonstrates pragma configuration and environment probing
 * using real better-sqlite3 connections.
 */

import Database from 'better-sqlite3'
import {
  createFileDatabase,
  applyRecommendedPragmas,
  probeEnvironment,
} from '../../../src/sqlite/index.js'

// Helper to adapt better-sqlite3 to our interfaces
function adaptDatabase(db) {
  return {
    exec: (sql) => db.exec(sql),
    execute: (sql) => db.exec(sql),
    pragma: (sql) => {
      // better-sqlite3 pragma method format
      const [statement, value] = sql.split(' = ')
      const pragmaName = statement.replace('PRAGMA ', '')
      if (value) {
        return db.pragma(`${pragmaName} = ${value}`)
      }
      return db.pragma(pragmaName)
    },
    prepare: (sql) => db.prepare(sql),
    get: (sql, params) => db.prepare(sql).get(...(params || [])),
    all: (sql, params) => db.prepare(sql).all(...(params || [])),
    close: () => db.close(),
  }
}

async function runPragmaConfigurationExample() {
  console.log('🚀 Running Pragma Configuration Example with better-sqlite3\n')

  // Create file database (required for WAL mode)
  console.log('📁 Creating file database for WAL mode...')
  const fileDb = await createFileDatabase('pragma-test.db')
  console.log(`   Database created at: ${fileDb.path}`)

  const sqliteDb = new Database(fileDb.path)
  const db = adaptDatabase(sqliteDb)

  try {
    // Apply recommended pragmas
    console.log('⚙️  Applying recommended pragmas...')
    const pragmas = await applyRecommendedPragmas(db, {
      busyTimeoutMs: 5000,
    })

    console.log('   Applied pragmas:')
    console.log(`     Journal mode: ${pragmas.journal_mode}`)
    console.log(`     Foreign keys: ${pragmas.foreign_keys}`)
    console.log(`     Busy timeout: ${pragmas.busy_timeout}ms`)

    // Run environment probe
    console.log('\n🔍 Running environment capabilities probe...')
    const probeResult = await probeEnvironment(db, {
      logLevel: 'info',
      pragmaOptions: { busyTimeoutMs: 5000 },
    })

    console.log('\n📊 Probe results:')
    console.log('   Capabilities:')
    Object.entries(probeResult.capabilities).forEach(([key, value]) => {
      const status = value ? '✅' : '❌'
      console.log(`     ${key}: ${status}`)
    })

    // Create schema with foreign keys
    console.log('\n📋 Creating schema with foreign key constraints...')
    await db.exec(`
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
    console.log('   Schema created')

    // Test foreign key constraints
    console.log('\n🔗 Testing foreign key constraints...')

    // Add an author
    await db.exec(`INSERT INTO authors (id, name) VALUES (1, 'Jane Austen')`)
    console.log('   Added author: Jane Austen')

    // Add a book (should succeed)
    await db.exec(`INSERT INTO books (title, author_id) VALUES ('Pride and Prejudice', 1)`)
    console.log('   Added book: Pride and Prejudice')

    // Try to add book with invalid author (should fail)
    try {
      await db.exec(`INSERT INTO books (title, author_id) VALUES ('Invalid Book', 999)`)
      console.log('   ❌ Foreign key constraint should have failed!')
    } catch (error) {
      console.log('   ✅ Foreign key constraint working:', error.message)
    }

    // Test cascade delete
    console.log('\n🗑️  Testing cascade delete...')
    const booksBeforeDelete = db.all('SELECT COUNT(*) as count FROM books')
    console.log(`   Books before delete: ${booksBeforeDelete[0].count}`)

    await db.exec('DELETE FROM authors WHERE id = 1')
    console.log('   Deleted author with ID 1')

    const booksAfterDelete = db.all('SELECT COUNT(*) as count FROM books')
    console.log(`   Books after delete: ${booksAfterDelete[0].count}`)

    if (booksAfterDelete[0].count === 0) {
      console.log('   ✅ Cascade delete working correctly')
    } else {
      console.log('   ❌ Cascade delete not working')
    }

    console.log('\n✅ Pragma configuration example completed successfully!')
  } catch (error) {
    console.error('❌ Error running example:', error.message)
    throw error
  } finally {
    console.log('\n🧹 Cleaning up...')
    await db.close()
    await fileDb.cleanup()
    console.log('   Cleanup completed')
  }
}

// Run the example
runPragmaConfigurationExample().catch(console.error)
