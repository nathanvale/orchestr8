# Build System Troubleshooting Guide

## Common ESM Migration Issues

### 1. Import Statement Errors

**Symptom**:

- Error: `ERR_MODULE_NOT_FOUND`
- Unable to import modules

**Solutions**:

1. Always use `.js` extension in import statements

   ```typescript
   // ❌ Incorrect
   import { someFunction } from './utils'

   // ✅ Correct
   import { someFunction } from './utils.js'
   ```

2. Ensure `"type": "module"` in package.json
   ```json
   {
     "type": "module",
     "exports": {
       ".": "./dist/index.js"
     }
   }
   ```

### 2. Type Declaration Problems

**Symptom**:

- Missing type definitions
- TypeScript unable to resolve types

**Solutions**:

1. Separate type declaration compilation

   ```bash
   tsc --declaration --emitDeclarationOnly
   ```

2. Verify declaration paths in package.json
   ```json
   {
     "exports": {
       ".": {
         "types": "./dist-types/index.d.ts",
         "import": "./dist/index.js"
       }
     }
   }
   ```

### 3. Turborepo Caching Issues

**Symptom**:

- Inconsistent builds
- Cache misses
- Slow build times

**Solutions**:

1. Update Turborepo inputs

   ```json
   {
     "build": {
       "inputs": ["src/**/*.ts", "tsconfig.json", "package.json"],
       "outputs": ["dist/**", "dist-types/**"]
     }
   }
   ```

2. Use turbo prune for optimized builds
   ```bash
   turbo prune --scope=@template/utils
   ```

### 4. Runtime Type Checking

**Symptom**:

- TypeScript type errors not caught at runtime
- Silent type coercion

**Solutions**:

1. Use runtime type validation libraries
   - Zod
   - TypeBox
   - io-ts

2. Add runtime type guards
   ```typescript
   function assertIsNumber(value: unknown): asserts value is number {
     if (typeof value !== 'number') {
       throw new TypeError('Expected number')
     }
   }
   ```

### 5. Debugging ESM Modules

**Symptom**:

- Difficulty debugging imported modules
- Source map issues

**Solutions**:

1. Enable source map support

   ```typescript
   import 'source-map-support/register'
   ```

2. Use Node.js with `--enable-source-maps`
   ```bash
   node --enable-source-maps dist/index.js
   ```

### 6. Performance Monitoring

**Tools**:

- Use `node --trace-gc` for garbage collection insights
- Leverage V8 profiling
- Use `clinic.js` for performance analysis

## Debugging Commands

```bash
# Validate module imports
node -e "import('@template/utils')"

# Check type declarations
test -f dist-types/index.d.ts

# Build performance
time pnpm build

# Turborepo cache status
turbo run build --dry-run
```

## When to Seek Help

1. Persistent build failures
2. Runtime type inconsistencies
3. Performance degradation
4. Unexpected build output

## Performance Baseline

Ensure your build meets these targets:

- ✅ Build time: <2s (warm cache)
- ✅ First meaningful commit: <5min
- ✅ Context recovery: <10s via dx:status

---

**Pro Tip**: Always run `pnpm validate` before escalating issues. It checks
types, linting, and runs tests in one command.
