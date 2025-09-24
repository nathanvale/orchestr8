import { describe, expect, it, vi } from 'vitest'
import { createFileDatabase } from '../file.js'
import { createMemoryUrl } from '../memory.js'
import { applyRecommendedPragmas, probeEnvironment, PragmaError } from '../pragma.js'

// Minimal probe showing shapes; full integration is env-gated in Phase 2

describe('sqlite helpers (probe)', () => {
  it('should create target-aware memory URLs', () => {
    expect(createMemoryUrl('raw')).toBe('file::memory:?cache=shared')
    expect(createMemoryUrl('prisma')).toBe('file:memory?mode=memory&cache=shared')
    expect(createMemoryUrl('drizzle-better-sqlite3')).toBe(':memory:')
  })

  it('should create a file db with cleanup', async () => {
    const db = await createFileDatabase('test.sqlite')
    expect(db.url).toMatch(/^file:\//)
    expect(db.path.endsWith('test.sqlite')).toBe(true)
    await db.cleanup()
  })

  it('should throw PragmaError for empty database object', async () => {
    await expect(applyRecommendedPragmas({} as any)).rejects.toThrow(PragmaError)
    await expect(applyRecommendedPragmas({} as any)).rejects.toThrow(
      'Database object lacks pragma(), prepare(), and exec() methods - cannot apply pragmas',
    )
  })

  describe('probeEnvironment', () => {
    it('should probe basic environment with mock database using pragma method', async () => {
      const mockDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'wal'
          if (sql === 'foreign_keys') return '1'
          if (sql === 'busy_timeout') return { timeout: 2000 }
          if (sql.includes('=')) return undefined // setter calls
        }),
        exec: vi.fn(),
      }

      const result = await probeEnvironment(mockDb, { logLevel: 'silent' })

      expect(result.pragmas.journal_mode).toBe('wal')
      expect(result.pragmas.foreign_keys).toBe('on')
      expect(result.pragmas.busy_timeout).toBe(2000)
      expect(result.capabilities).toEqual({
        wal: true,
        foreign_keys: true,
        json1: true,
        fts5: true,
      })

      // Verify pragma application
      expect(mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL')
      expect(mockDb.pragma).toHaveBeenCalledWith('foreign_keys = ON')
      expect(mockDb.pragma).toHaveBeenCalledWith('busy_timeout = 2000')

      // Verify capability checks
      expect(mockDb.exec).toHaveBeenCalledWith(`SELECT json_extract('{"test":1}', '$.test')`)
      expect(mockDb.exec).toHaveBeenCalledWith('CREATE VIRTUAL TABLE temp_fts USING fts5(content)')
      expect(mockDb.exec).toHaveBeenCalledWith('DROP TABLE temp_fts')
    })

    it('should probe environment with prepare method fallback', async () => {
      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          get: () => {
            if (sql === 'PRAGMA journal_mode') return { journal_mode: 'memory' }
            if (sql === 'PRAGMA foreign_keys') return { foreign_keys: 0 }
            if (sql === 'PRAGMA busy_timeout') return { timeout: 1500 }
            return undefined
          },
          run: vi.fn(),
        })),
        exec: vi.fn(),
      }

      const result = await probeEnvironment(mockDb, { logLevel: 'silent' })

      expect(result.pragmas.journal_mode).toBe('memory')
      expect(result.pragmas.foreign_keys).toBe('off')
      expect(result.pragmas.busy_timeout).toBe(1500)
      expect(result.capabilities).toEqual({
        wal: false,
        foreign_keys: false,
        json1: true,
        fts5: true,
      })
    })

    it('should detect WAL capability correctly', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      // WAL enabled
      const walDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'wal'
          if (sql === 'foreign_keys') return '1'
          if (sql === 'busy_timeout') return { timeout: 2000 }
        }),
        exec: vi.fn(),
      }

      const walResult = await probeEnvironment(walDb, {
        logLevel: 'info',
        logger: mockLogger,
      })

      expect(walResult.capabilities.wal).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith('✅ WAL mode enabled')

      // WAL disabled
      mockLogger.info.mockClear()
      mockLogger.warn.mockClear()

      const memoryDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'memory'
          if (sql === 'foreign_keys') return '1'
          if (sql === 'busy_timeout') return { timeout: 2000 }
        }),
        exec: vi.fn(),
      }

      const memoryResult = await probeEnvironment(memoryDb, {
        logLevel: 'info',
        logger: mockLogger,
      })

      expect(memoryResult.capabilities.wal).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️  WAL mode not available, using: memory')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '   Consider using file-based databases for WAL support',
      )
    })

    it('should detect foreign keys capability correctly', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      // Foreign keys enabled (numeric format)
      const fkOnDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'wal'
          if (sql === 'foreign_keys') return '1'
          if (sql === 'busy_timeout') return { timeout: 2000 }
        }),
        exec: vi.fn(),
      }

      const fkOnResult = await probeEnvironment(fkOnDb, {
        logLevel: 'info',
        logger: mockLogger,
      })

      expect(fkOnResult.capabilities.foreign_keys).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Foreign keys enabled')

      // Foreign keys disabled
      mockLogger.info.mockClear()
      mockLogger.warn.mockClear()

      const fkOffDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'wal'
          if (sql === 'foreign_keys') return '0'
          if (sql === 'busy_timeout') return { timeout: 2000 }
        }),
        exec: vi.fn(),
      }

      const fkOffResult = await probeEnvironment(fkOffDb, {
        logLevel: 'info',
        logger: mockLogger,
      })

      expect(fkOffResult.capabilities.foreign_keys).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '⚠️  Foreign key support is required but not enabled',
      )
    })

    it('should handle required capabilities validation', async () => {
      const mockDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'memory' // WAL not available
          if (sql === 'foreign_keys') return '0' // Foreign keys disabled
          if (sql === 'busy_timeout') return { timeout: 2000 }
        }),
        exec: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('json_extract')) {
            throw new Error('JSON1 not available')
          }
          if (sql.includes('fts5')) {
            throw new Error('FTS5 not available')
          }
        }),
      }

      // Test WAL requirement failure
      await expect(
        probeEnvironment(mockDb, {
          required: ['wal'],
          logLevel: 'silent',
        }),
      ).rejects.toThrow('WAL mode is required but not available (using: memory)')

      // Test foreign keys requirement failure
      await expect(
        probeEnvironment(mockDb, {
          required: ['foreign_keys'],
          logLevel: 'silent',
        }),
      ).rejects.toThrow('Foreign key support is required but not enabled')

      // Test JSON1 requirement failure
      await expect(
        probeEnvironment(mockDb, {
          required: ['json1'],
          logLevel: 'silent',
        }),
      ).rejects.toThrow('JSON1 extension is required but not available')

      // Test FTS5 requirement failure
      await expect(
        probeEnvironment(mockDb, {
          required: ['fts5'],
          logLevel: 'silent',
        }),
      ).rejects.toThrow('FTS5 extension is required but not available')
    })

    it('should handle different log levels correctly', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      const mockDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'memory' // Will trigger warning
          if (sql === 'foreign_keys') return '1'
          if (sql === 'busy_timeout') return { timeout: 500 } // Low timeout
        }),
        exec: vi.fn(),
      }

      // Silent mode - no logging
      await probeEnvironment(mockDb, {
        logLevel: 'silent',
        logger: mockLogger,
      })

      expect(mockLogger.info).not.toHaveBeenCalled()
      expect(mockLogger.warn).not.toHaveBeenCalled()

      mockLogger.info.mockClear()
      mockLogger.warn.mockClear()

      // Warn mode - only warnings
      await probeEnvironment(mockDb, {
        logLevel: 'warn',
        logger: mockLogger,
      })

      expect(mockLogger.info).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️  WAL mode not available, using: memory')
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️  Busy timeout is low: 500ms')

      mockLogger.info.mockClear()
      mockLogger.warn.mockClear()

      // Info mode - all logging
      await probeEnvironment(mockDb, {
        logLevel: 'info',
        logger: mockLogger,
      })

      expect(mockLogger.info).toHaveBeenCalledWith('🔍 Probing SQLite environment capabilities...')
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Environment probe complete\n')
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️  WAL mode not available, using: memory')
    })

    it('should handle pragma normalization correctly', async () => {
      const mockDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'unknown'
          if (sql === 'foreign_keys') return 'unknown'
          if (sql === 'busy_timeout') return { timeout: 2000 }
        }),
        exec: vi.fn(),
      }

      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      const result = await probeEnvironment(mockDb, {
        logLevel: 'info',
        logger: mockLogger,
      })

      expect(result.pragmas.journal_mode).toBe('unknown')
      expect(result.pragmas.foreign_keys).toBe('unknown')
      expect(result.capabilities.wal).toBe(false)
      expect(result.capabilities.foreign_keys).toBe(false)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '⚠️  WAL mode status unknown (pragma support unavailable)',
      )
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '   Database object may lack pragma() or prepare() methods',
      )
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '⚠️  Foreign key status unknown (pragma support unavailable)',
      )
    })

    it('should handle error when pragma support unavailable for required capabilities', async () => {
      const mockDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'unknown'
          if (sql === 'foreign_keys') return 'unknown'
          if (sql === 'busy_timeout') return { timeout: 2000 }
        }),
        exec: vi.fn(),
      }

      // WAL required but unknown
      await expect(
        probeEnvironment(mockDb, {
          required: ['wal'],
          logLevel: 'silent',
        }),
      ).rejects.toThrow('WAL mode is required but pragma support is unavailable to verify')

      // Foreign keys required but unknown
      await expect(
        probeEnvironment(mockDb, {
          required: ['foreign_keys'],
          logLevel: 'silent',
        }),
      ).rejects.toThrow('Foreign keys are required but pragma support is unavailable to verify')
    })

    it('should handle database with execute method instead of exec', async () => {
      const mockDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'wal'
          if (sql === 'foreign_keys') return '1'
          if (sql === 'busy_timeout') return { timeout: 2000 }
        }),
        execute: vi.fn(), // Using execute instead of exec
      }

      const result = await probeEnvironment(mockDb, { logLevel: 'silent' })

      expect(result.capabilities.json1).toBe(true)
      expect(result.capabilities.fts5).toBe(true)

      // Verify capability checks used execute method
      expect(mockDb.execute).toHaveBeenCalledWith(`SELECT json_extract('{"test":1}', '$.test')`)
      expect(mockDb.execute).toHaveBeenCalledWith(
        'CREATE VIRTUAL TABLE temp_fts USING fts5(content)',
      )
      expect(mockDb.execute).toHaveBeenCalledWith('DROP TABLE temp_fts')
    })

    it('should handle busy timeout warnings correctly', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      // Low timeout
      const lowTimeoutDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'wal'
          if (sql === 'foreign_keys') return '1'
          if (sql === 'busy_timeout') return { timeout: 500 }
        }),
        exec: vi.fn(),
      }

      await probeEnvironment(lowTimeoutDb, {
        logLevel: 'info',
        logger: mockLogger,
      })

      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️  Busy timeout is low: 500ms')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '   Consider increasing for better concurrency handling',
      )

      mockLogger.warn.mockClear()
      mockLogger.info.mockClear()

      // Good timeout
      const goodTimeoutDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'wal'
          if (sql === 'foreign_keys') return '1'
          if (sql === 'busy_timeout') return { timeout: 2000 }
        }),
        exec: vi.fn(),
      }

      await probeEnvironment(goodTimeoutDb, {
        logLevel: 'info',
        logger: mockLogger,
      })

      expect(mockLogger.info).toHaveBeenCalledWith('✅ Busy timeout set to 2000ms')
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Busy timeout is low'),
      )
    })

    it('should pass pragma options through to applyRecommendedPragmas', async () => {
      const customLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      const mockDb = {
        pragma: vi.fn((sql: string) => {
          if (sql === 'journal_mode') return 'wal'
          if (sql === 'foreign_keys') return '1'
          if (sql === 'busy_timeout') return { timeout: 5000 } // Custom timeout
        }),
        exec: vi.fn(),
      }

      const result = await probeEnvironment(mockDb, {
        logLevel: 'silent',
        pragmaOptions: {
          busyTimeoutMs: 5000,
          logger: customLogger,
        },
      })

      expect(result.pragmas.busy_timeout).toBe(5000)
      expect(mockDb.pragma).toHaveBeenCalledWith('busy_timeout = 5000')
    })

    it('should handle various foreign key normalization formats', async () => {
      const testCases = [
        { input: '1', expected: 'on' },
        { input: '0', expected: 'off' },
        { input: 'true', expected: 'on' },
        { input: 'false', expected: 'off' },
        { input: 'on', expected: 'on' },
        { input: 'off', expected: 'off' },
        { input: 'unknown_value', expected: 'unknown' },
      ]

      for (const testCase of testCases) {
        const mockDb = {
          pragma: vi.fn((sql: string) => {
            if (sql === 'journal_mode') return 'wal'
            if (sql === 'foreign_keys') return testCase.input
            if (sql === 'busy_timeout') return { timeout: 2000 }
          }),
          exec: vi.fn(),
        }

        const result = await probeEnvironment(mockDb, { logLevel: 'silent' })
        expect(result.pragmas.foreign_keys).toBe(testCase.expected)
        expect(result.capabilities.foreign_keys).toBe(testCase.expected === 'on')
      }
    })
  })
})
