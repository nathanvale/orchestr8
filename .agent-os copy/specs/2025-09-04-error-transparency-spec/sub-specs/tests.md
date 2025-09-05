# Tests Specification

This is the tests coverage details for the spec detailed in
@.agent-os/specs/2025-09-04-error-transparency-spec/spec.md

> Created: 2025-09-04 Version: 1.0.0

## Test Coverage

### Unit Tests

**ErrorParser**

- Parse TypeScript stderr output with various error formats
- Extract ESLint JSON errors with proper structure
- Handle malformed/unexpected tool outputs gracefully
- Test error message standardization formats
- Validate error categorization (fixable vs unfixable)

**IssueReporter Enhancement**

- Format enhanced errors for CLI output
- Format enhanced errors for Claude hook output
- Format enhanced errors for JSON API output
- Handle mixed error types (ESLint + TypeScript + Prettier)
- Test lazy parsing optimization behavior

**QualityChecker Integration**

- Verify enhanced errors don't break existing QualityChecker logic
- Test backwards compatibility with current error handling
- Validate parallel execution with enhanced error parsing
- Test error filtering for autopilot decision making

### Integration Tests

**End-to-End Error Flow**

- TypeScript file with multiple specific errors gets parsed correctly
- ESLint violations show rule names and line numbers
- Claude hook receives actionable error details instead of generic messages
- CLI shows human-readable enhanced error information

**Tool Integration**

- TypeScript compiler stderr parsing across different TS versions
- ESLint JSON output parsing with various rule configurations
- Prettier error handling enhancement
- Error parsing performance with large files (100+ errors)

**Facade-Specific Behavior**

- CLI facade displays enhanced errors with colors and formatting
- Claude facade provides structured errors for autopilot decisions
- Git hook facade shows concise blocking error messages
- API facade returns structured error objects

### Performance Tests

**Error Parsing Performance**

- Measure parsing overhead for files with varying error counts (0, 10, 50, 100+
  errors)
- Validate lazy parsing reduces overhead by target 90%
- Test memory usage increase stays within +2KB per file limit
- Benchmark total execution time increase remains <2%

**Scalability Testing**

- Test 1000+ file codebase with enhanced error parsing
- Validate concurrent error parsing doesn't degrade performance
- Test error volume limits (MAX_ERRORS_TO_PARSE = 50)

### Error Scenario Tests

**Edge Cases**

- Files with zero errors (should have no parsing overhead)
- Files with malformed TypeScript/ESLint output
- Very large error messages (multi-line TypeScript errors)
- Binary/non-text files passed to error parser
- Network/filesystem issues during tool execution

**Backwards Compatibility**

- Existing quality-check behavior preserved when enhanced parsing disabled
- Fallback to generic error messages when detailed parsing fails
- All current facade behaviors work identically with enhancement

### Mocking Requirements

**Tool Execution Mocks**

- **TypeScript compiler**: Mock `tsc --noEmit` stderr output with various error
  formats
- **ESLint**: Mock JSON output with different error types and severities
- **Command execution**: Mock execSync calls to avoid running actual tools
  during tests

**File System Mocks**

- Mock file existence checks for error parsing
- Mock file reading for error context extraction
- Simulate filesystem errors during parsing operations

## Test Data Requirements

### Sample Error Outputs

**TypeScript Error Samples**

```
tests/sample.ts(5,10): error TS2304: Cannot find name 'undefinedVariable'.
tests/sample.ts(12,3): error TS2322: Type 'number' is not assignable to type 'string'.
tests/sample.ts(18,14): error TS2741: Property 'age' is missing in type '{ name: string; }' but required in type 'User'.
```

**ESLint JSON Sample**

```json
[
  {
    "filePath": "/path/to/file.ts",
    "messages": [
      {
        "ruleId": "@typescript-eslint/no-unused-vars",
        "severity": 2,
        "message": "'unused' is assigned a value but never used.",
        "line": 5,
        "column": 7
      }
    ],
    "errorCount": 1,
    "warningCount": 0
  }
]
```

## Test Automation

### Wallaby.js Integration

- All unit tests should run instantly in Wallaby with inline feedback
- Error parsing tests should show runtime values for parsed error objects
- Performance tests should display timing information inline

### CI/CD Testing

- Automated test suite for error parsing across multiple Node.js versions
- Integration tests with various TypeScript and ESLint versions
- Performance regression testing to ensure <2% overhead maintained

## Success Criteria

- ✅ All error parsing scenarios covered with unit tests
- ✅ Integration tests verify end-to-end enhanced error flow
- ✅ Performance tests validate <2% overhead target met
- ✅ Backwards compatibility tests ensure no breaking changes
- ✅ Error scenario tests handle all edge cases gracefully
