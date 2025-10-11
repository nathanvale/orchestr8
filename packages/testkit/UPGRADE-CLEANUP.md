# TestKit Cleanup Features: Consumer Upgrade Guide

> **TL;DR**: TestKit now automatically prevents resource leaks (SQLite connections, timers) that cause hanging test processes. Enable with environment variables—no code changes needed!

## What's New in TestKit 2.1.0

TestKit now includes **automatic resource leak detection and cleanup** to solve the common problem of tests hanging for 20+ seconds due to leaked resources.

### Key Features

1. **🔍 SQLite Leak Guard**: Automatically closes leaked better-sqlite3 database connections
2. **⏰ Timers Guard**: Automatically clears leaked setTimeout/setInterval
3. **🌊 Global Resource Cleanup**: Ensures all registered resources (pools, connections) are cleaned up between test files
4. **📊 Hanging-Process Reporter**: Auto-enabled in CI to surface leaked handles

### Why This Matters

**Before**: Tests hang for 20+ seconds with messages like:
```
Tests closed successfully but something prevents the main process from exiting
Timeout in TestKit's global teardown after 20s
```

**After**: Tests exit cleanly immediately, no more hanging!

---

## Quick Start: Enable in Your Monorepo

### Step 1: Update TestKit

```bash
# Update to latest version
pnpm add -D @orchestr8/testkit@latest

# Or if using workspace protocol
pnpm add -D @orchestr8/testkit@workspace:*
```

### Step 2: Enable Guards (Choose Your Approach)

#### Option A: Environment Variables (Recommended)

Add to your `.env` file or CI configuration:

```bash
# Enable SQLite leak detection
TESTKIT_SQLITE_GUARD=on

# Optional: Enable timer leak detection
TESTKIT_TIMERS_GUARD=on

# Optional: Strict mode (fail tests on leaks)
TESTKIT_SQLITE_GUARD_STRICT=on
```

#### Option B: package.json Scripts

```json
{
  "scripts": {
    "test": "TESTKIT_SQLITE_GUARD=on vitest run",
    "test:watch": "TESTKIT_SQLITE_GUARD=on vitest watch",
    "test:ci": "TESTKIT_SQLITE_GUARD=on TESTKIT_SQLITE_GUARD_STRICT=on vitest run"
  }
}
```

#### Option C: CI Only (GitHub Actions Example)

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      TESTKIT_SQLITE_GUARD: on
      TESTKIT_SQLITE_GUARD_STRICT: on
      TESTKIT_REPORT_HANGS: on  # Auto-enabled in CI by default
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: pnpm test
```

### Step 3: Verify It's Working

Run your tests and look for cleanup logs (in verbose mode):

```bash
# Enable verbose logging to see what's being cleaned up
TESTKIT_SQLITE_GUARD=on TESTKIT_SQLITE_GUARD_VERBOSE=on pnpm test
```

You should see messages like:
```
[SQLite Guard] Auto-closed leaked database ":memory:" opened in test "should create user"
```

**That's it!** No code changes required. The guards work automatically.

---

## Monorepo-Specific Setup

### For Turborepo

```json
// turbo.json
{
  "pipeline": {
    "test": {
      "env": [
        "TESTKIT_SQLITE_GUARD",
        "TESTKIT_SQLITE_GUARD_STRICT",
        "TESTKIT_TIMERS_GUARD"
      ],
      "outputs": ["coverage/**"]
    }
  }
}
```

```bash
# Run tests across monorepo with guards enabled
TESTKIT_SQLITE_GUARD=on turbo run test
```

### For pnpm Workspaces

```json
// .npmrc or package.json
{
  "scripts": {
    "test:all": "pnpm -r --parallel run test",
    "test:guards": "TESTKIT_SQLITE_GUARD=on TESTKIT_SQLITE_GUARD_STRICT=on pnpm -r --parallel run test"
  }
}
```

### For Nx Monorepos

```json
// nx.json
{
  "targetDefaults": {
    "test": {
      "options": {
        "env": {
          "TESTKIT_SQLITE_GUARD": "on"
        }
      }
    }
  }
}
```

---

## Migration Scenarios

### Scenario 1: You Have Manual Cleanup Code

**Before** (manual cleanup in vitest.setup.ts):

```typescript
import Database from 'better-sqlite3'
import { afterEach } from 'vitest'

const trackedDbs = new Set()

// Manual tracking
const OriginalDatabase = Database
Database = new Proxy(OriginalDatabase, {
  construct(target, args) {
    const db = new target(...args)
    trackedDbs.add(db)
    return db
  }
})

