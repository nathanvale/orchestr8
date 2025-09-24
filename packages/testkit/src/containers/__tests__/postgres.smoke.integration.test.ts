import { beforeAll, describe, expect, it } from 'vitest'
import { setupPostgresTest } from '../postgres.js'
import { isDockerAvailable, isIntegrationTestMode } from '../docker-utils.js'

// This test only runs when:
// 1. TEST_MODE=integration is set
// 2. Docker is available
describe.skipIf(!isIntegrationTestMode())('PostgresContainer smoke', () => {
  let dockerAvailable: boolean

  beforeAll(async () => {
    dockerAvailable = await isDockerAvailable()
    if (!dockerAvailable) {
      console.log('⚠️ Skipping Postgres container tests: Docker is not available')
    }
  })

  it.skipIf(() => !dockerAvailable)('should start container and connect', async () => {
    const { db, cleanup } = await setupPostgresTest({})

    try {
      const res = await db.query('SELECT 1 as ok')
      expect(res.rows[0].ok).toBe(1)
    } finally {
      await cleanup()
    }
  })
})
