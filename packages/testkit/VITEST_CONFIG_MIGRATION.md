# Vitest Configuration Migration Guide

This guide helps you migrate to using the new base Vitest configuration from `@template/testkit`.

## Overview

The testkit package now provides a standardized Vitest configuration that:
- Automatically detects your environment (local, CI, Wallaby)
- Optimizes settings for stability and performance
- Provides consistent behavior across all packages
- Includes proper TypeScript support and type safety

## Migration Steps

### 1. Install/Update Dependencies

Ensure you have the latest version of `@template/testkit`:

```bash
pnpm add -D @template/testkit@latest
```

### 2. Update Your `vitest.config.ts`

**Before (Old approach):**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'threads',
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['./src/setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
  },
})
```

**After (New approach):**
```typescript
import { defineVitestConfig } from '@template/testkit/config'

export default defineVitestConfig({
  test: {
    // Only specify overrides - base config provides sensible defaults
    environment: 'node', // Optional: defaults to 'node'
    setupFiles: ['./src/setup.ts'], // Add your custom setup files
  },
})
```

### 3. Remove Redundant Configuration

The base config already includes:
- ✅ Environment detection (CI, Wallaby, local)
- ✅ Optimized pool configuration (`forks` for stability)
- ✅ Proper timeout settings
- ✅ Coverage configuration
- ✅ Standard file patterns
- ✅ Reporter configuration
- ✅ Register setup (`@template/testkit/register`)

You only need to specify **overrides** for your specific needs.

## Common Migration Patterns

### Basic Package Configuration

```typescript
// packages/your-package/vitest.config.ts
import { defineVitestConfig } from '@template/testkit/config'

export default defineVitestConfig({
  // Base config handles everything - no overrides needed!
})
```

### Frontend Package with DOM Testing

```typescript
// packages/frontend/vitest.config.ts
import { defineVitestConfig } from '@template/testkit/config'

export default defineVitestConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

### Package with Custom Setup

```typescript
// packages/api/vitest.config.ts
import { defineVitestConfig } from '@template/testkit/config'

export default defineVitestConfig({
  test: {
    setupFiles: [
      // Base register is automatically included
      './src/database-setup.ts',
      './src/auth-setup.ts',
    ],
  },
})
```

### Integration Tests

```typescript
// packages/integration/vitest.config.ts
import { defineVitestConfig } from '@template/testkit/config'

export default defineVitestConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 60000, // Longer timeout for integration tests
    hookTimeout: 60000,
    setupFiles: ['./src/integration-setup.ts'],
  },
})
```

## Environment-Specific Configurations

### Wallaby Optimization

For packages that need Wallaby-specific optimizations:

```typescript
import { createWallabyConfig } from '@template/testkit/config'

export default createWallabyConfig({
  test: {
    // Your Wallaby-specific overrides
    environment: 'happy-dom',
  },
})
```

### CI Optimization

For packages that need CI-specific optimizations:

```typescript
import { createCIConfig } from '@template/testkit/config'

export default createCIConfig({
  test: {
    // Your CI-specific overrides
    testTimeout: 30000,
  },
})
```

## Available Configuration Functions

### Core Functions

- `defineVitestConfig(overrides?)` - Main function for creating Vitest configs
- `createBaseVitestConfig(overrides?)` - Returns raw config object
- `createVitestConfig(overrides?)` - Alias for `createBaseVitestConfig`

### Environment-Specific Functions

- `createWallabyConfig(overrides?)` - Wallaby-optimized configuration
- `createCIConfig(overrides?)` - CI-optimized configuration

### Utility Functions

- `createVitestEnvironmentConfig()` - Get current environment info
- `createVitestPoolOptions(env)` - Create pool options for environment
- `createVitestTimeouts(env)` - Create timeout configuration
- `createVitestCoverage(env)` - Create coverage configuration

## Configuration Merging

The base configuration uses deep merging for nested objects:

```typescript
defineVitestConfig({
  test: {
    env: {
      CUSTOM_VAR: 'value', // Merged with base env vars
    },
    poolOptions: {
      forks: {
        maxForks: 8, // Merged with base fork options
      },
    },
  },
})
```

## Environment Detection

