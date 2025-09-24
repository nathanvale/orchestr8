import { writeFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createManagedTempDirectory, type TempDirectory } from '../../fs/index.js'
import { createFileDatabase, type FileDatabase } from '../file.js'
import {
  applyMigrations,
  resetDatabase,
  type MigrationDatabase,
  type MigrationOptions,
} from '../migrate.js'

// Mock database for testing migration functionality
class MockDatabase implements MigrationDatabase {
  public executedStatements: string[] = []
  public shouldThrowError = false
  public errorMessage = 'Mock database error'
  public mockTables: Array<{ name: string; type: string }> = []

  async exec(sql: string): Promise<void> {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage)
    }
    this.executedStatements.push(sql)
  }

  all(sql: string): Array<{ name: string; type: string }> {
    // Return mock tables for resetDatabase queries
    if (sql.includes('sqlite_master')) {
      return this.mockTables
    }
    return []
  }

  reset() {
    this.executedStatements = []
    this.shouldThrowError = false
    this.errorMessage = 'Mock database error'
    this.mockTables = []
  }
}
describe('SQLite Migration Support', () => {
  let databases: Array<FileDatabase> = []
  let tempDirs: Array<TempDirectory> = []
  let mockDb: MockDatabase

  beforeEach(() => {
    databases = []
    tempDirs = []
    mockDb = new MockDatabase()
  })

  afterEach(async () => {
    // Clean up all databases and temp directories
    for (const db of databases) {
      try {
        await db.cleanup()
      } catch (err) {
        console.warn('Failed to cleanup database:', err)
      }
    }
    for (const dir of tempDirs) {
      try {
        await dir.cleanup()
      } catch (err) {
        console.warn('Failed to cleanup temp directory:', err)
      }
    }
  })

  describe('applyMigrations', () => {
    it('should apply migrations from SQL files in lexicographic order', async () => {
      // Create migration directory with SQL files
      const migrationDir = await createManagedTempDirectory({ prefix: 'migrations-' })
      tempDirs.push(migrationDir)

      const migration1 = `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `
      const migration2 = `
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          title TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `
      const migration3 = `
        ALTER TABLE users ADD COLUMN email TEXT;
      `

      await writeFile(migrationDir.getPath('001_create_users.sql'), migration1)
      await writeFile(migrationDir.getPath('002_create_posts.sql'), migration2)
      await writeFile(migrationDir.getPath('003_add_user_email.sql'), migration3)

      // Apply migrations
      await applyMigrations(mockDb, { dir: migrationDir.path })

      // Verify all migrations were executed in correct order
      expect(mockDb.executedStatements).toHaveLength(3)
      expect(mockDb.executedStatements[0]).toContain('CREATE TABLE users')
      expect(mockDb.executedStatements[1]).toContain('CREATE TABLE posts')
      expect(mockDb.executedStatements[2]).toContain('ALTER TABLE users ADD COLUMN email')
    })

    it('should handle empty migration directory', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'empty-migrations-' })
      tempDirs.push(migrationDir)

      await expect(applyMigrations(mockDb, { dir: migrationDir.path })).resolves.not.toThrow()
      expect(mockDb.executedStatements).toHaveLength(0)
    })

    it('should support custom glob patterns', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'custom-glob-' })
      tempDirs.push(migrationDir)

      const migration = `
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT
        );
      `

      await writeFile(migrationDir.getPath('migration_001.sql'), migration)
      await writeFile(migrationDir.getPath('not_a_migration.txt'), 'ignored')
      await writeFile(
        migrationDir.getPath('migration_002.sql'),
        'CREATE TABLE another (id INTEGER);',
      )

      const options: MigrationOptions = {
        dir: migrationDir.path,
        glob: 'migration_*.sql',
      }

      await applyMigrations(mockDb, options)

      // Should have executed only the SQL files matching the pattern
      expect(mockDb.executedStatements).toHaveLength(2)
      expect(mockDb.executedStatements[0]).toContain('CREATE TABLE test_table')
      expect(mockDb.executedStatements[1]).toContain('CREATE TABLE another')
    })

    it('should run each migration file in its own transaction', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'transaction-test-' })
      tempDirs.push(migrationDir)

      const validMigration = `
        CREATE TABLE valid_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `
      const invalidMigration = `
        CREATE TABLE invalid_table (
          id INTEGER PRIMARY KEY,
          invalid_syntax_here
        );
      `
      const anotherValidMigration = `
        CREATE TABLE another_valid_table (
          id INTEGER PRIMARY KEY,
          description TEXT
        );
      `

      await writeFile(migrationDir.getPath('001_valid.sql'), validMigration)
      await writeFile(migrationDir.getPath('002_invalid.sql'), invalidMigration)
      await writeFile(migrationDir.getPath('003_another_valid.sql'), anotherValidMigration)

      // Configure mock to throw error on second execution (invalid migration)
      let callCount = 0
      mockDb.exec = async (sql: string) => {
        callCount++
        if (callCount === 2) {
          throw new Error('syntax error near "invalid_syntax_here"')
        }
        mockDb.executedStatements.push(sql)
      }

      // This should fail on the invalid migration
      await expect(applyMigrations(mockDb, { dir: migrationDir.path })).rejects.toThrow()

      // First migration executed atomically; failure triggers a rollback
      expect(mockDb.executedStatements).toHaveLength(2)
      expect(mockDb.executedStatements[0]).toContain('CREATE TABLE valid_table')
      expect(mockDb.executedStatements[1]).toMatch(/ROLLBACK;/)
    })

    it('should include filename in error messages', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'error-context-' })
      tempDirs.push(migrationDir)

      const invalidMigration = `
        CREATE TABLE bad_table (
          invalid syntax here
        );
      `

      await writeFile(migrationDir.getPath('001_bad_migration.sql'), invalidMigration)

      mockDb.shouldThrowError = true
      mockDb.errorMessage = 'syntax error'

      await expect(applyMigrations(mockDb, { dir: migrationDir.path })).rejects.toThrow(
        /001_bad_migration\.sql/,
      )
      await expect(applyMigrations(mockDb, { dir: migrationDir.path })).rejects.toThrow(
        /syntax error/,
      )
    })

    it('should enforce lexicographic ordering', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'ordering-test-' })
      tempDirs.push(migrationDir)

      // Create migrations with names that would sort differently if not lexicographic
      const migration2 = `
        CREATE TABLE created_second (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `
      const migration10 = `
        CREATE TABLE created_tenth (
          id INTEGER PRIMARY KEY,
          second_id INTEGER,
          FOREIGN KEY (second_id) REFERENCES created_second(id)
        );
      `

      await writeFile(migrationDir.getPath('002_second.sql'), migration2)
      await writeFile(migrationDir.getPath('010_tenth.sql'), migration10)

      await applyMigrations(mockDb, { dir: migrationDir.path })

      // Verify correct execution order (002 before 010)
      expect(mockDb.executedStatements).toHaveLength(2)
      expect(mockDb.executedStatements[0]).toContain('CREATE TABLE created_second')
      expect(mockDb.executedStatements[1]).toContain('CREATE TABLE created_tenth')
    })

    it('should handle non-existent migration directory', async () => {
      const nonExistentPath = '/path/that/does/not/exist'

      await expect(applyMigrations(mockDb, { dir: nonExistentPath })).rejects.toThrow(
        /Migration directory does not exist/,
      )
    })

    it('should skip non-SQL files by default', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'skip-non-sql-' })
      tempDirs.push(migrationDir)

      const sqlMigration = `
        CREATE TABLE only_table (
          id INTEGER PRIMARY KEY
        );
      `

      await writeFile(migrationDir.getPath('001_migration.sql'), sqlMigration)
      await writeFile(migrationDir.getPath('002_readme.md'), '# Not a migration')
      await writeFile(migrationDir.getPath('003_config.json'), '{}')

      await applyMigrations(mockDb, { dir: migrationDir.path })

      // Should have executed only the SQL file
      expect(mockDb.executedStatements).toHaveLength(1)
      expect(mockDb.executedStatements[0]).toContain('CREATE TABLE only_table')
    })

    it('should handle database objects without exec methods', async () => {
      const invalidDb = { url: 'file:test.db' } // No exec method

      const migrationDir = await createManagedTempDirectory({ prefix: 'invalid-db-' })
      tempDirs.push(migrationDir)

      const migration = 'CREATE TABLE test (id INTEGER);'
      await writeFile(migrationDir.getPath('001_test.sql'), migration)

      await expect(applyMigrations(invalidDb as any, { dir: migrationDir.path })).rejects.toThrow(
        /Database object must have an exec\(\) or execute\(\) method/,
      )
    })

    it('should handle when migration path is not a directory', async () => {
      const tempDir = await createManagedTempDirectory({ prefix: 'not-dir-' })
      tempDirs.push(tempDir)

      // Create a file instead of directory
      const filePath = tempDir.getPath('not-a-directory.txt')
      await writeFile(filePath, 'This is a file, not a directory')

      await expect(applyMigrations(mockDb, { dir: filePath })).rejects.toThrow(
        /Migration path is not a directory/,
      )
    })

    it('should skip empty migration files', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'empty-files-' })
      tempDirs.push(migrationDir)

      await writeFile(migrationDir.getPath('001_empty.sql'), '')
      await writeFile(migrationDir.getPath('002_whitespace.sql'), '   \n\t  ')
      await writeFile(migrationDir.getPath('003_valid.sql'), 'CREATE TABLE test (id INTEGER);')

      await applyMigrations(mockDb, { dir: migrationDir.path })

      // Should only execute the non-empty file
      expect(mockDb.executedStatements).toHaveLength(1)
      expect(mockDb.executedStatements[0]).toContain('CREATE TABLE test')
    })

    it('should support execute method as alternative to exec', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'execute-method-' })
      tempDirs.push(migrationDir)

      const migration = 'CREATE TABLE execute_test (id INTEGER);'
      await writeFile(migrationDir.getPath('001_execute.sql'), migration)

      // Create a mock that uses execute instead of exec
      const mockDbWithExecute: MigrationDatabase & { executedStatements: Array<string> } = {
        executedStatements: [] as Array<string>,
        execute: async (sql: string) => {
          mockDbWithExecute.executedStatements.push(sql)
        },
      }

      await applyMigrations(mockDbWithExecute, { dir: migrationDir.path })
      expect(mockDbWithExecute.executedStatements).toHaveLength(1)
      expect(mockDbWithExecute.executedStatements[0]).toContain('CREATE TABLE execute_test')
    })
  })

  describe('resetDatabase', () => {
    it('should drop all tables in the database', async () => {
      // Set up mock tables that would be returned by sqlite_master query
      mockDb.mockTables = [
        { name: 'users', type: 'table' },
        { name: 'posts', type: 'table' },
        { name: 'comments', type: 'table' },
      ]

      await resetDatabase(mockDb)

      // Should have executed foreign key management and DROP statements
      expect(mockDb.executedStatements).toHaveLength(3)
      expect(mockDb.executedStatements[0]).toBe('PRAGMA foreign_keys=OFF;')
      expect(mockDb.executedStatements[1]).toContain('DROP TABLE IF EXISTS')
      expect(mockDb.executedStatements[1]).toContain('users')
      expect(mockDb.executedStatements[1]).toContain('posts')
      expect(mockDb.executedStatements[1]).toContain('comments')
      expect(mockDb.executedStatements[1]).not.toContain('PRAGMA writable_schema')
      expect(mockDb.executedStatements[2]).toBe('PRAGMA foreign_keys=ON;')
    })

    it('should handle empty database gracefully', async () => {
      // No mock tables = empty database
      mockDb.mockTables = []

      await expect(resetDatabase(mockDb)).resolves.not.toThrow()
      // No tables to drop = no SQL executed
      expect(mockDb.executedStatements).toHaveLength(0)
    })

    it('should handle database with only system tables', async () => {
      // System tables are filtered out by the sqlite_master query
      mockDb.mockTables = []

      await expect(resetDatabase(mockDb)).resolves.not.toThrow()
      // No user tables to drop = no SQL executed
      expect(mockDb.executedStatements).toHaveLength(0)
    })

    it('should support disableForeignKeys option', async () => {
      // Set up mock tables
      mockDb.mockTables = [
        { name: 'users', type: 'table' },
        { name: 'posts', type: 'table' },
      ]

      // Test with disableForeignKeys: false
      await resetDatabase(mockDb, { disableForeignKeys: false })
      expect(mockDb.executedStatements).toHaveLength(1)
      expect(mockDb.executedStatements[0]).toContain('DROP TABLE IF EXISTS')
      expect(mockDb.executedStatements[0]).toContain('users')
      expect(mockDb.executedStatements[0]).toContain('posts')
      expect(mockDb.executedStatements[0]).not.toContain('PRAGMA foreign_keys')

      // Reset and test with disableForeignKeys: true (default)
      mockDb.reset()
      mockDb.mockTables = [
        { name: 'users', type: 'table' },
        { name: 'posts', type: 'table' },
      ]

      await resetDatabase(mockDb, { disableForeignKeys: true })
      expect(mockDb.executedStatements).toHaveLength(3)
      expect(mockDb.executedStatements[0]).toBe('PRAGMA foreign_keys=OFF;')
      expect(mockDb.executedStatements[1]).toContain('DROP TABLE IF EXISTS')
      expect(mockDb.executedStatements[2]).toBe('PRAGMA foreign_keys=ON;')
    })
  })
  describe('integration patterns', () => {
    it('should support test setup and teardown workflow', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'workflow-test-' })
      tempDirs.push(migrationDir)

      // Setup: Apply initial schema
      const schemaMigration = `
        CREATE TABLE test_data (
          id INTEGER PRIMARY KEY,
          value TEXT NOT NULL
        );
      `

      await writeFile(migrationDir.getPath('001_setup.sql'), schemaMigration)
      await applyMigrations(mockDb, { dir: migrationDir.path })
      expect(mockDb.executedStatements).toHaveLength(1)

      // Test would insert data here
      // ...

      // Teardown: Reset for next test
      mockDb.reset()
      await resetDatabase(mockDb)

      // Should be able to reapply migrations after reset
      mockDb.reset()
      await applyMigrations(mockDb, { dir: migrationDir.path })
      expect(mockDb.executedStatements).toHaveLength(1)
    })

    it('should work with file database URLs', async () => {
      const db = await createFileDatabase('url-test.sqlite')
      databases.push(db)

      // Create a mock that has a URL like file databases and its own exec
      const mockDbWithUrl: MigrationDatabase & { executedStatements: Array<string> } = {
        url: db.url,
        executedStatements: [],
        exec: async (sql: string) => {
          mockDbWithUrl.executedStatements.push(sql)
        },
      }

      const migrationDir = await createManagedTempDirectory({ prefix: 'url-test-' })
      tempDirs.push(migrationDir)

      const migration = `
        CREATE TABLE url_test (
          id INTEGER PRIMARY KEY,
          url TEXT NOT NULL
        );
      `

      await writeFile(migrationDir.getPath('001_url_test.sql'), migration)

      // Should accept database objects with URLs
      await applyMigrations(mockDbWithUrl, { dir: migrationDir.path })
      expect(mockDbWithUrl.executedStatements).toHaveLength(1)
    })
  })

  describe('checksum validation', () => {
    it('should detect checksum mismatch when migration file is tampered', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'checksum-tamper-' })
      tempDirs.push(migrationDir)

      const originalMigration = `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `

      // Write initial migration file
      await writeFile(migrationDir.getPath('001_create_users.sql'), originalMigration)

      // Apply migration with checksum validation - should create checksum file
      await applyMigrations(mockDb, {
        dir: migrationDir.path,
        validateChecksums: true,
      })

      expect(mockDb.executedStatements).toHaveLength(1)
      expect(mockDb.executedStatements[0]).toContain('CREATE TABLE users')

      // Verify checksum file was created
      const checksumPath = migrationDir.getPath('001_create_users.sql.checksum')
      const checksumExists = await migrationDir.exists('001_create_users.sql.checksum')
      expect(checksumExists).toBe(true)

      // Tamper with the migration file content
      const tamperedMigration = `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT -- This line was added after initial application
        );
      `
      await writeFile(migrationDir.getPath('001_create_users.sql'), tamperedMigration)

      // Reset mock database
      mockDb.reset()

      // Try to apply migrations again with checksum validation
      await expect(
        applyMigrations(mockDb, {
          dir: migrationDir.path,
          validateChecksums: true,
        }),
      ).rejects.toThrow(
        /Migration file '001_create_users\.sql' has been modified after initial application/,
      )

      // Should also mention the checksum mismatch in the error message
      try {
        await applyMigrations(mockDb, {
          dir: migrationDir.path,
          validateChecksums: true,
        })
        expect.fail('Expected checksum validation to fail')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        expect(errorMessage).toMatch(/Expected checksum:/)
        expect(errorMessage).toMatch(/Actual checksum:/)
        expect(errorMessage).toMatch(
          /Modifying applied migrations can lead to inconsistent database states/,
        )
      }

      // Should have executed rollback statements due to checksum failure
      expect(mockDb.executedStatements).toContain('ROLLBACK;')
      // But no migration SQL should have been executed
      expect(mockDb.executedStatements).not.toContain('CREATE TABLE users')
    })

    it('should create checksum files for new migrations', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'new-checksum-' })
      tempDirs.push(migrationDir)

      const migration1 = `
        CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `
      const migration2 = `
        CREATE TABLE orders (
          id INTEGER PRIMARY KEY,
          product_id INTEGER,
          FOREIGN KEY (product_id) REFERENCES products(id)
        );
      `

      await writeFile(migrationDir.getPath('001_products.sql'), migration1)
      await writeFile(migrationDir.getPath('002_orders.sql'), migration2)

      // Apply migrations with checksum validation
      await applyMigrations(mockDb, {
        dir: migrationDir.path,
        validateChecksums: true,
      })

      // Both migrations should execute
      expect(mockDb.executedStatements).toHaveLength(2)

      // Both checksum files should be created
      expect(await migrationDir.exists('001_products.sql.checksum')).toBe(true)
      expect(await migrationDir.exists('002_orders.sql.checksum')).toBe(true)

      // Read checksums and verify they contain hex strings
      const checksum1 = await migrationDir.readFile('001_products.sql.checksum')
      const checksum2 = await migrationDir.readFile('002_orders.sql.checksum')

      expect(checksum1).toMatch(/^[a-f0-9]{64}$/)
      expect(checksum2).toMatch(/^[a-f0-9]{64}$/)
      expect(checksum1).not.toBe(checksum2) // Different files should have different checksums
    })

    it('should validate existing checksums on subsequent runs', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'validate-existing-' })
      tempDirs.push(migrationDir)

      const migration = `
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY,
          name TEXT UNIQUE NOT NULL
        );
      `

      await writeFile(migrationDir.getPath('001_categories.sql'), migration)

      // First run - creates checksum
      await applyMigrations(mockDb, {
        dir: migrationDir.path,
        validateChecksums: true,
      })
      expect(mockDb.executedStatements).toHaveLength(1)

      // Reset mock
      mockDb.reset()

      // Second run - validates existing checksum
      await applyMigrations(mockDb, {
        dir: migrationDir.path,
        validateChecksums: true,
      })

      // Should execute successfully (no checksum errors)
      expect(mockDb.executedStatements).toHaveLength(1)
      expect(mockDb.executedStatements[0]).toContain('CREATE TABLE categories')
    })

    it('should work without checksum validation by default', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'no-checksum-' })
      tempDirs.push(migrationDir)

      const migration = `
        CREATE TABLE no_checksum_table (
          id INTEGER PRIMARY KEY
        );
      `

      await writeFile(migrationDir.getPath('001_no_checksum.sql'), migration)

      // Apply without checksum validation (default)
      await applyMigrations(mockDb, { dir: migrationDir.path })

      expect(mockDb.executedStatements).toHaveLength(1)

      // No checksum file should be created
      expect(await migrationDir.exists('001_no_checksum.sql.checksum')).toBe(false)
    })

    it('should handle custom checksum directory', async () => {
      const migrationDir = await createManagedTempDirectory({ prefix: 'custom-checksum-dir-' })
      const checksumDir = await createManagedTempDirectory({ prefix: 'checksum-storage-' })
      tempDirs.push(migrationDir, checksumDir)

      const migration = `
        CREATE TABLE custom_checksum (
          id INTEGER PRIMARY KEY,
          data TEXT
        );
      `

      await writeFile(migrationDir.getPath('001_custom.sql'), migration)

      // Apply with custom checksum directory
      await applyMigrations(mockDb, {
        dir: migrationDir.path,
        validateChecksums: true,
        checksumDir: checksumDir.path,
      })

      expect(mockDb.executedStatements).toHaveLength(1)

      // Checksum should be in custom directory
      expect(await migrationDir.exists('001_custom.sql.checksum')).toBe(false)
      expect(await checksumDir.exists('001_custom.sql.checksum')).toBe(true)
    })
  })
})
