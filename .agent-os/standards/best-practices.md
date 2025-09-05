# Development Best Practices

## Context

Global development guidelines for Agent OS projects.

<conditional-block context-check="core-principles">
IF this Core Principles section already read in current context:
  SKIP: Re-reading this section
  NOTE: "Using Core Principles already in context"
ELSE:
  READ: The following principles

## Core Principles

### Keep It Simple

- Implement code in the fewest lines possible
- Avoid over-engineering solutions
- Choose straightforward approaches over clever ones

### Optimize for Readability

- Prioritize code clarity over micro-optimizations
- Write self-documenting code with clear variable names
- Add comments for "why" not "what"

### DRY (Don't Repeat Yourself)

- Extract repeated business logic to private methods
- Extract repeated UI markup to reusable components
- Create utility functions for common operations

### File Structure

- Keep files focused on a single responsibility
- Group related functionality together
- Use consistent naming conventions

### Wallaby MCP Server Status Handling

#### Scope: Unit Tests Only

**IMPORTANT**: Wallaby MCP tools are ONLY for `.unit.test.ts` files.

- For integration tests (`*.integration.test.ts`): Use `pnpm test` or `vitest`
- For E2E tests (`*.e2e.test.ts`): Use `pnpm test` or `vitest`
- For other test types: Use appropriate vitest commands

#### Stop Work Protocol (Unit Tests Only)

When working with `.unit.test.ts` files and Wallaby MCP tools return
`<No data available>` or empty responses:

1. **IMMEDIATE ACTION REQUIRED**:
   - STOP all unit testing activities immediately
   - Do NOT attempt workarounds with direct test commands
   - Do NOT continue with unit test implementation

2. **User Notification (One-Time Only)**: ⚠️ Wallaby server appears to be
   inactive or not configured for this project.

   Please ensure:

3. Wallaby server is running (check VS Code status bar)
4. The project is configured with wallaby.js config file
5. Tests have been run at least once to populate Wallaby's cache

   I'll wait for you to confirm Wallaby is ready before proceeding.

6. **After Notification**:

- HALT all operations
- WAIT for explicit user confirmation
- Do NOT repeatedly check or mention Wallaby status
- Do NOT suggest alternative testing methods

### General Wallaby MCP Usage Patterns

#### Test Tool Decision Tree

```
Is this a .unit.test.ts file?
  ├─ YES → Use Wallaby MCP tools
  │   └─ wallaby_allTestsForFile()
  │   └─ wallaby_failingTestsForFile()
  │   └─ wallaby_runtimeValues()
  └─ NO → Use vitest/pnpm test
      └─ *.integration.test.ts → pnpm test
      └─ *.e2e.test.ts → pnpm test
      └─ *.slow.test.ts → pnpm test
```

#### 1. Test Discovery Workflow (Unit Tests Only)

**For `.unit.test.ts` files, ALWAYS follow this sequence:**

```typescript
// Step 1: Check if Wallaby can see the test file
const allTests = await wallaby_allTestsForFile(absolutePath)
if (!allTests) return HALT_AND_NOTIFY

// Step 2: Identify failing tests first (most important)
const failingTests = await wallaby_failingTestsForFile(absolutePath)

// Step 3: If failures exist, get runtime values for debugging
if (failingTests.length > 0) {
  const runtimeData = await wallaby_runtimeValues({
    file: absolutePath,
    line: failingTest.line,
    lineContent: exactLineContent,
    expression: variableName,
  })
}
```

#### 2. Path Resolution Rules

**Wallaby expects different path formats depending on context:**

```typescript
// For test files - use absolute paths
wallaby_allTestsForFile({
  file: '/Users/name/project/src/component.test.ts', // ABSOLUTE
})

// For runtime values - may need relative from project root
wallaby_runtimeValues({
  file: 'src/component.ts', // Try relative first
  // fallback to: "/Users/name/project/src/component.ts"
})

// For coverage - try both formats
wallaby_coveredLinesForFile({
  file: 'src/component.ts', // Relative from project root
})
```

