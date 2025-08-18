# CI/CD Pipeline Specification

This document defines the comprehensive CI/CD pipeline improvements for the @orchestr8 system.

> Created: 2025-01-17
> Version: 1.0.0
> Status: Enhanced with production-ready pipeline configuration

## Executive Summary

This specification provides enterprise-grade CI/CD pipeline configuration with:

- Codecov v4 integration with v8 coverage reporter
- Concurrency management for workflow optimization
- Deterministic test environments with TZ/LANG settings
- Pinned Node.js versions for cross-platform consistency
- Unified workspace testing for simplified coverage
- Complete GitHub Actions workflow definitions

## Core CI/CD Requirements

### 1. Coverage Reporting (v8 + Codecov v4)

**Remove nyc references completely** - Use Vitest's v8 provider exclusively:

```typescript
// vitest.config.ts - Standard configuration
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8', // ONLY v8, never nyc
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage/',
      exclude: [
        'dist/**',
        'node_modules/**',
        '**/*.config.{js,ts}',
        '**/*.test.{js,ts}',
        '**/index.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    reporters: [
      'default',
      ['junit', { outputFile: './test-results/junit.xml' }],
    ],
  },
})
```

### 2. GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

# Concurrency management - cancel in-progress runs
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  # Deterministic environment
  TZ: UTC
  LANG: en_US.UTF-8
  NODE_ENV: test
  CI: true
  # Performance settings
  VITEST_MAX_THREADS: 8
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}

jobs:
  # Lint and format checks run first (fast fail)
  quality-checks:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '22.15.x' # Pinned minor version (aligned with .nvmrc)
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run format check
        run: pnpm format:check

      - name: Run linting
        run: pnpm lint

      - name: Run type check
        run: pnpm type-check

  # Unit tests run in parallel matrix
  unit-tests:
    needs: quality-checks
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      matrix:
        node: ['20.12.x', '22.15.x'] # Pinned minor versions (22.15.x aligned with .nvmrc)
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests with coverage
        run: pnpm test:unit --coverage
        env:
          TZ: UTC
          LANG: en_US.UTF-8

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-summary.json
          flags: unit-tests,node-${{ matrix.node }}
          name: unit-coverage-node-${{ matrix.node }}
          fail_ci_if_error: false

  # Integration tests run serially
  integration-tests:
    needs: quality-checks
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '22.15.x' # Aligned with .nvmrc
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run integration tests (serial)
        run: pnpm test:integration --coverage
        env:
          TZ: UTC
          LANG: en_US.UTF-8
          MSW_UNHANDLED_REQUEST: error

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-summary.json
          flags: integration-tests
          name: integration-coverage

  # ADR conformance tests
  adr-conformance:
    needs: quality-checks
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '22.15.x' # Aligned with .nvmrc
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ADR conformance tests
        run: pnpm test:adr --coverage
        env:
          TZ: UTC
          LANG: en_US.UTF-8

      - name: Verify 100% ADR test coverage
        run: |
          coverage=$(jq '.total.lines.pct' coverage/coverage-summary.json)
          if (( $(echo "$coverage < 100" | bc -l) )); then
            echo "❌ ADR conformance tests must have 100% coverage (actual: $coverage%)"
            exit 1
          fi
          echo "✅ ADR conformance tests have 100% coverage"

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-summary.json
          flags: adr-conformance
          name: adr-coverage

  # Unified workspace test (alternative approach)
  workspace-tests:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '22.15.x' # Aligned with .nvmrc
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run all tests with unified coverage
        run: pnpm test --coverage --workspace
        env:
          TZ: UTC
          LANG: en_US.UTF-8

      - name: Upload unified coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-summary.json
          flags: workspace-all
          name: workspace-coverage

  # Performance tests (isolated)
  performance-tests:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2 # Need previous commit for baseline

      - uses: pnpm/action-setup@v3
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '22.15.x' # Aligned with .nvmrc
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run performance tests
        run: pnpm test:perf
        env:
          TZ: UTC
          LANG: en_US.UTF-8
          RUN_PERF_TESTS: true

      - name: Compare with baseline
        run: node scripts/compare-perf-baseline.js

      - name: Upload benchmark results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: test-results/benchmark.json

      - name: Comment PR with performance impact
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('test-results/benchmark.json', 'utf8'));
            const body = `## Performance Impact\n\n${results.summary}`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });

  # Build verification
  build:
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '22.15.x' # Aligned with .nvmrc
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm build

      - name: Verify ESM exports
        run: node scripts/verify-esm-exports.js

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            packages/*/dist/
            !packages/*/dist/**/*.map
