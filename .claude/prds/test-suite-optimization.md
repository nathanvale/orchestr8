---
name: test-suite-optimization
description: Optimize test suite with zombie process prevention, memory profiling, and consistent naming conventions
status: backlog
created: 2025-09-19T09:21:14Z
---

# PRD: test-suite-optimization

## Executive Summary

This PRD outlines a comprehensive test suite optimization initiative focused on eliminating zombie processes, implementing memory profiling, and establishing consistent test naming conventions. The primary goal is to prevent system crashes caused by node(vitest) zombie processes while improving test maintainability and developer experience.

## Problem Statement

The current test suite suffers from critical issues that impact development productivity and system stability:

- **Zombie Processes**: node(vitest) processes persist after test completion, accumulating in Activity Monitor and eventually crashing the development machine
- **Inconsistent Naming**: Mixed use of `.unit.test.ts` and `.test.ts` patterns across 71 test files creates confusion
- **Memory Issues**: No visibility into memory usage patterns or ability to detect memory leaks
- **Test Flakiness**: 23 timing-dependent tests and 20 over-mocked tests (359+ mocks) reduce reliability
- **Configuration Complexity**: 80+ npm scripts create cognitive overload and maintenance burden
- **Tool Misalignment**: Wallaby runs all test types instead of just unit tests, slowing down the feedback loop

These issues compound to create a development environment where running tests risks system stability, making developers hesitant to run the full test suite.

## User Stories

### Primary User: Solo Developer

**As a** solo developer working on this monorepo
**I want** tests to clean up after themselves completely
**So that** I can run tests repeatedly without my machine crashing from zombie processes

**Acceptance Criteria:**
- Zero node(vitest) processes remain after test completion
- Activity Monitor shows no zombie processes after test runs
- Can run tests continuously for hours without system degradation
- Emergency cleanup command available if zombies detected

### Secondary User: Future Team Members

**As a** future team member joining the project
**I want** clear, consistent test organization
**So that** I can understand and contribute to the test suite immediately

**Acceptance Criteria:**
- Single naming convention for each test type
- Wallaby provides instant feedback for unit tests only
- Less than 25 essential npm scripts
- Clear documentation of test categories

## Requirements

### Functional Requirements

#### Core Features

1. **Zombie Process Prevention**
   - Automatic process termination after test completion
   - Process tracking during test execution
   - Force kill hanging processes after configurable timeout (default: 30s)
   - Global teardown hook to catch stragglers
   - Emergency manual cleanup command

2. **Memory Profiling System**
   - Capture baseline memory usage before refactoring
   - Per-test memory tracking
   - Memory leak detection
   - Comparative reporting against baseline
   - CLI commands for profiling operations

3. **Test Naming Standardization**
   - `.test.ts` for unit tests
   - `.integration.test.ts` for integration tests
   - `.e2e.test.ts` for end-to-end tests
   - Automated migration from `.unit.test.ts` to `.test.ts`

4. **Tool Configuration Optimization**
   - Wallaby runs only `.test.ts` files
   - Vitest runs all test types
   - Process isolation between tests
   - Configurable memory limits per test type

### Non-Functional Requirements

#### Performance
- Test execution time reduced by 30%
- Memory usage capped at 2GB per test process
- Zombie process cleanup within 5 seconds of test completion
- No performance regression in test execution speed

#### Security
- No exposure of sensitive information in memory profiles
- Process cleanup doesn't interfere with other system processes
- Safe handling of SIGTERM/SIGKILL signals

#### Scalability
- Support for parallel test execution without zombie multiplication
- Memory profiling scales to 1000+ test files
- Configuration works across different CI/CD environments

#### Compatibility
- Full compatibility with Vitest test runner
- Full compatibility with Wallaby.js
- Works on macOS, Linux, and Windows
- Node.js 18+ support

## Success Criteria

### Primary Metrics
- **Zero zombie processes** after any test run (measured via Activity Monitor)
- **75% reduction** in zombie-related system crashes (from current baseline)
- **Memory baseline** established with continuous tracking
- **100% test file** compliance with new naming convention

