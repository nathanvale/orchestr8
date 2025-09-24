# SQLite Test Helpers

Fast, hermetic SQLite database helpers for unit and integration testing.

## Overview

This module provides driver-agnostic utilities for working with SQLite databases
in tests, with a focus on isolation, performance, and reliability.

## Features

- 🚀 **In-memory databases** with ORM-specific URL generation
- 📁 **File-based databases** with automatic cleanup
- 🔄 **Transaction utilities** with adapter pattern
- 🎯 **ORM support** for Prisma, Drizzle, Kysely, and more
- 🧹 **Automatic cleanup** via Vitest lifecycle hooks
- 🛡️ **Anti-flake patterns** built-in
- 📊 **Migrations** with per-file transactions and reset capabilities
- 🌱 **Seeding** with SQL files or direct SQL execution
- ⚙️ **Pragma utilities** for WAL mode, foreign keys, and performance tuning
- 🔍 **Environment probing** to verify database capabilities

## Quick Start

### Memory Databases

Generate in-memory SQLite URLs for different ORMs:

```typescript
import { createMemoryUrl } from '@template/testkit/sqlite'

// For raw SQLite or standard libraries
const url = createMemoryUrl('raw')
// Returns: 'file::memory:?cache=shared'

// For Prisma ORM
const prismaUrl = createMemoryUrl('prisma')
// Returns: 'file:memory?mode=memory&cache=shared'

// For Drizzle with better-sqlite3
const drizzleUrl = createMemoryUrl('drizzle-better-sqlite3')
// Returns: ':memory:'
```

### File Databases

Create temporary file-based databases with automatic cleanup:

```typescript
import { createFileDatabase } from '@template/testkit/sqlite'

test('database operations', async () => {
  const db = await createFileDatabase('test.sqlite')

  // Use db.url for connections
  console.log(db.url) // file:/tmp/sqlite-xxx/test.sqlite
  console.log(db.path) // /tmp/sqlite-xxx/test.sqlite
  console.log(db.dir) // /tmp/sqlite-xxx

  // Cleanup happens automatically via Vitest hooks
  // Or manually:
  await db.cleanup()
})
```

### Transactions

Use the adapter pattern for transaction management:

```typescript
import {
  withTransaction,
  type TransactionAdapter,
} from '@template/testkit/sqlite'

// Define your adapter
const adapter: TransactionAdapter<Database, Transaction> = {
  begin: async (db) => db.beginTransaction(),
  commit: async (tx) => tx.commit(),
  rollback: async (tx) => tx.rollback(),
}

// Use transactions with automatic rollback on error
const result = await withTransaction(db, adapter, async (tx) => {
  // Your transactional code here
  await tx.execute('INSERT INTO users ...')
  return tx.lastInsertId()
})
```

## Prisma Configuration

When using Prisma with in-memory SQLite for tests, disable connection pooling:

```typescript
// test-setup.ts
import { createMemoryUrl } from '@template/testkit/sqlite'

// Helper for Prisma configuration
export function createPrismaTestConfig() {
  return {
    datasourceUrl: createMemoryUrl('prisma'),
    // Disable connection pooling for unit tests
    connection_limit: 1,
    // Or set via datasource URL
    datasources: {
      db: {
        url: `${createMemoryUrl('prisma')}&connection_limit=1`,
      },
    },
  }
}

// In your tests
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasourceUrl: createPrismaTestConfig().datasourceUrl,
})
```

## Isolation Patterns

### Shared vs Isolated Memory

Different targets have different isolation behaviors:

- **Shared cache** (`raw`, `kysely`, `drizzle-libsql`): Multiple connections can
  access the same in-memory database
- **Isolated** (`drizzle-better-sqlite3`): Each connection gets its own database
  unless sharing the handle
- **Prisma**: Uses shared cache but requires pooling configuration

### Test Isolation

For complete test isolation, use one of these patterns:

```typescript
// Pattern 1: New database per test
beforeEach(async () => {
  const db = await createFileDatabase()
  // Each test gets a fresh database
})

// Pattern 2: Transaction rollback (Phase 2)
test('isolated test', async () => {
  await withTransaction(db, adapter, async (tx) => {
    // All changes will be rolled back
    throw new Error('rollback')
  })
})

// Pattern 3: Memory database per test
beforeEach(() => {
  const url = createMemoryUrl('raw')
  // Each test gets a new URL
})
```

