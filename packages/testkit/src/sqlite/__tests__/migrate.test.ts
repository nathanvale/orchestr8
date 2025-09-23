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

  async exec(sql: string): Promise<void> {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage)
    }
    this.executedStatements.push(sql)
  }

  reset() {
    this.executedStatements = []
    this.shouldThrowError = false
    this.errorMessage = 'Mock database error'
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
      // First create some tables via migrations
      const migrationDir = await createManagedTempDirectory({ prefix: 'reset-test-' })
      tempDirs.push(migrationDir)

      const migration = `
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT);
        CREATE TABLE comments (id INTEGER PRIMARY KEY, content TEXT);
      `

      await writeFile(migrationDir.getPath('001_create_tables.sql'), migration)
      await applyMigrations(mockDb, { dir: migrationDir.path })

      // Reset should clear the executed statements tracking and execute reset SQL
      mockDb.reset() // Reset our tracking

      await resetDatabase(mockDb)

      // Should have executed the reset SQL
      expect(mockDb.executedStatements).toHaveLength(1)
      expect(mockDb.executedStatements[0]).toContain('PRAGMA writable_schema')
    })

    it('should handle empty database gracefully', async () => {
      await expect(resetDatabase(mockDb)).resolves.not.toThrow()
      expect(mockDb.executedStatements).toHaveLength(1)
    })

    it('should handle database with only system tables', async () => {
      // SQLite creates system tables automatically, reset should only affect user tables
      await expect(resetDatabase(mockDb)).resolves.not.toThrow()
      expect(mockDb.executedStatements).toHaveLength(1)
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
})
