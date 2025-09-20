/**
 * MySQL container implementation using Testcontainers
 * Extends the base database container with MySQL-specific functionality
 */

import { MySqlContainer } from '@testcontainers/mysql'
import type { StartedMySqlContainer } from '@testcontainers/mysql'
import * as mysql from 'mysql2/promise'
import type { Connection, Pool, PoolConnection } from 'mysql2/promise'
import * as path from 'node:path'
import { readFile } from 'node:fs/promises'
import { BaseDatabaseContainer, createPoolConfig } from './base-database.js'
import type {
  DatabaseConnectionConfig,
  DatabaseTestContext,
  MigrationConfig,
  SeedConfig,
  IsolationLevel,
} from './types.js'
import {
  type MySQLDatabaseConfig,
  type MySQLConnectionOptions,
  createMySQLConfig,
  MySQLPresets,
  MySQLSQLMode,
  MySQLCharacterSet,
} from './mysql-config.js'

/**
 * MySQL container implementation extending the base database container
 */
export class MySQLContainer extends BaseDatabaseContainer<StartedMySqlContainer, Connection> {
  private mysqlPool?: Pool
  private currentTransaction?: PoolConnection

  constructor(config: MySQLDatabaseConfig) {
    super(config)
  }

  /**
   * Create the MySQL container instance
   */
  protected async createContainer(): Promise<StartedMySqlContainer> {
    const config = this.config as MySQLDatabaseConfig

    let container = new MySqlContainer(config.image)
      .withDatabase(config.database)
      .withUsername(config.username)
      .withUserPassword(config.password)

    // Set root password if provided
    if (config.rootPassword) {
      container = container.withRootPassword(config.rootPassword)
    }

    // Add environment variables
    if (config.environment) {
      for (const [key, value] of Object.entries(config.environment)) {
        container = container.withEnvironment({ [key]: value })
      }
    }

    // Add custom configuration file if provided
    if (config.mysqlConfigFile) {
      container = container.withCopyContentToContainer([
        {
          content: config.mysqlConfigFile,
          target: '/etc/mysql/conf.d/custom.cnf',
        },
      ])
    }

    // Build MySQL command arguments
    const mysqlArgs = this.buildMySQLArgs(config)
    if (mysqlArgs.length > 0) {
      container = container.withCommand(['mysqld', ...mysqlArgs])
    }

    // Add initialization scripts
    if (config.initScripts && config.initScripts.length > 0) {
      for (const script of config.initScripts) {
        const content = await readFile(script, 'utf-8')
        container = container.withCopyContentToContainer([
          {
            content,
            target: `/docker-entrypoint-initdb.d/${path.basename(script)}`,
          },
        ])
      }
    }

    // Start the container
    const startedContainer = await container.start()

    // Track container for cleanup
    this.resourceTracker.track(startedContainer, async (container) => {
      await container.stop()
    })

    return startedContainer
  }

  /**
   * Create the MySQL client connection
   */
  protected async createClient(): Promise<void> {
    if (!this.container) {
      throw new Error('Container not started')
    }

    const config = this.config as MySQLDatabaseConfig
    const connectionConfig = this.getConnectionConfig()

    // Create connection pool
    this.mysqlPool = mysql.createPool({
      host: connectionConfig.host,
      port: connectionConfig.port,
      user: connectionConfig.username,
      password: connectionConfig.password,
      database: connectionConfig.database,
      ...this.buildConnectionOptions(config.connectionOptions || {}),
      ...createPoolConfig(),
    })

    // Track pool for cleanup
    this.resourceTracker.track(this.mysqlPool, async (pool) => {
      await pool.end()
    })

    // Get a connection from the pool for the client
    this.client = await this.mysqlPool.getConnection()

    // Track client connection for cleanup
    this.resourceTracker.track(this.client, async (connection) => {
      if ('release' in connection && typeof connection.release === 'function') {
        connection.release()
      }
    })
  }

