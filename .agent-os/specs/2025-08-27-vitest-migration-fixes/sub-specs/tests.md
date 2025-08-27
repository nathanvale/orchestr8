# Tests Specification

This is the tests coverage details for the spec detailed in
@.agent-os/specs/2025-08-27-vitest-migration-fixes/spec.md

> Created: 2025-08-27 Version: 1.0.0

## Test Coverage

### Unit Tests

**Configuration Tests**

- Verify test isolation works correctly in CI environment
- Confirm coverage generation when CI=true
- Validate reporter selection based on environment
- Test fork limit calculation based on CPU count
- Verify cache directory configuration

**Mock Strategy Tests**

- Confirm fetch is not globally mocked
- Verify MSW handlers work without interference
- Test DOM mocks only apply in test environment
- Validate mock clearing between tests
- Ensure no mock restoration conflicts

**Setup Tests**

- Test that coverage directory is created when needed
- Verify environment checks work correctly
- Confirm whatwg-fetch imports only when needed
- Test that window APIs are mocked conditionally

### Integration Tests

**CI Pipeline Tests**

- Full test run with coverage generation
- JUnit reporter output validation
- Coverage upload to Codecov
- TypeScript checking of test files
- Performance benchmark in separate workflow

**Local Development Tests**

- Fast feedback with isolation disabled
- Proper fork limiting on local machines
- Correct reporter output locally
- Cache directory creation and usage

### Feature Tests

**End-to-End Test Scenarios**

1. **Developer runs tests locally**
   - Tests execute without isolation for speed
   - Default reporter shows balanced output
   - Fork count limited to available CPUs
   - No coverage generation by default

2. **CI pipeline runs on PR**
   - Tests run with full isolation
   - Coverage reports generate successfully
   - JUnit XML output created
   - Codecov receives coverage data
   - TypeScript checks all files including tests

3. **Nightly performance benchmark**
   - Separate workflow triggers at 2 AM
   - Hyperfine benchmarks run
   - Results uploaded as artifacts
   - No impact on PR build times

### Mocking Requirements

**No Additional Mocking Needed**

- MSW handles all network mocking
- DOM APIs conditionally mocked in setup
- No external service mocking required

### Test Verification Strategy

#### Phase 1: Critical Fix Validation

```bash
# After removing global fetch mock
bun test --run tests/sample.test.ts
# Verify MSW handlers work

# After enabling CI isolation
CI=true bun test --run
# Verify no state leakage

# After fixing coverage
CI=true bun test --coverage
# Check coverage/lcov.info exists

# After JUnit safety
CI=true bun test --reporter=junit
# Verify coverage/junit.xml generated
```

#### Phase 2: Configuration Validation

```bash
# Test mock clearing
bun test --run tests/mock-test.ts
# Verify mocks reset between tests

# Test environment checks
VITEST=true bun test --run
# Verify DOM mocks apply

NODE_ENV=production bun test --run
# Verify DOM mocks don't apply

# Test cache configuration
ls -la .vitest/
# Verify cache directory exists
```

#### Phase 3: Performance Validation

```bash
# Test fork limiting locally
bun test --run
# Monitor CPU usage stays reasonable

# Test reporter output
VERBOSE=true bun test --run
# Verify verbose output

bun test --run
# Verify default reporter

# Test consolidated scripts
bun run test:ci
# Verify all CI requirements met
```

### Test Data Requirements

**Sample Test Files**

- `tests/fetch.test.ts` - Verify MSW works without fetch mock
- `tests/isolation.test.ts` - Test state isolation
- `tests/mock-reset.test.ts` - Verify mock clearing
- `tests/dom-api.test.ts` - Test conditional DOM mocks

### Coverage Expectations

**Target Coverage**

- Overall: 80% minimum
- Critical paths: 100%
- Configuration code: 90%
- Setup files: 85%

**Coverage Verification**

```bash
# Local coverage check
bun test --coverage

# CI coverage check
CI=true bun test --coverage --reporter=lcov

# View coverage report
open coverage/index.html
```

### Test Execution Time Targets

**Local Development**

- Full test suite: < 30 seconds
- Single file: < 1 second
- Watch mode response: < 500ms

**CI Pipeline**

- Test execution: < 2 minutes
- Coverage generation: < 3 minutes
- Total pipeline: < 5 minutes

### Regression Testing

**After Each Fix**

1. Run full test suite
2. Verify no existing tests break
3. Check coverage doesn't decrease
4. Confirm CI pipeline passes
5. Monitor execution time

**Critical Path Tests**

- Network request handling (MSW)
- Test isolation verification
- Coverage report generation
- JUnit XML output
- TypeScript compilation

### Test Failure Handling

**Expected Failures During Migration**

- Initial test runs may fail due to fetch mock removal
- Some tests may need MSW handler updates
- Coverage thresholds might not be met initially

**Recovery Steps**

1. Identify failing tests
2. Update to use MSW handlers instead of fetch mocks
3. Fix any state dependencies between tests
4. Re-run with isolation to verify fixes
5. Adjust coverage thresholds if needed temporarily

### Continuous Testing Strategy

**Pre-commit**

- Lint and format checks
- No focused tests (.only)
- Quick unit test subset

**Pre-push**

- Full test suite
- TypeScript checking
- Coverage verification

**Pull Request**

- Multi-OS test matrix
- Full coverage report
- JUnit results for CI visibility

**Nightly**

- Performance benchmarks
- Memory leak detection
- Full regression suite

## Success Metrics

- ✅ Zero test failures after migration
- ✅ Coverage reports generated in < 3 minutes
- ✅ All MSW handlers work without fetch conflicts
- ✅ Test isolation prevents flaky tests
- ✅ CI pipeline provides clear pass/fail status
- ✅ Performance benchmarks run nightly without blocking PRs
