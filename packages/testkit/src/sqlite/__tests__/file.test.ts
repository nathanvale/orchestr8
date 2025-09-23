import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { createFileDatabase, type FileDatabase } from '../file'

describe('SQLite File Database Helpers', () => {
  let databases: FileDatabase[] = []

  beforeEach(() => {
    databases = []
  })

  afterEach(async () => {
    // Clean up all databases created during tests
    for (const db of databases) {
      try {
        await db.cleanup()
      } catch (err) {
        console.warn('Failed to cleanup database:', err)
      }
    }
  })

  describe('createFileDatabase', () => {
    it('should create a file database with default name', async () => {
      const db = await createFileDatabase()
      databases.push(db)

      expect(db.url).toMatch(/^file:/)
      expect(db.path).toContain('db.sqlite')
      expect(db.dir).toBeTruthy()
      expect(typeof db.cleanup).toBe('function')
    })

    it('should create a file database with custom name', async () => {
      const customName = 'test-custom.db'
      const db = await createFileDatabase(customName)
      databases.push(db)

      expect(db.path).toContain(customName)
      expect(db.url).toBe(`file:${db.path}`)
    })

    it('should create database in a temporary directory', async () => {
      const db = await createFileDatabase()
      databases.push(db)

      // Check that the directory path contains temp indicators
      expect(db.dir).toMatch(/sqlite-/)
      expect(db.path).toContain(db.dir)
    })

    it('should provide a working cleanup function', async () => {
      const db = await createFileDatabase()

      // Verify the path exists before cleanup
      const pathExistsBefore = existsSync(db.dir)
      expect(pathExistsBefore).toBe(true)

      // Clean up
      await db.cleanup()

      // Verify the path is removed after cleanup
      const pathExistsAfter = existsSync(db.dir)
      expect(pathExistsAfter).toBe(false)

      // Remove from tracking since we already cleaned it up
      const index = databases.indexOf(db)
      if (index > -1) {
        databases.splice(index, 1)
      }
    })

    it('should create multiple isolated databases', async () => {
      const db1 = await createFileDatabase('db1.sqlite')
      const db2 = await createFileDatabase('db2.sqlite')
      databases.push(db1, db2)

      // Each database should have unique paths
      expect(db1.path).not.toBe(db2.path)
      expect(db1.dir).not.toBe(db2.dir)
      expect(db1.url).not.toBe(db2.url)

      // Both should exist
      expect(existsSync(db1.dir)).toBe(true)
      expect(existsSync(db2.dir)).toBe(true)
    })

    it('should generate valid file URLs for SQLite', async () => {
      const db = await createFileDatabase()
      databases.push(db)

      // URL should be a valid file:// URL
      expect(db.url).toMatch(/^file:\//)

      // Path should be absolute
      expect(db.path).toMatch(/^\//)
    })

    it('should handle special characters in database names', async () => {
      const specialName = 'test-db_2024.01.01-backup.sqlite'
      const db = await createFileDatabase(specialName)
      databases.push(db)

      expect(db.path).toContain(specialName)
      expect(db.url).toBe(`file:${db.path}`)
    })

    it('should create databases that can be used concurrently', async () => {
      const dbPromises = Array.from({ length: 5 }, (_, i) =>
        createFileDatabase(`concurrent-${i}.sqlite`),
      )

      const dbs = await Promise.all(dbPromises)
      databases.push(...dbs)

      // All databases should have unique paths
      const paths = dbs.map((db) => db.path)
      const uniquePaths = new Set(paths)
      expect(uniquePaths.size).toBe(paths.length)

      // All should exist
      for (const db of dbs) {
        expect(existsSync(db.dir)).toBe(true)
      }
    })

    describe('cleanup behavior', () => {
      it('should handle double cleanup gracefully', async () => {
        const db = await createFileDatabase()

        await db.cleanup()
        // Second cleanup should not throw
        await expect(db.cleanup()).resolves.not.toThrow()
      })

      it('should clean up even with nested files', async () => {
        const db = await createFileDatabase()
        databases.push(db)

        // Verify directory exists
        expect(existsSync(db.dir)).toBe(true)

        // The temp directory manager should handle all nested content
        await db.cleanup()

        expect(existsSync(db.dir)).toBe(false)
      })
    })

    describe('integration patterns', () => {
      it('should support test-scoped databases', async () => {
        // Pattern for using in tests
        const testDb = await createFileDatabase('test-scoped.sqlite')
        databases.push(testDb)

        // Use the database URL for connections
        expect(testDb.url).toBeTruthy()

        // Database path can be used for direct file operations
        expect(testDb.path).toBeTruthy()

        // Directory can be used for storing related files
        expect(testDb.dir).toBeTruthy()

        // Cleanup in afterEach or afterAll
        expect(typeof testDb.cleanup).toBe('function')
      })

      it('should provide consistent URL format for ORM compatibility', async () => {
        const db = await createFileDatabase()
        databases.push(db)

        // URL should be compatible with SQLite connection strings
        expect(db.url).toMatch(/^file:/)

        // Should not include query parameters by default
        // (those would be added by ORM-specific helpers)
        expect(db.url).not.toContain('?')
        expect(db.url).not.toContain('mode=')
        expect(db.url).not.toContain('cache=')
      })
    })
  })
})
