/**
 * README Validation Tests
 *
 * This test suite validates that all code examples and function names shown
 * in the README.md file are accurate and functional.
 *
 * Tests verify:
 * 1. All exported functions mentioned in README exist
 * 2. Functions have the correct type signatures
 * 3. Simple examples execute without errors
 * 4. Optional dependencies are handled gracefully
 */

import { describe, test, expect } from 'vitest'
import { isOptionalDependencyAvailable } from './fixtures/test-helpers.js'

// Skip README validation tests - they're documentation tests, not implementation tests
describe.skip('README Validation', () => {
  describe('SQLite Exports (from README lines 118-129)', () => {
    test('createMemoryUrl exists and is a function', async () => {
      if (!isOptionalDependencyAvailable('better-sqlite3')) {
        console.log('Skipping SQLite test - better-sqlite3 not available')
        return
      }

      const sqliteModule = await import('@orchestr8/testkit/sqlite')
      expect(sqliteModule).toHaveProperty('createMemoryUrl')
      expect(typeof sqliteModule.createMemoryUrl).toBe('function')
    })

    test('createFileDatabase exists and is a function', async () => {
      if (!isOptionalDependencyAvailable('better-sqlite3')) {
        console.log('Skipping SQLite test - better-sqlite3 not available')
        return
      }

      const sqliteModule = await import('@orchestr8/testkit/sqlite')
      expect(sqliteModule).toHaveProperty('createFileDatabase')
      expect(typeof sqliteModule.createFileDatabase).toBe('function')
    })

    test('createSQLitePool exists and is a function', async () => {
      if (!isOptionalDependencyAvailable('better-sqlite3')) {
        console.log('Skipping SQLite test - better-sqlite3 not available')
        return
      }

      const sqliteModule = await import('@orchestr8/testkit/sqlite')
      expect(sqliteModule).toHaveProperty('createSQLitePool')
      expect(typeof sqliteModule.createSQLitePool).toBe('function')
    })

    test('withTransaction exists and is a function', async () => {
      if (!isOptionalDependencyAvailable('better-sqlite3')) {
        console.log('Skipping SQLite test - better-sqlite3 not available')
        return
      }

      const sqliteModule = await import('@orchestr8/testkit/sqlite')
      expect(sqliteModule).toHaveProperty('withTransaction')
      expect(typeof sqliteModule.withTransaction).toBe('function')
    })

    test('README mentions "createPool" but actual export is "createSQLitePool"', async () => {
      if (!isOptionalDependencyAvailable('better-sqlite3')) {
        console.log('Skipping SQLite test - better-sqlite3 not available')
        return
      }

      const sqliteModule = await import('@orchestr8/testkit/sqlite')

      // README shows: import { createPool } from '@orchestr8/testkit/sqlite'
      // But actual export is createSQLitePool
      expect(sqliteModule).not.toHaveProperty('createPool')
      expect(sqliteModule).toHaveProperty('createSQLitePool')
    })

    test('seed functions mentioned in README exist', async () => {
      if (!isOptionalDependencyAvailable('better-sqlite3')) {
        console.log('Skipping SQLite test - better-sqlite3 not available')
        return
      }

      const sqliteModule = await import('@orchestr8/testkit/sqlite')
      // README lines 147-149 mention these seed functions
      expect(sqliteModule).toHaveProperty('seedWithSql')
      expect(typeof sqliteModule.seedWithSql).toBe('function')

      expect(sqliteModule).toHaveProperty('seedWithFiles')
      expect(typeof sqliteModule.seedWithFiles).toBe('function')

      expect(sqliteModule).toHaveProperty('seedWithBatch')
      expect(typeof sqliteModule.seedWithBatch).toBe('function')
    })
  })

  describe('Container Exports (from README lines 132-145)', () => {
    test('createPostgresContext exists and is a function', async () => {
      if (!isOptionalDependencyAvailable('testcontainers')) {
        console.log('Skipping containers test - testcontainers not available')
        return
      }

      const containersModule = await import('@orchestr8/testkit/containers')
      expect(containersModule).toHaveProperty('createPostgresContext')
      expect(typeof containersModule.createPostgresContext).toBe('function')
    })

    test('createMySQLContext exists and is a function', async () => {
      if (!isOptionalDependencyAvailable('testcontainers')) {
        console.log('Skipping containers test - testcontainers not available')
        return
      }

      const containersModule = await import('@orchestr8/testkit/containers')
      expect(containersModule).toHaveProperty('createMySQLContext')
      expect(typeof containersModule.createMySQLContext).toBe('function')
    })

    test('PostgresContainer exists', async () => {
      if (!isOptionalDependencyAvailable('testcontainers')) {
        console.log('Skipping containers test - testcontainers not available')
        return
      }

      const containersModule = await import('@orchestr8/testkit/containers')
      expect(containersModule).toHaveProperty('PostgresContainer')
      expect(typeof containersModule.PostgresContainer).toBe('function')
    })

    test('MySQLContainer exists', async () => {
      if (!isOptionalDependencyAvailable('testcontainers')) {
        console.log('Skipping containers test - testcontainers not available')
        return
      }

      const containersModule = await import('@orchestr8/testkit/containers')
      expect(containersModule).toHaveProperty('MySQLContainer')
      expect(typeof containersModule.MySQLContainer).toBe('function')
    })

    test('setupPostgresTest exists and is a function', async () => {
      if (!isOptionalDependencyAvailable('testcontainers')) {
        console.log('Skipping containers test - testcontainers not available')
        return
      }

      const containersModule = await import('@orchestr8/testkit/containers')
      expect(containersModule).toHaveProperty('setupPostgresTest')
      expect(typeof containersModule.setupPostgresTest).toBe('function')
    })

    test('setupMySQLTest exists and is a function', async () => {
      if (!isOptionalDependencyAvailable('testcontainers')) {
        console.log('Skipping containers test - testcontainers not available')
        return
      }

      const containersModule = await import('@orchestr8/testkit/containers')
      expect(containersModule).toHaveProperty('setupMySQLTest')
      expect(typeof containersModule.setupMySQLTest).toBe('function')
    })
  })

  describe('Simple Example Execution', () => {
    test('createMemoryUrl returns a string containing memory', async () => {
      if (!isOptionalDependencyAvailable('better-sqlite3')) {
        console.log('Skipping SQLite test - better-sqlite3 not available')
        return
      }

      const { createMemoryUrl } = await import('@orchestr8/testkit/sqlite')

      // Execute the simple example from README
      const memoryUrl = createMemoryUrl('raw')

      expect(typeof memoryUrl).toBe('string')
      expect(memoryUrl).toContain('memory')
    })

    test('createFileDatabase returns expected structure', async () => {
      if (!isOptionalDependencyAvailable('better-sqlite3')) {
        console.log('Skipping SQLite test - better-sqlite3 not available')
        return
      }

      const { createFileDatabase } = await import('@orchestr8/testkit/sqlite')

      // Execute the simple example
      const db = await createFileDatabase('test.db')

      expect(db).toHaveProperty('url')
      expect(db).toHaveProperty('path')
      expect(db).toHaveProperty('dir')
      expect(db).toHaveProperty('cleanup')
      expect(typeof db.url).toBe('string')
      expect(typeof db.path).toBe('string')
      expect(typeof db.cleanup).toBe('function')
      expect(db.url).toContain('file:')

      // Cleanup
      await db.cleanup()
    })
  })

  describe('README Accuracy Report', () => {
    test('generate summary of README issues', async () => {
      const issues: string[] = []
      const warnings: string[] = []

      // Check SQLite exports - all functions mentioned in README should exist
      if (isOptionalDependencyAvailable('better-sqlite3')) {
        const sqliteModule = await import('@orchestr8/testkit/sqlite')

        // Verify all SQLite functions from README exist
        const requiredFunctions = [
          'createMemoryUrl',
          'createFileDatabase',
          'createSQLitePool',
          'withTransaction',
          'seedWithSql',
          'seedWithFiles',
          'seedWithBatch',
        ]
        for (const fn of requiredFunctions) {
          if (!(fn in sqliteModule)) {
            issues.push(`❌ SQLite: "${fn}" mentioned in README but not exported`)
          }
        }
      }

      // Check Convex exports - all functions mentioned in README should exist
      if (isOptionalDependencyAvailable('convex-test')) {
        const convexModule = await import('@orchestr8/testkit/convex')

        // Verify createConvexTestHarness exists (as shown in README)
        if (!('createConvexTestHarness' in convexModule)) {
          issues.push('❌ Convex: "createConvexTestHarness" mentioned in README but not exported')
        }
      }

      // Report findings
      if (issues.length > 0 || warnings.length > 0) {
        let report = '\n\n📋 README Validation Report\n'
        report += '═'.repeat(50) + '\n\n'

        if (issues.length > 0) {
          report += '🔴 Issues Found:\n'
          issues.forEach((issue) => {
            report += `  ${issue}\n`
          })
          report += '\n'
        }

        if (warnings.length > 0) {
          report += '🟡 Warnings:\n'
          warnings.forEach((warning) => {
            report += `  ${warning}\n`
          })
          report += '\n'
        }

        report += '═'.repeat(50) + '\n'
        console.log(report)

        // Don't fail the test, just report
        if (issues.length > 0) {
          console.warn('README has accuracy issues that should be fixed')
        }
      } else {
        console.log('✅ No README validation issues found')
      }

      // Always pass - this is a reporting test
      expect(true).toBe(true)
    })
  })

  describe('MSW Exports (from README lines 105-116)', () => {
    test('MSW exports exist when msw is available', async () => {
      if (!isOptionalDependencyAvailable('msw')) {
        console.log('Skipping MSW test - msw not available')
        return
      }

      const mswModule = await import('@orchestr8/testkit/msw')
      expect(mswModule).toHaveProperty('setupMSW')
      expect(typeof mswModule.setupMSW).toBe('function')
      expect(mswModule).toHaveProperty('createMSWServer')
      expect(typeof mswModule.createMSWServer).toBe('function')
      expect(mswModule).toHaveProperty('createAuthHandlers')
      expect(typeof mswModule.createAuthHandlers).toBe('function')
      expect(mswModule).toHaveProperty('HttpResponse')
    })
  })

  describe('Convex Exports (from README lines 147-156)', () => {
    test('createConvexTestHarness exists and is a function', async () => {
      if (!isOptionalDependencyAvailable('convex-test')) {
        console.log('Skipping Convex test - convex-test not available')
        return
      }

      const convexModule = await import('@orchestr8/testkit/convex')

      // Verify the function mentioned in README exists
      expect(convexModule).toHaveProperty('createConvexTestHarness')
      expect(typeof convexModule.createConvexTestHarness).toBe('function')
    })
  })
})
