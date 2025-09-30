# README Update Plan

## Critical Issue
The README.md documents functions that don't exist in the codebase, causing import errors for users who copy examples.

## Broken References Found

### SQLite Module Issues
**Lines with broken references**: 49, 124-125, 284-285, 289, 291

**Documented (WRONG)**:
```typescript
import { createSQLiteDatabase, withSQLiteTransaction } from '@orchestr8/testkit/sqlite'

const db = createSQLiteDatabase(':memory:')
await withSQLiteTransaction(db, async (tx) => { ... })
```

**Actual Exports Available**:
```typescript
// From src/sqlite/index.ts - these are the real exports:
export * from './cleanup.js'    // cleanupDatabase, registerDatabaseCleanup
export * from './errors.js'     // SQLiteError, etc.
export * from './file.js'       // createFileDatabase, createFileUrl
export * from './memory.js'     // createMemoryUrl
export * from './migrate.js'    // runMigrations
export * from './orm.js'        // ORM integration
export * from './pool.js'       // createPool, getConnection
export * from './pragma.js'     // setPragma, getPragma
export * from './prisma.js'     // Prisma integration
export * from './seed.js'       // seedDatabase
export * from './txn.js'        // withTransaction (NOT withSQLiteTransaction)
```

**Correct Examples Should Be**:
```typescript
import { createMemoryUrl, createPool } from '@orchestr8/testkit/sqlite'

// Option 1: Using memory URL with a connection library
const url = createMemoryUrl('raw')
// Then use with better-sqlite3, kysely, drizzle, etc.

// Option 2: Using connection pool
const pool = createPool({ url: createMemoryUrl('raw') })
const conn = await pool.getConnection()

// Option 3: Using file database
import { createFileDatabase } from '@orchestr8/testkit/sqlite'
const db = await createFileDatabase('test.db')

// Transactions (use withTransaction, not withSQLiteTransaction)
import { withTransaction } from '@orchestr8/testkit/sqlite'
await withTransaction(connection, async (tx) => { ... })
```

### Container Module Issues
**Lines with broken references**: 50, 136-138, 304, 307

**Documented (WRONG)**:
```typescript
import { startContainer } from '@orchestr8/testkit/containers'
import { createPostgreSQLContainer, createMySQLContainer } from '@orchestr8/testkit/containers'

const { container, connectionUri } = await createPostgreSQLContainer({ ... })
```

**Actual Exports Available**:
```typescript
// From src/containers/index.ts - these are the real exports:
export { PostgresContainer, createPostgresConfig, createPostgresContext, setupPostgresTest } from './postgres.js'
export { MySQLContainer, createMySQLConfig, createMySQLContext, setupMySQLTest } from './mysql.js'
export { BaseDatabaseContainer } from './base-database.js'
export { isDockerAvailable, skipIfNoDocker } from './docker-utils.js'
```

**Correct Examples Should Be**:
```typescript
// Option 1: Using context helper (recommended for most tests)
import { createPostgresContext } from '@orchestr8/testkit/containers'

const context = await createPostgresContext({
  database: 'testdb',
  username: 'testuser',
  password: 'testpass',
})

// Access connection
await context.db.query('SELECT 1')

// Cleanup
await context.cleanup()

// Option 2: Using raw container class (advanced)
import { PostgresContainer } from '@orchestr8/testkit/containers'

const container = new PostgresContainer({
  image: 'postgres:16-alpine',
})

await container.start()
const connectionString = container.getConnectionUri()

// MySQL equivalent
import { createMySQLContext } from '@orchestr8/testkit/containers'

const mysqlContext = await createMySQLContext({
  database: 'testdb',
  rootPassword: 'root',
})
```

## Action Plan

### Phase 1: Audit (15 mins)
- [x] Identify all broken function references (DONE - found 11 locations)
- [ ] Check actual exports from each module
- [ ] Document replacement patterns

### Phase 2: Update Examples (30 mins)

