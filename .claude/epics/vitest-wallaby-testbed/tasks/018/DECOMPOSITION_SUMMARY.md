# Task 018 Decomposition Summary

## Overview

Task 018 (SQLite test helpers) follows a phased, TDD-first plan aligned with the
testkit package conventions. Core helpers are driver-agnostic; better-sqlite3 is
optional and gated by env for tests.

## Task Breakdown

### Phase 1 — Core helpers (parallel)

1. **001 - Memory/URL Helpers** (3-4 hrs)
   - createMemoryUrl(target) for raw/prisma/drizzle-libsql/kysely
   - Isolation via distinct URLs
   - Unit tests only

2. **002 - File Database** (4-5 hrs)
   - createFileDatabase(name?) → { url, dir, path, cleanup }
   - Temp dir + guaranteed cleanup
   - Unit tests verify cleanup

3. **003 - Transaction Utilities** (3-4 hrs)
   - withTransaction(db, adapter, fn)
   - TransactionAdapter interface
   - Unit tests with fake adapter

4. **1A - Vitest Cleanup Hook** (1 hr)
   - registerCleanup(cb) integrates with afterAll
   - Unit tests; no hard Vitest dependency required

### Phase 2 — Driver adapter + pragmas

1. **004 - better-sqlite3 Adapter** (4-5 hrs)
   - openMemoryDb/openFileDb, adapter with begin/commit/rollback
   - Tests gated by env: SQLITE_DRIVER=better-sqlite3

2. **004a - Pragmas** (1-2 hrs)
   - applyRecommendedPragmas (WAL, foreign_keys, busy_timeout)
   - Tests assert pragma state and FK constraint; validate busy_timeout

### Phase 3 — Migrations + seeds

1. **005 - Migration Runner** (5-6 hrs)
   - applyMigrations(db, { dir, glob? }) for .sql files
   - Sorted execution, per-file txn; error propagation with file context

2. **006 - Seed Helpers** (4-5 hrs)
   - seedWithSql(sql), seedWithFiles({ dir })
   - Optional idempotent mode

### Phase 4 — ORM shims

1. **007 - ORM URL Helpers** (2-3 hrs)
   - prismaUrl(kind, path?), drizzleUrl(kind, path?, driver)
   - Unit tests only; integrations tagged

### Phase 5 — Docs

1. **008 - README & Cookbook** (2-3 hrs)
   - Hermetic patterns, examples, troubleshooting

## Execution Strategy

### Execution Strategy & Order

Phase 1 parallel (001, 002, 003, 1A) → Phase 2 (004, 004a) → Phase 3 (005, 006)
→ Phase 4 (007) → Phase 5 (008) Keep unit-tier tests fast and deterministic;
gate driver/integration tests by env.

## Resource Requirements

- **Total Effort:** ~24–30 hours
- **Optimal Team Size:** 1–2 developers
- **Critical Dependencies:**
  - Optional: better-sqlite3 (env-gated tests)
  - Node fs/path APIs
  - Existing testkit build/test setup

## Success Metrics

- ✅ Unit tests green for all core helpers (Phase 1)
- ✅ Env-gated adapter tests pass when enabled (Phase 2)
- ✅ Capabilities probe confirms expected PRAGMAs and JSON1 (if used)
- ✅ Guaranteed cleanup in all scenarios
- ✅ ORM URL compatibility validated via unit tests
- ✅ Migration and seed flows verified

## Risk Mitigation

1. **Native module install friction (better-sqlite3)**
   - Keep adapter optional; gate tests by env

2. **ORM URL variance**
   - Centralize URL logic; unit test per target

3. **FS cleanup reliability**
   - Ensure db handles are closed before rm; use force recursive delete

## Next Steps

1. Approve phases and estimates
2. Start Phase 1 tasks in parallel
3. Add env gating for adapter tests (`SQLITE_DRIVER=better-sqlite3`)
4. Implement Phase 1; wire exports in testkit
5. Proceed to Phase 2–3 sequentially
