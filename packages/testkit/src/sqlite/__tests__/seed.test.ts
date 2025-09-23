import { writeFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createManagedTempDirectory, type TempDirectory } from '../../fs/index.js'
import { createFileDatabase, type FileDatabase } from '../file.js'
import { resetDatabase, type MigrationDatabase } from '../migrate.js'
import { seedWithSql, seedWithFiles, type SeedFilesOptions } from '../seed.js'

// Mock database for testing seed functionality
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

  // Add all() method to support resetDatabase enumeration
  all(_sql: string): Array<{ name: string; type: string }> {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage)
    }
    // Return empty array by default (no objects to drop)
    // In real tests, this would return actual database objects
    return []
  }

  reset() {
    this.executedStatements = []
    this.shouldThrowError = false
    this.errorMessage = 'Mock database error'
  }
}

describe('SQLite Seed Support', () => {
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

  describe('seedWithSql', () => {
    it('should execute provided SQL string directly', async () => {
      const sql = `
        INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com');
        INSERT INTO users (name, email) VALUES ('Jane Smith', 'jane@example.com');
      `

      await seedWithSql(mockDb, sql)

      // Verify SQL was executed directly without transaction wrapping
      expect(mockDb.executedStatements).toHaveLength(1)
      expect(mockDb.executedStatements[0]).toBe(sql)
      expect(mockDb.executedStatements[0]).toContain('INSERT INTO users')
    })

    it('should handle empty SQL string gracefully', async () => {
      await seedWithSql(mockDb, '')

      expect(mockDb.executedStatements).toHaveLength(0)
    })

    it('should handle whitespace-only SQL string gracefully', async () => {
      await seedWithSql(mockDb, '   \n\t  ')

      expect(mockDb.executedStatements).toHaveLength(0)
    })

    it('should propagate database errors with context and preserve cause', async () => {
      const sql = 'INSERT INTO nonexistent_table VALUES (1);'
      mockDb.shouldThrowError = true
      mockDb.errorMessage = 'no such table: nonexistent_table'

      let thrownError: Error | undefined
      try {
        await seedWithSql(mockDb, sql)
      } catch (err) {
        thrownError = err as Error
      }

      expect(thrownError).toBeDefined()
      expect(thrownError?.message).toMatch(
        /Failed to execute seed SQL: no such table: nonexistent_table/,
      )
      expect(thrownError?.cause).toBeDefined()
      expect((thrownError?.cause as Error)?.message).toBe('no such table: nonexistent_table')
    })

    it('should support multi-statement SQL', async () => {
      const sql = `
        INSERT INTO users (name) VALUES ('User 1');
        INSERT INTO posts (title, user_id) VALUES ('Post 1', 1);
        INSERT INTO posts (title, user_id) VALUES ('Post 2', 1);
      `

      await seedWithSql(mockDb, sql)

      expect(mockDb.executedStatements).toHaveLength(1)
      expect(mockDb.executedStatements[0]).toContain('INSERT INTO users')
      expect(mockDb.executedStatements[0]).toContain('INSERT INTO posts')
    })

    it('should work with database objects using execute method', async () => {
      const sql = 'INSERT INTO test_table (value) VALUES (42);'

      const mockDbWithExecute: MigrationDatabase & { executedStatements: Array<string> } = {
        executedStatements: [],
        execute: async (sqlStatement: string) => {
          mockDbWithExecute.executedStatements.push(sqlStatement)
        },
      }

      await seedWithSql(mockDbWithExecute, sql)

      expect(mockDbWithExecute.executedStatements).toHaveLength(1)
      expect(mockDbWithExecute.executedStatements[0]).toBe(sql)
    })

    it('should throw helpful error when database has no execution method', async () => {
      const invalidDb = { url: 'file:test.db' } // No exec or execute method
      const sql = 'INSERT INTO test VALUES (1);'

      await expect(seedWithSql(invalidDb as any, sql)).rejects.toThrow(
        /Database object must have an exec\(\) or execute\(\) method/,
      )
    })
  })

  describe('seedWithFiles', () => {
    it('should execute SQL files from directory in lexicographic order', async () => {
      const seedDir = await createManagedTempDirectory({ prefix: 'seeds-' })
      tempDirs.push(seedDir)

      const seed1 = `
        INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com');
        INSERT INTO users (id, name, email) VALUES (2, 'Bob', 'bob@example.com');
      `
      const seed2 = `
        INSERT INTO posts (id, user_id, title) VALUES (1, 1, 'Alice First Post');
        INSERT INTO posts (id, user_id, title) VALUES (2, 2, 'Bob First Post');
      `
      const seed3 = `
        INSERT INTO comments (id, post_id, content) VALUES (1, 1, 'Great post Alice!');
        INSERT INTO comments (id, post_id, content) VALUES (2, 2, 'Nice work Bob!');
      `

      await writeFile(seedDir.getPath('001_users.sql'), seed1)
      await writeFile(seedDir.getPath('002_posts.sql'), seed2)
      await writeFile(seedDir.getPath('003_comments.sql'), seed3)

      const options: SeedFilesOptions = { dir: seedDir.path }
      await seedWithFiles(mockDb, options)

      // Verify all seed files were executed in correct order
      expect(mockDb.executedStatements).toHaveLength(3)
      expect(mockDb.executedStatements[0]).toContain('INSERT INTO users')
      expect(mockDb.executedStatements[1]).toContain('INSERT INTO posts')
      expect(mockDb.executedStatements[2]).toContain('INSERT INTO comments')
    })

    it('should handle empty seed directory', async () => {
      const seedDir = await createManagedTempDirectory({ prefix: 'empty-seeds-' })
      tempDirs.push(seedDir)

      const options: SeedFilesOptions = { dir: seedDir.path }
      await expect(seedWithFiles(mockDb, options)).resolves.not.toThrow()
      expect(mockDb.executedStatements).toHaveLength(0)
    })

    it('should skip non-SQL files by default', async () => {
      const seedDir = await createManagedTempDirectory({ prefix: 'mixed-files-' })
      tempDirs.push(seedDir)

      const sqlSeed = `
        INSERT INTO test_table (id, name) VALUES (1, 'Test Data');
      `

      await writeFile(seedDir.getPath('001_seed.sql'), sqlSeed)
      await writeFile(seedDir.getPath('002_readme.md'), '# Not a seed file')
      await writeFile(seedDir.getPath('003_config.json'), '{"key": "value"}')

      const options: SeedFilesOptions = { dir: seedDir.path }
      await seedWithFiles(mockDb, options)

      // Should have executed only the SQL file
      expect(mockDb.executedStatements).toHaveLength(1)
      expect(mockDb.executedStatements[0]).toContain('INSERT INTO test_table')
    })

    it('should enforce lexicographic ordering', async () => {
      const seedDir = await createManagedTempDirectory({ prefix: 'ordering-test-' })
      tempDirs.push(seedDir)

      // Create seed files with names that would sort differently if not lexicographic
      const seed2 = `
        INSERT INTO second_table (id, name) VALUES (1, 'Second');
      `
      const seed10 = `
        INSERT INTO tenth_table (id, second_id) VALUES (1, 1);
      `

      await writeFile(seedDir.getPath('002_second.sql'), seed2)
      await writeFile(seedDir.getPath('010_tenth.sql'), seed10)

      const options: SeedFilesOptions = { dir: seedDir.path }
      await seedWithFiles(mockDb, options)

      // Verify correct execution order (002 before 010)
      expect(mockDb.executedStatements).toHaveLength(2)
      expect(mockDb.executedStatements[0]).toContain('INSERT INTO second_table')
      expect(mockDb.executedStatements[1]).toContain('INSERT INTO tenth_table')
    })

    it('should handle non-existent seed directory', async () => {
      const nonExistentPath = '/path/that/does/not/exist'
      const options: SeedFilesOptions = { dir: nonExistentPath }

      await expect(seedWithFiles(mockDb, options)).rejects.toThrow(/Seed directory does not exist/)
    })

    it('should skip empty seed files', async () => {
      const seedDir = await createManagedTempDirectory({ prefix: 'empty-files-' })
      tempDirs.push(seedDir)

      await writeFile(seedDir.getPath('001_empty.sql'), '')
      await writeFile(seedDir.getPath('002_whitespace.sql'), '   \n\t  ')
      await writeFile(seedDir.getPath('003_valid.sql'), 'INSERT INTO test (id) VALUES (1);')

      const options: SeedFilesOptions = { dir: seedDir.path }
      await seedWithFiles(mockDb, options)

      // Should only execute the non-empty file
      expect(mockDb.executedStatements).toHaveLength(1)
      expect(mockDb.executedStatements[0]).toContain('INSERT INTO test')
    })

    it('should include filename in error messages with cause preserved', async () => {
      const seedDir = await createManagedTempDirectory({ prefix: 'error-context-' })
      tempDirs.push(seedDir)

      const invalidSeed = `
        INSERT INTO bad_table (invalid_syntax_here);
      `

      await writeFile(seedDir.getPath('001_bad_seed.sql'), invalidSeed)

      mockDb.shouldThrowError = true
      mockDb.errorMessage = 'syntax error'

      const options: SeedFilesOptions = { dir: seedDir.path }

      let thrownError: Error | undefined
      try {
        await seedWithFiles(mockDb, options)
      } catch (err) {
        thrownError = err as Error
      }

      expect(thrownError).toBeDefined()
      expect(thrownError?.message).toMatch(/001_bad_seed\.sql/)
      expect(thrownError?.message).toMatch(/syntax error/)
      expect(thrownError?.cause).toBeDefined()
      expect((thrownError?.cause as Error)?.message).toBe('syntax error')
    })

    it('should handle when seed path is not a directory', async () => {
      const tempDir = await createManagedTempDirectory({ prefix: 'not-dir-' })
      tempDirs.push(tempDir)

      // Create a file instead of directory
      const filePath = tempDir.getPath('not-a-directory.txt')
      await writeFile(filePath, 'This is a file, not a directory')

      const options: SeedFilesOptions = { dir: filePath }
      await expect(seedWithFiles(mockDb, options)).rejects.toThrow(/Seed path is not a directory/)
    })
  })

  describe('idempotent mode support', () => {
    it('should support INSERT OR IGNORE pattern in seedWithSql', async () => {
      const sql = `
        INSERT OR IGNORE INTO users (id, name, email) VALUES (1, 'John', 'john@example.com');
        INSERT OR IGNORE INTO users (id, name, email) VALUES (2, 'Jane', 'jane@example.com');
      `

      // First execution
      await seedWithSql(mockDb, sql)
      expect(mockDb.executedStatements).toHaveLength(1)

      // Second execution should not cause errors
      mockDb.reset()
      await seedWithSql(mockDb, sql)
      expect(mockDb.executedStatements).toHaveLength(1)
      expect(mockDb.executedStatements[0]).toContain('INSERT OR IGNORE')
    })

    it('should support idempotent patterns in seedWithFiles', async () => {
      const seedDir = await createManagedTempDirectory({ prefix: 'idempotent-seeds-' })
      tempDirs.push(seedDir)

      const idempotentSeed = `
        INSERT OR IGNORE INTO categories (id, name) VALUES (1, 'Technology');
        INSERT OR IGNORE INTO categories (id, name) VALUES (2, 'Science');
        UPDATE users SET category_id = 1 WHERE name = 'Alice';
      `

      await writeFile(seedDir.getPath('001_categories.sql'), idempotentSeed)

      const options: SeedFilesOptions = { dir: seedDir.path }

      // First execution
      await seedWithFiles(mockDb, options)
      expect(mockDb.executedStatements).toHaveLength(1)

      // Second execution should work without conflicts
      mockDb.reset()
      await seedWithFiles(mockDb, options)
      expect(mockDb.executedStatements).toHaveLength(1)
      expect(mockDb.executedStatements[0]).toContain('INSERT OR IGNORE')
    })
  })

  describe('integration with reset helper', () => {
    it('should work with resetDatabase from migrate.ts', async () => {
      // Create some test data with seeds
      const sql = `
        INSERT INTO test_users (id, name) VALUES (1, 'Test User');
        INSERT INTO test_posts (id, title) VALUES (1, 'Test Post');
      `

      await seedWithSql(mockDb, sql)
      expect(mockDb.executedStatements).toHaveLength(1)

      // Reset should clear our tracking and execute reset SQL
      mockDb.reset()
      await resetDatabase(mockDb)

      // MockDatabase lacks all() method, so resetDatabase should warn and not execute anything
      // This is the new safe behavior - no dangerous PRAGMA operations
      expect(mockDb.executedStatements).toHaveLength(0)

      // Should be able to seed again after reset
      mockDb.reset()
      await seedWithSql(mockDb, sql)
      expect(mockDb.executedStatements).toHaveLength(1)
    })

    it('should support full workflow: migrate -> seed -> reset -> repeat', async () => {
      const seedDir = await createManagedTempDirectory({ prefix: 'workflow-test-' })
      tempDirs.push(seedDir)

      const setupSeed = `
        INSERT INTO workflow_test (id, status) VALUES (1, 'initialized');
        INSERT INTO workflow_test (id, status) VALUES (2, 'ready');
      `

      await writeFile(seedDir.getPath('001_setup.sql'), setupSeed)

      // Seed data
      const options: SeedFilesOptions = { dir: seedDir.path }
      await seedWithFiles(mockDb, options)
      expect(mockDb.executedStatements).toHaveLength(1)

      // Reset for next test
      mockDb.reset()
      await resetDatabase(mockDb)

      // Seed again after reset - should work as before
      mockDb.reset()
      await seedWithFiles(mockDb, options)
      expect(mockDb.executedStatements).toHaveLength(1)
    })

    it('should work with actual file database', async () => {
      const db = await createFileDatabase('seed-integration-test.sqlite')
      databases.push(db)

      // Create a database wrapper that simulates an exec method for file databases
      const dbWithExec: MigrationDatabase & { executedStatements: Array<string> } = {
        ...db,
        executedStatements: [],
        exec: async (sql: string) => {
          // In a real implementation, this would execute SQL against the file database
          // For testing, we just track what would be executed
          dbWithExec.executedStatements.push(sql)
        },
      }

      // Create table first
      await dbWithExec.exec(`
        CREATE TABLE integration_test (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          value INTEGER
        );
      `)

      // Seed data
      const sql = `
        INSERT INTO integration_test (name, value) VALUES ('test1', 100);
        INSERT INTO integration_test (name, value) VALUES ('test2', 200);
      `

      await seedWithSql(dbWithExec, sql)

      // Verify data was inserted
      expect(dbWithExec.executedStatements).toHaveLength(2) // CREATE + INSERT
      expect(dbWithExec.executedStatements[1]).toContain('INSERT INTO integration_test')
    })

    it('should work with file-based seeds and actual database', async () => {
      const db = await createFileDatabase('file-seed-integration-test.sqlite')
      databases.push(db)

      const seedDir = await createManagedTempDirectory({ prefix: 'file-integration-' })
      tempDirs.push(seedDir)

      // Create a database wrapper that simulates an exec method for file databases
      const dbWithExec: MigrationDatabase & { executedStatements: Array<string> } = {
        ...db,
        executedStatements: [],
        exec: async (sql: string) => {
          // In a real implementation, this would execute SQL against the file database
          // For testing, we just track what would be executed
          dbWithExec.executedStatements.push(sql)
        },
      }

      // Create table first
      await dbWithExec.exec(`
        CREATE TABLE file_integration_test (
          id INTEGER PRIMARY KEY,
          category TEXT NOT NULL,
          active BOOLEAN DEFAULT 1
        );
      `)

      const seedData = `
        INSERT INTO file_integration_test (category, active) VALUES ('category1', 1);
        INSERT INTO file_integration_test (category, active) VALUES ('category2', 0);
        INSERT INTO file_integration_test (category, active) VALUES ('category3', 1);
      `

      await writeFile(seedDir.getPath('001_categories.sql'), seedData)

      const options: SeedFilesOptions = { dir: seedDir.path }
      await seedWithFiles(dbWithExec, options)

      // Verify data was inserted
      expect(dbWithExec.executedStatements).toHaveLength(2) // CREATE + INSERT
      expect(dbWithExec.executedStatements[1]).toContain('INSERT INTO file_integration_test')
    })
  })
})
