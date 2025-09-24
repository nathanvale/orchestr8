/**
 * Example 5: Prisma ORM Integration
 *
 * This example demonstrates how to use the SQLite helpers with Prisma ORM,
 * including proper connection pooling configuration for tests.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import {
  createPrismaMemoryConfig,
  createPrismaFileConfig,
  setPrismaTestEnv,
  applyRecommendedPragmas,
} from '@template/testkit/sqlite'

// Mock Prisma Client (in real usage, import from '@prisma/client')
interface PrismaClient {
  $connect(): Promise<void>
  $disconnect(): Promise<void>
  $executeRaw(sql: TemplateStringsArray, ...values: unknown[]): Promise<number>
  $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number>
  $queryRaw<T = unknown>(sql: TemplateStringsArray, ...values: unknown[]): Promise<T[]>
  $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]): Promise<T[]>
}

// Mock constructor
declare function createPrismaClient(config: {
  datasources?: { db?: { url: string } }
}): PrismaClient

describe('Prisma Integration', () => {
  describe('In-Memory Database', () => {
    let prisma: PrismaClient
    let resetEnv: () => void

    beforeEach(async () => {
      // Configure Prisma for in-memory SQLite
      const config = createPrismaMemoryConfig({
        connectionLimit: 1, // Disable pooling for unit tests
      })

      // Set environment variables
      resetEnv = setPrismaTestEnv(config)

      // Create Prisma client with config
      prisma = createPrismaClient({
        datasources: {
          db: { url: config.url },
        },
      })

      await prisma.$connect()

      // Create schema (normally done via Prisma migrations)
      await prisma.$executeRawUnsafe(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT,
          author_id INTEGER NOT NULL,
          published BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (author_id) REFERENCES users(id)
        );
      `)
    })

    afterEach(async () => {
      await prisma.$disconnect()
      resetEnv() // Restore original environment
    })

    test('should create and query data', async () => {
      // Insert user
      await prisma.$executeRaw`
        INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice')
      `

      // Query user
      const users = await prisma.$queryRaw<{ id: number; email: string; name: string }[]>`
        SELECT id, email, name FROM users WHERE email = 'alice@example.com'
      `

      expect(users).toHaveLength(1)
      expect(users[0].name).toBe('Alice')
    })

    test('should handle transactions', async () => {
      // Prisma automatically handles transactions with $transaction
      // But for raw SQL, we can use manual transactions
      await prisma.$executeRawUnsafe('BEGIN')

      try {
        await prisma.$executeRaw`
          INSERT INTO users (email, name) VALUES ('bob@example.com', 'Bob')
        `

        const user = await prisma.$queryRaw<{ id: number }[]>`
          SELECT id FROM users WHERE email = 'bob@example.com'
        `

        await prisma.$executeRaw`
          INSERT INTO posts (title, content, author_id)
          VALUES ('First Post', 'Content', ${user[0].id})
        `

        await prisma.$executeRawUnsafe('COMMIT')
      } catch (error) {
        await prisma.$executeRawUnsafe('ROLLBACK')
        throw error
      }

      const posts = await prisma.$queryRaw<{ title: string }[]>`
        SELECT title FROM posts
      `
      expect(posts).toHaveLength(1)
    })
  })

  describe('File Database with Cleanup', () => {
    let prisma: PrismaClient
    let cleanup: () => Promise<void>
    let resetEnv: () => void

    beforeEach(async () => {
      // Create file-based config with automatic cleanup
      const config = await createPrismaFileConfig('test.db', {
        connectionLimit: 1,
      })

      cleanup = config.cleanup
      resetEnv = setPrismaTestEnv(config)

      prisma = createPrismaClient({
        datasources: {
          db: { url: config.url },
        },
      })

      await prisma.$connect()

      // Apply pragmas for file database
      await applyRecommendedPragmas(prisma as unknown, {
        busyTimeoutMs: 5000,
      })

      // Setup schema
      await prisma.$executeRawUnsafe(`
        CREATE TABLE products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          stock INTEGER DEFAULT 0
        );
      `)
    })

    afterEach(async () => {
      await prisma.$disconnect()
      await cleanup() // Clean up temp directory
      resetEnv()
    })

    test('should persist data in file database', async () => {
      // Insert products
      await prisma.$executeRaw`
        INSERT INTO products (name, price, stock) VALUES
          ('Product A', 19.99, 100),
          ('Product B', 29.99, 50),
          ('Product C', 39.99, 25)
      `

      // Query with aggregation
      const stats = await prisma.$queryRaw<{ total_products: number; total_value: number }[]>`
        SELECT
          COUNT(*) as total_products,
          SUM(price * stock) as total_value
        FROM products
      `

      expect(stats[0].total_products).toBe(3)
      expect(stats[0].total_value).toBeGreaterThan(0)
    })

    test('should handle complex queries', async () => {
      // Insert test data
      await prisma.$executeRaw`
        INSERT INTO products (name, price, stock) VALUES
          ('Laptop', 999.99, 10),
          ('Mouse', 29.99, 100),
          ('Keyboard', 79.99, 50)
      `

      // Complex query with filtering and sorting
      const expensiveProducts = await prisma.$queryRaw<
        { name: string; price: number; stock_value: number }[]
      >`
        SELECT
          name,
          price,
          price * stock as stock_value
        FROM products
        WHERE price > 50
        ORDER BY price DESC
      `

      expect(expensiveProducts).toHaveLength(2)
      expect(expensiveProducts[0].name).toBe('Laptop')
      expect(expensiveProducts[1].name).toBe('Keyboard')
    })
  })
})

/**
 * Prisma Configuration Best Practices for Testing
 */
export const prismaBestPractices = {
  // 1. Disable connection pooling for unit tests
  unitTestConfig: {
    datasourceUrl: 'file:memory?mode=memory&cache=shared&connection_limit=1',
  },

  // 2. Use file databases for integration tests
  integrationTestConfig: async () => {
    const config = await createPrismaFileConfig('integration.db', {
      connectionLimit: 5, // Allow some pooling for integration tests
    })
    return config
  },

  // 3. Handle schema in tests (without migrations)
  testSchema: async (prisma: PrismaClient) => {
    // Option 1: Raw SQL
    await prisma.$executeRawUnsafe('CREATE TABLE ...')

    // Option 2: Use migration files
    // await prisma.$executeRawUnsafe(readFileSync('schema.sql', 'utf-8'))

    // Option 3: Use Prisma migrate in test mode
    // execSync('npx prisma migrate deploy')
  },

  // 4. Clean up properly
  cleanup: async (prisma: PrismaClient) => {
    // Always disconnect first
    await prisma.$disconnect()
    // Then cleanup files/env
  },

  // 5. Isolate tests
  isolation: {
    // Each test gets fresh database
    perTest: 'Create new database in beforeEach',
    // Shared database with transactions
    withTransactions: 'Use $transaction for isolation',
    // Reset between tests
    withReset: 'Drop and recreate tables',
  },
}
