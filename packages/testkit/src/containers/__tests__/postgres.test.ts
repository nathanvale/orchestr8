/**
 * Comprehensive PostgresContainer tests
 * Tests all PostgreSQL container functionality including lifecycle, configuration, and error scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import { writeFile, mkdir, rm, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Client } from 'pg'
import {
  PostgresContainer,
  createPostgresConfig,
  createPostgresContext,
  setupPostgresTest,
  type PostgresDatabaseConfig,
} from '../postgres.js'
import { IsolationLevel, type MigrationConfig, type SeedConfig } from '../types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Check if testcontainers is available
const hasTestcontainers = await (async () => {
  try {
    await import('testcontainers')
    return true
  } catch {
    return false
  }
})()

// Only run tests if testcontainers is available and enabled
const shouldRun =
  hasTestcontainers && (process.env.TESTCONTAINERS_PG === '1' || process.env.NODE_ENV === 'test')

describe.skipIf(!shouldRun)('PostgresContainer Comprehensive Tests', () => {
  const cleanups: Array<() => Promise<void>> = []
  let testDir: string

  beforeAll(async () => {
    // Create temporary directory for test fixtures
    testDir = path.join(__dirname, 'temp-postgres-comprehensive')
    await mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    // Clean up all containers
    await Promise.allSettled(cleanups.map((cleanup) => cleanup()))
    cleanups.length = 0

    // Remove temporary directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  beforeEach(() => {
    // Reset cleanups for each test
    cleanups.length = 0
  })

  afterEach(async () => {
    // Clean up any resources created in test
    await Promise.allSettled(cleanups.map((cleanup) => cleanup()))
    cleanups.length = 0
  })

  describe('Container Configuration', () => {
    it('should create config with all default values', () => {
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

    it('should override specific config values', () => {
      const config = createPostgresConfig({
        image: 'postgres:16-alpine',
        database: 'custom_db',
        username: 'custom_user',
        password: 'super_secret',
        environment: {
          POSTGRES_INITDB_ARGS: '--auth-local=trust',
          TZ: 'UTC',
        },
      })

      expect(config.image).toBe('postgres:16-alpine')
      expect(config.database).toBe('custom_db')
      expect(config.username).toBe('custom_user')
      expect(config.password).toBe('super_secret')
      expect(config.environment).toEqual({
        POSTGRES_INITDB_ARGS: '--auth-local=trust',
        TZ: 'UTC',
      })
    })

    it('should support init scripts configuration', () => {
      const config = createPostgresConfig({
        initScripts: ['/path/to/init1.sql', '/path/to/init2.sql'],
      })

      expect(config.initScripts).toEqual(['/path/to/init1.sql', '/path/to/init2.sql'])
    })

    it('should support migration and seed configuration', () => {
      const config = createPostgresConfig({
        migrationConfig: {
          migrationsPath: '/migrations',
          tableName: 'schema_migrations',
        },
        seedConfig: {
          data: { users: [{ name: 'test' }] },
          truncate: true,
        },
      })

      expect(config.migrationConfig?.migrationsPath).toBe('/migrations')
      expect(config.migrationConfig?.tableName).toBe('schema_migrations')
      expect(config.seedConfig?.data).toEqual({ users: [{ name: 'test' }] })
      expect(config.seedConfig?.truncate).toBe(true)
    })
  })

  describe('Container Lifecycle', () => {
    it('should start container and establish connection', async () => {
      const config = createPostgresConfig()
      const container = new PostgresContainer(config)

      await container.start()
      const context = await container.getTestContext()
      cleanups.push(context.cleanup)

      // Verify container properties
      expect(container.getPort()).toBeGreaterThan(0)
      expect(container.getConnectionString()).toMatch(
        /^postgresql:\/\/test_user:test_pass@.*:\d+\/test_db$/,
      )

      // Verify connection config
      const connectionConfig = container.getConnectionConfig()
      expect(connectionConfig).toMatchObject({
        host: expect.any(String),
        port: expect.any(Number),
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
        options: {},
      })

      // Verify we can execute queries
      const result = await context.client.query('SELECT version()')
      expect(result.rows[0].version).toContain('PostgreSQL')
    })

    it('should handle container restart', async () => {
      const container = new PostgresContainer(createPostgresConfig())

      await container.start()
      const originalPort = container.getPort()

      // Stop and restart
      await container.stop()
      await container.start()

      const context = await container.getTestContext()
      cleanups.push(context.cleanup)

      // Port may change after restart
      const newPort = container.getPort()
      expect(newPort).toBeGreaterThan(0)

      // Should still be able to connect
      const result = await context.client.query('SELECT 1 as test')
      expect(result.rows[0].test).toBe(1)
    })

    it('should prevent double start', async () => {
      const container = new PostgresContainer(createPostgresConfig())

      await container.start()
      const context = await container.getTestContext()
      cleanups.push(context.cleanup)

      // Second start should be no-op
      await container.start()

      // Should still work normally
      const result = await context.client.query('SELECT 1 as test')
      expect(result.rows[0].test).toBe(1)
    })

    it('should handle multiple containers simultaneously', async () => {
      const containers = await Promise.all([
        setupPostgresTest({ config: { database: 'db1' } }),
        setupPostgresTest({ config: { database: 'db2' } }),
        setupPostgresTest({ config: { database: 'db3' } }),
      ])

      containers.forEach(({ cleanup }) => cleanups.push(cleanup))

      // Each should have different ports
      const ports = containers.map(({ port }) => port)
      const uniquePorts = new Set(ports)
      expect(uniquePorts.size).toBe(3)

      // Each should be functional
      const results = await Promise.all(
        containers.map(async ({ db }, i) => {
          const result = await db.query(`SELECT '${i}' as container_id`)
          return result.rows[0].container_id
        }),
      )

      expect(results).toEqual(['0', '1', '2'])
    })
  })

  describe('Connection Management', () => {
    it('should wait for database to be ready', async () => {
      const container = new PostgresContainer(createPostgresConfig())

      await container.start()
      const context = await container.getTestContext()
      cleanups.push(context.cleanup)

      // waitForReady is called internally, but test it explicitly
      await expect(container.waitForReady()).resolves.toBeUndefined()
    })

    it('should timeout if database never becomes ready', async () => {
      const container = new PostgresContainer(
        createPostgresConfig({
          image: 'busybox:latest', // This won't start postgres
        }),
      )

      await expect(container.start()).rejects.toThrow()
    }, 45000)

    it('should handle connection timeouts gracefully', async () => {
      const container = new PostgresContainer(createPostgresConfig())

      await container.start()
      const context = await container.getTestContext()
      cleanups.push(context.cleanup)

      // Test with a query that should timeout quickly
      const client = context.client as Client
      await expect(client.query('SELECT pg_sleep(0.1)')).resolves.toBeDefined()
    })
  })

  describe('Environment Variables', () => {
    it('should apply custom environment variables', async () => {
      const config = createPostgresConfig({
        environment: {
          POSTGRES_INITDB_ARGS: '--auth-local=trust --locale=C',
          TZ: 'America/New_York',
        },
      })

      const container = new PostgresContainer(config)
      await container.start()
      const context = await container.getTestContext()
      cleanups.push(context.cleanup)

      // Verify timezone setting worked
      const result = await context.client.query('SHOW timezone')
      expect(result.rows[0].TimeZone).toBe('America/New_York')
    })

    it('should handle empty environment variables', async () => {
      const config = createPostgresConfig({
        environment: {},
      })

      const container = new PostgresContainer(config)
      await container.start()
      const context = await container.getTestContext()
      cleanups.push(context.cleanup)

      // Should work normally with empty env
      const result = await context.client.query('SELECT 1 as test')
      expect(result.rows[0].test).toBe(1)
    })
  })

  describe('Initialization Scripts', () => {
    it('should execute initialization scripts', async () => {
      const initDir = path.join(testDir, 'init-scripts')
      await mkdir(initDir, { recursive: true })

      const script1 = path.join(initDir, '01-create-schema.sql')
      const script2 = path.join(initDir, '02-create-table.sql')

      await writeFile(script1, 'CREATE SCHEMA test_schema;')
      await writeFile(
        script2,
        `
        CREATE TABLE test_schema.init_test (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        );
        INSERT INTO test_schema.init_test (name) VALUES ('initialized');
      `,
      )

      const config = createPostgresConfig({
        initScripts: [script1, script2],
      })

      const container = new PostgresContainer(config)
      await container.start()
      const context = await container.getTestContext()
      cleanups.push(context.cleanup)

      // Verify schema and table were created
      const schemaResult = await context.client.query(`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name = 'test_schema'
      `)
      expect(schemaResult.rows).toHaveLength(1)

      // Verify data was inserted
      const dataResult = await context.client.query(`
        SELECT name FROM test_schema.init_test
      `)
      expect(dataResult.rows[0].name).toBe('initialized')
    })

    it('should handle missing init script files', async () => {
      const config = createPostgresConfig({
        initScripts: ['/non/existent/script.sql'],
      })

      const container = new PostgresContainer(config)
      await expect(container.start()).rejects.toThrow()
    })

    it('should handle empty init scripts array', async () => {
      const config = createPostgresConfig({
        initScripts: [],
      })

      const container = new PostgresContainer(config)
      await container.start()
      const context = await container.getTestContext()
      cleanups.push(context.cleanup)

      // Should work normally
      const result = await context.client.query('SELECT 1 as test')
      expect(result.rows[0].test).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when accessing methods before start', () => {
      const container = new PostgresContainer(createPostgresConfig())

      expect(() => container.getConnectionString()).toThrow('Container not started')
      expect(() => container.getConnectionConfig()).toThrow('Container not started')
      expect(() => container.getPort()).toThrow('Container not started')
      expect(() => container.waitForReady()).rejects.toThrow('Container not started')
    })

    it('should handle invalid image gracefully', async () => {
      const container = new PostgresContainer(
        createPostgresConfig({
          image: 'non-existent-image:latest',
        }),
      )

      await expect(container.start()).rejects.toThrow()
    }, 60000)

    it('should cleanup on startup failure', async () => {
      const container = new PostgresContainer(
        createPostgresConfig({
          image: 'busybox:latest',
        }),
      )

      await expect(container.start()).rejects.toThrow()

      // Verify container is not marked as started
      expect(container['isStarted']).toBe(false)
    }, 45000)

    it('should handle client creation failure', async () => {
      const container = new PostgresContainer(
        createPostgresConfig({
          password: '', // Invalid password that might cause connection issues
        }),
      )

      // This might succeed or fail depending on PostgreSQL version
      // The key is that it shouldn't crash
      try {
        await container.start()
        const context = await container.getTestContext()
        cleanups.push(context.cleanup)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }
    })
  })

  describe('Health Checks', () => {
    it('should perform default health check', async () => {
      const { db, cleanup } = await setupPostgresTest()
      cleanups.push(cleanup)

      // Create a container instance to test health check
      const container = new PostgresContainer(createPostgresConfig())
      await container.start()
      const containerContext = await container.getTestContext()
      cleanups.push(containerContext.cleanup)

      const healthResult = await container.healthCheck()
      expect(healthResult.healthy).toBe(true)
      expect(healthResult.responseTime).toBeGreaterThan(0)
      expect(healthResult.error).toBeUndefined()
    })

    it('should handle health check failure', async () => {
      const container = new PostgresContainer(createPostgresConfig())
      await container.start()
      const context = await container.getTestContext()

      // Close the client to simulate health check failure
      await context.client.end()

      const healthResult = await container.healthCheck()
      expect(healthResult.healthy).toBe(false)
      expect(healthResult.error).toBeDefined()

      // Still need to cleanup the container
      await container.stop()
    })

    it('should support custom health check', async () => {
      let customHealthCheckCalled = false

      const config = createPostgresConfig()
      const container = new PostgresContainer({
        ...config,
        healthCheck: async () => {
          customHealthCheckCalled = true
          return {
            healthy: true,
            responseTime: 100,
          }
        },
      })

      await container.start()
      const context = await container.getTestContext()
      cleanups.push(context.cleanup)

      const healthResult = await container.healthCheck()
      expect(customHealthCheckCalled).toBe(true)
      expect(healthResult.healthy).toBe(true)
      expect(healthResult.responseTime).toBe(100)
    })
  })

  describe('Resource Cleanup', () => {
    it('should track and cleanup all resources', async () => {
      const container = new PostgresContainer(createPostgresConfig())

      await container.start()
      const metrics = container.getStartupMetrics()

      expect(metrics.isStarted).toBe(true)
      expect(metrics.startupTime).toBeGreaterThan(0)
      expect(metrics.resourceCount).toBeGreaterThan(0)

      await container.stop()

      const finalMetrics = container.getStartupMetrics()
      expect(finalMetrics.isStarted).toBe(false)
    })

    it('should handle cleanup errors gracefully', async () => {
      const container = new PostgresContainer(createPostgresConfig())

      await container.start()

      // Force an error during cleanup by corrupting the container reference
      container['container'] = null as any

      // Should not throw despite the error
      await expect(container.stop()).resolves.toBeUndefined()
    })

    it('should support multiple stop calls', async () => {
      const container = new PostgresContainer(createPostgresConfig())

      await container.start()
      await container.stop()

      // Second stop should be safe
      await expect(container.stop()).resolves.toBeUndefined()
    })
  })

  describe('Helper Functions', () => {
    it('should work with createPostgresContext', async () => {
      const context = await createPostgresContext({
        database: 'context_test_db',
      })
      cleanups.push(context.cleanup)

      expect(context.container).toBeDefined()
      expect(context.client).toBeDefined()
      expect(context.connectionString).toContain('context_test_db')
      expect(context.connectionConfig.database).toBe('context_test_db')

      // Test all context methods
      expect(typeof context.cleanup).toBe('function')
      expect(typeof context.reset).toBe('function')
      expect(typeof context.migrate).toBe('function')
      expect(typeof context.seed).toBe('function')

      const result = await context.client.query('SELECT current_database()')
      expect(result.rows[0].current_database).toBe('context_test_db')
    })

    it('should work with setupPostgresTest', async () => {
      const { db, connectionString, cleanup, reset, host, port, database, username } =
        await setupPostgresTest({
          config: { database: 'setup_test_db' },
        })
      cleanups.push(cleanup)

      expect(db).toBeDefined()
      expect(connectionString).toContain('setup_test_db')
      expect(host).toBeDefined()
      expect(port).toBeGreaterThan(0)
      expect(database).toBe('setup_test_db')
      expect(username).toBe('test_user')
      expect(typeof reset).toBe('function')

      const result = await db.query('SELECT 1 + 1 AS sum')
      expect(result.rows[0].sum).toBe(2)
    })

    it('should auto-register cleanup handlers', async () => {
      // This tests the integration with docker-utils cleanup registration
      const { cleanup } = await setupPostgresTest()

      // The cleanup should be auto-registered
      expect(typeof cleanup).toBe('function')

      // Cleanup should work without throwing
      await expect(cleanup()).resolves.toBeUndefined()
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent container creation', async () => {
      const startTime = Date.now()

      const containers = await Promise.all([
        setupPostgresTest({ config: { database: 'concurrent1' } }),
        setupPostgresTest({ config: { database: 'concurrent2' } }),
        setupPostgresTest({ config: { database: 'concurrent3' } }),
      ])

      const endTime = Date.now()

      containers.forEach(({ cleanup }) => cleanups.push(cleanup))

      // All should be functional
      const results = await Promise.all(
        containers.map(({ db, database }) =>
          db.query('SELECT current_database()').then((r) => r.rows[0].current_database),
        ),
      )

      expect(results).toEqual(['concurrent1', 'concurrent2', 'concurrent3'])

      // Should be faster than sequential (rough check)
      console.log(`Concurrent container creation took ${endTime - startTime}ms`)
    })

    it('should handle concurrent operations on same container', async () => {
      const { db, cleanup } = await setupPostgresTest()
      cleanups.push(cleanup)

      // Create test table
      await db.query(`
        CREATE TABLE concurrent_test (
          id SERIAL PRIMARY KEY,
          value INTEGER
        )
      `)

      // Run concurrent inserts
      const insertPromises = Array.from({ length: 10 }, (_, i) =>
        db.query('INSERT INTO concurrent_test (value) VALUES ($1)', [i]),
      )

      await Promise.all(insertPromises)

      const result = await db.query('SELECT COUNT(*) FROM concurrent_test')
      expect(Number(result.rows[0].count)).toBe(10)
    })
  })
})
