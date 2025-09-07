# Test Specification

This is the test specification for validating the fixes detailed in
@.agent-os/specs/2025-09-08-test-infrastructure-fix/spec.md

## Test Categories

### 1. Hook Isolation Tests

#### Test: Environment Variable Disables Hook

- **Given**: CLAUDE_HOOK_DISABLED=true is set
- **When**: Claude hook is invoked
- **Then**: Hook immediately returns without execution

#### Test: Process Exit Mock Works

- **Given**: process.exit is mocked
- **When**: Quality check triggers exit
- **Then**: Exit code is captured without throwing

#### Test: Stdin/Stdout Isolation

- **Given**: Multiple tests write to stdout
- **When**: Tests run in parallel
- **Then**: Output doesn't interfere between tests

### 2. Mock Infrastructure Tests

#### Test: Mock Quality Checker Returns Predictable Results

- **Given**: MockQualityChecker with predefined issues
- **When**: check() is called
- **Then**: Returns exact predefined issues

#### Test: In-Memory File System Works

- **Given**: Files written to mock filesystem
- **When**: Files are read back
- **Then**: Content matches exactly

#### Test: Configuration Mocks Load Correctly

- **Given**: Mock config with specific rules
- **When**: Quality checker loads config
- **Then**: Rules are applied correctly

### 3. Configuration Loading Tests

#### Test: ESLint Flat Config Detected

- **Given**: eslint.config.js in test fixture
- **When**: ESLint engine checks configuration
- **Then**: Flat config is detected and used

#### Test: Prettierignore Respected

- **Given**: .prettierignore with patterns
- **When**: Files matching patterns are checked
- **Then**: Files are skipped

#### Test: TypeScript Config Loaded

- **Given**: tsconfig.json with strict settings
- **When**: TypeScript checks run
- **Then**: Strict rules are enforced

### 4. Integration Test Fixes

#### Test: Config Variations Pass

- **Given**: Various ESLint configurations
- **When**: Tests run with mocked environment
- **Then**: All 10 config variation tests pass

#### Test: Claude Hook Workflow Completes

- **Given**: Complete hook workflow
- **When**: Executed with mocks
- **Then**: All 6 workflow tests pass

#### Test: Multi-Engine Aggregation Works

- **Given**: Multiple engines with issues
- **When**: Results are aggregated
- **Then**: All issues are properly combined

### 5. Performance Tests

#### Test: Average Execution Under 100ms

- **Given**: Standard test suite
- **When**: Tests run with mocks
- **Then**: Average execution time < 100ms

#### Test: No Temp Directories Created

- **Given**: Test execution
- **When**: File operations occur
- **Then**: No filesystem temp directories exist

#### Test: No Child Processes Spawned

- **Given**: Quality checks run
- **When**: Execution completes
- **Then**: spawn/exec never called

## Validation Checklist

### Before Fix

- [ ] 23 tests failing
- [ ] Average execution: 761ms
- [ ] Real hooks executing
- [ ] Temp directories created
- [ ] Process spawning occurring

### After Fix

- [ ] 0 tests failing (all 459 pass)
- [ ] Average execution: <100ms
- [ ] No real hooks executing
- [ ] No temp directories
- [ ] Direct API usage only
- [ ] CI/CD pipeline green
- [ ] No flaky tests

## Test Execution Plan

1. **Phase 1**: Disable hooks and verify isolation
2. **Phase 2**: Implement mocks and verify behavior
3. **Phase 3**: Fix configuration loading
4. **Phase 4**: Update test assertions
5. **Phase 5**: Verify performance improvements
6. **Phase 6**: Run full suite multiple times for stability
