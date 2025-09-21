import { afterAll, describe, expect, it } from 'vitest'
import { setupPostgresTest } from '../postgres.js'

const ENABLE = process.env.TESTCONTAINERS_PG === '1'

// Gate the suite to avoid running by default in CI
const describeIf = ENABLE ? describe : describe.skip

describeIf('PostgresContainer smoke', () => {
  const resources: Array<() => Promise<void>> = []

  afterAll(async () => {
    for (const cleanup of resources.splice(0, resources.length)) {
      try {
        await cleanup()
      } catch (e) {
        console.warn('cleanup error', e)
      }
    }
  })

  it('starts and responds to SELECT 1', async () => {
    const { db, cleanup } = await setupPostgresTest({})
    resources.push(cleanup)

    const res = await db.query('SELECT 1 as ok')
    expect(res.rows[0].ok).toBe(1)
  })
})
