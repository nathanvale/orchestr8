# Task 013 Analysis: Implement Single Authoritative Mock Factory

## Executive Summary

The current CLI mocking implementation suffers from fundamental timing issues
due to runtime patching that's incompatible with vi.mock hoisting. The solution
is to create a single authoritative mock factory that generates all mocks at
declaration time.

## Current Implementation Analysis

### Core Files

1. **packages/testkit/src/cli/process-mock.ts** (lines 1-531)
   - Main ProcessMocker class with runtime patching logic
   - Global delegate installation at lines 412-421
   - Runtime patching methods at lines 427-515

2. **packages/testkit/src/cli/spawn.ts** (lines 1-253)
   - SpawnMocker wrapper class
   - quickMocks function at line 236 (only registers spawn, not exec/execSync)
   - Utilities for mock registration

3. **packages/testkit/src/register.ts** (lines 1-30)
   - Simple side-effect imports
   - No vi.mock declarations currently

### Test Files Using CLI Mocks

- packages/testkit/src/cli/**tests**/spawn.test.ts
- packages/testkit/src/cli/**tests**/process-mock.test.ts
- packages/testkit/src/cli/**tests**/mock.test.ts

## Identified Problems

### 1. Timing-Dependent Mock Installation

**Location**: packages/testkit/src/cli/process-mock.ts:412-421

```typescript
if (
  !vi.isMockFunction(childProcess.spawn) &&
  !vi.isMockFunction(childProcess.exec)
) {
  const delegate = new ProcessMockGlobalDelegate()
  // @ts-expect-error - Private method
  delegate._installGlobalMocks()
  globalProcessMockInstalled = true
}
```

**Issue**: Guard flag can lock in "not installed" state if evaluated before
vi.mock applies

### 2. Runtime Patching After Module Import

**Location**: packages/testkit/src/cli/process-mock.ts:427-515

```typescript
private _installGlobalMocks() {
  const cp = childProcess as any
  cp.spawn = this.spawn.bind(this)
  cp.fork = this.fork.bind(this)
  // ... more patching
}
```

**Issue**: Modules already imported before patching occurs

### 3. Dual Setup Paths

- Global delegate installation (automatic)
- ProcessMocker.activate() (manual) **Issue**: Confusing and unreliable, causes
  inconsistent behavior

### 4. Module Resolution Mismatch

- Tests use vi.mock('node:child_process')
- ProcessMocker imports from 'child_process' **Issue**: Different module
  specifiers can resolve differently

## Affected Components

### Direct Dependencies

- All test files in packages/testkit/src/cli/**tests**/
- Any consumer packages using testkit CLI mocking

### Method Usage Analysis

From test examination:

- spawn: Used extensively
- exec/execSync: Used but currently broken (undefined returns)
- fork: Used occasionally
- execFile/execFileSync: Not currently tested but should be supported

## Recommended Solution

### 1. Create Mock Factory

```typescript
// packages/testkit/src/cli/mock-factory.ts
export function createChildProcessMock() {
  const registry = getProcessMockRegistry()

  return {
    spawn: vi.fn((command, args, options) =>
      registry.spawn(command, args, options),
    ),
    exec: vi.fn((command, options, callback) =>
      registry.exec(command, options, callback),
    ),
    execSync: vi.fn((command, options) => registry.execSync(command, options)),
    fork: vi.fn((modulePath, args, options) =>
      registry.fork(modulePath, args, options),
    ),
    execFile: vi.fn((...args) => registry.execFile(...args)),
    execFileSync: vi.fn((...args) => registry.execFileSync(...args)),
  }
}
```

### 2. Use in vi.mock Declaration

```typescript
// packages/testkit/src/setup.ts
import { createChildProcessMock } from './cli/mock-factory'

vi.mock('child_process', () => createChildProcessMock())
vi.mock('node:child_process', () => createChildProcessMock())
```

### 3. Registry Pattern

- Keep ProcessMocker for behavior registration
- Factory pulls from registry at call time (not creation time)
- No runtime patching needed

## Implementation Steps

1. Create mock-factory.ts with factory function
2. Refactor ProcessMocker to be a pure registry (no patching)
3. Update register.ts or create setup.ts with vi.mock declarations
4. Update vitest.config.ts to use setup file
5. Update tests to remove manual activation calls
6. Test with both module specifiers

## Key Considerations

### TypeScript Types

- Factory must return properly typed module
- Registry API needs clear types for registration
- Consumer code should get full IntelliSense

### Error Handling

- Clear messages when no mock matches
- Include command/args in error for debugging
- Suggest registration code when missing

### Backward Compatibility

- Consider migration path for existing tests
- Possibly support both patterns temporarily with deprecation warning

## Risks and Mitigation

| Risk                          | Impact | Mitigation                                                |
| ----------------------------- | ------ | --------------------------------------------------------- |
| Breaking existing tests       | High   | Provide migration guide and temporary compatibility layer |
| Type inference issues         | Medium | Extensive TypeScript testing, explicit return types       |
| Module resolution differences | Medium | Test both specifiers thoroughly                           |
| Registry timing issues        | Low    | Initialize registry in module scope, not lazily           |

## Success Metrics

- All tests pass consistently in both Vitest and Wallaby
- No timing-related failures
- exec/execSync return proper values (not undefined)
- TypeScript types work correctly
- Both 'child_process' and 'node:child_process' work identically

## Conclusion

The current runtime patching approach is fundamentally incompatible with vi.mock
hoisting. A factory-based approach that creates all mocks at declaration time
will eliminate timing issues and provide reliable, consistent behavior across
all test environments.
