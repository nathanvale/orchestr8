---
name: Create file-based SQLite database helpers with cleanup
status: open
created: 2025-09-23T02:00:07Z
updated: 2025-09-23T02:00:07Z
github: [Will be updated when synced to GitHub]
depends_on: []
parallel: true
conflicts_with: []
---

# Task: Create file-based SQLite database helpers with cleanup

## Description

Implement file-based SQLite database utilities for integration testing scenarios
that require persistence or concurrent access. Return both URL and filesystem
path, and provide guaranteed cleanup utilities. Automatic cleanup hook is
provided separately to keep this task driver-agnostic.

## Acceptance Criteria

- [ ] Create `packages/testkit/src/sqlite/file.ts` with file database management
- [ ] Generate unique temporary database files per test
- [ ] Return `{ url, dir, path, cleanup }`
- [ ] Support custom database file names
- [ ] Handle concurrent test execution safely (unique temp dirs)
- [ ] Unit tests verify cleanup removes temp dir
- [ ] Anti-flake: doc recommends close → cleanup order; per-test unique dirs
- [ ] Use existing testkit FS helpers for temp dirs — do not roll your own tmp
      logic. Prefer `createTempDirectory` or `createManagedTempDirectory` from
      `packages/testkit/src/fs`.

## Technical Details

- Implementation location: `packages/testkit/src/sqlite/file.ts`
- Use testkit FS utilities for temp dirs:
  - `createTempDirectory` when the caller manages lifecycle
  - `createManagedTempDirectory` to auto-register with the cleanup registry
- Return `cleanup` that delegates to the underlying `TempDirectory.cleanup()`
- Automatic test hook handled in `registerCleanup` (separate task)
- Avoid file locking complexity; rely on per-test unique temp dirs
- Anti-flake: enable WAL and busy_timeout in Phase 2 pragmas; avoid sharing the
  same file between test files

## Dependencies

- [ ] `packages/testkit/src/fs` (temp directory + cleanup helpers)

## Effort Estimate

- Size: M
- Hours: 3-4
- Parallel: true (can run alongside memory database task)

## Definition of Done

- [ ] Code implemented with cleanup guarantees
- [ ] Unit tests verify cleanup (including failure path)
- [ ] Documentation includes cleanup best practices
