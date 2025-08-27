# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-08-27-vitest-migration-fixes/spec.md

> Created: 2025-08-27 Version: 1.0.0

## Technical Requirements

### P0 - Critical Production Blockers

These issues must be fixed before the test suite can be considered
production-ready.

#### 1. Remove Global Fetch Mock (Conflicts with MSW)

**Problem:** Global fetch stub overrides MSW's network interception, breaking
all network mocks.

**Location:** `vitest.setup.tsx` lines 124-126

**Before:**

```typescript
// vitest.setup.tsx
// Mock fetch (fallback if MSW doesn't handle it)
// @ts-expect-error - simplified mock for testing
global.fetch = vi.fn();
```

**After:**

```typescript
// vitest.setup.tsx
// Remove the global fetch mock entirely - MSW handles network interception
// If you need fetch polyfill for jsdom/happy-dom, import it instead:
if (typeof window !== 'undefined' && !window.fetch) {
  await import('whatwg-fetch');
}
```

**Implementation Notes:**

- MSW provides complete network interception and mocking
- Global fetch stubs interfere with MSW's request handlers
- Use whatwg-fetch polyfill only when needed for DOM environments

#### 2. Enable Test Isolation in CI

**Problem:** Tests run with `isolate: false`, causing state leakage between test
files.

**Location:** `vitest.config.ts` line 14

**Before:**

```typescript
// vitest.config.ts
poolOptions: {
  forks: {
    singleFork: true,
    isolate: true, // Currently hardcoded
    maxForks: process.env['CI'] === 'true' ? 2 : undefined,
    minForks: 1,
  },
},
```

**After:**

```typescript
// vitest.config.ts
poolOptions: {
  forks: {
    singleFork: true,
    isolate: process.env['CI'] === 'true', // Enable isolation in CI only
    maxForks: process.env['CI'] === 'true' ? 2 : Math.min(4, require('os').cpus().length),
    minForks: 1,
  },
},
```

**Implementation Notes:**

- Isolation prevents test pollution but is slower
- CI needs isolation for reliability
- Local development can skip isolation for speed

#### 3. Fix CI TypeScript Coverage

**Problem:** CI uses `tsconfig.build.json` which likely excludes test files from
type checking.

**Location:** `.github/workflows/ci.yml` line 72

**Before:**

```yaml
# .github/workflows/ci.yml
- name: Type Check
  run: npx tsc -p tsconfig.build.json
```

**After:**

```yaml
# .github/workflows/ci.yml
- name: Type Check
  run: |
    echo "Checking production code..."
    npx tsc --noEmit -p tsconfig.json
    echo "Checking test files..."
    npx tsc --noEmit -p tsconfig.vitest.json || echo "No test config found, skipping"
```

**Implementation Notes:**

- Check both production and test TypeScript configs
- Use --noEmit to avoid generating JS files
- Handle missing test config gracefully

#### 4. Enable Coverage in CI

**Problem:** Tests run without coverage flag, Codecov upload fails with no data.

**Location:** `.github/workflows/ci.yml` lines 123-127

**Before:**

```yaml
# .github/workflows/ci.yml
- name: Run Tests
  run: npx vitest run --reporter=dot
  env:
    NODE_ENV: development
```

**After:**

```yaml
# .github/workflows/ci.yml
- name: Run Tests
  run: npx vitest run --coverage --reporter=dot --reporter=junit
  env:
    NODE_ENV: test
    CI: true

- name: Verify Coverage Output
  run: |
    if [ ! -f "./coverage/lcov.info" ]; then
      echo "Coverage file not found!"
      exit 1
    fi
```

**Implementation Notes:**

- Always generate coverage in CI
- Verify coverage file exists before upload
- Use NODE_ENV=test for proper test environment

#### 5. JUnit Reporter Safety

**Problem:** JUnit reporter configured without checking if output directory
exists.

**Location:** `vitest.config.ts` lines 85-89

**Before:**

```typescript
// vitest.config.ts
reporters: process.env['CI'] === 'true' ? ['dot', 'junit'] : ['verbose'],
outputFile: {
  junit: './coverage/junit.xml',
},
```

**After:**

```typescript
// vitest.config.ts
import { mkdirSync } from 'node:fs';

// Ensure output directories exist
if (process.env['CI'] === 'true') {
  mkdirSync('./coverage', { recursive: true });
}

export default defineConfig({
  test: {
    reporters:
      process.env['CI'] === 'true'
        ? ['dot', ['junit', { outputFile: './coverage/junit.xml' }]]
        : ['default'],
    coverage: {
      enabled: process.env['CI'] === 'true',
      reporter: ['lcov', 'text', 'html'],
      reportsDirectory: './coverage',
    },
  },
});
```

