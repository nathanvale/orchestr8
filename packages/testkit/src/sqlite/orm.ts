/**
 * ORM-specific SQLite URL adapters
 *
 * This module provides URL generation for different ORMs (Prisma, Drizzle)
 * that have specific connection string requirements. Each function returns
 * only the connection string - no client management is included.
 */

import { createMemoryUrl } from './memory.js'

/**
 * Supported database types
 */
export type DatabaseKind = 'memory' | 'file'

/**
 * Supported Drizzle drivers
 */
export type DrizzleDriver = 'better-sqlite3' | 'libsql'

/**
 * Generate Prisma-compatible SQLite URL
 *
 * @param kind - Database type ('memory' or 'file')
 * @param path - File path (optional, defaults to './db.sqlite' for file kind)
 * @returns Prisma-compatible connection string
 *
 * @example
 * ```typescript
 * // Memory database
 * const memUrl = prismaUrl('memory')
 * // Returns: 'file:memory?mode=memory&cache=shared'
 *
 * // File database with default path
 * const fileUrl = prismaUrl('file')
 * // Returns: 'file:./db.sqlite'
 *
 * // File database with custom path
 * const customUrl = prismaUrl('file', '/custom/path/db.sqlite')
 * // Returns: 'file:/custom/path/db.sqlite'
 * ```
 */
export function prismaUrl(kind: DatabaseKind, path?: string): string {
  if (kind === 'memory') {
    return createMemoryUrl('prisma')
  }

  // Use default path if none provided
  const dbPath = path ?? './db.sqlite'
  return `file:${dbPath}`
}

/**
 * Generate Drizzle-compatible SQLite URL
 *
 * @param kind - Database type ('memory' or 'file')
 * @param path - File path (optional, defaults to './db.sqlite' for file kind)
 * @param driver - Drizzle driver (defaults to 'better-sqlite3')
 * @returns Drizzle-compatible connection string
 *
 * @example
 * ```typescript
 * // Memory database with better-sqlite3 (default)
 * const memUrl = drizzleUrl('memory')
 * // Returns: ':memory:'
 *
 * // Memory database with libsql
 * const libsqlMemUrl = drizzleUrl('memory', undefined, 'libsql')
 * // Returns: 'file::memory:?cache=shared'
 *
 * // File database with better-sqlite3
 * const fileUrl = drizzleUrl('file', './test.db', 'better-sqlite3')
 * // Returns: './test.db'
 *
 * // File database with libsql
 * const libsqlFileUrl = drizzleUrl('file', './test.db', 'libsql')
 * // Returns: 'file:./test.db'
 * ```
 */
export function drizzleUrl(
  kind: DatabaseKind,
  path?: string,
  driver: DrizzleDriver = 'better-sqlite3',
): string {
  if (kind === 'memory') {
    return driver === 'better-sqlite3'
      ? createMemoryUrl('drizzle-better-sqlite3')
      : createMemoryUrl('drizzle-libsql')
  }

  // Use default path if none provided
  const dbPath = path ?? './db.sqlite'

  // better-sqlite3 uses raw file paths, libsql uses file: URLs
  return driver === 'better-sqlite3' ? dbPath : `file:${dbPath}`
}
