/**
 * Prisma-specific SQLite test helpers
 *
 * Provides utilities for configuring Prisma with SQLite for testing,
 * including connection pooling management and datasource configuration.
 */

import { createMemoryUrl, type MemoryDatabaseOptions } from './memory.js'
import { createFileDatabase, type FileDatabase } from './file.js'
import { type Logger, consoleLogger } from './migrate.js'

/**
 * Prisma datasource configuration for testing
 */
export interface PrismaTestConfig {
  /**
   * The database URL to use
   */
  url: string

  /**
   * Additional URL parameters for Prisma-specific configuration
   */
  urlParams?: Record<string, string | number>

  /**
   * Environment variables to set for Prisma
   */
  env?: Record<string, string>
}

/**
 * Create a Prisma configuration for in-memory SQLite testing.
 *
 * @param options - Configuration options including memory database options
 * @param logger - Optional logger for debugging database operations
 * @returns Prisma test configuration with pooling disabled
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client'
 * import { createPrismaMemoryConfig, consoleLogger } from '@orchestr8/testkit/sqlite'
 *
 * const config = createPrismaMemoryConfig({
 *   name: 'test-db',
 *   connectionLimit: 1
 * }, consoleLogger)
 *
 * const prisma = new PrismaClient({
 *   datasources: {
 *     db: { url: config.url }
 *   }
 * })
 * ```
 *
 * @remarks
 * This helper automatically:
 * - Uses the correct Prisma memory URL format
 * - Disables connection pooling for unit tests
 * - Sets appropriate query parameters
 * - Provides detailed logging for debugging
 * - Supports advanced memory database isolation options
 */
export function createPrismaMemoryConfig(
  options: {
    /**
     * Maximum number of connections (default: 1 for tests)
     */
    connectionLimit?: number
    /**
     * Additional URL parameters
     */
    params?: Record<string, string | number>
  } & Partial<MemoryDatabaseOptions> = {},
  logger: Logger = consoleLogger,
): PrismaTestConfig {
  const { connectionLimit = 1, params = {}, ...memoryOptions } = options

  logger.info(
    `Creating Prisma memory configuration: connectionLimit=${connectionLimit}, additionalParams=${Object.keys(params).length}`,
  )

  // Start with base Prisma memory URL with enhanced options
  let url = createMemoryUrl('prisma', {
    identifier: memoryOptions.identifier,
    ...memoryOptions,
  })

  // Add connection limit and other params
  const allParams = {
    connection_limit: connectionLimit,
    ...params,
  }

  // Append parameters to URL
  const paramString = Object.entries(allParams)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')

  if (paramString) {
    url += (url.includes('?') ? '&' : '?') + paramString
  }

  const config = {
    url,
    urlParams: allParams,
    env: {
      DATABASE_URL: url,
    },
  }

  logger.info(
    `Created Prisma memory configuration: url=${config.url}, paramCount=${Object.keys(allParams).length}`,
  )

  return config
}

/**
 * Create a Prisma configuration for file-based SQLite testing.
 *
 * @param name - Optional database file name
 * @param options - Configuration options including connection settings
 * @param logger - Optional logger for debugging database operations
 * @returns Prisma test configuration with file database
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client'
 * import { createPrismaFileConfig, consoleLogger } from '@orchestr8/testkit/sqlite'
 *
 * const config = await createPrismaFileConfig('test.db', {
 *   connectionLimit: 1
 * }, consoleLogger)
 *
 * const prisma = new PrismaClient({
 *   datasources: {
 *     db: { url: config.url }
 *   }
 * })
 *
 * // Cleanup when done
 * await config.cleanup()
 * ```
 */
export async function createPrismaFileConfig(
  name?: string,
  options: {
    connectionLimit?: number
    params?: Record<string, string | number>
  } = {},
  logger: Logger = consoleLogger,
): Promise<PrismaTestConfig & { cleanup: () => Promise<void>; db: FileDatabase }> {
  const { connectionLimit = 1, params = {} } = options

  logger.info(
    `Creating Prisma file configuration: name=${name || 'auto-generated'}, connectionLimit=${connectionLimit}`,
  )

  const db = await createFileDatabase(name)

  // Build URL with parameters
  const allParams = {
    connection_limit: connectionLimit,
    ...params,
  }

  const paramString = Object.entries(allParams)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')

  const url = paramString ? `${db.url}?${paramString}` : db.url

  const config = {
    url,
    urlParams: allParams,
    env: {
      DATABASE_URL: url,
    },
    db,
    cleanup: async () => {
      logger.info(`Cleaning up Prisma file database: ${db.path}`)
      await db.cleanup()
    },
  }

  logger.info(`Created Prisma file configuration: path=${db.path}, url=${config.url}`)

  return config
}

