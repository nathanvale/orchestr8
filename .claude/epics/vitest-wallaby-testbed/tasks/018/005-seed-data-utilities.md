---
name: Implement seed data and fixture management utilities
status: completed
created: 2025-09-23T02:00:07Z
updated: 2025-09-23T06:15:00Z
github: [Will be updated when synced to GitHub]
depends_on: [001, 002, 004]
parallel: false
conflicts_with: [004]
---

# Task: Implement seed data and fixture management utilities

## Description

Create utilities for managing test data, focusing on SQL-first seeding. Provide
helpers to run SQL strings or directories of .sql files, and an optional
idempotent mode for rerunnable seeds.

## Acceptance Criteria

- [x] Create `packages/testkit/src/sqlite/seed.ts`
- [x] `seedWithSql(sql, run)` executes provided SQL
- [x] `seedWithFiles({ dir }, run)` loads .sql files in order
- [x] Optional idempotent mode (e.g., INSERT OR IGNORE pattern)
- [x] Minimal reset helper can be shared with migration task
- [x] Anti-flake: idempotent seeds verified; directory seeding uses
      lexicographic order

## Technical Details

- Implementation location: `packages/testkit/src/sqlite/seed.ts`
- Keep deterministic by avoiding randomness; leave factories for app code
- SQL-only for speed and simplicity

## Dependencies

- [ ] Memory database implementation (Task 001)
- [ ] File database implementation (Task 002)
- [ ] Migration support (Task 004)
- [ ] Randomness control utilities (Task 008)

## Effort Estimate

- Size: M
- Hours: 3-4
- Parallel: false (depends on migration support)

## Definition of Done

- [x] SQL seed helpers implemented
- [x] Tests verify seeds applied and idempotent mode
- [x] Documentation includes seed patterns and caveats