```

## Prioritized Implementation Tasks

### Phase 1: Immediate Fixes (Critical)

1. **Remove nyc references**
   - Update all `vitest.config.ts` files to use v8 provider
   - Remove any nyc dependencies from package.json files
   - Update coverage scripts to use v8 json-summary format

2. **Update CI configuration**
   - Add Codecov v4 action with token
   - Add concurrency group with cancel-in-progress
   - Set TZ=UTC and LANG=en_US.UTF-8 in all test jobs
   - Pin Node.js minor versions (20.12.x, 22.7.x)

3. **Align API tests to MVP endpoints**
   - Move ETag tests to `/executions/:id`
   - Add explicit `/workflows/:id` endpoint if needed
   - Update test paths to match actual implementation

### Phase 2: Test Improvements (High Priority)

4. **Standardize resilience composition**
   - Document retry(circuitBreaker(timeout)) pattern once
   - Create standard backoff formula with jitter
   - Add composition order validation tests

5. **Add disposal to idempotency harness**
   - Inject scheduler for deterministic testing
   - Use afterEach cleanup for all timers
   - Prevent timer leaks in test suite

6. **Add circuit breaker half-open test**
   - Test concurrency limits in half-open state
   - Verify gradual recovery behavior
   - Test failure during half-open transition

7. **Add retry-abort test**
   - Test AbortSignal cancellation during retry
   - Verify cleanup on abort
   - Test partial retry completion

### Phase 3: Observability Tests (Medium Priority)

8. **Add OTel attribute assertions**
   - Verify span attributes are set correctly
   - Test trace context propagation
   - Validate metric dimensions

9. **Add journal timing invariants**
   - Test timestamp ordering in journal entries
   - Verify duration calculations
   - Test timezone consistency

10. **Add CLI ESM scaffolding tests**
    - Test generated package.json has "type": "module"
    - Verify import/export syntax in templates
    - Test ESM compatibility of scaffolded code

## CI/CD Best Practices

### 1. Environment Consistency

Always set these environment variables in CI:

```yaml
env:
  TZ: UTC # Consistent timezone
  LANG: en_US.UTF-8 # Consistent locale
  NODE_ENV: test # Test environment
  CI: true # CI detection
  FORCE_COLOR: 1 # Colored output
```

### 2. Node.js Version Management

Pin minor versions to avoid cross-version differences:

```yaml
strategy:
  matrix:
    node: ['20.12.x', '22.15.x'] # Not '20', '22' - 22.15.x aligned with .nvmrc
```

**Important**: Always keep the Node.js version in CI aligned with the project's `.nvmrc` file:

- Check `.nvmrc` for the current project Node.js version
- Update all CI matrix configurations when `.nvmrc` changes
- Ensure consistency across all workflow files

### 3. Concurrency Management

Prevent resource conflicts with concurrency groups:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 4. Coverage Strategy

Choose ONE approach to avoid complexity:

**Option A: Unified Workspace Coverage (Recommended)**

- Single test run with `pnpm test --coverage --workspace`
- No merging needed
- Simpler CI configuration
- Single Codecov upload

**Option B: Separated Project Coverage**

- Multiple test runs with project filters
- Let Codecov handle merging (not nyc)
- More granular failure isolation
- Multiple Codecov uploads with flags

### 5. Timeout Management

Set appropriate timeouts for each job:

```yaml
jobs:
  quality-checks:
    timeout-minutes: 10 # Fast checks
  unit-tests:
    timeout-minutes: 15 # Parallel tests
  integration-tests:
    timeout-minutes: 20 # Serial tests
  workspace-tests:
    timeout-minutes: 30 # All tests
```

### 6. Artifact Management

Upload only necessary artifacts:

```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-artifacts
    path: |
      packages/*/dist/
      !packages/*/dist/**/*.map  # Exclude source maps
```

## Monitoring and Alerts

### 1. Codecov Configuration

```yaml
# codecov.yml
coverage:
  status:
    project:
      default:
        target: 80%
        threshold: 2%
    patch:
      default:
        target: 80%

comment:
  layout: 'reach,diff,flags,files'
  behavior: default
  require_changes: false

flags:
  unit-tests:
    paths:
      - packages/*/src/**/*.ts
    carryforward: true
  integration-tests:
    paths:
      - packages/*/src/**/*.ts
    carryforward: true
  adr-conformance:
    paths:
      - packages/*/src/**/*.ts
    carryforward: false
