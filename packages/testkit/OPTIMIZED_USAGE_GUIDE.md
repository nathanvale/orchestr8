# TestKit Optimized Usage Guide

> Advanced patterns, performance optimization, and resource management best practices

## Table of Contents

- [Resource Management](#resource-management)
- [Cleanup Patterns](#cleanup-patterns)
- [Performance Optimization](#performance-optimization)
- [Advanced Features](#advanced-features)
- [Lifecycle & Bootstrap](#lifecycle--bootstrap)
- [Common Pitfalls](#common-pitfalls)
- [Real-World Patterns](#real-world-patterns)

---

## Resource Management

### Understanding the Dual-Layer System

TestKit uses a **dual-layer resource management system**:

1. **Global ResourceManager** - Modern, centralized tracking
2. **Legacy Registries** - Backward compatibility (SQLite, MSW)

Both systems work together seamlessly.

### Resource Categories & Priority

Resources are cleaned in priority order:

```typescript
import { ResourceCategory } from '@orchestr8/testkit/config'

// Priority 0 (cleaned first)
ResourceCategory.CRITICAL
ResourceCategory.DATABASE

// Priority 1
ResourceCategory.FILE
ResourceCategory.NETWORK
ResourceCategory.PROCESS

// Priority 2 (cleaned last)
ResourceCategory.EVENT
ResourceCategory.TIMER
```

**Why Priority Matters:**
- Databases must close before files are deleted
- Network connections should close before processes terminate
- Event listeners and timers can be cleaned last

### Automatic Resource Registration

TestKit automatically registers common resources:

```typescript
import { createFileDatabase } from '@orchestr8/testkit/sqlite'
import { createTempDirectory } from '@orchestr8/testkit/fs'

// ✅ Auto-registered with ResourceManager
const db = await createFileDatabase('/tmp/test.db')
const temp = await createTempDirectory()

// No manual cleanup needed - handled automatically
```

### Manual Resource Registration

For custom resources:

```typescript
import { registerResource, ResourceCategory } from '@orchestr8/testkit/config'

const connection = await createConnection()

registerResource('my-connection',
  async () => {
    await connection.close()
  },
  {
    category: ResourceCategory.NETWORK,
    description: 'WebSocket connection',
    timeout: 5000,
    tags: ['websocket', 'connection'],
    dependencies: ['connection-pool'], // Clean this before pool
  }
)
```

### Resource Metadata & Tracking

```typescript
import { getResourceStats, detectResourceLeaks } from '@orchestr8/testkit/config'

// Get current stats
const stats = getResourceStats()
console.log({
  total: stats.total,
  byCategory: stats.byCategory,
  byPriority: stats.byPriority
})

// Detect leaks (resources older than threshold)
const leaks = detectResourceLeaks()
leaks.forEach(leak => {
  console.warn(`Leak: ${leak.resourceId} (${leak.age}ms old)`)
})
```

---

## Cleanup Patterns

### Pattern 1: Automatic Cleanup (Recommended)

**Setup once, forget about cleanup:**

```typescript
// vitest.setup.ts
import { setupResourceCleanup } from '@orchestr8/testkit/config'

// All resources cleaned automatically after each test
await setupResourceCleanup({
  cleanupAfterEach: true,
  cleanupAfterAll: true,
  enableLeakDetection: true,
  logStats: false
})
```

**In your tests:**

```typescript
import { describe, it, expect } from 'vitest'
import { createFileDatabase } from '@orchestr8/testkit/sqlite'
import { createTempDirectory } from '@orchestr8/testkit/fs'

describe('My Tests', () => {
  it('should work with auto-cleanup', async () => {
    const db = await createFileDatabase()
    const temp = await createTempDirectory()

    // Use resources freely
    db.exec('CREATE TABLE users (id INTEGER)')
    await temp.writeFile('data.json', '{}')

    // ✅ Automatically cleaned after test
  })
})
```

### Pattern 2: Scoped Cleanup

**Control cleanup scope explicitly:**

```typescript
import { withSqliteCleanupScope } from '@orchestr8/testkit/sqlite'

it('should cleanup scoped resources', async () => {
  await withSqliteCleanupScope(async () => {
    const db1 = await createFileDatabase()
    const db2 = await createMemoryDatabase()

    // Both databases registered in scope
    // Both cleaned when scope exits
  })

  // ✅ Resources cleaned here
})
```

### Pattern 3: Hook Pattern

**Per-test resource with automatic cleanup:**

```typescript
import { useSqliteCleanup } from '@orchestr8/testkit/sqlite'

describe('Database Tests', () => {
  const useDatabase = useSqliteCleanup(async () =>
    createFileDatabase()
  )

  it('test 1', async () => {
    const db = await useDatabase()
    // Use database
    // ✅ Cleaned after this test
  })

  it('test 2', async () => {
    const db = await useDatabase()
    // Fresh database for each test
    // ✅ Cleaned after this test
  })
})
```

### Pattern 4: Manual Control

**Fine-grained cleanup control:**

```typescript
import { useResourceManager } from '@orchestr8/testkit/config'

it('should manually control cleanup', async () => {
  const { cleanup, detectLeaks, getStats } = useResourceManager()

  const db = await createFileDatabase()

  // Do work...

  // Check for leaks before cleanup
  const leaks = detectLeaks()
  expect(leaks).toHaveLength(0)

  // Manual cleanup at specific point
  await cleanup()

  // Verify everything cleaned
  const stats = getStats()
  expect(stats.total).toBe(0)
})
```

### Pattern 5: Category-Specific Cleanup

**Clean only specific resource types:**

```typescript
import { cleanupAllResources, ResourceCategory } from '@orchestr8/testkit/config'

it('should cleanup only databases', async () => {
  const db = await createFileDatabase()
  const temp = await createTempDirectory()

  // Clean only databases
  await cleanupAllResources({
    categories: [ResourceCategory.DATABASE]
  })

  // db is closed, temp directory still exists
})
```

### Pattern 6: Exclude Categories

**Skip cleanup for certain resource types:**

```typescript
// vitest.setup.ts
import { setupResourceCleanup, ResourceCategory } from '@orchestr8/testkit/config'

await setupResourceCleanup({
  cleanupAfterEach: true,
  // Keep processes running between tests
  excludeCategories: [ResourceCategory.PROCESS]
})
```

### Pattern 7: Cleanup with Debugging

**Enable verbose logging for troubleshooting:**

```typescript
import { enableResourceCleanupWithDebugging } from '@orchestr8/testkit/config'

// In problematic test file
await enableResourceCleanupWithDebugging()

// Logs:
// - Resource registration
// - Cleanup execution
// - Leak detection
// - Error details
```

---

## Performance Optimization

### Environment-Aware Configuration

TestKit automatically optimizes for your environment:

```typescript
import { getTestEnvironment } from '@orchestr8/testkit/env'

const env = getTestEnvironment()

if (env.isCI) {
  // CI gets:
  // - 2x unit test timeouts (5s → 10s)
  // - 1.5x integration timeouts (15s → 22.5s)
  // - Max 2 workers (vs 4 locally)
  // - Bail on first failure
}

if (env.isWallaby) {
  // Wallaby gets:
  // - Single worker (maxWorkers: 1)
  // - Verbose reporters
  // - Coverage disabled
}
```

### Pool Strategy Selection

**Default: Forks (Stability)**

```typescript
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createBaseVitestConfig({
    test: {
      // ✅ Forks (default) - Better isolation
      pool: 'forks',

      poolOptions: {
        forks: {
          singleFork: false,
          maxForks: 4,
          minForks: 1
        }
      }
    }
  })
)
```

**Override: Threads (Speed)**

```typescript
export default defineConfig(
  createBaseVitestConfig({
    test: {
      // ⚡ Threads - Faster, but less isolation
      pool: 'threads',

      poolOptions: {
        threads: {
          singleThread: false,
          maxThreads: 8,
          minThreads: 2
        }
      }
    }
  })
)
```

**When to Use Each:**
- **Forks**: Database tests, file system tests, process spawning (better isolation)
- **Threads**: Pure computation, API mocking, unit tests (faster execution)

### Concurrency Management

TestKit limits concurrent operations to prevent memory pressure:

```typescript
import {
  fileOperationsManager,
  databaseOperationsManager,
  resourceCleanupManager
} from '@orchestr8/testkit/utils'

// Batch operations with concurrency limit
const results = await databaseOperationsManager.batch(
  items,
  async (item) => processItem(item)
)

// Limit Promise.all
import { limitedAll } from '@orchestr8/testkit/utils'

const promises = items.map(item => processItem(item))
const results = await limitedAll(promises, 5) // Max 5 concurrent
```

**Default Limits:**
- File operations: 10 concurrent
- Database operations: 5 concurrent
- Network operations: 3 concurrent
- Process spawning: 2 concurrent
- Resource cleanup: 8 concurrent

### Timeout Configuration

**Adjust timeouts based on test complexity:**

```typescript
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createBaseVitestConfig({
    test: {
      // Per-test timeout
      testTimeout: 10000,

      // Hook timeout (beforeEach, afterEach)
      hookTimeout: 5000,

      // Teardown timeout
      teardownTimeout: 20000,

      // Override per test
      // it('slow test', { timeout: 30000 }, async () => {})
    }
  })
)
```

### Memory Management

**Configure memory limits:**

```typescript
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createBaseVitestConfig({
    test: {
      poolOptions: {
        forks: {
          // Memory limit per worker (512MB default)
          execArgv: ['--max-old-space-size=1024']
        }
      }
    }
  })
)
```

**Monitor memory usage:**

```typescript
import { getResourceStats } from '@orchestr8/testkit/config'

it('should not leak memory', async () => {
  const before = process.memoryUsage()

  // Do work...

  const after = process.memoryUsage()
  const leaked = after.heapUsed - before.heapUsed

  expect(leaked).toBeLessThan(10 * 1024 * 1024) // Max 10MB growth
})
```

### Parallel vs Sequential Cleanup

```typescript
// Fast - parallel cleanup (default)
await cleanupAllResources({ parallel: true })

// Safe - sequential cleanup (respects dependencies)
await cleanupAllResources({ parallel: false })

// Mixed - parallel within categories, sequential between
await cleanupAllResources({
  parallel: true,
  categories: [ResourceCategory.DATABASE] // Only databases in parallel
})
```

---

## Advanced Features

### Temporary Directory Management

#### Basic Usage

```typescript
import { createTempDirectory, useTempDirectory } from '@orchestr8/testkit/fs'

// Pattern 1: Explicit creation
it('should create temp directory', async () => {
  const temp = await createTempDirectory({
    prefix: 'my-test-',
    randomSuffix: true
  })

  await temp.writeFile('config.json', JSON.stringify({ foo: 'bar' }))
  const data = await temp.readFile('config.json')

  // Auto-cleanup registered
})

// Pattern 2: Hook (recommended)
describe('File Tests', () => {
  const tempDir = useTempDirectory()

  it('test 1', async () => {
    await tempDir.writeFile('data.txt', 'hello')
    // Fresh temp dir per test
  })

  it('test 2', async () => {
    // New temp dir for this test
  })
})
```

#### Advanced Features

```typescript
const temp = await createTempDirectory()

// Create complex directory structure
await temp.createStructure({
  'src': {
    'index.ts': 'export const foo = "bar"',
    'components': {
      'Button.tsx': '// component code',
      'Input.tsx': '// component code'
    }
  },
  'tests': {
    'index.test.ts': '// test code'
  },
  'package.json': JSON.stringify({ name: 'my-package' })
})

// Copy files in
await temp.copyFileIn('/path/to/source.txt', 'dest.txt')

// List contents
const files = await temp.readdir()

// Check existence
const exists = await temp.exists('src/index.ts')

// Get full path
const fullPath = temp.resolve('src/index.ts')
```

#### Multiple Temp Directories

```typescript
import { createMultipleTempDirectories } from '@orchestr8/testkit/fs'

// Create 10 temp directories in parallel
const temps = await createMultipleTempDirectories(10, {
  prefix: 'parallel-test-'
})

// Use them...

// Cleanup all
await cleanupMultipleTempDirectories(temps)
```

### Fake Time Control

#### Timer Control

```typescript
import { useFakeTimers, withFakeTimers } from '@orchestr8/testkit/env'

describe('Timer Tests', () => {
  const fakeTime = useFakeTimers()

  it('should control setInterval', async () => {
    let count = 0
    setInterval(() => count++, 1000)

    await fakeTime.tick(5000)
    expect(count).toBe(5)
  })

  it('should control setTimeout', async () => {
    let executed = false
    setTimeout(() => executed = true, 1000)

    await fakeTime.tick(999)
    expect(executed).toBe(false)

    await fakeTime.tick(1)
    expect(executed).toBe(true)
  })

  it('should run all timers', async () => {
    let count = 0
    setTimeout(() => count++, 1000)
    setTimeout(() => count++, 2000)
    setTimeout(() => count++, 3000)

    await fakeTime.runAll()
    expect(count).toBe(3)
  })
})

// Alternative: scoped fake timers
await withFakeTimers(async (timers) => {
  setTimeout(() => {}, 1000)
  await timers.tick(1000)
  // Auto-restored after
})
```

#### System Time Mocking

```typescript
import { createSystemTimeContext, withSystemTime } from '@orchestr8/testkit/env'

it('should mock current time', async () => {
  const ctx = createSystemTimeContext()

  ctx.setTime(new Date('2024-01-01T00:00:00Z'))

  expect(Date.now()).toBe(new Date('2024-01-01').getTime())
  expect(new Date()).toEqual(new Date('2024-01-01'))

  ctx.restore()
})

// Alternative: scoped system time
await withSystemTime('2024-01-01', async (ctx) => {
  // All Date operations use mocked time
  const now = new Date()
  expect(now.getFullYear()).toBe(2024)
})
```

#### Timezone Testing

```typescript
import { createTimezoneContext, withTimezone } from '@orchestr8/testkit/env'

it('should test in different timezones', async () => {
  const tz = createTimezoneContext()

  tz.setTimezone('America/New_York')
  // Test in EST/EDT

  tz.setTimezone('UTC')
  // Test in UTC

  tz.restore()
})

// Alternative: scoped timezone
await withTimezone('America/New_York', async () => {
  const date = new Date('2024-06-01T12:00:00Z')
  // Displays in EDT (GMT-4)
})
```

#### Advanced Timer Control

```typescript
import { createTimerController } from '@orchestr8/testkit/env'

it('should step through timers', async () => {
  const controller = createTimerController()

  let count = 0
  setInterval(() => count++, 1000)
  setInterval(() => count++, 500)

  // Execute next pending timer
  await controller.advanceToNext()
  expect(count).toBe(1) // 500ms timer

  await controller.advanceToNext()
  expect(count).toBe(2) // 500ms timer again

  await controller.advanceToNext()
  expect(count).toBe(3) // 1000ms timer

  // Step through N timers
  await controller.stepThrough(5)
  expect(count).toBe(8)

  // Check pending timers
  const pending = controller.getTimerCount()
})
```

### SQLite Connection Pooling

#### Basic Pool Usage

```typescript
import { SQLiteConnectionPool } from '@orchestr8/testkit/sqlite'

const pool = new SQLiteConnectionPool('/tmp/test.db', {
  maxConnections: 10,
  minConnections: 2,
  idleTimeout: 30000,
  acquireTimeout: 5000,
  enableSharedCache: true,
  validateConnections: true,
  pragmaSettings: {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    foreign_keys: 'ON',
    temp_store: 'MEMORY'
  }
})

// Acquire connection
const db = await pool.acquire()
try {
  db.exec('SELECT 1')
} finally {
  // ⚠️ MUST release
  await pool.release(db)
}

// Cleanup all connections
await pool.drain()
```

#### Pool Statistics

```typescript
const stats = pool.getStats()
console.log({
  totalConnections: stats.totalConnections,
  activeConnections: stats.activeConnections,
  idleConnections: stats.idleConnections,
  waitingRequests: stats.waitingRequests,
  totalAcquired: stats.totalAcquired,
  totalReleased: stats.totalReleased
})
```

#### Pool Helpers

```typescript
import { withPooledConnection } from '@orchestr8/testkit/sqlite'

// Automatic acquire/release
const result = await withPooledConnection(pool, async (db) => {
  return db.prepare('SELECT * FROM users').all()
})

// Connection auto-released even on error
```

### MSW Server Lifecycle

#### Standard Setup

```typescript
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

  // msw.server available in tests

  it('should override handler', async () => {
    msw.server.use(
      http.get('https://api.example.com/users', () => {
        return HttpResponse.json([{ id: 3, name: 'Charlie' }])
      })
    )

    // Handler override only for this test
  })
})
```

#### Global Server

```typescript
// vitest.setup.ts
import { setupMSWGlobal, http } from '@orchestr8/testkit/msw'

const globalHandlers = [
  http.get('https://api.example.com/*', () => {
    return HttpResponse.json({ default: 'response' })
  })
]

const { setup, teardown } = setupMSWGlobal(globalHandlers)

// Call once for all tests
await setup()

// In tests - handlers are already active

// At the end
await teardown()
```

#### Manual Control

```typescript
import { setupMSWManual } from '@orchestr8/testkit/msw'

const { start, stop, reset, dispose } = setupMSWManual(handlers)

beforeAll(async () => await start())
afterEach(() => reset()) // Reset between tests
afterAll(async () => await dispose())
```

---

## Lifecycle & Bootstrap

### Bootstrap Sequence

TestKit's bootstrap runs **before** any test code:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createBaseVitestConfig({
    test: {
      // Bootstrap runs first
      setupFiles: ['@orchestr8/testkit/register'],

      // Your setup runs after
      // setupFiles: ['@orchestr8/testkit/register', './test/setup.ts']
    }
  })
)
```

**What Bootstrap Does:**

1. Sets up `vi.mock()` hoisting
2. Configures process mocking (for CLI tests)
3. Registers process listener cleanup
4. Sets environment defaults
5. Configures memory limits and timeouts

### Custom Setup File

```typescript
// test/setup.ts
import { setupResourceCleanup } from '@orchestr8/testkit/config'

// Global setup
await setupResourceCleanup({
  cleanupAfterEach: true,
  enableLeakDetection: true
})

// Global mocks
vi.mock('./lib/external-api')

// Global test utilities
globalThis.testUtils = {
  createUser: () => ({ id: 1, name: 'Test User' })
}
```

### Process Exit Handlers

```typescript
import { createExitHandler } from '@orchestr8/testkit/utils'

const removeHandler = createExitHandler(
  async () => {
    await db.close()
    await server.stop()
  },
  {
    events: ['exit', 'SIGINT', 'SIGTERM', 'uncaughtException'],
    description: 'Emergency cleanup',
    timeout: 5000
  }
)

// Remove handler when done
removeHandler()
```

### Process Listener Management

```typescript
import { addProcessListener, removeAllProcessListeners } from '@orchestr8/testkit/utils'

it('should manage process listeners', () => {
  const cleanup = addProcessListener('SIGINT',
    () => console.log('Interrupt'),
    { description: 'SIGINT handler', once: true }
  )

  // Listener tracked and auto-cleaned in afterEach
})

// Manual cleanup
afterEach(() => {
  removeAllProcessListeners()
})
```

---

## Common Pitfalls

### 1. Forgetting to Release Pooled Resources

❌ **Wrong:**
```typescript
const db = await pool.acquire()
db.exec('SELECT 1')
// LEAK - never released
```

✅ **Correct:**
```typescript
const db = await pool.acquire()
try {
  db.exec('SELECT 1')
} finally {
  await pool.release(db)
}
```

### 2. Cleanup Order Violations

❌ **Wrong:**
```typescript
await temp.cleanup()      // Files deleted
await db.close()          // Can't flush to deleted file
```

✅ **Correct:**
```typescript
await db.close()          // Close connections first
await temp.cleanup()      // Then cleanup files
```

**Solution:** Use resource dependencies:
```typescript
registerResource('db', () => db.close(), {
  dependencies: ['temp']  // Cleanup before temp
})
```

### 3. Missing Resource Registration

❌ **Wrong:**
```typescript
const fd = fs.openSync('/tmp/file.txt', 'r')
// Not tracked - will leak
```

✅ **Correct:**
```typescript
import { registerFileDescriptor } from '@orchestr8/testkit/config'

const fd = fs.openSync('/tmp/file.txt', 'r')
registerFileDescriptor('my-file', fd, '/tmp/file.txt')
```

### 4. Process Listener Leaks

❌ **Wrong:**
```typescript
process.on('SIGINT', handler)
// No cleanup - leaks across tests
```

✅ **Correct:**
```typescript
import { addProcessListener } from '@orchestr8/testkit/utils'

addProcessListener('SIGINT', handler, {
  description: 'My handler'
})
// Auto-cleaned in afterEach
```

### 5. Incorrect Dependency Order

❌ **Wrong:**
```typescript
registerResource('tx', () => tx.rollback())
registerResource('pool', () => pool.close(), {
  dependencies: ['tx']  // ERROR - tx registered after pool
})
```

✅ **Correct:**
```typescript
registerResource('pool', () => pool.close())
registerResource('tx', () => tx.rollback(), {
  dependencies: ['pool']  // tx cleaned before pool
})
```

### 6. Parallel Cleanup with Dependencies

❌ **Wrong:**
```typescript
await cleanupAllResources({ parallel: true })
// Ignores dependencies - can break
```

✅ **Correct:**
```typescript
await cleanupAllResources({ parallel: false })
// Respects dependencies
```

### 7. Timeout Too Short

❌ **Wrong:**
```typescript
registerResource('big-db', () => db.close())
// Uses default 10s timeout - might fail for large DB
```

✅ **Correct:**
```typescript
registerResource('big-db', () => db.close(), {
  timeout: 30000  // 30s for large database
})
```

### 8. Not Handling Cleanup Errors

❌ **Wrong:**
```typescript
await cleanupAllResources()
// Stops on first error
```

✅ **Correct:**
```typescript
const result = await cleanupAllResources({
  continueOnError: true
})

if (result.errors.length > 0) {
  console.error('Cleanup errors:', result.errors)
}
```

---

## Real-World Patterns

### Pattern: Test Suite with Database

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useSqliteCleanup } from '@orchestr8/testkit/sqlite'
import { setupResourceCleanup } from '@orchestr8/testkit/config'

// Setup auto-cleanup once
await setupResourceCleanup()

describe('User Service', () => {
  const useDatabase = useSqliteCleanup(async () => {
    const db = await createFileDatabase()

    // Migrations
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE
      )
    `)

    return db
  })

  it('should create user', async () => {
    const db = await useDatabase()

    db.exec(`INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')`)

    const users = db.prepare('SELECT * FROM users').all()
    expect(users).toHaveLength(1)

    // ✅ Database auto-cleaned after test
  })

  it('should enforce unique email', async () => {
    const db = await useDatabase()

    db.exec(`INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')`)

    expect(() => {
      db.exec(`INSERT INTO users (name, email) VALUES ('Bob', 'alice@example.com')`)
    }).toThrow(/UNIQUE constraint/)
  })
})
```

### Pattern: Integration Test with Multiple Resources

```typescript
import { describe, it, expect } from 'vitest'
import { useTempDirectory } from '@orchestr8/testkit/fs'
import { useSqliteCleanup } from '@orchestr8/testkit/sqlite'
import { setupMSW, http, HttpResponse } from '@orchestr8/testkit/msw'

