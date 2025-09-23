# Phase 2 Integration Test Plan

## Overview

This document outlines the integration test strategy for Phase 2 of the SQLite test helpers, which will include actual driver implementations and ORM integrations.

## Test Strategy

### Environment-Gated Testing

All integration tests will be gated by environment variables to keep the core test suite fast and dependency-free:

```typescript
// Only run when SQLITE_DRIVER is set
const skipIfNoDriver = process.env.SQLITE_DRIVER !== 'better-sqlite3'
  ? test.skip
  : test
```

### Test Categories

#### 1. Driver Integration Tests

**Location**: `packages/testkit/src/sqlite/__tests__/integration/better-sqlite3.test.ts`

```typescript
describe.skipIf(!process.env.SQLITE_DRIVER)('better-sqlite3 integration', () => {
  test('memory database connection', async () => {
    const db = await openMemoryDb()
    expect(db.name).toBe('main')

    // Verify basic operations
    const result = db.prepare('SELECT 1 as value').get()
    expect(result.value).toBe(1)

    db.close()
  })

  test('file database with cleanup', async () => {
    const { db, cleanup } = await openFileDb('test.db')

    // Create table
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
    db.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')

    const user = db.prepare('SELECT * FROM users WHERE name = ?').get('Alice')
    expect(user.name).toBe('Alice')

    db.close()
    await cleanup()
  })

  test('transaction adapter implementation', async () => {
    const db = await openMemoryDb()
    const adapter = createBetterSqlite3Adapter()

    // Test rollback
    await expect(
      withTransaction(db, adapter, async (tx) => {
        tx.prepare('CREATE TABLE test (id INTEGER)').run()
        tx.prepare('INSERT INTO test VALUES (1)').run()
        throw new Error('rollback')
      })
    ).rejects.toThrow('rollback')

    // Table should not exist after rollback
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all()
    expect(tables).toHaveLength(0)

    db.close()
  })

  test('pragma application', async () => {
    const db = await openMemoryDb()
    const pragmas = await applyRecommendedPragmas(db)

    expect(pragmas.journal_mode).toBe('wal')
    expect(pragmas.foreign_keys).toBe('on')
    expect(pragmas.busy_timeout).toBeGreaterThan(0)

    // Verify foreign key constraint enforcement
    db.exec(`
      CREATE TABLE parent (id INTEGER PRIMARY KEY);
      CREATE TABLE child (
        id INTEGER PRIMARY KEY,
        parent_id INTEGER,
        FOREIGN KEY (parent_id) REFERENCES parent(id)
      );
    `)

    expect(() => {
      db.prepare('INSERT INTO child (parent_id) VALUES (999)').run()
    }).toThrow(/FOREIGN KEY constraint failed/)

    db.close()
  })
})
```

#### 2. ORM Integration Tests

**Prisma Integration** (`packages/testkit/src/sqlite/__tests__/integration/prisma.test.ts`):

```typescript
describe.skipIf(!process.env.TEST_PRISMA)('Prisma integration', () => {
  let prisma: PrismaClient
  let config: PrismaTestConfig & { cleanup: () => Promise<void> }

  beforeEach(async () => {
    config = await createPrismaFileConfig('test.db')
    prisma = new PrismaClient({
      datasources: { db: { url: config.url } }
    })

    // Run migrations
    await prisma.$executeRawUnsafe(`
      CREATE TABLE User (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT
      )
    `)
  })

  afterEach(async () => {
    await prisma.$disconnect()
    await config.cleanup()
  })

  test('CRUD operations with Prisma', async () => {
    const user = await prisma.user.create({
      data: { email: 'test@example.com', name: 'Test User' }
    })

    expect(user.email).toBe('test@example.com')

    const found = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    })

    expect(found?.name).toBe('Test User')
  })

  test('transaction isolation', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: { email: 'tx@example.com', name: 'Transaction User' }
        })
        throw new Error('rollback')
      })
    ).rejects.toThrow('rollback')

    const count = await prisma.user.count()
    expect(count).toBe(0)
  })
})
```

**Drizzle Integration** (`packages/testkit/src/sqlite/__tests__/integration/drizzle.test.ts`):

```typescript
describe.skipIf(!process.env.TEST_DRIZZLE)('Drizzle integration', () => {
  test('memory database with Drizzle', async () => {
    const url = createMemoryUrl('drizzle-better-sqlite3')
    const sqlite = new Database(url)
    const db = drizzle(sqlite)

    // Define schema
    const users = sqliteTable('users', {
      id: integer('id').primaryKey(),
      name: text('name').notNull(),
    })

    // Create table
    await db.run(sql`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )
    `)

    // Insert and query
    await db.insert(users).values({ id: 1, name: 'Alice' })
    const result = await db.select().from(users).where(eq(users.id, 1))

    expect(result[0].name).toBe('Alice')

    sqlite.close()
  })
})
```

