/**
 * Postgres container implementation using Testcontainers (initial scaffold)
 */

import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { readFile } from 'node:fs/promises'
import * as path from 'node:path'
import type { ClientConfig } from 'pg'
import { Client } from 'pg'
import { BaseDatabaseContainer } from './base-database.js'
import type {
  DatabaseConnectionConfig,
  DatabaseTestContext,
  MigrationConfig,
  SeedConfig,
} from './types.js'

export interface PostgresDatabaseConfig {
  image: string
  database: string
  username: string
  password: string
  environment?: Record<string, string>
  initScripts?: Array<string>
  migrationConfig?: MigrationConfig
  seedConfig?: SeedConfig
}

export function createPostgresConfig(
  overrides: Partial<PostgresDatabaseConfig> = {},
): PostgresDatabaseConfig {
  return {
    image: overrides.image ?? 'postgres:15',
    database: overrides.database ?? 'test_db',
    username: overrides.username ?? 'test_user',
    password: overrides.password ?? 'test_pass',
    environment: overrides.environment,
    initScripts: overrides.initScripts,
    migrationConfig: overrides.migrationConfig,
    seedConfig: overrides.seedConfig,
  }
}

export class PostgresContainer extends BaseDatabaseContainer<StartedPostgreSqlContainer, Client> {
  constructor(config: PostgresDatabaseConfig) {
    super(config)
  }

  protected async createContainer(): Promise<StartedPostgreSqlContainer> {
    const cfg = this.config as PostgresDatabaseConfig
    let c = new PostgreSqlContainer(cfg.image)
      .withDatabase(cfg.database)
      .withUsername(cfg.username)
      .withPassword(cfg.password)

    if (cfg.environment) {
      for (const [k, v] of Object.entries(cfg.environment)) {
        c = c.withEnvironment({ [k]: v })
      }
    }

    if (cfg.initScripts && cfg.initScripts.length > 0) {
      for (const script of cfg.initScripts) {
        const content = await readFile(script, 'utf-8')
        c = c.withCopyContentToContainer([
          { content, target: `/docker-entrypoint-initdb.d/${path.basename(script)}` },
        ])
      }
    }

    const started = await c.start()

    this.resourceTracker.track(started, async (cont) => {
      await cont.stop()
    })

    return started
  }

  protected async createClient(): Promise<void> {
    if (!this.container) throw new Error('Container not started')
    const cfg = this.getConnectionConfig()
    const client = new Client({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.username,
      password: cfg.password,
    } satisfies ClientConfig)

    await client.connect()

    this.client = client
    this.resourceTracker.track(client, async (cl) => {
      await cl.end()
    })
  }

  getConnectionString(): string {
    if (!this.container) throw new Error('Container not started')
    // Note: getConnectionUri is the correct method for @testcontainers/postgresql
    return this.container.getConnectionUri()
  }

  getConnectionConfig(): DatabaseConnectionConfig {
    if (!this.container) throw new Error('Container not started')
    const cfg = this.config as PostgresDatabaseConfig
    return {
      host: this.container.getHost(),
      port: this.container.getPort(),
      database: cfg.database,
      username: cfg.username,
      password: cfg.password,
      options: {},
    }
  }

  getPort(): number {
    if (!this.container) throw new Error('Container not started')
    return this.container.getPort()
  }

  async waitForReady(): Promise<void> {
    if (!this.container) throw new Error('Container not started')
    const maxAttempts = 30
    const delayMs = 1000
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const client = new Client({
          host: this.container.getHost(),
          port: this.container.getPort(),
          database: (this.config as PostgresDatabaseConfig).database,
          user: (this.config as PostgresDatabaseConfig).username,
          password: (this.config as PostgresDatabaseConfig).password,
          connectionTimeoutMillis: 5000,
        })
        await client.connect()
        await client.query('SELECT 1')
        await client.end()
        return
      } catch (err) {
        if (attempt === maxAttempts) {
          throw new Error(`Postgres not ready after ${maxAttempts} attempts: ${err}`)
        }
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }

