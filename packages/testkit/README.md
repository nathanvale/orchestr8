# @orchestr8/testkit

A comprehensive testing toolkit for the @orchestr8 monorepo with modular imports
and optional dependencies.

## Installation

```bash
npm install @orchestr8/testkit
# or
pnpm add @orchestr8/testkit
# or
yarn add @orchestr8/testkit
```

## Core Features

- **Lean Core**: Main export includes only essential utilities with no optional
  dependencies
- **Modular Imports**: Use only what you need via sub-exports
- **Optional Dependencies**: Advanced features require optional peer
  dependencies
- **TypeScript Support**: Full type safety and IntelliSense support
- **Vitest Integration**: Optimized for Vitest testing framework

## Quick Start

### Basic Usage (No Optional Dependencies)

```typescript
import {
  delay,
  retry,
  getTestEnvironment,
  createTempDirectory,
} from '@orchestr8/testkit'

// Use core utilities without installing optional dependencies
const env = getTestEnvironment()
const tempDir = createTempDirectory()
await delay(1000)
```

### Advanced Usage (With Optional Dependencies)

```typescript
// Import specific modules as needed
import { setupMSW } from '@orchestr8/testkit/msw' // requires msw
import { createMemoryUrl, createSQLitePool } from '@orchestr8/testkit/sqlite' // requires better-sqlite3
import { createPostgresContext } from '@orchestr8/testkit/containers' // requires testcontainers
```

## Dependency Requirements Matrix

| Feature             | Import                          | Required Dependencies                     | Optional Dependencies        |
| ------------------- | ------------------------------- | ----------------------------------------- | ---------------------------- |
| **Core Utils**      | `@orchestr8/testkit`            | `vitest@^3.2.0`                           | None                         |
| **MSW Testing**     | `@orchestr8/testkit/msw`        | `vitest@^3.2.0`, `msw@^2.0.0`             | `happy-dom@^18.0.0`          |
| **Test Containers** | `@orchestr8/testkit/containers` | `vitest@^3.2.0`, `testcontainers@^10.0.0` | `mysql2@^3.0.0`, `pg@^8.0.0` |
| **SQLite Testing**  | `@orchestr8/testkit/sqlite`     | `vitest@^3.2.0`, `better-sqlite3@^12.0.0` | None                         |
| **Convex Testing**  | `@orchestr8/testkit/convex`     | `vitest@^3.2.0`, `convex-test@^0.0.38`    | None                         |
| **CLI Utilities**   | `@orchestr8/testkit/cli`        | `vitest@^3.2.0`                           | None                         |
| **Environment**     | `@orchestr8/testkit/env`        | `vitest@^3.2.0`                           | None                         |
| **File System**     | `@orchestr8/testkit/fs`         | `vitest@^3.2.0`                           | None                         |
| **Config**          | `@orchestr8/testkit/config`     | None                                      | None                         |
| **Register**        | `@orchestr8/testkit/register`   | `vitest@^3.2.0`                           | None                         |

## Available Exports

### Main Export (`@orchestr8/testkit`)

**All utilities that only require vitest as a dependency:**

```typescript
// Utility functions
export { delay, retry, withTimeout, createMockFn } from '@orchestr8/testkit'

// Environment utilities (from /env sub-export)
export {
  getTestEnvironment,
  setupTestEnv,
  getTestTimeouts,
} from '@orchestr8/testkit'

// File system utilities (from /fs sub-export)
export {
  createTempDirectory,
  createNamedTempDirectory,
} from '@orchestr8/testkit'

// Vitest configuration
export { createVitestConfig, defineVitestConfig } from '@orchestr8/testkit'

// Types
export type { TestConfig, TestEnvironment, TestKit } from '@orchestr8/testkit'
```

**Additional utilities available via sub-exports:**

```typescript
// Advanced environment utilities (requires vitest)
import {
  useFakeTimers,
  createSeedContext,
  DeterministicGenerator,
  createSystemTimeContext,
  createTimezoneContext,
} from '@orchestr8/testkit/env'

// Advanced file system utilities (requires vitest)
import {
  useTempDirectory,
  createManagedTempDirectory,
  createTempDirectoryWithResourceManager,
  withTempDirectoryScope,
} from '@orchestr8/testkit/fs'
```

### Sub-Exports

#### MSW Testing (`@orchestr8/testkit/msw`)

_Requires: `msw@^2.0.0`_

> **Note:** MSW v2 introduces breaking changes from v1. Use `http.get` instead of `rest.get`, `http.post` instead of `rest.post`, etc.

```typescript
import {
  setupMSW,
  createMSWServer,
  createAuthHandlers,
  http,
  HttpResponse,
} from '@orchestr8/testkit/msw'
```

#### SQLite Testing (`@orchestr8/testkit/sqlite`)

_Requires: `better-sqlite3@^12.0.0`_

