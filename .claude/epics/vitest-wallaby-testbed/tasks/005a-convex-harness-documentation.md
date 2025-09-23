---
task: 005a
name: Document Convex test harness
status: closed
created: 2025-09-23T20:00:00Z
updated: 2025-09-23T20:03:00Z
depends_on: [005]
---

# Task 005a: Document Convex test harness

## Status: OPEN

## Goal

Produce clear, actionable documentation for the Convex test harness built in
Task 005, including API references, setup/bootstrapping patterns, cookbook
examples, troubleshooting, and anti-flake practices. Ensure alignment with
testkit’s documentation style.

## Deliverables

- README at `packages/testkit/src/convex/README.md`
- API JSDoc across `packages/testkit/src/convex/*.ts` kept up to date
- 6+ runnable examples under `packages/testkit/examples/convex/`
- Troubleshooting section (auth context, storage, scheduler, resets)
- Anti-flake guidance (deterministic seeds, isolation, cleanup)
- Import-order/bootstrap notes (if any harness setup is required)
- Cross-links from root `README.md` and relevant `docs/guides/*`

## Acceptance Criteria

- [x] Create Convex harness README at `packages/testkit/src/convex/README.md`
- [x] Document public APIs with examples: - Harness factory:
      `createConvexTestHarness()` - Scheduler: `finishAllScheduledFunctions()`,
      `finishInProgressScheduledFunctions()` - Contexts: database, auth/user
      impersonation, storage, actions - Lifecycle/reset helpers
- [x] Provide a cookbook with at least 6 scenarios: - Seed data and verify
      queries/mutations - User impersonation flows and access control checks -
      Storage uploads/downloads, typed arrays/buffers - Scheduled functions
      completion patterns - External action mocking - Full reset between tests
      and deterministic seeding
- [x] Add troubleshooting for common issues (ArrayBuffer types, auth scope,
      scheduler timing, cleanup)
- [x] Anti-flake guidance covering deterministic ordering, seeded randomness,
      proper teardown, and isolation patterns
- [x] Cross-link from root `README.md` and relevant guides in `docs/guides/*`

## Scope and Locations

Core modules to cover and link:

- `packages/testkit/src/convex/harness.ts` — Main harness adapter
- `packages/testkit/src/convex/context.ts` — Context utilities
- `packages/testkit/src/convex/index.ts` — Public API exports

Examples directory: `packages/testkit/examples/convex/`

## Cookbook Scenarios (to include)

1. Basic query/mutation with seeded data
2. Auth: impersonate different users and assert access controls
3. Storage: upload/download buffers and typed arrays
4. Scheduler: finish queued/in-progress scheduled functions
5. Actions: mock external HTTP/API calls
6. Reset and deterministic seed between tests

## Troubleshooting Matrix (high-level)

- Typed array/ArrayBuffer quirks → use provided helpers; ensure proper
  conversions
- Leaking state between tests → always reset/teardown via lifecycle helpers
- Auth scope confusion → ensure impersonation is set per test with clear
  teardown
- Scheduler timing → use `finishAllScheduledFunctions()` where needed

## Verification

- README present and linked from root/guides
- Cookbook examples are runnable and referenced from README
- JSDoc updated for all public APIs
- Harness behaves deterministically in examples
