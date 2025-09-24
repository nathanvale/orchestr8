---
name: Add SQLite migration and schema management support
status: completed
created: 2025-09-23T02:00:07Z
updated: 2025-09-23T14:10:00Z
github: [Will be updated when synced to GitHub]
depends_on: [001, 002]
parallel: false
conflicts_with: [005]
---

# Task: Add SQLite migration and schema management support

## Description

Implement fast SQL-first migration utilities to set up database schemas for
tests. Execute .sql files in lexicographic order with clear error propagation
including file context. Keep APIs minimal for unit-tier speed.

## Acceptance Criteria

- [x] Create `packages/testkit/src/sqlite/migrate.ts`
- [x] Support SQL file-based migrations (sorted by filename)
- [x] Each file runs in its own transaction by default
- [x] Propagate errors with filename in message
- [x] Minimal reset helper for tests (drop all tables) optional
- [x] Anti-flake: lexicographic order enforced; per-file transaction; failures
      include filename context

## Technical Details

- Implementation location: `packages/testkit/src/sqlite/migrate.ts`
- SQL-only runner for unit-tier speed; avoid invoking external CLIs
- Provide simple hook shape: `applyMigrations(db, { dir, glob? })`
- Optional: adapter-specific integrations live in ORM tasks

## Dependencies

- [ ] Memory database implementation (Task 001)
- [ ] File database implementation (Task 002)
- [ ] File system utilities for reading migration files

## Effort Estimate

- Size: M
- Hours: 4-5
- Parallel: false (can start after database tasks)

## Definition of Done

- [x] Migration runner implemented for .sql files
- [x] Errors include file context
- [x] Tests cover success and failure paths
- [x] Documentation includes minimal patterns and limits

## Completion Notes

Completed on 2025-09-23:

### Implementation

- Created `packages/testkit/src/sqlite/migrate.ts` with full migration support
- Lexicographic ordering enforced for predictable execution
- Per-file transaction isolation for safe execution
- Clear error propagation with filename context
- Database abstraction supporting both `exec()` and `execute()` methods

### Testing with Wallaby TDD

- 17 comprehensive tests with 97.44% coverage
- All tests passing with runtime verification via Wallaby
- Tests cover:
  - Success paths with multiple migrations
  - Error handling with filename context
  - Transaction isolation and rollback
  - Edge cases (empty dirs, invalid paths)
  - Integration patterns with real SQLite

### Features Implemented

- `applyMigrations(db, { dir, glob? })` - Main migration runner
- `resetDatabase(db)` - Drop all tables helper for test teardown
- Custom glob pattern support for flexible file matching
- Automatic .sql file filtering
- Database interface compatibility (exec/execute methods)
