---
name: Implement in-memory SQLite memory/URL helpers
status: completed
created: 2025-09-23T02:00:07Z
updated: 2025-09-23T13:15:00Z
github: [Will be updated when synced to GitHub]
depends_on: []
parallel: true
conflicts_with: []
---

# Task: Implement in-memory SQLite database helpers

## Description

Create the foundational in-memory SQLite helpers for fast unit testing. Focus on
URL generation only (driver-agnostic) with target-specific forms for raw SQLite,
Prisma, Drizzle (libsql), Kysely, and better-sqlite3. Keep connection/driver
code out of this task.

## Acceptance Criteria

- [x] Create `packages/testkit/src/sqlite/memory.ts` with memory database URL
      generation
- [x] Support target-specific URL variants (`raw`, `prisma`, `drizzle-libsql`\*,
      `kysely`, `drizzle-better-sqlite3`)
- [x] Provide TypeScript types (e.g., `OrmTarget`)
- [x] Support shared memory forms where applicable
- [x] Unit tests validate exact URL strings per target
- [x] Anti-flake: document when `:memory:` is not shared and require shared
      cache forms where needed
                  Notes:
                  - Prisma memory URLs use `file:memory?mode=memory&cache=shared`; ensure
                        connection pooling is disabled for unit tests.
                  - `drizzle-libsql` may behave differently depending on driver; treat as
                        optional and document caveats.

## Technical Details

- Implementation location: `packages/testkit/src/sqlite/memory.ts`
- Use `':memory:'` for drivers that accept it directly (better-sqlite3)
- Use `file::memory:?cache=shared` for raw SQLite/lib clients
- Use `file:memory?mode=memory&cache=shared` for Prisma
- Exclude driver code and pragmas (handled in later phases)
- Anti-flake: make it explicit that plain `:memory:` creates isolated
  connections except for drivers that accept a single shared handle

## Dependencies

- [x] TypeScript type definitions only (no driver dependency)

## Effort Estimate

- Size: S
- Hours: 2-3
- Parallel: true (can run alongside other SQLite tasks)

## Definition of Done

- [x] Code implemented with full TypeScript support
- [x] Unit tests written and passing (12 tests, all passing)
- [x] JSDoc documentation for all public APIs
- [x] Examples included in tests
