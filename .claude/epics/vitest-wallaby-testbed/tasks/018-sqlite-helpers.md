---
task: 018
name: SQLite test helpers
status: open
priority: high
created: 2025-09-23T15:00:00Z
updated: 2025-09-23T15:00:00Z
---

# Task 018: SQLite test helpers

## Status: ❌ NOT STARTED (HIGH PRIORITY)

## Requirements (from Review)

Implement SQLite helpers for unit-tier database testing.

### Required Components

- `src/sqlite/memory.ts` - In-memory database URLs
- `src/sqlite/file.ts` - File-based database helpers
- `src/sqlite/txn.ts` - Transaction utilities

### Implementation Goals

```typescript
// Memory databases
export function createMemoryDatabase(): string {
  return 'sqlite::memory:'
}

// File databases with cleanup
export function createFileDatabase(name?: string): {
  url: string
  cleanup: () => Promise<void>
}

// Transaction helpers
export function withTransaction<T>(
  db: Database,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T>
```

### Features Needed

- URL generation for ORMs (Prisma, Drizzle, etc.)
- Automatic cleanup registration
- Transaction rollback testing
- Migration support
- Seed data utilities

### Test Requirements

1. Memory database happy path
2. File-based database parity test
3. Transaction rollback verification
4. Cleanup validation
5. ORM compatibility tests

## Priority Justification

- Identified as key gap in implementation review
- Needed for unit-tier database testing
- Blocks full testing pyramid implementation

## References

- Technical Design Document examples
- Implementation review recommendations
