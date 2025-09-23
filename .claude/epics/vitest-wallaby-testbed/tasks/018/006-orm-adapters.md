---
name: Create ORM-specific SQLite adapters and helpers
status: open
created: 2025-09-23T02:00:07Z
updated: 2025-09-23T02:00:07Z
github: [Will be updated when synced to GitHub]
depends_on: [001, 002, 003, 004, 005]
parallel: false
conflicts_with: []
---

# Task: Create ORM-specific SQLite adapters and helpers

## Description

Provide lightweight URL shims and compatibility helpers for popular ORMs
(Prisma, Drizzle, Kysely/Knex) to simplify SQLite testing setup without pulling
heavy dependencies. Keep deep adapters out of testkit; integration tests can
live behind env flags.

## Acceptance Criteria

- [ ] Create `packages/testkit/src/sqlite/orm.ts`
- [ ] Implement `prismaUrl(kind, path?)` and `drizzleUrl(kind, path?, driver)`
- [ ] Provide types for supported targets/drivers
- [ ] Unit tests validate string outputs per ORM
- [ ] Optional integration test stubs (skipped unless env enabled)

## Technical Details

- Implementation location: `packages/testkit/src/sqlite/orm.ts`
- Handle ORM-specific connection strings only; no client management
- Integration examples can live in docs or app packages
- Note: libsql/drizzle and Prisma memory modes have nuances; document expected
  URL forms and environment toggles. Keep adapters string-only and gate any
  integration tests with env flags.

## Dependencies

- [ ] All core SQLite utilities (Tasks 001-005)
- [ ] ORM packages as peer dependencies

## Effort Estimate

- Size: L
- Hours: 2-3
- Parallel: false (depends on all core utilities)

## Definition of Done

- [ ] URL shims implemented and unit-tested
- [ ] Optional integration tests are gated and documented
- [ ] Documentation covers ORM-specific URL forms