```typescript
import {
  createMemoryUrl,
  createFileDatabase,
  createSQLitePool,
  withTransaction,
  seedWithSql,
  seedWithFiles,
  seedWithBatch,
} from '@orchestr8/testkit/sqlite'
```

#### Container Testing (`@orchestr8/testkit/containers`)

_Requires: `testcontainers@^10.0.0`_

```typescript
import {
  createPostgresContext,
  createMySQLContext,
  PostgresContainer,
  MySQLContainer,
  setupPostgresTest,
  setupMySQLTest,
} from '@orchestr8/testkit/containers'
```

#### Convex Testing (`@orchestr8/testkit/convex`)

_Requires: `convex-test@^0.0.38`_

```typescript
import {
  createConvexTestHarness,
} from '@orchestr8/testkit/convex'
```

## Installation Options

### Option 1: Core Install (All Non-Optional Features)

```bash
npm install @orchestr8/testkit @vitest/ui vitest
```

Provides access to all core utilities, environment management, file system
utilities, and vitest configuration without optional external dependencies.

### Option 2: Selective Install (Pick Your Features)

```bash
# Core + MSW
npm install @orchestr8/testkit @vitest/ui vitest msw happy-dom

# Core + SQLite
npm install @orchestr8/testkit @vitest/ui vitest better-sqlite3

# Core + Containers
npm install @orchestr8/testkit @vitest/ui vitest testcontainers

# Core + All Optional Features
npm install @orchestr8/testkit @vitest/ui vitest \
  msw happy-dom better-sqlite3 convex-test testcontainers mysql2 pg
```

## Usage Examples

### Basic Testing Utilities

```typescript
import { delay, retry, withTimeout } from '@orchestr8/testkit'

test('async operations', async () => {
  // Wait for a condition
  await delay(100)

  // Retry flaky operations
  const result = await retry(
    async () => {
      const response = await fetch('/api/data')
      if (!response.ok) throw new Error('Failed')
      return response.json()
    },
    3,
    1000,
  )

  // Add timeouts to prevent hanging tests
  const data = await withTimeout(fetchLargeDataset(), 5000)
})
```

### Environment Detection

```typescript
import { test } from 'vitest'
import { getTestEnvironment, setupTestEnv } from '@orchestr8/testkit'

test('environment-specific behavior', () => {
  const env = getTestEnvironment()
  // env contains: { isCI, isWallaby, isVitest, isJest, nodeEnv }

  if (env.isCI) {
    // Increase timeout for this test in CI
    test.setTimeout(30000)
  }

  if (env.isWallaby) {
    // Skip slow tests in Wallaby
    return
  }
})

test('with custom environment', () => {
  const envRestore = setupTestEnv({
    NODE_ENV: 'production',
    API_URL: 'https://staging.example.com',
  })

  // Test with custom environment
  // ...

  envRestore.restore()
})
```

### Temporary File Management

```typescript
import { createTempDirectory } from '@orchestr8/testkit'

test('file operations', async () => {
  const tempDir = createTempDirectory()

  // Use temp directory for test
  await fs.writeFile(path.join(tempDir.path, 'test.txt'), 'content')

  // Automatic cleanup when test completes
})
```

### MSW Mock Server (Optional)

