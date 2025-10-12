---
'@orchestr8/testkit': minor
---

Add pre-configured test setup module with automatic resource cleanup

Introduces `@orchestr8/testkit/setup` and `@orchestr8/testkit/setup/auto` modules to eliminate test-setup.ts boilerplate across packages.

**Features:**
- `@orchestr8/testkit/setup` - Manual configuration with `createTestSetup()` factory
- `@orchestr8/testkit/setup/auto` - Zero-config auto-executing setup for vitest setupFiles
- Centralized resource cleanup with sensible defaults
- Optional package name logging and statistics
- Full TypeScript support with proper type exports

**Usage:**

Zero-config (auto-executing):
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['@orchestr8/testkit/setup/auto']
  }
})
```

Custom configuration:
```typescript
import { createTestSetup } from '@orchestr8/testkit/setup'

await createTestSetup({
  packageName: 'my-package',
  cleanupAfterEach: false,
  logStats: true
})
```

This eliminates 101 lines of duplicated boilerplate code across packages.
