/**
 * Abstract base class for database containers
 * Provides common functionality that can be shared between different database implementations
 */

import type { Pool } from 'pg'
import {
  type BaseDatabaseConfig,
  type DatabaseConnectionConfig,
  type DatabaseTestContext,
  type HealthCheckResult,
  type MigrationConfig,
  type PoolConfig,
  type ResourceTracker,
  type SeedConfig,
  IsolationLevel,
} from './types.js'

/**
 * Abstract base class for database container implementations
 */
export abstract class BaseDatabaseContainer<TContainer, TClient> {
  protected container?: TContainer
  protected client?: TClient
  protected pool?: Pool
  protected resourceTracker: ResourceTracker
  protected isStarted = false
  protected startupTime = 0

  constructor(protected config: BaseDatabaseConfig) {
    this.resourceTracker = new SimpleResourceTracker()
  }

  /**
   * Start the database container
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return
    }

    const startTime = Date.now()

    try {
      await this.config.hooks?.beforeStart?.()
      this.container = await this.createContainer()
      await this.config.hooks?.afterStart?.()

      await this.waitForReady()
      await this.createClient()
      await this.config.hooks?.onReady?.()

      this.isStarted = true
      this.startupTime = Date.now() - startTime
    } catch (error) {
      await this.cleanup()
      throw new Error(`Failed to start database container: ${error}`)
    }
  }

  /**
   * Stop the database container and cleanup resources
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return
    }

    try {
      await this.config.hooks?.beforeStop?.()
      await this.cleanup()
      await this.config.hooks?.afterStop?.()
    } catch (error) {
      console.warn(`Error during container cleanup: ${error}`)
    } finally {
      this.isStarted = false
    }
  }

  /**
   * Get the database connection string
   */
  abstract getConnectionString(): string

  /**
   * Get the database connection configuration
   */
  abstract getConnectionConfig(): DatabaseConnectionConfig

  /**
   * Get the database port
   */
  abstract getPort(): number

  /**
   * Wait for the database to be ready for connections
   */
  abstract waitForReady(): Promise<void>

  /**
   * Create the underlying container instance
   */
  protected abstract createContainer(): Promise<TContainer>

  /**
   * Create the database client connection
   */
  protected abstract createClient(): Promise<void>

  /**
   * Run database migrations
   */
  async migrate(config?: MigrationConfig): Promise<void> {
    if (!this.client) {
      throw new Error('Database client not initialized')
    }

    const migrationConfig = { ...this.config.migrationConfig, ...config }
    if (!migrationConfig?.migrationsPath) {
      return // No migrations to run
    }

    await this.runMigrations(migrationConfig as MigrationConfig)
  }

  /**
   * Seed the database with test data
   */
  async seed(config?: SeedConfig): Promise<void> {
    if (!this.client) {
      throw new Error('Database client not initialized')
    }

    const seedConfig = { ...this.config.seedConfig, ...config }
    if (!seedConfig?.data) {
      return // No seed data to insert
    }

    await this.runSeeding(seedConfig as SeedConfig)
  }

  /**
   * Reset the database to a clean state
   * Implementation depends on isolation level
   */
  async reset(isolationLevel: IsolationLevel = IsolationLevel.TRANSACTION): Promise<void> {
    if (!this.client) {
      throw new Error('Database client not initialized')
    }

    switch (isolationLevel) {
      case IsolationLevel.DATABASE:
        await this.resetDatabase()
        break
      case IsolationLevel.TRANSACTION:
        await this.rollbackTransaction()
        break
      case IsolationLevel.SHARED:
        // No reset needed for shared isolation
        break
      default:
        throw new Error(`Unsupported isolation level: ${isolationLevel}`)
    }
  }