  /**
   * Get the database connection string
   */
  getConnectionString(): string {
    if (!this.container) {
      throw new Error('Container not started')
    }

    const config = this.config as MySQLDatabaseConfig
    const host = this.container.getHost()
    const port = this.container.getPort()

    return `mysql://${config.username}:${config.password}@${host}:${port}/${config.database}`
  }

  /**
   * Get the database connection configuration
   */
  getConnectionConfig(): DatabaseConnectionConfig {
    if (!this.container) {
      throw new Error('Container not started')
    }

    const config = this.config as MySQLDatabaseConfig

    return {
      host: this.container.getHost(),
      port: this.container.getPort(),
      database: config.database,
      username: config.username,
      password: config.password,
      options: config.connectionOptions as Record<string, unknown>,
    }
  }

  /**
   * Get the database port
   */
  getPort(): number {
    if (!this.container) {
      throw new Error('Container not started')
    }

    return this.container.getPort()
  }

  /**
   * Wait for the database to be ready for connections
   */
  async waitForReady(): Promise<void> {
    if (!this.container) {
      throw new Error('Container not started')
    }

    const maxAttempts = 30
    const delayMs = 1000

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const connection = await mysql.createConnection({
          host: this.container.getHost(),
          port: this.container.getPort(),
          user: (this.config as MySQLDatabaseConfig).username,
          password: (this.config as MySQLDatabaseConfig).password,
          database: (this.config as MySQLDatabaseConfig).database,
          connectTimeout: 5000,
        })

        await connection.execute('SELECT 1')
        await connection.end()
        return
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(`MySQL not ready after ${maxAttempts} attempts: ${error}`)
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  /**
   * Run database migrations
   */
  protected async runMigrations(config: MigrationConfig): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized')
    }

    // For now, implement basic file-based migrations
    // In a real implementation, you might want to use a migration library like Knex or custom solution
    const migrationFiles = await this.getMigrationFiles(config.migrationsPath)

    // Create migrations table if it doesn't exist
    const tableName = config.tableName || 'migrations'
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Get already executed migrations
    const [rows] = await this.client.execute(`SELECT name FROM ${tableName}`)
    const executedMigrations = new Set((rows as Array<{ name: string }>).map((row) => row.name))

