/**
 * Example usage of Postgres container helpers for integration testing
 *
 * Run with: TEST_MODE=integration pnpm test postgres-usage
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupPostgresTest } from '../src/containers/postgres.js'
import { isIntegrationTestMode, isDockerAvailable } from '../src/containers/docker-utils.js'

// Only run in integration test mode
describe.skipIf(!isIntegrationTestMode())('Postgres Container Usage Examples', () => {
  describe('Quick start example', () => {
    it('should set up a simple Postgres container', async () => {
      // Check Docker availability
      const dockerAvailable = await isDockerAvailable()
      if (!dockerAvailable) {
        console.log('Docker not available, skipping test')
        return
      }

      // Simple setup with defaults
      const { db, cleanup, connectionString } = await setupPostgresTest()

      try {
        // Use the database
        const result = await db.query('SELECT current_database()')
        expect(result.rows[0].current_database).toBe('test_db')

        console.log('Connected to:', connectionString)
      } finally {
        // Always cleanup
        await cleanup()
      }
    })
  })

  describe('With migrations and seeding', () => {
    let context: Awaited<ReturnType<typeof setupPostgresTest>>

    beforeAll(async () => {
      const dockerAvailable = await isDockerAvailable()
      if (!dockerAvailable) {
        return
      }

      // Setup with migrations and seed data
      context = await setupPostgresTest({
        migrations: './fixtures/migrations',
        seed: {
          users: [
            { id: 1, name: 'Alice', email: 'alice@example.com' },
            { id: 2, name: 'Bob', email: 'bob@example.com' },
          ],
        },
      })
    })

    afterAll(async () => {
      if (context?.cleanup) {
        await context.cleanup()
      }
    })

    it('should have seeded data', async () => {
      if (!context) {
        console.log('Skipped: Docker not available')
        return
      }

      const result = await context.db.query('SELECT COUNT(*) FROM users')
      expect(Number(result.rows[0].count)).toBe(2)
    })

    it('should support transactions', async () => {
      if (!context) return

      await context.db.query('BEGIN')
      try {
        await context.db.query(
          "INSERT INTO users (id, name, email) VALUES (3, 'Charlie', 'charlie@example.com')",
        )
        const count = await context.db.query('SELECT COUNT(*) FROM users')
        expect(Number(count.rows[0].count)).toBe(3)

        // Rollback the transaction
        await context.db.query('ROLLBACK')
      } catch (error) {
        await context.db.query('ROLLBACK')
        throw error
      }

      // Verify rollback worked
      const finalCount = await context.db.query('SELECT COUNT(*) FROM users')
      expect(Number(finalCount.rows[0].count)).toBe(2)
    })
  })

  describe('Custom configuration', () => {
    it('should support custom Postgres version and settings', async () => {
      const dockerAvailable = await isDockerAvailable()
      if (!dockerAvailable) return

      const { db, cleanup, host, port, database, username } = await setupPostgresTest({
        config: {
          image: 'postgres:15-alpine',
          database: 'custom_db',
          username: 'custom_user',
          password: 'custom_pass',
          environment: {
            POSTGRES_INITDB_ARGS: '--encoding=UTF8 --lc-collate=C --lc-ctype=C',
          },
        },
      })

      try {
        // Verify custom settings
        expect(database).toBe('custom_db')
        expect(username).toBe('custom_user')
        expect(typeof port).toBe('number')
        expect(port).toBeGreaterThan(0)
        expect(host).toBeTruthy()

        // Test the connection
        const result = await db.query('SELECT version()')
        expect(result.rows[0].version).toContain('PostgreSQL 15')
      } finally {
        await cleanup()
      }
    })
  })

  describe('Error handling and cleanup', () => {
    it('should cleanup even on test failure', async () => {
      const dockerAvailable = await isDockerAvailable()
      if (!dockerAvailable) return

      const { db, cleanup } = await setupPostgresTest()

      try {
        // Intentionally cause an error
        await expect(db.query('SELECT * FROM non_existent_table')).rejects.toThrow()
      } finally {
        // Cleanup should still work
        await expect(cleanup()).resolves.not.toThrow()
      }
    })

    it('should handle multiple cleanup calls gracefully', async () => {
      const dockerAvailable = await isDockerAvailable()
      if (!dockerAvailable) return

      const { cleanup } = await setupPostgresTest()

      // Multiple cleanup calls should be safe
      await cleanup()
      await cleanup() // Should not throw
    })
  })
})
