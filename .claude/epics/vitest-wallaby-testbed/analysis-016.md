# Task 016 Analysis: Unify Runner Configuration

## Executive Summary

The monorepo has fragmented test configurations causing inconsistent behavior
between Wallaby and Vitest. The root config is minimal while testkit has
comprehensive settings, and a sophisticated base config exists but isn't
exported. The solution is to implement a Vitest workspace configuration that
provides consistent settings across all runners while allowing package-specific
overrides.

## Current Configuration Analysis

### Configuration Files Found

1. **Root vitest.config.ts** (lines 1-9)

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- Minimal configuration
- Node environment only
- No timeouts, reporters, or coverage

2. **packages/testkit/vitest.config.ts** (lines 1-38)

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['./src/register.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/vitest.config.ts',
      ],
    },
  },
})
```

- Comprehensive configuration
- Different environment (happy-dom vs node)
- Has setupFiles, timeouts, pool settings

3. **packages/testkit/src/config/vitest.base.ts** (lines 1-165)

- Sophisticated configuration system
- Environment detection (CI, Wallaby, Vitest)
- Dynamic adjustments based on environment
- **NOT EXPORTED** from testkit package
- Contains useful utilities but unused

4. **wallaby.cjs** (lines 1-44)

```javascript
module.exports = function (wallaby) {
  return {
    autoDetect: ['vitest'],
    testFramework: {
      configFile: './vitest.config.ts', // Forces root config
      ...
    },
    workers: { initial: 1, regular: 1 },
    ...
  }
}
```

- Explicitly uses root config (line 7)
- Forces single worker
- Sets 10s timeout

## Configuration Differences

### Environment Settings Comparison

| Setting     | Root      | Testkit           | Base (Unused) | Wallaby         |
| ----------- | --------- | ----------------- | ------------- | --------------- |
| Environment | node      | happy-dom         | node          | node (via root) |
| Globals     | true      | true              | false         | -               |
| SetupFiles  | none      | ./src/register.ts | -             | none (via root) |
| Timeout     | undefined | 10000ms           | 5000-10000ms  | 10000ms         |
| Pool        | undefined | threads (1-4)     | forks         | single worker   |
| Coverage    | undefined | v8 with reporters | conditional   | disabled        |

### Key Conflicts

1. **Environment Mismatch**
   - Root/Wallaby: node
   - Testkit: happy-dom
   - Impact: DOM-dependent tests fail in Wallaby

2. **SetupFiles Missing**
   - Wallaby doesn't load testkit's register.ts
   - Mocks not initialized properly
   - Causes undefined behavior

3. **Reporter Configuration**
   - No unified reporter strategy
   - CI needs junit (configured in base but unused)
   - No test-results directory configuration

4. **Timeout Inconsistencies**
   - Root has no timeouts
   - Different timeouts across environments
   - Can cause flaky test failures

## Wallaby Configuration Issues

### Current Problems

1. **Root Config Forcing**

```javascript
// wallaby.cjs line 7
configFile: './vitest.config.ts'
```

- Ignores package-level configs
- Misses critical setupFiles

2. **Worker Limitations**

```javascript
// wallaby.cjs lines 9-12
workers: {
  initial: 1,
  regular: 1,
}
```

- Forces single worker
- Conflicts with testkit's thread pool

3. **Test Pattern Differences**

```javascript
// wallaby.cjs lines 21-33
tests: [
  '!**/node_modules/**',
  '!**/dist/**',
  // Different patterns than Vitest
]
```

## Environment Detection Analysis

### Base Config Detection (Unused but Valuable)

```typescript
// packages/testkit/src/config/detect.ts lines 1-63
export function detectTestEnvironment() {
  return {
    isCI: process.env.CI === 'true',
    isWallaby: process.env.WALLABY_WORKER !== undefined,
    isVitest: process.env.VITEST === 'true',
    isJest: process.env.JEST_WORKER_ID !== undefined,
    isTurbo: process.env.TURBO_HASH !== undefined,
  }
}
```

- Comprehensive detection logic
- Not exported or used
- Should be leveraged

## Reporter Configuration Gaps

### Current State

- No junit reporter for CI
- No HTML reports for debugging
- No test-results directory
- Coverage reporters only in testkit

### Required for CI

```typescript
// Should have but doesn't
reporters: [
  'default',
  ['junit', { outputFile: './test-results/junit.xml' }],
  ['html', { outputFile: './test-results/index.html' }],
]
```

## Recommended Solution

### 1. Create Vitest Workspace Configuration

**vitest.workspace.ts** (new file at root)

```typescript
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // Default configuration for packages without config
  {
    test: {
      name: 'default',
      include: ['packages/*/src/**/*.test.ts'],
      exclude: ['packages/testkit/**'],
    },
    extends: './vitest.config.ts',
  },
  // Package-specific configurations
  'packages/testkit/vitest.config.ts',
  'packages/*/vitest.config.ts', // Future packages
])
```

### 2. Export Base Configuration from Testkit

**packages/testkit/src/config/index.ts** (new)

```typescript
export { createBaseVitestConfig } from './vitest.base'
export { detectTestEnvironment } from './detect'
export { getEnvironmentConfig } from './environment'
```

**packages/testkit/src/index.ts** (update)

```typescript
// Add exports
export * from './config'
```

### 3. Update Root Configuration

**vitest.config.ts** (enhanced)

```typescript
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@template/testkit'

