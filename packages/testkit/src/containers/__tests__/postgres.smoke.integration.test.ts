import { describe, expect, it } from 'vitest'
import { setupPostgresTest } from '../postgres.js'
import { isIntegrationTestMode } from '../docker-utils.js'

// This test only runs when TEST_MODE=integration is set
// Docker availability is checked by setupPostgresTest which will fail gracefully if not available
describe.skipIf(!isIntegrationTestMode())('PostgresContainer smoke', () => {
  it('should start container and connect', async () => {
    const { db, cleanup } = await setupPostgresTest({})

    try {
      const res = await db.query('SELECT 1 as ok')
      expect(res.rows[0].ok).toBe(1)
    } finally {
      await cleanup()
    }
  })
})
