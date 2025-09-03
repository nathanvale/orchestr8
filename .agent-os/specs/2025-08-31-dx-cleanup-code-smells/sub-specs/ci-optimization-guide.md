# CI/CD Optimization Guide

> Comprehensive CI/CD improvements for faster builds and better developer
> feedback Version: 1.0.0 Created: 2025-08-31

## Overview

This guide provides detailed patterns and implementations for optimizing CI/CD
pipelines, reducing build times from ~15 minutes to <10 minutes, and improving
developer feedback loops.

## Current CI/CD Pain Points

### Identified Issues

1. **Slow CI runs** - Currently ~15 minutes for full pipeline
2. **Inefficient caching** - Turbo cache hit rate only ~50%
3. **Redundant test execution** - Tests run for unchanged code
4. **Poor parallelization** - Sequential tasks that could run concurrently
5. **Large Docker images** - Unoptimized container builds
6. **Missing performance metrics** - No visibility into bottlenecks

## Optimization Patterns

### Pattern 1: Turbo Cache Optimization

#### Current Issue

Turbo cache hit rate is only ~50%, causing unnecessary rebuilds.

#### Solution Implementation

**File:** `turbo.jsonc`

```typescript
// ❌ BEFORE - Broad input patterns causing cache misses
{
  "tasks": {
    "build": {
      "inputs": ["**/*"],
      "outputs": ["dist/**"]
    }
  }
}

// ✅ AFTER - Precise input patterns for better caching
{
  "$schema": "./node_modules/turbo/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**/*.ts",
        "src/**/*.tsx",
        "tsconfig.json",
        "tsup.config.ts",
        "package.json"
      ],
      "outputs": ["dist/**", ".turbo/**"],
      "cache": true,
      "outputLogs": "errors-only"
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": [
        "src/**/*.ts",
        "src/**/*.tsx",
        "tests/**/*.test.ts",
        "vitest.config.ts"
      ],
      "outputs": ["coverage/**"],
      "cache": true,
      "env": ["NODE_ENV"],
      "passThroughEnv": ["CI"]
    }
  },
  "globalDependencies": [
    "pnpm-lock.yaml",
    ".nvmrc",
    "tsconfig.base.json"
  ]
}
```

### Pattern 2: GitHub Actions Matrix Optimization

**File:** `.github/workflows/ci.yml`

```yaml
# ❌ BEFORE - Sequential job execution
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test
      - run: pnpm lint
      - run: pnpm build

# ✅ AFTER - Parallel matrix with smart caching
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    types: [opened, synchronize, reopened]

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  # Quick validation first
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # For affected package detection

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm typecheck

  # Parallel test matrix
  test:
    needs: validate
    runs-on: ${{ matrix.os }}
    timeout-minutes: 10
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest]
        node: [20]
        shard: [1, 2, 3, 4] # Parallel test shards

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup environment
        uses: ./.github/actions/setup
        with:
          node-version: ${{ matrix.node }}

      - name: Restore Turbo cache
        uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-${{ github.sha }}
          restore-keys: |
            turbo-${{ runner.os }}-

      - name: Run tests (shard ${{ matrix.shard }}/4)
        run: |
          pnpm test:ci --shard=${{ matrix.shard }}/4
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info
          flags: shard-${{ matrix.shard }}

  # Parallel build matrix
  build:
    needs: validate
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      matrix:
        package: [utils, web, server]

    steps:
      - uses: actions/checkout@v4

      - name: Setup environment
        uses: ./.github/actions/setup

      - name: Build package
        run: pnpm --filter @template/${{ matrix.package }} build
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
```

### Pattern 3: Reusable Workflow Actions

**File:** `.github/actions/setup/action.yml`

```yaml
name: 'Setup Environment'
description: 'Setup Node.js, pnpm, and restore caches'

inputs:
  node-version:
    description: 'Node.js version'
    default: '20'

runs:
  using: 'composite'
  steps:
    - name: Setup pnpm
      uses: pnpm/action-setup@v4
      with:
        version: 9

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'pnpm'

    - name: Get pnpm store directory
      id: pnpm-cache
      shell: bash
      run: |
        echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT

    - name: Setup pnpm cache
      uses: actions/cache@v4
      with:
        path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
        key: pnpm-store-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
        restore-keys: |
          pnpm-store-${{ runner.os }}-

    - name: Install dependencies
      shell: bash
      run: pnpm install --frozen-lockfile --prefer-offline
```

### Pattern 4: Docker Build Optimization

**File:** `Dockerfile`

```dockerfile
# ❌ BEFORE - Large unoptimized image
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["npm", "start"]

# ✅ AFTER - Multi-stage optimized build
# Stage 1: Prune dependencies
FROM node:20-alpine AS pruner
RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm
WORKDIR /app

COPY . .
RUN pnpm dlx turbo prune @template/web --docker

# Stage 2: Build application
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm
WORKDIR /app

# Copy pruned lockfile and package.json files
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install dependencies
RUN pnpm install --frozen-lockfile --prefer-offline

# Copy source code
COPY --from=pruner /app/out/full/ .

# Build application
RUN pnpm turbo build --filter=@template/web

# Stage 3: Production runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Set user and expose port
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "apps/web/server.js"]
```

### Pattern 5: Intelligent Test Selection

**File:** `scripts/test-affected.ts`

