---
task: 009
name: Setup CLI command mocking utilities
status: closed
created: 2025-09-20T03:22:42Z
updated: 2025-09-23T15:00:00Z
---

# Task 009: Setup CLI command mocking utilities

## Status: ✅ COMPLETED

## Implementation Summary

CLI mocking fully implemented with factory-based approach and import order
enforcement.

### Core Implementation

- ✅ `src/cli/mock-factory.ts` - Authoritative mock factory
- ✅ `src/cli/process-mock.ts` - Process mocking API
- ✅ `src/cli/registry.ts` - Centralized mock registry
- ✅ `src/cli/spawn.ts` - Spawn utilities
- ✅ `src/cli/normalize.ts` - Command normalization
- ✅ `src/bootstrap.ts` - Import order enforcement

### Architectural Solution

Implements the recommended redesign from the epic:

1. **Single Authoritative Mock Factory**: Created at module mock time
2. **Import Order Enforcement**: Bootstrap hoists vi.mock before imports
3. **Unified Registry**: Central state management
4. **Quad-Register Pattern**: spawn/exec/execSync/fork all mocked

### Features Implemented

- **Full child_process coverage**: All methods mocked
  - spawn, spawnSync
  - exec, execSync
  - execFile, execFileSync
  - fork
- **Node-like error semantics**: Proper ENOENT, exit codes
- **Promise support**: **promisify** compatibility
- **Call tracking**: Full history and verification
- **Pattern matching**: Command and argument matching
- **Resource cleanup**: Automatic between tests

### Mock Factory Pattern

```typescript
vi.mock('node:child_process', () => mockChildProcessModule)
vi.mock('child_process', () => mockChildProcessModule)
```

### Process Mocking API

- `mockProcess()` - Configure mock responses
- `mockCommand()` - Mock specific commands
- `verifyCommand()` - Assert command execution
- `getProcessCalls()` - Retrieve call history

## Verification

- All child_process methods mocked
- Import order properly enforced
- No timing issues with vi.mock
- Call tracking accurate
- Cleanup between tests working
