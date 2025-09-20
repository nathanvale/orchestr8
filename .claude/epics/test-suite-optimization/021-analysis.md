# Task #021 - Add Cleanup Guards to Integration Tests

## Analysis Summary

### Integration Tests Inventory

Analyzed 12 integration test files across the codebase:

1. `packages/quality-check/src/integration/claude-hook-workflow-mocked.integration.test.ts`
2. `packages/quality-check/src/integration/claude-hook-workflow.integration.test.ts`
   ✅
3. `packages/quality-check/src/integration/config-variations.integration.test.ts`
4. `packages/quality-check/tests/quality-checker-full.integration.test.ts` ✅
5. `packages/quality-check/tests/vitest.integration.test.ts` ⚠️
6. `packages/quality-check/tests/turborepo-validation.integration.test.ts` ⚠️
7. `tests/changesets.integration.test.ts` ⚠️
8. `tests/ci-modular-jobs.integration.test.ts`
9. `tests/test-audit.integration.test.ts`
10. `tests/ci-cd-pipeline.integration.test.ts`
11. `tests/dependency-validation.integration.test.ts`
12. `tooling/build/tsup.base.integration.test.ts`

### Critical Issues Found

#### 1. Timer Management Issues

- **File**: `vitest.integration.test.ts`
- **Line**: 86-99
- **Issue**: Timer created but not cleaned up on test failure
- **Fix**: Move `vi.useRealTimers()` to afterEach hook

#### 2. Process Spawning Without Timeouts

- **File**: `turborepo-validation.integration.test.ts`
- **Issue**: Multiple `execSync` calls without timeout protection
- **Fix**: Add timeout and killSignal options

### Resource Leak Patterns

#### Pattern 1: File System Resources

- 5 files create temp directories
- 4/5 use proper cleanup with `fs.rm`
- Issue: `changesets.integration.test.ts` uses shell commands

#### Pattern 2: Mock State Persistence

- 7 files use mocks
- 4/7 properly call `vi.clearAllMocks()`
- 3 files missing mock cleanup

#### Pattern 3: Process Management

- 2 files spawn processes
- No process tracking or cleanup guards
- Risk of zombie processes

#### Pattern 4: Timer/Interval Management

- 3 files use timers
- Only 1/3 properly manages timers
- Risk of timer leaks

## Implementation Plan

### 1. Create Test Resource Guard Utility

```typescript
// packages/quality-check/src/test-utils/test-resource-guard.ts
export class TestResourceGuard {
  private cleanupFns: Array<() => Promise<void> | void> = []
  private processes: Set<ChildProcess> = new Set()
  private timers: Set<NodeJS.Timeout> = new Set()
  private tempDirs: Set<string> = new Set()

  registerCleanup(fn: () => Promise<void> | void): void
  trackProcess(proc: ChildProcess): void
  trackTimer(timer: NodeJS.Timeout): NodeJS.Timeout
  trackTempDir(dir: string): void
  async cleanup(): Promise<void>
}
```

### 2. Integration Test Base Setup

```typescript
// packages/quality-check/src/test-utils/integration-test-base.ts
export function setupIntegrationTest() {
  const guard = new TestResourceGuard()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  afterEach(async () => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    await guard.cleanup()
  })

  return guard
}
```

### 3. Safe Process Execution Helper

```typescript
// packages/quality-check/src/test-utils/process-utils.ts
export function execSyncSafe(
  command: string,
  options: ExecSyncOptions = {},
): Buffer | string {
  const defaults = {
    timeout: 30000,
    killSignal: 'SIGTERM',
    maxBuffer: 10 * 1024 * 1024,
  }
  return execSync(command, { ...defaults, ...options })
}
```

## Priority Order for Fixes

### High Priority (Immediate)

1. **Fix timer leak in vitest.integration.test.ts**
   - Add afterEach with vi.useRealTimers()
   - Effort: 15 minutes

2. **Add timeouts to execSync calls**
   - Update turborepo-validation.integration.test.ts
   - Update changesets.integration.test.ts
   - Effort: 30 minutes

### Medium Priority

3. **Standardize mock cleanup**
   - Add vi.clearAllMocks() to all test files
   - Effort: 1 hour

4. **Replace shell commands with fs operations**
   - Update changesets.integration.test.ts
   - Effort: 30 minutes

### Low Priority

5. **Implement TestResourceGuard**
   - Create shared utility
   - Migrate tests to use it
   - Effort: 4 hours

## Success Metrics

- Zero resource leaks in integration tests
- All tests complete without hanging
- No zombie processes after test runs
- CI runs complete in <5 minutes
- Zero test pollution between runs

## Best Practices to Document

1. Always use fake timers for time-dependent tests
2. Always add timeout to process spawning
3. Always clean up resources in afterEach hooks
4. Use TestResourceGuard for complex tests
5. Track all spawned processes and kill on cleanup
6. Clear all mocks between tests
7. Use temp directories that auto-cleanup

## Exemplary Patterns Found

### Best: claude-hook-workflow.integration.test.ts

- Robust cleanup with fallback strategies
- Restores working directory
- Verifies cleanup completion
- Handles environment variables properly

### Best: quality-checker-full.integration.test.ts

- Clean separation of setup/teardown
- Uses mock environment factory
- Properly disposes resources

## Testing Strategy

### 1. Resource Leak Detection

- Run tests in loop to detect leaks
- Monitor process count before/after
- Check for open file handles
- Verify timer cleanup

### 2. CI Integration

```yaml
- name: Check for zombie processes
  run: |
    pnpm test:integration
    ps aux | grep defunct | grep -v grep || true
    [ $(ps aux | grep defunct | wc -l) -eq 0 ]
```

## Estimated Effort

- **Total**: 6-8 hours
- **Risk Reduction**: High
- **Maintenance Benefit**: Significant
- **Test Reliability**: Major improvement