// Manual cleanup
afterEach(() => {
  for (const db of trackedDbs) {
    if (db.open && !db.readonly) db.close()
  }
  trackedDbs.clear()
})
```

**After** (delete the setup file):

```bash
# Just enable the guard
export TESTKIT_SQLITE_GUARD=on
```

✅ **Remove your manual setup file completely!**

### Scenario 2: You Have SQLite Connection Pools

**No changes needed!** TestKit's global resource cleanup automatically drains all pools.

Your existing pool code continues to work:

```typescript
import { createSQLitePool } from '@orchestr8/testkit/sqlite'

const pool = createSQLitePool('./test.db', {
  maxConnections: 5,
  minConnections: 1
})

// Pool is automatically drained in afterAll hook
// No explicit cleanup needed!
```

### Scenario 3: Tests Hanging in CI

**Problem**: Tests hang for 20+ seconds in CI

**Solution**: Enable guards and hanging-process reporter

```yaml
# .github/workflows/test.yml
env:
  TESTKIT_SQLITE_GUARD: on
  TESTKIT_SQLITE_GUARD_VERBOSE: on  # See what's leaking
  TESTKIT_REPORT_HANGS: on         # Auto-enabled in CI
```

Run tests and check logs for leak sources:
```
[SQLite Guard] Auto-closed leaked database ":memory:" opened in test "user creation"
```

Then fix the leak:
```typescript
// Before
it('creates user', () => {
  const db = new Database(':memory:')
  // ... test logic ...
  // Missing db.close()!
})

// After
it('creates user', () => {
  const db = new Database(':memory:')
  try {
    // ... test logic ...
  } finally {
    db.close()  // Proper cleanup
  }
})
```

### Scenario 4: Intermittent Test Failures

**Problem**: Tests pass locally but fail randomly in CI

**Root Cause**: Often due to leaked timers or connections between tests

**Solution**: Enable guards in strict mode

```bash
TESTKIT_SQLITE_GUARD=on TESTKIT_SQLITE_GUARD_STRICT=on \
TESTKIT_TIMERS_GUARD=on pnpm test
```

Strict mode will fail tests that leak resources, forcing you to fix them properly.

---

## Configuration Reference

### All Environment Variables

| Variable | Values | Default | Use Case |
|----------|--------|---------|----------|
| `TESTKIT_SQLITE_GUARD` | `on`/`off`, `true`/`false`, `1`/`0`, `yes`/`no` | `off` | Enable SQLite leak detection |
| `TESTKIT_SQLITE_GUARD_STRICT` | `on`/`off` | `off` | Fail tests if leaks detected (recommended for CI) |
| `TESTKIT_SQLITE_GUARD_VERBOSE` | `on`/`off` | `off` | Log each forced closure (debugging) |
| `TESTKIT_TIMERS_GUARD` | `on`/`off` | `off` | Enable timer leak detection |
| `TESTKIT_TIMERS_GUARD_VERBOSE` | `on`/`off` | `off` | Log cleared timers |
| `TESTKIT_REPORT_HANGS` | `on`/`off` | `on` in CI, `off` locally | Append Vitest's hanging-process reporter |

### Recommended Configurations

#### Local Development
```bash
# Minimal - only enable if you're debugging hangs
TESTKIT_SQLITE_GUARD=on
```

#### CI/CD Pipeline
```bash
# Comprehensive - catch all leaks
TESTKIT_SQLITE_GUARD=on
TESTKIT_SQLITE_GUARD_STRICT=on
TESTKIT_TIMERS_GUARD=on
TESTKIT_REPORT_HANGS=on
```

#### Debugging Specific Issues
```bash
# Maximum verbosity
TESTKIT_SQLITE_GUARD=on
TESTKIT_SQLITE_GUARD_VERBOSE=on
TESTKIT_TIMERS_GUARD=on
TESTKIT_TIMERS_GUARD_VERBOSE=on
TESTKIT_REPORT_HANGS=on
```

---

## How Global Cleanup Works

TestKit now includes **automatic global resource cleanup** that runs in `afterAll` hooks:

### What Gets Cleaned Up Automatically

1. **SQLite Connection Pools**: All pools registered via `createSQLitePool()` or `SQLiteConnectionPool`
2. **Database Connections**: Individual leaked better-sqlite3 connections (when guard enabled)
3. **Timers/Intervals**: Outstanding setTimeout/setInterval (when guard enabled)
4. **Custom Resources**: Any resources registered via `registerResource()`

### Behind the Scenes

```typescript
// This happens automatically in register.ts
import { afterAll } from 'vitest'
import { cleanupAllResources } from '@orchestr8/testkit/resources'

