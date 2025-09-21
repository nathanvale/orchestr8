/**
 * Comprehensive tests for Postgres container implementation
 * These tests are gated by TESTCONTAINERS_PG environment variable
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import * as path from 'node:path'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  PostgresContainer,
  createPostgresConfig,
  createPostgresContext,
  setupPostgresTest,
} from '../postgres.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENABLE = process.env.TESTCONTAINERS_PG === '1'

// Gate the suite to avoid running by default in CI
const describeIf = ENABLE ? describe : describe.skip

describeIf('PostgresContainer', () => {
  const cleanups: Array<() => Promise<void>> = []
  let testDir: string

  beforeAll(async () => {
    // Create temporary directory for test fixtures
    testDir = path.join(__dirname, 'temp-postgres-test')
    await mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    // Clean up all containers
    for (const cleanup of cleanups) {
      try {
        await cleanup()
      } catch (e) {
        console.warn('Cleanup error:', e)
      }
    }
    cleanups.length = 0

    // Remove temporary directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  describe('createPostgresConfig', () => {
    it('should create default config', () => {
      const config = createPostgresConfig()
      expect(config).toEqual({
        image: 'postgres:15',
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
        environment: undefined,
        initScripts: undefined,
        migrationConfig: undefined,
        seedConfig: undefined,
      })
    })

    it('should override defaults', () => {
      const config = createPostgresConfig({
        image: 'postgres:16',
        database: 'custom_db',
        username: 'custom_user',
        password: 'custom_pass',
        environment: { TZ: 'UTC' },
      })

      expect(config.image).toBe('postgres:16')
      expect(config.database).toBe('custom_db')
      expect(config.username).toBe('custom_user')
      expect(config.password).toBe('custom_pass')
      expect(config.environment).toEqual({ TZ: 'UTC' })
    })
  })

  describe('PostgresContainer lifecycle', () => {
    it('should start container and connect', async () => {
      const config = createPostgresConfig()
      const container = new PostgresContainer(config)

      await container.start()
      const context = await container.getTestContext()
      cleanups.push(context.cleanup)

      expect(container.getPort()).toBeGreaterThan(0)
      expect(container.getConnectionString()).toMatch(
        /^postgresql:\/\/test_user:test_pass@.*:\d+\/test_db$/,
      )

      const connectionConfig = container.getConnectionConfig()
      expect(connectionConfig).toMatchObject({
        host: expect.any(String),
        port: expect.any(Number),
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
      })
    })

    it('should wait for container to be ready', async () => {
      const config = createPostgresConfig()
      const container = new PostgresContainer(config)

      await container.start()
      const testContext = await container.getTestContext()
      cleanups.push(testContext.cleanup)

      // Should not throw
      await expect(container.waitForReady()).resolves.toBeUndefined()

      // Should be able to query
      const context = await container.getTestContext()
      const result = await context.client.query('SELECT current_database()')
      expect(result.rows[0].current_database).toBe('test_db')
    })

    it('should handle environment variables', async () => {
      const config = createPostgresConfig({
        environment: {
          POSTGRES_INITDB_ARGS: '--auth-local=trust',
        },
      })

      const container = new PostgresContainer(config)
      await container.start()
      const containerContext = await container.getTestContext()
      cleanups.push(containerContext.cleanup)

      const context = await container.getTestContext()
      const result = await context.client.query('SELECT version()')
      expect(result.rows[0].version).toContain('PostgreSQL')
    })
  })

  describe('Migration support', () => {
    it('should run SQL migrations', async () => {
      // Create migration files
      const migrationsDir = path.join(testDir, 'migrations')
      await mkdir(migrationsDir, { recursive: true })

      await writeFile(
        path.join(migrationsDir, '001_create_users.sql'),
        `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      )

      await writeFile(
        path.join(migrationsDir, '002_create_posts.sql'),
        `
        CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          title VARCHAR(255) NOT NULL,
          content TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      )

      const config = createPostgresConfig({
        migrationConfig: {
          migrationsPath: migrationsDir,
        },
      })

      const container = new PostgresContainer(config)
      await container.start()
      const migrationContext = await container.getTestContext()
      cleanups.push(migrationContext.cleanup)

      await container.migrate()

      const context = await container.getTestContext()

      // Check tables exist
      const tables = await context.client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `)

      const tableNames = tables.rows.map((r) => r.table_name)
      expect(tableNames).toContain('users')
      expect(tableNames).toContain('posts')
      expect(tableNames).toContain('migrations')

      // Check migration records
      const migrations = await context.client.query('SELECT name FROM migrations ORDER BY name')
      expect(migrations.rows).toHaveLength(2)
      expect(migrations.rows[0].name).toBe('001_create_users')
      expect(migrations.rows[1].name).toBe('002_create_posts')
    })

    it('should not re-run already executed migrations', async () => {
      const migrationsDir = path.join(testDir, 'migrations-idempotent')
      await mkdir(migrationsDir, { recursive: true })

      await writeFile(
        path.join(migrationsDir, '001_init.sql'),
        'CREATE TABLE test_table (id SERIAL PRIMARY KEY);',
      )

      const config = createPostgresConfig({
        migrationConfig: {
          migrationsPath: migrationsDir,
        },
      })

      const container = new PostgresContainer(config)
      await container.start()
      const idempotentContext = await container.getTestContext()
      cleanups.push(idempotentContext.cleanup)

      // Run migrations twice
      await container.migrate()
      await container.migrate()

      const context = await container.getTestContext()
      const migrations = await context.client.query('SELECT COUNT(*) FROM migrations')
      expect(Number(migrations.rows[0].count)).toBe(1)
    })
  })

  describe('Seeding support', () => {
    beforeEach(async () => {
      // Create schema for seeding tests
      const schemaDir = path.join(testDir, 'schema')
      await mkdir(schemaDir, { recursive: true })

      await writeFile(
        path.join(schemaDir, '001_schema.sql'),
        `
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          price DECIMAL(10, 2) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) NOT NULL
        );
      `,
      )
    })

    it('should seed from SQL file', async () => {
      const seedFile = path.join(testDir, 'seed.sql')
      await writeFile(
        seedFile,
        `
        INSERT INTO products (name, price) VALUES
          ('Widget', 19.99),
          ('Gadget', 29.99),
          ('Doohickey', 39.99);

        INSERT INTO categories (name) VALUES
          ('Electronics'),
          ('Tools');
      `,
      )

      const config = createPostgresConfig({
        migrationConfig: {
          migrationsPath: path.join(testDir, 'schema'),
        },
        seedConfig: {
          data: seedFile,
        },
      })

      const container = new PostgresContainer(config)
      await container.start()
      const seedContext = await container.getTestContext()
      cleanups.push(seedContext.cleanup)

      await container.migrate()
      await container.seed()

      const context = await container.getTestContext()
      const products = await context.client.query('SELECT COUNT(*) FROM products')
      const categories = await context.client.query('SELECT COUNT(*) FROM categories')

      expect(Number(products.rows[0].count)).toBe(3)
      expect(Number(categories.rows[0].count)).toBe(2)
    })

    it('should seed from object data', async () => {
      const config = createPostgresConfig({
        migrationConfig: {
          migrationsPath: path.join(testDir, 'schema'),
        },
        seedConfig: {
          data: {
            products: [
              { name: 'Item 1', price: 10.0 },
              { name: 'Item 2', price: 20.0 },
            ],
            categories: [{ name: 'Category A' }, { name: 'Category B' }],
          },
          truncate: true,
        },
      })

      const container = new PostgresContainer(config)
      await container.start()
      const objectSeedContext = await container.getTestContext()
      cleanups.push(objectSeedContext.cleanup)

      await container.migrate()
      await container.seed()

      const context = await container.getTestContext()

      const products = await context.client.query('SELECT name, price FROM products ORDER BY name')
      expect(products.rows).toEqual([
        { name: 'Item 1', price: '10.00' },
        { name: 'Item 2', price: '20.00' },
      ])

      const categories = await context.client.query('SELECT name FROM categories ORDER BY name')
      expect(categories.rows).toEqual([{ name: 'Category A' }, { name: 'Category B' }])
    })
  })

  describe('Database reset functionality', () => {
    it('should reset database by truncating tables', async () => {
      const schemaDir = path.join(testDir, 'reset-schema')
      await mkdir(schemaDir, { recursive: true })

      await writeFile(
        path.join(schemaDir, '001_tables.sql'),
        `
        CREATE TABLE test_data (
          id SERIAL PRIMARY KEY,
          value TEXT
        );
      `,
      )

      const { db, reset, cleanup } = await setupPostgresTest({
        migrations: schemaDir,
      })
      cleanups.push(cleanup)

      // Insert data
      await db.query("INSERT INTO test_data (value) VALUES ('test1'), ('test2')")
      let result = await db.query('SELECT COUNT(*) FROM test_data')
      expect(Number(result.rows[0].count)).toBe(2)

      // Reset database
      await reset()

      // Data should be cleared
      result = await db.query('SELECT COUNT(*) FROM test_data')
      expect(Number(result.rows[0].count)).toBe(0)
    })
  })

  describe('Helper functions', () => {
    it('should work with createPostgresContext', async () => {
      const context = await createPostgresContext()
      cleanups.push(() => context.cleanup())

      expect(context.container).toBeDefined()
      expect(context.client).toBeDefined()
      expect(context.connectionString).toMatch(/^postgresql:\/\//)

      const result = await context.client.query('SELECT NOW()')
      expect(result.rows[0].now).toBeDefined()
    })

    it('should work with setupPostgresTest convenience function', async () => {
      const { db, connectionString, cleanup, reset } = await setupPostgresTest({})
      cleanups.push(cleanup)

      expect(db).toBeDefined()
      expect(connectionString).toMatch(/^postgresql:\/\//)
      expect(typeof reset).toBe('function')

      const result = await db.query('SELECT 1 + 1 AS sum')
      expect(result.rows[0].sum).toBe(2)
    })

    it('should support migrations and seeding in setupPostgresTest', async () => {
      const migrationDir = path.join(testDir, 'setup-migrations')
      await mkdir(migrationDir, { recursive: true })

      await writeFile(
        path.join(migrationDir, '001_init.sql'),
        'CREATE TABLE items (id SERIAL PRIMARY KEY, name TEXT);',
      )

      const seedFile = path.join(testDir, 'setup-seed.sql')
      await writeFile(seedFile, "INSERT INTO items (name) VALUES ('Test Item');")

      const { db, cleanup } = await setupPostgresTest({
        migrations: migrationDir,
        seed: seedFile,
      })
      cleanups.push(cleanup)

      const result = await db.query('SELECT name FROM items')
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].name).toBe('Test Item')
    })
  })

  describe('Error handling', () => {
    it('should throw when accessing methods before container starts', () => {
      const container = new PostgresContainer(createPostgresConfig())

      expect(() => container.getConnectionString()).toThrow('Container not started')
      expect(() => container.getPort()).toThrow('Container not started')
      expect(() => container.getConnectionConfig()).toThrow('Container not started')
    })

    it('should handle migration errors gracefully', async () => {
      const migrationDir = path.join(testDir, 'bad-migrations')
      await mkdir(migrationDir, { recursive: true })

      await writeFile(path.join(migrationDir, '001_bad.sql'), 'CREATE TABLE INVALID SQL HERE;')

      const config = createPostgresConfig({
        migrationConfig: {
          migrationsPath: migrationDir,
        },
      })

      const container = new PostgresContainer(config)
      await container.start()
      const errorContext = await container.getTestContext()
      cleanups.push(errorContext.cleanup)

      await expect(container.migrate()).rejects.toThrow(/Migration.*failed/)
    })
  })

  describe('Transaction and isolation support', () => {
    it('should support transaction rollback between tests', async () => {
      const { db, cleanup } = await setupPostgresTest({})
      cleanups.push(cleanup)

      // Create a test table
      await db.query('CREATE TABLE test_transactions (id SERIAL, value TEXT)')

      // Start transaction
      await db.query('BEGIN')

      // Insert data in transaction
      await db.query("INSERT INTO test_transactions (value) VALUES ('test')")
      let result = await db.query('SELECT COUNT(*) FROM test_transactions')
      expect(Number(result.rows[0].count)).toBe(1)

      // Rollback transaction
      await db.query('ROLLBACK')

      // Data should not persist
      result = await db.query('SELECT COUNT(*) FROM test_transactions')
      expect(Number(result.rows[0].count)).toBe(0)
    })
  })
})

describeIf('PostgresContainer performance', () => {
  const cleanups: Array<() => Promise<void>> = []

  afterAll(async () => {
    for (const cleanup of cleanups) {
      try {
        await cleanup()
      } catch (e) {
        console.warn('Cleanup error:', e)
      }
    }
  })

  it('should start container within reasonable time', async () => {
    const startTime = Date.now()

    const { cleanup } = await setupPostgresTest({})
    cleanups.push(cleanup)

    const duration = Date.now() - startTime

    // Container should start within 30 seconds (generous for CI)
    expect(duration).toBeLessThan(30000)

    // Log actual startup time for monitoring
    console.log(`Postgres container started in ${duration}ms`)
  })

  it('should handle parallel container creation', async () => {
    // Create multiple containers in parallel
    const promises = Array.from({ length: 3 }, async (_, i) => {
      const { db, cleanup } = await setupPostgresTest({
        config: {
          database: `test_db_${i}`,
        },
      })
      cleanups.push(cleanup)
      return db.query(`SELECT '${i}' AS id`)
    })

    const results = await Promise.all(promises)

    expect(results).toHaveLength(3)
    results.forEach((result, i) => {
      expect(result.rows[0].id).toBe(String(i))
    })
  })
})