// Global guard against concurrent setPrismaTestEnv usage
let _prismaEnvActive = false

/**
 * Helper to set Prisma environment variables for testing.
 *
 * @param config - Prisma test configuration
 * @param logger - Optional logger for debugging environment operations
 * @returns Function to restore original environment
 *
 * @example
 * ```typescript
 * import { createPrismaMemoryConfig, setPrismaTestEnv, consoleLogger } from '@orchestr8/testkit/sqlite'
 *
 * const config = createPrismaMemoryConfig()
 * const restore = setPrismaTestEnv(config, consoleLogger)
 *
 * // Run tests with Prisma env vars set
 *
 * // Restore original environment
 * restore()
 * ```
 *
 * @remarks
 * ⚠️ **Warning**: This function mutates global process.env and is not safe for
 * concurrent use. In parallel test environments (Vitest workers), this can
 * cause environment variable leaks between tests.
 *
 * **Recommendations**:
 * - Use per-process isolation for parallel Prisma tests
 * - Or avoid parallel execution when using environment variables
 * - Consider using datasource URL configuration instead of env vars
 *
 * @throws {Error} When called while another setPrismaTestEnv is active
 */
export function setPrismaTestEnv(
  config: PrismaTestConfig,
  logger: Logger = consoleLogger,
): () => void {
  // Guard against concurrent usage
  if (_prismaEnvActive) {
    const error = new Error(
      'setPrismaTestEnv is already active. This function is not safe for concurrent use. ' +
        'Consider using per-process isolation or datasource URL configuration instead of env vars.',
    )
    logger.error(`Concurrent usage detected: ${error.message}`)
    throw error
  }

  logger.info('Setting Prisma test environment variables')
  _prismaEnvActive = true
  const originalEnv: Record<string, string | undefined> = {}

  // Save original values and set new ones
  if (config.env) {
    const envKeys = Object.keys(config.env)
    logger.info(`Setting ${envKeys.length} environment variables: ${envKeys.join(', ')}`)

    for (const [key, value] of Object.entries(config.env)) {
      originalEnv[key] = process.env[key]
      process.env[key] = value
    }
  }

  // Return restore function
  return () => {
    logger.info('Restoring original Prisma environment variables')

    for (const [key, originalValue] of Object.entries(originalEnv)) {
      if (originalValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalValue
      }
    }
    _prismaEnvActive = false
    logger.info('Prisma environment variables restored successfully')
  }
}

/**
 * Create a test helper that manages Prisma lifecycle for tests.
 *
 * @example
 * ```typescript
 * import { usePrismaTestDatabase } from '@orchestr8/testkit/sqlite'
 *
 * const getPrisma = usePrismaTestDatabase()
 *
 * test('user creation', async () => {
 *   const prisma = getPrisma()
 *   const user = await prisma.user.create({
 *     data: { name: 'Test User' }
 *   })
 *   expect(user.name).toBe('Test User')
 * })
 * ```
 *
 * @remarks
 * This is a placeholder for Phase 2 when we have driver dependencies.
 * It will handle:
 * - PrismaClient creation and cleanup
 * - Migration running
 * - Transaction isolation
 * - Connection management
 */
export function usePrismaTestDatabase() {
  // This will be implemented in Phase 2 with actual Prisma dependency
  throw new Error('usePrismaTestDatabase will be available in Phase 2 with driver implementation')
}

/**
 * Enhanced configuration options for Prisma test environment setup
 */
export interface PrismaTestEnvironmentOptions {
  /** Base configuration for the Prisma database */
  config?: Partial<PrismaTestConfig>
  /** Logger for debugging operations */
  logger?: Logger
  /** Enable automatic cleanup on process exit */
  autoCleanup?: boolean
  /** Memory database options for enhanced isolation */
  memoryOptions?: MemoryDatabaseOptions
}

