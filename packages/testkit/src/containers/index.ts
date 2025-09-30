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
export {
  PostgresContainer,
  createPostgresConfig,
  createPostgresContext,
  setupPostgresTest,
} from './postgres.js'
export type { PostgresDatabaseConfig } from './postgres.js'

// Export Docker utilities for integration testing
export {
  isDockerAvailable,
  skipIfNoDocker,
  skipIfNotIntegration,
  isIntegrationTestMode,
  registerCleanupHandler,
} from './docker-utils.js'
