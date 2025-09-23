import { describe, it, expect } from 'vitest'
import { createMemoryUrl, type SqliteTarget } from '../memory'

describe('SQLite Memory URL Helpers', () => {
  describe('createMemoryUrl', () => {
    it('should return shared cache URL for raw target by default', () => {
      const url = createMemoryUrl()
      expect(url).toBe('file::memory:?cache=shared')
    })

    it('should return shared cache URL for raw target explicitly', () => {
      const url = createMemoryUrl('raw')
      expect(url).toBe('file::memory:?cache=shared')
    })

    it('should return shared cache URL for kysely target', () => {
      const url = createMemoryUrl('kysely')
      expect(url).toBe('file::memory:?cache=shared')
    })

    it('should return shared cache URL for drizzle-libsql target', () => {
      const url = createMemoryUrl('drizzle-libsql')
      expect(url).toBe('file::memory:?cache=shared')
    })

    it('should return Prisma-specific URL for prisma target', () => {
      const url = createMemoryUrl('prisma')
      expect(url).toBe('file:memory?mode=memory&cache=shared')
    })

    it('should return direct memory URL for drizzle-better-sqlite3 target', () => {
      const url = createMemoryUrl('drizzle-better-sqlite3')
      expect(url).toBe(':memory:')
    })

    it('should handle all valid SqliteTarget types', () => {
      const targets: SqliteTarget[] = [
        'raw',
        'prisma',
        'drizzle-libsql',
        'kysely',
        'drizzle-better-sqlite3',
      ]

      for (const target of targets) {
        const url = createMemoryUrl(target)
        expect(url).toBeTruthy()
        expect(typeof url).toBe('string')
      }
    })

    describe('isolation guarantees', () => {
      it('should document that raw/kysely/drizzle-libsql use shared cache', () => {
        // These targets use file::memory:?cache=shared which allows sharing
        // between connections in the same process
        const sharedTargets: SqliteTarget[] = ['raw', 'kysely', 'drizzle-libsql']

        for (const target of sharedTargets) {
          const url = createMemoryUrl(target)
          expect(url).toContain('cache=shared')
        }
      })

      it('should document that Prisma uses shared cache mode', () => {
        const url = createMemoryUrl('prisma')
        expect(url).toContain('cache=shared')
        expect(url).toContain('mode=memory')
      })

      it('should document that drizzle-better-sqlite3 creates isolated memory', () => {
        // :memory: creates a new isolated database for each connection
        // unless the same database handle is shared
        const url = createMemoryUrl('drizzle-better-sqlite3')
        expect(url).toBe(':memory:')
        // This format creates isolated databases per connection
      })
    })

    describe('URL format validation', () => {
      it('should generate valid SQLite URL formats', () => {
        // Validate that URLs follow expected SQLite patterns
        const rawUrl = createMemoryUrl('raw')
        expect(rawUrl).toMatch(/^file:/)

        const prismaUrl = createMemoryUrl('prisma')
        expect(prismaUrl).toMatch(/^file:/)
        expect(prismaUrl).toContain('?')

        const betterSqliteUrl = createMemoryUrl('drizzle-better-sqlite3')
        expect(betterSqliteUrl).toMatch(/^:memory:$/)
      })
    })
  })

  describe('type safety', () => {
    it('should accept valid SqliteTarget types at compile time', () => {
      // This test ensures TypeScript types are working correctly
      const validTargets: SqliteTarget[] = [
        'raw',
        'prisma',
        'drizzle-libsql',
        'kysely',
        'drizzle-better-sqlite3',
      ]

      validTargets.forEach((target) => {
        expect(() => createMemoryUrl(target)).not.toThrow()
      })
    })
  })
})
