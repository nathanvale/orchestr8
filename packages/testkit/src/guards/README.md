# TestKit Leak Guards

Automatic detection and cleanup of resource leaks that prevent Vitest processes from exiting cleanly.

## Problem Statement

Tests may inadvertently leave resources open (SQLite database connections, timers, intervals, etc.), causing Vitest processes to hang for 20+ seconds before timing out. This severely impacts:

- **Local development**: Slow feedback loops
- **CI/CD pipelines**: Inflated build times and potential timeouts
- **Developer experience**: Frustration from hanging test processes

Common symptoms:
- "Tests closed successfully but something prevents the main process from exiting"
- Timeout in TestKit's global teardown after 20s
- Vitest's `hanging-process` reporter showing many `FILEHANDLE` entries with unknown stack traces

## Solution

TestKit's leak guards automatically detect and clean up leaked resources:

1. **SQLite Guard**: Tracks better-sqlite3 database connections and auto-closes leaked DBs
2. **Timers Guard**: Tracks setTimeout/setInterval and auto-clears leaked timers
3. **Hanging-Process Reporter**: Automatically enables Vitest's reporter to surface leaked handles

## Quick Start

### Enable SQLite Guard

```bash
# Enable SQLite leak detection
export TESTKIT_SQLITE_GUARD=on

# Run your tests
pnpm test
```

That's it! The guard will automatically close any leaked database connections.

### Enable in CI Only

```yaml
# .github/workflows/test.yml
env:
  TESTKIT_SQLITE_GUARD: on
  TESTKIT_REPORT_HANGS: on  # Auto-enabled in CI by default
```

## Configuration

### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `TESTKIT_SQLITE_GUARD` | `on`/`off` | `off` | Enable SQLite leak detection |
| `TESTKIT_SQLITE_GUARD_STRICT` | `on`/`off` | `off` | Fail tests if leaks detected |
| `TESTKIT_SQLITE_GUARD_VERBOSE` | `on`/`off` | `off` | Log forced closures |
| `TESTKIT_TIMERS_GUARD` | `on`/`off` | `off` | Enable timer leak detection |
| `TESTKIT_TIMERS_GUARD_VERBOSE` | `on`/`off` | `off` | Log cleared timers |
| `TESTKIT_REPORT_HANGS` | `on`/`off` | `on` in CI | Append hanging-process reporter |

All boolean variables support multiple formats: `on`/`off`, `true`/`false`, `1`/`0`, `yes`/`no`

### Strict Mode

Strict mode makes tests fail if leaks are detected, encouraging developers to fix them:

```bash
export TESTKIT_SQLITE_GUARD=on
export TESTKIT_SQLITE_GUARD_STRICT=on

pnpm test
```

Output when leaks are detected:
```
Error: SQLite Leak Guard detected 2 forced closures:

Tests with leaks: my-test, another-test

Leaked databases:
  - :memory: (my-test)
  - /tmp/test.db (another-test)

Please close all database connections in your tests using db.close()
```

### Verbose Mode

Verbose mode logs each forced closure for debugging:

```bash
export TESTKIT_SQLITE_GUARD=on
export TESTKIT_SQLITE_GUARD_VERBOSE=on

pnpm test
```

Output:
```
[SQLite Guard] Auto-closed leaked database ":memory:" opened in test "should create user"
[SQLite Guard] Auto-closed leaked database "/tmp/test.db" opened outside test context
```

## Usage Examples

### Basic Usage (Automatic)

When guards are enabled via environment variables, they work automatically:

```typescript
// No changes needed to your tests!
import Database from 'better-sqlite3'
import { it, expect } from 'vitest'

it('creates a user', () => {
  const db = new Database(':memory:')
  // ... test logic ...
  // Forgot to call db.close() - guard will handle it!
})
```

### Programmatic Usage

For advanced scenarios, you can configure guards programmatically:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(createBaseVitestConfig({
  // Guards are configured via environment variables
  // or you can set them in your shell/CI environment
}))
```

```typescript
// Manual setup (rarely needed - auto-enabled via register)
import { setupSqliteGuard, getSqliteGuardConfig } from '@orchestr8/testkit/guards'

