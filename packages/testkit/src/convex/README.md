# Convex Test Harness

A thin adapter layer over `convex-test` that provides additional utilities and
best practices for testing Convex applications with Vitest.

## Installation

```bash
pnpm add -D @template/testkit convex-test @edge-runtime/vm
```

## Configuration

### Vitest Configuration

```typescript
// vitest.config.ts (projects-based)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Default project (node)
    environment: 'node',
    projects: [
      {
        name: 'convex',
        environment: 'edge-runtime',
        include: ['**/convex/**'],
        server: { deps: { inline: ['convex-test'] } },
      },
    ],
  },
})
```

## Usage

### Basic Setup

```typescript
import { createConvexTestHarness } from '@template/testkit/convex'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Define your schema
const schema = defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
  }),
})

// Create test harness
const harness = createConvexTestHarness({
  schema,
  // IMPORTANT: convex-test requires either generated modules or a modules map
  // For full Convex tests (typed): run `npx convex codegen` and pass discovered modules
  // modules: import.meta.glob('./**/*.{js,ts}', { eager: true }),
})
```

### Authentication Testing

The harness provides both **fluent** (preferred) and **mutating** (legacy) APIs
for authentication:

```typescript
// Fluent API (Preferred) - Returns new context without side effects
const authenticatedCtx = harness.auth.withUser({
  subject: 'user123',
  issuer: 'test',
})

await authenticatedCtx.run(async (ctx) => {
  const identity = await ctx.auth.getUserIdentity()
  // identity.subject === 'user123'
})

// Mutating API (Legacy) - Test-scoped state modification
harness.auth.setUser({ subject: 'user456' })
// ... operations use this identity
harness.auth.clearUser()
```

### Scheduler Testing with Fake Timers

**Critical**: Always advance timers when testing scheduled functions!

```typescript
import { vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(async () => {
  // MUST pass advanceTimers to cleanup scheduled functions
  await harness.lifecycle.cleanup({ advanceTimers: vi.runAllTimers })
  vi.useRealTimers()
})

// Single scheduled function
it('should handle scheduled function', async () => {
  await harness.db.run(async (ctx) => {
    await ctx.scheduler.runAfter(1000, api.tasks.process)
  })

  vi.runAllTimers()
  await harness.scheduler.finishInProgress()
})

// Chained scheduled functions
it('should handle scheduler chain', async () => {
  await harness.db.run(async (ctx) => {
    await ctx.scheduler.runAfter(0, api.tasks.startChain)
  })

  // finishAll with timer advancement for chains
  await harness.scheduler.finishAll(vi.runAllTimers)
})
```

### Storage Operations

All storage operations go through `t.run` for proper context:

```typescript
// Upload file
const storageId = await harness.storage.uploadFile('file.txt', 'content')

// Retrieve file
const content = await harness.storage.getFile(storageId)

// Delete file
await harness.storage.deleteFile(storageId)

// In mutations/actions
await harness.db.run(async (ctx) => {
  const blob = new Blob(['content'])
  const id = await ctx.storage.store(blob)
  // ... use storage ID
})
```

### Database Operations

```typescript
// Seed data
await harness.db.seed(async (ctx) => {
  await ctx.db.insert('users', {
    name: 'Test User',
    email: 'test@example.com',
  })
})

// Run queries/mutations
const result = await harness.db.run(async (ctx) => {
  return await ctx.db.query('users').collect()
})

// Clear all data
await harness.db.clear()
```

### External API Testing

```typescript
import { vi } from 'vitest'

it('should handle external API calls', async () => {
  // Stub global fetch
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: async () => ({ data: 'mocked' }),
    }),
  )

  try {
    // Your action that calls external APIs
    const result = await harness.convex.action(api.actions.fetchData)
    expect(result.data).toBe('mocked')
  } finally {
    // Always clean up global stubs
    vi.unstubAllGlobals()
  }
})
```

## Important Gotchas

### 1. Environment Configuration

- **Always** use `edge-runtime` for Convex tests (via projects)
- **Always** inline `convex-test` in Vitest config
- Wallaby users: Ensure your Wallaby config mirrors Vitest settings

### 2. Scheduler Testing

- **Never** use cleanup without advancing timers when scheduled functions exist
- **Always** use `vi.useRealTimers()` after scheduler tests
- For chains, use `finishAllScheduledFunctions(vi.runAllTimers)`

#### Scheduler Troubleshooting Guide

**Problem: "Cleanup failed: Scheduled functions are still pending"**

This error occurs when:
1. You have scheduled functions that haven't completed
2. You're using fake timers but not advancing them
3. You're calling cleanup without the `advanceTimers` option

**Solution:**

```typescript
// ❌ WRONG - Will fail if scheduled functions exist
afterEach(async () => {
  await harness.lifecycle.cleanup()
})

// ✅ CORRECT - Always provide timer advancement
afterEach(async () => {
  await harness.lifecycle.cleanup({ advanceTimers: vi.runAllTimers })
  vi.useRealTimers()
})
```

**Problem: Scheduled functions not executing in tests**

Required sequence for scheduler tests:
1. Use fake timers: `vi.useFakeTimers()`
2. Schedule your functions
3. Advance timers: `vi.runAllTimers()` or `vi.advanceTimersByTime(ms)`
4. Finish scheduled functions: `await harness.scheduler.finishInProgress()`
5. Clean up with timer advancement