**Kysely Integration** (`packages/testkit/src/sqlite/__tests__/integration/kysely.test.ts`):

```typescript
describe.skipIf(!process.env.TEST_KYSELY)('Kysely integration', () => {
  test('memory database with Kysely', async () => {
    const url = createMemoryUrl('kysely')
    const dialect = new SqliteDialect({
      database: new Database(url)
    })

    const db = new Kysely<Database>({ dialect })

    await db.schema
      .createTable('person')
      .addColumn('id', 'integer', col => col.primaryKey())
      .addColumn('name', 'text', col => col.notNull())
      .execute()

    await db
      .insertInto('person')
      .values({ id: 1, name: 'Alice' })
      .execute()

    const person = await db
      .selectFrom('person')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirst()

    expect(person?.name).toBe('Alice')

    await db.destroy()
  })
})
```

#### 3. Migration Integration Tests

**Location**: `packages/testkit/src/sqlite/__tests__/integration/migrations.test.ts`

```typescript
describe.skipIf(!process.env.SQLITE_DRIVER)('Migration runner integration', () => {
  test('apply SQL migrations in order', async () => {
    const db = await openMemoryDb()

    // Create migration files in temp directory
    const migrations = [
      { name: '001_create_users.sql', sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)' },
      { name: '002_add_email.sql', sql: 'ALTER TABLE users ADD COLUMN email TEXT' },
      { name: '003_add_index.sql', sql: 'CREATE INDEX idx_users_email ON users(email)' },
    ]

    const migrationDir = await createTempDirectory()
    for (const migration of migrations) {
      await migrationDir.writeFile(migration.name, migration.sql)
    }

    // Apply migrations
    await applyMigrations(db, { dir: migrationDir.path })

    // Verify schema
    const columns = db.prepare("PRAGMA table_info('users')").all()
    const columnNames = columns.map(c => c.name)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('name')
    expect(columnNames).toContain('email')

    // Verify index
    const indexes = db.prepare("PRAGMA index_list('users')").all()
    expect(indexes).toContainEqual(
      expect.objectContaining({ name: 'idx_users_email' })
    )

    db.close()
    await migrationDir.cleanup()
  })

  test('migration error handling', async () => {
    const db = await openMemoryDb()
    const migrationDir = await createTempDirectory()

    // Create invalid migration
    await migrationDir.writeFile('001_invalid.sql', 'INVALID SQL SYNTAX HERE')

    await expect(
      applyMigrations(db, { dir: migrationDir.path })
    ).rejects.toThrow(/Migration failed: 001_invalid.sql/)

    db.close()
    await migrationDir.cleanup()
  })
})
```

#### 4. Seed Data Integration Tests

**Location**: `packages/testkit/src/sqlite/__tests__/integration/seeds.test.ts`

```typescript
describe.skipIf(!process.env.SQLITE_DRIVER)('Seed data integration', () => {
  test('seed with SQL strings', async () => {
    const db = await openMemoryDb()

    // Create schema
    db.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL)')

    // Seed data
    await seedWithSql(db, `
      INSERT INTO products (name, price) VALUES
        ('Widget', 9.99),
        ('Gadget', 19.99),
        ('Doohickey', 29.99)
    `)

    const products = db.prepare('SELECT * FROM products').all()
    expect(products).toHaveLength(3)

    db.close()
  })

  test('seed with files', async () => {
    const db = await openMemoryDb()
    const seedDir = await createTempDirectory()

    // Create seed files
    await seedDir.writeFile('001_schema.sql',
      'CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT)'
    )
    await seedDir.writeFile('002_data.sql',
      "INSERT INTO categories (name) VALUES ('Electronics'), ('Books'), ('Clothing')"
    )

    await seedWithFiles(db, { dir: seedDir.path })

    const categories = db.prepare('SELECT * FROM categories').all()
    expect(categories).toHaveLength(3)

    db.close()
    await seedDir.cleanup()
  })

  test('idempotent seeding', async () => {
    const db = await openMemoryDb()

    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE)')

    const seedSql = `
      INSERT OR IGNORE INTO users (id, email) VALUES
        (1, 'user1@example.com'),
        (2, 'user2@example.com')
    `

    // Seed twice - should not fail
    await seedWithSql(db, seedSql, { idempotent: true })
    await seedWithSql(db, seedSql, { idempotent: true })

    const users = db.prepare('SELECT * FROM users').all()
    expect(users).toHaveLength(2)

    db.close()
  })
})
```

## Performance Benchmarks

Create benchmarks to ensure helpers don't introduce significant overhead:

```typescript
describe.skipIf(!process.env.RUN_BENCHMARKS)('Performance benchmarks', () => {
  test('memory database creation speed', async () => {
    const start = performance.now()

    for (let i = 0; i < 1000; i++) {
      const db = await openMemoryDb()
      db.close()
    }

    const duration = performance.now() - start
    expect(duration).toBeLessThan(1000) // Less than 1ms per database
  })

  test('transaction overhead', async () => {
    const db = await openMemoryDb()
    const adapter = createBetterSqlite3Adapter()

    db.exec('CREATE TABLE bench (id INTEGER, value TEXT)')

    const directStart = performance.now()
    for (let i = 0; i < 1000; i++) {
      db.prepare('INSERT INTO bench VALUES (?, ?)').run(i, `value${i}`)
    }
    const directDuration = performance.now() - directStart

    db.exec('DELETE FROM bench')

    const txStart = performance.now()
    await withTransaction(db, adapter, async (tx) => {
      for (let i = 0; i < 1000; i++) {
        tx.prepare('INSERT INTO bench VALUES (?, ?)').run(i, `value${i}`)
      }
    })
    const txDuration = performance.now() - txStart

    // Transaction should be faster due to batching
    expect(txDuration).toBeLessThan(directDuration)

    db.close()
  })
})
```

## CI Configuration

### GitHub Actions Workflow

```yaml
name: SQLite Integration Tests

on:
  pull_request:
    paths:
      - 'packages/testkit/src/sqlite/**'
  push:
    branches: [main]

jobs:
  integration:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-suite:
          - driver
          - prisma
          - drizzle
          - kysely

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install test-specific deps
        run: |
          if [ "${{ matrix.test-suite }}" = "driver" ]; then
            pnpm add -D better-sqlite3
          elif [ "${{ matrix.test-suite }}" = "prisma" ]; then
            pnpm add -D @prisma/client prisma
          elif [ "${{ matrix.test-suite }}" = "drizzle" ]; then
            pnpm add -D drizzle-orm better-sqlite3
          elif [ "${{ matrix.test-suite }}" = "kysely" ]; then
            pnpm add -D kysely better-sqlite3
          fi

      - name: Run integration tests
        env:
          SQLITE_DRIVER: ${{ matrix.test-suite == 'driver' && 'better-sqlite3' || '' }}
          TEST_PRISMA: ${{ matrix.test-suite == 'prisma' && '1' || '' }}
          TEST_DRIZZLE: ${{ matrix.test-suite == 'drizzle' && '1' || '' }}
          TEST_KYSELY: ${{ matrix.test-suite == 'kysely' && '1' || '' }}
        run: pnpm --filter @template/testkit test:integration
```

## Local Development

### Running Integration Tests Locally

```bash
# Install optional dependencies
pnpm add -D better-sqlite3 @prisma/client drizzle-orm kysely

# Run all integration tests
SQLITE_DRIVER=better-sqlite3 TEST_PRISMA=1 TEST_DRIZZLE=1 TEST_KYSELY=1 pnpm test:integration

# Run specific suite
SQLITE_DRIVER=better-sqlite3 pnpm test integration/better-sqlite3

# Run with benchmarks
RUN_BENCHMARKS=1 SQLITE_DRIVER=better-sqlite3 pnpm test benchmarks
```

### Test Isolation Verification

Create a test to verify proper isolation:

```typescript
test('parallel test isolation', async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, async (_, i) => {
      const db = await createFileDatabase(`test${i}.db`)

      // Each database should be completely isolated
      await db.exec(`CREATE TABLE test (id INTEGER PRIMARY KEY)`)
      await db.exec(`INSERT INTO test VALUES (${i})`)

      const result = await db.get('SELECT * FROM test')
      await db.cleanup()

      return result.id
    })
  )

  // Each test should have its own value
  expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
})
```

## Success Metrics

1. **All integration tests pass** with actual drivers
2. **No flaky tests** across 100 runs
3. **Performance targets met**:
   - Database creation: < 1ms
   - Transaction overhead: < 10%
   - Migration application: < 5ms per file
4. **Memory leak free**: No handles left open after tests
5. **Cross-platform**: Tests pass on Linux, macOS, Windows

## Risk Mitigation

1. **Native dependencies**: Document installation requirements clearly
2. **Version compatibility**: Test against multiple ORM versions
3. **Memory leaks**: Use `--detect-open-handles` in test runner
4. **Concurrency issues**: Verify isolation with stress tests
5. **Performance regression**: Add benchmarks to CI

## Documentation Requirements

Each integration must include:
- Setup instructions
- Example test patterns
- Common pitfalls
- Performance considerations
- Debugging guide