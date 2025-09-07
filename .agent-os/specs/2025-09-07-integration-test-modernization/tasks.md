# Spec Tasks

## Integration Test Modernization

Date: 2025-09-07 Status: Active

### Overview

Systematically rewrite 18 failing integration tests (60% failure rate) from
brittle process-spawning patterns to modern Vitest-based direct API testing.
Focus on Engine Configuration Tests first for maximum impact.

## Tasks

- [x] 1. Test Infrastructure Analysis & Discovery
  - [x] 1.1 Discover and catalog all failing integration tests using Glob/Grep
        tools
  - [x] 1.2 Analyze current QualityChecker API structure and available methods
  - [x] 1.3 Document brittle patterns (process spawning, file operations, timing
        dependencies)
  - [x] 1.4 Identify reusable components and patterns for modernization
  - [x] 1.5 Create baseline metrics (current failure rate, execution times,
        setup complexity)

- [x] 2. Modern Architecture Design & Setup
  - [x] 2.1 Write tests for new fixture factory patterns using Vitest
  - [x] 2.2 Create reusable test utilities with in-memory mocking (vi.mock())
  - [x] 2.3 Design direct API call wrappers replacing CLI/binary execution
  - [x] 2.4 Implement standardized assertion helpers for engine results
  - [x] 2.5 Verify architecture supports <100ms execution target per test
  - [x] 2.6 Validate fixtures integrate with existing Vitest configuration

- [x] 3. Engine Configuration Tests Rewrite (Priority: 8 tests)
  - [x] 3.1 Write modern test patterns for ESLint flat config tests (2 tests)
  - [x] 3.2 Replace child_process.spawn() with direct QualityChecker API calls
  - [x] 3.3 Implement in-memory mocking for auto-fix behavior tests (3 tests)
  - [x] 3.4 Rewrite exit code logic tests using deterministic patterns (3 tests)
  - [x] 3.5 Apply consistent describe/test naming and assertion patterns
  - [x] 3.6 Validate each test executes under 100ms individually
  - [x] 3.7 Run full Engine Configuration suite to ensure 0% failure rate
  - [x] 3.8 Verify 100% code coverage maintained for rewritten tests

- [ ] 4. Quality Validation & Performance Verification
  - [ ] 4.1 Run complete test suite to ensure zero regressions in existing tests
  - [ ] 4.2 Benchmark execution speed improvements (target: 5x faster than
        baseline)
  - [ ] 4.3 Count and verify setup patterns reduced to <20 per file (from 97.5)
  - [ ] 4.4 Generate coverage report confirming 100% parity maintained
  - [ ] 4.5 Document success metrics, performance improvements, and
        implementation patterns
  - [ ] 4.6 Create modernization guide for remaining Integration &
        Infrastructure tests

## Success Criteria

- 0% failure rate on Engine Configuration Tests (8 tests)
- <100ms execution time per test (5x speed improvement)
- <20 setup patterns per file (reduced from 97.5)
- 100% code coverage maintained
- Zero external dependencies (no temp directories, no process spawning)
- Direct QualityChecker API usage replaces all CLI execution

## Technical Requirements

- Use existing Vitest configuration and testing utilities
- Maintain compatibility with CI/CD pipeline
- Leverage direct QualityChecker API instead of CLI/binary execution
- Implement deterministic test patterns (eliminate timing dependencies)
- Create maintainable, single-responsibility test structure
- Follow modern Vitest best practices (vi.mock(), fixture factories)

## Implementation Notes

- Start with Engine Configuration Tests for highest impact (8 tests, most
  critical failures)
- One-test-at-a-time approach with individual validation before proceeding
- Maintain parallel validation capability (old vs new tests) during transition
- Architecture designed to support future rewrite of remaining 10 tests
- Built-in rollback capability if quality gates not met
