# Convex Testing Examples

This directory contains runnable examples that demonstrate best‑practice
patterns with `convex-test` and the thin harness in `@template/testkit/convex`.

## Opt‑in: enable runnable tests

By default these examples are skipped so the repo stays runnable without Convex
codegen.

- Generate Convex code in your app: `npx convex codegen` (or `npx convex dev`)
- Run with the env flag:
  - `CONVEX_GENERATED=true pnpm --filter @template/testkit test`

## Example Files

### 1. [Minimal](./01-minimal.test.ts)

Smallest end‑to‑end example

- Create test instance with an explicit `modules` map
- Anonymous run with `t.run`
- Identity via `t.withIdentity`

### 2. [Auth Impersonation](./02-auth-impersonation.test.ts)

Fluent identity patterns

- `withIdentity` for isolated contexts
- Verify data visibility per subject

### 3. [Seed and Query](./03-seed-and-query.test.ts)

Database helpers with `t.run`

- Insert documents and query with filters
- Keep logic inside the provided context

### 4. [Scheduler](./04-scheduler.test.ts)

Timers, cleanup, and chains

- Use `vi.useFakeTimers()` for determinism
- Finish scheduled functions with
  `t.finishAllScheduledFunctions(vi.runAllTimers)`
- Always restore real timers in `finally`

### 5. [External Actions](./05-external-actions.test.ts)

HTTP stubbing and actions

- Stub global `fetch` via `vi.stubGlobal`
- Clean up stubs with `vi.unstubAllGlobals()`

### 6. [Reset and Seed](./06-reset-and-seed.test.ts)

Lifecycle and isolation

- Reset state between tests when needed
- Clear data and reseed deterministically

### 7. [Comprehensive](./07-comprehensive.test.ts)

Kitchen‑sink demonstration

- Identity flows, storage, scheduler patterns
- Error handling and isolation checks

### 8. [Storage Ops](./08-storage-ops.test.ts)

Working with `ctx.storage`

- Store, retrieve, and delete blobs via `t.run`
- Pair storage IDs with DB metadata

## Key Patterns

- Prefer fluent `withIdentity` for isolation
- Do all DB/storage work inside `t.run`
- For scheduler tests: fake timers + advance timers during cleanup
- Keep modules explicit (use an empty map for demonstration or
  `import.meta.glob` with `eager: true` in real apps)
