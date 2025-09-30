# Troubleshooting Guide

Common issues and solutions when using @orchestr8/testkit.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Import and Module Resolution](#import-and-module-resolution)
- [Environment Detection](#environment-detection)
- [Security Validation](#security-validation)
- [Resource Management](#resource-management)
- [Concurrency Issues](#concurrency-issues)
- [SQLite Testing](#sqlite-testing)
- [CLI Process Mocking](#cli-process-mocking)
- [MSW Mock Server](#msw-mock-server)
- [Container Testing](#container-testing)
- [Convex Testing](#convex-testing)
- [Performance Issues](#performance-issues)
- [Debugging](#debugging)

---

## Installation Issues

### Error: Package not found

**Problem:** Can't install @orchestr8/testkit
```bash
npm ERR! 404 Not Found - GET https://registry.npmjs.org/@orchestr8%2ftestkit
```

**Solution:** Check package name and registry
```bash
# Correct package name
npm install @orchestr8/testkit

# If using private registry, check configuration
npm config get registry
```

### Error: Peer dependency warnings

**Problem:** Warning about missing peer dependencies
```bash
npm WARN @orchestr8/testkit@2.0.0 requires a peer of better-sqlite3@^12.0.0 but none is installed.
```

**Solution:** Install only the peer dependencies you need
```bash
# For SQLite testing
npm install better-sqlite3

# For MSW testing
npm install msw happy-dom

# For container testing
npm install testcontainers mysql2 pg

# For Convex testing
npm install convex-test
```

### Error: Node.js version mismatch

**Problem:** Node.js version compatibility issues
```bash
error @orchestr8/testkit@2.0.0: The engine "node" is incompatible with this module.
```

**Solution:** Update Node.js to supported version
```bash
# Check current version
node --version

# Update to Node.js 18+ (recommended)
nvm install 18
nvm use 18
```

---

## Import and Module Resolution

### Error: Cannot find module '@orchestr8/testkit/sqlite'

**Problem:** Sub-export not found
```typescript
// ❌ This fails
import { createSQLiteDatabase } from '@orchestr8/testkit/sqlite'
// Error: Cannot find module '@orchestr8/testkit/sqlite'
```

**Solutions:**

1. **Install peer dependencies:**
```bash
npm install better-sqlite3 vitest
```

2. **Check package.json exports:**
```bash
# Verify package is properly installed
npm list @orchestr8/testkit
```

3. **Use correct import path:**
```typescript
// ✅ Correct
import { createSQLiteDatabase } from '@orchestr8/testkit/sqlite'

// ❌ Wrong
import { createSQLiteDatabase } from '@orchestr8/testkit'
```

### Error: Module not found in Vitest

**Problem:** Imports work in IDE but fail during test execution

**Solution:** Check Vitest configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Ensure proper module resolution
    deps: {
      external: ['@orchestr8/testkit']
    }
  }
})
```

### Error: ESM/CommonJS compatibility

**Problem:** Mixed module system errors
```bash
Error [ERR_REQUIRE_ESM]: require() of ES module not supported
```

**Solutions:**

1. **Use ESM imports:**
```typescript
// ✅ Use ESM
import { delay } from '@orchestr8/testkit'

// ❌ Don't use CommonJS
const { delay } = require('@orchestr8/testkit')
```

2. **Configure package.json:**
```json
{
  "type": "module"
}
```

3. **Use CommonJS exports when needed:**
```typescript
// For CommonJS environments
import { delay } from '@orchestr8/testkit/cjs'
```

---

## Environment Detection

### Issue: Wrong test runner detected

**Problem:** Environment detection returns incorrect runner
```typescript
const env = getTestEnvironment()
console.log(env.runner) // Shows 'node' instead of 'vitest'
```

**Solutions:**

1. **Check environment variables:**
```bash
# Vitest sets these
echo $VITEST
echo $NODE_ENV

# Wallaby sets these
echo $WALLABY_ENV
```

2. **Force environment detection:**
```typescript
import { setupTestEnv } from '@orchestr8/testkit/env'

const restore = setupTestEnv({
  VITEST: 'true',
  NODE_ENV: 'test'
})
```

3. **Manual override:**
```typescript
// Override detection if needed
const env = {
  ...getTestEnvironment(),
  runner: 'vitest' as const
}
```

### Issue: CI detection fails

**Problem:** CI environment not detected properly
```typescript
const env = getTestEnvironment()
console.log(env.isCI) // false in CI
```

**Solution:** Check CI environment variables
```bash
# GitHub Actions
echo $GITHUB_ACTIONS

# CircleCI
echo $CIRCLECI

# Jenkins
echo $JENKINS_URL

# Set manually if needed
export CI=true
```

---

## Security Validation

### Error: Command validation too strict

**Problem:** Valid commands being rejected
```typescript
validateCommand('npm run build')
// Error: Dangerous command detected: npm
```

**Solutions:**

1. **Use shell execution validation:**
```typescript
import { validateShellExecution } from '@orchestr8/testkit'

const { command, args } = validateShellExecution('npm', ['run', 'build'])
```

2. **Customize validation:**
```typescript
import { validateBatch } from '@orchestr8/testkit'

const results = validateBatch([
  { type: 'command', value: 'npm run build' }
], {
  additionalDangerousCommands: ['rm', 'del'], // Only block these
  strict: false
})
```

3. **Use command sanitization:**
```typescript
import { sanitizeCommand } from '@orchestr8/testkit'

const safe = sanitizeCommand('npm run build')
// Escapes dangerous characters but allows the command
```

### Error: Path validation too restrictive

**Problem:** Valid paths being rejected
```typescript
validatePath('/tmp/base', 'node_modules/package')
// Error: Path contains dangerous pattern
```

**Solution:** Use proper base paths and relative paths
```typescript
// ✅ Correct usage
const basePath = path.resolve('/tmp/base')
const safePath = validatePath(basePath, 'subdir/file.txt')

// ❌ Don't use paths with dangerous patterns
// validatePath('/tmp', '../etc/passwd')
```

---

## Resource Management

### Issue: Resources not cleaned up

**Problem:** Resources remain active after tests
```typescript
const stats = getResourceStats()
console.log(stats.active) // Still shows active resources
```

**Solutions:**

1. **Check resource registration:**
```typescript
import { registerResource, ResourceCategory } from '@orchestr8/testkit'

// ✅ Properly register resources
registerResource('db-connection', () => db.close(), {
  category: ResourceCategory.DATABASE,
  priority: ResourcePriority.CRITICAL
})
```

2. **Ensure cleanup is called:**
```typescript
import { cleanupAllResources } from '@orchestr8/testkit'

afterEach(async () => {
  await cleanupAllResources()
})
```

3. **Check for cleanup errors:**
```typescript
const result = await cleanupAllResources()
if (result.failed > 0) {
  console.error('Cleanup errors:', result.errors)
}
```

### Issue: Memory leaks detected

**Problem:** Resource leak warnings in tests
```bash
⚠️ Potential resource leaks detected: db-connection (age: 30000ms)
```

**Solutions:**

1. **Check resource lifecycle:**
```typescript
import { detectResourceLeaks } from '@orchestr8/testkit'

const leaks = detectResourceLeaks()
leaks.forEach(leak => {
  console.log(`Leak: ${leak.resourceId} (${leak.age}ms old)`)
})
```

2. **Implement proper cleanup:**
```typescript
// ✅ Cleanup in test teardown
afterEach(async () => {
  await cleanupAllResources()
})

// ✅ Or use try/finally
test('database test', async () => {
  const db = createDatabase()
  registerResource('test-db', () => db.close())
  
  try {
    // Test code
  } finally {
    await cleanupAllResources()
  }
})
```

3. **Adjust leak detection settings:**
```typescript
import { ResourceManager } from '@orchestr8/testkit'

const manager = new ResourceManager({
  leakDetectionAge: 60000, // Increase threshold to 60 seconds
  enableLogging: true
})
```

---

## Concurrency Issues

### Error: Concurrency limit exceeded

**Problem:** Too many concurrent operations
```typescript
// ConcurrencyError: Maximum concurrent operations (3) exceeded. Current: 4
```

**Solutions:**

1. **Use built-in concurrency managers:**
```typescript
import { databaseOperationsManager } from '@orchestr8/testkit'

// ✅ Use predefined limits
await databaseOperationsManager.execute(() => db.query('SELECT * FROM users'))
```

2. **Increase concurrency limits:**
```typescript
import { ConcurrencyManager } from '@orchestr8/testkit'

const manager = new ConcurrencyManager({ maxConcurrent: 10 })
await manager.execute(() => heavyOperation())
```

3. **Use batch processing:**
```typescript
import { limitedPromiseAll } from '@orchestr8/testkit'

const promises = items.map(item => processItem(item))
const results = await limitedPromiseAll(promises, { maxConcurrent: 5 })
```

### Issue: Deadlock in concurrent tests

**Problem:** Tests hang when running concurrently

**Solutions:**

1. **Use proper test isolation:**
```typescript
// ✅ Isolate resources per test
beforeEach(() => {
  // Create fresh resources for each test
})

afterEach(async () => {
  // Clean up resources after each test
  await cleanupAllResources()
})
```

2. **Avoid shared state:**
```typescript
// ❌ Don't share mutable state
let globalConnection

// ✅ Create resources per test
test('database test', async () => {
  const connection = createConnection()
  // Use local connection
})
```

3. **Use test-scoped managers:**
```typescript
test('concurrent operations', async () => {
  const manager = new ConcurrencyManager({ maxConcurrent: 2 })
  
  const operations = [
    manager.execute(() => operation1()),
    manager.execute(() => operation2()),
    manager.execute(() => operation3())
  ]
  
  await Promise.all(operations)
})
```

---

## SQLite Testing

### Error: Database locked

**Problem:** SQLite database locked error
```bash
Error: SQLITE_BUSY: database is locked
```

**Solutions:**

1. **Use connection pooling:**
```typescript
import { createSQLitePool } from '@orchestr8/testkit/sqlite'

const pool = createSQLitePool({
  databaseUrl: 'file:test.db',
  maxConnections: 3,
  busyTimeoutMs: 5000
})

await pool.withConnection(async (db) => {
  // Database operations
})
```

2. **Apply busy timeout pragma:**
```typescript
import { applyRecommendedPragmas } from '@orchestr8/testkit/sqlite'

await applyRecommendedPragmas(db, {
  busyTimeoutMs: 10000 // 10 second timeout
})
```

3. **Use WAL mode for file databases:**
```typescript
import { createFileDatabase } from '@orchestr8/testkit/sqlite'

const { db } = await createFileDatabase('test.db')
await db.exec('PRAGMA journal_mode = WAL')
```

### Error: Foreign key constraint failed

**Problem:** Foreign key violations in tests
```bash
Error: FOREIGN KEY constraint failed
```

**Solutions:**

1. **Enable foreign keys:**
```typescript
import { applyRecommendedPragmas } from '@orchestr8/testkit/sqlite'

await applyRecommendedPragmas(db, {
  foreignKeys: true
})
```

2. **Use transactions for data integrity:**
```typescript
import { withSQLiteTransaction } from '@orchestr8/testkit/sqlite'

await withSQLiteTransaction(db, async (tx) => {
  // Insert parent record first
  await tx.run('INSERT INTO users (id, name) VALUES (?, ?)', 1, 'John')
  // Then child record
  await tx.run('INSERT INTO posts (user_id, title) VALUES (?, ?)', 1, 'Post')
})
```

3. **Seed data in correct order:**
```typescript
// ✅ Correct order
await seedDatabase(db, './seeds/01_users.sql')
await seedDatabase(db, './seeds/02_posts.sql')
await seedDatabase(db, './seeds/03_comments.sql')
```

### Issue: Memory database not persisting

**Problem:** Data disappears between operations
```typescript
const db = createMemoryDatabase()
await db.exec('CREATE TABLE test (id INTEGER)')
// Later: table doesn't exist
```

**Solutions:**

1. **Use shared cache:**
```typescript
import { createMemoryUrl } from '@orchestr8/testkit/sqlite'

const url = createMemoryUrl('raw', { 
  identifier: 'test-db',
  cache: 'shared'
})
const db = createSQLiteDatabase(url)
```

2. **Keep database connection open:**
```typescript
// ✅ Keep reference to prevent GC
let dbConnection: Database

beforeAll(() => {
  dbConnection = createMemoryDatabase()
})

afterAll(() => {
  dbConnection.close()
})
```

3. **Use file database for persistence:**
```typescript
import { createFileDatabase } from '@orchestr8/testkit/sqlite'

const { db, cleanup } = await createFileDatabase('test.db')
// File persists until cleanup() is called
```

---

## CLI Process Mocking

### Issue: Mock not triggered

**Problem:** Process mock not being used
```typescript
spawnUtils.mockCommandSuccess('git status', 'clean')
exec('git status') // Uses real git instead of mock
```

**Solutions:**

1. **Check bootstrap loading:**
```typescript
// Ensure setup files are configured
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['@orchestr8/testkit/register']
  }
})
```

2. **Register mock before execution:**
```typescript
import { spawnUtils } from '@orchestr8/testkit/cli'

// ✅ Register before using
spawnUtils.mockCommandSuccess('git status', 'clean')

// Then execute
exec('git status', (err, stdout) => {
  expect(stdout).toBe('clean')
})
```

3. **Check command pattern matching:**
```typescript
// ✅ Exact match
spawnUtils.mockCommandSuccess('git status', 'clean')

// ✅ Regex pattern
spawnUtils.mockCommandSuccess(/git.*/, 'git command')

// ❌ Wrong pattern
spawnUtils.mockCommandSuccess('git', 'clean') // Won't match 'git status'
```

### Issue: Multiple command registrations conflict

**Problem:** Last registered command overwrites previous ones
```typescript
spawnUtils.mockCommandSuccess('npm install', 'installed')
spawnUtils.mockCommandSuccess('npm install', 'updated') // Overwrites first
```

**Solutions:**

1. **Use specific patterns:**
```typescript
// ✅ Different commands
spawnUtils.mockCommandSuccess('npm install', 'installed')
spawnUtils.mockCommandSuccess('npm test', 'tests passed')

// ✅ Or use regex for variations
spawnUtils.mockCommandSuccess(/npm install.*/, 'installed')
```

2. **Clear mocks between tests:**
```typescript
import { getGlobalProcessMocker } from '@orchestr8/testkit/cli'

afterEach(() => {
  const mocker = getGlobalProcessMocker()
  mocker.clear()
})
```

3. **Use builder pattern for complex mocks:**
```typescript
import { createProcessMock } from '@orchestr8/testkit/cli'

createProcessMock('npm install')
  .withStdout('Installing dependencies...')
  .withDelay(1000)
  .withExitCode(0)
  .register()
```

---

## MSW Mock Server

### Error: Request handler not found

**Problem:** HTTP requests not being intercepted
```bash
Error: Failed to fetch
// or real HTTP request made instead of mock
```

**Solutions:**

1. **Check server setup:**
```typescript
import { setupMSW } from '@orchestr8/testkit/msw'

// ✅ Set up server with handlers
const server = setupMSW([
  http.get('/api/users', () => createSuccessResponse([]))
])

// Server should be listening
```

2. **Verify request URL matching:**
```typescript
// ✅ Exact URL match
http.get('/api/users', handler)

// ✅ Pattern matching
http.get('/api/users/:id', handler)

// ❌ Wrong URL
http.get('/users', handler) // Won't match '/api/users'
```

3. **Check HTTP method:**
```typescript
// ✅ Match HTTP method
http.get('/api/users', handler)    // For GET requests
http.post('/api/users', handler)   // For POST requests

// ❌ Wrong method
http.get('/api/users', handler)    // Won't match POST /api/users
```

### Issue: Handler order matters

**Problem:** Generic handlers override specific ones
```typescript
const handlers = [
  http.get('/api/*', () => createErrorResponse('Not found', 404)),
  http.get('/api/users', () => createSuccessResponse([])) // Never reached
]
```

**Solution:** Order handlers from specific to generic
```typescript
const handlers = [
  http.get('/api/users', () => createSuccessResponse([])),      // Specific first
  http.get('/api/*', () => createErrorResponse('Not found', 404)) // Generic last
]
```

### Issue: MSW not working in browser tests

**Problem:** MSW works in Node but not in browser environment

**Solution:** Use browser-specific setup
```typescript
// For browser tests
import { setupMSWBrowser } from '@orchestr8/testkit/msw/browser'

const server = setupMSWBrowser([
  http.get('/api/users', () => createSuccessResponse([]))
])
```

---

## Container Testing

### Error: Docker not available

**Problem:** Container tests fail because Docker isn't running
```bash
Error: Docker is not running
```

**Solutions:**

1. **Start Docker:**
```bash
# macOS/Windows
# Start Docker Desktop

# Linux
sudo systemctl start docker
```

2. **Check Docker availability:**
```bash
docker version
docker info
```

3. **Skip container tests if Docker unavailable:**
```typescript
import { beforeAll, describe, test } from 'vitest'

describe.skipIf(!process.env.DOCKER_AVAILABLE)('Container tests', () => {
  test('database integration', async () => {
    // Container tests
  })
})
```

### Error: Port already in use

**Problem:** Container port conflicts
```bash
Error: Port 3306 is already in use
```

**Solutions:**

1. **Use random ports:**
```typescript
import { createMySQLContainer } from '@orchestr8/testkit/containers'

const { container, connectionUri } = await createMySQLContainer({
  database: 'testdb',
  // Don't specify port - uses random available port
})
```

2. **Check for port conflicts:**
```bash
# Check what's using the port
lsof -i :3306
netstat -tlnp | grep :3306
```

3. **Stop conflicting services:**
```bash
# Stop local MySQL
sudo systemctl stop mysql

# Or use different port
```

### Issue: Container cleanup not working

**Problem:** Containers remain running after tests
```bash
docker ps
# Shows test containers still running
```

**Solutions:**

1. **Use automatic cleanup:**
```typescript
import { createMySQLContext } from '@orchestr8/testkit/containers'

test('mysql test', async () => {
  const mysql = await createMySQLContext({
    preset: MySQLPresets.mysql8(),
    database: 'test'
  })
  
  // Use mysql.getConnection()
  
  // Cleanup handled automatically
}, 30000)
```

2. **Manual cleanup in teardown:**
```typescript
let container: Container

beforeAll(async () => {
  const result = await createMySQLContainer({
    database: 'testdb'
  })
  container = result.container
})

afterAll(async () => {
  if (container) {
    await container.stop()
  }
})
```

3. **Global container cleanup:**
```bash
# Emergency cleanup
docker stop $(docker ps -q --filter "label=org.testcontainers=true")
docker rm $(docker ps -aq --filter "label=org.testcontainers=true")
```

---

## Convex Testing

### Error: Convex schema not found

**Problem:** Schema import fails in tests
```typescript
import schema from './schema'
// Error: Cannot find module './schema'
```

**Solutions:**

1. **Generate Convex code:**
```bash
npx convex codegen
```

2. **Check schema path:**
```typescript
// ✅ Correct path from test file
import schema from '../convex/schema'

// ❌ Wrong relative path
import schema from './schema'
```

3. **Enable Convex in tests:**
```bash
CONVEX_GENERATED=true npm test
```

### Issue: Edge runtime environment

**Problem:** Convex tests fail with module resolution errors
```bash
Error: Cannot find module 'node:fs'
```

**Solutions:**

1. **Configure Vitest for edge runtime:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environmentMatchGlobs: [
      ['**/convex/**', 'edge-runtime']
    ],
    server: {
      deps: {
        inline: ['convex-test']
      }
    }
  }
})
```

2. **Install edge runtime:**
```bash
npm install -D @edge-runtime/vm
```

3. **Check test file location:**
```bash
# Tests should be in convex/ directory for edge runtime
convex/
  schema.ts
  functions.ts
  tests/
    functions.test.ts  # Will use edge-runtime
```

### Issue: Authentication not working

**Problem:** Authenticated Convex functions don't see user context
```typescript
const asUser = harness.auth.withUser({ subject: 'user123' })
const result = await asUser.query(api.private.getUserData)
// Returns null (no user context)
```

**Solutions:**

1. **Use fluent auth API:**
```typescript
// ✅ Use withUser for scoped authentication
const asUser = harness.auth.withUser({ subject: 'user123' })
const result = await asUser.query(api.private.getUserData)

// ❌ Don't use deprecated setUser
// harness.auth.setUser({ subject: 'user123' }) // Doesn't actually authenticate
```

2. **Check Convex function implementation:**
```typescript
// In your Convex function
export const getUserData = query({
  args: {},
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null // User not authenticated
    }
    // Return user data
  }
})
```

3. **Migrate from legacy auth API:**
```typescript
// ❌ Legacy API (deprecated)
import { setUser } from '@orchestr8/testkit/legacy'
setUser(harness, { subject: 'user123' })

// ✅ Modern API
const asUser = harness.auth.withUser({ subject: 'user123' })
```

---

## Performance Issues

### Issue: Tests running slowly

**Problem:** Test suite takes too long to complete

**Solutions:**

1. **Use memory databases:**
```typescript
// ✅ Fast memory database
import { createMemoryDatabase } from '@orchestr8/testkit/sqlite'
const db = createMemoryDatabase()

// ❌ Slow file database
import { createFileDatabase } from '@orchestr8/testkit/sqlite'
const { db } = await createFileDatabase('test.db')
```

2. **Optimize concurrency:**
```typescript
// ✅ Process in batches
import { limitedPromiseAll } from '@orchestr8/testkit'
const results = await limitedPromiseAll(promises, { maxConcurrent: 10 })

// ❌ Process sequentially
for (const promise of promises) {
  await promise
}
```

3. **Use test-scoped resources:**
```typescript
// ✅ Create resources per test
test('fast test', async () => {
  const db = createMemoryDatabase()
  // Use and discard
})

// ❌ Share resources across tests
let sharedDb
beforeAll(() => {
  sharedDb = createFileDatabase('shared.db')
})
```

### Issue: Memory usage growing

**Problem:** Memory usage increases during test run

**Solutions:**

1. **Check resource cleanup:**
```typescript
import { getResourceStats, cleanupAllResources } from '@orchestr8/testkit'

afterEach(async () => {
  await cleanupAllResources()
  const stats = getResourceStats()
  expect(stats.active).toBe(0)
})
```

2. **Monitor memory usage:**
```typescript
test('memory test', async () => {
  const initialMemory = process.memoryUsage()
  
  // Test code
  
  const finalMemory = process.memoryUsage()
  const heapDiff = finalMemory.heapUsed - initialMemory.heapUsed
  console.log(`Heap usage increased by ${heapDiff} bytes`)
})
```

3. **Use smaller test datasets:**
```typescript
// ✅ Small test data
const testData = Array.from({ length: 10 }, (_, i) => ({ id: i }))

// ❌ Large test data
const testData = Array.from({ length: 10000 }, (_, i) => ({ id: i }))
```

---

## Debugging

### Enable Debug Logging

Set environment variables for detailed logging:

```bash
# General debug logging
export DEBUG=testkit:*

# Specific module debugging
export DEBUG=testkit:resources
export DEBUG=testkit:concurrency
export DEBUG=testkit:sqlite

# Security validation debug
export TESTKIT_SECURITY_DEBUG=true

# Resource management debug
export TESTKIT_RESOURCES_DEBUG=true

# Random/crypto debug
export TESTKIT_RANDOM_DEBUG=true
```

### Check Environment Variables

Verify environment setup:

```typescript
import { getTestEnvironment } from '@orchestr8/testkit/env'

console.log('Environment:', getTestEnvironment())
console.log('Process env:', {
  NODE_ENV: process.env.NODE_ENV,
  VITEST: process.env.VITEST,
  WALLABY_ENV: process.env.WALLABY_ENV,
  CI: process.env.CI
})
```

### Inspect Resource State

Monitor resource management:

```typescript
import { getResourceStats, detectResourceLeaks } from '@orchestr8/testkit'

console.log('Resource stats:', getResourceStats())
console.log('Resource leaks:', detectResourceLeaks())
```

### Test Configuration Debugging

Check your test configuration:

```typescript
// In your test file
console.log('Test config:', {
  __dirname,
  __filename,
  cwd: process.cwd(),
  env: process.env.NODE_ENV
})
```

### Common Debug Commands

```bash
# Check package installation
npm list @orchestr8/testkit

# Verify peer dependencies
npm list --depth=0

# Check for conflicting packages
npm ls | grep -E "(sqlite|msw|vitest)"

# Clear cache if needed
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## Getting Help

If you encounter issues not covered in this guide:

1. **Check the examples:** Look at [examples/](./examples/) for working patterns
2. **Read the API docs:** See [API.md](./API.md) for detailed function documentation
3. **Search issues:** Check existing GitHub issues for similar problems
4. **Enable debugging:** Use debug environment variables for detailed logging
5. **Create minimal reproduction:** Isolate the issue in a minimal test case

### Useful Information for Bug Reports

When reporting issues, include:

- Node.js version (`node --version`)
- Package version (`npm list @orchestr8/testkit`)
- Test runner (Vitest/Jest/etc.)
- Environment (CI/local/Wallaby)
- Minimal reproduction code
- Full error messages
- Debug logs (with `DEBUG=testkit:*`)

---

*This troubleshooting guide covers common issues with @orchestr8/testkit v2.0.0. For additional help, consult the API documentation and examples.*