### Secondary Metrics
- Test suite complexity reduced from 80+ to <25 npm scripts
- Test execution time improved by 30%
- Flaky test count reduced from 23 to <5
- Mock usage reduced by 50% (from 359 to <180)

### Monitoring
- Daily automated zombie process detection
- Weekly memory usage reports
- Test flakiness dashboard
- CI/CD pipeline success rate

## Constraints & Assumptions

### Constraints
- Must maintain full compatibility with existing Vitest configuration
- Must maintain full compatibility with Wallaby.js
- Cannot break existing CI/CD pipelines
- Single developer resource for implementation
- No budget for external tooling beyond existing stack

### Assumptions
- Vitest will continue to be the primary test runner
- Wallaby will remain the preferred TDD tool
- Node.js version will remain 18+
- Development primarily on macOS
- Tests can be refactored without changing functionality

## Out of Scope

The following items are explicitly NOT included in this initiative:

- Migration to different test framework (e.g., Jest, Mocha)
- Implementation of new test types beyond unit/integration/e2e
- Performance optimization of application code (only test code)
- CI/CD pipeline redesign
- Test coverage improvements (maintaining current 72%)
- Adding new testing tools or paid services
- Windows-specific optimizations
- Browser-based test runners

## Dependencies

### External Dependencies
- **Vitest**: Test runner framework (must stay on compatible version)
- **Wallaby.js**: TDD tool (requires license maintenance)
- **Node.js**: Runtime environment (18+ required)
- **TypeScript**: Type checking (current version maintained)

### Internal Dependencies
- **Quality-check package**: Core testing infrastructure
- **Turborepo**: Build system coordination
- **pnpm**: Package management and script execution
- **Existing test files**: 71 files requiring migration/update

### Technical Dependencies
- Process management APIs (process.kill, child_process)
- Memory profiling APIs (v8.getHeapSnapshot, process.memoryUsage)
- File system access for test file migration
- Git for tracking changes during migration

## Implementation Phases

### Phase 0: Memory Baseline (Critical - Before Any Changes)
- Capture current memory usage patterns
- Document zombie process frequency
- Establish metrics for comparison

### Phase 1: Zombie Process Elimination (Highest Priority)
- Implement process tracking system
- Add force-kill mechanisms to Vitest config
- Create emergency cleanup scripts
- Test and validate zero-zombie guarantee

### Phase 2: Test File Standardization
- Migrate 18 `.unit.test.ts` files to `.test.ts`
- Update configuration files
- Validate all tests still pass

### Phase 3: Configuration Simplification
- Update Wallaby to run only unit tests
- Optimize Vitest configuration
- Reduce npm scripts from 80+ to <25

### Phase 4: Memory Profiling Implementation
- Build profiling infrastructure
- Create CLI commands
- Generate comparison reports

### Phase 5: Test Quality Improvements
- Fix timing-dependent tests
- Reduce excessive mocking
- Add proper cleanup hooks

## Risk Mitigation

### High Risk: Breaking Existing Tests
- **Mitigation**: Incremental migration with validation at each step
- **Contingency**: Git-based rollback strategy

### Medium Risk: Zombie Process Prevention Failures
- **Mitigation**: Multiple cleanup mechanisms (hooks, timeouts, manual)
- **Contingency**: Emergency kill script always available

### Low Risk: Memory Profiling Overhead
- **Mitigation**: Profiling optional and off by default
- **Contingency**: Can disable profiling without affecting tests

## Validation & Testing

- Manual verification of zero zombies in Activity Monitor
- Automated zombie detection in CI/CD
- Memory leak detection tests
- Performance regression tests
- Cross-platform validation (macOS primary, Linux CI)

## Documentation Requirements

- Migration guide for test naming conventions
- Zombie prevention best practices
- Memory profiling usage guide
- Troubleshooting guide for common issues
- Configuration reference for Vitest and Wallaby

## Success Announcement

Upon completion, this initiative will deliver:
- **Zero zombie processes** plaguing the development environment
- **50% faster** test execution with better resource management
- **75% simpler** test configuration with clear conventions
- **Complete visibility** into memory usage and performance
- **Confidence** to run tests without system stability concerns

---

*This PRD represents a critical infrastructure improvement that will significantly enhance developer productivity and system stability.*