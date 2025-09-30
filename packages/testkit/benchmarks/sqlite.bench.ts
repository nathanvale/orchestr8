/**
 * Performance benchmarks for SQLite utilities
 */

import { bench, describe, afterEach } from 'vitest'
import {
  createMemoryUrl,
  createFileDatabase,
  createFileDBWithPool,
  type SqliteTarget,
  type IsolationMode,
  type FileDatabase,
} from '../src/sqlite'

// Track databases for cleanup
const databases: FileDatabase[] = []

afterEach(async () => {
  // Clean up all test databases
  await Promise.all(databases.map((db) => db.cleanup()))
  databases.length = 0
})

describe('memory URL creation performance', () => {
  bench(
    'createMemoryUrl basic (raw)',
    () => {
      return createMemoryUrl('raw')
    },
    { iterations: 10000 },
  )

  bench(
    'createMemoryUrl with identifier',
    () => {
      return createMemoryUrl('raw', { identifier: 'test-db' })
    },
    { iterations: 10000 },
  )

  bench(
    'createMemoryUrl with auto-generate',
    () => {
      return createMemoryUrl('raw', { autoGenerate: true })
    },
    { iterations: 10000 },
  )

  bench(
    'createMemoryUrl for Prisma',
    () => {
      return createMemoryUrl('prisma', { identifier: 'test' })
    },
    { iterations: 10000 },
  )

  bench(
    'createMemoryUrl with custom params',
    () => {
      return createMemoryUrl('raw', {
        identifier: 'test',
        params: { connection_limit: 1, timeout: 5000 },
      })
    },
    { iterations: 10000 },
  )

  bench(
    'createMemoryUrl different targets',
    () => {
      const targets: SqliteTarget[] = [
        'raw',
        'prisma',
        'drizzle-libsql',
        'kysely',
        'drizzle-better-sqlite3',
      ]

      for (const target of targets) {
        createMemoryUrl(target, { autoGenerate: true })
      }
    },
    { iterations: 1000 },
  )

  bench(
    'createMemoryUrl isolation modes',
    () => {
      const modes: IsolationMode[] = ['shared', 'private']

      for (const mode of modes) {
        createMemoryUrl('raw', {
          identifier: 'test',
          isolation: mode,
        })
      }
    },
    { iterations: 5000 },
  )
})

describe('file database creation performance', () => {
  bench(
    'createFileDatabase basic',
    async () => {
      const db = await createFileDatabase()
      databases.push(db)
    },
    { iterations: 50 },
  )

  bench(
    'createFileDatabase with custom name',
    async () => {
      const db = await createFileDatabase('custom.db')
      databases.push(db)
    },
    { iterations: 50 },
  )

  bench(
    'createFileDatabase multiple concurrent',
    async () => {
      const promises = Array.from({ length: 5 }, () => createFileDatabase())
      const dbs = await Promise.all(promises)
      databases.push(...dbs)
    },
    { iterations: 20 },
  )

  bench(
    'createFileDBWithPool',
    async () => {
      const db = await createFileDBWithPool('pooled.db', {
        maxConnections: 3,
        minConnections: 1,
      })
      databases.push(db)
    },
    { iterations: 30 },
  )

  bench(
    'createFileDBWithPool concurrent',
    async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        createFileDBWithPool(`pooled-${i}.db`, {
          maxConnections: 2,
          minConnections: 1,
        }),
      )
      const dbs = await Promise.all(promises)
      databases.push(...dbs)
    },
    { iterations: 10 },
  )
})

describe('database cleanup performance', () => {
  bench(
    'single database cleanup',
    async () => {
      const db = await createFileDatabase('cleanup-test.db')
      await db.cleanup()
    },
    { iterations: 50 },
  )

  bench(
    'multiple database cleanup',
    async () => {
      const dbs = await Promise.all([
        createFileDatabase('cleanup1.db'),
        createFileDatabase('cleanup2.db'),
        createFileDatabase('cleanup3.db'),
      ])

      await Promise.all(dbs.map((db) => db.cleanup()))
    },
    { iterations: 20 },
  )

  bench(
    'pooled database cleanup',
    async () => {
      const db = await createFileDBWithPool('pooled-cleanup.db', {
        maxConnections: 2,
        minConnections: 1,
      })
      await db.cleanup()
    },
    { iterations: 30 },
  )
})

