---
name: Write comprehensive integration tests for SQLite helpers
status: open
created: 2025-09-23T02:00:07Z
updated: 2025-09-23T02:00:07Z
github: [Will be updated when synced to GitHub]
depends_on: [001, 002, 003, 004, 005, 006]
parallel: false
conflicts_with: []
---

# Task: Write comprehensive integration tests for SQLite helpers

## Description

Create a comprehensive test suite that validates all SQLite utilities work
correctly together. Keep the default test cycle unit-fast; place driver/ORM
integrations behind env flags.

## Acceptance Criteria

- [x] Create `packages/testkit/src/sqlite/__tests__/` with coverage for helpers
- [x] Test memory URL variants; smoke CRUD only if env enables driver
- [x] Test file database cleanup in success/failure
- [x] Verify transaction commit/rollback behavior (fake adapter)
- [x] Test migration and seeding workflows
- [x] Validate ORM URL helper outputs
- [x] Optional: env-gated driver/ORM integration tests
- [x] Anti-flake: avoid `test.concurrent` for DB tests; enforce ORDER BY in
      assertions; fix system time where relevant
- [x] Add a capabilities probe that validates environment expectations early
      (e.g., `PRAGMA foreign_keys = ON`, file DBs default to WAL when
      `applyRecommendedPragmas` is used, and JSON1 availability if relied on).
      Fail fast with a clear message if expectations aren't met.
- [x] Add a "capabilities probe" test that validates expected environment
      properties early (e.g., `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode`
      is `wal` for file DBs, and JSON1 availability if used). Fail fast with a
      clear message if expectations aren't met.

## Technical Details

- Test location: `packages/testkit/src/sqlite/__tests__/`
- Focus on behavior and error conditions
- Verify cleanup in failure scenarios
- Parallel execution coverage as needed

## Dependencies

- [x] All SQLite helper implementations (Tasks 001-006)
- [x] Vitest test runner configuration

## Effort Estimate

- Size: M
- Hours: 3-4
- Parallel: false (requires all components)

## Definition of Done

- [x] High coverage for core helpers (Phase 1)
- [x] Integration tests gated and passing when enabled
- [x] Cleanup validated in all scenarios
- [x] Documentation updated with test examples
