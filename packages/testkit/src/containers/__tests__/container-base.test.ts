/**
 * Base Database Container Tests
 * Tests the base functionality shared across all database container implementations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import * as path from 'node:path'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { BaseDatabaseContainer, createPoolConfig, createDatabaseConfig } from '../base-database.js'
import { IsolationLevel, type BaseDatabaseConfig, type HealthCheckResult } from '../types.js'

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
  hasTestcontainers && (process.env.NODE_ENV === 'test' || process.env.TESTCONTAINERS_BASE === '1')

// Mock container implementation for testing base functionality
class MockDatabaseContainer extends BaseDatabaseContainer<string, MockClient, MockPool> {
  private mockContainer?: string
  private mockClient?: MockClient
  private mockPool?: MockPool

  constructor(config: BaseDatabaseConfig) {
    super(config)
  }

  protected async createContainer(): Promise<string> {
    if (this.config.image === 'fail-image') {
      throw new Error('Failed to create container')
    }
    this.mockContainer = `mock-container-${Date.now()}`
    return this.mockContainer
  }

  protected async createClient(): Promise<void> {
    if (!this.mockContainer) throw new Error('Container not started')
    this.mockClient = new MockClient()
    this.client = this.mockClient
    this.mockPool = new MockPool()
    this.pool = this.mockPool

    // Track resources for cleanup
    this.resourceTracker.track(this.mockClient, async (client) => {
      await client.end()
    })
    this.resourceTracker.track(this.mockPool, async (pool) => {
      await pool.end()
    })
  }

  getConnectionString(): string {
    if (!this.mockContainer) throw new Error('Container not started')
    return `mock://localhost:5432/testdb`
  }

  getConnectionConfig() {
    if (!this.mockContainer) throw new Error('Container not started')
    return {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'testuser',
      password: 'testpass',
      options: {},
    }
  }

  getPort(): number {
    if (!this.mockContainer) throw new Error('Container not started')
    return 5432
  }

  async waitForReady(): Promise<void> {
    if (!this.mockContainer) throw new Error('Container not started')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  protected async runMigrations(): Promise<void> {
    if (!this.mockClient) throw new Error('Client not initialized')
    this.mockClient.executedMigrations = ['001_init', '002_schema']
  }

  protected async runSeeding(): Promise<void> {
    if (!this.mockClient) throw new Error('Client not initialized')
    this.mockClient.seedData = { users: [{ id: 1, name: 'test' }] }
  }

  protected async resetDatabase(): Promise<void> {
    if (!this.mockClient) throw new Error('Client not initialized')
    this.mockClient.reset()
  }

  protected async rollbackTransaction(): Promise<void> {
    if (!this.mockClient) throw new Error('Client not initialized')
    this.mockClient.rollback()
  }

  protected async performDefaultHealthCheck(): Promise<void> {
    if (!this.mockClient) throw new Error('Client not initialized')
    // Add a small delay to simulate real health check
    await new Promise((resolve) => setTimeout(resolve, 1))
    if (this.mockClient.healthy === false) {
      throw new Error('Health check failed')
    }
  }
}

class MockClient {
  public executedMigrations: string[] = []
  public seedData: Record<string, unknown[]> = {}
  public healthy = true
  private _isReset = false
  private _isRolledBack = false

  reset(): void {
    this._isReset = true
    this.executedMigrations = []
    this.seedData = {}
  }

  rollback(): void {
    this._isRolledBack = true
  }

  get isReset(): boolean {
    return this._isReset
  }

  get isRolledBack(): boolean {
    return this._isRolledBack
  }

  async end(): Promise<void> {
    // Mock cleanup
  }
}

class MockPool {
  async end(): Promise<void> {
    // Mock cleanup
  }
}

describe.skipIf(!shouldRun)('BaseDatabaseContainer', () => {
  const cleanups: Array<() => Promise<void>> = []
  let testDir: string

  beforeAll(async () => {
    testDir = path.join(__dirname, 'temp-base-test')
    await mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    await Promise.allSettled(cleanups.map((cleanup) => cleanup()))
    cleanups.length = 0

    if (testDir) {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  beforeEach(() => {
    cleanups.length = 0
  })

  describe('Configuration', () => {
    it('should create default pool configuration', () => {
      const config = createPoolConfig()

      expect(config).toEqual({
        min: 1,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statementTimeout: 30000,
      })
    })

    it('should override pool configuration', () => {
      const config = createPoolConfig({
        min: 2,
        max: 20,
        idleTimeoutMillis: 60000,
      })

      expect(config.min).toBe(2)
      expect(config.max).toBe(20)
      expect(config.idleTimeoutMillis).toBe(60000)
      expect(config.connectionTimeoutMillis).toBe(10000) // default
    })

    it('should create default database configuration', () => {
      const config = createDatabaseConfig()

      expect(config).toEqual({
        image: 'postgres:15-alpine',
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        startupTimeout: 30000,
        reusable: false,
        environment: {},
        initScripts: [],
      })
    })

    it('should override database configuration', () => {
      const config = createDatabaseConfig({
        image: 'mysql:8.0',
        database: 'custom_db',
        username: 'custom_user',
        environment: { TZ: 'UTC' },
        reusable: true,
      })

      expect(config.image).toBe('mysql:8.0')
      expect(config.database).toBe('custom_db')
      expect(config.username).toBe('custom_user')
      expect(config.environment).toEqual({ TZ: 'UTC' })
      expect(config.reusable).toBe(true)
    })
  })

  describe('Container Lifecycle', () => {
    it('should start container successfully', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      const metrics = container.getStartupMetrics()
      expect(metrics.isStarted).toBe(true)
      expect(metrics.startupTime).toBeGreaterThan(0)
      expect(metrics.resourceCount).toBeGreaterThan(0)

      expect(container.getConnectionString()).toBe('mock://localhost:5432/testdb')
      expect(container.getPort()).toBe(5432)
    })

    it('should prevent multiple starts', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      // Second start should be no-op
      await container.start()

      const metrics = container.getStartupMetrics()
      expect(metrics.isStarted).toBe(true)
    })

    it('should handle startup failure gracefully', async () => {
      const config = createDatabaseConfig({
        image: 'fail-image',
      })
      const container = new MockDatabaseContainer(config)

      await expect(container.start()).rejects.toThrow('Failed to start database container')

      const metrics = container.getStartupMetrics()
      expect(metrics.isStarted).toBe(false)
    })

    it('should stop container safely', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      await container.stop()

      const metrics = container.getStartupMetrics()
      expect(metrics.isStarted).toBe(false)
    })

    it('should handle multiple stops safely', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      await container.stop()
      await container.stop() // Should not throw

      const metrics = container.getStartupMetrics()
      expect(metrics.isStarted).toBe(false)
    })
  })

  describe('Lifecycle Hooks', () => {
    it('should execute lifecycle hooks in correct order', async () => {
      const hooksCalled: string[] = []

      const config = createDatabaseConfig({
        hooks: {
          beforeStart: async () => {
            hooksCalled.push('beforeStart')
          },
          afterStart: async () => {
            hooksCalled.push('afterStart')
          },
          onReady: async () => {
            hooksCalled.push('onReady')
          },
          beforeStop: async () => {
            hooksCalled.push('beforeStop')
          },
          afterStop: async () => {
            hooksCalled.push('afterStop')
          },
        },
      })

      const container = new MockDatabaseContainer(config)

      await container.start()
      expect(hooksCalled).toEqual(['beforeStart', 'afterStart', 'onReady'])

      hooksCalled.length = 0
      await container.stop()
      expect(hooksCalled).toEqual(['beforeStop', 'afterStop'])
    })

    it('should handle hook failures', async () => {
      const config = createDatabaseConfig({
        hooks: {
          beforeStart: async () => {
            throw new Error('Hook failed')
          },
        },
      })

      const container = new MockDatabaseContainer(config)
      await expect(container.start()).rejects.toThrow('Failed to start database container')
    })
  })

  describe('Migration Support', () => {
    it('should run migrations when migration config provided', async () => {
      const migrationDir = path.join(testDir, 'migrations')
      await mkdir(migrationDir, { recursive: true })
      await writeFile(path.join(migrationDir, '001_init.sql'), 'CREATE TABLE test();')

      const config = createDatabaseConfig({
        migrationConfig: {
          migrationsPath: migrationDir,
          tableName: 'migrations',
        },
      })

      const container = new MockDatabaseContainer(config)
      await container.start()
      cleanups.push(() => container.stop())

      await container.migrate()

      const context = await container.getTestContext()
      const client = context.client as MockClient
      expect(client.executedMigrations).toEqual(['001_init', '002_schema'])
    })

    it('should skip migrations when no config provided', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      await container.migrate() // Should not throw

      const context = await container.getTestContext()
      const client = context.client as MockClient
      expect(client.executedMigrations).toHaveLength(0)
    })

    it('should override migration config at runtime', async () => {
      const migrationDir = path.join(testDir, 'runtime-migrations')
      await mkdir(migrationDir, { recursive: true })

      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      await container.migrate({
        migrationsPath: migrationDir,
        tableName: 'custom_migrations',
      })

      const context = await container.getTestContext()
      const client = context.client as MockClient
      expect(client.executedMigrations).toEqual(['001_init', '002_schema'])
    })
  })

  describe('Seeding Support', () => {
    it('should run seeding when seed config provided', async () => {
      const config = createDatabaseConfig({
        seedConfig: {
          data: { users: [{ id: 1, name: 'test' }] },
        },
      })

      const container = new MockDatabaseContainer(config)
      await container.start()
      cleanups.push(() => container.stop())

      await container.seed()

      const context = await container.getTestContext()
      const client = context.client as MockClient
      expect(client.seedData).toEqual({ users: [{ id: 1, name: 'test' }] })
    })

    it('should skip seeding when no config provided', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      await container.seed() // Should not throw

      const context = await container.getTestContext()
      const client = context.client as MockClient
      expect(Object.keys(client.seedData)).toHaveLength(0)
    })

    it('should override seed config at runtime', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      await container.seed({
        data: { products: [{ id: 1, name: 'widget' }] },
      })

      const context = await container.getTestContext()
      const client = context.client as MockClient
      expect(client.seedData).toEqual({ users: [{ id: 1, name: 'test' }] })
    })
  })

  describe('Database Reset', () => {
    it('should reset database with DATABASE isolation', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      await container.reset(IsolationLevel.DATABASE)

      const context = await container.getTestContext()
      const client = context.client as MockClient
      expect(client.isReset).toBe(true)
    })

    it('should rollback transaction with TRANSACTION isolation', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      await container.reset(IsolationLevel.TRANSACTION)

      const context = await container.getTestContext()
      const client = context.client as MockClient
      expect(client.isRolledBack).toBe(true)
    })

    it('should do nothing with SHARED isolation', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      await container.reset(IsolationLevel.SHARED)

      const context = await container.getTestContext()
      const client = context.client as MockClient
      expect(client.isReset).toBe(false)
      expect(client.isRolledBack).toBe(false)
    })

    it('should use default TRANSACTION isolation', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      await container.reset() // No isolation level specified

      const context = await container.getTestContext()
      const client = context.client as MockClient
      expect(client.isRolledBack).toBe(true)
    })

    it('should throw for unsupported isolation level', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      await expect(container.reset('invalid' as IsolationLevel)).rejects.toThrow(
        'Unsupported isolation level',
      )
    })
  })

  describe('Health Checks', () => {
    it('should perform successful health check', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      const result = await container.healthCheck()

      expect(result.healthy).toBe(true)
      expect(result.responseTime).toBeGreaterThan(0)
      expect(result.error).toBeUndefined()
    })

    it('should handle health check failure', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      const context = await container.getTestContext()
      const client = context.client as MockClient
      client.healthy = false

      const result = await container.healthCheck()

      expect(result.healthy).toBe(false)
      expect(result.responseTime).toBeGreaterThan(0)
      expect(result.error).toBeDefined()

      await container.stop()
    })

    it('should use custom health check when provided', async () => {
      let customHealthCheckCalled = false
      const customResult: HealthCheckResult = {
        healthy: true,
        responseTime: 50,
        error: undefined,
      }

      const config = createDatabaseConfig({
        healthCheck: async () => {
          customHealthCheckCalled = true
          return customResult
        },
      })

      const container = new MockDatabaseContainer(config)
      await container.start()
      cleanups.push(() => container.stop())

      const result = await container.healthCheck()

      expect(customHealthCheckCalled).toBe(true)
      expect(result).toEqual(customResult)
    })
  })

  describe('Test Context', () => {
    it('should provide complete test context', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      cleanups.push(() => container.stop())

      const context = await container.getTestContext()

      expect(context.container).toBeDefined()
      expect(context.client).toBeDefined()
      expect(context.connectionString).toBe('mock://localhost:5432/testdb')
      expect(context.connectionConfig).toEqual({
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
        options: {},
      })
      expect(typeof context.cleanup).toBe('function')
      expect(typeof context.reset).toBe('function')
      expect(typeof context.migrate).toBe('function')
      expect(typeof context.seed).toBe('function')
    })

    it('should throw when getting context before start', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await expect(container.getTestContext()).rejects.toThrow(
        'Container must be started before getting test context',
      )
    })

    it('should execute context methods correctly', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()
      const context = await container.getTestContext()

      // Test reset through context
      await context.reset()
      const client = context.client as MockClient
      expect(client.isRolledBack).toBe(true)

      // Test cleanup through context
      await context.cleanup()
      const metrics = container.getStartupMetrics()
      expect(metrics.isStarted).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should throw when accessing methods before start', async () => {
      const container = new MockDatabaseContainer(createDatabaseConfig())

      expect(() => container.getConnectionString()).toThrow('Container not started')
      expect(() => container.getConnectionConfig()).toThrow('Container not started')
      expect(() => container.getPort()).toThrow('Container not started')
      await expect(container.waitForReady()).rejects.toThrow('Container not started')
    })

    it('should throw when calling methods requiring client before initialization', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await expect(container.migrate()).rejects.toThrow('Database client not initialized')
      await expect(container.seed()).rejects.toThrow('Database client not initialized')
      await expect(container.reset()).rejects.toThrow('Database client not initialized')
    })

    it('should handle cleanup errors gracefully', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      await container.start()

      // Force an error during cleanup
      container['container'] = null as any

      // Should not throw despite cleanup errors
      await expect(container.stop()).resolves.toBeUndefined()
    })
  })

  describe('Resource Tracking', () => {
    it('should track resources correctly', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      const initialMetrics = container.getStartupMetrics()
      expect(initialMetrics.resourceCount).toBe(0)

      await container.start()
      const afterStartMetrics = container.getStartupMetrics()
      expect(afterStartMetrics.resourceCount).toBeGreaterThan(0)

      await container.stop()
      // Resources should be cleaned up but tracker might still exist
      const finalMetrics = container.getStartupMetrics()
      expect(finalMetrics.isStarted).toBe(false)
    })

    it('should provide startup metrics', async () => {
      const config = createDatabaseConfig()
      const container = new MockDatabaseContainer(config)

      const beforeStart = container.getStartupMetrics()
      expect(beforeStart.isStarted).toBe(false)
      expect(beforeStart.startupTime).toBe(0)

      await container.start()
      cleanups.push(() => container.stop())

      const afterStart = container.getStartupMetrics()
      expect(afterStart.isStarted).toBe(true)
      expect(afterStart.startupTime).toBeGreaterThan(0)
      expect(afterStart.resourceCount).toBeGreaterThan(0)
    })
  })
})
