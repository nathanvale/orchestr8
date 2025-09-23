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

### Transactions

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

## Phase 2 Features (Coming Soon)

- **Driver adapters** for better-sqlite3
- **Pragma utilities** for WAL mode, foreign keys, etc.
- **Migration runner** for SQL files
- **Seed utilities** for test data
- **Integration tests** with actual drivers

## Troubleshooting

### "No such table" errors

- Ensure migrations are run before tests
- Check that you're using the correct database URL

### Connection pool exhaustion (Prisma)

- Set `connection_limit=1` in datasource URL
- Use a single PrismaClient instance per test

### Isolation issues

- Verify you're using shared cache URLs correctly
- Ensure cleanup is happening between tests
- Check for accidental database handle reuse

## Contributing

When adding new features:

1. Follow TDD approach with Wallaby
2. Maintain driver-agnostic design in core utilities
3. Gate driver-specific code behind environment variables
4. Add comprehensive tests and documentation
5. Update this README with new patterns
