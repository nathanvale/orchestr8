# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-08-test-infrastructure-fix/spec.md

## Technical Requirements

### 1. Test Environment Isolation

- **Environment Variable Control**: Implement `CLAUDE_HOOK_DISABLED=true`
  environment variable that completely bypasses hook execution in test
  environments
- **Process Mock Management**: Replace all `process.exit` calls with controlled
  mocks that don't throw errors
- **Stdin/Stdout Isolation**: Properly mock stdin, stdout, and stderr to prevent
  interference between tests
- **Test Helper Creation**: Create `test-utils/test-environment.ts` with
  standard test setup/teardown functions

### 2. Mock Infrastructure Implementation

- **Quality Checker Mock**: Create `MockQualityChecker` class that returns
  predictable results
- **File System Mock**: Implement in-memory file system using Map<string,
  string> for test files
- **Configuration Mock**: Create mock configuration loaders that return test
  fixtures
- **Execution Context Mock**: Mock the entire Claude hook execution context
  including payload parsing

### 3. Configuration Loading Fixes

- **ESLint Flat Config Support**: Fix detection logic for `eslint.config.js` vs
  `.eslintrc.json`
- **Test Fixture Loading**: Ensure all config files are loaded from test
  fixtures, not filesystem
- **Prettier Config Handling**: Fix prettierignore and prettier config loading
  in tests
- **TypeScript Config**: Properly load tsconfig.json from test fixtures

### 4. Test Assertion Updates

- **Output Expectations**: Update all assertions expecting empty output to
  handle actual error messages
- **Exit Code Validation**: Fix exit code assertions to match actual behavior (0
  for success, 1 for issues)
- **Error Message Handling**: Create assertion helpers that validate error
  message content
- **Async Handling**: Ensure all async operations are properly awaited in tests

### 5. Performance Optimizations

- **Direct API Usage**: Replace all `child_process.spawn()` calls with direct
  QualityChecker API calls
- **Remove Temp Directories**: Eliminate `fs.mkdtemp()` and use in-memory file
  system
- **Cache Initialization**: Pre-initialize TypeScript and ESLint caches in test
  setup
- **Parallel Test Execution**: Ensure tests can run in parallel without
  interference

## Implementation Patterns

### Mock Factory Pattern

```typescript
// test-utils/mock-factory.ts
export function createMockEnvironment() {
  return {
    qualityChecker: new MockQualityChecker(),
    fileSystem: new InMemoryFileSystem(),
    configLoader: new MockConfigLoader(),
    stdin: new MockReadable(),
    stdout: new MockWritable(),
    stderr: new MockWritable(),
  }
}
```

### Test Setup Pattern

```typescript
// In each test file
beforeEach(() => {
  process.env.CLAUDE_HOOK_DISABLED = 'true'
  vi.clearAllMocks()
  mockEnvironment = createMockEnvironment()
})

afterEach(() => {
  delete process.env.CLAUDE_HOOK_DISABLED
  vi.restoreAllMocks()
})
```

### Direct API Pattern

```typescript
// Replace this:
const result = await spawn('quality-check', [file])

// With this:
const checker = new QualityChecker(mockConfig)
const result = await checker.check([file])
```

## Success Criteria

1. All 23 failing tests pass consistently
2. No real Claude hooks execute during tests
3. Tests complete in <100ms average
4. No temporary directories created
5. No child processes spawned
6. All mocks properly isolated between tests
7. CI/CD pipeline passes reliably