#### 3. Runtime Value Debugging Best Practices

**DO: Use stable variable bindings**

```typescript
// GOOD: Create a stable binding point
const result = someFunction() // Line 42
const output = result.data // Line 43

// Query line 43 for 'output'
wallaby_runtimeValues({
  line: 43,
  expression: 'output',
})
```

**DON'T: Try to capture inline expressions**

```typescript
// BAD: No stable reference
return someFunction().data.map((x) => x.id) // Hard to capture

// Query won't work reliably
wallaby_runtimeValues({
  expression: 'someFunction().data', // Unstable
})
```

#### 4. Test Iteration Workflow

**Optimal workflow for fixing failing tests:**

1. **Identify the failure**

```typescript
const failing = await wallaby_failingTestsForFile(testFile)
// Returns: [{name, line, error, testId}]
```

2. **Capture runtime state at failure point**

```typescript
const values = await wallaby_runtimeValuesByTest({
  testId: failing[0].testId,
  file: sourceFile,
  line: errorLine,
  expression: 'variableName',
})
```

3. Fix the issue
   - Make code changes

4. Verify fix immediately

```typescript
// Wallaby auto-reruns, so just check:
const stillFailing = await wallaby_failingTestsForFile(testFile)
if (stillFailing.length === 0) {
  // Success! Test is now passing
}
```

5. Coverage Analysis Workflow

Use coverage data to ensure test completeness:

```
  // Check what lines are covered by tests
  const coverage = await wallaby_coveredLinesForFile({
    file: "src/module.ts"
  })

  // Check coverage for specific test
  const testCoverage = await wallaby_coveredLinesForTest({
    testId: "test-123",
    file: "src/module.ts"  // Optional: specific file
  })

  // Use this to identify untested code paths
  if (coverage.percentage < 80) {
    // Identify uncovered lines and add tests
  }
```

6. Smart Test Selection

When multiple tests fail, prioritize strategically:

```
  const allFailing = await wallaby_failingTests() // Project-wide

  // Group by error type
  const byErrorType = allFailing.reduce((acc, test) => {
    const errorType = test.error.match(/TypeError|ReferenceError|AssertionError/)?.[0]
    acc[errorType] = acc[errorType] || []
    acc[errorType].push(test)
    return acc
  }, {})

  // Fix same-type errors together (often same root cause)
```

7. Performance Optimization Tips

Wallaby MCP calls are fast but not free:

```
  // GOOD: Batch related checks
  const [allTests, failingTests, coverage] = await Promise.all([
    wallaby_allTestsForFile(file),
    wallaby_failingTestsForFile(file),
    wallaby_coveredLinesForFile(file)
  ])

  // BAD: Sequential unnecessary calls
  const test1 = await wallaby_testById(id1)
  const test2 = await wallaby_testById(id2)
  const test3 = await wallaby_testById(id3)
```

Common Pitfalls to Avoid

1. Don't assume test execution order
   - Wallaby runs tests in parallel
   - Never depend on test A running before test B

2. Don't query for runtime values in lines that don't execute
   - Check coverage first to ensure the line runs
   - Conditional code may not execute in all test scenarios

3. Don't ignore the lineContent parameter
   - This guards against stale file buffers
   - Always provide exact line content for safety

4. Don't use wallaby_updateTestSnapshots without user permission
   - Snapshot updates are irreversible
   - Always ask: "Should I update the snapshots?"

State Machine for Test Fixing

START ↓ CHECK_WALLABY_ACTIVE ↓ [Inactive] → NOTIFY_USER → HALT ↓ [Active] →
DISCOVER_FAILING_TESTS ↓ [No Failures] → REPORT_SUCCESS → END ↓ [Has Failures] →
ANALYZE_FIRST_FAILURE ↓ GET_RUNTIME_VALUES ↓ IMPLEMENT_FIX ↓
VERIFY_FIX_WITH_WALLABY ↓ [Still Failing] → ANALYZE_DEEPER ↓ [Fixed] →
NEXT_FAILURE or END

