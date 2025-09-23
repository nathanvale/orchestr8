---
name: Apply recommended SQLite pragmas for stability and determinism
status: completed
created: 2025-09-23T02:15:00Z
updated: 2025-09-23T15:50:00Z
github: [Will be updated when synced to GitHub]
depends_on: [001, 002]
parallel: false
conflicts_with: []
---

# Task: Apply recommended SQLite pragmas for stability and determinism

## Description

Provide a helper to set recommended SQLite pragmas for test stability on file
databases, and optionally no-op for pure in-memory URLs that don't support
file-backed WAL. Defaults target repeatability and reduces flake under
concurrency.

## Acceptance Criteria

- [x] Create `packages/testkit/src/sqlite/pragma.ts` exporting
      `applyRecommendedPragmas(db, opts?)`
- [x] Set at minimum: `journal_mode = WAL`, `foreign_keys = ON`,
      `busy_timeout = 2000` ms
- [x] Return effective values to aid assertions
- [x] No-op safely for in-memory forms that cannot enable WAL
- [x] Unit tests cover: file DB sets WAL and FK, busy_timeout applied, and
      in-memory no-op behavior
- [x] Anti-flake: document that WAL requires a file-backed DB; advise per-test
      isolation or txn-per-test

## Technical Details

- Implementation location: `packages/testkit/src/sqlite/pragma.ts`
- Use driver adapter for executing PRAGMAs (Phase 2 adapter provides exec)
- Consider returning a map of applied settings
  `{ journal_mode, foreign_keys, busy_timeout }`

## Dependencies

- [ ] Memory database implementation (Task 001)
- [ ] File database implementation (Task 002)
- [ ] Driver adapter capable of executing PRAGMA (Task 004)

## Effort Estimate

- Size: S
- Hours: 1-2
- Parallel: false (depends on adapter)

## Definition of Done

- [x] Helper implemented with safe no-ops for unsupported modes
- [x] Unit tests verifying applied pragmas and returns
- [x] Docs updated to show recommended usage order (open → pragmas → migrate →
      seed)
