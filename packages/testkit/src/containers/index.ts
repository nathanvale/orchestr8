/**
 * Test container utilities using testcontainers library
 */

// Export base database types and utilities
export type {
  BaseDatabaseConfig,
  ContainerHooks,
  ContainerStartupResult,
  DatabaseConnectionConfig,
  DatabaseContainerOptions,
  DatabaseExtensions,
  DatabaseTestContext,
  HealthCheckResult,
  IsolationLevel,
  MigrationConfig,
  PoolConfig,
  ResourceTracker,
  SeedConfig,
  TestConfiguration,
} from './types.js'

// Export base database container
export { BaseDatabaseContainer, createDatabaseConfig, createPoolConfig } from './base-database.js'

// Export MySQL container and utilities
export {
  MySQLCharacterSet,
  MySQLContainer,
  MySQLPresets,
  MySQLSQLMode,
  createMySQLConfig,
  createMySQLContext,
  setupMySQLTest,
} from './mysql.js'

// Export MySQL configuration types
export type {
  MySQLConnectionOptions,
  MySQLDatabaseConfig,
  MySQLPerformanceConfig,
  MySQLReplicationConfig,
} from './mysql-config.js'

export { MySQLCollation, MySQLStorageEngine } from './mysql-config.js'

// Export Postgres container and utilities
export { PostgresContainer, createPostgresContext, setupPostgresTest } from './postgres.js'
export type { PostgresDatabaseConfig } from './postgres.js'

/**
 * Legacy container configuration for backwards compatibility
 * @deprecated Use the specific database container implementations instead
 */
export interface ContainerConfig {
  /** Container image name */
  image: string
  /** Container ports to expose */
  ports: number[]
  /** Environment variables */
  env: Record<string, string>
  /** Container name */
  name?: string
}

/**
 * Create a test container with the given configuration
 * @deprecated Use createMySQLContext or specific database helpers instead
 */
export function createTestContainer(config: ContainerConfig) {
  return {
    config,
    start: async () => {
      // Start container logic
    },
    stop: async () => {
      // Stop container logic
    },
    getConnectionUrl: () => {
      // Get connection URL logic
      return `http://localhost:${config.ports[0]}`
    },
  }
}

/**
 * Common container configurations
 * @deprecated Use MySQLPresets or specific database presets instead
 */
export const containerConfigs = {
  mysql: {
    image: 'mysql:8.0',
    ports: [3306],
    env: {
      MYSQL_DATABASE: 'test',
      MYSQL_USER: 'test',
      MYSQL_PASSWORD: 'test',
      MYSQL_ROOT_PASSWORD: 'root',
    },
  },
  redis: {
    image: 'redis:7',
    ports: [6379],
    env: {},
  },
} as const
