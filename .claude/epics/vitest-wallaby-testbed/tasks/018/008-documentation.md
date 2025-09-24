---
name: Document SQLite testing patterns and best practices
status: open
created: 2025-09-23T02:00:07Z
updated: 2025-09-23T02:00:07Z
github: [Will be updated when synced to GitHub]
depends_on: [001, 002, 003, 004, 005, 006, 007]
parallel: false
conflicts_with: []
---

# Task: Document SQLite testing patterns and best practices

## Description

Create concise documentation for SQLite testing utilities, including API
references, hermetic test patterns, and best practices. Include examples aligned
with testkit’s style.

## Acceptance Criteria

- [ ] Create README.md for SQLite utilities
- [ ] Document all public APIs with examples
- [ ] Include hermetic patterns (txn-per-test, fresh-db-per-suite)
- [ ] Create troubleshooting section
- [ ] Add cookbook of common testing patterns
- [ ] Anti-flake: dedicated section covering isolation, pragmas (WAL,
      foreign_keys, busy_timeout), deterministic ordering, and time control
- [ ] Include an environment "capabilities probe" example that teams can run at
      suite startup to fail fast if expectations aren't met (e.g.,
      `PRAGMA foreign_keys = ON`, file DBs set to WAL when
      `applyRecommendedPragmas` is used, and JSON1 availability if relied on)

## Technical Details

- Documentation locations:
  - `packages/testkit/src/sqlite/README.md`
  - API docs in source files (JSDoc)
  - Examples in `packages/testkit/examples/sqlite/`
- Include code examples for major use cases
- Explain when to use memory vs file databases
- Cover ORM-specific URL considerations

  Tip: Provide a tiny `probeEnvironment()` snippet demonstrating how to assert
  key `PRAGMA` values and extension availability before starting integration
  tests.

## Dependencies

- [ ] All SQLite implementations complete (Tasks 001-006)
- [ ] Integration tests complete (Task 007)

## Effort Estimate

- Size: S
- Hours: 2-3
- Parallel: false (requires completed implementation)

## Definition of Done

- [ ] README with complete overview
- [ ] API documentation in all source files
- [ ] 5+ cookbook examples
- [ ] Troubleshooting guide with common issues
