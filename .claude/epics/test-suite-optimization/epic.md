---
title: Test Suite Optimization
description:
  Optimize test suite with zombie process prevention, memory profiling, and
  consistent naming conventions
status: planning
prd: test-suite-optimization
created: 2025-09-19T09:21:14Z
priority: high
estimated_effort: large
labels:
  - infrastructure
  - performance
  - developer-experience
  - stability
---

# Epic: Test Suite Optimization

## Overview

This epic implements a comprehensive test suite optimization focused on
eliminating zombie processes, implementing memory profiling, and establishing
consistent test naming conventions. The primary goal is to prevent system
crashes caused by node(vitest) zombie processes while improving test
maintainability.

## Context

The test suite currently has critical stability issues with node(vitest) zombie
processes accumulating and crashing the development machine. Additionally,
inconsistent naming conventions across 71 test files and 80+ npm scripts create
maintenance burden and confusion.

## Goals

### Primary Goals

- **Eliminate all zombie processes** - Zero node(vitest) processes after test
  completion
- **Establish memory baseline** - Capture current state before refactoring
- **Standardize test naming** - Consistent .test, .integration.test, .e2e.test
  patterns
- **Optimize tool configuration** - Wallaby for unit tests only, Vitest for all

### Secondary Goals

- Reduce npm scripts from 80+ to <25
- Fix 23 timing-dependent tests
- Reduce mock usage by 50% (from 359 to <180)
- Improve test execution speed by 30%

## Success Criteria

- [ ] Zero zombie processes verified in Activity Monitor after test runs
- [ ] Memory baseline captured and documented
- [ ] All 18 .unit.test.ts files renamed to .test.ts
- [ ] Wallaby configured to run only .test.ts files
- [ ] Emergency cleanup command available
- [ ] Test suite runs continuously for 1+ hours without crashes
- [ ] Memory profiling CLI commands functional

## Technical Approach

### Zombie Process Prevention Strategy

1. Implement process tracking during test execution
2. Add force-kill mechanisms in Vitest configuration
3. Create global teardown hooks
4. Implement timeout-based termination (30s default)
5. Provide emergency cleanup scripts

### Memory Profiling Architecture

1. Capture baseline using v8.getHeapSnapshot
2. Track per-test memory with process.memoryUsage
3. Compare runs against baseline
4. Generate reports showing leaks and high-usage tests

### Test Organization Migration

1. Batch rename .unit.test.ts to .test.ts
2. Update Wallaby and Vitest configurations
3. Validate all tests pass after migration
4. Update gitignore patterns if needed

## Implementation Tasks

### Phase 0: Memory Baseline [CRITICAL - Do First]

- [ ] 001: Capture current memory usage baseline
- [ ] 002: Document zombie process frequency
- [ ] 003: Record current test execution metrics

### Phase 1: Zombie Process Elimination [Highest Priority]

- [ ] 004: Create zombie process tracking system
- [ ] 005: Implement Vitest force-kill configuration
- [ ] 006: Add global teardown hooks
- [ ] 007: Create emergency cleanup script
- [ ] 008: Test zero-zombie guarantee

### Phase 2: Test File Standardization

- [ ] 009: Rename 18 .unit.test.ts files to .test.ts
- [ ] 010: Update import statements if needed
- [ ] 011: Validate all tests still pass

### Phase 3: Configuration Optimization

- [ ] 012: Configure Wallaby for .test.ts only
- [ ] 013: Optimize Vitest configuration
- [ ] 014: Simplify package.json scripts

### Phase 4: Memory Profiling System

- [ ] 015: Implement baseline capture mechanism
- [ ] 016: Add per-test memory tracking
- [ ] 017: Create comparison reporting
- [ ] 018: Add CLI commands for profiling

### Phase 5: Test Quality Improvements

- [ ] 019: Fix timing-dependent tests
- [ ] 020: Reduce excessive mocking
- [ ] 021: Add cleanup guards to integration tests

## Dependencies

- Vitest (must maintain compatibility)
- Wallaby.js (must maintain compatibility)
- Node.js 18+ (process management APIs)
- Quality-check package (core infrastructure)

## Risks & Mitigations

### High Risk: Breaking Existing Tests

**Mitigation**: Incremental changes with validation at each step
**Contingency**: Git-based rollback strategy

### Medium Risk: Zombie Prevention Failures

**Mitigation**: Multiple cleanup mechanisms (hooks, timeouts, manual)
**Contingency**: Emergency kill script always available

### Low Risk: Memory Profiling Overhead

**Mitigation**: Profiling optional and off by default **Contingency**: Can
disable without affecting tests

## Monitoring & Validation

- Manual Activity Monitor checks for zombies
- Automated zombie detection in CI/CD
- Memory usage reports per test run
- Test execution time tracking
- Flakiness rate monitoring

## Documentation

- [ ] Migration guide for naming conventions
- [ ] Zombie prevention best practices
- [ ] Memory profiling usage guide
- [ ] Troubleshooting common issues
- [ ] Configuration reference

## Timeline Estimate

Given single developer and no time constraints:

- Phase 0: 1 day (baseline capture)
- Phase 1: 3-4 days (zombie elimination)
- Phase 2: 1 day (file renaming)
- Phase 3: 1-2 days (configuration)
- Phase 4: 2-3 days (memory profiling)
- Phase 5: 3-4 days (quality improvements)

**Total: 11-16 days of focused work**

## Notes

- Zombie process prevention is the absolute highest priority
- Memory baseline must be captured before any other changes
- Single developer working, no parallelization possible
- Must maintain Vitest and Wallaby compatibility throughout
