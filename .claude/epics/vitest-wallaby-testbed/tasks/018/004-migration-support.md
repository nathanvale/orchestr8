---
name: Add SQLite migration and schema management support
status: open
created: 2025-09-23T02:00:07Z
updated: 2025-09-23T02:00:07Z
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

- [ ] Create `packages/testkit/src/sqlite/migrate.ts`
- [ ] Support SQL file-based migrations (sorted by filename)
- [ ] Each file runs in its own transaction by default
- [ ] Propagate errors with filename in message
- [ ] Minimal reset helper for tests (drop all tables) optional
- [ ] Anti-flake: lexicographic order enforced; per-file transaction; failures
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

- [ ] Migration runner implemented for .sql files
- [ ] Errors include file context
- [ ] Tests cover success and failure paths
- [ ] Documentation includes minimal patterns and limits