  protected async runMigrations(config: MigrationConfig): Promise<void> {
    if (!this.client) throw new Error('Client not initialized')
    // Minimal file-based SQL migrations (scaffold)
    const files = await this.getMigrationFiles(config.migrationsPath)
    const tableName = config.tableName || 'migrations'
    await this.client.query(
      `CREATE TABLE IF NOT EXISTS ${tableName} (name text primary key, executed_at timestamptz default now())`,
    )
    const res = await this.client.query<{ name: string }>(`SELECT name FROM ${tableName}`)
    const executed = new Set(res.rows.map((r) => r.name))
    for (const file of files) {
      const name = path.basename(file, '.sql')
      if (executed.has(name)) continue
      const sql = await readFile(file, 'utf-8')
      await this.client.query('BEGIN')
      try {
        await this.client.query(sql)
        await this.client.query(`INSERT INTO ${tableName}(name) VALUES($1)`, [name])
        await this.client.query('COMMIT')
      } catch (e) {
        await this.client.query('ROLLBACK')
        throw new Error(`Migration ${name} failed: ${e}`)
      }
    }
  }

  protected async runSeeding(config: SeedConfig): Promise<void> {
    if (!this.client) throw new Error('Client not initialized')
    if (typeof config.data === 'string') {
      const sql = await readFile(config.data, 'utf-8')
      await this.client.query(sql)
    } else {
      for (const [table, records] of Object.entries(config.data)) {
        if (!records || records.length === 0) continue
        if (config.truncate) {
          await this.client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`)
        }
        for (const record of records) {
          if (record && typeof record === 'object') {
            const cols = Object.keys(record as Record<string, unknown>)
            const vals = Object.values(record as Record<string, unknown>)
            const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ')
            await this.client.query(
              `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
              vals as unknown[],
            )
          }
        }
      }
    }
  }

  protected async resetDatabase(): Promise<void> {
    if (!this.client) throw new Error('Client not initialized')
    // Drop all tables in public schema (scaffold behavior)
    const tablesRes = await this.client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    )
    const tables = tablesRes.rows.map((r) => r.tablename)
    await this.client.query('BEGIN')
    try {
      for (const t of tables) {
        await this.client.query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`)
      }
      await this.client.query('COMMIT')
    } catch (e) {
      await this.client.query('ROLLBACK')
      throw e
    }
  }

  protected async performDefaultHealthCheck(): Promise<void> {
    if (!this.client) throw new Error('Client not initialized')
    await this.client.query('SELECT 1')
  }

  protected async rollbackTransaction(): Promise<void> {
    if (!this.client) throw new Error('Client not initialized')
    // ROLLBACK outside a transaction is a no-op with a warning; acceptable for test resets
    await this.client.query('ROLLBACK')
  }

  private async getMigrationFiles(migrationsPath: string): Promise<string[]> {
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(migrationsPath)
    return files
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => path.join(migrationsPath, f))
  }
}

export async function createPostgresContext(
  config?: Partial<PostgresDatabaseConfig>,
): Promise<DatabaseTestContext<StartedPostgreSqlContainer, Client>> {
  const pgConfig = createPostgresConfig(config)
  const container = new PostgresContainer(pgConfig)
  await container.start()
  if (pgConfig.migrationConfig) await container.migrate()
  if (pgConfig.seedConfig) await container.seed()
  return await container.getTestContext()
}

export async function setupPostgresTest(
  options: {
    migrations?: string
    seed?: string | Record<string, unknown[]>
    config?: Partial<PostgresDatabaseConfig>
  } = {},
): Promise<{
  db: Client
  connectionString: string
  cleanup: () => Promise<void>
  reset: () => Promise<void>
  host: string
  port: number
  database: string
  username: string
}> {
  const config = createPostgresConfig({
    ...options.config,
    migrationConfig: options.migrations ? { migrationsPath: options.migrations } : undefined,
    seedConfig: options.seed ? { data: options.seed } : undefined,
  })

  const container = new PostgresContainer(config)
  await container.start()
  if (options.migrations) await container.migrate()
  if (options.seed) await container.seed()
  const context = await container.getTestContext()
  const connectionConfig = container.getConnectionConfig()

  // Import and use registerCleanupHandler for signal handling
  const { registerCleanupHandler } = await import('./docker-utils.js')
  const unregister = registerCleanupHandler(async () => {
    await context.cleanup()
  })

  return {
    db: context.client,
    connectionString: context.connectionString,
    cleanup: async () => {
      unregister()
      await context.cleanup()
    },
    reset: () => context.reset(),
    host: connectionConfig.host,
    port: connectionConfig.port,
    database: connectionConfig.database,
    username: connectionConfig.username,
  }
}