/**
 * Create an isolated Prisma test environment with automatic lifecycle management.
 *
 * @param options - Configuration options for the test environment
 * @returns Object with configuration, environment setup, and cleanup functions
 *
 * @example
 * ```typescript
 * import { createPrismaTestEnvironment, consoleLogger } from '@orchestr8/testkit/sqlite'
 *
 * const testEnv = createPrismaTestEnvironment({
 *   logger: consoleLogger,
 *   autoCleanup: true,
 *   memoryOptions: {
 *     identifier: 'test-suite',
 *     isolation: 'private'
 *   }
 * })
 *
 * // Set up environment for tests
 * const restore = testEnv.setup()
 *
 * // Run tests...
 *
 * // Clean up
 * restore()
 * ```
 */
export function createPrismaTestEnvironment(options: PrismaTestEnvironmentOptions = {}): {
  config: PrismaTestConfig
  setup: () => () => void
  cleanup: () => void
} {
  const {
    config: userConfig = {},
    logger = consoleLogger,
    autoCleanup = false,
    memoryOptions = {},
  } = options

  logger.info('Creating Prisma test environment with enhanced configuration')

  // Create enhanced memory configuration
  const config = createPrismaMemoryConfig(
    {
      connectionLimit: 1,
      ...memoryOptions,
      ...userConfig,
    },
    logger,
  )

  // Setup auto-cleanup if requested
  let cleanupHandler: (() => void) | null = null
  if (autoCleanup) {
    cleanupHandler = () => {
      logger.info('Auto-cleanup triggered for Prisma test environment')
      // Additional cleanup logic can be added here in Phase 2
    }
    process.on('exit', cleanupHandler)
    process.on('SIGINT', cleanupHandler)
    process.on('SIGTERM', cleanupHandler)
  }

  return {
    config,
    setup: () => {
      logger.info('Setting up Prisma test environment')
      return setPrismaTestEnv(config, logger)
    },
    cleanup: () => {
      logger.info('Cleaning up Prisma test environment')
      if (cleanupHandler) {
        process.removeListener('exit', cleanupHandler)
        process.removeListener('SIGINT', cleanupHandler)
        process.removeListener('SIGTERM', cleanupHandler)
      }
    },
  }
}

/**
 * Validate Prisma configuration for common issues.
 *
 * @param config - Prisma test configuration to validate
 * @param logger - Optional logger for validation messages
 * @returns Validation result with any detected issues
 *
 * @example
 * ```typescript
 * import { createPrismaMemoryConfig, validatePrismaConfig } from '@orchestr8/testkit/sqlite'
 *
 * const config = createPrismaMemoryConfig()
 * const validation = validatePrismaConfig(config)
 *
 * if (!validation.isValid) {
 *   console.error('Configuration issues:', validation.issues)
 * }
 * ```
 */
export function validatePrismaConfig(
  config: PrismaTestConfig,
  logger: Logger = consoleLogger,
): {
  isValid: boolean
  issues: string[]
  warnings: string[]
} {
  const issues: string[] = []
  const warnings: string[] = []

  logger.info('Validating Prisma test configuration')

  // Check required properties
  if (!config.url) {
    issues.push('Missing required property: url')
  }

  // Validate URL format
  if (config.url && !config.url.startsWith('file:')) {
    issues.push('URL must be a file: protocol for SQLite testing')
  }

  // Check for memory database indicators
  if (config.url && !config.url.includes('memory')) {
    warnings.push(
      'URL does not appear to be an in-memory database - consider using memory databases for faster tests',
    )
  }

  // Validate connection limit for tests
  if (config.urlParams?.connection_limit && Number(config.urlParams.connection_limit) > 1) {
    warnings.push('Connection limit > 1 may cause issues in parallel test environments')
  }

  // Check environment variables
  if (config.env?.DATABASE_URL && config.env.DATABASE_URL !== config.url) {
    issues.push('Environment DATABASE_URL does not match configuration URL')
  }

  const isValid = issues.length === 0

  if (issues.length > 0) {
    logger.error(`Prisma configuration validation failed: ${issues.length} issues found`)
  } else if (warnings.length > 0) {
    logger.warn(`Prisma configuration validation passed with ${warnings.length} warnings`)
  } else {
    logger.info('Prisma configuration validation passed successfully')
  }

  return {
    isValid,
    issues,
    warnings,
  }
}
