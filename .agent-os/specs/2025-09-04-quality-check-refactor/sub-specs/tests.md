# Tests Specification

This is the tests coverage details for the spec detailed in
@.agent-os/specs/2025-09-04-quality-check-refactor/spec.md

> Created: 2025-09-04 Version: 1.0.0

## Test Coverage

### Unit Tests

**QualityChecker Core**

- Correctly identifies ESLint errors in TypeScript files
- Correctly identifies Prettier formatting issues
- Correctly identifies TypeScript compilation errors
- Returns structured results with file paths and line numbers
- Applies fixes when fix option is enabled
- Preserves file content when no fixes needed

**Autopilot Adapter**

- Classifies Prettier errors as 'safe'
- Classifies critical TypeScript errors as 'critical'
- Classifies unknown rules as 'needs-review'
- Only fixes errors classified as 'safe'
- Returns count of fixed vs unfixed issues
- Maintains list of safe rules correctly

**Facade Tests**

**CLI Facade**

- Parses command line arguments correctly
- Exits with code 1 when errors found without --fix
- Exits with code 0 when --fix resolves all issues
- Outputs formatted errors to stderr
- Outputs success messages to stdout

**Hook Facade**

- Reads payload from stdin
- Returns valid JSON response
- Handles empty file operations gracefully
- Applies autopilot for appropriate operations
- Preserves original content for non-fixable issues

**Pre-commit Facade**

- Checks only staged files
- Returns non-zero exit code for errors
- Applies fixes to staged files when --fix enabled
- Handles partial staging correctly

**API Facade**

- Returns CheckResult object with proper types
- Accepts options parameter for configuration
- Throws typed errors for invalid inputs
- Supports both check and fix operations

### Integration Tests

**End-to-End Quality Checking**

- Full flow from CLI invocation to error output works correctly
- Hook facade processes Claude tool operations successfully
- Pre-commit prevents commits with errors
- API facade integrates with programmatic consumers

**Cross-Facade Consistency**

- All facades return same results for same input files
- Fix behavior is consistent across all entry points
- Error formatting matches expected output format

### Performance Tests

**Processing Speed**

- Processes single file in <500ms
- Processes 10 files in <2s
- Autopilot classification adds <100ms overhead
- Memory usage stays under 50MB for typical operations

### Mocking Requirements

- **File System:** Mock file reads/writes for unit tests, use real files for
  integration tests
- **ESLint/Prettier/TypeScript:** Use real tools in integration tests, mock for
  unit tests focusing on logic
- **Process Exit:** Mock process.exit in CLI tests to verify exit codes
- **Console Output:** Capture stdout/stderr for validation in CLI tests

## Test Execution Strategy

1. **Unit Tests First:** Test each component in isolation with mocked
   dependencies
2. **Integration Tests:** Test facades with real quality tools but controlled
   file fixtures
3. **Performance Tests:** Measure with realistic file sets from actual codebase
4. **Regression Tests:** Ensure existing functionality from old package still
   works

## Test Files Structure

```
packages/quality-check/
├── tests/
│   ├── unit/
│   │   ├── core/
│   │   │   └── quality-checker.test.ts
│   │   ├── adapters/
│   │   │   └── autopilot.test.ts
│   │   └── facades/
│   │       ├── cli.test.ts
│   │       ├── hook.test.ts
│   │       ├── pre-commit.test.ts
│   │       └── api.test.ts
│   ├── integration/
│   │   ├── end-to-end.test.ts
│   │   └── cross-facade.test.ts
│   ├── performance/
│   │   └── speed.test.ts
│   └── fixtures/
│       ├── valid-code.ts
│       ├── eslint-errors.ts
│       ├── prettier-errors.ts
│       └── typescript-errors.ts
```

## Coverage Goals

- **Unit Test Coverage:** 90%+ for all core logic
- **Integration Coverage:** All primary use cases covered
- **Performance Benchmarks:** Establish baselines for regression detection
- **Overall Coverage:** 85%+ across entire package