afterAll(async () => {
  await cleanupAllResources({ continueOnError: true })
})
```

**You don't need to do anything!** Just import testkit in your vitest.config.ts:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(createBaseVitestConfig({
  test: {
    setupFiles: ['@orchestr8/testkit/register'], // This loads cleanup
  }
}))
```

---

## Troubleshooting

### Issue: Guards Not Working

**Symptoms**: Resources still leaking, tests still hanging

**Checklist**:

1. ✅ Verify environment variable is set:
   ```bash
   echo $TESTKIT_SQLITE_GUARD
   # Should output: on
   ```

2. ✅ Check TestKit is registered in vitest.config.ts:
   ```typescript
   setupFiles: ['@orchestr8/testkit/register']
   ```

3. ✅ Verify guard is actually enabled:
   ```typescript
   import { hasAnyGuardsEnabled } from '@orchestr8/testkit/guards'
   console.log('Guards enabled:', hasAnyGuardsEnabled())
   ```

4. ✅ Check you're using the latest TestKit:
   ```bash
   pnpm list @orchestr8/testkit
   # Should be >= 2.1.0
   ```

### Issue: Tests Failing with "forced closure" Errors

**Symptoms**: Tests fail in strict mode with leak detection errors

**This is expected!** Strict mode is working correctly. Fix the leaks:

```typescript
// Error message tells you which test is leaking:
// Error: SQLite Leak Guard detected 1 forced closure:
// Tests with leaks: should create user

// Fix by adding cleanup:
it('should create user', () => {
  const db = new Database(':memory:')
  try {
    // test logic
  } finally {
    db.close() // Proper cleanup
  }
})
```

### Issue: Performance Degradation

**Symptoms**: Tests running slower with guards enabled

**Diagnosis**:
1. Measure overhead: Guards typically add <5ms per test
2. Check verbose logs for excessive cleanup operations
3. Consider enabling only in CI

**Solution**:
```bash
# Option 1: CI only
if [ "$CI" = "true" ]; then
  export TESTKIT_SQLITE_GUARD=on
fi

# Option 2: Report issue if overhead is significant
```

---

## Rollout Recommendations

### Phase 1: Enable in CI (Week 1)
```yaml
# .github/workflows/test.yml
env:
  TESTKIT_SQLITE_GUARD: on
  TESTKIT_SQLITE_GUARD_VERBOSE: on  # Identify leaks
```

**Goal**: Identify all leaks without impacting local development

### Phase 2: Fix Identified Leaks (Week 2)
```bash
# Enable strict mode in CI
TESTKIT_SQLITE_GUARD_STRICT=on
```

**Goal**: Enforce no new leaks in CI

### Phase 3: Enable Locally (Week 3+)
```bash
# Add to .env or package.json scripts
TESTKIT_SQLITE_GUARD=on
```

**Goal**: Prevent leaks from being introduced

---

## FAQ

### Q: Do I need to change my test code?

**A:** No! Guards work automatically via environment variables. No code changes needed.

### Q: What if I have a legitimate long-running connection?

**A:** The SQLite guard respects:
- Read-only databases (never closed)
- Explicit cleanup in `afterAll` hooks (runs before guard)

For other cases, disable the guard for specific tests or move to proper lifecycle hooks.

### Q: Will this break my existing tests?

**A:** Not by default. Guards are opt-in (disabled by default). When enabled, they only clean up leaked resources that would cause hangs anyway.

### Q: Can I use this with other test runners (Jest, Mocha)?

**A:** Currently designed for Vitest. Guards rely on Vitest's lifecycle hooks.

### Q: What's the performance impact?

**A:** <5ms overhead per test typically. The time saved from faster test exits (20s+ → instant) far outweighs the overhead.

### Q: How do I report a bug or request a feature?

**A:** Open an issue on the [TestKit repository](https://github.com/nathanvale/orchestr8/issues).

---

## Next Steps

1. ✅ Update to TestKit 2.1.0+
2. ✅ Enable `TESTKIT_SQLITE_GUARD=on` in CI
3. ✅ Enable `TESTKIT_SQLITE_GUARD_VERBOSE=on` to identify leaks
4. ✅ Fix identified leaks in your tests
5. ✅ Enable `TESTKIT_SQLITE_GUARD_STRICT=on` to prevent new leaks
6. ✅ Roll out to local development when ready

## Additional Resources

- [Leak Guards README](../src/guards/README.md) - Technical details and API reference
- [TestKit Configuration Guide](./CONFIGURATION.md) - Complete configuration options
- [Vitest Hanging Process Reporter](https://vitest.dev/guide/debugging.html#hanging-process) - Debugging leaked handles

---

**Happy Testing! 🎉**

Questions or feedback? Open an issue or discussion on GitHub.
