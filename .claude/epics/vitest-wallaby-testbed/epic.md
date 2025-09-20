---
name: vitest-wallaby-testbed
description: Disciplined, low-flake testing infrastructure with strict mocking policies for Turbo monorepo
status: active
prd_link: ../../prds/vitest-wallaby-testbed.md
created: 2025-09-20T03:22:42Z
updated: 2025-09-20T03:22:42Z
---

# Epic: vitest-wallaby-testbed

## Overview

Implementation of disciplined, low-flake testing infrastructure combining Vitest (test runner) and Wallaby (fast TDD feedback) with support for Convex, Postgres, and MySQL. Focus on strict mocking policies to prevent brittle test suites while maintaining sub-second feedback loops.

## Related Documentation

- [Product Requirements Document](../../prds/vitest-wallaby-testbed.md)
- [Technical PRD Guide](../../../../docs/guides/vitest-wallaby-prd.md)
- [Technical Specification](../../../../docs/guides/vitest-wallaby-spec.md)
- [Technical Design Document](../../../../docs/guides/vitest-wallaby-tdd.md)

## Success Criteria

- ✅ Wallaby unit test feedback < 1 second (P95)
- ✅ Integration test suite runtime < 5 minutes
- ✅ Test flake rate < 2%
- ✅ Mock usage limited to approved scenarios (< 20% of tests)
- ✅ Code coverage > 80% with meaningful assertions

## Task Breakdown

### Phase 1: Foundation (Tasks 001-010)
- Setup testkit package structure
- Implement MSW server configuration
- Create database testing utilities
- Establish Convex test harness
- Configure Vitest base settings

### Phase 2: Mocking Infrastructure (Tasks 011-020)
- Implement HTTP/API mocking with MSW
- Create database mocking strategies
- Setup CLI command mocking
- Implement file system test utilities
- Configure time and randomness control

### Phase 3: Integration Layer (Tasks 021-030)
- Setup Testcontainers for Postgres
- Setup Testcontainers for MySQL
- Implement Convex local backend testing
- Create tmp directory management
- Build integration test templates

### Phase 4: CI/CD Configuration (Tasks 031-040)
- Configure worker caps and parallelization
- Implement test sharding strategy
- Setup performance monitoring
- Create flake detection system
- Configure Wallaby CI integration

### Phase 5: Documentation & Training (Tasks 041-050)
- Write mocking policy documentation
- Create test template library
- Build migration guides
- Setup training materials
- Implement policy enforcement

### Phase 6: Migration Support (Tasks 051-060)
- Create automated migration tools
- Package-by-package migration plan
- Performance baseline establishment
- Metrics dashboard setup
- Rollout coordination

## Open Questions

1. Should mocking rules be enforced via lint rules, CI reports, or both?
2. Should memfs be included by default in testkit or rely on tmp directories?
3. Should Convex local backend run in CI by default or remain opt-in?
4. How should test data factories and builders be standardized?
5. What thresholds trigger CI failure for test duration regression?

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Wallaby compatibility issues | High | Early POC validation, fallback to Vitest watch |
| Container resource consumption | Medium | Resource limits, cleanup hooks |
| Test migration complexity | High | Automated tools, gradual migration |
| Developer resistance | Medium | Clear docs, gradual enforcement |

## Dependencies

- Vitest framework setup
- Wallaby license procurement
- Docker infrastructure for Testcontainers
- MSW library integration
- Convex test utilities