  /**
   * Perform a health check on the database
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      if (this.config.healthCheck) {
        return await this.config.healthCheck()
      }

      // Default health check - simple connection test
      await this.performDefaultHealthCheck()

      return {
        healthy: true,
        responseTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Get a test context for use in tests
   */
  async getTestContext(): Promise<DatabaseTestContext<TContainer, TClient>> {
    if (!this.isStarted || !this.container || !this.client) {
      throw new Error('Container must be started before getting test context')
    }

    return {
      container: this.container,
      client: this.client,
      connectionString: this.getConnectionString(),
      connectionConfig: this.getConnectionConfig(),
      cleanup: () => this.stop(),
      reset: (isolationLevel?: IsolationLevel) => this.reset(isolationLevel),
      migrate: (config?: MigrationConfig) => this.migrate(config),
      seed: (config?: SeedConfig) => this.seed(config),
    }
  }

  /**
   * Get container startup metrics
   */
  getStartupMetrics() {
    return {
      isStarted: this.isStarted,
      startupTime: this.startupTime,
      resourceCount: this.resourceTracker.count(),
    }
  }

  /**
   * Implementation-specific migration execution
   */
  protected abstract runMigrations(config: MigrationConfig): Promise<void>

  /**
   * Implementation-specific seeding execution
   */
  protected abstract runSeeding(config: SeedConfig): Promise<void>

  /**
   * Implementation-specific database reset
   */
  protected abstract resetDatabase(): Promise<void>

  /**
   * Implementation-specific transaction rollback
   */
  protected abstract rollbackTransaction(): Promise<void>

  /**
   * Implementation-specific health check
   */
  protected abstract performDefaultHealthCheck(): Promise<void>

  /**
   * Cleanup all resources
   */
  protected async cleanup(): Promise<void> {
    await this.resourceTracker.cleanup()

    if (this.pool) {
      await this.pool.end()
      this.pool = undefined
    }

    if (
      this.client &&
      typeof this.client === 'object' &&
      this.client !== null &&
      'end' in this.client &&
      typeof (this.client as { end?: unknown }).end === 'function'
    ) {
      await (this.client as { end: () => Promise<void> }).end()
      this.client = undefined
    }

    if (
      this.container &&
      typeof this.container === 'object' &&
      this.container !== null &&
      'stop' in this.container &&
      typeof (this.container as { stop?: unknown }).stop === 'function'
    ) {
      await (this.container as { stop: () => Promise<void> }).stop()
      this.container = undefined
    }
  }
}

/**
 * Simple implementation of ResourceTracker
 */
class SimpleResourceTracker implements ResourceTracker {
  private resources: Array<{
    resource: unknown
    cleanup: (resource: unknown) => Promise<void>
  }> = []

  track<T>(resource: T, cleanup: (resource: T) => Promise<void>): void {
    this.resources.push({
      resource,
      cleanup: cleanup as (resource: unknown) => Promise<void>,
    })
  }

  async cleanup(): Promise<void> {
    const errors: Error[] = []

    // Cleanup in reverse order (LIFO)
    for (const { resource, cleanup } of this.resources.reverse()) {
      try {
        await cleanup(resource)
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
      }
    }

    this.resources = []

    if (errors.length > 0) {
      throw new Error(`Cleanup errors: ${errors.map((e) => e.message).join(', ')}`)
    }
  }

  count(): number {
    return this.resources.length
  }
}

/**
 * Helper function to create connection pool configuration
 */
export function createPoolConfig(overrides: Partial<PoolConfig> = {}): PoolConfig {
  return {
    min: 1,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statementTimeout: 30000,
    ...overrides,
  }
}

/**
 * Helper function to create base database configuration
 */
export function createDatabaseConfig(
  overrides: Partial<BaseDatabaseConfig> = {},
): BaseDatabaseConfig {
  return {
    image: 'postgres:15-alpine',
    database: 'test_db',
    username: 'test_user',
    password: 'test_password',
    startupTimeout: 30000,
    reusable: false,
    environment: {},
    initScripts: [],
    ...overrides,
  }
}
