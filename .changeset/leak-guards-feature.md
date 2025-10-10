---
"@orchestr8/testkit": minor
---

feat: add SQLite leak guard and open-handle hygiene

Adds automatic detection and cleanup of resource leaks (SQLite databases, timers) that prevent Vitest processes from exiting cleanly.

**Features:**
- SQLite Leak Guard: auto-closes leaked better-sqlite3 connections
- Timers Guard: auto-clears leaked setTimeout/setInterval
- Hanging-Process Reporter: auto-enables in CI for debugging
- Strict mode: fails tests if leaks detected
- Verbose mode: logs forced closures for debugging

**Configuration (opt-in):**
- `TESTKIT_SQLITE_GUARD=on` - Enable SQLite leak detection
- `TESTKIT_SQLITE_GUARD_STRICT=on` - Fail on leaks
- `TESTKIT_SQLITE_GUARD_VERBOSE=on` - Log closures
- `TESTKIT_TIMERS_GUARD=on` - Enable timer cleanup
- `TESTKIT_REPORT_HANGS=on` - Enable hanging-process reporter (default in CI)

**Usage:**
```bash
export TESTKIT_SQLITE_GUARD=on
pnpm test
```

Fixes hanging Vitest processes that timeout after 20+ seconds. With guards enabled, processes exit cleanly within 2 seconds.
