# @orchestr8/testkit

A comprehensive testing toolkit for the @orchestr8 monorepo with modular imports and optional dependencies.

## Installation

```bash
npm install @orchestr8/testkit
# or
pnpm add @orchestr8/testkit
# or
yarn add @orchestr8/testkit
```

## Core Features

- **Lean Core**: Main export includes only essential utilities with no optional dependencies
- **Modular Imports**: Use only what you need via sub-exports
- **Optional Dependencies**: Advanced features require optional peer dependencies
- **TypeScript Support**: Full type safety and IntelliSense support
- **Vitest Integration**: Optimized for Vitest testing framework

## Quick Start

### Basic Usage (No Optional Dependencies)

```typescript
import { delay, retry, getTestEnvironment, createTempDirectory } from '@orchestr8/testkit'

// Use core utilities without installing optional dependencies
const env = getTestEnvironment()
const tempDir = createTempDirectory()
await delay(1000)
```

### Advanced Usage (With Optional Dependencies)

```typescript
// Import specific modules as needed
import { setupMSW } from '@orchestr8/testkit/msw'  // requires msw
import { createSQLiteDatabase } from '@orchestr8/testkit/sqlite'  // requires better-sqlite3
import { startContainer } from '@orchestr8/testkit/containers'  // requires testcontainers
```

## Dependency Requirements Matrix

| Feature | Import | Required Dependencies | Optional Dependencies |
|---------|--------|---------------------|----------------------|
| **Core Utils** | `@orchestr8/testkit` | `vitest@^3.2.0` | None |
| **MSW Testing** | `@orchestr8/testkit/msw` | `vitest@^3.2.0`, `msw@^2.0.0` | `happy-dom@^18.0.0` |
| **Test Containers** | `@orchestr8/testkit/containers` | `vitest@^3.2.0`, `testcontainers@^10.0.0` | `mysql2@^3.0.0`, `pg@^8.0.0` |
| **SQLite Testing** | `@orchestr8/testkit/sqlite` | `vitest@^3.2.0`, `better-sqlite3@^12.0.0` | None |
| **Convex Testing** | `@orchestr8/testkit/convex` | `vitest@^3.2.0`, `convex-test@^0.0.38` | None |
| **CLI Utilities** | `@orchestr8/testkit/cli` | `vitest@^3.2.0` | None |
| **Environment** | `@orchestr8/testkit/env` | `vitest@^3.2.0` | None |
| **File System** | `@orchestr8/testkit/fs` | `vitest@^3.2.0` | None |
| **Config** | `@orchestr8/testkit/config` | None | None |
| **Register** | `@orchestr8/testkit/register` | `vitest@^3.2.0` | None |

## Available Exports

### Main Export (`@orchestr8/testkit`)

**All utilities that only require vitest as a dependency:**

```typescript
// Utility functions
export { delay, retry, withTimeout, createMockFn } from '@orchestr8/testkit'

// Environment utilities (complete set)
export {
  getTestEnvironment, setupTestEnv, getTestTimeouts,
  useFakeTime, createRandomSeed, generateId
} from '@orchestr8/testkit'

// File system utilities (complete set)
export {
  createTempDirectory, createNamedTempDirectory,
  useTempDirectory, createManagedTempDirectory
} from '@orchestr8/testkit'

// Vitest configuration
export { createVitestConfig, defineVitestConfig } from '@orchestr8/testkit'

// Types
export type { TestConfig, TestEnvironment, TestKit } from '@orchestr8/testkit'
```

### Sub-Exports

#### MSW Testing (`@orchestr8/testkit/msw`)
*Requires: `msw@^2.0.0`*

```typescript
import {
  setupMSW,
  createMSWServer,
  createAuthHandlers,
  HttpResponse
} from '@orchestr8/testkit/msw'
```

#### SQLite Testing (`@orchestr8/testkit/sqlite`)
*Requires: `better-sqlite3@^12.0.0`*

```typescript
import {
  createSQLiteDatabase,
  withSQLiteTransaction,
  seedDatabase
} from '@orchestr8/testkit/sqlite'
```

#### Container Testing (`@orchestr8/testkit/containers`)
*Requires: `testcontainers@^10.0.0`*

```typescript
import {
  startContainer,
  createPostgreSQLContainer,
  createMySQLContainer
} from '@orchestr8/testkit/containers'
```

#### Convex Testing (`@orchestr8/testkit/convex`)
*Requires: `convex-test@^0.0.38`*

```typescript
import {
  createConvexTestContext,
  withConvexTest
} from '@orchestr8/testkit/convex'
```

## Installation Options

### Option 1: Core Install (All Non-Optional Features)
```bash
npm install @orchestr8/testkit @vitest/ui vitest
```
Provides access to all core utilities, environment management, file system utilities, and vitest configuration without optional external dependencies.

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
  const result = await retry(async () => {
    const response = await fetch('/api/data')
    if (!response.ok) throw new Error('Failed')
    return response.json()
  }, 3, 1000)

  // Add timeouts to prevent hanging tests
  const data = await withTimeout(
    fetchLargeDataset(),
    5000
  )
})
```

### Environment Detection

```typescript
import { getTestEnvironment, setupTestEnv } from '@orchestr8/testkit'

test('environment-specific behavior', () => {
  const env = getTestEnvironment()

  if (env.isCI) {
    // Increase timeouts in CI
    jest.setTimeout(30000)
  }

  if (env.isWallaby) {
    // Skip slow tests in Wallaby
    return
  }
})

test('with custom environment', () => {
  const envRestore = setupTestEnv({
    NODE_ENV: 'production',
    API_URL: 'https://staging.example.com'
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

```typescript
import { setupMSW, createAuthHandlers, HttpResponse } from '@orchestr8/testkit/msw'

const server = setupMSW([
  ...createAuthHandlers(),
  rest.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' }
    ])
  })
])

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### SQLite Database Testing (Optional)

```typescript
import { createSQLiteDatabase, withSQLiteTransaction } from '@orchestr8/testkit/sqlite'

test('database operations', async () => {
  const db = createSQLiteDatabase(':memory:')

  await withSQLiteTransaction(db, async (tx) => {
    await tx.run('INSERT INTO users (name) VALUES (?)', 'John')
    const user = await tx.get('SELECT * FROM users WHERE name = ?', 'John')
    expect(user.name).toBe('John')
  })

  // Automatic cleanup
})
```

### Container Testing (Optional)

```typescript
import { createPostgreSQLContainer } from '@orchestr8/testkit/containers'

test('integration with PostgreSQL', async () => {
  const { container, connectionUri } = await createPostgreSQLContainer({
    database: 'testdb',
    username: 'testuser',
    password: 'testpass'
  })

  // Use real PostgreSQL instance for integration tests
  const client = new Pool({ connectionString: connectionUri })
  await client.query('SELECT 1')

  // Automatic cleanup when test completes
}, 30000)
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
    }
  })
)
```

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import type {
  TestConfig,
  TestEnvironment,
  TempDirectory,
  FakeTimerOptions
} from '@orchestr8/testkit'
```

## Error Handling

The package is designed with graceful error handling:

- **Missing optional dependencies**: Sub-exports will fail with clear error messages
- **Vitest context issues**: Core utilities work outside of test contexts
- **Environment detection**: Safe fallbacks for all environment checks

## Contributing

This package is part of the @orchestr8 monorepo. See the main repository for contribution guidelines.

## License

MIT