```

### 2. GitHub Status Checks

Required checks before merge:

- quality-checks
- unit-tests (all matrix combinations)
- integration-tests
- adr-conformance
- build

Optional checks (informational):

- performance-tests
- workspace-tests
- codecov/project
- codecov/patch

### 3. Performance Regression Detection

```javascript
// scripts/compare-perf-baseline.js
const fs = require('fs')
const path = require('path')

const THRESHOLD = 1.2 // 20% regression threshold

function compareBaseline() {
  const current = JSON.parse(
    fs.readFileSync('test-results/benchmark.json', 'utf8'),
  )

  const baselinePath = 'test-results/benchmark-baseline.json'
  if (!fs.existsSync(baselinePath)) {
    console.log('No baseline found, creating new baseline')
    fs.writeFileSync(baselinePath, JSON.stringify(current, null, 2))
    return
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  const regressions = []

  for (const [test, metrics] of Object.entries(current)) {
    if (!baseline[test]) continue

    const ratio = metrics.duration / baseline[test].duration
    if (ratio > THRESHOLD) {
      regressions.push({
        test,
        baseline: baseline[test].duration,
        current: metrics.duration,
        regression: `${((ratio - 1) * 100).toFixed(1)}%`,
      })
    }
  }

  if (regressions.length > 0) {
    console.error('Performance regressions detected:')
    console.table(regressions)
    process.exit(1)
  }

  console.log('✅ No performance regressions detected')
}

compareBaseline()
```

## Local Development Setup

### 1. Pre-commit Hooks

```yaml
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Set consistent environment
export TZ=UTC
export LANG=en_US.UTF-8

# Run quality checks
pnpm format:check || exit 1
pnpm lint || exit 1
pnpm type-check || exit 1

# Run affected tests only
pnpm test:affected --run || exit 1
```

### 2. Local CI Simulation

```json
// package.json scripts
{
  "scripts": {
    "ci:local": "TZ=UTC LANG=en_US.UTF-8 pnpm check && pnpm test --coverage",
    "ci:validate": "act -j quality-checks -j unit-tests",
    "coverage:open": "open coverage/index.html",
    "coverage:report": "vitest run --coverage && open coverage/index.html"
  }
}
```

### 3. VS Code Integration

```json
// .vscode/settings.json
{
  "vitest.enable": true,
  "vitest.commandLine": "pnpm test",
  "testing.automaticallyOpenPeekView": "failureInVisibleDocument",
  "terminal.integrated.env.linux": {
    "TZ": "UTC",
    "LANG": "en_US.UTF-8"
  },
  "terminal.integrated.env.osx": {
    "TZ": "UTC",
    "LANG": "en_US.UTF-8"
  }
}
```

## Success Metrics

### CI Pipeline Health

- **Build time**: < 10 minutes for PR checks
- **Test stability**: < 1% flake rate
- **Coverage maintenance**: No drops > 2%
- **Dependency updates**: Automated weekly

### Coverage Targets

- **Core packages**: 80% (enforced)
- **ADR conformance**: 100% (enforced)
- **Supporting packages**: 60% (advisory)
- **Examples**: 50% (advisory)

### Performance Baselines

- **Orchestration overhead**: < 100ms (p95)
- **Parallel execution**: 10+ concurrent agents
- **Memory usage**: < 500MB for test suite
- **Test execution**: < 5 minutes for unit tests

## Migration Checklist

- [ ] Remove all nyc dependencies and references
- [ ] Update vitest.config.ts files to use v8 provider
- [ ] Add codecov.yml configuration
- [ ] Update GitHub Actions workflows with:
  - [ ] Codecov v4 action
  - [ ] Concurrency groups
  - [ ] TZ/LANG environment variables
  - [ ] Pinned Node.js versions
- [ ] Align API test endpoints to MVP spec
- [ ] Add missing resilience composition tests
- [ ] Add idempotency TTL disposal tests
- [ ] Add circuit breaker half-open concurrency test
- [ ] Add retry-abort cancellation test
- [ ] Add OTel attribute assertion tests
- [ ] Add journal timing invariant tests
- [ ] Add CLI ESM scaffolding tests
- [ ] Set up performance baseline tracking
- [ ] Configure required status checks
- [ ] Document CI/CD processes for team

## Conclusion

This enhanced CI/CD pipeline specification provides:

1. **Production-ready configuration** with Codecov v4 and v8 coverage
2. **Deterministic testing** with consistent environments
3. **Optimized performance** through concurrency management
4. **Comprehensive testing** with separated test projects
5. **Clear migration path** from current setup

The prioritized implementation ensures critical fixes are addressed first while building toward a robust, maintainable CI/CD pipeline that supports the @orchestr8 system's quality requirements.