## Anti-Flake Guidelines

1. **Always use shared cache** for in-memory databases when multiple connections
   are needed
2. **Disable connection pooling** for Prisma in unit tests
3. **Use deterministic ordering** with `ORDER BY` in queries
4. **Fix time** with `vi.setSystemTime()` for time-dependent tests
5. **Avoid concurrent tests** that share database state
6. **Clean up properly** using the provided cleanup utilities

## API Reference

### Memory Database

```typescript
type SqliteTarget =
  | 'raw' // Standard SQLite libraries
  | 'prisma' // Prisma ORM
  | 'drizzle-libsql' // Drizzle with libSQL
  | 'kysely' // Kysely query builder
  | 'drizzle-better-sqlite3' // Drizzle with better-sqlite3

function createMemoryUrl(target?: SqliteTarget): string
```

### File Database

```typescript
interface FileDatabase {
  url: string // file:// URL for connections
  dir: string // Temporary directory path
  path: string // Full database file path
  cleanup: () => Promise<void>
}

function createFileDatabase(name?: string): Promise<FileDatabase>
```

### Transactions API

```typescript
interface TransactionAdapter<TDb, TTx> {
  begin(db: TDb): Promise<TTx>
  commit(tx: TTx): Promise<void>
  rollback(tx: TTx): Promise<void>
}

function withTransaction<T, TDb, TTx>(
  db: TDb,
  adapter: TransactionAdapter<TDb, TTx>,
  fn: (tx: TTx) => Promise<T>,
): Promise<T>
```

## ORM-Specific Helpers

### Prisma URL Generation

```typescript
import { prismaUrl, type DatabaseKind } from '@template/testkit/sqlite'

// In-memory database
const memoryUrl = prismaUrl('memory')
// Returns: 'file:memory?mode=memory&cache=shared'

// File-based database (default path)
const fileUrl = prismaUrl('file')
// Returns: 'file:./db.sqlite'

// File-based database (custom path)
const customUrl = prismaUrl('file', './test/mydb.sqlite')
// Returns: 'file:./test/mydb.sqlite'
```

### Drizzle URL Generation

```typescript
import { drizzleUrl, type DrizzleDriver } from '@template/testkit/sqlite'

// Memory database with better-sqlite3 (default)
const memoryUrl = drizzleUrl('memory')
// Returns: ':memory:'

// Memory database with libsql
const libsqlMemory = drizzleUrl('memory', undefined, 'libsql')
// Returns: 'file::memory:?cache=shared'

// File database with better-sqlite3
const fileUrl = drizzleUrl('file', './test.db')
// Returns: './test.db'

// File database with libsql
const libsqlFile = drizzleUrl('file', './test.db', 'libsql')
// Returns: 'file:./test.db'
```

### Usage Notes

- **Prisma**: Disable connection pooling for in-memory tests (see Prisma
  Configuration section)
- **Drizzle**: better-sqlite3 uses `:memory:` while libsql uses
  `file::memory:?cache=shared`
- **Default path**: When no path is provided for file databases, defaults to
  `./db.sqlite`
- **No client management**: These helpers only generate URLs; manage ORM clients
  separately

## Migrations

Apply SQL migration files in lexicographic order:

```typescript
import { applyMigrations, resetDatabase } from '@template/testkit/sqlite'

// Apply migrations from a directory
await applyMigrations(db, {
  dir: './migrations',
  glob: '*.sql', // optional, defaults to '*.sql'
})

// Reset database (drops all user tables)
await resetDatabase(db)
```

Migration features:

- Each file runs in its own transaction
- Files are executed in lexicographic order (e.g., `001_init.sql`,
  `002_users.sql`)
- Supports both sync and async database drivers
- Error messages include the filename for easy debugging

## Seeding

Populate test data using SQL files or direct SQL:

```typescript
import { seedWithSql, seedWithFiles } from '@template/testkit/sqlite'

// Direct SQL seeding
await seedWithSql(
  db,
  `
  INSERT INTO users (name, email) VALUES
    ('Alice', 'alice@example.com'),
    ('Bob', 'bob@example.com');