**Implementation Notes:**

- Create output directory before tests run
- Configure reporters with proper options syntax
- Enable coverage automatically in CI

### P1 - High Priority Issues

#### 1. Add Environment Checks to DOM Mocks

**Problem:** Global DOM mocks always applied, may hide real browser issues.

**Location:** `vitest.setup.tsx` lines 77-131

**Before:**

```typescript
// vitest.setup.tsx
// Mock common browser APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    // ... rest of implementation
  })),
});
```

**After:**

```typescript
// vitest.setup.tsx
// Only mock browser APIs when in test environment
if (process.env['VITEST'] === 'true' || process.env['NODE_ENV'] === 'test') {
  // Check if API doesn't exist before mocking
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        // ... rest of implementation
      })),
    });
  }
}
```

**Implementation Notes:**

- Only mock missing APIs
- Make mocks configurable for cleanup
- Check environment before applying

#### 2. Consolidate Mock Reset Strategy

**Problem:** Three overlapping mock reset options cause confusion.

**Location:** `vitest.config.ts` lines 44-47

**Before:**

```typescript
// vitest.config.ts
globals: true,
clearMocks: true, // Clear mock history
mockReset: true, // Clear and reset implementation
restoreMocks: true, // Restore original implementation
```

**After:**

```typescript
// vitest.config.ts
globals: true,
clearMocks: true, // Only clear mock history between tests
// Remove redundant options - clearMocks is sufficient
```

**Also remove from `vitest.setup.tsx`:**

```typescript
// Remove this redundant beforeEach
beforeEach(() => {
  vi.clearAllMocks(); // This is redundant with clearMocks: true
});
```

**Implementation Notes:**

- `clearMocks` clears call history but keeps implementations
- `mockReset` also resets implementations (too aggressive)
- `restoreMocks` restores originals (breaks intentional mocks)

#### 3. Configure Cache Directory

**Problem:** Cache directory not properly configured, may cause pollution.

**Location:** `vitest.config.ts` - add new configuration

**Before:**

```typescript
// vitest.config.ts
// No cache configuration
```

**After:**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    cache: {
      dir: '.vitest',
    },
    // ... rest of config
  },
});
```

**Also update `.gitignore`:**

```gitignore
# Test artifacts
.vitest/
coverage/
*.log
```

**Implementation Notes:**

- Explicit cache directory prevents conflicts
- Add to .gitignore to avoid committing cache
- Clear cache if tests behave unexpectedly

### P2 - Medium Priority Optimizations

#### 1. CPU-Based Fork Limits

**Problem:** Unlimited forks can overwhelm development machines.

**Location:** `vitest.config.ts` line 16

**Before:**

```typescript
// vitest.config.ts
maxForks: process.env['CI'] === 'true' ? 2 : undefined,
```

**After:**

```typescript
// vitest.config.ts
import { cpus } from 'node:os';

const maxCpuForks = Math.max(1, Math.min(4, cpus().length - 1));

poolOptions: {
  forks: {
    maxForks: process.env['CI'] === 'true' ? 2 : maxCpuForks,
  },
},
```

**Implementation Notes:**

- Leave one CPU for system processes
- Cap at 4 to prevent overwhelming
- CI uses 2 for consistency

#### 2. Remove Redundant Node.js Setup

**Problem:** CI installs both Bun and Node.js unnecessarily.

**Location:** `.github/workflows/ci.yml` lines 42-44, 105-108

**Before:**

```yaml
# .github/workflows/ci.yml
- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version: ${{ env.NODE_VERSION }}

- name: Setup Bun
  uses: oven-sh/setup-bun@v2
  with:
    bun-version: ${{ env.BUN_VERSION }}
```

**After:**

```yaml
# .github/workflows/ci.yml
# Remove Node.js setup - Bun handles everything
- name: Setup Bun
  uses: oven-sh/setup-bun@v2
  with:
    bun-version: ${{ env.BUN_VERSION }}

# If specific tools need Node.js, use Bun's Node.js compatibility
- name: Verify Bun Node Compatibility
  run: bun --version && bun node --version
```

**Implementation Notes:**

- Bun provides Node.js compatibility
- Remove NODE_VERSION environment variable
- Update any Node-specific commands to use Bun

#### 3. Optimize Reporter Configuration

**Problem:** Verbose reporters create noisy output.

**Location:** `vitest.config.ts` line 86

**Before:**

```typescript
// vitest.config.ts
reporters: process.env['CI'] === 'true' ? ['dot', 'junit'] : ['verbose'],
```

**After:**

```typescript
// vitest.config.ts
reporters: process.env['CI'] === 'true'
  ? ['dot', ['junit', { outputFile: './coverage/junit.xml' }]]
  : process.env['VERBOSE'] === 'true' ? ['verbose'] : ['default'],
