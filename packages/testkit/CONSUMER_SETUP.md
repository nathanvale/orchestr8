# TestKit Consumer Setup Guide

> Complete setup guide for using `@orchestr8/testkit` in your project

## Prerequisites

- Node.js 20+
- TypeScript 5.7+
- Vitest 3.2+
- Package manager: npm, yarn, or pnpm

## Installation

### 1. Install TestKit

```bash
npm install -D @orchestr8/testkit vitest @vitest/ui
```

**Peer Dependencies** (optional):
```bash
# For MSW support
npm install -D msw

# For happy-dom environment
npm install -D happy-dom

# For SQLite support
npm install -D better-sqlite3

# For Convex support
npm install -D convex-test @edge-runtime/vm
```

### 2. Configure TypeScript

Update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "node"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### 3. Configure Vitest

Create `vitest.config.ts` in your project root:

```typescript
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createBaseVitestConfig({
    test: {
      name: 'my-project',
      environment: 'node', // or 'happy-dom' for DOM tests
    },
  })
)
```

**⚠️ Important**: Always wrap `createBaseVitestConfig()` with `defineConfig()` from `vitest/config`. Do NOT import or use `defineVitestConfig` - it has been removed.

### 4. Add Test Scripts

Update your `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Basic Usage

### Writing Tests

Create a test file (e.g., `src/utils.test.ts`):

```typescript
import { describe, it, expect } from 'vitest'
import { delay, retry } from '@orchestr8/testkit'

describe('Utilities', () => {
  it('should delay execution', async () => {
    const start = Date.now()
    await delay(100)
    const elapsed = Date.now() - start

    expect(elapsed).toBeGreaterThanOrEqual(100)
  })

  it('should retry failed operations', async () => {
    let attempts = 0

    const result = await retry(
      async () => {
        attempts++
        if (attempts < 3) throw new Error('Not yet')
        return 'success'
      },
      { maxAttempts: 5, delay: 10 }
    )

    expect(result).toBe('success')
    expect(attempts).toBe(3)
  })
})
```

### Using Temporary Directories

```typescript
import { describe, it, expect } from 'vitest'
import { useTempDirectory } from '@orchestr8/testkit/fs'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

describe('File Operations', () => {
  const tempDir = useTempDirectory()

  it('should create and read files in temp directory', () => {
    const filePath = join(tempDir.path, 'test.txt')

    writeFileSync(filePath, 'Hello World')
    const content = readFileSync(filePath, 'utf-8')

    expect(content).toBe('Hello World')
  })

  // Temp directory is automatically cleaned up after each test
})
```

### Using Fake Time

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useFakeTime } from '@orchestr8/testkit/env'

describe('Time-based Tests', () => {
  const fakeTime = useFakeTime()

  it('should control time', async () => {
    const start = Date.now()

    // Fast-forward 1 hour
    await fakeTime.tick(60 * 60 * 1000)

    const elapsed = Date.now() - start
    expect(elapsed).toBe(60 * 60 * 1000)
  })

  it('should handle setInterval', async () => {
    let count = 0
    setInterval(() => count++, 1000)

    await fakeTime.tick(5000)
    expect(count).toBe(5)
  })
})
```

### Using MSW (Mock Service Worker)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupMSW, http, HttpResponse } from '@orchestr8/testkit/msw'

describe('API Tests', () => {
  const msw = setupMSW([
    http.get('https://api.example.com/users', () => {
      return HttpResponse.json([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ])
    })
  ])

  beforeAll(() => msw.server.listen())
  afterAll(() => msw.server.close())

  it('should mock API responses', async () => {
    const response = await fetch('https://api.example.com/users')
    const users = await response.json()

    expect(users).toHaveLength(2)
    expect(users[0].name).toBe('Alice')
  })
})
```

### Using SQLite Databases

```typescript
import { describe, it, expect } from 'vitest'
import { useSQLiteDatabase } from '@orchestr8/testkit/sqlite'

