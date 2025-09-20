---
title: Reduce Insane Mock Usage
description:
  Transform test architecture to eliminate 91% of mocks while preventing memory
  leaks and zombie processes
status: planned
prd: reduce-insane-mock-usage
created: 2025-09-20T01:04:56Z
updated: 2025-09-20T01:37:50Z
priority: high
estimated_effort: xlarge
labels:
  - testing
  - architecture
  - performance
  - developer-experience
  - stability
---

# Epic: Reduce Insane Mock Usage

## Overview

Transform our testing architecture from a mock-heavy approach (1,963 mocks
across 66 files) to a sustainable, maintainable system following modern testing
best practices. This initiative will reduce mocks by 91% to <180 while
eliminating memory leaks, zombie processes, and test brittleness through proper
test organization and boundary management.

### Current Crisis

- **Mock Explosion**: 1,963 mocks across 66 test files (vs. target <180)
- **System Instability**: Memory leaks and zombie processes crashing development
  machines
- **Maintenance Burden**: Excessive mock setup consuming developer time
- **False Confidence**: Tests mocking away real integration issues

## Goals

### Primary Objectives

- **Reduce mocks by 91%**: From 1,963 to <180 total mocks
- **Zero zombie processes**: Eliminate process accumulation during test runs
- **Stable test architecture**: Implement 4-tier organization
  (unit/integration/e2e/smoke)
- **"Mock at trust boundaries"**: Apply modern testing principles throughout
  codebase

### Success Metrics

- <3 mocks per test file average
- 100% compliance with "mock at trust boundaries" principle
- Zero zombie processes after test execution
- <100MB memory growth during test runs
- Maintain or improve test coverage (current: ~72%)
- <1% test flakiness rate

## Technical Approach

### Implementation Guide Reference

This epic implements patterns from `@docs/guides/vitest-mocking-report.md`:

- Test tier organization (unit/integration/e2e/smoke)
- Mock avoidance patterns and promotion rules
- Test fixture patterns and shared utilities
- Vitest configuration best practices
- CI controls and metrics for preventing mock creep

### Architecture Transformation Strategy

1. **Legacy Test Migration**: Safely preserve existing tests in legacy folders
   across monorepo and packages before restructuring
2. **Test Tier Organization**: Establish clear boundaries for unit vs
   integration vs e2e tests in both root and individual packages
3. **Boundary Adapters**: Isolate external dependencies behind interfaces
4. **Real Implementations**: Use MSW for HTTP, SQLite for databases, temp
   directories for file system
5. **Shared Fixtures**: Create reusable builders, servers, and cleanup utilities
6. **Process Management**: Implement zero-zombie guarantee with automatic
   cleanup

### Mock Reduction Strategy

- **Promotion Rules**: Tests with >2 mocks become integration tests
- **Console Elimination**: Replace console mocking with proper test utilities
- **Internal Module Real Usage**: Stop mocking own domain code
- **Boundary Consolidation**: Move external service mocks to adapters

## Implementation Tasks

### Phase 0: Legacy Test Migration (1 week)

- [ ] 000: Audit existing test locations across monorepo and packages - Small
- [ ] 000.1: Create test-legacy folders in root and all packages with existing
      tests - Small
- [ ] 000.2: Move existing test files to test-legacy folders for safe
      preservation - Medium

### Phase 1: Foundation (4 weeks)

- [ ] 001: Create test tier directory structure (tests/unit, integration, e2e,
      smoke) in root and all packages - Medium
- [ ] 002: Set up shared fixtures directory structure (builders, servers, env,
      fs, cleanup) - Medium
- [ ] 003: Implement MSW server setup and configuration - Medium
- [ ] 004: Create test database utilities (SQLite in-memory) - Medium
- [ ] 005: Set up temporary file system utilities - Small
- [ ] 006: Implement fake time/random utilities - Small
- [ ] 007: Update Vitest configuration with proper teardown - Medium
- [ ] 008: Create global test cleanup mechanisms - Medium
- [ ] 009: Establish test builder patterns for common entities - Medium
- [ ] 010: Document new test organization guidelines - Small

### Phase 2: Mock Reduction (8 weeks)

- [ ] 011: Audit current mock usage and categorize by type - Large
- [ ] 012: Eliminate console output mocking (target: -150 mocks) - Large
- [ ] 013: Remove utility function mocking (path, string utils) - Medium
- [ ] 014: Consolidate repetitive mock patterns into factories - Large
- [ ] 015: Apply promotion rules: identify >2 mock tests for conversion - Large
- [ ] 016: Replace internal module mocks with real implementations - XLarge
- [ ] 017: Convert over-mocked unit tests to integration tests - XLarge
- [ ] 018: Consolidate external service mocks to boundary adapters - Large
- [ ] 019: Implement mock usage monitoring and reporting - Medium
- [ ] 020: Create automated mock count tracking in CI - Small