describe('File Upload Service', () => {
  const tempDir = useTempDirectory()
  const useDatabase = useSqliteCleanup(createDatabase)
  const msw = setupMSW([
    http.post('https://storage.api.com/upload', async ({ request }) => {
      const formData = await request.formData()
      return HttpResponse.json({ id: 'file-123' })
    })
  ])

  it('should upload file and record in database', async () => {
    const db = await useDatabase()

    // Create file in temp directory
    await tempDir.writeFile('upload.txt', 'test content')
    const filePath = tempDir.resolve('upload.txt')

    // Upload via service
    const result = await uploadService.upload(filePath)

    // Verify API called
    expect(result.storageId).toBe('file-123')

    // Verify database record
    const records = db.prepare('SELECT * FROM uploads').all()
    expect(records).toHaveLength(1)

    // ✅ All resources auto-cleaned: temp dir, database, MSW server
  })
})
```

### Pattern: Performance Testing with Concurrency

```typescript
import { describe, it, expect } from 'vitest'
import { limitedAll, databaseOperationsManager } from '@orchestr8/testkit/utils'

describe('Bulk Operations', () => {
  it('should handle bulk inserts with concurrency control', async () => {
    const db = await createFileDatabase()

    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      data: `item-${i}`
    }))

    // Insert with concurrency limit
    await databaseOperationsManager.batch(items, async (item) => {
      db.prepare('INSERT INTO items (id, data) VALUES (?, ?)')
        .run(item.id, item.data)
    })

    const count = db.prepare('SELECT COUNT(*) as count FROM items').get()
    expect(count.count).toBe(1000)
  })

  it('should handle parallel API calls with limit', async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      fetch(`https://api.example.com/items/${i}`)
    )

    // Max 5 concurrent requests
    const results = await limitedAll(promises, 5)
    expect(results).toHaveLength(100)
  })
})
```

### Pattern: Time-Dependent Tests

```typescript
import { describe, it, expect } from 'vitest'
import { useFakeTimers } from '@orchestr8/testkit/env'

