# SQLite Examples Runner

This directory contains executable examples that demonstrate the SQLite testing
utilities using real better-sqlite3 connections.

## Prerequisites

```bash
cd packages/testkit/examples/sqlite/runner
npm install
```

If you're running from the monorepo, ensure local builds/aliases are available
(optional):

```bash
# from repo root
pnpm -w build
```

## Available Examples

### Basic Setup

```bash
npm run basic
```

Demonstrates:

- File database creation and cleanup
- Schema setup and data seeding
- Basic querying and data verification
- Proper resource management

### Pragma Configuration

```bash
npm run pragmas
```

Demonstrates:

- Applying recommended SQLite pragmas
- Environment capabilities probing
- Foreign key constraint testing
- WAL mode verification
- Cascade delete functionality

### Run All Examples

```bash
npm run all
```

## Example Output

### Basic Setup Example

```text
🚀 Running Basic Setup Example with better-sqlite3

📁 Creating file database...
   Database created at: /tmp/sqlite-xyz/example.db
🔌 Connecting to database...
   Connected successfully
📋 Setting up schema...
   Schema created
🌱 Seeding test data...
   Test data seeded
🔍 Querying data...
   Found user: { id: 1, name: 'Alice', email: 'alice@example.com' }
   Total users: 2
   Posts with authors:
     1. "First Post" by Alice
     2. "Second Post" by Bob
📝 Testing data modifications...
   Users after addition: 3

✅ Basic setup example completed successfully!
🧹 Cleaning up...
   Cleanup completed
```

### Pragma Configuration Example

```text
🚀 Running Pragma Configuration Example with better-sqlite3

📁 Creating file database for WAL mode...
   Database created at: /tmp/sqlite-xyz/pragma-test.db
⚙️  Applying recommended pragmas...
   Applied pragmas:
     Journal mode: wal
     Foreign keys: on
     Busy timeout: 5000ms

🔍 Running environment capabilities probe...
🔍 Probing SQLite environment capabilities...
✅ WAL mode enabled
✅ Foreign keys enabled
✅ Busy timeout set to 5000ms
✅ JSON1 extension available
✅ FTS5 extension available
✅ Environment probe complete

📊 Probe results:
   Capabilities:
     wal: ✅
     foreign_keys: ✅
     json1: ✅
     fts5: ✅
📋 Creating schema with foreign key constraints...
   Schema created
🔗 Testing foreign key constraints...
   Added author: Jane Austen
   Added book: Pride and Prejudice
   ✅ Foreign key constraint working: FOREIGN KEY constraint failed
🗑️  Testing cascade delete...
   Books before delete: 1
   Deleted author with ID 1
   Books after delete: 0
   ✅ Cascade delete working correctly

✅ Pragma configuration example completed successfully!
🧹 Cleaning up...
   Cleanup completed
```

## Key Learnings

### Database Adaptation Pattern

The examples show how to adapt better-sqlite3 to work with the testkit
utilities:

```javascript
function adaptDatabase(db) {
  return {
    exec: (sql) => db.exec(sql),
    execute: (sql) => db.exec(sql),
    pragma: (sql) => {
      const [statement, value] = sql.split(' = ')
      const pragmaName = statement.replace('PRAGMA ', '')
      if (value) {
        return db.pragma(`${pragmaName} = ${value}`)
      }
      return db.pragma(pragmaName)
    },
    prepare: (sql) => db.prepare(sql),
    get: (sql, params) => db.prepare(sql).get(...(params || [])),
    all: (sql, params) => db.prepare(sql).all(...(params || [])),
    close: () => db.close(),
  }
}
```

### Proper Cleanup Order

Always close database connections before cleaning up temporary files:

```javascript
try {
  // Use database
} finally {
  await db.close() // Close connection first
  await fileDb.cleanup() // Then cleanup temp files
}
```

### Environment Probing

Use the exported `probeEnvironment` function to verify your setup. Prefer
importing from the public subpath in your projects:

```javascript
// In external projects (recommended)
import { probeEnvironment } from '@template/testkit/sqlite'

// In this local runner we import from src for simplicity
// import { probeEnvironment } from '../../../src/sqlite/index.js'

const result = await probeEnvironment(db, {
  logLevel: 'info',
  required: ['foreign_keys', 'wal'],
})
```

## Extending the Examples

To add your own examples:

1. Create a new `.js` file in this directory
2. Add the ESLint disable comment: `/* eslint-disable no-undef */`
3. Import the utilities from the public subpath `@template/testkit/sqlite` (or
   from `../../../src/sqlite/index.js` when running locally inside this repo)
4. Use the `adaptDatabase` helper for better-sqlite3 compatibility
5. Add a script to `package.json` to run your example

## Dependencies

- **better-sqlite3**: Native SQLite driver for Node.js
- **@types/better-sqlite3**: TypeScript definitions

These examples demonstrate real-world usage patterns that you can adapt for your
own testing needs.
