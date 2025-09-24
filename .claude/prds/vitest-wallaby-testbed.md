---
name: vitest-wallaby-testbed
description:
  Disciplined, low-flake testing infrastructure with strict mocking policies for
  Turbo monorepo
status: backlog
created: 2025-09-20T03:16:39Z
---

# PRD: vitest-wallaby-testbed

## Executive Summary

This PRD defines requirements for a disciplined, low-flake testing
infrastructure across a Turbo monorepo that combines Vitest (test runner) and
Wallaby (fast TDD feedback) with support for Convex, Postgres, and MySQL. The
core focus is establishing strict and detailed rules for mocking to prevent
brittle, over-mocked test suites while maintaining sub-second feedback loops for
TDD.

## Problem Statement

### What problem are we solving?

- **Mock Overuse**: Teams frequently overuse mocks, creating brittle test suites
  that require high maintenance and provide false confidence
- **Unclear Policies**: Without clear mocking guidelines, developers simulate
  too much, missing real integration issues
- **Slow Feedback**: Traditional test runners provide slow feedback loops that
  discourage TDD practices
- **Test Flakiness**: Inconsistent approaches to handling external dependencies
  lead to flaky tests in CI
- **Mixed Technologies**: Supporting Convex, Postgres, and MySQL requires
  different testing strategies that aren't well-defined

### Why is this important now?

- Test maintenance is consuming >30% of development time due to brittle mocks
- False positives from over-mocked tests have led to production incidents
- Developer productivity is hindered by slow test feedback loops
- CI pipeline instability is blocking deployments and reducing team velocity

## User Stories

### Primary User Personas

1. **Backend Developer (Alex)**
   - Needs fast unit test feedback while developing business logic
   - Wants confidence that tests catch real issues without excessive mocking
   - Requires clear guidelines on when to mock vs use real implementations

2. **Full-Stack Developer (Sarah)**
   - Works across frontend and backend code
   - Needs consistent testing patterns across the monorepo
   - Wants to run integration tests that validate API contracts

3. **DevOps Engineer (Mike)**
   - Maintains CI/CD pipelines
   - Needs stable, predictable test runs with minimal flake
   - Requires clear performance boundaries for different test types

### Detailed User Journeys

**Alex's TDD Workflow:**

1. Opens Wallaby in VS Code
2. Writes a failing unit test for new business logic
3. Gets sub-second feedback showing test failure
4. Implements code to make test pass
5. Refactors with confidence knowing tests run instantly

**Sarah's Integration Testing:**

1. Writes integration test for API endpoint
2. Test automatically spins up Postgres via Testcontainers
3. Makes real DB queries to validate schema and transactions
4. Cleans up resources automatically after test

### Pain Points Being Addressed

- Confusion about when to mock vs use real implementations
- Slow test feedback disrupting flow state
- Brittle mocks breaking when implementation details change
- Flaky tests requiring multiple CI retries
- Inconsistent testing approaches across teams

## Requirements

### Functional Requirements

#### Core Features and Capabilities

1. **Unified Mocking Policy**
   - Clear rules for when to mock, use fakes, or real implementations
   - Technical solutions for each scenario (HTTP, DB, CLI, FS, time, randomness)
   - Enforcement mechanisms to prevent policy violations

2. **Fast TDD Loops**
   - Sub-second unit test feedback via Wallaby
   - Automatic test discovery and execution
   - Intelligent test filtering based on code changes

3. **Database Testing Support**
   - SQLite in-memory for unit tests with ORM parity
   - Testcontainers for Postgres/MySQL integration tests
   - Convex functions tested via convex-test with a thin adapter

4. **HTTP/API Testing**
   - MSW for intercepting network calls in unit tests
   - Support for both internal and external API testing
   - Stubbing strategies for 3rd-party services

5. **CLI and File System Testing**
   - Child process stubbing for unit tests
   - Sandboxed tmp directories for integration tests
   - Real CLI execution for E2E validation

6. **Time and Randomness Control**
   - Fake timers via Vitest utilities
   - Deterministic random number generation
   - System time manipulation for date-based logic

#### User Interactions and Flows

1. **Test Execution Flow**

   ```
   Developer writes test → Wallaby detects change → Runs affected tests →
   Shows inline results → Developer fixes issues → Tests pass → Commit
   ```

2. **Mock Decision Flow**
   ```
   Identify dependency → Check trust boundary → Apply mocking policy →
   Choose technical solution → Implement test → Validate in CI
   ```

### Non-Functional Requirements

#### Performance Expectations

- **Unit Tests**: < 1 second feedback in Wallaby
- **Integration Tests**: < 5 minutes total CI runtime
- **E2E Tests**: < 10 minutes for critical path validation
- **Test Discovery**: < 500ms for file watching
- **Container Startup**: < 3 seconds for Testcontainers

#### Security Considerations

- No real credentials in test code
- Isolated test environments preventing data leaks
- Sandboxed file system operations
- Network isolation for integration tests

#### Scalability Needs

- Support for 10,000+ unit tests
- Parallel execution across 8+ CPU cores
- Sharding strategy for distributed CI
- Incremental test execution based on git diff

## Success Criteria

### Measurable Outcomes

1. **Performance Metrics**
   - Wallaby unit test feedback < 1 second (P95)
   - Integration test suite runtime < 5 minutes
   - CI pipeline completion < 15 minutes

2. **Quality Metrics**
   - Test flake rate < 2%
   - Mock usage limited to approved scenarios (< 20% of tests)
   - Code coverage > 80% with meaningful assertions

3. **Developer Productivity**
   - 50% reduction in test maintenance time
   - 80% of developers adopting TDD with Wallaby
   - 90% reduction in "works on my machine" issues

