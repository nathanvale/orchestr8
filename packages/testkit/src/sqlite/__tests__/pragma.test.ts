import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { applyRecommendedPragmas, type PragmasOptions, PragmaError } from '../pragma.js'
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

      // Mock database with proper pragma response patterns
      // The pragma method needs to return different values for setting vs getting
      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 2000 (setting)
          .mockReturnValueOnce([{ journal_mode: 'wal' }]) // journal_mode (getting)
          .mockReturnValueOnce([{ foreign_keys: 1 }]) // foreign_keys (getting)
          .mockReturnValueOnce([{ timeout: 2000 }]), // busy_timeout (getting - better-sqlite3 format)
      }

      const result = await applyRecommendedPragmas(mockDb)

      expect(result).toEqual({
        journal_mode: 'wal',
        foreign_keys: 'on', // Implementation normalizes 1 to 'on'
        busy_timeout: 2000,
      })
    })

    it('should apply recommended pragmas with custom busy timeout', async () => {
      const db = await createFileDatabase('pragma-custom.sqlite')
      databases.push(db)

      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 5000 (setting)
          .mockReturnValueOnce([{ journal_mode: 'wal' }]) // journal_mode (getting)
          .mockReturnValueOnce([{ foreign_keys: 1 }]) // foreign_keys (getting)
          .mockReturnValueOnce([{ timeout: 5000 }]), // busy_timeout (getting - better-sqlite3 format)
      }
      const options: PragmasOptions = { busyTimeoutMs: 5000 }

      const result = await applyRecommendedPragmas(mockDb, options)

      expect(result).toEqual({
        journal_mode: 'wal',
        foreign_keys: 'on', // Implementation normalizes 1 to 'on'
        busy_timeout: 5000,
      })
    })

    it('should handle in-memory database WAL limitation gracefully', async () => {
      // In-memory databases typically cannot use WAL mode
      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting - fails silently)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 2000 (setting)
          .mockReturnValueOnce([{ journal_mode: 'memory' }]) // journal_mode (getting - fallback)
          .mockReturnValueOnce([{ foreign_keys: 1 }]) // foreign_keys (getting)
          .mockReturnValueOnce([{ timeout: 2000 }]), // busy_timeout (getting - better-sqlite3 format)
      }

      const result = await applyRecommendedPragmas(mockDb)

      expect(result).toEqual({
        journal_mode: 'memory', // Should fallback gracefully
        foreign_keys: 'on', // Implementation normalizes 1 to 'on'
        busy_timeout: 2000,
      })
    })

    it('should return effective pragma values for assertions', async () => {
      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 2000 (setting)
          .mockReturnValueOnce([{ journal_mode: 'wal' }]) // journal_mode (getting)
          .mockReturnValueOnce([{ foreign_keys: 1 }]) // foreign_keys (getting)
          .mockReturnValueOnce([{ timeout: 2000 }]), // busy_timeout (getting - better-sqlite3 format)
      }

      const result = await applyRecommendedPragmas(mockDb)

      // Result should match what was actually applied, not just requested
      expect(result).toBeDefined()
      expect(result.journal_mode).toBe('wal')
      expect(result.foreign_keys).toBe('on') // Implementation normalizes 1 to 'on'
      expect(result.busy_timeout).toBe(2000)
    })

    it('should validate that pragmas were actually executed', async () => {
      const mockPragma = vi
        .fn()
        .mockReturnValueOnce(undefined) // journal_mode = WAL (setting)
        .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
        .mockReturnValueOnce(undefined) // busy_timeout = 2000 (setting)
        .mockReturnValueOnce([{ journal_mode: 'wal' }]) // journal_mode (getting)
        .mockReturnValueOnce([{ foreign_keys: 1 }]) // foreign_keys (getting)
        .mockReturnValueOnce([{ timeout: 2000 }]) // busy_timeout (getting - better-sqlite3 format)

      const mockDb = { pragma: mockPragma }

      await applyRecommendedPragmas(mockDb)

      // Verify the expected pragma commands were executed
      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL')
      expect(mockPragma).toHaveBeenCalledWith('foreign_keys = ON')
      expect(mockPragma).toHaveBeenCalledWith('busy_timeout = 2000')
    })

    it('should throw PragmaError when database lacks pragma method', async () => {
      // Some database instances might not have pragma method
      const mockDb = {}

      await expect(applyRecommendedPragmas(mockDb)).rejects.toThrow(PragmaError)
      await expect(applyRecommendedPragmas(mockDb)).rejects.toThrow(
        'Database object lacks pragma(), prepare(), and exec() methods - cannot apply pragmas',
      )
    })

    it('should throw PragmaError on pragma execution errors', async () => {
      const mockDb = {
        pragma: vi.fn().mockImplementation(() => {
          throw new Error('PRAGMA execution failed')
        }),
      }

      await expect(applyRecommendedPragmas(mockDb)).rejects.toThrow(PragmaError)
      await expect(applyRecommendedPragmas(mockDb)).rejects.toThrow(
        'Failed to apply pragmas using pragma() method: PRAGMA execution failed',
      )
    })
  })

  describe('pragma options validation', () => {
    it('should use default busy timeout when not specified', async () => {
      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 2000 (setting)
          .mockReturnValueOnce([{ journal_mode: 'wal' }]) // journal_mode (getting)
          .mockReturnValueOnce([{ foreign_keys: 1 }]) // foreign_keys (getting)
          .mockReturnValueOnce([{ timeout: 2000 }]), // busy_timeout (getting - better-sqlite3 format)
      }

      const result = await applyRecommendedPragmas(mockDb, {})

      expect(result.busy_timeout).toBe(2000)
    })

    it('should accept zero as valid busy timeout', async () => {
      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 0 (setting)
          .mockReturnValueOnce([{ journal_mode: 'wal' }]) // journal_mode (getting)
          .mockReturnValueOnce([{ foreign_keys: 1 }]) // foreign_keys (getting)
          .mockReturnValueOnce([{ timeout: 0 }]), // busy_timeout (getting - better-sqlite3 format)
      }

      const result = await applyRecommendedPragmas(mockDb, { busyTimeoutMs: 0 })

      expect(result.busy_timeout).toBe(0)
    })

    it('should handle undefined options gracefully', async () => {
      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 2000 (setting)
          .mockReturnValueOnce([{ journal_mode: 'wal' }]) // journal_mode (getting)
          .mockReturnValueOnce([{ foreign_keys: 1 }]) // foreign_keys (getting)
          .mockReturnValueOnce([{ timeout: 2000 }]), // busy_timeout (getting - better-sqlite3 format)
      }

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
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 2000 (setting)
          .mockReturnValueOnce([{ journal_mode: 'wal' }]) // journal_mode (getting)
          .mockReturnValueOnce([{ foreign_keys: 1 }]) // foreign_keys (getting)
          .mockReturnValueOnce([{ timeout: 2000 }]), // busy_timeout (getting - better-sqlite3 format)
      }

      const result = await applyRecommendedPragmas(mockConnection)

      // Verify the pragmas were applied correctly
      expect(result.journal_mode).toBe('wal')
      expect(result.foreign_keys).toBe('on') // Implementation normalizes 1 to 'on'
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
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting - fails silently)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 2000 (setting)
          .mockReturnValueOnce([{ journal_mode: 'memory' }]) // journal_mode (getting - fallback)
          .mockReturnValueOnce([{ foreign_keys: 1 }]) // foreign_keys (getting)
          .mockReturnValueOnce([{ timeout: 2000 }]), // busy_timeout (getting - better-sqlite3 format)
      }

      // This would be called with a real in-memory connection
      const result = await applyRecommendedPragmas(mockMemoryDb)
      expect(result).toEqual({
        journal_mode: 'memory',
        foreign_keys: 'on', // Implementation normalizes 1 to 'on'
        busy_timeout: 2000,
      })
    })
  })

  describe('pragma value extraction edge cases', () => {
    it('should handle better-sqlite3 timeout format correctly', async () => {
      // better-sqlite3 returns { timeout: number } for busy_timeout pragma
      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 3000 (setting)
          .mockReturnValueOnce([{ journal_mode: 'wal' }]) // journal_mode (getting)
          .mockReturnValueOnce([{ foreign_keys: 1 }]) // foreign_keys (getting)
          .mockReturnValueOnce([{ timeout: 3000 }]), // busy_timeout (getting - better-sqlite3 format)
      }

      const result = await applyRecommendedPragmas(mockDb, { busyTimeoutMs: 3000 })

      expect(result.busy_timeout).toBe(3000)
    })

    it('should handle foreign_keys numeric values correctly', async () => {
      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 2000 (setting)
          .mockReturnValueOnce([{ journal_mode: 'wal' }]) // journal_mode (getting)
          .mockReturnValueOnce([{ foreign_keys: 0 }]) // foreign_keys = 0 (off)
          .mockReturnValueOnce([{ timeout: 2000 }]), // busy_timeout (getting - better-sqlite3 format)
      }

      const result = await applyRecommendedPragmas(mockDb)

      expect(result.foreign_keys).toBe('off') // Should normalize numeric 0 to 'off'
    })

    it('should handle direct number responses for busy_timeout', async () => {
      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 2000 (setting)
          .mockReturnValueOnce([{ journal_mode: 'wal' }]) // journal_mode (getting)
          .mockReturnValueOnce([{ foreign_keys: 1 }]) // foreign_keys (getting)
          .mockReturnValueOnce(2000), // busy_timeout (getting - direct number)
      }

      const result = await applyRecommendedPragmas(mockDb)

      expect(result.busy_timeout).toBe(2000)
    })

    it('should handle unknown/null pragma responses gracefully', async () => {
      const mockDb = {
        pragma: vi
          .fn()
          .mockReturnValueOnce(undefined) // journal_mode = WAL (setting)
          .mockReturnValueOnce(undefined) // foreign_keys = ON (setting)
          .mockReturnValueOnce(undefined) // busy_timeout = 2000 (setting)
          .mockReturnValueOnce(null) // journal_mode (getting - null)
          .mockReturnValueOnce(undefined) // foreign_keys (getting - undefined)
          .mockReturnValueOnce([]), // busy_timeout (getting - empty array)
      }

      const result = await applyRecommendedPragmas(mockDb)

      expect(result.journal_mode).toBe('unknown')
      expect(result.foreign_keys).toBe('unknown')
      expect(result.busy_timeout).toBeUndefined()
    })
  })
})
