# SQLite Testing Examples

This directory contains comprehensive examples demonstrating how to use the SQLite testing utilities in various scenarios.

## Example Files

### 1. [Basic Setup](./01-basic-setup.ts)
**Fundamental SQLite test setup**
- Creating file databases for each test
- Applying migrations and seeding data
- Proper cleanup and isolation patterns
- Best practices for test organization

### 2. [Transaction Isolation](./02-transaction-isolation.ts)
**Using transactions for test isolation**
- Transaction-per-test pattern
- Automatic rollback for isolation
- Adapter pattern implementation
- Complex transactional scenarios

### 3. [Pragma Configuration](./03-pragma-configuration.ts)
**SQLite optimization and stability**
- Applying recommended pragmas (WAL, foreign keys, busy timeout)
- Environment capabilities probe function
- Testing foreign key constraints
- Handling concurrent access scenarios

### 4. [Migrations and Seeding](./04-migrations-and-seeding.ts)
**Database schema and data management**
- Migration file patterns and ordering
- Error handling and rollback scenarios
- Database reset for test cleanup
- Idempotent seeding strategies
- File-based vs SQL-based seeding

### 5. [Prisma Integration](./05-prisma-integration.ts)
**ORM integration patterns**
- Memory vs file database configuration
- Connection pooling for tests
- Environment variable management
- Complex query testing with Prisma

## Common Patterns

### Test Isolation Strategies

1. **Fresh Database Per Test** (Examples 1, 5)
   ```typescript
   beforeEach(async () => {
     fileDb = await createFileDatabase('test.db')
     // Setup schema and data
   })

   afterEach(async () => {
     await db.close()
     await fileDb.cleanup()
   })
   ```

2. **Transaction Rollback** (Example 2)
   ```typescript
   test('isolated test', async () => {
     await withTransaction(db, adapter, async (tx) => {
       // All changes are rolled back
       throw new Error('Rollback for isolation')
     })
   })
   ```

3. **Database Reset** (Example 4)
   ```typescript
   afterEach(async () => {
     await resetDatabase(db)
   })
   ```

### Configuration Patterns

1. **Memory Database for Speed**
   ```typescript
   const url = createMemoryUrl('raw')
   const db = await connectToDatabase(url)
   ```

2. **File Database for WAL Mode**
   ```typescript
   const fileDb = await createFileDatabase('test.db')
   await applyRecommendedPragmas(db, { busyTimeoutMs: 5000 })
   ```

3. **Prisma Configuration**
   ```typescript
   const config = createPrismaMemoryConfig({ connectionLimit: 1 })
   const resetEnv = setPrismaTestEnv(config)
   ```

## Running the Examples

These examples are demonstration code and require mock implementations for database connections. To adapt them for your project:

1. **Replace Mock Interfaces**: Replace the example `Database` interfaces with your actual SQLite driver types
2. **Implement Connection Function**: Replace `connectToDatabase` with your actual database connection logic
3. **Add Real Dependencies**: Install and import your chosen SQLite driver (better-sqlite3, sqlite, etc.)

### Example Adaptation for better-sqlite3

```typescript
import Database from 'better-sqlite3'
import { createFileDatabase } from '@template/testkit/sqlite'

// Replace mock function
function connectToDatabase(url: string): Database {
  // Extract file path from URL
  const path = url.replace('file:', '')
  return new Database(path)
}

// Use real Database type instead of mock interface
let db: Database
```

## Best Practices Demonstrated

1. **Proper Cleanup Order**: Always close database connections before cleanup
2. **Error Handling**: Graceful error handling with context preservation
3. **Test Isolation**: Each test should be independent and repeatable
4. **Resource Management**: Proper cleanup of temporary files and connections
5. **Performance Optimization**: Using appropriate database types and configurations
6. **Anti-Flake Patterns**: Deterministic ordering, time control, and isolation

## Environment Probe

The SQLite utilities include a comprehensive environment probe function that you can use to verify your SQLite setup:

```typescript
import { probeEnvironment } from '@template/testkit/sqlite'

// Run at the start of your test suite
beforeAll(async () => {
  const db = createDatabase()

  // Basic probe with console output
  await probeEnvironment(db)

  // Silent probe for CI environments
  await probeEnvironment(db, { logLevel: 'silent' })

  // Require specific capabilities
  await probeEnvironment(db, {
    required: ['wal', 'foreign_keys', 'json1']
  })
})
```

This will verify:
- WAL mode availability
- Foreign key support
- Busy timeout configuration
- JSON1 extension availability
- FTS5 extension availability

## Migration and Seed File Structure

Example 4 demonstrates the recommended file structure:

```
project/
├── migrations/
│   ├── 001_create_users.sql
│   ├── 002_create_posts.sql
│   └── 003_add_indexes.sql
├── seeds/
│   ├── 01_users.sql
│   ├── 02_posts.sql
│   └── 03_comments.sql
└── tests/
    └── database.test.ts
```

## Integration with Test Frameworks

These examples use Vitest, but the patterns work with any test framework:

- **Jest**: Replace `vitest` imports with `@jest/globals`
- **Node.js Test Runner**: Replace with `node:test`
- **Mocha**: Replace with `mocha` and `chai`

The SQLite utilities are framework-agnostic and work with any testing setup.