Response Templates

When Wallaby is working: ✅ Found 3 failing tests via Wallaby:

1. should_handle_empty_input (line 42)
2. should_validate_email_format (line 67)
3. should_timeout_after_5_seconds (line 91)

Starting with the first failure... [runtime value analysis]

When debugging with runtime values: 🔍 Wallaby runtime analysis at line 42:

- Variable 'input': undefined
- Variable 'expected': "default"
- Issue: Input is undefined but test expects string

Implementing fix...

When test is fixed: ✅ Test "should_handle_empty_input" now passing in Wallaby
Moving to next failure (2 of 3)...

## Testing Conventions

### Test Tool Selection by Test Type

#### Unit Tests (\*.unit.test.ts)

- **Tool**: Wallaby.js MUST be used for all `.unit.test.ts` files
- **Rule**: Wallaby.js MUST be running before writing or debugging unit tests
- **Exception**: CI/CD environments only
- ❌ `pnpm test` for unit tests - Use Wallaby instead
- ❌ `vitest watch` for unit tests - Use Wallaby instead
- ✅ Use Wallaby MCP tools for debugging and runtime analysis

#### Integration, E2E, and Other Tests

- **Tool**: Use vitest directly for:
  - `*.integration.test.ts` files
  - `*.e2e.test.ts` files
  - `*.slow.test.ts` files
  - Any other test files not ending in `.unit.test.ts`
- **Commands**:
  - ✅ `pnpm test` for running integration/e2e tests
  - ✅ `vitest` for non-unit test files
  - ✅ Direct test execution commands
- **Note**: Wallaby MCP tools will NOT work for these test types

### Test File Naming Rules

#### Unit Tests

- **Pattern**: `[ComponentName].unit.test.ts`
- **Location**: Colocated with source files
- **Examples**:
- ✅ `UserService.unit.test.ts`
- ✅ `parseConfig.unit.test.ts`
- ❌ `UserService.test.ts` (missing type suffix)
- ❌ `UserService.spec.ts` (wrong type suffix)

#### Integration Tests

- **Pattern**: `[FeatureName].integration.test.ts`
- **Location**: Root `tests/` directory
- **Examples**:
- ✅ `auth-flow.integration.test.ts`
- ✅ `api-endpoints.integration.test.ts`
- ❌ `src/auth.integration.test.ts` (wrong location)

#### E2E Tests

- **Pattern**: `[UserFlow].e2e.test.ts`
- **Location**: Root `tests/` directory
- **Examples**:
- ✅ `checkout-process.e2e.test.ts`
- ✅ `user-onboarding.e2e.test.ts`

#### Slow Tests

- **Pattern**: `[FeatureName].slow.test.ts`
- **Location**: Root `tests/` directory
- **Note**: For tests that exceed 500ms but are necessary

### Test Method Naming Rules

#### Pattern

`should_[expectedBehavior]_when_[condition]`

#### Examples

- `should_return_user_data_when_valid_id_provided`
- `should_throw_error_when_user_not_found`

#### Anti-patterns (Forbidden)

- ❌ `test user data` - No behavior description
- ❌ `it works` - Too vague
- ❌ `shouldReturnUser` - Uses camelCase
- ❌ `should_return_user` - Missing when clause

</conditional-block>

<conditional-block context-check="dependencies" task-condition="choosing-external-library">
IF current task involves choosing an external library:
  IF Dependencies section already read in current context:
    SKIP: Re-reading this section
    NOTE: "Using Dependencies guidelines already in context"
  ELSE:
    READ: The following guidelines
ELSE:
  SKIP: Dependencies section not relevant to current task

## Dependencies

### Choose Libraries Wisely

When adding third-party dependencies:

- Select the most popular and actively maintained option
- Check the library's GitHub repository for:
  - Recent commits (within last 6 months)
  - Active issue resolution
  - Number of stars/downloads
  - Clear documentation </conditional-block>
