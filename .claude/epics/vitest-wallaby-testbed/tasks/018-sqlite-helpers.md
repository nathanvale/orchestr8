---
task: 018
name: SQLite test helpers
status: open
priority: high
created: 2025-09-23T15:00:00Z
updated: 2025-09-23T16:15:00Z
---

# Task 018: SQLite test helpers

## Status: ❌ NOT STARTED (HIGH PRIORITY)

## Requirements (from Review)

Implement SQLite helpers for unit-tier database testing.

### Required Components (testkit package)

- `packages/testkit/src/sqlite/memory.ts` - In-memory DB URLs
- `packages/testkit/src/sqlite/file.ts` - File-based DB helpers + cleanup
- `packages/testkit/src/sqlite/txn.ts` - Transaction utilities (adapter-based)
- `packages/testkit/src/sqlite/cleanup.ts` - Vitest-safe cleanup hook
- `packages/testkit/src/sqlite/migrate.ts` - SQL-first migrations (Phase 3)
- `packages/testkit/src/sqlite/seed.ts` - Seed helpers (Phase 3)
- `packages/testkit/src/sqlite/adapters/better-sqlite3.ts` - Driver adapter
  (Phase 2)
- `packages/testkit/src/sqlite/pragma.ts` - Recommended pragmas (Phase 2)
- `packages/testkit/src/sqlite/orm.ts` - URL shims per ORM (Phase 4)

### Implementation Goals

```typescript
// Memory database URL (target-aware)
export function createMemoryUrl(
  target:
    | 'raw'
    | 'prisma'
    | 'drizzle-libsql'
    | 'kysely'
    | 'drizzle-better-sqlite3' = 'raw',
): string

// File databases with cleanup
export function createFileDatabase(name?: string): Promise<{
  url: string
  dir: string
  path: string
  cleanup: () => Promise<void>
}>

// Transaction helpers
export function withTransaction<T, TDb, TTx>(
  db: TDb,
  adapter: TransactionAdapter<TDb, TTx>,
  fn: (tx: TTx) => Promise<T>,
): Promise<T>
```

### Features Needed

- URL generation for ORMs (Prisma, Drizzle, Kysely, raw)
- Automatic cleanup registration (Vitest afterAll)
- Transaction rollback testing (adapter model)
- SQL-first migration support (execute .sql files in order)
- Seed data utilities (SQL strings/files)
- Recommended pragmas (WAL, foreign_keys, busy_timeout)

### Test Requirements

1. Memory database happy path
2. File-based database parity test
3. Transaction rollback verification
4. Cleanup validation
5. ORM compatibility tests (string-only in unit tier)
6. better-sqlite3 adapter smoke tests (env-gated)

## Priority Justification

- Identified as key gap in implementation review
- Needed for unit-tier database testing
- Blocks full testing pyramid implementation

## References

- Technical Design Document examples
- Implementation review recommendations
- Decision note: prefer better-sqlite3 for TDD; SQL-first migrations

## Phased Plan (TDD-first, testkit-aligned)

This effort is organized into 5 phases with clear acceptance criteria and
minimal cross-coupling.

### Phase 1 — Core helpers (parallelizable)

- [ ] 001 - Memory & URL helpers (createMemoryUrl)
- [ ] 002 - File DB with cleanup (createFileDatabase)
- [ ] 003 - Transaction utilities (withTransaction + adapter type)
- [ ] 1A - Vitest cleanup hook (registerCleanup)

### Phase 2 — Driver adapter + pragmas

- [ ] 004 - better-sqlite3 adapter (openMemoryDb/openFileDb) [env-gated tests]
- [ ] 004a - applyRecommendedPragmas (WAL, foreign_keys)

### Phase 3 — Migrations + seeds (SQL-first)

- [ ] 005 - Migration runner (applyMigrations; .sql only)
- [ ] 006 - Seed helpers (seedWithSql/seedWithFiles)

### Phase 4 — ORM compatibility shims

- [ ] 007 - ORM URL helpers (prismaUrl/drizzleUrl)
- [ ] 007a - Integration tests (skipped unless env enabled)

### Phase 5 — Docs + examples

- [ ] 008 - README and cookbook (hermetic patterns)

## Estimates and critical path

- Phase 1: 0.5–1 day (parallel)
- Phase 2: 0.5–1 day
- Phase 3: 0.5–1 day
- Phase 4: 0.25 day
- Phase 5: 0.25 day

Critical path: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

## Integration with testkit

- Live under `packages/testkit/src/sqlite/**`
- Barrel exports via `packages/testkit/src/sqlite/index.ts` and re-export from
  `packages/testkit/src/index.ts`
- Tests colocated in `packages/testkit/src/sqlite/*.test.ts`
- better-sqlite3 kept optional; adapter tests gated by
  `SQLITE_DRIVER=better-sqlite3`

## Anti-flake checklist (must-haves)

- Isolation by default
  - Prefer transaction-per-test (BEGIN/ROLLBACK) or fresh DB per suite
  - Do not share a DB handle across tests or files
- Correct URL per target
  - raw/kysely: `file::memory:?cache=shared`
  - prisma: `file:memory?mode=memory&cache=shared`
  - better-sqlite3: `':memory:'`
- Deterministic pragmas for file DBs
  - `journal_mode = WAL`
  - `foreign_keys = ON`
  - `busy_timeout = 2000`
- Explicit data determinism
  - Always use `ORDER BY` in assertions
  - Fix test clock (`vi.setSystemTime`) for time-derived values
- Migrations & seeds
  - Lexicographic migration order; each file runs in a transaction
  - Seeds use idempotent patterns (`INSERT OR IGNORE` /
    `ON CONFLICT DO NOTHING`)
- Vitest execution
  - Avoid `test.concurrent` for DB tests
  - Keep worker count reasonable for DB-heavy suites