#### Fix Line 49 (Quick Start - Advanced Usage)
```diff
-import { createSQLiteDatabase } from '@orchestr8/testkit/sqlite' // requires better-sqlite3
-import { startContainer } from '@orchestr8/testkit/containers' // requires testcontainers
+import { createMemoryUrl, createPool } from '@orchestr8/testkit/sqlite' // requires better-sqlite3
+import { createPostgresContext } from '@orchestr8/testkit/containers' // requires testcontainers
```

#### Fix Lines 124-125 (SQLite Testing Section)
```diff
-  createSQLiteDatabase,
-  withSQLiteTransaction,
+  createMemoryUrl,
+  createFileDatabase,
+  createPool,
+  withTransaction,
```

#### Fix Lines 136-138 (Container Testing Section)
```diff
-  startContainer,
-  createPostgreSQLContainer,
-  createMySQLContainer,
+  createPostgresContext,
+  createMySQLContext,
+  PostgresContainer,
+  MySQLContainer,
```

#### Fix Lines 284-291 (SQLite Usage Example)
```diff
-import {
-  createSQLiteDatabase,
-  withSQLiteTransaction,
-} from '@orchestr8/testkit/sqlite'
+import {
+  createMemoryUrl,
+  createPool,
+  withTransaction,
+} from '@orchestr8/testkit/sqlite'

-  const db = createSQLiteDatabase(':memory:')
+  const pool = createPool({ url: createMemoryUrl('raw') })
+  const db = await pool.getConnection()

-  await withSQLiteTransaction(db, async (tx) => {
+  await withTransaction(db, async (tx) => {
     // Perform database operations
     await tx.run('INSERT INTO users (name) VALUES (?)', ['Alice'])
   })
+
+  // Cleanup
+  await pool.close()
```

#### Fix Lines 304-307 (Container Usage Example)
```diff
-import { createPostgreSQLContainer } from '@orchestr8/testkit/containers'
+import { createPostgresContext } from '@orchestr8/testkit/containers'

-  const { container, connectionUri } = await createPostgreSQLContainer({
+  const context = await createPostgresContext({
     database: 'testdb',
     username: 'testuser',
     password: 'testpass',
   })

-  // Use connectionUri with your database client
-  const client = new Client(connectionUri)
+  // Use context.db directly
+  const result = await context.db.query('SELECT 1')

-  // Cleanup
-  await container.stop()
+  await context.cleanup()
```

### Phase 3: Add Comprehensive Examples Section (45 mins)

Add new section after "Available Exports" with complete, working examples:

```markdown
## Usage Examples

### SQLite Testing

#### In-Memory Database
\`\`\`typescript
import { createMemoryUrl } from '@orchestr8/testkit/sqlite'
import Database from 'better-sqlite3'

test('in-memory database', () => {
  const url = createMemoryUrl('raw')
  const db = new Database(url)

  db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
  db.exec("INSERT INTO users (name) VALUES ('Alice')")

  const users = db.prepare('SELECT * FROM users').all()
  expect(users).toHaveLength(1)

  db.close()
})
\`\`\`

#### File-Based Database
\`\`\`typescript
import { createFileDatabase } from '@orchestr8/testkit/sqlite'
import Database from 'better-sqlite3'

test('file database with auto-cleanup', async () => {
  const { url, cleanup } = await createFileDatabase('test.db')

  const db = new Database(url)
  db.exec('CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)')

  // Your tests here

  db.close()
  await cleanup() // Removes temp directory
})
\`\`\`

#### Connection Pooling
\`\`\`typescript
import { createPool, createMemoryUrl } from '@orchestr8/testkit/sqlite'

test('connection pool', async () => {
  const pool = createPool({
    url: createMemoryUrl('raw'),
    maxConnections: 5
  })

  const conn = await pool.getConnection()
  // Use connection
  await pool.releaseConnection(conn)
  await pool.close()
})
\`\`\`

#### Transactions
\`\`\`typescript
import { withTransaction, createMemoryUrl, createPool } from '@orchestr8/testkit/sqlite'

test('transactions', async () => {
  const pool = createPool({ url: createMemoryUrl('raw') })
  const conn = await pool.getConnection()

  await withTransaction(conn, async (tx) => {
    await tx.run('INSERT INTO users (name) VALUES (?)', ['Bob'])
    // Auto-commits on success, rolls back on error
  })

  await pool.close()
})
\`\`\`

### Container Testing

#### PostgreSQL Container
\`\`\`typescript
import { createPostgresContext } from '@orchestr8/testkit/containers'

test('postgres container', async () => {
  const context = await createPostgresContext({
    database: 'testdb',
    username: 'testuser',
    password: 'testpass',
  })

  // Direct database access
  const result = await context.db.query('SELECT version()')
  expect(result.rows).toHaveLength(1)

  // Cleanup stops container and removes it
  await context.cleanup()
}, 60000) // Containers need longer timeout
\`\`\`

#### MySQL Container
\`\`\`typescript
import { createMySQLContext } from '@orchestr8/testkit/containers'

test('mysql container', async () => {
  const context = await createMySQLContext({
    database: 'testdb',
    rootPassword: 'root',
  })

  const [rows] = await context.db.query('SELECT DATABASE()')
  expect(rows[0]['DATABASE()']).toBe('testdb')

  await context.cleanup()
}, 60000)
\`\`\`

#### Advanced: Raw Container Class
\`\`\`typescript
import { PostgresContainer } from '@orchestr8/testkit/containers'

test('raw postgres container', async () => {
  const container = new PostgresContainer({
    image: 'postgres:16-alpine',
    database: 'testdb',
  })

  await container.start()

  const uri = container.getConnectionUri()
  // Use uri with your preferred client

  await container.stop()
}, 60000)
\`\`\`
\`\`\`

```

