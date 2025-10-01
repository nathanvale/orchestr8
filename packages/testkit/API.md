# @orchestr8/testkit API Reference

Complete API reference for all modules and functions in @orchestr8/testkit.

## Table of Contents

- [Core Utilities](#core-utilities)
- [Security Validation](#security-validation)
- [Resource Management](#resource-management)
- [Concurrency Control](#concurrency-control)
- [Environment Control](#environment-control)
- [File System Utilities](#file-system-utilities)
- [CLI Process Mocking](#cli-process-mocking)
- [SQLite Testing](#sqlite-testing)
- [MSW Mock Server](#msw-mock-server)
- [Container Testing](#container-testing)
- [Convex Testing](#convex-testing)
- [Configuration](#configuration)
- [Types](#types)

---

## Core Utilities

### `delay(ms: number): Promise<void>`

Wait for a specified amount of time.

**Parameters:**
- `ms` - Number of milliseconds to wait

**Example:**
```typescript
import { delay } from '@orchestr8/testkit'

await delay(1000) // Wait 1 second
```

### `retry<T>(fn: () => Promise<T>, maxAttempts?: number, baseDelay?: number): Promise<T>`

Retry a function until it succeeds or max attempts reached.

**Parameters:**
- `fn` - Function to retry
- `maxAttempts` - Maximum number of attempts (default: 3)
- `baseDelay` - Base delay between attempts in ms (default: 1000)

**Returns:** Promise resolving to the function result

**Example:**
```typescript
import { retry } from '@orchestr8/testkit'

const result = await retry(
  async () => {
    const response = await fetch('/api/data')
    if (!response.ok) throw new Error('Failed')
    return response.json()
  },
  3,
  1000
)
```

### `withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T>`

Add a timeout to a promise that rejects after specified time.

**Parameters:**
- `promise` - Promise to add timeout to
- `timeoutMs` - Timeout in milliseconds

**Returns:** Promise that rejects with timeout error if exceeded

**Example:**
```typescript
import { withTimeout } from '@orchestr8/testkit'

const data = await withTimeout(fetchLargeDataset(), 5000)
```

### `createMockFn<TArgs, TReturn>(implementation?: (...args: TArgs) => TReturn)`

Create a framework-agnostic mock function with call tracking.

**Parameters:**
- `implementation` - Optional implementation function

**Returns:** Mock function with vitest-compatible interface

**Example:**
```typescript
import { createMockFn } from '@orchestr8/testkit'

const mockFn = createMockFn((x: number) => x * 2)
expect(mockFn(5)).toBe(10)
expect(mockFn.calls).toHaveLength(1)
```

---

## Security Validation

### `validateCommand(cmd: string): void`

Validate a command string and throw if dangerous patterns detected.

**Parameters:**
- `cmd` - Command string to validate

**Throws:** `SecurityValidationError` if command is dangerous

**Example:**
```typescript
import { validateCommand } from '@orchestr8/testkit'

validateCommand('echo hello') // ✅ OK
validateCommand('rm -rf /') // ❌ Throws SecurityValidationError
```

### `sanitizeCommand(cmd: string): string`

Sanitize a command string by escaping dangerous shell metacharacters.

**Parameters:**
- `cmd` - Command string to sanitize

**Returns:** Sanitized command string

**Example:**
```typescript
import { sanitizeCommand } from '@orchestr8/testkit'

const safe = sanitizeCommand('echo "hello; rm -rf /"')
// Returns: 'echo "hello\\; rm -rf /"'
```

### `validatePath(basePath: string, relativePath: string): string`

Validate a path to prevent directory traversal attacks.

**Parameters:**
- `basePath` - Base directory that access should be restricted to
- `relativePath` - Relative path to validate

**Returns:** Resolved safe path

**Throws:** `SecurityValidationError` if path is unsafe

**Example:**
```typescript
import { validatePath } from '@orchestr8/testkit'

const safePath = validatePath('/tmp/test', 'file.txt')
// Returns: '/tmp/test/file.txt'

validatePath('/tmp/test', '../../../etc/passwd')
// Throws SecurityValidationError
```

### `sanitizeSqlIdentifier(identifier: string): string`

Sanitize a SQL identifier to prevent SQL injection.

**Parameters:**
- `identifier` - SQL identifier to sanitize

**Returns:** Sanitized identifier

**Throws:** `SecurityValidationError` if identifier is invalid

**Example:**
```typescript
import { sanitizeSqlIdentifier } from '@orchestr8/testkit'

const tableName = sanitizeSqlIdentifier('user_table') // ✅ OK
sanitizeSqlIdentifier('table; DROP TABLE users;') // ❌ Throws
```

### `escapeShellArg(arg: string): string`

Properly escape a shell argument to prevent injection.

**Parameters:**
- `arg` - Argument to escape

**Returns:** Escaped argument

**Example:**
```typescript
import { escapeShellArg } from '@orchestr8/testkit'

const escaped = escapeShellArg('hello world; rm -rf /')
// Returns: "'hello world; rm -rf /'"
```

### `validateShellExecution(command: string, args?: string[]): { command: string; args: string[] }`

Comprehensive security validation for shell commands with arguments.

**Parameters:**
- `command` - Base command
- `args` - Array of arguments

**Returns:** Object with sanitized command and escaped arguments

**Example:**
```typescript
import { validateShellExecution } from '@orchestr8/testkit'

const result = validateShellExecution('echo', ['hello', 'world; rm -rf /'])
// Returns: { command: 'echo', args: ['hello', "'world; rm -rf /'"] }
```

---

## Resource Management

### `registerResource(id: string, cleanup: CleanupFunction, options?: ResourceOptions): void`

Register a resource for automatic cleanup.

**Parameters:**
- `id` - Unique identifier for the resource
- `cleanup` - Function to call for cleanup
- `options` - Optional resource configuration

**Example:**
```typescript
import { registerResource, ResourceCategory, ResourcePriority } from '@orchestr8/testkit'

registerResource('db-connection', () => db.close(), {
  category: ResourceCategory.DATABASE,
  priority: ResourcePriority.CRITICAL,
  description: 'Main database connection'
})
```

### `cleanupAllResources(options?: CleanupOptions): Promise<CleanupResult>`

Clean up all registered resources.

**Parameters:**
- `options` - Optional cleanup configuration

**Returns:** Promise with cleanup results

**Example:**
```typescript
import { cleanupAllResources } from '@orchestr8/testkit'

const result = await cleanupAllResources({
  timeout: 10000,
  stopOnFirstError: false
})

console.log(`Cleaned ${result.successful} resources`)
```

### `getResourceStats(): ResourceStats`

Get current resource statistics.

**Returns:** Object with resource statistics

**Example:**
```typescript
import { getResourceStats } from '@orchestr8/testkit'

const stats = getResourceStats()
console.log(`Active resources: ${stats.active}`)
console.log(`Total registered: ${stats.total}`)
```

### `detectResourceLeaks(): ResourceLeak[]`

Detect potential resource leaks.

**Returns:** Array of potential resource leaks

**Example:**
```typescript
import { detectResourceLeaks } from '@orchestr8/testkit'

const leaks = detectResourceLeaks()
if (leaks.length > 0) {
  console.warn('Potential resource leaks detected:', leaks)
}
```

### `ResourceManager`

Main resource management class.

**Constructor:**
```typescript
new ResourceManager(config?: ResourceManagerConfig)
```

**Methods:**
- `register(id, cleanup, options)` - Register a resource
- `cleanup(options)` - Clean up all resources
- `cleanupByCategory(category)` - Clean up resources by category
- `remove(id)` - Remove a specific resource
- `has(id)` - Check if resource exists
- `getStats()` - Get statistics
- `detectLeaks()` - Detect leaks
- `on(event, callback)` - Listen to events

**Example:**
```typescript
import { ResourceManager, ResourceCategory } from '@orchestr8/testkit'

const manager = new ResourceManager({
  defaultTimeout: 5000,
  enableLogging: true
})

manager.register('connection', () => connection.close(), {
  category: ResourceCategory.DATABASE
})

await manager.cleanup()
```

---

## Concurrency Control

### `limitConcurrency<T>(fn: () => Promise<T>, maxConcurrent?: number): Promise<T>`

Execute a function with concurrency limiting.

**Parameters:**
- `fn` - Function to execute
- `maxConcurrent` - Maximum concurrent executions (default: 5)

**Returns:** Promise with function result

**Example:**
```typescript
import { limitConcurrency } from '@orchestr8/testkit'

const tasks = Array.from({ length: 10 }, (_, i) =>
  limitConcurrency(() => processItem(i), 3)
)
await Promise.all(tasks) // Only 3 running at once
```

### `limitedPromiseAll<T>(promises: Promise<T>[], options?: BatchOptions): Promise<T[]>`

Process an array of promises with concurrency limiting.

**Parameters:**
- `promises` - Array of promises to process
- `options` - Batch processing options

**Returns:** Promise with array of results

**Example:**
```typescript
import { limitedPromiseAll } from '@orchestr8/testkit'

const promises = items.map(item => processItem(item))
const results = await limitedPromiseAll(promises, { maxConcurrent: 5 })
```

### `ConcurrencyManager`

Manage concurrency for a group of operations.

**Constructor:**
```typescript
new ConcurrencyManager(options: ConcurrencyOptions)
```

**Methods:**
- `execute<T>(fn: () => Promise<T>): Promise<T>` - Execute with concurrency control
- `waitForSlot(): Promise<void>` - Wait for available slot
- `getStats(): { active: number; queued: number; total: number }` - Get statistics

**Example:**
```typescript
import { ConcurrencyManager } from '@orchestr8/testkit'

const manager = new ConcurrencyManager({ maxConcurrent: 3 })

const result = await manager.execute(async () => {
  return await heavyComputation()
})
```

### Predefined Managers

Pre-configured concurrency managers for common operations:

- `databaseOperationsManager` - Database operations (limit: 3)
- `fileOperationsManager` - File operations (limit: 10)
- `networkOperationsManager` - Network operations (limit: 5)
- `processSpawningManager` - Process spawning (limit: 3)
- `resourceCleanupManager` - Resource cleanup (limit: 10)

**Example:**
```typescript
import { databaseOperationsManager } from '@orchestr8/testkit'

await databaseOperationsManager.execute(() => db.query('SELECT * FROM users'))
```

---

## Environment Control

*Requires: `@orchestr8/testkit/env`*

### `getTestEnvironment(): TestEnvironment`

Get information about the current test environment.

**Returns:** Object with environment information

**Example:**
```typescript
import { getTestEnvironment } from '@orchestr8/testkit/env'

const env = getTestEnvironment()
console.log({
  runner: env.runner, // 'vitest' | 'wallaby' | 'jest' | 'node'
  isCI: env.isCI,
  isWallaby: env.isWallaby,
  nodeVersion: env.nodeVersion
})
```

### `setupTestEnv(vars: Record<string, string>): { restore: () => void }`

Set up temporary environment variables for testing.

**Parameters:**
- `vars` - Object with environment variables to set

**Returns:** Object with restore function

**Example:**
```typescript
import { setupTestEnv } from '@orchestr8/testkit/env'

const envRestore = setupTestEnv({
  NODE_ENV: 'production',
  API_URL: 'https://staging.example.com'
})

// Test with custom environment
expect(process.env.NODE_ENV).toBe('production')

envRestore.restore()
```

### `useFakeTime(initialTime?: Date | number): FakeTimeController`

Control time for deterministic testing.

**Parameters:**
- `initialTime` - Initial time to set (default: current time)

**Returns:** Controller for time manipulation

**Example:**
```typescript
import { useFakeTime } from '@orchestr8/testkit/env'

const timeController = useFakeTime(new Date('2023-01-01'))
expect(Date.now()).toBe(new Date('2023-01-01').getTime())

timeController.advance(1000 * 60 * 60) // Advance 1 hour
timeController.restore()
```

### `controlRandomness(seed: number | string): RandomController`

Control randomness for deterministic testing.

**Parameters:**
- `seed` - Seed for random number generation

**Returns:** Controller for randomness manipulation

**Example:**
```typescript
import { controlRandomness } from '@orchestr8/testkit/env'

const randomController = controlRandomness(12345)
expect(Math.random()).toBe(0.123456789) // Deterministic

randomController.reset() // Reset to same seed
randomController.restore() // Restore original Math.random
```

### `quickRandom`

Quick random helpers for common patterns.

**Methods:**
- `sequence(values: number[]): () => void` - Mock with sequence
- `fixed(value: number): () => void` - Mock with single value
- `predictable(seed: number | string): () => void` - Seeded deterministic random
- `restore(): void` - Restore all random mocks

**Example:**
```typescript
import { quickRandom } from '@orchestr8/testkit/env'

const restore = quickRandom.sequence([0.1, 0.5, 0.9])
expect(Math.random()).toBe(0.1)
expect(Math.random()).toBe(0.5)
restore()
```

### `quickCrypto`

Quick crypto helpers for mocking crypto APIs.

**Methods:**
- `uuid(uuids: string[]): () => void` - Mock UUID sequence
- `sequential(prefix: string): () => void` - Sequential UUIDs
- `seeded(seed: number | string): () => void` - Seeded UUID generation
- `randomValues(pattern: number[] | SeededRandom): () => void` - Mock getRandomValues
- `deterministicUUID(seed: string): string` - Generate deterministic UUID
- `restore(): void` - Restore all crypto mocks

**Example:**
```typescript
import { quickCrypto } from '@orchestr8/testkit/env'

const restore = quickCrypto.uuid([
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001'
])

expect(crypto.randomUUID()).toBe('550e8400-e29b-41d4-a716-446655440000')
restore()
```

---

## File System Utilities

*Requires: `@orchestr8/testkit/fs`*

### `createTempDirectory(options?: TempDirectoryOptions): TempDirectory`

Create a temporary directory for testing.

**Parameters:**
- `options` - Optional configuration

**Returns:** Temporary directory object with cleanup

**Example:**
```typescript
import { createTempDirectory } from '@orchestr8/testkit/fs'

const tempDir = createTempDirectory({ prefix: 'test-' })
console.log(tempDir.path) // e.g., '/tmp/test-abc123'

// Automatic cleanup when test completes
```

### `createTempDirectoryWithResourceManager(options?: TempDirectoryOptions): Promise<TempDirectory>`

Create a temporary directory with resource manager integration.

**Parameters:**
- `options` - Optional configuration

**Returns:** Promise with temporary directory object

**Example:**
```typescript
import { createTempDirectoryWithResourceManager } from '@orchestr8/testkit/fs'

const tempDir = await createTempDirectoryWithResourceManager({
  prefix: 'test-',
  cleanup: true
})

// Automatically registered for cleanup
```

### `ensureDirectoryExists(dirPath: string): Promise<void>`

Ensure a directory exists, creating it if necessary.

**Parameters:**
- `dirPath` - Path to directory

**Example:**
```typescript
import { ensureDirectoryExists } from '@orchestr8/testkit/fs'

await ensureDirectoryExists('/tmp/test/subdir')
```

### `safePathJoin(...parts: string[]): string`

Safely join path components with validation.

**Parameters:**
- `parts` - Path components to join

**Returns:** Joined path

**Example:**
```typescript
import { safePathJoin } from '@orchestr8/testkit/fs'

const path = safePathJoin('/tmp', 'test', 'file.txt')
// Returns: '/tmp/test/file.txt'
```

---

## CLI Process Mocking

*Requires: `@orchestr8/testkit/cli`*

### `spawnUtils`

Utilities for mocking spawned processes.

**Methods:**
- `mockCommandSuccess(command, stdout?, stderr?, exitCode?)` - Mock successful command
- `mockCommandFailure(command, stderr?, exitCode?, stdout?)` - Mock failed command
- `mockCommandError(command, error)` - Mock command that throws
- `mockLongRunningCommand(command, delay, stdout?, exitCode?)` - Mock with delay
- `restore()` - Restore all mocks

**Example:**
```typescript
import { spawnUtils } from '@orchestr8/testkit/cli'
import { exec } from 'child_process'

spawnUtils.mockCommandSuccess('git status', 'nothing to commit, working tree clean')

const result = await new Promise((resolve, reject) => {
  exec('git status', (error, stdout) => {
    if (error) reject(error)
    else resolve(stdout)
  })
})

expect(result).toContain('nothing to commit')
```

### `createProcessMock(command: string): SpawnMockBuilder`

Create a fluent process mock builder.

**Parameters:**
- `command` - Command to mock

**Returns:** Builder for configuring the mock

**Example:**
```typescript
import { createProcessMock } from '@orchestr8/testkit/cli'

const mock = createProcessMock('deploy')
  .withStdout('Deploying...')
  .withDelay(500)
  .withExitCode(0)
  .register()
```

### `mockProcess(): ProcessTracker`

Create a process tracker for verifying calls.

**Returns:** Tracker for inspecting process calls

**Example:**
```typescript
import { mockProcess } from '@orchestr8/testkit/cli'
import { exec } from 'child_process'

const tracker = mockProcess()
exec('git status')

expect(tracker.getCalls()).toHaveLength(1)
tracker.clear()
```

---

## SQLite Testing

*Requires: `@orchestr8/testkit/sqlite` and `better-sqlite3`*

### `createSQLiteDatabase(url: string): Database`

Create a SQLite database connection.

**Parameters:**
- `url` - Database URL or path

**Returns:** Database connection

**Example:**
```typescript
import { createSQLiteDatabase, createMemoryUrl } from '@orchestr8/testkit/sqlite'

const url = createMemoryUrl('raw')
const db = createSQLiteDatabase(url)
```

### `createMemoryDatabase(url?: string): Database`

Create an in-memory SQLite database.

**Parameters:**
- `url` - Optional memory URL

**Returns:** Database connection

**Example:**
```typescript
import { createMemoryDatabase } from '@orchestr8/testkit/sqlite'

const db = createMemoryDatabase()
```

### `createFileDatabase(filename: string): Promise<{ db: Database; cleanup: () => Promise<void> }>`

Create a file-based SQLite database with cleanup.

**Parameters:**
- `filename` - Database filename

**Returns:** Promise with database and cleanup function

**Example:**
```typescript
import { createFileDatabase } from '@orchestr8/testkit/sqlite'

const { db, cleanup } = await createFileDatabase('test.db')

// Use database
await db.exec('CREATE TABLE test (id INTEGER)')

// Clean up
await cleanup()
```

### `createSQLitePool(options: SQLitePoolOptions): SQLitePool`

Create a SQLite connection pool.

**Parameters:**
- `options` - Pool configuration options

**Returns:** Connection pool

**Example:**
```typescript
import { createSQLitePool, createMemoryUrl } from '@orchestr8/testkit/sqlite'

const pool = createSQLitePool({
  databaseUrl: createMemoryUrl('raw'),
  maxConnections: 5,
  idleTimeoutMs: 30000
})

await pool.withConnection(async (db) => {
  const result = await db.prepare('SELECT 1 as test').get()
  expect(result.test).toBe(1)
})
```

### `withSQLiteTransaction<T>(db: Database, fn: (tx: Transaction) => Promise<T>): Promise<T>`

Execute function within a database transaction.

**Parameters:**
- `db` - Database connection
- `fn` - Function to execute in transaction

**Returns:** Promise with function result

**Example:**
```typescript
import { withSQLiteTransaction } from '@orchestr8/testkit/sqlite'

await withSQLiteTransaction(db, async (tx) => {
  await tx.run('INSERT INTO users (name) VALUES (?)', 'John')
  const user = await tx.get('SELECT * FROM users WHERE name = ?', 'John')
  expect(user.name).toBe('John')
})
```

### `migrateDatabase(db: Database, migrationsDir: string): Promise<void>`

Run database migrations from a directory.

**Parameters:**
- `db` - Database connection
- `migrationsDir` - Path to migrations directory

**Example:**
```typescript
import { migrateDatabase } from '@orchestr8/testkit/sqlite'

await migrateDatabase(db, './migrations')
```

### `seedDatabase(db: Database, seedFile: string): Promise<void>`

Seed database with data from a file.

**Parameters:**
- `db` - Database connection
- `seedFile` - Path to seed file

**Example:**
```typescript
import { seedDatabase } from '@orchestr8/testkit/sqlite'

await seedDatabase(db, './seeds/test-data.sql')
```

### `applyRecommendedPragmas(db: Database, options?: PragmaOptions): Promise<void>`

Apply recommended SQLite pragma settings.

**Parameters:**
- `db` - Database connection
- `options` - Optional pragma configuration

**Example:**
```typescript
import { applyRecommendedPragmas } from '@orchestr8/testkit/sqlite'

await applyRecommendedPragmas(db, {
  journalMode: 'WAL',
  foreignKeys: true,
  busyTimeoutMs: 5000
})
```

### `createMemoryUrl(format: 'raw' | 'absolute', options?: MemoryUrlOptions): string`

Create a SQLite memory database URL.

**Parameters:**
- `format` - URL format type
- `options` - Optional URL options

**Returns:** Memory database URL

**Example:**
```typescript
import { createMemoryUrl } from '@orchestr8/testkit/sqlite'

const url1 = createMemoryUrl('raw')
// Returns: 'file::memory:?cache=shared'

const url2 = createMemoryUrl('raw', { 
  identifier: 'test-db',
  cache: 'shared'
})
// Returns: 'file:test-db:?mode=memory&cache=shared'
```

---

## MSW Mock Server

*Requires: `@orchestr8/testkit/msw` and `msw`*

### `setupMSW(handlers?: RequestHandler[]): MSWServer`

Set up MSW mock server with automatic lifecycle management.

**Parameters:**
- `handlers` - Optional array of request handlers

**Returns:** MSW server instance

**Example:**
```typescript
import { setupMSW, http, createSuccessResponse } from '@orchestr8/testkit/msw'

const server = setupMSW([
  http.get('/api/users', () => createSuccessResponse([
    { id: 1, name: 'John' },
    { id: 2, name: 'Jane' }
  ]))
])

// Server automatically managed
```

### `createAuthHandlers(): RequestHandler[]`

Create standard authentication handlers.

**Returns:** Array of auth-related request handlers

**Example:**
```typescript
import { setupMSW, createAuthHandlers } from '@orchestr8/testkit/msw'

const server = setupMSW([
  ...createAuthHandlers(),
  // ... other handlers
])
```

### `createPaginatedHandler(url: string, data: any[], options?: PaginationOptions): RequestHandler`

Create a paginated endpoint handler.

**Parameters:**
- `url` - Endpoint URL
- `data` - Array of data to paginate
- `options` - Pagination configuration

**Returns:** Request handler for paginated responses

**Example:**
```typescript
import { createPaginatedHandler } from '@orchestr8/testkit/msw'

const handler = createPaginatedHandler('/api/posts', [
  { id: 1, title: 'Post 1' },
  { id: 2, title: 'Post 2' },
  { id: 3, title: 'Post 3' }
], { pageSize: 2 })
```

### `createSuccessResponse(data: any, options?: ResponseOptions): Response`

Create a successful JSON response.

**Parameters:**
- `data` - Response data
- `options` - Optional response configuration

**Returns:** HTTP response

**Example:**
```typescript
import { createSuccessResponse } from '@orchestr8/testkit/msw'

return createSuccessResponse({ success: true }, { status: 201 })
```

### `createErrorResponse(message: string, status?: number): Response`

Create an error response.

**Parameters:**
- `message` - Error message
- `status` - HTTP status code (default: 400)

**Returns:** HTTP error response

**Example:**
```typescript
import { createErrorResponse } from '@orchestr8/testkit/msw'

return createErrorResponse('Invalid data', 422)
```

### `createTestScopedMSW(handlers: RequestHandler[]): MSWServer`

Create an MSW server scoped to the current test.

**Parameters:**
- `handlers` - Array of request handlers

**Returns:** Test-scoped MSW server

**Example:**
```typescript
import { createTestScopedMSW, http, createSuccessResponse } from '@orchestr8/testkit/msw'

test('isolated server', () => {
  const server = createTestScopedMSW([
    http.get('/api/test', () => createSuccessResponse({ test: true }))
  ])
  
  // Server automatically cleaned up after test
})
```

---

## Container Testing

*Requires: `@orchestr8/testkit/containers` and `testcontainers`*

### `createMySQLContainer(options: MySQLContainerOptions): Promise<MySQLContainer>`

Create a MySQL test container.

**Parameters:**
- `options` - MySQL container configuration

**Returns:** Promise with MySQL container

**Example:**
```typescript
import { createMySQLContainer } from '@orchestr8/testkit/containers'

const { container, connectionUri } = await createMySQLContainer({
  database: 'testdb',
  username: 'testuser',
  password: 'testpass'
})
```

### `createPostgreSQLContainer(options: PostgreSQLContainerOptions): Promise<PostgreSQLContainer>`

Create a PostgreSQL test container.

**Parameters:**
- `options` - PostgreSQL container configuration

**Returns:** Promise with PostgreSQL container

**Example:**
```typescript
import { createPostgreSQLContainer } from '@orchestr8/testkit/containers'

const { container, connectionUri } = await createPostgreSQLContainer({
  database: 'testdb',
  username: 'testuser',
  password: 'testpass'
})
```

### `createMySQLContext(options: MySQLContextOptions): Promise<MySQLTestContext>`

Create a MySQL test context with helper methods.

**Parameters:**
- `options` - MySQL context configuration

**Returns:** Promise with MySQL test context

**Example:**
```typescript
import { createMySQLContext, MySQLPresets } from '@orchestr8/testkit/containers'

const mysql = await createMySQLContext({
  preset: MySQLPresets.mysql8(),
  database: 'test_db'
})

const connection = await mysql.getConnection()
```

### `createPostgreSQLContext(options: PostgreSQLContextOptions): Promise<PostgreSQLTestContext>`

Create a PostgreSQL test context with helper methods.

**Parameters:**
- `options` - PostgreSQL context configuration

**Returns:** Promise with PostgreSQL test context

**Example:**
```typescript
import { createPostgreSQLContext, PostgreSQLPresets } from '@orchestr8/testkit/containers'

const postgres = await createPostgreSQLContext({
  preset: PostgreSQLPresets.postgres15(),
  database: 'test_db'
})

const client = postgres.getClient()
```

### `MySQLPresets`

Predefined MySQL container configurations.

**Methods:**
- `mysql8(options?)` - MySQL 8.0 configuration
- `mysql57(options?)` - MySQL 5.7 configuration

**Example:**
```typescript
import { MySQLPresets } from '@orchestr8/testkit/containers'

const preset = MySQLPresets.mysql8({
  database: 'custom_db'
})
```

### `PostgreSQLPresets`

Predefined PostgreSQL container configurations.

**Methods:**
- `postgres15(options?)` - PostgreSQL 15 configuration
- `postgres14(options?)` - PostgreSQL 14 configuration

**Example:**
```typescript
import { PostgreSQLPresets } from '@orchestr8/testkit/containers'

const preset = PostgreSQLPresets.postgres15({
  database: 'custom_db'
})
```

---

## Convex Testing

*Requires: `@orchestr8/testkit/convex` and `convex-test`*

### `createConvexTestHarness(schema: any, modules?: any): ConvexTestHarness`

Create a Convex test harness for testing Convex functions.

**Parameters:**
- `schema` - Convex schema definition
- `modules` - Optional modules map

**Returns:** Convex test harness

**Example:**
```typescript
import { createConvexTestHarness } from '@orchestr8/testkit/convex'
import schema from './schema'

const harness = createConvexTestHarness(schema)
```

### `withConvexTest<T>(schema: any, fn: (harness: ConvexTestHarness) => Promise<T>): Promise<T>`

Execute a function with a Convex test harness.

**Parameters:**
- `schema` - Convex schema definition
- `fn` - Function to execute with harness

**Returns:** Promise with function result

**Example:**
```typescript
import { withConvexTest } from '@orchestr8/testkit/convex'
import schema from './schema'
import { api } from './_generated/api'

const result = await withConvexTest(schema, async (harness) => {
  return await harness.query(api.users.list)
})
```

### `ConvexTestHarness`

Main interface for Convex testing.

**Properties:**
- `auth: ConvexTestAuth` - Authentication utilities
- `lifecycle: ConvexTestLifecycle` - Lifecycle management

**Methods:**
- `query(api, args?)` - Execute a query
- `mutation(api, args?)` - Execute a mutation
- `action(api, args?)` - Execute an action
- `run(fn)` - Execute function with database context
- `finishInProgressScheduledFunctions()` - Complete scheduled functions

**Example:**
```typescript
const harness = createConvexTestHarness(schema)

// Authenticated operations
const asUser = harness.auth.withUser({ subject: 'user123' })
const tasks = await asUser.query(api.tasks.list)

// Database operations
await harness.run(async (ctx) => {
  await ctx.db.insert('users', { name: 'Test User' })
})
```

---

## Configuration

*Available: `@orchestr8/testkit/config`*

### `createVitestConfig(options?: VitestConfigOptions): VitestConfig`

Create a Vitest configuration with testkit optimizations.

**Parameters:**
- `options` - Optional Vitest configuration overrides

**Returns:** Vitest configuration object

**Example:**
```typescript
import { defineConfig } from 'vitest/config'
import { createVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createVitestConfig({
    test: {
      globals: true,
      environment: 'happy-dom'
    }
  })
)
```

---

## Types

### Core Types

```typescript
interface TestEnvironment {
  runner: 'vitest' | 'wallaby' | 'jest' | 'node'
  isCI: boolean
  isWallaby: boolean
  nodeVersion: string
}

interface TestConfig {
  timeout: number
  retries: number
  environment: string
}

interface TestKit {
  environment: TestEnvironment
  config: TestConfig
}
```

### Security Types

```typescript
type SecurityValidationType = 'command' | 'path' | 'sql' | 'shell'

interface SecurityValidationOptions {
  strict?: boolean
  additionalDangerousCommands?: string[]
  allowedExtensions?: string[]
}

interface ValidationResult {
  valid: boolean
  errors: SecurityValidationError[]
  sanitized?: string
}

class SecurityValidationError extends Error {
  constructor(message: string, type: SecurityValidationType, input: string)
  type: SecurityValidationType
  input: string
}
```

### Resource Management Types

```typescript
enum ResourceCategory {
  DATABASE = 'database',
  FILE = 'file',
  NETWORK = 'network',
  PROCESS = 'process',
  TIMER = 'timer',
  EVENT_LISTENER = 'event_listener',
  OTHER = 'other'
}

enum ResourcePriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4
}

type SyncCleanupFunction = () => void
type AsyncCleanupFunction = () => Promise<void>
type CleanupFunction = SyncCleanupFunction | AsyncCleanupFunction

interface ResourceOptions {
  category?: ResourceCategory
  priority?: ResourcePriority
  description?: string
  timeout?: number
  dependencies?: string[]
}

interface CleanupResult {
  successful: number
  failed: number
  errors: CleanupError[]
  duration: number
}

interface ResourceStats {
  total: number
  active: number
  byCategory: Record<ResourceCategory, number>
  byPriority: Record<ResourcePriority, number>
}
```

### Concurrency Types

```typescript
interface ConcurrencyOptions {
  maxConcurrent: number
  timeout?: number
}

interface BatchOptions {
  maxConcurrent?: number
  timeout?: number
  stopOnFirstError?: boolean
}

class ConcurrencyError extends Error {
  constructor(message: string, currentCount: number, maxConcurrent: number)
  currentCount: number
  maxConcurrent: number
}
```

### Environment Types

```typescript
interface FakeTimerOptions {
  initialTime?: Date | number
  shouldAdvanceTime?: boolean
  advanceTimeDelta?: number
}

interface FakeTimerContext {
  advance: (ms: number) => void
  restore: () => void
  getTime: () => number
  setSystemTime: (time: Date | number) => void
}

interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay?: number
  exponentialBackoff?: boolean
}
```

### File System Types

```typescript
interface TempDirectoryOptions {
  prefix?: string
  suffix?: string
  cleanup?: boolean
  mode?: number
}

interface TempDirectory {
  path: string
  cleanup: () => Promise<void>
}
```

### SQLite Types

```typescript
interface SQLitePoolOptions {
  databaseUrl: string
  maxConnections: number
  idleTimeoutMs?: number
  busyTimeoutMs?: number
}

interface MemoryUrlOptions {
  identifier?: string
  cache?: 'shared' | 'private'
  mode?: 'memory' | 'ro' | 'rw' | 'rwc'
}

interface PragmaOptions {
  journalMode?: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF'
  synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA'
  foreignKeys?: boolean
  busyTimeoutMs?: number
  cacheSize?: number
}
```

### Container Types

```typescript
interface MySQLContainerOptions {
  database: string
  username?: string
  password?: string
  rootPassword?: string
  port?: number
}

interface PostgreSQLContainerOptions {
  database: string
  username?: string
  password?: string
  port?: number
}

interface MySQLTestContext {
  container: Container
  connectionUri: string
  getConnection: () => Promise<Connection>
  cleanup: () => Promise<void>
}

interface PostgreSQLTestContext {
  container: Container
  connectionUri: string
  getClient: () => Client
  cleanup: () => Promise<void>
}
```

---

## Error Classes

### `SecurityValidationError`

Thrown when security validation fails.

```typescript
class SecurityValidationError extends Error {
  type: SecurityValidationType
  input: string
}
```

### `ConcurrencyError`

Thrown when concurrency limits are exceeded.

```typescript
class ConcurrencyError extends Error {
  currentCount: number
  maxConcurrent: number
}
```

### `ResourceCleanupError`

Thrown when resource cleanup fails.

```typescript
class ResourceCleanupError extends Error {
  resourceId: string
  category: ResourceCategory
  originalError: Error
}
```

---

## Constants

### Default Concurrency Limits

```typescript
const DEFAULT_CONCURRENCY_LIMITS = {
  DATABASE: 3,
  FILE: 10,
  NETWORK: 5,
  PROCESS: 3,
  RESOURCE_CLEANUP: 10
}
```

### Default Resource Priorities

```typescript
const DEFAULT_CATEGORY_PRIORITIES = {
  [ResourceCategory.DATABASE]: ResourcePriority.CRITICAL,
  [ResourceCategory.NETWORK]: ResourcePriority.HIGH,
  [ResourceCategory.PROCESS]: ResourcePriority.HIGH,
  [ResourceCategory.FILE]: ResourcePriority.NORMAL,
  [ResourceCategory.TIMER]: ResourcePriority.LOW,
  [ResourceCategory.EVENT_LISTENER]: ResourcePriority.LOW,
  [ResourceCategory.OTHER]: ResourcePriority.NORMAL
}
```

### Default Resource Timeouts

```typescript
const DEFAULT_CATEGORY_TIMEOUTS = {
  [ResourceCategory.DATABASE]: 10000,
  [ResourceCategory.NETWORK]: 5000,
  [ResourceCategory.PROCESS]: 15000,
  [ResourceCategory.FILE]: 3000,
  [ResourceCategory.TIMER]: 1000,
  [ResourceCategory.EVENT_LISTENER]: 1000,
  [ResourceCategory.OTHER]: 5000
}
```

---

*This API reference covers all major functions and types in @orchestr8/testkit v2.0.0. For more examples and detailed usage patterns, see the [examples/](./examples/) directory and individual feature guides.*