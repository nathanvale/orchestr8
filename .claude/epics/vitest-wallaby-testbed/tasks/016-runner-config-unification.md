---
task: 016
name: Unify runner configuration
status: open
priority: medium
created: 2025-09-20T03:22:42Z
updated: 2025-09-23T15:00:00Z
---

# Task 016: Unify runner configuration

## Status: 🔶 NEEDS VALIDATION

## Current State

Runner configuration is mostly unified but needs validation across environments.

### Implementation Status

- ✅ Base config created (`src/config/vitest.base.ts`)
- ✅ Wallaby-specific optimizations included
- ✅ Environment detection working
- ⚠️ Need to verify Wallaby uses package configs
- ⚠️ Need consumer adoption validation

### What's Implemented

```typescript
// vitest.base.ts provides:
- Fork pool strategy
- Environment-aware worker caps
- Wallaby optimizations (single worker, no coverage)
- CI optimizations (JUnit, resource limits)
- Automatic register setup
```

### Configuration Hierarchy

1. Root `vitest.config.ts` - Used by Wallaby
2. Package `vitest.config.ts` - Uses base config
3. Base config - Provides unified settings

### Remaining Work

#### 1. Wallaby Configuration Alignment

- Verify Wallaby honors package-level configs
- OR update root config to load package setupFiles
- Test with actual Wallaby instance

#### 2. Consumer Adoption

- Update all packages to use base config
- Ensure register is included in setupFiles
- Validate across different package types

#### 3. Documentation

- Document configuration hierarchy
- Provide migration guide
- Create troubleshooting guide

## Verification Needed

- Test Wallaby with package configs
- Validate CI behavior
- Check resource limits work
- Ensure no config drift