> **MSW v2 Migration Note:** This package uses MSW v2. If you're migrating from v1:
> - Replace `rest.*` with `http.*` (e.g., `rest.get` → `http.get`)
> - Import `http` instead of `rest` from the MSW module
> - See [MSW v2 migration guide](https://mswjs.io/docs/migrations/1.x-to-2.x) for more details

```typescript
import {
  setupMSW,
  createAuthHandlers,
  http,
  HttpResponse,
} from '@orchestr8/testkit/msw'

const server = setupMSW([
  ...createAuthHandlers(),
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
    ])
  }),
])

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### SQLite Database Testing (Optional)

```typescript
import {
  createMemoryUrl,
  createSQLitePool,
  withTransaction,
  seedWithSql,
} from '@orchestr8/testkit/sqlite'
import { betterSqliteAdapter } from '@orchestr8/testkit/sqlite/adapters'
import Database from 'better-sqlite3'

test('database operations', async () => {
  // Create a connection pool with an in-memory database
  const pool = createSQLitePool({ url: createMemoryUrl('raw') })
  const db = await pool.getConnection()

  // Set up the schema
  db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')

  // Seed data
  await seedWithSql(db, `INSERT INTO users (name) VALUES ('John')`)

  // Use transactions for safe database operations with adapter
  await withTransaction(db, betterSqliteAdapter, async (tx) => {
    tx.run('INSERT INTO users (name) VALUES (?)', 'Alice')
    const user = tx.get('SELECT * FROM users WHERE name = ?', 'Alice')
    expect(user.name).toBe('Alice')
  })

  // Cleanup
  await pool.close()
})
```

### Container Testing (Optional)

```typescript
import { createPostgresContext } from '@orchestr8/testkit/containers'

test('integration with PostgreSQL', async () => {
  // Create a context with a real PostgreSQL container
  const context = await createPostgresContext({
    database: 'testdb',
    username: 'testuser',
    password: 'testpass',
  })

  // Use the database connection directly from the context
  const result = await context.db.query('SELECT 1')
  expect(result.rows).toHaveLength(1)

  // Cleanup stops the container and removes it
  await context.cleanup()
}, 60000) // Containers need longer timeout
```

## New Features in v2.0.0

### Security Validation

Built-in security validation to prevent common vulnerabilities:

- **Command Injection Prevention**: Validates and sanitizes shell commands
- **Path Traversal Protection**: Prevents directory traversal attacks
- **SQL Injection Prevention**: Sanitizes SQL identifiers
- **Shell Argument Escaping**: Properly escapes shell arguments

### Advanced Resource Management

Comprehensive resource cleanup system:

- **Automatic Resource Tracking**: Tracks database connections, file descriptors, processes, timers
- **Priority-Based Cleanup**: Critical resources cleaned up first
- **Leak Detection**: Identifies potential resource leaks
- **Event-Driven Monitoring**: Real-time resource lifecycle events

### Concurrency Control

Built-in concurrency limits to prevent resource exhaustion:

- **Operation-Specific Limits**: Different limits for database, file, network operations
- **Batch Processing**: Process arrays with concurrency limits
- **Predefined Managers**: Ready-to-use managers for common scenarios
- **Custom Concurrency**: Create custom concurrency managers

### SQLite Connection Pooling

Advanced SQLite testing with connection pooling:

- **Connection Pooling**: Manage multiple SQLite connections efficiently
- **Transaction Management**: Enhanced transaction support with adapters
- **Migration Support**: Run database migrations in tests
- **Environment Probing**: Verify SQLite capabilities and configuration

### Enhanced Environment Control

Expanded environment testing capabilities:

- **Comprehensive Detection**: Detect CI, Wallaby, Jest, Node test runners
- **Advanced Time Control**: Fake timers with timezone support
- **Randomness Control**: Deterministic random number generation and crypto mocking
- **Environment Scoping**: Isolated environment changes with automatic restore

## API Naming Conventions

The testkit follows consistent naming patterns to provide an intuitive developer
experience:

### Function Naming Standards

- **`create*`** - Factory functions that return new instances

  ```typescript
  createTempDirectory() // Creates and returns a temp directory
  createMSWServer() // Creates a new MSW server instance
  createConvexTestHarness() // Creates a test harness
  ```

- **`setup*`** - One-time initialization functions with side effects

  ```typescript
  setupMSW() // Initializes MSW globally
  setupCryptoControl() // Sets up crypto mocking
  setupTestEnv() // Configures test environment
  ```

- **`use*`** - Hook-style functions for test lifecycle management

  ```typescript
  useTempDirectory() // Returns a cleanup function (from @orchestr8/testkit/fs)
  useFakeTimers() // Returns timer context (from @orchestr8/testkit/env)
  usePrismaTestDatabase() // Returns database context (from @orchestr8/testkit/sqlite)
  ```

- **`with*`** - Scoped operations with automatic cleanup

  ```typescript
  withTempDirectoryScope() // Executes function with temp dir
  withFakeTimers() // Executes with fake time
  withTransaction() // Executes within database transaction
  ```

- **`get*`** - Pure getter functions without side effects
  ```typescript
  getTestEnvironment() // Returns current test env
  getMSWServer() // Returns existing server instance
  getResourceStats() // Returns resource statistics
  ```

### Deprecation Policy

When function names are standardized, the old names are kept with deprecation
warnings:

```typescript
// New standardized name
createTempDirectoryWithResourceManager()

// Old name still available but deprecated
useTempDirectoryWithResourceManager() // Shows deprecation warning
```

## Vitest Configuration

The testkit provides pre-configured Vitest setups:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { createVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createVitestConfig({
    test: {
      globals: true,
      environment: 'happy-dom', // requires happy-dom
      setupFiles: ['@orchestr8/testkit/register'],
    },
  }),
)
```

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import type {
  TestConfig,
  TestEnvironment,
} from '@orchestr8/testkit'

// Types from sub-exports
import type { TempDirectory } from '@orchestr8/testkit/fs'
import type { FakeTimerOptions } from '@orchestr8/testkit/env'
```

## Error Handling

The package is designed with graceful error handling:

- **Missing optional dependencies**: Sub-exports will fail with clear error
  messages
- **Vitest context issues**: Core utilities work outside of test contexts
- **Environment detection**: Safe fallbacks for all environment checks

## Contributing

This package is part of the @orchestr8 monorepo. See the main repository for
contribution guidelines.

## License

MIT
