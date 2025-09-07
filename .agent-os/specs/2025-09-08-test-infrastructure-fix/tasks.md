# Spec Tasks

## Test Infrastructure Fix

Date: 2025-09-08
Status: Active

### Overview

Fix 23 failing integration tests by addressing mock isolation, disabling real Claude hook execution during tests, and fixing configuration loading. Target: 0% failure rate and <100ms average test execution time.

## Tasks

- [x] 1. Implement Test Environment Isolation
  - [x] 1.1 Write tests for environment variable control (CLAUDE_HOOK_DISABLED)
  - [x] 1.2 Add CLAUDE_HOOK_DISABLED check to Claude hook entry points
  - [x] 1.3 Create test-utils/test-environment.ts with setup/teardown helpers
  - [x] 1.4 Fix process.exit mock to capture exit codes without throwing
  - [x] 1.5 Implement proper stdin/stdout/stderr isolation between tests
  - [x] 1.6 Verify all hook isolation tests pass

- [ ] 2. Create Mock Infrastructure
  - [x] 2.1 Write tests for MockQualityChecker class
  - [x] 2.2 Implement MockQualityChecker with predictable results
  - [x] 2.3 Create InMemoryFileSystem using Map<string, string>
  - [x] 2.4 Implement MockConfigLoader for test fixtures
  - [x] 2.5 Create mock factory pattern in test-utils/mock-factory.ts
  - [x] 2.6 Replace real quality checker with mocks in all integration tests
  - [x] 2.7 Verify mock infrastructure tests pass

- [ ] 3. Fix Configuration Loading
  - [ ] 3.1 Write tests for ESLint flat config detection
  - [ ] 3.2 Fix ESLint engine to properly detect eslint.config.js
  - [ ] 3.3 Update prettierignore handling to use test fixtures
  - [ ] 3.4 Fix TypeScript config loading from test fixtures
  - [ ] 3.5 Ensure all configs load from mocks, not filesystem
  - [ ] 3.6 Verify configuration loading tests pass

- [ ] 4. Update Test Assertions and Performance
  - [ ] 4.1 Write performance benchmark tests
  - [ ] 4.2 Update assertions expecting empty output to handle error messages
  - [ ] 4.3 Fix exit code expectations (0 for success, 1 for issues)
  - [ ] 4.4 Replace all child_process.spawn calls with direct API usage
  - [ ] 4.5 Remove all fs.mkdtemp() calls and temp directory creation
  - [ ] 4.6 Implement assertion helpers for error message validation
  - [ ] 4.7 Verify all 23 failing tests now pass
  - [ ] 4.8 Confirm average test execution time <100ms

- [ ] 5. Validate CI/CD Pipeline
  - [ ] 5.1 Write integration test for CI/CD pipeline scenarios
  - [ ] 5.2 Run full test suite multiple times to check for flaky tests
  - [ ] 5.3 Verify proper exit codes in CI environment
  - [ ] 5.4 Test parallel execution without interference
  - [ ] 5.5 Document any remaining known issues
  - [ ] 5.6 Confirm CI/CD pipeline passes consistently

## Success Criteria

- ✅ All 23 currently failing tests pass
- ✅ No real Claude hooks execute during tests
- ✅ Average test execution time <100ms (from 761ms)
- ✅ No temporary directories created
- ✅ No child processes spawned
- ✅ CI/CD pipeline green
- ✅ No flaky tests in multiple runs