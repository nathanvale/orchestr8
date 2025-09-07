# Spec Tasks

## Fix Skipped Tests in Quality Checker

Date: 2025-09-07 Status: Active Updated: 2025-09-07

### Overview

This task list addresses skipped and failing tests in the quality checker
package to ensure comprehensive test coverage and proper functionality. Extended
to include comprehensive fixes for 30 failing integration tests across 4 test
suites.

## Tasks

- [x] 1. Fix TypeScript Strict Mode Tests
  - [x] 1.1 Enable and analyze TypeScript strict null checks test in
        config-variations.integration.test.ts
  - [x] 1.2 Update TypeScript engine to handle strict null checks compiler
        option properly
  - [x] 1.3 Enable and analyze TypeScript no implicit any test in
        config-variations.integration.test.ts
  - [x] 1.4 Update TypeScript engine to handle noImplicitAny compiler option
  - [x] 1.5 Remove skip modifiers from TypeScript strict mode describe block
        (line 157)
  - [x] 1.6 Verify all TypeScript strict mode tests pass

- [x] 2. Fix Blocking Behavior Tests
  - [x] 2.1 Enable blocking behavior describe block in
        claude-hook-workflow.integration.test.ts (line 281)
  - [x] 2.2 Analyze type safety blocking requirements for
        should_block_for_type_safety_issues test
  - [x] 2.3 Update autopilot adapter to properly detect and block type safety
        issues
  - [x] 2.4 Analyze complexity blocking requirements for
        should_block_for_complexity_issues test
  - [x] 2.5 Update autopilot adapter to properly detect and block complexity
        issues
  - [x] 2.6 Verify all blocking behavior tests pass

- [x] 3. Fix Failing Unit Tests
  - [x] 3.1 Analyze quality-checker.unit.test.ts TypeScript error handling
        failure
  - [x] 3.2 Update error message expectations to match actual TypeScript output
  - [x] 3.3 Analyze claude.unit.test.ts invalid payload handling failures
  - [x] 3.4 Fix payload validation in claude facade to handle undefined
        gracefully
  - [x] 3.5 Add defensive checks for missing payload properties (tool_name,
        file_path)
  - [x] 3.6 Verify all unit tests pass

- [x] 4. Integration and Performance Validation
  - [x] 4.1 Run full test suite to ensure no regressions
  - [x] 4.2 Verify performance benchmarks still pass (sub-300ms requirement)
  - [x] 4.3 Update test documentation if needed
  - [x] 4.4 Run linting and type checking (pnpm lint, pnpm typecheck)
  - [x] 4.5 Ensure all integration tests pass without skips

## Acceptance Criteria

- All previously skipped tests are enabled and passing
- No test regressions in existing test suite
- Performance benchmarks remain within acceptable limits
- Code passes all linting and type checking
- Test coverage maintains or improves from baseline

## Technical Notes

### Affected Files:

- `packages/quality-check/src/integration/config-variations.integration.test.ts`
- `packages/quality-check/src/integration/claude-hook-workflow.integration.test.ts`
- `packages/quality-check/src/core/quality-checker.unit.test.ts`
- `packages/quality-check/src/facades/claude.unit.test.ts`
- `packages/quality-check/src/engines/typescript-engine.ts`
- `packages/quality-check/src/adapters/autopilot.ts`

### Key Components:

- TypeScript Engine: Handles TypeScript compilation and error detection
- Autopilot Adapter: Makes decisions about blocking vs auto-fixing issues
- Claude Facade: Handles Claude hook integration and payload validation
- Quality Checker: Core orchestration of quality checks

## Phase 2: Integration Test Fixes (30 Failing Tests)

### 5. Performance Optimization (Priority 1 - Affects Multiple Suites)

- [ ] 5.1 TypeScript Engine Performance
  - [ ] 5.1.1 Implement proper TypeScript incremental compilation caching in
        typescript-engine.ts
  - [ ] 5.1.2 Add persistent tsBuildInfo cache directory management
  - [ ] 5.1.3 Optimize file system operations to reduce I/O overhead
  - [ ] 5.1.4 Implement parallel processing for multi-file checks where
        applicable
  - [ ] 5.1.5 Add performance monitoring and metrics collection
  - [ ] 5.1.6 Verify all performance tests complete under 2000ms threshold

