---
'@orchestr8/testkit': major
---

**BREAKING CHANGE**: Remove `defineVitestConfig` to fix "Vitest failed to access its internal state" error

## What Changed

- **Removed**: `defineVitestConfig` function and export
- **Fixed**: Config helpers no longer import vitest internals during config loading
- **Fixed**: Made vitest-resources imports lazy to prevent config-time loading

## Why This Change

Vitest config files cannot import vitest internals (like `defineConfig`, `beforeEach`, `afterEach`) because these require the vitest runtime to be initialized. When `defineVitestConfig` imported `defineConfig` from `vitest/config`, it caused the error:

```
Error: Vitest failed to access its internal state.
- "vitest" is imported inside Vite / Vitest config file
```

This prevented any project using TestKit's config helpers from running tests.

## Migration Guide

**Before:**
```typescript
import { defineConfig } from 'vitest/config'
import { defineVitestConfig } from '@orchestr8/testkit/config'

export default defineVitestConfig({
  test: {
    name: 'my-package',
    environment: 'node',
  },
})
```

**After:**
```typescript
import { defineConfig } from 'vitest/config'
import { createBaseVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createBaseVitestConfig({
    test: {
      name: 'my-package',
      environment: 'node',
    },
  })
)
```

## Impact

- **Breaking**: Projects using `defineVitestConfig` must update to use `createBaseVitestConfig` wrapped in `defineConfig`
- **Fixed**: All config helpers now work correctly without triggering vitest state errors
- **Improved**: Resource cleanup functions are now async (prevents config-time vitest imports)

## Related Issues

Fixes the critical issue reported in `/Users/nathanvale/code/capture-bridge/docs/support-ticket-testkit-config-vitest-state-error.md`
