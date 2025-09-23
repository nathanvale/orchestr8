import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { applyRecommendedPragmas, type PragmasOptions } from '../pragma.js'
import { createFileDatabase, type FileDatabase } from '../file.js'
import { createMemoryUrl } from '../memory.js'

describe('SQLite Pragma Support', () => {
  let databases: Array<FileDatabase> = []

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

  describe('applyRecommendedPragmas', () => {
    it('should apply recommended pragmas to file database with default options', async () => {
      const db = await createFileDatabase('pragma-test.sqlite')
      databases.push(db)

      // This should fail initially because we need a real database connection
      const mockDb = { pragma: vi.fn().mockReturnValue([{ journal_mode: 'wal' }]) }

      const result = await applyRecommendedPragmas(mockDb)

      expect(result).toEqual({
        journal_mode: 'wal',
        foreign_keys: 'on',
        busy_timeout: 2000,
      })
    })

    it('should apply recommended pragmas with custom busy timeout', async () => {
      const db = await createFileDatabase('pragma-custom.sqlite')
      databases.push(db)

      const mockDb = { pragma: vi.fn().mockReturnValue([{ journal_mode: 'wal' }]) }
      const options: PragmasOptions = { busyTimeoutMs: 5000 }

      const result = await applyRecommendedPragmas(mockDb, options)

      expect(result).toEqual({
        journal_mode: 'wal',
        foreign_keys: 'on',
        busy_timeout: 5000,
      })
    })

    it('should handle in-memory database WAL limitation gracefully', async () => {
      // In-memory databases typically cannot use WAL mode
      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce([{ journal_mode: 'memory' }]) // WAL fails, fallback to memory
          .mockReturnValueOnce([{ foreign_keys: 1 }])
          .mockReturnValueOnce([{ busy_timeout: 2000 }]),
      }

      const result = await applyRecommendedPragmas(mockDb)

      expect(result).toEqual({
        journal_mode: 'memory', // Should fallback gracefully
        foreign_keys: 'on',
        busy_timeout: 2000,
      })
    })

    it('should return effective pragma values for assertions', async () => {
      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce([{ journal_mode: 'wal' }])
          .mockReturnValueOnce([{ foreign_keys: 1 }])
          .mockReturnValueOnce([{ busy_timeout: 2000 }]),
      }

      const result = await applyRecommendedPragmas(mockDb)

      // Result should match what was actually applied, not just requested
      expect(result).toBeDefined()
      expect(result.journal_mode).toBe('wal')
      expect(result.foreign_keys).toBe('on')
      expect(result.busy_timeout).toBe(2000)
    })

    it('should validate that pragmas were actually executed', async () => {
      const mockPragma = vi
        .fn()
        .mockReturnValueOnce([{ journal_mode: 'wal' }])
        .mockReturnValueOnce([{ foreign_keys: 1 }])
        .mockReturnValueOnce([{ busy_timeout: 2000 }])

      const mockDb = { pragma: mockPragma }

      await applyRecommendedPragmas(mockDb)

      // Verify the expected pragma commands were executed
      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL')
      expect(mockPragma).toHaveBeenCalledWith('foreign_keys = ON')
      expect(mockPragma).toHaveBeenCalledWith('busy_timeout = 2000')
    })

    it('should handle database without pragma method gracefully', async () => {
      // Some database instances might not have pragma method
      const mockDb = {}

      const result = await applyRecommendedPragmas(mockDb)

      // Should return default values without throwing
      expect(result).toEqual({
        journal_mode: 'wal',
        foreign_keys: 'on',
        busy_timeout: 2000,
      })
    })

    it('should handle pragma execution errors gracefully', async () => {
      const mockDb = {
        pragma: vi.fn().mockImplementation(() => {
          throw new Error('PRAGMA execution failed')
        }),
      }

      const result = await applyRecommendedPragmas(mockDb)

      // Should fallback to default values on error
      expect(result).toEqual({
        journal_mode: 'wal',
        foreign_keys: 'on',
        busy_timeout: 2000,
      })
    })
  })

  describe('pragma options validation', () => {
    it('should use default busy timeout when not specified', async () => {
      const mockDb = { pragma: vi.fn().mockReturnValue([{ busy_timeout: 2000 }]) }

      const result = await applyRecommendedPragmas(mockDb, {})

      expect(result.busy_timeout).toBe(2000)
    })

    it('should accept zero as valid busy timeout', async () => {
      const mockDb = { pragma: vi.fn().mockReturnValue([{ busy_timeout: 0 }]) }

      const result = await applyRecommendedPragmas(mockDb, { busyTimeoutMs: 0 })

      expect(result.busy_timeout).toBe(0)
    })

    it('should handle undefined options gracefully', async () => {
      const mockDb = { pragma: vi.fn().mockReturnValue([{ busy_timeout: 2000 }]) }

      const result = await applyRecommendedPragmas(mockDb, undefined)

      expect(result.busy_timeout).toBe(2000)
    })
  })

  describe('integration with real database', () => {
    it('should demonstrate real usage pattern', async () => {
      const db = await createFileDatabase('pragma-integration.sqlite')
      databases.push(db)

      // Mock database connection that simulates better-sqlite3 behavior
      const mockConnection = {
        pragma: vi
          .fn()
          .mockReturnValueOnce([{ journal_mode: 'wal' }])
          .mockReturnValueOnce([{ foreign_keys: 1 }])
          .mockReturnValueOnce([{ busy_timeout: 2000 }]),
      }

      const result = await applyRecommendedPragmas(mockConnection)

      // Verify the pragmas were applied correctly
      expect(result.journal_mode).toBe('wal')
      expect(result.foreign_keys).toBe('on')
      expect(result.busy_timeout).toBe(2000)

      // Verify the actual database could be created
      expect(db.url).toMatch(/^file:/)
      expect(db.path).toContain('pragma-integration.sqlite')
    })

    it('should work with memory URL pattern', async () => {
      // Demonstrate usage with memory databases
      const memoryUrl = createMemoryUrl('raw')
      expect(memoryUrl).toBe('file::memory:?cache=shared')

      // For in-memory databases, WAL mode typically fails gracefully
      const mockMemoryDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce([{ journal_mode: 'memory' }]) // WAL not supported
          .mockReturnValueOnce([{ foreign_keys: 1 }])
          .mockReturnValueOnce([{ busy_timeout: 2000 }]),
      }

      // This would be called with a real in-memory connection
      const result = await applyRecommendedPragmas(mockMemoryDb)
      expect(result).toEqual({
        journal_mode: 'memory',
        foreign_keys: 'on',
        busy_timeout: 2000,
      })
    })
  })
})