describe('URL generation edge cases', () => {
  bench(
    'many auto-generated identifiers',
    () => {
      const urls = Array.from({ length: 100 }, () => createMemoryUrl('raw', { autoGenerate: true }))

      // Verify uniqueness
      const uniqueUrls = new Set(urls)
      return uniqueUrls.size === urls.length
    },
    { iterations: 100 },
  )

  bench(
    'complex parameter encoding',
    () => {
      return createMemoryUrl('raw', {
        identifier: 'test-with-special-chars',
        params: {
          'param with spaces': 'value with spaces',
          'special_chars': 'value!@#$%^&*()',
          'unicode': 'test-ñáéíóú-测试',
        },
      })
    },
    { iterations: 1000 },
  )

  bench(
    'long identifiers',
    () => {
      const longId = 'test-'.repeat(50) // Very long identifier
      return createMemoryUrl('raw', { identifier: longId })
    },
    { iterations: 1000 },
  )
})

describe('real-world usage patterns', () => {
  bench(
    'test suite database setup',
    async () => {
      // Simulate setting up databases for a test suite
      const mainDb = await createFileDatabase('main.db')
      const testDb = createMemoryUrl('raw', {
        identifier: 'test-suite',
        autoGenerate: true,
      })
      const migrationDb = await createFileDatabase('migrations.db')

      databases.push(mainDb, migrationDb)

      return { mainDb, testDb, migrationDb }
    },
    { iterations: 20 },
  )

  bench(
    'parallel test database creation',
    async () => {
      // Simulate parallel test execution
      const testPromises = Array.from({ length: 10 }, (_, i) =>
        createFileDatabase(`parallel-test-${i}.db`),
      )

      const testDbs = await Promise.all(testPromises)
      databases.push(...testDbs)

      return testDbs.length
    },
    { iterations: 10 },
  )

  bench(
    'mixed database types',
    async () => {
      // Mix of memory URLs and file databases
      const memoryUrls = [
        createMemoryUrl('raw', { autoGenerate: true }),
        createMemoryUrl('prisma', { identifier: 'test' }),
        createMemoryUrl('drizzle-libsql', { isolation: 'private' }),
      ]

      const fileDbs = await Promise.all([
        createFileDatabase('file1.db'),
        createFileDatabase('file2.db'),
      ])

      databases.push(...fileDbs)

      return { memoryUrls, fileDbs }
    },
    { iterations: 20 },
  )
})

describe('memory efficiency tests', () => {
  bench(
    'create many memory URLs',
    () => {
      const urls = Array.from({ length: 1000 }, (_, i) =>
        createMemoryUrl('raw', {
          identifier: `test-${i}`,
          autoGenerate: false,
        }),
      )
      return urls.length
    },
    { iterations: 10 },
  )

  bench(
    'repeated database creation and cleanup',
    async () => {
      for (let i = 0; i < 10; i++) {
        const db = await createFileDatabase(`temp-${i}.db`)
        await db.cleanup()
      }
    },
    { iterations: 10 },
  )

  bench(
    'database path operations',
    async () => {
      const db = await createFileDatabase('path-test.db')
      databases.push(db)

      // Test path-related operations
      const results = {
        url: db.url,
        dir: db.dir,
        path: db.path,
        urlLength: db.url.length,
        pathExists: db.path.includes('.db'),
      }

      return results
    },
    { iterations: 100 },
  )
})

describe('resource management patterns', () => {
  bench(
    'database with resource registration',
    async () => {
      // This tests the overhead of resource registration
      const db = await createFileDatabase('resource-test.db')
      databases.push(db)

      // The resource registration happens automatically in createFileDatabase
      // so this measures the total overhead
      return db
    },
    { iterations: 50 },
  )

  bench(
    'batch database operations',
    async () => {
      // Create multiple databases and perform batch operations
      const dbs = await Promise.all(
        Array.from({ length: 5 }, (_, i) => createFileDatabase(`batch-${i}.db`)),
      )
      databases.push(...dbs)

      // Simulate batch operations on all databases
      const operations = dbs.map((db) => ({
        url: db.url,
        hasCleanup: typeof db.cleanup === 'function',
      }))

      return operations
    },
    { iterations: 20 },
  )
})
