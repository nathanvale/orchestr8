---
task: 002
name: Implement MSW server configuration
status: closed
created: 2025-09-20T03:22:42Z
updated: 2025-09-23T15:00:00Z
---

# Task 002: Implement MSW server configuration

## Status: ✅ COMPLETED

## Implementation Summary

MSW server configuration fully implemented with strict defaults and environment
awareness.

### Core Components

- ✅ `src/msw/server.ts` - Singleton server instance
- ✅ `src/msw/config.ts` - Environment-aware configuration
- ✅ `src/msw/setup.ts` - Lifecycle management
- ✅ `src/msw/handlers.ts` - Handler utilities

### Features Implemented

- **Strict mode by default**: `onUnhandledRequest: 'error'`
- **Environment detection**: Quieter in Wallaby, configurable via
  `MSW_ON_UNHANDLED_REQUEST`
- **Singleton pattern**: Prevents multiple server instances
- **Full lifecycle**: beforeAll/afterEach/afterAll hooks
- **Suite-scoped helpers**: Handler management per test suite
- **Timeout configuration**: Shorter timeouts in test environment

### Configuration Options

```typescript
- onUnhandledRequest: 'error' | 'warn' | 'bypass'
- Environment variables support
- Wallaby-specific optimizations
- Resource tracking and cleanup
```

## Verification

- Server starts/stops correctly
- Unhandled requests throw errors as expected
- Environment detection working
- Handler reset between tests
- No resource leaks