describe('Session Expiry', () => {
  const fakeTime = useFakeTimers()

  it('should expire session after 1 hour', async () => {
    const session = createSession()

    expect(session.isValid()).toBe(true)

    // Fast-forward 59 minutes
    await fakeTime.tick(59 * 60 * 1000)
    expect(session.isValid()).toBe(true)

    // Fast-forward 1 more minute
    await fakeTime.tick(60 * 1000)
    expect(session.isValid()).toBe(false)
  })

  it('should handle interval-based polling', async () => {
    let pollCount = 0
    const poller = startPolling(() => pollCount++, 1000)

    // Wait for 5 polls
    await fakeTime.tick(5000)
    expect(pollCount).toBe(5)

    poller.stop()
  })
})
```

### Pattern: Emergency Cleanup

```typescript
import { createExitHandler } from '@orchestr8/testkit/utils'
import { registerResource } from '@orchestr8/testkit/config'

// Global setup
const server = await startServer()
const db = await connectDatabase()

// Register cleanup with timeout protection
registerResource('server', () => server.stop(), {
  timeout: 5000,
  category: ResourceCategory.NETWORK
})

registerResource('database', () => db.close(), {
  timeout: 10000,
  category: ResourceCategory.DATABASE
})

// Emergency cleanup on process exit
createExitHandler(
  async () => {
    console.log('Emergency cleanup started')
    await cleanupAllResources({ timeout: 5000 })
    console.log('Emergency cleanup complete')
  },
  {
    events: ['SIGINT', 'SIGTERM', 'uncaughtException'],
    timeout: 10000
  }
)
```

---

## Summary: Best Practices Checklist

✅ **Resource Management**
- [ ] Use automatic cleanup via `setupResourceCleanup()`
- [ ] Register all long-lived resources
- [ ] Use hook patterns (`useSqliteCleanup`, `useTempDirectory`)
- [ ] Set appropriate timeouts for cleanup
- [ ] Use resource categories and priorities correctly

✅ **Performance**
- [ ] Choose correct pool strategy (forks vs threads)
- [ ] Set appropriate worker counts for environment
- [ ] Use concurrency managers for bulk operations
- [ ] Monitor memory usage in long-running tests
- [ ] Configure timeouts based on test complexity

✅ **Cleanup Patterns**
- [ ] Always use try/finally for pooled resources
- [ ] Respect cleanup order (close connections before deleting files)
- [ ] Handle cleanup errors gracefully
- [ ] Enable leak detection in development
- [ ] Test cleanup in CI with `continueOnError: true`

✅ **Advanced Features**
- [ ] Use temp directories instead of hardcoded paths
- [ ] Mock time for time-dependent tests
- [ ] Use connection pools for database tests
- [ ] Configure MSW server lifecycle correctly
- [ ] Clean up process listeners

✅ **Debugging**
- [ ] Enable `logStats` when troubleshooting
- [ ] Use `detectResourceLeaks()` to find issues
- [ ] Check resource stats with `getResourceStats()`
- [ ] Use `enableResourceCleanupWithDebugging()` for verbose output
- [ ] Monitor process listeners with `getActiveListeners()`

---

## Additional Resources

- [Consumer Setup Guide](./CONSUMER_SETUP.md) - Getting started
- [API Reference](./README.md) - Complete API documentation
- [Examples](./examples/) - Real-world usage examples

---

**Last Updated:** 2024-10-03
**TestKit Version:** 1.0.8+
