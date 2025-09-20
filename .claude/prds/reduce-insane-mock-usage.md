---
name: reduce-insane-mock-usage
description:
  Transform test architecture to eliminate 91% of mocks while preventing memory
  leaks and zombie processes
status: backlog
created: 2025-09-20T00:51:01Z
---

# PRD: Reduce Insane Mock Usage

## Executive Summary

Transform our testing architecture from a mock-heavy approach (1,963 mocks
across 66 files) to a sustainable, maintainable system following modern testing
best practices. This initiative will reduce mocks by 91% to <180 while
eliminating memory leaks, zombie processes, and test brittleness through proper
test organization and boundary management.

## Problem Statement

### Current Pain Points

**Mock Explosion Crisis**

- 1,963 mocks across 66 test files (vs. target <180)
- 91% reduction needed, far beyond the originally scoped 50%
- Mocks scattered throughout codebase violating "mock at trust boundaries"
  principle

**Systemic Testing Issues**

- Memory leaks from improper test cleanup
- Zombie processes accumulating during test runs
- Brittle tests that break on implementation changes rather than behavior
  changes
- Maintenance burden from excessive mock setup and maintenance

**Architectural Problems**

- Mocking internal modules instead of using real implementations
- No clear test tier organization (unit/integration/e2e)
- Missing boundary adapters for external dependencies
- Over-mocked unit tests that should be integration tests

### Why This Matters Now

- Current test suite crashes development machines due to zombie processes
- Mock maintenance consumes significant developer time
- Tests provide false confidence by mocking away real integration issues
- New developers struggle with complex mock setup requirements
- Test reliability issues impact CI/CD pipeline efficiency

## User Stories

### Primary Personas

**Development Team**

- As a developer, I want fast, reliable tests that don't require complex mock
  setup
- As a developer, I want tests that catch real bugs, not implementation details
- As a developer, I want my machine to remain stable during test execution

**QA/Testing Team**

- As a QA engineer, I want tests that reflect real system behavior
- As a QA engineer, I want clear test organization that matches our testing
  strategy

**DevOps/Platform Team**

- As a platform engineer, I want stable CI builds without memory leaks or
  hanging processes
- As a platform engineer, I want predictable test execution times

### Detailed User Journeys

**Developer Writing New Tests**

1. Developer identifies what to test (business logic vs. integration)
2. Developer chooses appropriate test tier (unit/integration/e2e)
3. Developer uses established patterns with minimal mock setup
4. Tests run fast and provide accurate feedback
5. No cleanup of zombie processes required

**Developer Debugging Test Failures**

1. Test failure indicates real behavior issue, not mock configuration
2. Error messages point to actual business logic problems
3. Debugging focuses on domain logic, not mock setup
4. Fix addresses real issue, improving system reliability

**CI/CD Pipeline Execution**

1. Tests execute within memory and time budgets
2. No zombie processes accumulate during parallel execution
3. Test results accurately reflect deployment readiness
4. No manual intervention required for process cleanup

## Requirements

### Functional Requirements

**Test Architecture Transformation**

- Implement 4-tier test organization (unit/integration/e2e/smoke)
- Establish boundary adapters for external dependencies
- Create shared test fixtures and builders
- Implement proper test cleanup mechanisms

**Mock Reduction Strategy**

- Reduce total mocks from 1,963 to <180 (91% reduction)
- Replace internal module mocks with real implementations
- Consolidate external service mocks to boundary adapters
- Eliminate console output and utility function mocking

**Testing Infrastructure**

- Implement MSW for HTTP mocking
- Set up in-memory databases (SQLite) for integration tests
- Create temporary file system utilities
- Establish fake time/random utilities

**Process Management**

- Implement zero-zombie guarantee for test execution
- Add automatic process cleanup mechanisms
- Create emergency cleanup scripts
- Monitor and report process health

### Non-Functional Requirements

**Performance**

- Unit tests: <5s per file
- Integration tests: <30s per file
- Full suite: <10 minutes
- Memory usage: <750MB per worker

**Reliability**

- Zero zombie processes after test completion
- <1% test flakiness rate
- 100% test cleanup success rate
- Memory leak detection and prevention

**Maintainability**

- Clear test tier guidelines and enforcement
- Automated mock usage monitoring
- Self-documenting test patterns
- Easy onboarding for new developers

**Scalability**

- Support parallel test execution
- Efficient resource utilization
- Predictable CI execution times
- Horizontal scaling capability

## Success Criteria

### Primary Metrics

**Mock Reduction**

- Reduce from 1,963 to <180 total mocks (91% reduction)
- Achieve <3 mocks per test file average
- 100% compliance with "mock at trust boundaries" principle

**Process Stability**

- Zero zombie processes after test execution
- <100MB memory growth during test runs
- 100% test cleanup success rate

**Test Quality**

- Maintain or improve test coverage (current: ~72%)
- Reduce test flakiness to <1%
- Improve test execution reliability to >99%

### Secondary Metrics

**Developer Experience**

