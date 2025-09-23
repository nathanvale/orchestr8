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
 * Create an in-memory SQLite URL appropriate for the target ORM/driver.
 *
 * @param target - The target ORM or driver (defaults to 'raw')
 * @returns A properly formatted SQLite memory URL string
 *
 * @example
 * ```typescript
 * // For raw SQLite or standard libraries
 * const url = createMemoryUrl('raw')
 * // Returns: 'file::memory:?cache=shared'
 *
 * // For Prisma ORM
 * const prismaUrl = createMemoryUrl('prisma')
 * // Returns: 'file:memory?mode=memory&cache=shared'
 * // Note: Disable connection pooling for unit tests with Prisma
 *
 * // For Drizzle with better-sqlite3
 * const drizzleUrl = createMemoryUrl('drizzle-better-sqlite3')
 * // Returns: ':memory:'
 * ```
 *
 * @remarks
 * **Isolation behavior:**
 * - `raw`, `kysely`, `drizzle-libsql`: Use shared cache mode (`cache=shared`)
 *   allowing multiple connections to the same in-memory database within a process
 * - `prisma`: Uses shared cache with special Prisma-specific URL format
 *   Note: Disable connection pooling for unit tests
 * - `drizzle-better-sqlite3`: Uses `:memory:` which creates isolated databases
 *   per connection unless the same database handle is shared
 *
 * **Anti-flake notes:**
 * - Plain `:memory:` creates isolated connections except when using a single shared handle
 * - Shared cache forms (`cache=shared`) enable data sharing between connections
 * - For Prisma, ensure connection pooling is disabled in unit tests
 * - `drizzle-libsql` behavior may vary by driver implementation
 */
export function createMemoryUrl(target: SqliteTarget = 'raw'): string {
  switch (target) {
    case 'raw':
    case 'kysely':
    case 'drizzle-libsql':
      return 'file::memory:?cache=shared'
    case 'prisma':
      return 'file:memory?mode=memory&cache=shared'
    case 'drizzle-better-sqlite3':
      return ':memory:'
    default:
      return 'file::memory:?cache=shared'
  }
}
