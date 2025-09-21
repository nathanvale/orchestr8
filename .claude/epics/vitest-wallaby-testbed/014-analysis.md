# Task 014 Analysis: Enforce Import Order with Bootstrap

## Executive Summary

The current test setup lacks centralized initialization, leading to fragile
import ordering and timing-sensitive failures. A bootstrap module will
consolidate all vi.mock declarations and registry initialization, ensuring
consistent behavior across all test environments.

## Current Implementation Analysis

### Core Files

1. **packages/testkit/src/register.ts** (lines 1-30)
   - Simple side-effect imports for env utilities
   - No vi.mock declarations
   - No initialization validation
   - Just imports: './env/fake-time', './env/random', './env/temp-dir'

2. **packages/testkit/vitest.config.ts** (lines 1-38)
   - Uses setupFiles: ['./src/register.ts']
   - Environment: 'happy-dom'
   - Different from root config (node environment)

3. **packages/testkit/src/index.ts** (lines 1-41)
   - Exports utilities but no bootstrap
   - No side-effect imports
   - Pure export module

### Test Import Patterns

**packages/testkit/src/cli/**tests**/spawn.test.ts** (lines 1-15)

```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
vi.mock('node:child_process')
import { quickMocks, spawnMock } from '../spawn'
import { MockChildProcess } from '../process-mock'
import childProcess from 'node:child_process'
```

- vi.mock declaration at line 2 (after vitest imports)
- Module imports at lines 4-6 (after vi.mock)
- Manual ordering required

**packages/testkit/src/cli/**tests**/process-mock.test.ts** (lines 1-8)

```typescript
import { vi, describe, it, expect } from 'vitest'
vi.mock('node:child_process')
import { ProcessMocker, ProcessMockGlobalDelegate } from '../process-mock'
import * as childProcess from 'node:child_process'
```

- Same pattern: vi.mock at line 2
- Imports after mock declaration

**packages/testkit/src/cli/**tests**/mock.test.ts** (lines 1-6)

```typescript
import { describe, it, expect, vi } from 'vitest'
vi.mock('node:child_process')
import { spawnSync } from 'node:child_process'
import { spawnMock } from '../spawn'
```

- Consistent pattern across all test files

## Configuration Analysis

### Vitest Configs

1. **Root vitest.config.ts** (not shown in files but referenced)
   - Environment: 'node'
   - No setupFiles for testkit

2. **packages/testkit/vitest.config.ts**
   - Environment: 'happy-dom'
   - setupFiles: ['./src/register.ts']
   - Different configuration from root

### Wallaby Configuration

- Uses root vitest.config.ts (per epic.md line 119)
- Doesn't load package-level setupFiles
- Results in different initialization paths

## Identified Problems

### 1. Manual Mock Declaration Management

**Issue**: Each test file must manually declare vi.mock in the correct order
**Impact**: Error-prone, repetitive, easy to get wrong

### 2. No Initialization Validation

**Issue**: No way to detect if mocks are properly initialized **Impact**: Silent
failures, undefined behavior

### 3. Environment Configuration Drift

**Issue**: Different configs for Vitest vs Wallaby **Impact**: Tests behave
differently in different runners

### 4. Race Conditions

**Issue**: Import order sensitivity with vi.mock hoisting **Impact**:
Intermittent failures, hard to debug

### 5. No Central Control

**Issue**: Mock setup scattered across test files **Impact**: Hard to maintain,
update, or debug

## Recommended Bootstrap Architecture

### 1. Create Bootstrap Module

