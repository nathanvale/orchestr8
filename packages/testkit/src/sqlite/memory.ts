/**
 * SQLite memory URL helpers (driver-agnostic)
 *
 * This module provides URL generation for in-memory SQLite databases
 * across different ORMs and drivers. No driver dependencies required.
 */

/**
 * Supported SQLite target ORMs and drivers
 */
export type SqliteTarget = 'raw' | 'prisma' | 'drizzle-libsql' | 'kysely' | 'drizzle-better-sqlite3'

/**
 * Memory database isolation modes
 */
export type IsolationMode = 'shared' | 'private'

/**
 * Options for enhanced memory database configuration
 */
export interface MemoryDatabaseOptions {
  /** Database identifier for named memory databases (auto-generated if not provided and autoGenerate is true) */
  identifier?: string
  /** Cache isolation mode (default: 'shared') */
  isolation?: IsolationMode
  /** Auto-generate unique identifier (default: false) */
  autoGenerate?: boolean
  /** Additional URL parameters */
  params?: Record<string, string | number>
}

/**
 * Create an in-memory SQLite URL appropriate for the target ORM/driver.
 *
 * @param target - The target ORM or driver (defaults to 'raw')
 * @param options - Enhanced configuration options for memory database behavior
 * @returns A properly formatted SQLite memory URL string
 *
 * @example
 * ```typescript
 * // Basic usage - creates shared cache memory database
 * const url = createMemoryUrl('raw')
 * // Returns: 'file::memory:?cache=shared'
 *
 * // Named database for shared access across connections
 * const namedUrl = createMemoryUrl('raw', { identifier: 'test-db' })
 * // Returns: 'file:test-db:?mode=memory&cache=shared'
 *
 * // Isolated database (private cache)
 * const isolatedUrl = createMemoryUrl('raw', {
 *   identifier: 'isolated-test',
 *   isolation: 'private'
 * })
 * // Returns: 'file:isolated-test:?mode=memory&cache=private'
 *
 * // Auto-generated unique database for test isolation
 * const uniqueUrl = createMemoryUrl('raw', { autoGenerate: true })
 * // Returns: 'file:mem-abc123:?mode=memory&cache=shared'
 *
 * // For Prisma with enhanced isolation
 * const prismaUrl = createMemoryUrl('prisma', {
 *   identifier: 'test-suite',
 *   params: { connection_limit: 1 }
 * })
 * // Returns: 'file:test-suite?mode=memory&cache=shared&connection_limit=1'
 * ```
 *
 * @remarks
 * **Isolation behavior:**
 * - `shared` (default): Multiple connections share the same database instance
 * - `private`: Each connection gets its own isolated database instance
 * - Named identifiers ensure database separation between test suites
 * - Auto-generated identifiers prevent accidental database sharing
 *
 * **Driver-specific notes:**
 * - `raw`, `kysely`, `drizzle-libsql`: Support full URL parameter customization
 * - `prisma`: Uses Prisma-specific URL format, supports connection_limit parameter
 * - `drizzle-better-sqlite3`: Simple `:memory:` format, options have no effect
 *
 * **Test isolation best practices:**
 * - Use `autoGenerate: true` for completely isolated test databases
 * - Use named identifiers for shared test fixtures across test files
 * - Use `isolation: 'private'` when complete isolation is required
 */
export function createMemoryUrl(
  target: SqliteTarget = 'raw',
  options: MemoryDatabaseOptions = {},
): string {
  const { identifier, isolation = 'shared', autoGenerate = false, params = {} } = options

  let dbIdentifier = identifier

  // Auto-generate unique identifier if requested
  if (!dbIdentifier && autoGenerate) {
    dbIdentifier = `mem-${Math.random().toString(36).substring(2, 8)}`
  }

  // Handle drizzle-better-sqlite3 special case (doesn't support URL parameters)
  if (target === 'drizzle-better-sqlite3') {
    return ':memory:'
  }

  // Build base URL based on target and identifier
  let baseUrl: string
  let urlParams: Record<string, string | number> = { ...params }

  if (dbIdentifier) {
    // Named memory database
    if (target === 'prisma') {
      baseUrl = `file:${dbIdentifier}`
      urlParams = { mode: 'memory', cache: isolation, ...params }
    } else {
      baseUrl = `file:${dbIdentifier}:`
      urlParams = { mode: 'memory', cache: isolation, ...params }
    }
  } else {
    // Anonymous memory database
    if (target === 'prisma') {
      baseUrl = 'file:memory'
      urlParams = { mode: 'memory', cache: isolation, ...params }
    } else {
      baseUrl = 'file::memory:'
      urlParams = { cache: isolation, ...params }
    }
  }

  // Build query string
  const queryParams = Object.entries(urlParams)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')

  return queryParams ? `${baseUrl}?${queryParams}` : baseUrl
}

/**
 * Create a simple memory database URL with basic identifier support (legacy API).
 *
 * @param identifier - Optional identifier for the database
 * @returns SQLite memory database URL
 * @deprecated Use createMemoryUrl with options parameter for enhanced features
 *
 * @example
 * ```typescript
 * const url1 = createSimpleMemoryUrl()
 * // Returns: 'file::memory:?cache=shared'
 *
 * const url2 = createSimpleMemoryUrl('test-db')
 * // Returns: 'file:test-db:?mode=memory&cache=shared'
 * ```
 */
export function createSimpleMemoryUrl(identifier?: string): string {
  return createMemoryUrl('raw', { identifier })
}
