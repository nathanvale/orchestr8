/**
 * Shared types and interfaces for database containers
 * These types are designed to be reusable across different database implementations (Postgres, MySQL, etc.)
 */

/**
 * Base database configuration that can be extended by specific database types
 */
export interface BaseDatabaseConfig {
  /** Docker image name and tag */
  image: string
  /** Database name to create */
  database: string
  /** Username for database access */
  username: string
  /** Password for database access */
  password: string
  /** Additional environment variables for the container */
  environment?: Record<string, string>
  /** Container startup timeout in milliseconds */
  startupTimeout?: number
  /** Custom initialization scripts to run on startup */
  initScripts?: string[]
  /** Whether to reuse existing container in watch mode */
  reusable?: boolean
  /** Migration configuration */
  migrationConfig?: MigrationConfig
  /** Seed configuration */
  seedConfig?: SeedConfig
  /** Lifecycle hooks */
  hooks?: ContainerHooks
  /** Custom health check function */
  healthCheck?: () => Promise<HealthCheckResult>
}

/**
 * Database connection configuration
 */
export interface DatabaseConnectionConfig {
  /** Database host */
  host: string
  /** Database port */
  port: number
  /** Database name */
  database: string
  /** Username */
  username: string
  /** Password */
  password: string
  /** Additional connection options */
  options?: Record<string, unknown>
}

/**
 * Connection pool configuration
 */
export interface PoolConfig {
  /** Minimum number of connections in the pool */
  min?: number
  /** Maximum number of connections in the pool */
  max?: number
  /** Connection idle timeout in milliseconds */
  idleTimeoutMillis?: number
  /** Connection timeout in milliseconds */
  connectionTimeoutMillis?: number
  /** Statement timeout in milliseconds */
  statementTimeout?: number
}

/**
 * Migration configuration
 */
export interface MigrationConfig {
  /** Path to migration files */
  migrationsPath: string
  /** Migration table name */
  tableName?: string
  /** Schema to run migrations in */
  schema?: string
  /** Whether to create schema if it doesn't exist */
  createSchema?: boolean
}

/**
 * Seed data configuration
 */
export interface SeedConfig {
  /** Path to seed files or seed data object */
  data: string | Record<string, unknown[]>
  /** Whether to truncate tables before seeding */
  truncate?: boolean
  /** Order of table seeding */
  order?: string[]
}

/**
 * Test context that wraps a database container instance
 */
export interface DatabaseTestContext<TContainer = unknown, TClient = unknown> {
  /** The underlying container instance */
  container: TContainer
  /** Database client connection */
  client: TClient
  /** Connection string/URI */
  connectionString: string
  /** Connection configuration */
  connectionConfig: DatabaseConnectionConfig
  /** Cleanup function to stop container and close connections */
  cleanup: () => Promise<void>
  /** Function to reset database state between tests */
  reset: () => Promise<void>
  /** Function to run migrations */
  migrate: (config?: MigrationConfig) => Promise<void>
  /** Function to seed test data */
  seed: (config?: SeedConfig) => Promise<void>
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Whether the database is healthy */
  healthy: boolean
  /** Response time in milliseconds */
  responseTime: number
  /** Error message if unhealthy */
  error?: string
}

/**
 * Container lifecycle hooks
 */
export interface ContainerHooks {
  /** Called before container starts */
  beforeStart?: () => Promise<void>
  /** Called after container starts but before ready */
  afterStart?: () => Promise<void>
  /** Called after container is ready for connections */
  onReady?: () => Promise<void>
  /** Called before container stops */
  beforeStop?: () => Promise<void>
  /** Called after container stops */
  afterStop?: () => Promise<void>
}

/**
 * Database container options
 */
export interface DatabaseContainerOptions {
  /** Base configuration */
  config: BaseDatabaseConfig
  /** Connection pool configuration */
  poolConfig?: PoolConfig
  /** Migration configuration */
  migrationConfig?: MigrationConfig
  /** Seed configuration */
  seedConfig?: SeedConfig
  /** Lifecycle hooks */
  hooks?: ContainerHooks
  /** Custom health check function */
  healthCheck?: () => Promise<HealthCheckResult>
}

/**
 * Container startup result
 */
export interface ContainerStartupResult {
  /** Whether startup was successful */
  success: boolean
  /** Startup time in milliseconds */
  startupTime: number
  /** Error if startup failed */
  error?: Error
  /** Container instance if successful */
  container?: unknown
}

/**
 * Resource cleanup tracking
 */
export interface ResourceTracker {
  /** Track a resource for cleanup */
  track<T>(resource: T, cleanup: (resource: T) => Promise<void>): void
  /** Cleanup all tracked resources */
  cleanup(): Promise<void>
  /** Get count of tracked resources */
  count(): number
}

/**
 * Database-specific extension interface
 * Allows database implementations to define their own specific features
 */
export interface DatabaseExtensions {
  /** Database-specific extensions (e.g., PostgreSQL extensions like pgvector) */
  extensions?: string[]
  /** Custom configuration options */
  customConfig?: Record<string, unknown>
  /** Database-specific initialization */
  initialize?: () => Promise<void>
}

/**
 * Test isolation levels
 */
export enum IsolationLevel {
  /** Each test gets a fresh database */
  DATABASE = 'database',
  /** Each test gets a fresh transaction (rolled back after test) */
  TRANSACTION = 'transaction',
  /** Tests share the same database (fastest but least isolated) */
  SHARED = 'shared',
}

/**
 * Test configuration options
 */
export interface TestConfiguration {
  /** Isolation level for tests */
  isolation: IsolationLevel
  /** Whether to run migrations before each test */
  migrateBeforeEach?: boolean
  /** Whether to seed data before each test */
  seedBeforeEach?: boolean
  /** Maximum test execution time */
  timeout?: number
  /** Parallel execution configuration */
  parallel?: {
    /** Whether to allow parallel execution */
    enabled: boolean
    /** Maximum number of parallel containers */
    maxContainers?: number
  }
}
