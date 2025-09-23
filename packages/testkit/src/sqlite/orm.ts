/**
 * ORM URL helpers (string-only)
 */

import { createMemoryUrl, type SqliteTarget } from './memory.js'

export function prismaUrl(kind: 'memory' | 'file', path?: string): string {
  if (kind === 'memory') return createMemoryUrl('prisma')
  if (!path) throw new Error('prismaUrl(file): path is required')
  return `file:${path}`
}

export function drizzleUrl(kind: 'memory' | 'file', path?: string, driver?: SqliteTarget): string {
  if (kind === 'memory') {
    return driver === 'drizzle-better-sqlite3'
      ? createMemoryUrl('drizzle-better-sqlite3')
      : createMemoryUrl('drizzle-libsql')
  }
  if (!path) throw new Error('drizzleUrl(file): path is required')
  return `file:${path}`
}
