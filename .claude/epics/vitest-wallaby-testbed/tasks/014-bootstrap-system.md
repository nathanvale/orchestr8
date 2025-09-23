---
task: 014
name: Enforce import order with bootstrap
status: closed
created: 2025-09-20T03:22:42Z
updated: 2025-09-23T15:00:00Z
---

# Task 014: Enforce import order with bootstrap

## Status: ✅ COMPLETED

## Implementation Summary

Bootstrap system fully implemented to enforce correct import ordering.

### Core Implementation
- ✅ `src/bootstrap.ts` - Import order enforcement
- ✅ `src/register.ts` - Global setup integration
- ✅ Mock hoisting before consumer imports

### Bootstrap Architecture
```typescript
// bootstrap.ts - MUST be imported first
import { vi } from 'vitest'
import { mockChildProcessModule } from './cli/mock-factory'

// Hoist mocks before any consumer code
vi.mock('node:child_process', () => mockChildProcessModule)
vi.mock('child_process', () => mockChildProcessModule)

// Track bootstrap state
let bootstrapLoaded = false
export function ensureBootstrap() {
  bootstrapLoaded = true
}
```

### Register Integration
```typescript
// register.ts - Used in setupFiles
import './bootstrap' // FIRST
import { setupProcessMocking } from './cli/process-mock'

// Install lifecycle hooks
if (typeof beforeAll !== 'undefined') {
  beforeAll(() => setupProcessMocking())
}
```

### Key Features
- **Guaranteed early execution**: Before any consumer imports
- **Load tracking**: Detects multiple loads
- **Debug support**: TESTKIT_DEBUG environment variable
- **Lifecycle hooks**: Automatic test cleanup
- **Module compatibility**: Works with all import styles

### Usage Pattern
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['@template/testkit/register']
  }
})
```

## Verification
- Bootstrap loads before tests
- Mocks available immediately
- No timing race conditions
- Works with Wallaby and Vitest
- Consumer code sees mocked modules