### Phase 4: Add Validation Test (30 mins)

Create `packages/testkit/src/__tests__/readme-validation.test.ts`:

```typescript
/**
 * Validates that all code examples in README.md actually work
 */
import { describe, expect, it } from 'vitest'

describe('README Examples Validation', () => {
  it('should have working imports for SQLite examples', async () => {
    const { createMemoryUrl, createFileDatabase, createPool, withTransaction } =
      await import('@orchestr8/testkit/sqlite')

    expect(typeof createMemoryUrl).toBe('function')
    expect(typeof createFileDatabase).toBe('function')
    expect(typeof createPool).toBe('function')
    expect(typeof withTransaction).toBe('function')
  })

  it('should have working imports for Container examples', async () => {
    const {
      createPostgresContext,
      createMySQLContext,
      PostgresContainer,
      MySQLContainer
    } = await import('@orchestr8/testkit/containers')

    expect(typeof createPostgresContext).toBe('function')
    expect(typeof createMySQLContext).toBe('function')
    expect(PostgresContainer).toBeDefined()
    expect(MySQLContainer).toBeDefined()
  })

  it('should execute SQLite memory URL example', () => {
    const { createMemoryUrl } = require('@orchestr8/testkit/sqlite')
    const url = createMemoryUrl('raw')
    expect(url).toContain(':memory:')
  })
})
```

### Phase 5: Add CI Check (15 mins)

Add to `.github/workflows/ci.yml`:

```yaml
- name: Validate README Examples
  run: pnpm --filter @orchestr8/testkit test readme-validation
```

### Phase 6: Update API.md (if needed) (15 mins)

Ensure API.md matches the actual exports and doesn't have the same issues.

## Verification Checklist

- [ ] All function references in README exist in actual exports
- [ ] All code examples compile without errors
- [ ] Examples follow actual API patterns (context helpers vs raw classes)
- [ ] Dependency requirements match actual usage
- [ ] Test suite validates README examples
- [ ] CI fails if README examples break

## Estimated Time

- Phase 1: 15 mins (DONE)
- Phase 2: 30 mins
- Phase 3: 45 mins
- Phase 4: 30 mins
- Phase 5: 15 mins
- Phase 6: 15 mins

**Total**: ~2.5 hours

## Notes

- Focus on correctness over brevity
- Provide both simple and advanced examples
- Link to actual module documentation
- Add TypeScript types to examples
- Include cleanup patterns
