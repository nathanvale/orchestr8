---
name: vitest-wallaby-testbed
description:
  Disciplined, low-flake testing infrastructure with strict mocking policies for
  Turbo monorepo
status: in-progress
progress: 20%
prd_link: ../../prds/vitest-wallaby-testbed.md
created: 2025-09-20T03:22:42Z
updated: 2025-09-21T03:49:08Z
---

# Epic: vitest-wallaby-testbed

## Overview

Implementation of disciplined, low-flake testing infrastructure combining Vitest
(test runner) and Wallaby (fast TDD feedback) with support for Convex, Postgres,
and MySQL. Focus on strict mocking policies to prevent brittle test suites while
maintaining sub-second feedback loops.

## Implementation Status Summary

### ✅ Completed (20%)

- **Testkit package structure**: Full setup with proper exports and
  configuration
- **MSW server**: HTTP/API mocking infrastructure ready
- **File system utilities**: Complete FS mocking capabilities
- **Timer utilities (Task 007)**: Fake timers, time control, clock mocking
- **Temp directory management (Task 009)**: Automated cleanup, isolation
- **Bootstrap system (Task 014)**: Import order enforcement
- **Mock factory (Task 013)**: Single authoritative mock source

### 🚧 In Progress (10%)

- **CLI mocking**: Critical architecture issues, needs complete redesign
- **Randomness control (Task 008)**: P0 bug with restore scope
- **Runner configuration**: Partial unification between Wallaby/Vitest

### ❌ Not Started (70%)

- Postgres database strategy (Testcontainers)
- Convex test harness
- CI/CD configuration (parallelization, sharding, monitoring)
- Documentation and training materials
- Migration tooling and rollout

## Related Documentation

- [Product Requirements Document](../../prds/vitest-wallaby-testbed.md)
- [Technical PRD Guide](.docs/guides/vitest-wallaby-prd.md)
- [Technical Specification](./docs/guides/vitest-wallaby-spec.md)
- [Technical Design Document](./docs/guides/vitest-wallaby-tdd.md)

## Success Criteria

- ✅ Wallaby unit test feedback < 1 second (P95)
- ✅ Integration test suite runtime < 5 minutes
- ✅ Test flake rate < 2%
- ✅ Mock usage limited to approved scenarios (< 20% of tests)
- ✅ Code coverage > 80% with meaningful assertions

## Task Breakdown

### Phase 1: Foundation (Tasks 001-010) ✅ COMPLETE

- ✅ Setup testkit package structure
- ✅ Implement MSW server configuration
- ✅ Create database testing utilities (MySQL Testcontainers complete; Postgres
  pending in Task 003)
- ❌ Establish Convex test harness (not started)
- ✅ Configure Vitest base settings

### Phase 2: Mocking Infrastructure (Tasks 011-020) 🚧 IN PROGRESS

- ✅ Implement HTTP/API mocking with MSW
- ❌ Create database mocking strategies (not started)
- 🚧 Setup CLI command mocking (major issues - needs redesign)
- ✅ Implement file system test utilities
- ✅ Configure time and randomness control
  - ✅ **Task 007**: Timer utilities implemented and tested
  - ✅ **Task 008**: Randomness control - COMPLETE (P0/P1 fixed, crypto,
    generators, factories)
  - ✅ **Task 009**: Temp directory management implemented

#### CLI Mocking Redesign (Tasks 013-016) 🚧 IN PROGRESS

- ✅ Task 013: Implement single authoritative mock factory
- ✅ Task 014: Enforce import order with bootstrap
- ⏳ Task 015: Align CLI helper semantics (partial)
- ⏳ Task 016: Unify runner configuration (partial)

### Phase 3: Integration Layer (Tasks 021-030) ❌ NOT STARTED

- ❌ Setup Testcontainers for Postgres
- ❌ Setup Testcontainers for MySQL
- ❌ Implement Convex local backend testing
- ✅ Create tmp directory management (implemented in Task 009)
- ❌ Build integration test templates

### Phase 4: CI/CD Configuration (Tasks 031-040) ❌ NOT STARTED

- ❌ Configure worker caps and parallelization
- ❌ Implement test sharding strategy
- ❌ Setup performance monitoring
- ❌ Create flake detection system
- ❌ Configure Wallaby CI integration

