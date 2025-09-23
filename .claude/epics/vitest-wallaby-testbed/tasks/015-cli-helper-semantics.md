---
task: 015
name: Align CLI helper semantics
status: open
priority: low
created: 2025-09-20T03:22:42Z
updated: 2025-09-23T15:00:00Z
---

# Task 015: Align CLI helper semantics

## Status: 🔶 NEEDS DOCUMENTATION

## Current State

The CLI helpers are functionally complete but need documentation alignment.

### Implementation Status
- ✅ `quickMocks()` implemented with quad-register pattern
- ✅ All child_process methods properly mocked
- ✅ Helper functions work correctly
- ⚠️ Documentation needs updating to match implementation

### The Issue
Original concern: `quickMocks` might only register spawn mocks while tests use exec/execSync
Current reality: `quickMocks` DOES register all methods (spawn/exec/execSync/fork)

### What's Implemented
```typescript
// Quad-register pattern in quickMocks
export function quickMocks() {
  // Registers ALL methods:
  - spawn/spawnSync
  - exec/execSync
  - execFile/execFileSync
  - fork
}
```

### Remaining Work
1. **Update documentation** to clarify that quickMocks is comprehensive
2. **Add explicit tests** demonstrating all methods work
3. **Create usage examples** for each method type
4. **Document the quad-register pattern**

## Verification Needed
- Confirm documentation matches implementation
- Add integration tests for all methods
- Validate with real consumer usage