setupSqliteGuard(getSqliteGuardConfig())
```

## How It Works

### SQLite Guard

1. Wraps `better-sqlite3`'s constructor with a Proxy
2. Tracks all created database instances
3. In `afterEach` and `afterAll` hooks:
   - Checks each tracked DB
   - Closes DBs where `db.open === true && db.readonly !== true`
   - Respects read-only databases (doesn't close them)
4. In strict mode, throws error if forced closures occurred

### Timers Guard

1. Wraps `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`
2. Tracks all created timers/intervals
3. In `afterEach` hook:
   - Clears all outstanding timers
   - Prevents timers from leaking between tests

### Performance

- **Minimal overhead**: <5ms per test
- **Proxy wrapping**: Only happens at construction time
- **Cleanup**: Batch operations in parallel

## Migration from Manual Workarounds

If you have existing workarounds, you can remove them:

### Before (Manual Workaround)

```typescript
// vitest.setup.ts
import Database from 'better-sqlite3'
import { vi, afterEach } from 'vitest'

const trackedDbs = new Set()

vi.mock('better-sqlite3', async () => {
  const actual = await vi.importActual('better-sqlite3')
  return {
    default: new Proxy(actual.default, {
      construct(target, args) {
        const db = new target(...args)
        trackedDbs.add(db)
        return db
      }
    })
  }
})

afterEach(() => {
  for (const db of trackedDbs) {
    if (db.open && !db.readonly) db.close()
  }
  trackedDbs.clear()
})
```

### After (TestKit Guards)

```bash
# Just enable the guard
export TESTKIT_SQLITE_GUARD=on
```

Remove the manual setup file and enjoy automatic leak detection!

## Troubleshooting

### Guard Not Working

1. **Check environment variables**:
   ```bash
   echo $TESTKIT_SQLITE_GUARD
   ```

2. **Verify guard is enabled**:
   ```typescript
   import { hasAnyGuardsEnabled } from '@orchestr8/testkit/guards'
   console.log('Guards enabled:', hasAnyGuardsEnabled())
   ```

3. **Check TestKit registration**:
   ```typescript
   // Ensure your vitest.config.ts uses TestKit's setupFiles
   setupFiles: ['@orchestr8/testkit/register']
   ```

### False Positives

If the guard is closing databases it shouldn't:

1. **Read-only databases**: Already excluded automatically
2. **Long-running databases**: Consider using `beforeAll`/`afterAll` instead of leaving them open
3. **Shared connections**: Move to a proper connection pool or singleton pattern

### Performance Impact

If you notice performance degradation:

1. **Measure overhead**: Guards add <5ms per test typically
2. **Disable in development**: Only enable in CI
3. **Report issues**: If overhead is significant, please report it

## Rollout Strategy

TestKit guards follow a gradual rollout:

### Phase 1: Opt-In (v2.1.0) - **Current**
- Guards disabled by default
- Enable explicitly with environment variables
- Gather feedback and usage patterns

### Phase 2: CI Default (v2.2.0) - **Planned**
- Auto-enable in CI (`CI=true`)
- Still opt-in locally
- Provide escape hatch: `TESTKIT_SQLITE_GUARD=off`

### Phase 3: Default On (v3.0.0) - **Future**
- Enabled everywhere by default
- Opt-out with `TESTKIT_SQLITE_GUARD=off`
- Breaking change, major version bump

## API Reference

### Configuration Functions

```typescript
import {
  getGuardsConfig,
  getSqliteGuardConfig,
  getTimersGuardConfig,
  getReportHangsConfig,
  hasAnyGuardsEnabled,
} from '@orchestr8/testkit/guards'

// Get complete config
const config = getGuardsConfig()

// Check if any guards are enabled
if (hasAnyGuardsEnabled()) {
  // Guards are active
}
```

### Setup Functions

```typescript
import {
  setupGuards,
  setupSqliteGuard,
  setupTimersGuard,
} from '@orchestr8/testkit/guards'

// Setup all enabled guards (auto-called by register.ts)
await setupGuards()

// Setup individual guards
setupSqliteGuard({ enabled: true, strict: false, verbose: true })
setupTimersGuard({ enabled: true, verbose: false })
```

### Type Definitions

```typescript
interface SqliteGuardConfig {
  enabled: boolean
  strict: boolean
  verbose: boolean
}

interface TimersGuardConfig {
  enabled: boolean
  verbose: boolean
}

interface GuardsConfig {
  sqliteGuard: SqliteGuardConfig
  timersGuard: TimersGuardConfig
  reportHangs: boolean
}
```

## Best Practices

1. **Enable in CI first**: Test guards in CI before rolling out locally
2. **Use strict mode in CI**: Enforce no leaks in CI pipelines
3. **Use verbose mode for debugging**: Enable when diagnosing specific issues
4. **Fix leaks properly**: Don't rely on guards as a crutch - fix the root cause
5. **Combine with hanging-process reporter**: Use both for comprehensive debugging

## Contributing

Found a bug or have a feature request? Please open an issue or PR on the [TestKit repository](https://github.com/nathanvale/orchestr8).

## License

MIT