### Phase 5: Documentation & Training (Tasks 041-050) ❌ NOT STARTED

- ❌ Write mocking policy documentation
- ❌ Create test template library
- ❌ Build migration guides
- ❌ Setup training materials
- ❌ Implement policy enforcement

### Phase 6: Migration Support (Tasks 051-060) ❌ NOT STARTED

- ❌ Create automated migration tools
- ❌ Package-by-package migration plan
- ❌ Performance baseline establishment
- ❌ Metrics dashboard setup
- ❌ Rollout coordination

## Critical Architecture Issues

### CLI Mocking Design Flaws (Discovered 2025-09-20)

#### Symptoms

- CLI mocking tests intermittently fail with timeouts and TypeErrors
- Undefined returns from `exec`/`execSync` operations
- Non-MockChildProcess instances from `spawn`/`fork`
- Inconsistent behavior between Wallaby and Vitest runners

#### Root Causes

1. **vi.mock Hoisting Incompatibility**
   - Vitest hoists `vi.mock` to module top, making runtime-conditional global
     installs timing-sensitive
   - Global setup that depends on checking `vi.isMockFunction()` after imports
     is unreliable
   - Guard flags can lock in "not installed" state if evaluated before mocks
     apply

2. **Module Resolution Quirks**
   - `child_process` is a Node built-in (CJS) with resolution complexities
   - Some environments require mocking `'node:child_process'` vs
     `'child_process'`
   - Mock factories must be single source of truth, declared before consumer
     imports
   - Late delegate-based installation is fundamentally brittle

3. **Configuration Divergence**
   - Wallaby uses root `vitest.config.ts` (node env, no setup files)
   - Testkit uses its own `vitest.config.ts` (happy-dom, with setupFiles)
   - Lifecycle hooks and timeouts aren't consistent between environments
   - Amplifies flakes and timeouts even when mocks are nominally installed

4. **API Mismatches**
   - `quickMocks` only registers spawn mocks
   - Tests actually use `exec`/`execSync` methods
   - Even with perfect install order, this produces undefined Buffer cases

#### Scope & Impact

- Affects all tests relying on `child_process` mocking
- Time/random/fs utilities remain stable
- MSW implemented but not exercised in testkit setup
- Fundamental incompatibility with vi.mock hoisting makes current approach
  unviable

#### Recommended Redesign

1. **Single Authoritative Mock Factory**
   - Declare `vi.mock('node:child_process', () => createMock(cpState))` in setup
     file
   - Must run before any consumer imports
   - Factory pulls behavior from central registry (ProcessMocker) at mock time
   - No runtime patching after module load

2. **Enforce Import Order**
   - Provide testkit bootstrap that hoists vi.mock and initializes registry
   - Import consumer code after bootstrap
   - Document usage patterns and provide test templates

3. **Align Helper Semantics**
   - Decide if `quickMocks` is spawn-only or tri-registers spawn/exec/execSync
   - Update either documentation or helpers for consistency
   - Ensure test expectations match actual behavior

4. **Unify Runner Configuration**
   - Make Wallaby honor package's `vitest.config.ts`
   - OR make root config load package-level setupFiles/timeouts
   - Eliminate environment-based configuration drift

## Open Questions

1. Should mocking rules be enforced via lint rules, CI reports, or both?
2. Should memfs be included by default in testkit or rely on tmp directories?
3. Should Convex local backend run in CI by default or remain opt-in?
4. How should test data factories and builders be standardized?
5. What thresholds trigger CI failure for test duration regression?

## Risk Register

| Risk                           | Impact | Mitigation                                     |
| ------------------------------ | ------ | ---------------------------------------------- |
| Wallaby compatibility issues   | High   | Early POC validation, fallback to Vitest watch |
| Container resource consumption | Medium | Resource limits, cleanup hooks                 |
| Test migration complexity      | High   | Automated tools, gradual migration             |
| Developer resistance           | Medium | Clear docs, gradual enforcement                |

## Dependencies

- Vitest framework setup
- Wallaby license procurement
- Docker infrastructure for Testcontainers
- MSW library integration
- Convex test utilities

## Known Issues & Technical Debt

### Task 008: Randomness Control Implementation Issues

**Status**: P0 FIXED (2025-09-21), P1 issues partially addressed

