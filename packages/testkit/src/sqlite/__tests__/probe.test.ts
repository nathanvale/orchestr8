import { describe, expect, it } from 'vitest'
import { createFileDatabase } from '../file.js'
import { createMemoryUrl } from '../memory.js'
import { applyRecommendedPragmas, PragmaError } from '../pragma.js'

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
})