- Reduce time to write new tests by 50%
- Reduce mock-related debugging time by 80%
- Improve developer satisfaction scores with testing workflow

**CI/CD Performance**

- Reduce test suite execution time by 30%
- Eliminate test-related CI failures
- Improve deployment confidence scores

**Code Quality**

- Increase integration test coverage
- Reduce mock-related technical debt
- Improve test readability scores

## Constraints & Assumptions

### Technical Constraints

**Compatibility Requirements**

- Must maintain Vitest and Wallaby.js compatibility
- Must preserve existing test coverage levels
- Must support current CI/CD pipeline requirements

**Resource Limitations**

- Single developer implementation capacity
- Must maintain existing feature development velocity
- Limited budget for external tooling

**Legacy System Constraints**

- Some external dependencies may require mocking
- Existing test patterns may need gradual migration
- Backward compatibility during transition period

### Assumptions

**Team Commitment**

- Development team will adopt new testing patterns
- Code review process will enforce new guidelines
- Training time allocated for new approaches

**Technical Feasibility**

- MSW and SQLite suitable for our integration testing needs
- Current codebase architecture supports boundary adapter pattern
- Existing external dependencies can be properly isolated

## Out of Scope

### Explicitly NOT Building

**Test Framework Changes**

- Not switching from Vitest to other frameworks
- Not replacing existing test runners
- Not changing core testing methodology

**External Service Testing**

- Not implementing full E2E tests with real external services
- Not creating comprehensive contract testing suite
- Not testing third-party service reliability

**Performance Testing**

- Not implementing load testing capabilities
- Not creating stress testing framework
- Not building performance regression detection

**Advanced Tooling**

- Not implementing custom test runners
- Not building sophisticated test reporting dashboards
- Not creating complex test orchestration systems

## Dependencies

### Implementation Guide Reference

This PRD implements the patterns defined in
`@docs/guides/vitest-mocking-report.md`, which provides:

- Complete test organization structure (unit/integration/e2e/smoke)
- Detailed mock avoidance patterns and promotion rules
- Test fixture patterns and shared utilities
- Vitest configuration best practices
- Concrete code examples for each test tier
- CI controls and metrics for preventing mock creep

### External Dependencies

**Testing Tools**

- MSW (Mock Service Worker) for HTTP request interception
- SQLite for in-memory database testing
- Testcontainers (optional future enhancement)

**System Requirements**

- Node.js 18+ for modern testing features
- Sufficient CI runner capacity for parallel execution
- Temporary file system access for integration tests

### Internal Dependencies

**Team Dependencies**

- Development team training on new patterns
- Code review process updates
- Documentation team for guideline creation

**Technical Dependencies**

- Existing Vitest configuration optimization
- ProcessTracker implementation completion
- Quality-check package integration

**Process Dependencies**

- Epic implementation completion for zombie prevention
- CI/CD pipeline updates for new test structure
- Monitoring setup for ongoing mock usage tracking

## Implementation Phases

**Phase 1: Foundation (4 weeks)**

- Implement test tier directory structure from
  `docs/guides/vitest-mocking-report.md`
- Create shared fixtures and utilities (builders, servers, env, fs, cleanup)
- Set up MSW server and test database utilities
- Implement Vitest configuration with proper teardown

**Phase 2: Mock Reduction (8 weeks)**

- Apply promotion rules: >2 mocks → convert to integration tests
- Eliminate console output mocking using proper test utilities
- Replace internal module mocks with real implementations
- Consolidate external service mocks to boundary adapters

**Phase 3: Architecture Transformation (6 weeks)**

- Convert over-mocked unit tests to integration tests with MSW/SQLite
- Implement boundary adapter pattern for external dependencies
- Apply "mock only at trust boundaries" principle throughout codebase
- Complete test fixture library for reusable patterns

**Phase 4: Stabilization (2 weeks)**

- Implement CI controls and mock density monitoring
- Set up flake quarantining and hanging process detection
- Complete team training on new patterns
- Establish enforcement mechanisms and metrics tracking

## Risk Assessment

### High Risks

**Test Coverage Regression**

- Mitigation: Continuous coverage monitoring during migration
- Contingency: Rollback plan for each phase

**Performance Degradation**

- Mitigation: Performance budgets and monitoring
- Contingency: Optimization strategies for slower tests

### Medium Risks

**Team Adoption Resistance**

- Mitigation: Training and clear documentation
- Contingency: Gradual rollout with early wins

**CI/CD Instability**

- Mitigation: Gradual deployment with rollback capability
- Contingency: Parallel CI pipeline during transition

### Low Risks

**Tool Compatibility Issues**

- Mitigation: Proof of concept with key tools
- Contingency: Alternative tool selection

## Next Steps

1. **Epic Creation**: Convert this PRD to implementation epic with detailed
   tasks
2. **Stakeholder Approval**: Review and approve architectural direction
3. **Resource Allocation**: Assign development team capacity
4. **Timeline Planning**: Align with existing sprint cycles
5. **Training Planning**: Prepare team education materials