The base config automatically detects your environment:

- **Local Development**: Balanced settings for speed and reliability
- **CI Environment** (`CI=true`): Optimized for stability, limited workers, JUnit output
- **Wallaby** (`WALLABY_WORKER` set): Single worker, no coverage, verbose output

## Common Use Cases

### 1. Simple Package

```typescript
import { defineVitestConfig } from '@template/testkit/config'

// Uses all defaults - perfect for most packages
export default defineVitestConfig()
```

### 2. Package with Database Tests

```typescript
import { defineVitestConfig } from '@template/testkit/config'

export default defineVitestConfig({
  test: {
    setupFiles: ['./src/db-setup.ts'],
    testTimeout: 30000, // Longer timeout for DB operations
  },
})
```

### 3. Frontend Package

```typescript
import { defineVitestConfig } from '@template/testkit/config'

export default defineVitestConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/dom-setup.ts'],
    pool: 'threads', // Faster for frontend tests
  },
})
```

### 4. Performance-Critical Package

```typescript
import { defineVitestConfig } from '@template/testkit/config'

export default defineVitestConfig({
  test: {
    pool: 'threads', // Override default 'forks' for speed
    poolOptions: {
      threads: {
        maxThreads: 8,
        singleThread: false,
      },
    },
  },
})
```

## Troubleshooting

### Issue: Tests are slower than before

**Solution**: The base config uses `forks` by default for stability. If you need speed over isolation:

```typescript
defineVitestConfig({
  test: {
    pool: 'threads', // Faster but less isolated
  },
})
```

### Issue: Custom setup files not working

**Solution**: The base config automatically includes `@template/testkit/register`. Add your custom files to the array:

```typescript
defineVitestConfig({
  test: {
    setupFiles: [
      // @template/testkit/register is automatically included
      './src/my-setup.ts',
    ],
  },
})
```

### Issue: Coverage not generating

**Solution**: Coverage is automatically disabled in Wallaby. For other environments, ensure it's enabled:

```typescript
defineVitestConfig({
  test: {
    coverage: {
      enabled: true,
      // Other coverage options...
    },
  },
})
```

### Issue: Environment variables not set

**Solution**: The base config sets `NODE_ENV=test` and `VITEST=true`. Add custom variables:

```typescript
defineVitestConfig({
  test: {
    env: {
      CUSTOM_VAR: 'value',
    },
  },
})
```

## Benefits of Migration

1. **Consistency**: All packages use the same base configuration
2. **Environment Awareness**: Automatic optimization for CI, Wallaby, and local development
3. **Maintenance**: Configuration updates happen in one place
4. **Best Practices**: Built-in optimizations and sensible defaults
5. **Type Safety**: Full TypeScript support with proper types
6. **Reduced Boilerplate**: Less configuration code to maintain

## Breaking Changes

- `globals: true` is now `globals: false` by default (use explicit imports)
- Pool strategy changed from `threads` to `forks` for better stability
- Setup files now automatically include `@template/testkit/register`
- Coverage thresholds are now set to 80% by default

## Need Help?

If you encounter issues during migration:

1. Check the examples above for your use case
2. Review the test files in `packages/testkit/src/config/__tests__/`
3. Use the utility functions to debug your configuration
4. Consider using environment-specific configs (`createWallabyConfig`, `createCIConfig`)

## Advanced Usage

### Custom Configuration Builder

```typescript
import { createBaseVitestConfig } from '@template/testkit/config'

// Build custom configuration programmatically
const myConfig = createBaseVitestConfig({
  test: {
    environment: process.env.TEST_ENV === 'browser' ? 'happy-dom' : 'node',
    setupFiles: [
      ...(process.env.DB_TESTS ? ['./src/db-setup.ts'] : []),
      './src/common-setup.ts',
    ],
  },
})

export default myConfig
```

### Workspace Configuration

The workspace configuration (`vitest.workspace.ts`) already uses the base config. Each package can still have its own `vitest.config.ts` that extends the base:

```typescript
// packages/my-package/vitest.config.ts
import { defineVitestConfig } from '@template/testkit/config'

export default defineVitestConfig({
  test: {
    // Package-specific overrides
  },
})
```