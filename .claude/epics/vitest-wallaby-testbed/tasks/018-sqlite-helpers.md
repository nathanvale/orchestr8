---
task: 018
name: SQLite test helpers
status: in-progress
priority: high
created: 2025-09-23T15:00:00Z
updated: 2025-09-23T16:15:00Z
---

# Task 018: SQLite test helpers

## Status: 🔄 IN PROGRESS (HIGH PRIORITY)

> Progress summary: Core helpers, migrations, seeds, pragmas, and ORM URL shims
> are implemented with tests. Remaining gaps: dedicated cleanup hook
> (`cleanup.ts`), richer better-sqlite3 adapter behaviors + env-gated smoke
> tests, final integration test gating, and normalization improvements (pragma
> foreign key value semantics). Overall ~80% functional coverage of scope.

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

- [x] 001 - Memory & URL helpers (`createMemoryUrl` in `memory.ts`)
- [x] 002 - File DB with cleanup (`createFileDatabase` in `file.ts`)
- [x] 003 - Transaction utilities (`withTransaction` + adapter interface in
      `txn.ts`)
- [ ] 1A - Vitest cleanup hook (`cleanup.ts`) — NOT IMPLEMENTED (needs a
      lightweight registry + afterAll hook)

### Phase 2 — Driver adapter + pragmas

- [~] 004 - better-sqlite3 adapter (`adapters/better-sqlite3.ts`) — STUB ONLY
  (needs open helpers + real transaction semantics + tests gated by
  `SQLITE_DRIVER=better-sqlite3`)
- [x] 004a - applyRecommendedPragmas (implemented in `pragma.ts` with tests;
      follow-up: normalize foreign key values to `'on' | 'off'`)

### Phase 3 — Migrations + seeds (SQL-first)

- [x] 005 - Migration runner (`migrate.ts`) — implemented incl. checksum support
      (needs checksum tests & improved transaction detection heuristic)
- [x] 006 - Seed helpers (`seed.ts`) — implemented incl. batch API (batch path
      untested)

### Phase 4 — ORM compatibility shims

- [x] 007 - ORM URL helpers (`orm.ts`, plus Prisma-specific helpers in
      `prisma.ts`)
- [~] 007a - Integration tests — basic unit tests exist (`orm.test.ts`,
  `prisma.test.ts`), real driver integration pending (env-gated)

### Phase 5 — Docs + examples

- [x] 008 - README and cookbook (`sqlite/README.md`) — substantial content
      present (needs small drift corrections: pragma examples, busy timeout
      default)

---

## Implementation Summary

### ✅ Implemented Components

- Memory URL generation (`memory.ts`) with multi-target support
- File database helper (`file.ts`) using managed temp directories
- Transaction utilities (`txn.ts`)
- Pragmas utility with normalization & capability probing (`pragma.ts`)
- Migration runner with lexicographic ordering & per-file transactions
  (`migrate.ts`)
- Seed helpers (direct, directory, batch) (`seed.ts`)
- ORM URL shims (`orm.ts`) & Prisma configuration helpers (`prisma.ts`)
- Barrel export wiring (`index.ts`) and comprehensive test suites for most
  surfaces

### ⚠️ Partial / Pending

- Cleanup hook (`cleanup.ts`) — not yet created (add an opt-in registry to
  auto-dispose file DBs)
- better-sqlite3 adapter — currently a stub; needs transaction wrapper + pragma
  convenience + open helpers
- Batch seeding (`seedWithBatch`) — implementation present but lacks test
  coverage
- Checksum validation tests — code path exists, no dedicated assertions
- Foreign key pragma normalization — currently returns numeric '1'/'0'; should
  map to 'on'/'off' for capability alignment
- Integration tests with real drivers (Prisma, better-sqlite3) — gated tests not
  implemented

### 🧪 Test Coverage Gaps (Planned Follow-ups)

| Area                     | Gap                            | Planned Action                                                  |
| ------------------------ | ------------------------------ | --------------------------------------------------------------- |
| Batch seeding            | No success/failure/chunk tests | Add unit tests with synthetic exec driver                       |
| Checksum validation      | No tamper detection test       | Create migration dir, apply twice w/ edit                       |
| Adapter (better-sqlite3) | No behavior tests              | Implement env-gated smoke test (`SQLITE_DRIVER=better-sqlite3`) |
| Cleanup hook             | No registry semantics          | Add tests verifying auto-disposal afterAll                      |
| Probe capabilities       | Only partial via pragma tests  | Add direct tests for `probeEnvironment` once finalized          |

### 🔧 Recommended Next Steps

1. Implement `cleanup.ts` with a simple singleton registry
   (`registerTempResource(fn)`) + `afterAll` hook.
2. Normalize foreign key pragma values; adjust tests & docs.
3. Add checksum tamper test and batch seeding tests (happy path + failure
   attribution).
4. Flesh out better-sqlite3 adapter (transaction wrapper, open helpers) and gate
   with environment var.
5. Update README examples (foreign_keys = 'on', busy timeout default 2000) and
   clarify Phase 2/4 boundaries.
6. Add integration test stubs behind `TEST_SQLITE_INTEGRATION` for future driver
   verification.

### 📈 Rough Completion Estimate

- Core functional scope: ~80% complete
- Testing completeness: ~60% (due to untested batch & checksum paths)
- Adapter & integration maturity: ~30%

---

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
