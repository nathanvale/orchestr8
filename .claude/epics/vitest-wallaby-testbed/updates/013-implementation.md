# Task 013 Implementation: Single Authoritative Mock Factory

## Completed: 2025-09-21

### Summary
Successfully implemented a single authoritative mock factory for child_process mocking that creates mocks at declaration time rather than runtime. This solves the fundamental incompatibility with vi.mock hoisting that was causing intermittent test failures.

## What Was Done

### 1. Created Mock Factory (`packages/testkit/src/cli/mock-factory.ts`)
- Implemented `createChildProcessMock()` factory function that returns a complete mocked module
- Factory creates all mock functions at declaration time, not runtime
- Uses a global registry for mock configuration that's accessed at call time
- Supports all child_process methods: spawn, exec, execSync, fork, execFile, execFileSync
- Provides helpful warning messages when no mock is registered for a command

### 2. Refactored ProcessMocker (`packages/testkit/src/cli/process-mock.ts`)
- Converted from runtime patching to pure registry pattern
- Removed all global delegate installation and runtime patching logic
- ProcessMocker now only manages mock registration, not installation
- Kept backward compatibility with deprecated `setupChildProcessMocks` function
- All mocker methods now interact with the global registry from mock-factory

### 3. Created Setup File (`packages/testkit/src/setup.ts`)
- Uses vi.mock declarations with factory function for both module specifiers
- Mocks both `'child_process'` and `'node:child_process'` at declaration time
- Exports convenience functions for test usage

### 4. Updated Configuration (`packages/testkit/vitest.config.ts`)
- Added `setup.ts` to setupFiles array
- Ensures mocks are created before any test code runs

### 5. Updated Tests
- Removed manual vi.mock calls from test files
- Removed calls to deprecated `setupChildProcessMocks`
- Created comprehensive factory pattern tests (`factory-test.ts`)
- Verified both module specifiers work correctly

## Key Architecture Changes

### Before (Runtime Patching)
```typescript
// Problems:
// - Guard flags could lock in "not installed" state
// - Runtime patching after module import
// - Timing-sensitive global installation
if (!vi.isMockFunction(cp.spawn)) {
  delegate._installGlobalMocks() // Too late!
}
```

### After (Factory Pattern)
```typescript
// Solution:
// - Mocks created at declaration time
// - No runtime patching needed
// - Guaranteed to work with vi.mock hoisting
vi.mock('child_process', () => createChildProcessMock())
vi.mock('node:child_process', () => createChildProcessMock())
```

## Testing & Validation

### Test Coverage
- Created comprehensive test suite in `factory-test.ts`
- Tests both `child_process` and `node:child_process` imports
- Validates registry sharing between module specifiers
- Tests all method types (spawn, exec, execSync, fork, execFile, execFileSync)
- Verifies error handling and async behavior

### Key Test Scenarios
1. ✅ Both module specifiers work identically
2. ✅ Registry is shared between specifiers
3. ✅ Regex patterns work for command matching
4. ✅ Error simulation works correctly
5. ✅ Async callbacks execute properly
6. ✅ Mock configuration is found correctly

## Benefits Achieved

1. **Reliability**: No more timing-related failures or undefined returns
2. **Simplicity**: Single source of truth for mock creation
3. **Compatibility**: Works with vi.mock hoisting and ESM modules
4. **Type Safety**: Full TypeScript types preserved
5. **Developer Experience**: Clear error messages when mocks not registered
6. **Backward Compatibility**: Existing tests continue to work

## Files Modified

### New Files
- `packages/testkit/src/cli/mock-factory.ts` (288 lines)
- `packages/testkit/src/setup.ts` (16 lines)
- `packages/testkit/src/cli/__tests__/factory-test.ts` (185 lines)

### Modified Files
- `packages/testkit/src/cli/process-mock.ts` (refactored to 436 lines)
- `packages/testkit/vitest.config.ts` (added setup.ts)
- `packages/testkit/src/cli/__tests__/spawn.test.ts` (removed manual mocking)

## Migration Guide for Tests

### Old Pattern (Remove)
```typescript
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
  // ...
}))

import * as cp from 'child_process'
setupChildProcessMocks(cp) // Deprecated
```

### New Pattern (Use)
```typescript
// Just import and use - mocking is handled by setup.ts
import * as cp from 'child_process'
import { getGlobalProcessMocker } from '../process-mock.js'

const mocker = getGlobalProcessMocker()
mocker.registerSpawn('command', { stdout: 'output' })
```

## Next Steps

With Task 013 complete, the CLI mocking architecture is now:
- ✅ Reliable and consistent across environments
- ✅ Compatible with vi.mock hoisting
- ✅ Supporting both module specifiers
- ✅ Free from timing-related issues

The foundation is ready for Tasks 014-016 which will build on this pattern for:
- Task 014: Enforce import order with bootstrap
- Task 015: Align CLI helper semantics
- Task 016: Unify runner configuration