### Phase 3: Architecture Transformation (6 weeks)

- [ ] 021: Implement boundary adapter pattern for external dependencies - Large
- [ ] 022: Convert file system mocking to temp directory usage - Large
- [ ] 023: Replace database mocking with SQLite integration tests - Large
- [ ] 024: Implement HTTP mocking with MSW handlers - Large
- [ ] 025: Create integration test patterns for service → repo → DB flows -
      Large
- [ ] 026: Establish adapter fakes for external services (email, S3, etc.) -
      Large
- [ ] 027: Apply "mock only at trust boundaries" throughout codebase - XLarge
- [ ] 028: Complete test fixture library for reusable patterns - Medium
- [ ] 029: Validate promotion rule compliance across all tests - Medium
- [ ] 030: Update existing tests to follow new patterns - Large

### Phase 4: Stabilization (2 weeks)

- [ ] 031: Implement CI controls with mock density monitoring - Medium
- [ ] 032: Set up flake quarantining with hanging process detection - Medium
- [ ] 033: Create mock usage enforcement rules in code review - Small
- [ ] 034: Complete team training materials and sessions - Medium
- [ ] 035: Establish metrics tracking for mock creep prevention - Medium
- [ ] 036: Create troubleshooting guide for new test patterns - Small
- [ ] 037: Implement automated promotion rule enforcement - Medium
- [ ] 038: Final validation of success criteria achievement - Small
- [ ] 039: Document lessons learned and best practices - Small
- [ ] 040: Set up ongoing monitoring and alerting - Small

## Dependencies

### External Dependencies

- **MSW (Mock Service Worker)**: HTTP request interception
- **SQLite**: In-memory database testing
- **Node.js 18+**: Modern testing features
- **CI runner capacity**: Parallel execution support

### Internal Dependencies

- **ProcessTracker completion**: From test-suite-optimization epic
- **Quality-check integration**: Core infrastructure
- **Team training**: New pattern adoption
- **Code review updates**: Enforcement mechanisms

### Blockers

- Current zombie process issues must be stabilized before major test refactoring
- Team must commit to new testing patterns and training time
- CI/CD pipeline capacity for increased integration test execution

## Risks & Mitigations

### High Risks

**Test Coverage Regression**

- _Risk_: Removing mocks might reduce coverage metrics
- _Mitigation_: Continuous coverage monitoring during migration
- _Contingency_: Rollback plan for each phase with coverage gates

**Performance Degradation**

- _Risk_: Integration tests slower than mocked unit tests
- _Mitigation_: Performance budgets and monitoring per test tier
- _Contingency_: Optimization strategies and parallel execution

### Medium Risks

**Team Adoption Resistance**

- _Risk_: Developers resist new patterns and training requirements
- _Mitigation_: Clear documentation, training sessions, early wins demonstration
- _Contingency_: Gradual rollout with voluntary adoption first

**CI/CD Instability**

- _Risk_: Test changes break CI pipeline or increase execution time
- _Mitigation_: Gradual deployment with rollback capability
- _Contingency_: Parallel CI pipeline during transition period

### Low Risks

**Tool Compatibility Issues**

- _Risk_: MSW or SQLite incompatible with existing stack
- _Mitigation_: Proof of concept validation before full implementation
- _Contingency_: Alternative tool selection (Testcontainers, nock, etc.)

## Success Criteria

### Must-Have Outcomes

- [x] Reduce total mocks from 1,963 to <180 (91% reduction)
- [x] Zero zombie processes after test execution
- [x] 100% compliance with "mock at trust boundaries" principle
- [x] Maintain current test coverage levels (~72%)
- [x] <1% test flakiness rate

### Should-Have Outcomes

- [x] <3 mocks per test file average
- [x] 50% reduction in time to write new tests
- [x] 80% reduction in mock-related debugging time
- [x] 30% reduction in test suite execution time
- [x] > 99% test execution reliability

### Could-Have Outcomes

- [x] Improved developer satisfaction with testing workflow
- [x] Increased integration test coverage
- [x] Reduced mock-related technical debt
- [x] Better test readability and maintainability

## Monitoring & Validation

### Automated Metrics

- Mock count per file and total across codebase
- Test execution time per tier (unit/integration/e2e/smoke)
- Memory usage during test runs
- Process cleanup success rate
- Test flakiness percentage

### Manual Validation

- Code review compliance with new patterns
- Developer feedback on testing experience
- Integration test behavior vs mocked test behavior
- CI/CD pipeline stability and execution time

## Timeline

- **Week 1**: Legacy Test Migration (preserve existing tests safely)
- **Week 2-5**: Foundation (test structure, fixtures, MSW setup)
- **Week 6-13**: Mock Reduction (eliminate unnecessary mocks, apply promotion
  rules)