```typescript
// packages/testkit/src/bootstrap.ts

// Step 1: Import mock factory (from Task 013)
import { createChildProcessMock } from './cli/mock-factory'
import { initializeProcessRegistry } from './cli/process-registry'

// Step 2: Declare all vi.mock calls
vi.mock('child_process', () => createChildProcessMock())
vi.mock('node:child_process', () => createChildProcessMock())
vi.mock('fs', () => createFsMock())
vi.mock('node:fs', () => createFsMock())

// Step 3: Initialize registries
initializeProcessRegistry()
initializeFsRegistry()
initializeTimeRegistry()
initializeRandomRegistry()

// Step 4: Validation
if (!globalThis.__TESTKIT_BOOTSTRAP_LOADED) {
  globalThis.__TESTKIT_BOOTSTRAP_LOADED = true
} else {
  throw new Error('Bootstrap loaded multiple times - check import order')
}

// Step 5: Export initialization status
export const isBootstrapLoaded = () => globalThis.__TESTKIT_BOOTSTRAP_LOADED
```

### 2. Update Register Module

```typescript
// packages/testkit/src/register.ts
import './bootstrap' // First import - critical!
import './env/fake-time'
import './env/random'
import './env/temp-dir'
```

### 3. Test File Template

```typescript
// New test file pattern
import { describe, it, expect } from 'vitest'
import { spawnMock } from '@template/testkit'
// No vi.mock needed - handled by bootstrap!
```

## Migration Strategy

### Phase 1: Create Bootstrap

1. Implement bootstrap.ts with all vi.mock declarations
2. Update register.ts to import bootstrap first
3. Test with one test file

### Phase 2: Update Test Files

1. Remove vi.mock declarations from test files
2. Update imports to rely on bootstrap
3. Run tests to verify

### Phase 3: Documentation

1. Create test templates
2. Document bootstrap pattern
3. Add migration guide

### Phase 4: Enforcement

1. Add lint rule to prevent vi.mock in test files
2. Add initialization check in test utilities
3. Clear error messages for violations

## Error Detection and Reporting

### Initialization Errors

```typescript
export function requireBootstrap() {
  if (!globalThis.__TESTKIT_BOOTSTRAP_LOADED) {
    throw new Error(
      'Testkit bootstrap not loaded!\n' +
        'Ensure your test imports from @template/testkit\n' +
        'or that vitest.config.ts includes setupFiles: ["./src/register.ts"]',
    )
  }
}
```

### Import Order Validation

```typescript
export function validateImportOrder() {
  const stack = new Error().stack
  if (stack?.includes('node_modules/vitest')) {
    console.warn('Bootstrap may have loaded after vitest - check setupFiles')
  }
}
```

## Implementation Steps

1. **Create bootstrap.ts** with all mock declarations
2. **Update register.ts** to import bootstrap first
3. **Add validation utilities** for error detection
4. **Update one test file** as proof of concept
5. **Document pattern** with examples
6. **Migrate remaining tests** incrementally
7. **Add lint rules** to enforce pattern

## Key Considerations

### TypeScript Support

- Bootstrap must preserve types
- Exports should be properly typed
- IntelliSense should work seamlessly

### Environment Compatibility

- Must work in both Vitest and Wallaby
- Handle both 'node' and 'happy-dom' environments
- Support different module resolution strategies

### Developer Experience

- Clear error messages
- Obvious migration path
- Minimal changes to test files

## Risks and Mitigation

| Risk                             | Impact | Mitigation                         |
| -------------------------------- | ------ | ---------------------------------- |
| Bootstrap loading multiple times | High   | Global flag validation             |
| Import order still wrong         | High   | Clear documentation and lint rules |
| Wallaby incompatibility          | Medium | Test extensively with Wallaby      |
| TypeScript issues                | Medium | Careful type preservation          |
| Migration complexity             | Low    | Incremental migration, clear docs  |

## Success Metrics

- All tests pass without manual vi.mock declarations
- Consistent behavior across Vitest and Wallaby
- No timing-sensitive failures
- Clear error messages for misconfiguration
- Reduced boilerplate in test files

## Conclusion

A centralized bootstrap module will eliminate import order issues by ensuring
all mock declarations and initialization happen before any test code runs. This
will make tests more reliable, easier to write, and consistent across all
environments.
