# Task #020 - Reduce Excessive Mocking

## Analysis Summary

### Current State

According to the epic documentation:

- **Original Target**: Reduce mock usage by 50% (from 359 to <180)
- **Actual Count**: 1495 total mock-related calls (vi.mock, vi.spyOn, vi.fn)
- **Revised Target**: Reduce by 50% to <750 mock calls
- **Goal**: Leverage existing QualityCheckerTestBuilder for real implementations

### Mock Usage Analysis

Current breakdown:

- **vi.mock()**: 52 unique calls across 22 files
- **vi.spyOn()**: 83 calls across 16 files
- **vi.fn()**: 370+ calls across 26 files
- **Total**: ~1495 mock-related calls

Based on detailed analysis, mocks are heavily used in:

1. File system operations (fs/promises)
2. Child process operations
3. External dependencies
4. Logger instances

### Implementation Plan

## 1. Create QualityCheckerTestBuilder

The QualityCheckerTestBuilder will provide:

- Real file system operations in temp directories
- Real child process execution
- Real configuration loading
- Test data factories

## 2. Categories of Mocks to Replace

### High Priority (Replace with Real)

1. **File System Operations**: Use temp directories with real fs
2. **Configuration Loading**: Use real config files in test fixtures
3. **Logger**: Use real logger with test output capture

### Medium Priority (Keep but Minimize)

1. **Child Process**: Real execution where safe, mock only dangerous operations
2. **Network Calls**: Mock external APIs but use real HTTP clients
3. **Time-based Operations**: Use fake timers but real scheduling logic

### Low Priority (Keep Mocked)

1. **External Services**: Keep mocked for speed and reliability
2. **System Resources**: Keep mocked for safety
3. **Third-party Libraries**: Mock complex dependencies

## 3. Test Builder Pattern

```typescript
class QualityCheckerTestBuilder {
  private tempDir: string
  private config: QualityCheckerConfig

  withRealFileSystem(): this
  withTestFiles(files: TestFile[]): this
  withConfiguration(config: Partial<Config>): this
  build(): QualityChecker
}
```

## 4. Migration Strategy

1. Start with most-mocked test files
2. Replace one category of mocks at a time
3. Ensure tests remain fast (<100ms per test)
4. Validate no flakiness introduced

## Files with Excessive Mocking

Priority files to refactor (most vi.mock calls):

1. claude-hook-workflow-mocked.integration.test.ts
2. eslint-engine.test.ts
3. typescript-engine.test.ts
4. file-batch-processor.test.ts
5. git-operations.test.ts

## Success Metrics

- Mock count reduced from 359 to <180
- Test execution time remains <20s total
- No increase in flaky tests
- Improved test confidence with real implementations
