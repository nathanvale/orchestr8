# Prioritized Fixes and Improvements

This document provides actionable, prioritized fixes for the @orchestr8 system based on comprehensive analysis.

> Created: 2025-01-17
> Version: 1.0.0
> Status: Ready for implementation

## Executive Summary

Critical improvements identified across CI/CD, testing, and API alignment. All fixes are actionable with clear implementation paths.

## Priority 1: Critical Fixes (Week 1)

### 1. Remove nyc References

**Impact**: High - Blocking accurate coverage reporting
**Effort**: Low - Configuration change

**Actions**:

- [ ] Update all `vitest.config.ts` files to use v8 provider exclusively
- [ ] Remove nyc from all package.json dependencies
- [ ] Update coverage directories to standard `./coverage/`
- [ ] Ensure all coverage reporters output `coverage-summary.json`

**Implementation**:

```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',  // ONLY v8
  reporter: ['text', 'json-summary', 'html'],
  reportsDirectory: './coverage/'
}
```

### 2. Update CI to Codecov v4

**Impact**: High - Current coverage reporting may be unreliable
**Effort**: Low - CI configuration update

**Actions**:

- [ ] Replace codecov-action@v3 with codecov-action@v4
- [ ] Add CODECOV_TOKEN to GitHub secrets
- [ ] Upload v8 json-summary files per project
- [ ] Remove any nyc merge steps

**Implementation**:

```yaml
- uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: ./coverage/coverage-summary.json
```

### 3. Add CI Concurrency Control

**Impact**: Medium - Reduces resource waste
**Effort**: Low - CI configuration addition

**Actions**:

- [ ] Add concurrency group to all workflows
- [ ] Enable cancel-in-progress for non-main branches
- [ ] Test with multiple PRs to verify behavior

**Implementation**:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## Priority 2: Environment Consistency (Week 1)

### 4. Set TZ and LANG in CI

**Impact**: Medium - Prevents timezone-related test failures
**Effort**: Low - Environment variable addition

**Actions**:

- [ ] Add TZ=UTC to all test jobs
- [ ] Add LANG=en_US.UTF-8 to all test jobs
- [ ] Verify with date-sensitive tests

**Implementation**:

```yaml
env:
  TZ: UTC
  LANG: en_US.UTF-8
```

### 5. Pin Node.js Minor Versions

**Impact**: Medium - Prevents cross-version timer/Abort differences
**Effort**: Low - Version specification change

**Actions**:

- [ ] Change from '20' to '20.12.x' in CI matrix
- [ ] Change from '22' to '22.15.x' in CI matrix (aligned with .nvmrc)
- [ ] Test AbortSignal.any and AbortSignal.timeout features

**Implementation**:

```yaml
strategy:
  matrix:
    node: ['20.12.x', '22.15.x'] # 22.15.x aligned with project .nvmrc
```

## Priority 3: Test Alignment (Week 2)

### 6. Align API Tests to MVP Endpoints

**Impact**: High - Tests may be testing non-existent endpoints
**Effort**: Medium - Test refactoring

**Actions**:

- [ ] Move ETag tests from `/workflows/:id` to `/executions/:id`
- [ ] Add explicit `/workflows/:id` endpoint if needed by spec
- [ ] Update all test paths to match actual implementation
- [ ] Remove references to `/agent/process` (use `/process`)

### 7. Standardize Resilience Composition

**Impact**: Medium - Reduces confusion and bugs
**Effort**: Medium - Documentation and test updates

**Actions**:

- [ ] Document retry(circuitBreaker(timeout)) pattern in one place
- [ ] Create standard exponential backoff formula: `2^attempt * baseDelay + jitter`
- [ ] Update all resilience tests to use standard pattern
- [ ] Add composition order validation tests

## Priority 4: Test Infrastructure (Week 2)

### 8. Add Disposal to Idempotency Harness

**Impact**: High - Prevents timer leaks and test flakiness
**Effort**: Medium - Test harness update

**Actions**:

- [ ] Inject scheduler interface for deterministic testing
- [ ] Add afterEach cleanup for all timers
- [ ] Implement proper timer disposal in cache
- [ ] Add tests for TTL expiration

**Implementation**:

