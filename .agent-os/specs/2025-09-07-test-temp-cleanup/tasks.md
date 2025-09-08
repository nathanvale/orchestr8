# Implementation Tasks

## Phase 1: Immediate Cleanup & Protection

### Task 1.1: Add test-temp to .gitignore

- [x] Add `test-temp/` entry to `.gitignore`
- [x] Verify with `git status` that existing directories are ignored
- [x] Commit the .gitignore change
- [x] Remove test-temp from git history

### Task 1.2: Clean up existing test-temp directories

- [x] Delete all existing `test-temp/*` directories from project root
- [x] Verify no test artifacts remain with `ls -la test-temp/`
- [x] Remove the empty test-temp directory itself

## Phase 2: Refactor Claude Hook Integration Test

### Task 2.1: Import required modules

- [x] Add `import os from 'node:os'` to claude-hook-workflow.integration.test.ts
- [x] Verify existing imports for fs and path modules
- [x] Consider importing test-isolation utility

### Task 2.2: Update test directory creation (First test block - lines 7-43)

- [x] Replace project root path calculation with `os.tmpdir()` usage
- [x] Change from:
      `path.join(__dirname, '..', '..', '..', '..', 'test-temp', ...)`
- [x] Change to: `path.join(os.tmpdir(), 'quality-check-tests', ...)`
- [x] Add unique identifier with PID: `claude-test-${process.pid}-${Date.now()}`

### Task 2.3: Fix cleanup mechanism in afterEach

- [x] Add try-catch with force flag for fs.rm
- [x] Add fallback to fs.rmSync if async fails
- [x] Restore original working directory before cleanup
- [x] Add cleanup verification

### Task 2.4: Update optimized test section (lines 528-674)

- [x] Verify it already uses os.tmpdir() correctly
- [x] Ensure unique ID generation includes process.pid
- [x] Verify cleanup in afterEach hook

### Task 2.5: Update helper functions

- [x] Update `setupTestProject()` function if needed
- [x] Update `setupMinimalTestProject()` function if needed
- [x] Ensure all helper functions use OS temp directory

## Phase 3: Optional - Migrate to Test Isolation Utility

### Task 3.1: Evaluate test-isolation.ts usage

- [ ] Review if `createIsolatedTestEnv()` can replace current setup
- [ ] Check compatibility with existing test structure
- [ ] Determine migration effort vs benefit

### Task 3.2: Refactor to use test utility (if beneficial)

- [ ] Import `createIsolatedTestEnv` from test-utils
- [ ] Replace manual temp directory management
- [ ] Update test structure to use utility's context
- [ ] Verify all tests still pass

## Phase 4: Validation & Testing

### Task 4.1: Run integration tests

- [ ] Execute: `pnpm --filter @template/quality-check test:integration`
- [ ] Verify all tests pass
- [ ] Check no directories created in project root

### Task 4.2: Verify cleanup effectiveness

- [ ] Run tests multiple times
- [ ] Check OS temp directory for accumulation
- [ ] Monitor with: `ls -la $TMPDIR | grep claude-test`
- [ ] Verify automatic cleanup after test completion

### Task 4.3: Test parallel execution

- [ ] Run tests in parallel mode
- [ ] Verify no directory conflicts
- [ ] Check unique directory naming works

### Task 4.4: Performance validation

- [ ] Measure test execution time before and after changes
- [ ] Ensure no performance regression
- [ ] Verify sub-2 second execution for individual tests

## Phase 5: Documentation & Cleanup

### Task 5.1: Update test documentation

- [ ] Document temp directory usage pattern
- [ ] Add comments explaining cleanup mechanism
- [ ] Note the OS temp directory migration

### Task 5.2: Create cleanup script (optional)

- [ ] Create script to clean old test directories from OS temp
- [ ] Add to package.json scripts if useful
- [ ] Document usage in README

### Task 5.3: Final verification

- [ ] Run full test suite
- [ ] Check git status is clean
- [ ] Verify no test-temp in project root
- [ ] Commit all changes

## Success Criteria

- ✅ No test-temp directory in project root after test execution
- ✅ All integration tests pass without errors
- ✅ Git status shows no untracked test artifacts
- ✅ Tests can run in parallel without conflicts
- ✅ Cleanup occurs even when tests fail
- ✅ Performance remains under 2 seconds per test
