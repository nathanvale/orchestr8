# EPIPE Error Solution Guide

## Problem

Zombie esbuild processes causing EPIPE errors with Vitest/Vite.

## Immediate Fix

**System restart is required** to clear zombie processes in uninterruptible
sleep state.

## Prevention After Restart

### 1. Modified Configuration

Already applied in `vitest.config.ts`:

```typescript
esbuild: false, // Disable esbuild transformation
```

### 2. Use Alternative Test Runners

```bash
# Option A: Use Bun's native test runner (fastest, but may have compatibility issues)
bun test

# Option B: Use Node with special flags
ESBUILD_WORKER_THREADS=0 npx vitest run

# Option C: Use the test:ci script which has better process handling
bun run test:ci
```

### 3. Clean Script

Run this if you see esbuild processes accumulating:

```bash
./scripts/clean-esbuild.sh
```

### 4. Process Monitoring

Check for zombie processes:

```bash
ps aux | grep esbuild | grep -c defunct
```

## Long-term Solutions

### Option 1: Replace Vitest with Bun Test

- Pros: No esbuild dependency, faster execution
- Cons: Less mature, fewer features

### Option 2: Use Docker/Container

- Pros: Isolated environment, easy cleanup
- Cons: Additional complexity

### Option 3: Use tini Process Manager

```bash
# Install tini
brew install tini

# Run tests with tini
tini -s -- npx vitest run
```

## Root Cause

- esbuild runs as a service for performance
- Node.js doesn't properly reap child processes in certain scenarios
- macOS kernel keeps processes in uninterruptible sleep when IPC pipes break
- Issue tracked: <https://github.com/evanw/esbuild/issues/1566>

## Workaround Applied

- Disabled esbuild in vitest.config.ts
- Created cleanup script
- Documented in decisions.md as DEC-008

## Next Steps After System Restart

1. Run `bun install` to get fresh dependencies
2. Use `npx vitest run` instead of `bun test` for Vitest
3. Monitor process list regularly
4. Consider migrating critical tests to Bun's native test runner
