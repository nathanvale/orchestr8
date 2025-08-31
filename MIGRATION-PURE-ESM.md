# Pure ESM Build Migration Guide

> Migrating from tsup to TypeScript Compiler Direct Usage

## Overview

This document outlines the complete migration from tsup-based builds to pure ESM
using TypeScript compiler directly. This eliminates the strategic dependency
risk on unmaintained tsup while achieving ADHD-optimized developer experience
goals.

## Migration Steps

### Step 1: Update TypeScript Configuration

1. **Create new ESM library config**:
   - Location: `tooling/tsconfig/esm-library.json`
   - Target: ES2022 with ESNext modules
   - Optimized for tree-shaking and modern bundlers

2. **Update package-specific configs**:
   - Extend new `esm-library.json`
   - Add React types for packages using JSX
   - Exclude build scripts and test files

### Step 2: Install Build Orchestration

1. **Create build orchestrator**:
   - Location: `tooling/build/build-esm.js`
   - Handles multi-entry point compilation
   - Parallel compilation for <2s build times
   - Automatic cleanup of temporary configs

2. **Update package build scripts**:
   ```json
   {
     "scripts": {
       "build": "node ../../tooling/build/build-esm.js",
       "clean": "rm -rf dist dist-types .tsbuildinfo*"
     }
   }
   ```

### Step 3: Update Package Exports (ESM-only)

**Before (Dual CJS/ESM)**:

```json
{
  "exports": {
    ".": {
      "types": "./dist-types/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

**After (Pure ESM)**:

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist-types/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

### Step 4: Remove tsup Dependencies

1. **Remove from devDependencies**:

   ```bash
   pnpm remove tsup
   ```

2. **Delete tsup configurations**:
   - `tsup.config.ts` files
   - `tooling/build/tsup.base.ts`

3. **Update workspace build commands**:

   ```bash
   # Old
   turbo build # (used tsup)

   # New
   turbo build # (uses TypeScript compiler)
   ```

### Step 5: Update Turborepo Configuration

**turbo.jsonc changes**:

```json
{
  "build": {
    "inputs": ["src/**/*", "tsconfig*.json", "package.json"],
    "outputs": ["dist/**", "dist-types/**"],
    "env": ["NODE_ENV"]
  }
}
```

## Validation Steps

### 1. Build Performance

```bash
time pnpm build # Should complete in <2s
```

### 2. Package Exports

```bash
# Test imports work correctly
node -e "import('@template/utils')"
node -e "import('@template/utils/number')"
```

### 3. Tree-shaking Preservation

```javascript
// Test bundle analyzer shows proper tree-shaking
import { analyzeBundle } from './test/bundle-analyzer.js'
analyzeBundle('./dist/index.js') // Should show only used exports
```

### 4. TypeScript Declarations

```bash
# Verify type declarations generated
test -f dist-types/index.d.ts
test -f dist-types/number-utils.d.ts
```

## Expected Outcomes

### Performance Targets (ADHD-Optimized)

- ✅ Build time: <2s (warm cache)
- ✅ First meaningful commit: <5min
- ✅ Context recovery: <10s via dx:status

### Quality Improvements

- ✅ Remove strategic dependency risk (tsup unmaintained)
- ✅ Eliminate configuration conflicts
- ✅ Preserve sideEffects: false for optimal tree-shaking
- ✅ Single mental model (TypeScript compiler only)

### Bundle Optimization

- ✅ Pure ESM output for modern tooling
- ✅ Optimal tree-shaking with bundlers
- ✅ Source maps and declarations preserved
- ✅ Clean dist structure for debugging

## Rollback Plan

If issues arise during migration:

1. **Restore tsup dependencies**:

   ```bash
   pnpm add -D tsup@^8.3.0
   ```

2. **Restore tsup configurations**:
   - Git restore `tsup.config.ts` files
   - Git restore `tooling/build/tsup.base.ts`

3. **Restore package.json scripts**:
   ```json
   {
     "build": "tsup && pnpm run build:types"
   }
   ```

## Success Criteria

- [ ] All packages build in <2s (warm cache)
- [ ] Zero tsup dependencies in package.json files
- [ ] ESM-only exports with proper tree-shaking
- [ ] TypeScript declarations generated correctly
- [ ] Source maps preserved for debugging
- [ ] dx:status command shows build health
- [ ] No regression in test coverage or functionality

## Future Considerations

This pure ESM strategy provides foundation for:

- **Advanced Tree-shaking**: More aggressive dead code elimination
- **Modern Tooling**: Better compatibility with Vite, Rollup, esbuild
- **Performance**: Faster builds through parallel TypeScript compilation
- **Maintenance**: Reduced dependency surface area and configuration complexity

The migration eliminates cognitive overhead from dual build formats while
maintaining all functionality needed for the ADHD-optimized developer
experience.