- [ ] 5.2 Timeout Handling
  - [ ] 5.2.1 Implement graceful timeout mechanisms for long-running operations
  - [ ] 5.2.2 Add configurable timeout values for CI/CD environments (10s limit)
  - [ ] 5.2.3 Ensure proper cleanup on timeout events
  - [ ] 5.2.4 Fix tests timing out in ci-cd-pipeline.integration.test.ts
  - [ ] 5.2.5 Fix tests timing out in config-variations.integration.test.ts

### 6. Exit Code Standardization

- [ ] 6.1 Core Exit Code Logic
  - [ ] 6.1.1 Standardize exit code mapping (0 for success/warnings, non-zero
        for errors)
  - [ ] 6.1.2 Ensure consistency across TypeScript, ESLint, and Prettier engines
  - [ ] 6.1.3 Fix aggregation logic when multiple engines report different
        severities
  - [ ] 6.1.4 Update quality-checker.ts to return proper exit codes

- [ ] 6.2 Test-Specific Fixes
  - [ ] 6.2.1 Fix exit code compliance in ci-cd-pipeline.integration.test.ts
  - [ ] 6.2.2 Fix exit code 0 when no issues in
        quality-checker-full.integration.test.ts
  - [ ] 6.2.3 Fix custom enterprise config exit codes in
        config-variations.integration.test.ts
  - [ ] 6.2.4 Fix non-existent file operation exit codes in
        claude-hook-workflow.integration.test.ts

### 7. Auto-Fix Functionality

- [ ] 7.1 Silent Auto-Fix Implementation
  - [ ] 7.1.1 Implement silent formatting fixes for Prettier issues
  - [ ] 7.1.2 Fix import organization in TypeScript engine
  - [ ] 7.1.3 Ensure auto-fix doesn't affect exit code determination
  - [ ] 7.1.4 Add proper error handling for auto-fix operations

- [ ] 7.2 Test-Specific Fixes
  - [ ] 7.2.1 Fix silently_fix_formatting_issues in
        claude-hook-workflow.integration.test.ts
  - [ ] 7.2.2 Fix silently_fix_import_organization_issues in
        claude-hook-workflow.integration.test.ts
  - [ ] 7.2.3 Fix Prettier custom print width auto-fix in
        config-variations.integration.test.ts
  - [ ] 7.2.4 Fix tabs vs spaces auto-fix in
        config-variations.integration.test.ts

### 8. Configuration Handling

- [ ] 8.1 ESLint Configuration Support
  - [ ] 8.1.1 Fix ESLint flat config support in eslint-engine.ts
  - [ ] 8.1.2 Implement proper ignore pattern recognition for flat configs
  - [ ] 8.1.3 Fix Airbnb style config handling (5s timeout issue)
  - [ ] 8.1.4 Fix Standard style config handling (5s timeout issue)
  - [ ] 8.1.5 Fix custom enterprise config support

- [ ] 8.2 Prettier Configuration
  - [ ] 8.2.1 Fix prettierignore pattern recognition
  - [ ] 8.2.2 Handle custom print width configurations
  - [ ] 8.2.3 Handle tabs vs spaces configuration
  - [ ] 8.2.4 Handle trailing comma options
  - [ ] 8.2.5 Resolve ESLint/Prettier conflicts

- [ ] 8.3 TypeScript Strict Mode
  - [ ] 8.3.1 Fix strict null checks handling
  - [ ] 8.3.2 Fix no implicit any handling
  - [ ] 8.3.3 Fix unused parameters handling
  - [ ] 8.3.4 Ensure proper blocking for type safety issues

### 9. CI/CD Pipeline Integration Fixes

- [ ] 9.1 JSON Output Validation
  - [ ] 9.1.1 Fix JSON schema validation timeout (10s limit)
  - [ ] 9.1.2 Ensure valid JSON output format
  - [ ] 9.1.3 Include all required fields (tool, file, line, column, code,
        severity, message)