**Problem: Chained scheduled functions only partially execute**

For functions that schedule other functions:

```typescript
// ❌ WRONG - Only finishes initially scheduled functions
await harness.scheduler.finishInProgress()

// ✅ CORRECT - Finishes entire chain with timer advancement
await harness.scheduler.finishAllWithTimers(vi.runAllTimers)
```

**CI vs Local Differences:**

In CI (when `process.env.CI` is set), the harness will:
- **Hard fail** if fake timers are detected without `advanceTimers` in cleanup
- Enforce stricter validation on scheduler operations

Locally, you'll see warnings but tests may continue.

### 3. Identity Management

- **Don't** mix fluent (`withUser`) and mutating (`setUser`) patterns in the
  same test
- Mutating API is test-scoped and reset on `lifecycle.reset()`
- Fluent API is preferred for better isolation

### 4. Not Implemented Features

These methods throw helpful errors guiding you to the correct approach:

- `getAllDocuments()` → Use `t.run(ctx => ctx.db.query(table).collect())`
- `countDocuments()` → Use
  `t.run(ctx => ctx.db.query(table).collect().then(d => d.length)`)
- `listFiles()` → Not supported by convex-test
- `clearFiles()` → Files cleared on harness reset

### 5. Module discovery and \_generated

convex-test requires either:

1. The Convex `_generated` directory (run `npx convex codegen` or
   `npx convex dev`), or
2. An explicit `modules` map created with
   `import.meta.glob(..., { eager: true })`.

Recommendation:

- Document `_generated` as a prerequisite for full Convex examples.
- Gate Convex-heavy tests behind `CONVEX_GENERATED=true` so default runs don't
  fail.

Example (opt-in):

```ts
// Only include when CONVEX_GENERATED=true is set in env
const modules = import.meta.glob('./**/*.{js,ts}', { eager: true })
const harness = createConvexTestHarness({ schema, modules })
```

### 6. Cleanup Errors

If you see "Cleanup failed: Scheduled functions are still pending":

```typescript
// Wrong
await harness.lifecycle.cleanup()

// Correct
await harness.lifecycle.cleanup({ advanceTimers: vi.runAllTimers })
```

### 7. Test Isolation

Each test should be completely isolated:

```typescript
beforeEach(() => {
  harness = createConvexTestHarness({ schema })
})

afterEach(async () => {
  await harness.lifecycle.cleanup({ advanceTimers: vi.runAllTimers })
})
```

## API Reference

### ConvexTestContext

The main context returned by `createConvexTestHarness()`:

- `convex`: Raw convex-test instance
- `db`: Database operations context
- `auth`: Authentication utilities
- `storage`: File storage utilities
- `scheduler`: Scheduled function utilities
- `lifecycle`: Test lifecycle management

### Database Context

- `run(fn)`: Execute database operations
- `seed(fn)`: Seed test data
- `clear()`: Clear all data
- `getAllDocuments(table)`: ❌ Not implemented (use run)
- `countDocuments(table)`: ❌ Not implemented (use run)

### Auth Context

Fluent API (Preferred):

- `withUser(identity)`: Create authenticated context
- `withoutAuth()`: Create anonymous context
- `switchUser(identity)`: Switch user context
- `asAnonymous()`: Switch to anonymous
- `withAuth(identity, fn)`: Run function with auth

Mutating API (Legacy):

- `setUser(identity)`: Set test-scoped user
- `clearUser()`: Clear test-scoped user
- `getCurrentUser()`: Get current identity

Utilities:

- `testUsers.admin()`: Admin user factory
- `testUsers.regular()`: Regular user factory
- `testUsers.anonymous()`: Returns null

### Storage Context

- `uploadFile(name, content)`: Upload file via t.run
- `getFile(storageId)`: Retrieve file via t.run
- `deleteFile(storageId)`: Delete file via t.run
- `listFiles()`: ❌ Not implemented
- `clearFiles()`: ❌ Not implemented

### Scheduler Context

- `finishInProgress()`: Finish running scheduled functions
- `finishAll(advanceTimers?)`: Finish all including newly scheduled
- `finishAllWithTimers(timerFn)`: Convenience helper with timers
- `getPendingFunctions()`: ❌ Not implemented
- `cancelAll()`: ❌ Not implemented
- `advanceTime(ms)`: ❌ Not implemented (use vi.advanceTimersByTime)

### Lifecycle Context

- `reset()`: Reset harness to clean state
- `cleanup(options?)`: Clean up resources
  - `options.advanceTimers`: Function to advance timers
- `setupHooks(hooks)`: Setup test lifecycle hooks

## Examples

See `examples/convex.cookbook.examples.ts` for comprehensive usage patterns.

## Migration from Raw convex-test

If migrating from raw `convex-test`:

```typescript
// Before (convex-test)
const t = convexTest(schema, modules)
const authed = t.withIdentity({ subject: 'user' })
await t.run(async (ctx) => {
  /* ... */
})

// After (with harness)
const harness = createConvexTestHarness({ schema, modules })
const authed = harness.auth.withUser({ subject: 'user' })
await harness.db.run(async (ctx) => {
  /* ... */
})
```

The harness is intentionally a thin layer - you can always access the raw
convex-test instance via `harness.convex` for any functionality not exposed
through the adapter.