#### ✅ P0 Issue: Overreaching restore in quickRandom [FIXED]

**Problem**: `quickRandom.restore()` calls `vi.restoreAllMocks()`, which
restores every spy/mock in the process, not just randomness-related mocks. This
can unexpectedly clobber unrelated test scaffolding and cause cross-test flakes.

**Impact**: High - especially in larger suites or when used in shared setup
files; can break mocks outside randomness scope.

**Solution Implemented**:

- ✅ Removed `vi.restoreAllMocks()` from `quickRandom.restore()`
- ✅ Now only restores randomness-specific changes via
  `globalController.restore()`
- ✅ Made restore idempotent and localized to randomness control only

#### ✅ P1 Issues: All Resolved (2025-09-21)

1. **✅ Crypto and UUID determinism [IMPLEMENTED]**
   - ✅ Added `crypto-mock.ts` with full crypto mocking capabilities
   - ✅ Implemented `mockRandomUUID()`, `mockGetRandomValues()`, deterministic
     UUID generator
   - ✅ Created 30 comprehensive tests (29 passing)

2. **✅ Restore behavior edge case [FIXED]**
   - ✅ Modified `createRandomMocker.restore()` to be no-op when no mock
     installed
   - ✅ Prevents clobbering seeded generator from `controlRandomness()`

3. **✅ Mixed API usage confusion [DOCUMENTED]**
   - ✅ Added clear comments about not mixing APIs
   - ✅ Each API now properly isolated with its own restoration logic

4. **✅ Configurable default seed [IMPLEMENTED]**
   - ✅ Added `TEST_SEED` environment variable support
   - ✅ Logs seed for CI reproducibility
   - ✅ Falls back to timestamp with logging in test environment

#### Additional Implementations Beyond Requirements

1. **✅ Deterministic Data Generators [ADDED]**
   - ✅ `DeterministicGenerator` class with 30+ generation methods
   - ✅ Names, emails, addresses, dates, lorem ipsum, etc.
   - ✅ Credit card numbers with Luhn validation
   - ✅ Type-safe object generation with schemas

2. **✅ Test Data Factories [ADDED]**
   - ✅ Factory pattern with build/buildMany/reset methods
   - ✅ Builder pattern for complex objects
   - ✅ Trait system and associations
   - ✅ Pre-built factories for common types
   - ✅ Factory registry for management

### CLI Mocking Architecture Problem

**Status**: Critical design flaw identified - requires redesign

#### Symptoms (CLI mocking)

- CLI mocking tests intermittently fail with timeouts and TypeErrors
- `undefined` returns from `exec`/`execSync`
- Non-MockChildProcess instances from `spawn`/`fork`

#### Root Cause

Global delegate installation depends on runtime ordering that's incompatible
with `vi.mock` hoisting and differences in module resolution across
environments. Config divergence between Wallaby (using root vitest.config.ts)
and package-level configs amplifies the issue.

#### Scope

- **Affected**: Tests relying on child_process mocking
- **Stable**: Time/random/fs utilities functioning correctly
- **Implemented but unused**: MSW configured but not exercised in testkit setup

#### Contributing Factors

1. **vi.mock hoisting**: Guard flags can lock in "not installed" state if
   evaluated before vi.mock applies
2. **Module resolution**: Inconsistency between `'child_process'` vs
   `'node:child_process'` across environments
3. **API mismatch**: `quickMocks` only registers spawn mocks while tests use
   exec/execSync
4. **Config divergence**: Wallaby uses root config (no setupFiles/timeouts) vs
   testkit's config

#### Recommended Redesign (Follow-up Task)

1. **Single Authoritative Mock Factory**
   - Declare `vi.mock('node:child_process', () => createMock(cpState))` in
     guaranteed-early setup
   - Factory pulls from central registry but must be created at mock time, not
     patched later

2. **Enforce Import Order**
   - Provide testkit bootstrap that hoists vi.mock before consumer imports
   - Document usage patterns and provide test templates

3. **Align Helper Semantics**
   - Either make quickMocks tri-register (spawn/exec/execSync) or update docs to
     match spawn-only behavior
   - Ensure test expectations align with actual helper capabilities

4. **Unify Runner Config**
   - Make Wallaby honor package vitest.config.ts
   - Or make root config load package-level setupFiles/timeouts for testkit
     tests