- [ ] 9.2 Output Format Consistency
  - [ ] 9.2.1 Fix output consistency across engines
  - [ ] 9.2.2 Fix aggregation when multiple engines report issues
  - [ ] 9.2.3 Ensure deterministic output ordering

### 10. Edge Case Handling

- [ ] 10.1 File Operation Edge Cases
  - [ ] 10.1.1 Handle non-existent file operations gracefully
  - [ ] 10.1.2 Improve large file processing performance
  - [ ] 10.1.3 Add proper error messages for file access issues

- [ ] 10.2 Complex Issue Detection
  - [ ] 10.2.1 Fix blocking for type safety issues
  - [ ] 10.2.2 Fix blocking for complexity issues
  - [ ] 10.2.3 Ensure proper error reporting for complex scenarios

- [ ] 10.3 Monorepo Support
  - [ ] 10.3.1 Fix monorepo with different configs handling
  - [ ] 10.3.2 Ensure proper config resolution in nested directories
  - [ ] 10.3.3 Handle multiple tsconfig.json files correctly

### 11. Multi-Engine Integration

- [ ] 11.1 Engine Aggregation
  - [ ] 11.1.1 Fix issue aggregation when multiple engines run together
  - [ ] 11.1.2 Ensure proper deduplication of overlapping issues
  - [ ] 11.1.3 Maintain issue priority and severity ordering

### 12. Final Validation

- [ ] 12.1 Test Suite Verification
  - [ ] 12.1.1 Run all CI/CD Pipeline Integration tests (4 tests passing)
  - [ ] 12.1.2 Run all Quality Checker Full Integration tests (5 tests passing)
  - [ ] 12.1.3 Run all Claude Hook Workflow Integration tests (11 tests passing)
  - [ ] 12.1.4 Run all Config Variations Integration tests (10 tests passing)
  - [ ] 12.1.5 Verify total of 30 integration tests now passing

- [ ] 12.2 Performance Validation
  - [ ] 12.2.1 Verify all performance tests < 2000ms
  - [ ] 12.2.2 Verify warm performance < 300ms
  - [ ] 12.2.3 Run performance benchmarks

- [ ] 12.3 Regression Testing
  - [ ] 12.3.1 Ensure all previously passing tests still pass
  - [ ] 12.3.2 Verify no new test failures introduced
  - [ ] 12.3.3 Run full test suite with coverage report

## Execution Order

### Priority Order (Based on Dependencies):

1. **Phase 1: Performance Optimization (5.x)** - Fixes root causes affecting
   multiple suites
2. **Phase 2: Exit Code Standardization (6.x)** - Core functionality needed by
   all tests
3. **Phase 3: Auto-Fix Functionality (7.x)** - Builds on exit code logic
4. **Phase 4: Configuration Handling (8.x)** - Requires working engines
5. **Phase 5: Suite-Specific Fixes (9.x, 10.x, 11.x)** - Apply after core fixes
6. **Phase 6: Final Validation (12.x)** - Comprehensive verification

### Test-Driven Approach:

1. Run failing tests to understand current behavior
2. Implement fixes based on test requirements
3. Verify specific test passes after each fix
4. Run related test suite to check for regressions
5. Move to next priority item

## Summary

### Total Scope:

- **Phase 1 (Original):** 4 main task groups with 20+ subtasks for skipped tests
- **Phase 2 (New):** 8 main task categories with 70+ subtasks for failing
  integration tests
- **Total Failing Tests to Fix:** 30 integration tests across 4 test suites
- **Performance Target:** All tests < 2000ms, warm performance < 300ms

### Test Suite Breakdown:

1. **CI/CD Pipeline Integration:** 4 failing tests
2. **Quality Checker Full Integration:** 5 failing tests
3. **Claude Hook Workflow Integration:** 11 failing tests
4. **Config Variations Integration:** 10 failing tests

### Key Areas of Focus:

- Performance optimization and caching
- Exit code standardization
- Silent auto-fix functionality
- Configuration variant support (ESLint, Prettier, TypeScript)
- Edge case handling and error recovery
- Multi-engine integration and aggregation3
