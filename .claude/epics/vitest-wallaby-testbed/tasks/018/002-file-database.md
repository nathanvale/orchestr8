---
name: Create file-based SQLite database helpers with cleanup
status: completed
created: 2025-09-23T02:00:07Z
updated: 2025-09-23T03:28:18Z
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

- [x] Create `packages/testkit/src/sqlite/file.ts` with file database management
- [x] Generate unique temporary database files per test
- [x] Return `{ url, dir, path, cleanup }`
- [x] Support custom database file names
- [x] Handle concurrent test execution safely (unique temp dirs)
- [x] Unit tests verify cleanup removes temp dir
- [x] Anti-flake: doc recommends close → cleanup order; per-test unique dirs
- [x] Use existing testkit FS helpers for temp dirs — do not roll your own tmp
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

- [x] Code implemented with cleanup guarantees
- [x] Unit tests verify cleanup (including failure path)
- [x] Documentation includes cleanup best practices

## Completion Notes

Completed on 2025-09-23:

### Implementation

- Enhanced existing `packages/testkit/src/sqlite/file.ts` with comprehensive
  documentation
- Added `createFileSQLiteDatabase` alias for naming consistency
- Properly delegates to `createManagedTempDirectory` for automatic cleanup
  registration
- Returns `{ url, dir, path, cleanup }` interface as specified

### Testing

- Complete test suite in `packages/testkit/src/sqlite/__tests__/file.test.ts`
  (13 tests)
- Tests verify:
  - Default and custom database names
  - Unique temporary directories per database
  - Cleanup functionality including double-cleanup handling
  - Concurrent database creation
  - URL format compatibility
  - Alias functionality

### Documentation

- Module-level documentation with best practices
- JSDoc comments for all exports
- Cleanup order recommendations (close connections before cleanup)
- Concurrency safety notes
- Usage examples

### Validation

- All tests passing (13/13)
- Quality checks passed
- TypeScript compilation successful
- Build successful
