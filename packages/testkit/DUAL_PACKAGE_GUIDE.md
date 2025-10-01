# CommonJS Compatibility Guide

This document explains the CommonJS (CJS) compatibility implementation for @orchestr8/testkit and its limitations.

## Overview

@orchestr8/testkit now provides dual package support with both ESM and CommonJS builds. However, due to the nature of testing frameworks and dependencies, **not all modules are compatible with CommonJS environments**.

## What Works in CommonJS

The following utility modules are available in CommonJS environments:

### ✅ `/utils` - Core Utilities
```javascript
const { delay, retry, withTimeout, createMockFn } = require('@orchestr8/testkit/utils')

// Basic utilities work fine
await delay(100)
const result = await retry(() => fetchData(), 3)
const mockFn = createMockFn((x) => x * 2)
```

### ✅ `/fs` - File System Utilities (Limited)
```javascript
const { createTempDirectory, createNamedTempDirectory } = require('@orchestr8/testkit/fs')

// Basic fs operations work
const tempDir = await createTempDirectory({ prefix: 'test-' })
await tempDir.writeFile('test.txt', 'content')
await tempDir.cleanup()
```

### ✅ `/env` - Environment Utilities (Limited)
```javascript
const { getTestEnvironment, getTestTimeouts } = require('@orchestr8/testkit/env')

// Environment detection works
const env = getTestEnvironment()
const timeouts = getTestTimeouts()
```

## What Doesn't Work in CommonJS

The following modules are **NOT compatible** with CommonJS due to dependencies on ESM-only packages:

### ❌ Main Package (`@orchestr8/testkit`)
- Contains Vitest dependencies
- Use specific submodules instead

### ❌ `/config` - Vitest Configuration
- Depends on `vitest/config` which is ESM-only
- Use ESM imports for test configuration

### ❌ `/msw` - Mock Service Worker
- MSW is primarily ESM-focused
- Use ESM imports for API mocking

### ❌ `/containers` - Test Containers
- Complex async initialization
- Use ESM imports for container testing

### ❌ `/sqlite`, `/convex` - Database Modules
- Contain test framework integrations
- Use ESM imports for database testing

### ❌ `/legacy` - Legacy Modules
- May contain deprecated patterns
- Use ESM imports or migrate to newer patterns

## Migration Strategies

### For New Projects
```javascript
// ESM - Recommended approach
import { createTempDirectory, delay, retry } from '@orchestr8/testkit'
import { setupMSW } from '@orchestr8/testkit/msw'
import { createVitestConfig } from '@orchestr8/testkit/config'
```

### For Legacy CommonJS Projects
```javascript
// Use only compatible modules
const { delay, retry, createMockFn } = require('@orchestr8/testkit/utils')
const { createTempDirectory } = require('@orchestr8/testkit/fs')

// For testing features, use dynamic imports
async function setupTests() {
  const { setupMSW } = await import('@orchestr8/testkit/msw')
  const { createVitestConfig } = await import('@orchestr8/testkit/config')
  return { setupMSW, createVitestConfig }
}
```

### Gradual Migration
```javascript
// Mixed approach during migration
const utils = require('@orchestr8/testkit/utils') // CJS utilities

// ESM-only features via dynamic import
const testingFeatures = await import('@orchestr8/testkit/config')
```

## Technical Details

### Build Configuration
- **ESM Build**: Full feature set in `dist/` directory
- **CJS Build**: Limited compatibility in `dist/cjs/` directory
- **Bundling**: CJS modules are bundled to avoid extension resolution issues
- **Externals**: Testing frameworks and complex dependencies are externalized

### Export Conditions
```json
{
  "exports": {
    "./utils": {
      "types": "./dist/utils/index.d.ts",
      "import": "./dist/utils/index.js",
      "require": "./dist/cjs/utils/index.cjs",
      "default": "./dist/utils/index.js"
    }
  }
}
```

### Known Limitations

1. **Vitest Integration**: Cannot be used in CJS due to Vitest's ESM-only nature
2. **Process Listeners**: May conflict when multiple CJS modules are loaded
3. **Resource Management**: Limited functionality in CJS environments
4. **Testing Features**: Most testing-specific features require ESM

## Best Practices

### For Library Authors
```javascript
// ✅ Good - Use utilities that work in both environments
const { delay, retry } = require('@orchestr8/testkit/utils')

// ❌ Avoid - Don't use testing features in CJS libraries
// const { setupMSW } = require('@orchestr8/testkit/msw') // Won't work
```

### For Test Files
```javascript
// ✅ Recommended - Use ESM for all test files
import { describe, it } from 'vitest'
import { createTempDirectory } from '@orchestr8/testkit'
import { setupMSW } from '@orchestr8/testkit/msw'
```

### For Build Tools
```javascript
// ✅ Use dynamic imports for ESM-only features in CJS contexts
async function getBuildConfig() {
  const { createVitestConfig } = await import('@orchestr8/testkit/config')
  return createVitestConfig({
    // config options
  })
}
```

## Troubleshooting

### "Vitest cannot be imported in CommonJS"
This is expected. Use dynamic imports or migrate to ESM for testing features:
```javascript
// Instead of:
// const { setupMSW } = require('@orchestr8/testkit/msw')

// Use:
const { setupMSW } = await import('@orchestr8/testkit/msw')
```

### "Listener already registered"
This can happen when loading multiple CJS modules. Consider using isolated environments or ESM:
```javascript
// Create isolated test environments
const { createTempDirectory } = require('@orchestr8/testkit/fs')
// Use separate temp directories for different test suites
```

### Module Resolution Issues
Ensure you're using the correct import paths:
```javascript
// ✅ Correct - Specific submodule
const utils = require('@orchestr8/testkit/utils')

// ❌ Incorrect - Main package (won't work in CJS)
const testkit = require('@orchestr8/testkit')
```

## Conclusion

While @orchestr8/testkit provides CommonJS compatibility for core utilities, **the recommended approach is to use ESM** for all testing-related functionality. The CJS support is primarily intended for:

1. **Utility functions** in build scripts and tools
2. **File system operations** in legacy projects
3. **Gradual migration** from CJS to ESM
4. **Interoperability** with existing CommonJS codebases

For full functionality and the best developer experience, migrate to ESM when possible.