### Key Metrics and KPIs

- **Test Execution Time**: Track P50, P95, P99 for each test tier
- **Flake Rate**: Percentage of tests requiring retry
- **Mock Density**: Average mocks per test file
- **TDD Adoption**: Percentage of commits with test-first approach
- **CI Stability**: Success rate of first CI run attempt

## Constraints & Assumptions

### Technical Limitations

- Vitest and Wallaby compatibility requirements
- Node.js version constraints (>= 18.x)
- Memory limitations for parallel test execution
- Docker requirement for Testcontainers

### Timeline Constraints

- Implementation must be completed within Q1 2025
- Migration from existing test infrastructure phased over 3 months
- Training and documentation required before full rollout

### Resource Limitations

- 2 senior engineers for initial implementation
- 20% time allocation from platform team
- Budget for Wallaby licenses for all developers

### Assumptions

- Teams willing to adopt new mocking policies
- Existing tests can be gradually migrated
- CI infrastructure can support Docker containers
- Developers have local Docker installations

## Out of Scope

- Frontend testing framework selection (RTL vs Enzyme)
- Full CI/CD pipeline configuration beyond test execution
- Performance testing and load testing infrastructure
- Security testing and penetration testing tools
- Mobile application testing
- Cross-browser testing infrastructure
- Visual regression testing tools
- Mutation testing frameworks

## Documentation References

### Existing Documentation

The following documentation has been created to support this initiative and
should be referenced during implementation:

- **[Product Requirements Document](../../docs/guides/vitest-wallaby-prd.md)**:
  Detailed PRD with mocking policies and success criteria
- **[Technical Specification](../../docs/guides/vitest-wallaby-spec.md)**:
  Comprehensive technical spec with monorepo layout and configuration details
- **[Technical Design Document](../../docs/guides/vitest-wallaby-tdd.md)**:
  Architecture and implementation design with deliverables

These documents contain the detailed technical requirements, mocking policies,
and implementation guidelines that supplement this PRD.

## Dependencies

### External Dependencies

- **Vitest**: Test runner framework
- **Wallaby**: Real-time test execution engine
- **MSW**: API mocking library
- **Testcontainers**: Container-based integration testing
- **Convex**: Backend platform with test utilities
- **Docker**: Container runtime for Testcontainers

### Internal Team Dependencies

- **Platform Team**: Infrastructure setup and CI configuration
- **Developer Experience**: Tool integration and documentation
- **Architecture Team**: Mocking policy approval and governance
- **Security Team**: Credential management and isolation review

## Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

```text
Implement MSW server configuration
Create Testcontainers helpers for Postgres/MySQL
Establish Convex test harness (convex-test + adapter)
```

### Phase 2: Policy Implementation (Weeks 5-8)

- Document detailed mocking policies
- Create test templates for each scenario
- Implement lint rules for policy enforcement
- Set up CI pipeline with worker caps

### Phase 3: Migration Support (Weeks 9-12)

- Create migration guides from current test setup
- Provide training sessions on new approach
- Support gradual test migration
- Monitor metrics and adjust policies

## Risk Mitigation

### Technical Risks

1. **Wallaby Compatibility Issues**
   - Mitigation: Early proof-of-concept validation
   - Fallback: Vitest watch mode as alternative

2. **Container Resource Consumption**
   - Mitigation: Resource limits and cleanup hooks
   - Fallback: Shared database instances for CI

3. **Test Migration Complexity**
   - Mitigation: Automated migration tools where possible
   - Fallback: Gradual package-by-package migration

4. **Convex-test library maintenance**
   - Mitigation: Keep adapter thin, pin versions, add smoke tests, and use only
     documented APIs; be ready to fork if necessary

### Organizational Risks

1. **Developer Resistance to Mocking Policies**
   - Mitigation: Clear documentation and training
   - Fallback: Gradual enforcement with warnings first

2. **License Cost Concerns**
   - Mitigation: ROI analysis showing productivity gains
   - Fallback: Open-source alternatives evaluation

## Open Questions

1. **Enforcement Strategy**: Should mocking rules be enforced via lint rules, CI
   reports, or both?
2. **Memory File System**: Should memfs be included by default in testkit or
   rely on tmp directories?
3. **Convex Integration**: Should Convex local backend run in CI by default or
   remain opt-in?
4. **Test Data Management**: How should test data factories and builders be
   standardized?
5. **Performance Regression**: What thresholds trigger CI failure for test
   duration regression?

## Appendix

### Test Pyramid Distribution

```text
E2E Tests (5-10%)
├── Critical user journeys
├── Payment flows
└── Authentication flows

Integration Tests (15-25%)
├── API contract validation
├── Database operations
├── External service integration
└── CLI command validation

Unit Tests (70-80%)
├── Business logic
├── Data transformations
├── Utility functions
└── Component logic
```

### Mocking Decision Matrix

| Scenario    | Unit Test          | Integration Test   | E2E Test     |
| ----------- | ------------------ | ------------------ | ------------ |
| HTTP/API    | MSW                | Real/MSW           | Stub 3P only |
| Database    | SQLite/convex-test | Testcontainers     | Real         |
| CLI         | Stub child_process | Real in sandbox    | Real         |
| File System | memfs/stub         | tmp dirs           | Real         |
| Time        | Fake timers        | Fake timers        | Real         |
| Random      | Stub Math.random   | Deterministic seed | Real         |

### Sample Configuration

```typescript
// Example vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['@workspace/testkit/register'],
    environment: 'node',
    pool: 'forks',
    isolate: true,
    bail: 1,
    teardownTimeout: 20_000,
    env: { NODE_ENV: 'test' },
  },
})
```
