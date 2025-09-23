---
task: 009a
name: Document CLI command mocking utilities
status: closed
created: 2025-09-23T16:20:00Z
updated: 2025-09-23T19:55:00Z
depends_on: [009]
---

# Task 009a: Document CLI command mocking utilities

## Status: ✅ COMPLETED

## Goal

Produce clear, actionable documentation for the CLI command mocking utilities
implemented in Task 009, including API references, setup/bootstrapping patterns
with import-order guidance, cookbook examples, troubleshooting, and anti-flake
practices. Ensure alignment with testkit’s documentation style.

## Deliverables

- README at `packages/testkit/src/cli/README.md`
- API JSDoc across `packages/testkit/src/cli/*.ts` kept up to date
- 6+ runnable examples under `packages/testkit/examples/cli/`
- Troubleshooting section (order, matching, leaks, timing)
- Anti-flake guidance (deterministic matching, explicit assertions, isolation)
- Import-order bootstrap pattern documented
- Cross-links from root `README.md` and relevant `docs/guides/*`

## Acceptance Criteria

- [x] Create CLI mocking README at `packages/testkit/src/cli/README.md`
- [x] Document public APIs with examples: - Factory/registry: `mock-factory`,
      `registry` - Process API: `mockProcess`, `mockCommand`, `verifyCommand`,
      `getProcessCalls` - Spawn helpers and normalization
- [x] Include import-order and bootstrap guidance (hoist `vi.mock` before
      imports) with a minimal `bootstrap.ts` example
- [x] Provide a cookbook with at least 6 scenarios: - Mocking `git`
      success/failure - ENOENT (unknown command) behavior - Arg pattern matching
      (exact and partial) - Simulating stdout/stderr and exit codes - Using
      promisified APIs - Cleanup between tests and registry reset
- [x] Add troubleshooting for common issues (order problems, partial matches,
      test leaks, timing/race conditions)
- [x] Anti-flake section covering deterministic matching, explicit verification
      (`verifyCommand`), and import isolation per test file
- [x] Cross-link from root `README.md` and relevant guides in `docs/guides/*`

## Scope and Locations

Core modules to cover and link:

- `packages/testkit/src/cli/mock-factory.ts` — Authoritative mock factory
- `packages/testkit/src/cli/process-mock.ts` — Process mocking API surface
- `packages/testkit/src/cli/registry.ts` — Centralized mock registry
- `packages/testkit/src/cli/spawn.ts` — Spawn utilities
- `packages/testkit/src/cli/normalize.ts` — Command normalization helpers
- `packages/testkit/src/bootstrap.ts` — Import order enforcement example

Examples directory: `packages/testkit/examples/cli/`

## Mock Factory Pattern (reference)

```ts
vi.mock('node:child_process', () => mockChildProcessModule)
vi.mock('child_process', () => mockChildProcessModule)
```

## Cookbook Scenarios (to include)

1. Basic command success with stdout capture
2. Command failure with non-zero exit code and stderr
3. ENOENT when an unknown command is executed
4. Argument pattern matching (exact/partial) and precedence rules
5. Promisified API usage (exec/execFile) and awaited results
6. Verifying calls with `verifyCommand` and examining `getProcessCalls`
7. Reset/cleanup between tests to avoid cross-test leakage

## Troubleshooting Matrix (high-level)

- Import order errors → ensure bootstrap hoists `vi.mock` before target imports
- Partial matches behaving unexpectedly → confirm normalization and patterns
- Leaks between tests → verify registry reset in setup and afterEach
- Flaky timing around spawned processes → prefer deterministic mocks and
  explicit verification

## Verification

- README present and linked from root/guides
- Cookbook examples are runnable and referenced from README
- JSDoc updated for all public APIs
- Import-order guidance validated by a minimal smoke test
