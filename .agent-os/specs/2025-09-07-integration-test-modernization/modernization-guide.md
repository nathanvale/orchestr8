# Integration Test Modernization Guide

## Overview

This guide provides a systematic approach to modernizing the remaining
integration and infrastructure tests based on learnings from the Engine
Configuration Tests modernization effort.

## Current State Analysis

### Tests Requiring Modernization

- **Integration Tests:** 10 remaining tests with process spawning patterns
- **Infrastructure Tests:** 8 tests with heavy file I/O operations
- **Total:** 18 tests at 60% failure rate

### Key Problems Identified

1. **Process Spawning:** All tests use `child_process.spawn()` or `exec()`
2. **File System Dependencies:** Tests create 97.5 setup patterns per file on
   average
3. **Timing Issues:** Non-deterministic failures due to async file operations
4. **Configuration Complexity:** Multiple config files created per test
5. **Performance:** Average 761ms per test (target: <100ms)

## Modernization Strategy

### Phase 1: Architecture Setup (Week 1)

#### 1.1 Create Core Test Utilities

```typescript
// packages/quality-check/src/test-utils/modern-fixtures.ts
import { vi } from 'vitest'

export const createMockFileSystem = () => {
  const files = new Map<string, string>()

  return {
    writeFile: vi.fn((path, content) => {
      files.set(path, content)
      return Promise.resolve()
    }),
    readFile: vi.fn((path) => {
      return Promise.resolve(files.get(path) || '')
    }),
    exists: vi.fn((path) => {
      return Promise.resolve(files.has(path))
    }),
    reset: () => files.clear(),
  }
}

export const createQualityCheckerMock = () => {
  return {
    check: vi.fn(),
    fix: vi.fn(),
    getConfig: vi.fn(),
    reset: vi.fn(),
  }
}
```

#### 1.2 Direct API Wrappers

```typescript
// packages/quality-check/src/test-utils/api-wrappers.ts
import { QualityChecker } from '../core/quality-checker'

export class TestQualityChecker {
  private checker: QualityChecker

  constructor(config?: Partial<Config>) {
    this.checker = new QualityChecker({
      ...defaultTestConfig,
      ...config,
    })
  }

  async check(files: string[]): Promise<CheckResult> {
    // Direct API call, no process spawning
    return this.checker.execute(files)
  }

  async checkWithAutoFix(files: string[]): Promise<FixResult> {
    return this.checker.executeWithFix(files)
  }
}
```

#### 1.3 Assertion Helpers

```typescript
// packages/quality-check/src/test-utils/assertion-helpers.ts
export const assertNoIssues = (result: CheckResult) => {
  expect(result.issues).toHaveLength(0)
  expect(result.exitCode).toBe(0)
}

export const assertHasIssues = (result: CheckResult, expectedCount: number) => {
  expect(result.issues).toHaveLength(expectedCount)
  expect(result.exitCode).toBe(1)
}

export const assertIssueTypes = (result: CheckResult, types: IssueType[]) => {
  const actualTypes = result.issues.map((i) => i.type)
  expect(actualTypes).toEqual(expect.arrayContaining(types))
}
```

### Phase 2: Test Migration Pattern (Week 2)

#### Before (Legacy Pattern)

```typescript
test('should handle ESLint config', async () => {
  // 1. Create temp directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))

  // 2. Write config files
  await fs.writeFile(
    path.join(tempDir, 'eslint.config.js'),
    'module.exports = { /* config */ }',
  )

  // 3. Write test file
  await fs.writeFile(path.join(tempDir, 'test.js'), 'const x = 1;')

  // 4. Spawn process
  const result = await spawn('quality-check', [tempDir])

  // 5. Parse output
  const output = result.stdout.toString()
  expect(output).toContain('No issues')

  // 6. Cleanup
  await fs.rm(tempDir, { recursive: true })
})
```

#### After (Modern Pattern)

