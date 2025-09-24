---
task: 013
name: Implement single authoritative mock factory
status: closed
created: 2025-09-20T03:22:42Z
updated: 2025-09-23T15:00:00Z
---

# Task 013: Implement single authoritative mock factory

## Status: ✅ COMPLETED

## Implementation Summary

Single authoritative mock factory pattern fully implemented for CLI mocking.

### Core Implementation

- ✅ `src/cli/mock-factory.ts` - Central mock module factory
- ✅ Registry-backed state management
- ✅ Compile-time mock creation

### Architectural Achievement

Successfully addresses the critical design flaw identified in the epic:

- Mock factory created at vi.mock time (not runtime)
- No runtime patching after module load
- Eliminates timing issues with vi.mock hoisting

### Factory Pattern

```typescript
// Created once at mock time, pulls from registry
export const mockChildProcessModule = {
  spawn: vi.fn((command, args, options) => {
    return registry.spawn(command, args, options)
  }),
  exec: vi.fn((command, options, callback) => {
    return registry.exec(command, options, callback)
  }),
  // ... all other methods
}
```

### Key Features

- **Single source of truth**: One factory for all imports
- **Registry delegation**: Behavior pulled from central registry
- **Hoisting compatible**: Works with vi.mock hoisting
- **Module resolution**: Handles both 'child_process' and 'node:child_process'
- **Type safety**: Full TypeScript support

### Integration Points

- Used by bootstrap.ts for early setup
- Registry provides runtime behavior
- Process mocker configures registry
- Test utilities interact via registry

## Verification

- Factory creation happens at right time
- No undefined returns from methods
- Registry delegation working
- Type inference correct
- Both import styles supported