export default defineConfig(
  createBaseVitestConfig({
    test: {
      globals: true,
      environment: 'node',
      setupFiles: [],
    },
  }),
)
```

### 4. Update Wallaby to Use Workspace

**wallaby.cjs** (update)

```javascript
module.exports = function (wallaby) {
  return {
    autoDetect: ['vitest'],
    testFramework: {
      configFile: './vitest.workspace.ts', // Use workspace
    },
    // ... rest of config
  }
}
```

### 5. Standardize Reporter Configuration

**packages/testkit/src/config/vitest.base.ts** (enhance)

```typescript
function getReporters(env: TestEnvironment) {
  const reporters = ['default']

  if (env.isCI) {
    reporters.push(
      ['junit', { outputFile: './test-results/junit.xml' }],
      ['html', { outputFile: './test-results/report.html' }],
      ['json', { outputFile: './test-results/results.json' }],
    )
  }

  return reporters
}
```

## Implementation Steps

1. **Export base config utilities** from testkit package
2. **Create vitest.workspace.ts** at root
3. **Update wallaby.cjs** to use workspace
4. **Enhance root config** to use base utilities
5. **Test all runners** (Vitest, Wallaby, CI)
6. **Document configuration hierarchy**

## Migration Plan

### Phase 1: Foundation (Day 1)

- Export base config from testkit
- Create workspace configuration
- Test with one package

### Phase 2: Wallaby Integration (Day 2)

- Update wallaby.cjs
- Verify setupFiles load correctly
- Test mock initialization

### Phase 3: CI Configuration (Day 3)

- Add junit/html reporters
- Configure test-results directory
- Test CI pipeline

### Phase 4: Documentation (Day 4)

- Document configuration hierarchy
- Create migration guide
- Update README

## Key Benefits

1. **Consistency**: Same behavior across all runners
2. **Flexibility**: Package-specific overrides supported
3. **Maintainability**: Single source of truth
4. **CI Integration**: Proper reporter configuration
5. **Developer Experience**: Predictable settings

## Risks and Mitigation

| Risk                              | Impact | Mitigation                                      |
| --------------------------------- | ------ | ----------------------------------------------- |
| Wallaby workspace incompatibility | High   | Test thoroughly, have fallback                  |
| Breaking existing tests           | Medium | Gradual migration, keep old configs temporarily |
| Performance impact                | Low    | Monitor test execution times                    |
| Configuration complexity          | Medium | Clear documentation, examples                   |

## Success Metrics

- All tests pass in Vitest and Wallaby
- Consistent timeouts across environments
- SetupFiles load in all runners
- CI produces junit/html reports
- No environment-specific failures

## Conclusion

The configuration fragmentation causes inconsistent test behavior and makes
debugging difficult. Implementing a Vitest workspace configuration with exported
base utilities will provide consistency while maintaining flexibility for
package-specific needs. The sophisticated base configuration already exists but
needs to be exported and utilized properly.