```typescript
test('should handle ESLint config', async () => {
  // 1. Setup mocks
  const mockFS = createMockFileSystem()
  const checker = new TestQualityChecker({
    fileSystem: mockFS,
  })

  // 2. Define test data
  mockFS.writeFile('eslint.config.js', 'module.exports = {}')
  mockFS.writeFile('test.js', 'const x = 1;')

  // 3. Direct API call
  const result = await checker.check(['test.js'])

  // 4. Assertions
  assertNoIssues(result)
})
```

### Phase 3: Systematic Migration (Weeks 2-3)

#### Migration Order (Priority)

1. **High-Value Tests (Week 2)**
   - ESLint flat config tests (2 tests)
   - TypeScript strict mode tests (3 tests)
   - Exit code logic tests (3 tests)

2. **Integration Tests (Week 3)**
   - Multi-engine coordination (3 tests)
   - Auto-fix behavior (3 tests)
   - CI/CD pipeline tests (4 tests)

#### Migration Checklist per Test

- [ ] Remove all `fs.mkdtemp()` calls
- [ ] Replace `child_process.spawn()` with direct API
- [ ] Convert file writes to mock filesystem
- [ ] Remove async file operation waits
- [ ] Use deterministic assertion helpers
- [ ] Verify <100ms execution time
- [ ] Ensure 100% code coverage maintained

### Phase 4: Validation & Optimization (Week 4)

#### Performance Validation

```bash
# Run individual test with timing
pnpm test -- --reporter=verbose [test-file] | grep ms

# Target: All tests <100ms
```

#### Coverage Validation

```bash
# Generate coverage report
pnpm test:coverage

# Target: Maintain 100% for migrated code
```

#### Setup Pattern Count

```bash
# Count setup patterns
grep -E "(beforeEach|afterEach|mkdtemp|spawn)" [test-file] | wc -l

# Target: <20 per file
```

## Implementation Timeline

### Week 1: Foundation

- Day 1-2: Create test utilities and fixtures
- Day 3-4: Implement API wrappers
- Day 5: Setup assertion helpers and validate architecture

### Week 2: High-Priority Migration

- Day 1-2: Migrate ESLint flat config tests
- Day 3-4: Migrate TypeScript strict mode tests
- Day 5: Migrate exit code logic tests

### Week 3: Integration Tests

- Day 1-2: Migrate multi-engine tests
- Day 3-4: Migrate auto-fix tests
- Day 5: Migrate CI/CD pipeline tests

### Week 4: Validation

- Day 1-2: Performance optimization
- Day 3: Coverage validation
- Day 4: Documentation update
- Day 5: Final validation and sign-off

## Success Metrics

### Must-Have

- ✅ 0% failure rate (from 60%)
- ✅ <100ms per test (from 761ms)
- ✅ <20 setup patterns per file (from 97.5)
- ✅ 100% code coverage maintained

### Nice-to-Have

- Parallel test execution enabled
- Test execution time <50ms
- Zero external dependencies
- Full TypeScript type safety

## Common Pitfalls to Avoid

1. **Don't Mock Too Deep:** Mock at the filesystem level, not individual
   functions
2. **Avoid Timing Dependencies:** Use synchronous mocks where possible
3. **Don't Share State:** Each test should have isolated mock state
4. **Keep Tests Focused:** One assertion type per test
5. **Maintain Readability:** Modern doesn't mean complex

## Rollback Strategy

If modernization causes issues:

1. Tests are migrated individually - can rollback per test
2. Keep legacy tests in separate file during migration
3. Run both old and new tests in parallel for validation
4. Only remove legacy tests after 1 week of stability

## Resources

- [Vitest Mocking Guide](https://vitest.dev/guide/mocking)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Performance Testing Guide](https://vitest.dev/guide/performance)

## Support

For questions or issues during migration:

- Check existing migrated tests in `src/integration/`
- Review test utilities in `src/test-utils/`
- Consult team lead for architectural decisions
