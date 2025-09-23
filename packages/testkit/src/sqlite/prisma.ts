/**
 * Prisma-specific SQLite test helpers
 *
 * Provides utilities for configuring Prisma with SQLite for testing,
 * including connection pooling management and datasource configuration.
 */

import { createMemoryUrl } from './memory.js'
import { createFileDatabase, type FileDatabase } from './file.js'

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
 * @param options - Configuration options
 * @returns Prisma test configuration with pooling disabled
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client'
 * import { createPrismaMemoryConfig } from '@template/testkit/sqlite'
 *
 * const config = createPrismaMemoryConfig()
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
  } = {},
): PrismaTestConfig {
  const { connectionLimit = 1, params = {} } = options

  // Start with base Prisma memory URL
  let url = createMemoryUrl('prisma')

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

  return {
    url,
    urlParams: allParams,
    env: {
      DATABASE_URL: url,
    },
  }
}

/**
 * Create a Prisma configuration for file-based SQLite testing.
 *
 * @param name - Optional database file name
 * @returns Prisma test configuration with file database
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client'
 * import { createPrismaFileConfig } from '@template/testkit/sqlite'
 *
 * const config = await createPrismaFileConfig('test.db')
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
): Promise<PrismaTestConfig & { cleanup: () => Promise<void>; db: FileDatabase }> {
  const { connectionLimit = 1, params = {} } = options

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

  return {
    url,
    urlParams: allParams,
    env: {
      DATABASE_URL: url,
    },
    db,
    cleanup: db.cleanup,
  }
}

// Global guard against concurrent setPrismaTestEnv usage
let _prismaEnvActive = false

/**
 * Helper to set Prisma environment variables for testing.
 *
 * @param config - Prisma test configuration
 * @returns Function to restore original environment
 *
 * @example
 * ```typescript
 * const config = createPrismaMemoryConfig()
 * const restore = setPrismaTestEnv(config)
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
export function setPrismaTestEnv(config: PrismaTestConfig): () => void {
  // Guard against concurrent usage
  if (_prismaEnvActive) {
    throw new Error(
      'setPrismaTestEnv is already active. This function is not safe for concurrent use. ' +
        'Consider using per-process isolation or datasource URL configuration instead of env vars.',
    )
  }

  _prismaEnvActive = true
  const originalEnv: Record<string, string | undefined> = {}

  // Save original values and set new ones
  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      originalEnv[key] = process.env[key]
      process.env[key] = value
    }
  }

  // Return restore function
  return () => {
    for (const [key, originalValue] of Object.entries(originalEnv)) {
      if (originalValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalValue
      }
    }
    _prismaEnvActive = false
  }
}

/**
 * Create a test helper that manages Prisma lifecycle for tests.
 *
 * @example
 * ```typescript
 * import { usePrismaTestDatabase } from '@template/testkit/sqlite'
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