`,
)

// File-based seeding
await seedWithFiles(db, {
  dir: './seeds',
})
```

Seeding features:

- Files are executed in lexicographic order
- Preserves error causes for debugging
- Works with any database that has `exec` or `execute` methods

## Pragma Configuration

Apply recommended SQLite pragmas for testing:

```typescript
import { applyRecommendedPragmas } from '@template/testkit/sqlite'

// Apply WAL mode, foreign keys, and busy timeout
const pragmas = await applyRecommendedPragmas(db, {
  busyTimeoutMs: 5000, // optional, defaults to 2000ms
})

console.log(pragmas)
// {
//   journal_mode: 'wal',
//   foreign_keys: 'on',
//   busy_timeout: 5000
// }
```

Recommended pragmas:

- **WAL mode**: Better concurrency and crash recovery
- **Foreign keys**: Enforce referential integrity
- **Busy timeout**: Reduce "database locked" errors in concurrent tests

## Environment Capabilities Probe

Verify that your SQLite environment meets your requirements:

```typescript
import { applyRecommendedPragmas } from '@template/testkit/sqlite'

// Example probe function for your test setup
export async function probeEnvironment(db: any) {
  const pragmas = await applyRecommendedPragmas(db)

  // Verify WAL mode is available
  if (pragmas.journal_mode !== 'wal') {
    console.warn(
      '⚠️ WAL mode not available, falling back to',
      pragmas.journal_mode,
    )
  }

  // Verify foreign keys are enabled
  if (pragmas.foreign_keys !== 'on') {
    throw new Error('Foreign key support is required but not enabled')
  }

  // Check for JSON1 extension (if needed)
  try {
    await db.exec("SELECT json_extract('{\"a\":1}', '$.a')")
  } catch {
    throw new Error('JSON1 extension is required but not available')
  }

  // Verify busy timeout is set
  if (!pragmas.busy_timeout || pragmas.busy_timeout < 1000) {
    console.warn('⚠️ Busy timeout is low:', pragmas.busy_timeout)
  }

  return pragmas
}

// Use in your test setup
beforeAll(async () => {
  const db = createDatabase()
  await probeEnvironment(db)
})
```

## Cookbook: Common Testing Patterns

### Pattern 1: Fresh Database Per Test

```typescript
import {
  createFileDatabase,
  applyMigrations,
  seedWithSql,
} from '@template/testkit/sqlite'

describe('User Service', () => {
  let db: any
  let dbCleanup: () => Promise<void>

  beforeEach(async () => {
    const fileDb = await createFileDatabase('test.db')
    dbCleanup = fileDb.cleanup
    db = await openDatabase(fileDb.url)

    // Setup schema
    await applyMigrations(db, { dir: './migrations' })

    // Add test data
    await seedWithSql(
      db,
      `
      INSERT INTO users (id, name) VALUES (1, 'Test User');
    `,
    )
  })

  afterEach(async () => {
    await db.close()
    await dbCleanup()
  })

  test('should find user', async () => {
    const user = await db.get('SELECT * FROM users WHERE id = 1')
    expect(user.name).toBe('Test User')
  })
})
```

### Pattern 2: Transaction Rollback Per Test

```typescript
import { withTransaction } from '@template/testkit/sqlite'

test('should rollback changes', async () => {
  await expect(
    withTransaction(db, adapter, async (tx) => {
      await tx.exec('INSERT INTO users (name) VALUES ("Alice")')
      // Force rollback
      throw new Error('Test complete')
    }),
  ).rejects.toThrow('Test complete')

  // Verify no changes persisted
  const count = await db.get('SELECT COUNT(*) as count FROM users')
  expect(count.count).toBe(0)
})
```

### Pattern 3: Shared Database with Reset

```typescript
import { resetDatabase, applyMigrations } from '@template/testkit/sqlite'

describe('Integration Tests', () => {
  let db: any

  beforeAll(async () => {
    db = await openDatabase(':memory:')
    await applyMigrations(db, { dir: './migrations' })
  })

  beforeEach(async () => {
    await resetDatabase(db)
    await applyMigrations(db, { dir: './migrations' })
  })

  test('test 1', async () => {
    // Test with fresh schema
  })

  test('test 2', async () => {
    // Also gets fresh schema
  })
})
```