```typescript
afterEach(() => {
  timers.forEach((id) => scheduler.clear(id))
  timers.clear()
  vi.clearAllTimers()
  vi.useRealTimers()
})
```

### 9. Add Circuit Breaker Half-Open Test

**Impact**: Medium - Critical behavior not tested
**Effort**: Low - Single test addition

**Actions**:

- [ ] Test concurrent requests in half-open state
- [ ] Verify only one request passes through
- [ ] Test transition back to open on failure
- [ ] Test transition to closed on success

### 10. Add Retry-Abort Test

**Impact**: Medium - Cancellation behavior not verified
**Effort**: Low - Single test addition

**Actions**:

- [ ] Test AbortSignal during retry attempts
- [ ] Verify cleanup handlers are called
- [ ] Test partial retry completion
- [ ] Verify no further retries after abort

## Priority 5: Observability (Week 3)

### 11. Add OTel Attribute Assertions

**Impact**: Low - Improves observability validation
**Effort**: Medium - Test additions

**Actions**:

- [ ] Test span attributes are set correctly
- [ ] Verify trace context propagation
- [ ] Validate metric dimensions
- [ ] Test error recording in spans

### 12. Add Journal Timing Invariants

**Impact**: Low - Ensures journal consistency
**Effort**: Low - Test additions

**Actions**:

- [ ] Test timestamp ordering in entries
- [ ] Verify duration calculations
- [ ] Test timezone consistency (UTC)
- [ ] Validate monotonic timestamps

## Priority 6: Tooling (Week 3)

### 13. Add CLI ESM Scaffolding Tests

**Impact**: Medium - Ensures generated code works
**Effort**: Low - Test additions

**Actions**:

- [ ] Test package.json has "type": "module"
- [ ] Verify import/export syntax in templates
- [ ] Test generated code runs without errors
- [ ] Verify vitest config is included

## Priority 7: CI Optimization (Week 4)

### 14. Consider Unified Workspace Testing

**Impact**: Low - Simplifies CI configuration
**Effort**: High - Major CI refactor

**Actions**:

- [ ] Evaluate `pnpm test --coverage --workspace` performance
- [ ] Compare with current separated approach
- [ ] Make decision based on timing data
- [ ] Implement if <10 minute threshold maintained

## Implementation Checklist

### Immediate (Day 1-2)

- [ ] Remove all nyc references (Priority 1.1)
- [ ] Update to Codecov v4 (Priority 1.2)
- [ ] Add concurrency control (Priority 1.3)
- [ ] Set TZ/LANG environment variables (Priority 2.4)
- [ ] Pin Node.js versions (Priority 2.5)

### Week 1 Completion

- [ ] Align API test endpoints (Priority 3.6)
- [ ] Standardize resilience patterns (Priority 3.7)
- [ ] Fix idempotency timer disposal (Priority 4.8)

### Week 2 Completion

- [ ] Add circuit breaker half-open test (Priority 4.9)
- [ ] Add retry-abort test (Priority 4.10)
- [ ] Add OTel attribute tests (Priority 5.11)
- [ ] Add journal timing tests (Priority 5.12)

### Week 3 Completion

- [ ] Add CLI ESM scaffolding tests (Priority 6.13)
- [ ] Evaluate workspace testing approach (Priority 7.14)
- [ ] Document all changes in ADRs
- [ ] Update team on new CI/CD processes

## Success Criteria

### Quantitative Metrics

- CI build time: <10 minutes for PR checks
- Test flake rate: <1%
- Coverage stability: No drops >2%
- All ADR conformance tests: 100% coverage

### Qualitative Metrics

- No nyc dependencies in codebase
- Consistent test environments across all runs
- Clear resilience pattern documentation
- No timer leaks in test suite

## Risk Mitigation

### Risks

1. **Workspace testing too slow**: Keep separated approach as fallback
2. **Codecov v4 issues**: Maintain v3 configuration as backup
3. **Node pinning breaks deps**: Use ranges if specific versions fail

### Mitigations

1. **Gradual rollout**: Implement fixes incrementally
2. **Feature flags**: Use environment variables to toggle new behavior
3. **Rollback plan**: Git tags before major changes

## Conclusion

These prioritized fixes address critical issues while maintaining MVP timeline. Focus on Priority 1-3 items first for maximum impact with minimal effort. All changes improve system reliability and developer experience.