- **Week 14-19**: Architecture Transformation (boundary adapters, integration
  patterns)
- **Week 20-21**: Stabilization (CI controls, training, monitoring)

**Total Duration**: 21 weeks **Critical Path**: Legacy migration → Foundation →
Mock reduction → Architecture transformation → Stabilization **Parallel
Workstreams**: Foundation can overlap with early mock reduction work

## Tasks Created

### Phase 0: Legacy Test Migration (Tasks 000-000.2)

- [ ] 000.md - Audit existing test locations across monorepo and packages
      (parallel: true)
- [ ] 000.1.md - Create test-legacy folders in root and all packages with
      existing tests (parallel: true)
- [ ] 000.2.md - Move existing test files to test-legacy folders for safe
      preservation (parallel: false)

### Phase 1: Foundation (Tasks 001-010)

- [ ] 001.md - Create test tier directory structure in root and all packages
      (parallel: true)
- [ ] 002.md - Set up shared fixtures directory structure (parallel: true)
- [ ] 003.md - Implement MSW server setup and configuration (parallel: true)
- [ ] 004.md - Create test database utilities (SQLite in-memory) (parallel:
      true)
- [ ] 005.md - Set up temporary file system utilities (parallel: true)
- [ ] 006.md - Implement fake time/random utilities (parallel: true)
- [ ] 007.md - Update Vitest configuration with proper teardown (parallel:
      false)
- [ ] 008.md - Create global test cleanup mechanisms (parallel: false)
- [ ] 009.md - Establish test builder patterns for common entities (parallel:
      true)
- [ ] 010.md - Document new test organization guidelines (parallel: true)

### Phase 2: Mock Reduction (Tasks 011-020)

- [ ] 011.md - Audit current mock usage and categorize by type (parallel: true)
- [ ] 012.md - Eliminate console output mocking (target: -150 mocks) (parallel:
      true)
- [ ] 013.md - Remove utility function mocking (path, string utils) (parallel:
      true)
- [ ] 014.md - Consolidate repetitive mock patterns into factories (parallel:
      true)
- [ ] 015.md - Apply promotion rules: identify >2 mock tests for conversion
      (parallel: true)
- [ ] 016.md - Replace internal module mocks with real implementations
      (parallel: false)
- [ ] 017.md - Convert over-mocked unit tests to integration tests (parallel:
      false)
- [ ] 018.md - Consolidate external service mocks to boundary adapters
      (parallel: true)
- [ ] 019.md - Implement mock usage monitoring and reporting (parallel: true)
- [ ] 020.md - Create automated mock count tracking in CI (parallel: true)

### Phase 3: Architecture Transformation (Tasks 021-030)

- [ ] 021.md - Implement boundary adapter pattern for external dependencies
      (parallel: true)
- [ ] 022.md - Convert file system mocking to temp directory usage (parallel:
      true)
- [ ] 023.md - Replace database mocking with SQLite integration tests (parallel:
      true)
- [ ] 024.md - Implement HTTP mocking with MSW handlers (parallel: true)
- [ ] 025.md - Create integration test patterns for service → repo → DB flows
      (parallel: true)
- [ ] 026.md - Establish adapter fakes for external services (email, S3, etc.)
      (parallel: true)
- [ ] 027.md - Apply "mock only at trust boundaries" throughout codebase
      (parallel: false)
- [ ] 028.md - Complete test fixture library for reusable patterns (parallel:
      true)
- [ ] 029.md - Validate promotion rule compliance across all tests (parallel:
      true)
- [ ] 030.md - Update existing tests to follow new patterns (parallel: false)

### Phase 4: Stabilization (Tasks 031-040)

- [ ] 031.md - Implement CI controls with mock density monitoring (parallel:
      true)
- [ ] 032.md - Set up flake quarantining with hanging process detection
      (parallel: true)
- [ ] 033.md - Create mock usage enforcement rules in code review (parallel:
      true)
- [ ] 034.md - Complete team training materials and sessions (parallel: true)
- [ ] 035.md - Establish metrics tracking for mock creep prevention (parallel:
      true)
- [ ] 036.md - Create troubleshooting guide for new test patterns (parallel:
      true)
- [ ] 037.md - Implement automated promotion rule enforcement (parallel: true)
- [ ] 038.md - Final validation of success criteria achievement (parallel:
      false)
- [ ] 039.md - Document lessons learned and best practices (parallel: true)
- [ ] 040.md - Set up ongoing monitoring and alerting (parallel: true)

**Total tasks**: 43 **Parallel tasks**: 32 **Sequential tasks**: 11 **Estimated
total effort**: 107 days (21.4 weeks)