    // Execute pending migrations
    for (const migrationFile of migrationFiles) {
      const migrationName = path.basename(migrationFile, '.sql')

      if (!executedMigrations.has(migrationName)) {
        const migrationSQL = await readFile(migrationFile, 'utf-8')

        // Execute migration in a transaction
        await this.client.execute('START TRANSACTION')
        try {
          await this.client.execute(migrationSQL)
          await this.client.execute(`INSERT INTO ${tableName} (name) VALUES (?)`, [migrationName])
          await this.client.execute('COMMIT')
        } catch (error) {
          await this.client.execute('ROLLBACK')
          throw new Error(`Migration ${migrationName} failed: ${error}`)
        }
      }
    }
  }

  /**
   * Run database seeding
   */
  protected async runSeeding(config: SeedConfig): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized')
    }

    if (typeof config.data === 'string') {
      // File-based seeding
      const seedSQL = await readFile(config.data, 'utf-8')
      await this.client.execute(seedSQL)
    } else {
      // Object-based seeding
      const tables = config.order || Object.keys(config.data)

      for (const tableName of tables) {
        const records = config.data[tableName]
        if (!records || records.length === 0) continue

        if (config.truncate) {
          await this.client.execute(`TRUNCATE TABLE ${tableName}`)
        }

        // Insert records
        for (const record of records) {
          if (record && typeof record === 'object') {
            const columns = Object.keys(record as Record<string, unknown>)
            const values = Object.values(record as Record<string, unknown>)
            const placeholders = columns.map(() => '?').join(', ')

            await this.client.execute(
              `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
              values,
            )
          }
        }
      }
    }
  }

  /**
   * Reset the database to a clean state
   */
  protected async resetDatabase(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized')
    }

    // Get all table names
    const [tables] = await this.client.execute(
      `
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
    `,
      [(this.config as MySQLDatabaseConfig).database],
    )

    const tableNames = (tables as Array<{ TABLE_NAME: string }>).map((row) => row.TABLE_NAME)

    // Disable foreign key checks temporarily
    await this.client.execute('SET FOREIGN_KEY_CHECKS = 0')

    try {
      // Truncate all tables
      for (const tableName of tableNames) {
        await this.client.execute(`TRUNCATE TABLE ${tableName}`)
      }
    } finally {
      // Re-enable foreign key checks
      await this.client.execute('SET FOREIGN_KEY_CHECKS = 1')
    }
  }

  /**
   * Rollback current transaction
   */
  protected async rollbackTransaction(): Promise<void> {
    if (this.currentTransaction) {
      await this.currentTransaction.rollback()
      this.currentTransaction.release()
      this.currentTransaction = undefined
    }
  }

  /**
   * Perform default health check
   */
  protected async performDefaultHealthCheck(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized')
    }

    await this.client.execute('SELECT 1')
  }

  /**
   * Start a transaction for test isolation
   */
  async beginTransaction(): Promise<void> {
    if (!this.mysqlPool) {
      throw new Error('Pool not initialized')
    }

    if (this.currentTransaction) {
      throw new Error('Transaction already active')
    }

    this.currentTransaction = await this.mysqlPool.getConnection()
    await this.currentTransaction.beginTransaction()
  }

  /**
   * Get the current transaction connection
   */
  getTransactionConnection(): PoolConnection | undefined {
    return this.currentTransaction
  }

  /**
   * Get a connection from the pool
   */
  async getConnection(): Promise<PoolConnection> {
    if (!this.mysqlPool) {
      throw new Error('Pool not initialized')
    }

    return await this.mysqlPool.getConnection()
  }

  /**
   * Execute SQL query
   */
  async query(sql: string, params?: unknown[]): Promise<unknown> {
    if (!this.client) {
      throw new Error('Client not initialized')
    }

    const connection = this.currentTransaction || this.client
    return await connection.execute(sql, params)
  }

  /**
   * Build MySQL command-line arguments
   */
  private buildMySQLArgs(config: MySQLDatabaseConfig): string[] {
    const args: string[] = []

    // SQL modes
    if (config.sqlModes && config.sqlModes.length > 0) {
      args.push(`--sql-mode=${config.sqlModes.join(',')}`)
    }

    // Character set and collation
    if (config.characterSet) {
      args.push(`--character-set-server=${config.characterSet}`)
    }

    if (config.collation) {
      args.push(`--collation-server=${config.collation}`)
    }

    // Default storage engine
    if (config.defaultStorageEngine) {
      args.push(`--default-storage-engine=${config.defaultStorageEngine}`)
    }

    // Timezone
    if (config.timezone) {
      args.push(`--default-time-zone=${config.timezone}`)
    }

    // Performance settings
    if (config.performance) {
      const perf = config.performance

      if (perf.maxConnections !== undefined) {
        args.push(`--max-connections=${perf.maxConnections}`)
      }

      if (perf.connectTimeout !== undefined) {
        args.push(`--connect-timeout=${perf.connectTimeout}`)
      }

      if (perf.waitTimeout !== undefined) {
        args.push(`--wait-timeout=${perf.waitTimeout}`)
      }

      if (perf.interactiveTimeout !== undefined) {
        args.push(`--interactive-timeout=${perf.interactiveTimeout}`)
      }

      if (perf.innodbBufferPoolSize !== undefined) {
        args.push(`--innodb-buffer-pool-size=${perf.innodbBufferPoolSize}`)
      }

      if (perf.enableSlowQueryLog) {
        args.push('--slow-query-log=1')
        if (perf.slowQueryTimeThreshold !== undefined) {
          args.push(`--long-query-time=${perf.slowQueryTimeThreshold}`)
        }
      }

      if (perf.queryCacheSize !== undefined) {
        args.push(`--query-cache-size=${perf.queryCacheSize}`)
      }

      if (perf.queryCacheType !== undefined) {
        args.push(`--query-cache-type=${perf.queryCacheType}`)
      }
    }

    // Binary logging
    if (config.enableBinLog) {
      args.push('--log-bin=mysql-bin')
    }

    // Server ID for replication
    if (config.serverId !== undefined) {
      args.push(`--server-id=${config.serverId}`)
    }

    // Additional MySQL arguments
    if (config.mysqlArgs) {
      args.push(...config.mysqlArgs)
    }

    return args
  }

  /**
   * Build connection options for mysql2
   */
  private buildConnectionOptions(options: MySQLConnectionOptions): Record<string, unknown> {
    const connectionOptions: Record<string, unknown> = {}

    if (options.characterSet) {
      connectionOptions.charset = options.characterSet
    }

    if (options.connectTimeout) {
      connectionOptions.connectTimeout = options.connectTimeout
    }

    if (options.socketTimeout) {
      connectionOptions.acquireTimeout = options.socketTimeout
    }

    if (options.ssl !== undefined) {
      connectionOptions.ssl = options.ssl
    }

    if (options.timezone) {
      connectionOptions.timezone = options.timezone
    }

    if (options.multipleStatements !== undefined) {
      connectionOptions.multipleStatements = options.multipleStatements
    }

    if (options.dateStrings !== undefined) {
      connectionOptions.dateStrings = options.dateStrings
    }

    if (options.debug !== undefined) {
      connectionOptions.debug = options.debug
    }

    if (options.trace !== undefined) {
      connectionOptions.trace = options.trace
    }

    return connectionOptions
  }

  /**
   * Get migration files from directory
   */
  private async getMigrationFiles(migrationsPath: string): Promise<string[]> {
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(migrationsPath)
    return files
      .filter((file) => file.endsWith('.sql'))
      .sort()
      .map((file) => path.join(migrationsPath, file))
  }
}

/**
 * Helper function to create a MySQL test context
 */
export async function createMySQLContext(
  config?: Partial<MySQLDatabaseConfig>,
): Promise<DatabaseTestContext<StartedMySqlContainer, Connection>> {
  const mysqlConfig = createMySQLConfig(config)
  const container = new MySQLContainer(mysqlConfig)

  await container.start()

  if (mysqlConfig.migrationConfig) {
    await container.migrate()
  }

  if (mysqlConfig.seedConfig) {
    await container.seed()
  }

  return await container.getTestContext()
}

/**
 * Simple setup function for MySQL tests (similar to Postgres API)
 */
export async function setupMySQLTest(options: {
  migrations?: string
  seed?: string | Record<string, unknown[]>
  config?: Partial<MySQLDatabaseConfig>
  isolationLevel?: IsolationLevel
}): Promise<{
  db: Connection
  pool: Pool
  connectionString: string
  cleanup: () => Promise<void>
  reset: () => Promise<void>
}> {
  const config = createMySQLConfig({
    ...options.config,
    migrationConfig: options.migrations
      ? {
          migrationsPath: options.migrations,
        }
      : undefined,
    seedConfig: options.seed
      ? {
          data: options.seed,
        }
      : undefined,
  })

  const container = new MySQLContainer(config)
  await container.start()

  if (options.migrations) {
    await container.migrate()
  }

  if (options.seed) {
    await container.seed()
  }

  const context = await container.getTestContext()

  // Get pool connection for advanced usage
  const mysqlContainer = container as MySQLContainer
  const pool = await mysqlContainer.getConnection()

  return {
    db: context.client,
    pool: pool as unknown as Pool,
    connectionString: context.connectionString,
    cleanup: context.cleanup,
    reset: () => context.reset(),
  }
}

// Export configuration presets and utilities
export { createMySQLConfig, MySQLPresets, MySQLSQLMode, MySQLCharacterSet }
export type { MySQLDatabaseConfig, MySQLConnectionOptions }