describe('Database Tests', () => {
  const db = useSQLiteDatabase()

  it('should create and query tables', () => {
    db.instance.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )
    `)

    db.instance.exec(`
      INSERT INTO users (name) VALUES ('Alice'), ('Bob')
    `)

    const users = db.instance.prepare('SELECT * FROM users').all()
    expect(users).toHaveLength(2)
  })

  // Database is automatically cleaned up after each test
})
```

## Advanced Configuration

### Custom Vitest Config

```typescript
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createBaseVitestConfig({
    test: {
      name: 'my-project',
      environment: 'node',

      // Override defaults
      globals: true, // Enable global test APIs
      testTimeout: 10000, // Custom timeout

      // Add custom setup files
      setupFiles: ['./test/setup.ts'],

      // Custom coverage configuration
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'dist/',
          '**/*.config.*',
          '**/*.test.*'
        ]
      }
    }
  })
)
```

### Environment Detection

TestKit automatically detects your environment:

```typescript
import { getTestEnvironment } from '@orchestr8/testkit/env'

const env = getTestEnvironment()

console.log({
  isCI: env.isCI,           // Running in CI
  isWallaby: env.isWallaby, // Running in Wallaby
  isVitest: env.isVitest,   // Running in Vitest
  nodeEnv: env.nodeEnv      // NODE_ENV value
})
```

### Resource Cleanup

Enable automatic resource cleanup:

```typescript
// test/setup.ts
import { setupResourceCleanup } from '@orchestr8/testkit/config'

// Enable automatic cleanup after each test
await setupResourceCleanup({
  cleanupAfterEach: true,
  enableLeakDetection: true,
  logStats: false
})
```

### CI-Specific Configuration

TestKit automatically optimizes for CI:

```typescript
import { defineConfig } from 'vitest/config'
import { createCIConfig } from '@orchestr8/testkit/config'

// Use CI-optimized config in CI environments
export default defineConfig(
  process.env.CI
    ? createCIConfig()
    : createBaseVitestConfig()
)
```

## Package Exports

TestKit provides granular exports to avoid loading unnecessary dependencies:

```typescript
// Main utilities (no optional deps required)
import { delay, retry, withTimeout } from '@orchestr8/testkit'

// Environment utilities
import { getTestEnvironment, useFakeTime } from '@orchestr8/testkit/env'

// File system utilities
import { useTempDirectory } from '@orchestr8/testkit/fs'

// Vitest configuration
import { createBaseVitestConfig } from '@orchestr8/testkit/config'

// MSW support (requires msw peer dependency)
import { setupMSW, http } from '@orchestr8/testkit/msw'

// SQLite support (requires better-sqlite3 peer dependency)
import { useSQLiteDatabase } from '@orchestr8/testkit/sqlite'

// Convex support (requires convex-test peer dependency)
import { createConvexTestContext } from '@orchestr8/testkit/convex'

// Container support (requires testcontainers peer dependency)
import { startContainer } from '@orchestr8/testkit/containers'
```

## Best Practices

### 1. Use Sub-Exports

Import only what you need to keep bundle sizes small:

```typescript
// ✅ Good - Only loads fs utilities
import { useTempDirectory } from '@orchestr8/testkit/fs'

// ❌ Avoid - Loads entire package
import { useTempDirectory } from '@orchestr8/testkit'
```

### 2. Leverage Environment Detection

```typescript
import { getTestEnvironment } from '@orchestr8/testkit/env'

const env = getTestEnvironment()

const timeout = env.isCI ? 30000 : 5000
const retries = env.isCI ? 3 : 1
```

### 3. Clean Up Resources

```typescript
import { describe, it, afterEach } from 'vitest'
import { useTempDirectory } from '@orchestr8/testkit/fs'

describe('Tests', () => {
  const tempDir = useTempDirectory()

  // tempDir.path is unique for each test
  // Automatically cleaned up after each test
})
```

### 4. Use Type-Safe Mocks

```typescript
import { createMockFn } from '@orchestr8/testkit'

interface UserService {
  getUser(id: number): Promise<User>
}

const mockUserService = createMockFn<UserService['getUser']>()
  .mockResolvedValue({ id: 1, name: 'Alice' })
```

## Troubleshooting

### Error: "Vitest failed to access its internal state"

**Cause**: You're trying to import vitest internals in your config file.

**Solution**: Use `createBaseVitestConfig()` wrapped in `defineConfig()`:

```typescript
// ❌ Wrong - defineVitestConfig was removed
import { defineVitestConfig } from '@orchestr8/testkit/config'
export default defineVitestConfig({ ... })

// ✅ Correct
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@orchestr8/testkit/config'
export default defineConfig(createBaseVitestConfig({ ... }))
```

### Tests Timing Out in CI

TestKit automatically adjusts timeouts for CI, but you can customize:

```typescript
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createBaseVitestConfig({
    test: {
      testTimeout: process.env.CI ? 30000 : 5000,
    },
  })
)
```

### Module Resolution Errors

Ensure your TypeScript config uses modern module resolution:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler", // or "node16"
    "module": "ESNext"
  }
}
```

### Optional Dependencies Not Found

TestKit's optional features (MSW, SQLite, Convex, containers) require peer dependencies:

```bash
# Install only what you need
npm install -D msw              # For MSW support
npm install -D better-sqlite3   # For SQLite support
npm install -D convex-test      # For Convex support
```

## Migration from defineVitestConfig

If you're upgrading from an older version that used `defineVitestConfig`:

**Before (v1.0.7 and earlier):**
```typescript
import { defineVitestConfig } from '@orchestr8/testkit/config'

export default defineVitestConfig({
  test: {
    name: 'my-project',
    environment: 'node',
  },
})
```

**After (v1.0.8+):**
```typescript
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createBaseVitestConfig({
    test: {
      name: 'my-project',
      environment: 'node',
    },
  })
)
```

The functionality is identical - you just need to import `defineConfig` from `vitest/config` and wrap the result.

## Examples

### Complete Test Suite Example

```typescript
// src/user-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { retry, delay } from '@orchestr8/testkit'
import { setupMSW, http, HttpResponse } from '@orchestr8/testkit/msw'
import { UserService } from './user-service'

describe('UserService', () => {
  const msw = setupMSW()
  let service: UserService

  beforeEach(() => {
    service = new UserService('https://api.example.com')
  })

  it('should fetch users with retry on failure', async () => {
    let attempts = 0

    msw.server.use(
      http.get('https://api.example.com/users', () => {
        attempts++
        if (attempts < 3) {
          return new HttpResponse(null, { status: 500 })
        }
        return HttpResponse.json([{ id: 1, name: 'Alice' }])
      })
    )

    const users = await retry(
      () => service.getUsers(),
      { maxAttempts: 5, delay: 10 }
    )

    expect(users).toHaveLength(1)
    expect(attempts).toBe(3)
  })
})
```

## Support

- 📖 [API Reference](./README.md)
- 🐛 [Report Issues](https://github.com/nathanvale/orchestr8/issues)
- 💬 [Discussions](https://github.com/nathanvale/orchestr8/discussions)

## License

MIT - See LICENSE file for details
