---
name: Build SQLite transaction utilities for test isolation
status: open
created: 2025-09-23T02:00:07Z
updated: 2025-09-23T02:00:07Z
github: [Will be updated when synced to GitHub]
depends_on: [001, 002]
parallel: false
conflicts_with: []
---

# Task: Build SQLite transaction utilities for test isolation

## Description

Create transaction management utilities that enable test isolation through
commit/rollback using a generic adapter model. Keep driver-agnostic here;
provide nested/savepoint support later if needed.

## Acceptance Criteria

- [ ] Create `packages/testkit/src/sqlite/txn.ts` with transaction helpers
- [ ] Implement `withTransaction` wrapper for commit/rollback
- [ ] Define `TransactionAdapter<TDb, TTx>` interface
- [ ] Enable transaction-per-test isolation pattern (docs/example)
- [ ] Unit tests using a fake adapter
- [ ] Anti-flake: document transaction-per-test as the default pattern; avoid
      concurrent DB tests in a single file

## Technical Details

- Implementation location: `packages/testkit/src/sqlite/txn.ts`
- Driver-agnostic; no direct DB calls here
- Keep API minimal: begin/commit/rollback via adapter
- Nested/savepoint support can be added later if needed

## Dependencies

- [ ] Memory database implementation (Task 001)
- [ ] File database implementation (Task 002)
- [ ] Database driver with transaction support

## Effort Estimate

- Size: M
- Hours: 3-4
- Parallel: false (depends on database implementations)

## Definition of Done

- [ ] Transaction wrapper implemented with rollback
- [ ] Unit tests cover commit and rollback behavior
- [ ] Documentation includes transaction-per-test pattern