```typescript
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

interface AffectedPackages {
  packages: string[]
  hasRootChanges: boolean
}

/**
 * Detect packages affected by changes
 */
function getAffectedPackages(base: string = 'main'): AffectedPackages {
  try {
    // Get changed files
    const changedFiles = execSync(`git diff --name-only ${base}...HEAD`, {
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')
      .filter(Boolean)

    const packages = new Set<string>()
    let hasRootChanges = false

    for (const file of changedFiles) {
      if (file.startsWith('packages/')) {
        const packageName = file.split('/')[1]
        packages.add(packageName)
      } else if (file.startsWith('apps/')) {
        const appName = file.split('/')[1]
        packages.add(appName)
      } else {
        // Root level changes affect everything
        hasRootChanges = true
      }
    }

    return {
      packages: Array.from(packages),
      hasRootChanges,
    }
  } catch (error) {
    console.error('Failed to detect affected packages:', error)
    return { packages: [], hasRootChanges: true }
  }
}

/**
 * Run tests for affected packages only
 */
async function runAffectedTests(): Promise<void> {
  const { packages, hasRootChanges } = getAffectedPackages()

  if (hasRootChanges) {
    console.log('Root changes detected, running all tests...')
    execSync('pnpm test', { stdio: 'inherit' })
    return
  }

  if (packages.length === 0) {
    console.log('No changes detected, skipping tests')
    return
  }

  console.log(`Running tests for affected packages: ${packages.join(', ')}`)

  for (const pkg of packages) {
    try {
      execSync(`pnpm --filter @template/${pkg} test`, {
        stdio: 'inherit',
      })
    } catch (error) {
      console.error(`Tests failed for package: ${pkg}`)
      process.exit(1)
    }
  }
}

// Execute if run directly
if (require.main === module) {
  runAffectedTests()
}
```

### Pattern 6: Performance Monitoring

**File:** `.github/workflows/performance.yml`

```yaml
name: Performance Monitoring

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * *' # Daily

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup environment
        uses: ./.github/actions/setup

      - name: Run build benchmark
        id: build-bench
        run: |
          START=$(date +%s)
          pnpm build:all
          END=$(date +%s)
          DURATION=$((END - START))
          echo "duration=$DURATION" >> $GITHUB_OUTPUT

      - name: Run test benchmark
        id: test-bench
        run: |
          START=$(date +%s)
          pnpm test
          END=$(date +%s)
          DURATION=$((END - START))
          echo "duration=$DURATION" >> $GITHUB_OUTPUT

      - name: Store metrics
        uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: 'customBiggerIsBetter'
          output-file-path: ./benchmark-results.json
          benchmark-data-dir-path: 'dev/bench'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          auto-push: true
          alert-threshold: '120%'
          comment-on-alert: true
          fail-on-alert: false
```

## CI/CD Configuration Files

### Turborepo Remote Cache Setup

**File:** `.turbo/config.json`

```json
{
  "teamId": "team_xxxxx",
  "apiUrl": "https://api.vercel.com",
  "loginUrl": "https://vercel.com"
}
```

### Environment Variables

**File:** `.github/workflows/env.yml`

```yaml
env:
  # Turbo
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
  TURBO_REMOTE_ONLY: true

  # Performance
  NODE_OPTIONS: '--max-old-space-size=8192'

  # pnpm
  PNPM_PARALLEL_WORKERS: 4
```

## Optimization Metrics

### Before Optimization

| Metric          | Value   | Impact                  |
| --------------- | ------- | ----------------------- |
| Full CI run     | ~15 min | High friction           |
| Turbo cache hit | ~50%    | Wasted compute          |
| Test execution  | ~10s    | Slow feedback           |
| Docker build    | ~5 min  | Deployment delay        |
| Parallel jobs   | 1       | Underutilized resources |

### After Optimization

| Metric          | Value   | Improvement     |
| --------------- | ------- | --------------- |
| Full CI run     | <10 min | 33% faster      |
| Turbo cache hit | >85%    | 70% improvement |
| Test execution  | <5s     | 50% faster      |
| Docker build    | <2 min  | 60% faster      |
| Parallel jobs   | 4-8     | 4-8x throughput |

## Implementation Checklist

### Quick Wins (Do First)

- [ ] Update turbo.jsonc with precise input patterns
- [ ] Enable Turbo remote caching
- [ ] Add concurrency groups to workflows
- [ ] Implement build matrix parallelization

### Medium Effort

- [ ] Create reusable GitHub Actions
- [ ] Implement test sharding
- [ ] Add affected package detection
- [ ] Setup performance monitoring

### Long Term

- [ ] Optimize Docker builds with multi-stage
- [ ] Implement dependency caching strategies
- [ ] Add performance regression detection
- [ ] Create custom runners for heavy workloads

## Troubleshooting Guide

### Cache Miss Issues

```bash
# Debug Turbo cache
TURBO_DRY_RUN=true pnpm build

# Check cache status
turbo run build --dry-run=json | jq '.tasks[].cache'

# Force cache refresh
turbo run build --force
```

### Slow Test Detection

```bash
# Profile test execution
pnpm test -- --reporter=verbose --reporter=json > test-times.json

# Find slow tests
jq '.testResults[].assertionResults[] | select(.duration > 1000)' test-times.json
```

### Docker Build Analysis

```bash
# Analyze layer sizes
docker history <image> --human --format "table {{.CreatedBy}}\t{{.Size}}"

# Build with cache mount
docker buildx build --cache-from type=registry,ref=myapp:cache .
```

## Best Practices

1. **Always use exact dependency versions** in CI (frozen lockfile)
2. **Fail fast** with validation before expensive operations
3. **Cache aggressively** but invalidate precisely
4. **Parallelize** independent tasks across matrix
5. **Monitor trends** not just current performance
6. **Use timeouts** to prevent hanging builds
7. **Cancel outdated** workflows on new pushes

## Resources

- [Turborepo Caching Documentation](https://turbo.build/repo/docs/core-concepts/caching)
- [GitHub Actions Best Practices](https://docs.github.com/en/actions/guides)
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [pnpm Performance Tips](https://pnpm.io/benchmarks)