### Pattern 4: Prisma with Connection Pooling Control

```typescript
import {
  createPrismaMemoryConfig,
  setPrismaTestEnv,
} from '@template/testkit/sqlite'
import { PrismaClient } from '@prisma/client'

describe('Prisma Tests', () => {
  let prisma: PrismaClient
  let resetEnv: () => void

  beforeEach(async () => {
    const config = createPrismaMemoryConfig({
      connection_limit: 1, // Disable pooling for tests
      max_connections: 1,
    })

    resetEnv = setPrismaTestEnv(config)
    prisma = new PrismaClient()

    // Run Prisma migrations
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )
    `)
  })

  afterEach(async () => {
    await prisma.$disconnect()
    resetEnv()
  })

  test('should create user', async () => {
    await prisma.$executeRaw`INSERT INTO users (name) VALUES ('Alice')`
    const users = await prisma.$queryRaw`SELECT * FROM users`
    expect(users).toHaveLength(1)
  })
})
```

### Pattern 5: Testing with Foreign Key Constraints

```typescript
import { applyRecommendedPragmas } from '@template/testkit/sqlite'

beforeEach(async () => {
  db = await openDatabase(':memory:')

  // Enable foreign keys before creating schema
  await applyRecommendedPragmas(db)

  await db.exec(`
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      FOREIGN KEY (author_id) REFERENCES authors(id)
    );
  `)
})

test('should enforce foreign keys', async () => {
  // This should fail due to foreign key constraint
  await expect(
    db.exec('INSERT INTO books (title, author_id) VALUES ("Test", 999)'),
  ).rejects.toThrow('FOREIGN KEY constraint failed')
})
```

## Troubleshooting

### "No such table" errors

- Ensure migrations are run before tests
- Check that you're using the correct database URL
- Verify the migration files are in the correct directory
- Check migration file ordering (use numbered prefixes like `001_`, `002_`)

### Connection pool exhaustion (Prisma)

- Set `connection_limit=1` in datasource URL
- Use a single PrismaClient instance per test
- Use `createPrismaMemoryConfig()` or `createPrismaFileConfig()` helpers
- Ensure `$disconnect()` is called in afterEach hooks

### "Database locked" errors

- Apply recommended pragmas with appropriate busy timeout:

  ```typescript
  await applyRecommendedPragmas(db, { busyTimeoutMs: 10000 })
  ```

- Ensure WAL mode is enabled (check with probe function)
- Avoid long-running transactions in tests
- Close database connections properly in cleanup

### Foreign key constraints not working

- Foreign keys are OFF by default in SQLite
- Use `applyRecommendedPragmas()` to enable them
- Verify with: `PRAGMA foreign_keys` should return 'on' (or 1 depending on
  driver)

### WAL mode not available

- Some environments (like in-memory databases) may not support WAL
- The pragma utility gracefully falls back to other journal modes
- Check actual mode with probe function

### Isolation issues

- Verify you're using shared cache URLs correctly:
  - Raw/Kysely/Drizzle-libsql: `file::memory:?cache=shared`
  - Prisma: `file:memory?mode=memory&cache=shared`
  - Drizzle-better-sqlite3: `:memory:` (isolated by design)
- Ensure cleanup is happening between tests
- Check for accidental database handle reuse
- Consider using file databases for better isolation

### Migration order issues

- Name files with numeric prefixes: `001_init.sql`, `002_users.sql`
- Files are executed in lexicographic order
- Each file runs in its own transaction
- Check error messages for the specific file that failed

### better-sqlite3 specific issues

- Returns `{ timeout }` instead of `{ busy_timeout }` for pragma
- The pragma utility normalizes this automatically
- Doesn't support shared memory URLs (`:memory:` is always isolated)
- Use file databases if you need shared access

## Contributing

When adding new features:

1. Follow TDD approach with Wallaby
2. Maintain driver-agnostic design in core utilities
3. Gate driver-specific code behind environment variables
4. Add comprehensive tests and documentation
5. Update this README with new patterns
