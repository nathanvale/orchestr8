/**
 * MySQL Container Integration Tests
 * Tests the MySQL Testcontainer helpers and validates all P1 fixes
 */

import { describe, it, expect } from 'vitest'
import * as mysql from 'mysql2/promise'
import {
  createMySQLContainer,
  setupMySQLTest,
  MySQLContainer,
  createMySQLConfig,
  MySQLCharacterSet,
  MySQLSQLMode,
} from '../mysql.js'
import { MySQLCollation } from '../mysql-config.js'
import { IsolationLevel } from '../types.js'

const ENABLE = process.env.TESTCONTAINERS_MYSQL === '1'
const describeIf = ENABLE ? describe : describe.skip

describeIf('MySQL Container Integration', () => {
  describe('createMySQLContainer factory', () => {
    it('should create a MySQL container with the documented API', async () => {
      const result = await createMySQLContainer()

      // Verify the API matches acceptance criteria
      expect(result).toHaveProperty('container')
      expect(result).toHaveProperty('connectionString')
      expect(result).toHaveProperty('stop')

      expect(result.container).toBeInstanceOf(MySQLContainer)
      expect(result.connectionString).toMatch(/^mysql:\/\//)
      expect(typeof result.stop).toBe('function')

      // Verify the container is actually running
      const connection = await mysql.createConnection(result.connectionString)
      const [rows] = await connection.execute('SELECT 1 as result')
      expect(rows).toHaveLength(1)
      expect((rows as Array<{ result: number }>)[0].result).toBe(1)

      await connection.end()
      await result.stop()
    }, 30000)
  })

  describe('setupMySQLTest helper', () => {
    it('should return a properly typed pool instance', async () => {
      const { db, pool, cleanup } = await setupMySQLTest()

      // Verify pool is actually a mysql2 Pool instance
      expect(pool).toBeDefined()
      expect(typeof pool.getConnection).toBe('function')
      expect(typeof pool.end).toBe('function')

      // Verify we can get a connection from the pool
      const connection = await pool.getConnection()
      expect(connection).toBeDefined()
      expect(typeof connection.execute).toBe('function')
      connection.release()

      // Verify db connection works
      const [rows] = await db.execute('SELECT 1 as result')
      expect(rows).toHaveLength(1)

      await cleanup()
    }, 30000)

    it('should support transaction isolation level', async () => {
      const { db, reset, cleanup } = await setupMySQLTest({
        isolationLevel: IsolationLevel.TRANSACTION,
      })

      // Create a test table
      await db.execute(`
        CREATE TABLE test_isolation (
          id INT PRIMARY KEY,
          value VARCHAR(255)
        )
      `)

      // Insert data
      await db.execute('INSERT INTO test_isolation (id, value) VALUES (1, ?)', ['test'])

      // Verify data exists
      const [beforeReset] = await db.execute('SELECT * FROM test_isolation')
      expect(beforeReset).toHaveLength(1)

      // Reset should rollback the transaction
      await reset()

      // Table should still exist but data should be gone after transaction rollback
      const [afterReset] = await db.execute('SELECT * FROM test_isolation')
      expect(afterReset).toHaveLength(0)

      await cleanup()
    }, 30000)
  })

  describe('Pool configuration mapping', () => {
    it('should correctly map pg-style config to mysql2 options', async () => {
      const container = new MySQLContainer(createMySQLConfig())
      await container.start()

      // The pool should be created with MySQL-specific options
      const pool = container.getPool()
      expect(pool).toBeDefined()

      // Verify pool works with MySQL-specific configuration
      const connection = await pool.getConnection()
      const [rows] = await connection.execute('SELECT 1')
      expect(rows).toBeDefined()
      connection.release()

      await container.stop()
    }, 30000)
  })

  describe('Binary logging validation', () => {
    it('should throw error when enableBinLog is true without serverId', () => {
      expect(() => {
        const config = createMySQLConfig({
          enableBinLog: true,
          // serverId is missing
        })
        new MySQLContainer(config)
      }).toThrow('Binary logging requires a non-zero server-id')
    })

    it('should accept valid binlog configuration', async () => {
      const config = createMySQLConfig({
        enableBinLog: true,
        serverId: 1,
      })

      const container = new MySQLContainer(config)
      await container.start()

      // Verify binary logging is enabled
      const connection = await container.getConnection()
      const [rows] = await connection.execute('SHOW VARIABLES LIKE "log_bin"')
      expect(rows).toHaveLength(1)

      connection.release()
      await container.stop()
    }, 30000)
  })

  describe('Collation handling', () => {
    it('should apply collation when specified', async () => {
      const { db, cleanup } = await setupMySQLTest({
        config: {
          connectionOptions: {
            collation: MySQLCollation.UTF8MB4_UNICODE_CI,
          },
        },
      })

      // Verify collation is applied
      const [rows] = await db.execute('SELECT @@collation_connection as collation')
      const result = rows as Array<{ collation: string }>
      expect(result[0].collation).toBe('utf8mb4_unicode_ci')

      await cleanup()
    }, 30000)
  })

  describe('Character set and SQL modes', () => {
    it('should configure character set and SQL modes', async () => {
      const config = createMySQLConfig({
        characterSet: MySQLCharacterSet.UTF8MB4,
        sqlModes: [MySQLSQLMode.STRICT_ALL_TABLES, MySQLSQLMode.NO_ZERO_DATE],
      })

      const container = new MySQLContainer(config)
      await container.start()

      const connection = await container.getConnection()

      // Check character set
      const [charsetRows] = await connection.execute('SELECT @@character_set_server as charset')
      const charsetResult = charsetRows as Array<{ charset: string }>
      expect(charsetResult[0].charset).toBe('utf8mb4')

      // Check SQL mode
      const [modeRows] = await connection.execute('SELECT @@sql_mode as mode')
      const modeResult = modeRows as Array<{ mode: string }>
      expect(modeResult[0].mode).toContain('STRICT_ALL_TABLES')
      expect(modeResult[0].mode).toContain('NO_ZERO_DATE')

      connection.release()
      await container.stop()
    }, 30000)
  })

  describe('Migration support', () => {
    it('should run migrations from SQL files', async () => {
      // Create a test migration file
      const migrationPath = '/tmp/test-migrations'
      const fs = await import('node:fs/promises')
      await fs.mkdir(migrationPath, { recursive: true })
      await fs.writeFile(
        `${migrationPath}/001_create_users.sql`,
        `
        CREATE TABLE users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL
        );
        INSERT INTO users (name, email) VALUES ('Test User', 'test@example.com');
      `,
      )

      const { db, cleanup } = await setupMySQLTest({
        migrations: migrationPath,
      })

      // Verify migration ran
      const [tables] = await db.execute('SHOW TABLES')
      expect(tables).toHaveLength(2) // users and migrations tables

      const [users] = await db.execute('SELECT * FROM users')
      expect(users).toHaveLength(1)

      await cleanup()
      await fs.rm(migrationPath, { recursive: true })
    }, 30000)
  })

  describe('Seeding support', () => {
    it('should seed database with test data', async () => {
      const { db, cleanup } = await setupMySQLTest({
        seed: {
          users: [
            { id: 1, name: 'Alice', email: 'alice@example.com' },
            { id: 2, name: 'Bob', email: 'bob@example.com' },
          ],
        },
      })

      // Create the table first
      await db.execute(`
        CREATE TABLE users (
          id INT PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255)
        )
      `)

      // Re-seed after table creation
      const container = new MySQLContainer(createMySQLConfig())
      await container.start()
      await container.seed({
        data: {
          users: [
            { id: 1, name: 'Alice', email: 'alice@example.com' },
            { id: 2, name: 'Bob', email: 'bob@example.com' },
          ],
        },
      })

      const client = await container.getConnection()
      const [rows] = await client.execute('SELECT * FROM users ORDER BY id')
      expect(rows).toHaveLength(2)

      const users = rows as Array<{ id: number; name: string; email: string }>
      expect(users[0].name).toBe('Alice')
      expect(users[1].name).toBe('Bob')

      client.release()
      await container.stop()
      await cleanup()
    }, 30000)
  })

  describe('Resource tracking and cleanup', () => {
    it('should properly track and cleanup transaction connections', async () => {
      const container = new MySQLContainer(createMySQLConfig())
      await container.start()

      // Begin a transaction
      await container.beginTransaction()

      // Get transaction connection
      const transactionConn = container.getTransactionConnection()
      expect(transactionConn).toBeDefined()

      // Cleanup should release the transaction connection
      await container.stop()

      // Verify container stopped successfully
      expect(container['isStarted']).toBe(false)
    }, 30000)
  })

  describe('Performance settings', () => {
    it('should configure performance settings', async () => {
      const config = createMySQLConfig({
        performance: {
          maxConnections: 50,
          enableSlowQueryLog: true,
          slowQueryTimeThreshold: 1,
        },
      })

      const container = new MySQLContainer(config)
      await container.start()

      const connection = await container.getConnection()

      // Check max connections
      const [maxConnRows] = await connection.execute('SELECT @@max_connections as max_conn')
      const maxConnResult = maxConnRows as Array<{ max_conn: number }>
      expect(maxConnResult[0].max_conn).toBe(50)

      // Check slow query log
      const [slowQueryRows] = await connection.execute('SELECT @@slow_query_log as slow_log')
      const slowQueryResult = slowQueryRows as Array<{ slow_log: number }>
      expect(slowQueryResult[0].slow_log).toBe(1)

      connection.release()
      await container.stop()
    }, 30000)
  })
})