```

**Implementation Notes:**

- Use 'default' reporter for balanced output
- Allow VERBOSE=true for detailed output when needed
- CI uses minimal 'dot' reporter

### P3 - Low Priority Enhancements

#### 1. Consolidate Test Scripts

**Problem:** Multiple overlapping test scripts in package.json.

**Location:** `package.json` scripts section

**Before:**

```json
{
  "scripts": {
    "test": "vitest",
    "test:ci": "vitest run --reporter=dot",
    "test:ci:coverage": "vitest run --coverage",
    "test:reporter:junit": "vitest run --reporter=junit"
  }
}
```

**After:**

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest watch",
    "test:ci": "vitest run --coverage --reporter=dot --reporter=junit",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Implementation Notes:**

- Single CI script with all requirements
- Separate coverage script for local use
- Clear naming convention

#### 2. Move Performance Benchmarks to Nightly

**Problem:** Hyperfine benchmarks slow down every PR.

**Create new file:** `.github/workflows/nightly-performance.yml`

```yaml
name: Nightly Performance Benchmarks

on:
  schedule:
    - cron: '0 2 * * *' # Run at 2 AM UTC daily
  workflow_dispatch: # Allow manual trigger

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install Hyperfine
        run: |
          wget https://github.com/sharkdp/hyperfine/releases/download/v1.18.0/hyperfine_1.18.0_amd64.deb
          sudo dpkg -i hyperfine_1.18.0_amd64.deb

      - name: Run Performance Benchmarks
        run: |
          hyperfine --warmup 3 'bun install'
          hyperfine --warmup 3 'bun test'
          hyperfine --warmup 3 'bun run build'

      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: benchmark-results/
```

**Remove from:** `.github/workflows/ci.yml` lines 267-313

**Implementation Notes:**

- Separate workflow for performance testing
- Run nightly to track trends
- Can be manually triggered when needed

#### 3. Configure ESLint Vitest Plugin

**Problem:** ESLint plugin installed but rules not configured.

**Location:** `.eslintrc.json` or `eslint.config.js`

**Add to ESLint config:**

```javascript
// eslint.config.js
import vitest from 'eslint-plugin-vitest';

export default [
  {
    plugins: {
      vitest,
    },
    rules: {
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error',
      'vitest/no-identical-title': 'error',
      'vitest/prefer-to-have-length': 'warn',
      'vitest/valid-expect': 'error',
      'vitest/consistent-test-it': ['error', { fn: 'test' }],
    },
  },
];
```

**Implementation Notes:**

- Prevent .only() tests in commits
- Enforce consistent test naming
- Catch common testing mistakes

## Approach Options

### Option A: Incremental Fixes

- Pros: Lower risk, can test each change independently
- Cons: Longer timeline, potential for inconsistent state

### Option B: Batch Critical Fixes (Selected)

- Pros: Faster resolution of blockers, consistent state
- Cons: Higher risk if issues arise, harder to isolate problems

**Rationale:** P0 issues are interdependent (coverage needs isolation, reporters
need coverage). Batching critical fixes ensures a consistent, working state.

## External Dependencies

No new dependencies required. All fixes use existing packages or built-in
Node.js modules.

## Testing Strategy

### Unit Testing

- Run test suite after each P0 fix
- Verify no test failures introduced
- Check mock behavior with sample tests

### Integration Testing

- Push branch to trigger CI pipeline
- Verify coverage reports generate
- Confirm JUnit reports upload
- Check Codecov integration works

### Performance Testing

- Measure test execution time before/after isolation changes
- Compare local vs CI execution times
- Monitor memory usage with different fork settings

## Implementation Order

1. **Phase 1 - Critical Fixes (P0)**
   - Remove global fetch mock
   - Configure test isolation
   - Fix TypeScript coverage
   - Enable coverage reporting
   - Add JUnit reporter safety

2. **Phase 2 - High Priority (P1)**
   - Add environment checks to mocks
   - Consolidate mock strategies
   - Configure cache directory

3. **Phase 3 - Optimizations (P2-P3)**
   - CPU-based fork limits
   - Remove Node.js from CI
   - Optimize reporters
   - Consolidate scripts
   - Move performance tests

## Rollback Plan

If issues arise:

1. Revert to previous commit
2. Apply fixes one at a time
3. Test thoroughly between each change
4. Document any unexpected behavior

## Success Criteria

- ✅ All tests pass in CI with coverage > 80%
- ✅ Coverage reports upload to Codecov successfully
- ✅ JUnit reports generate without errors
- ✅ Test execution time < 30 seconds locally
- ✅ No test state leakage between files
- ✅ CI pipeline completes in < 5 minutes
