# Task #019 - Fix Timing-Dependent Tests

## Analysis Summary

### Tests Identified with Timing Issues

Based on the code analysis, the following test files contain timing-related code that could cause flakiness:

1. **resource-monitor.test.ts** - Uses real `setTimeout` without fake timers
2. **zombie-prevention.validation.test.ts** - Contains multiple timing-sensitive tests
3. **file-batch-processor.test.ts** - Has tests that take >1s to run
4. **typescript-engine.disposal.test.ts** - Has tests taking 2.5s+ to run
5. **claude.test.ts** - Has a 5s timeout test

### Timing Patterns Found

1. **Real setTimeout Usage** (4 instances in resource-monitor.test.ts):
   - Lines 116, 136, 260, 297
   - Uses `await new Promise((resolve) => setTimeout(resolve, ms))`
   - Should use `vi.advanceTimersByTimeAsync(ms)` with fake timers

2. **Long-Running Tests**:
   - typescript-engine.disposal.test.ts: Tests taking 2.5-2.8s
   - file-batch-processor.test.ts: Tests taking 1s+
   - zombie-prevention.validation.test.ts: Tests taking 600ms-1s

3. **Properly Handled Timing**:
   - buffer-pool.test.ts - Correctly uses fake timers
   - performance-monitor.test.ts - Previously fixed (comment on line 77)

## Implementation Plan

### Phase 1: Fix resource-monitor.test.ts
- Add `vi.useFakeTimers()` in beforeEach
- Add `vi.useRealTimers()` in afterEach
- Replace all `setTimeout` with `vi.advanceTimersByTimeAsync()`
- Ensure monitor cleanup in afterEach

### Phase 2: Review Long-Running Tests
- Analyze if delays are necessary
- Consider using fake timers where applicable
- Add proper cleanup hooks

### Phase 3: Create Test Stability Guidelines
- Document best practices for timing in tests
- Create helper functions for common timing patterns
- Add linting rules for setTimeout usage in tests

## Root Cause Analysis

The flakiness likely comes from:
1. **Race conditions** in tests that depend on real timing
2. **Resource cleanup issues** causing interference between tests
3. **System load variations** affecting timing-sensitive operations

## Recommended Fixes

### Immediate (Task #019)
1. Fix resource-monitor.test.ts timing issues
2. Add fake timers to all timing-dependent tests
3. Ensure proper cleanup in all integration tests

### Follow-up
1. Create timing test utilities
2. Add ESLint rule to catch setTimeout in tests
3. Monitor test execution times in CI

## Success Metrics
- Zero flaky tests in 10 consecutive runs
- All tests complete in <20s total
- No setTimeout usage in test files (except with fake timers)