---
task: 001
name: Setup testkit package structure
status: closed
created: 2025-09-20T03:22:42Z
updated: 2025-09-23T15:00:00Z
---

# Task 001: Setup testkit package structure

## Status: ✅ COMPLETED

## Implementation Summary

The testkit package has been fully set up with a comprehensive structure:

### Package Configuration
- ✅ `package.json` with proper exports and dependencies
- ✅ TypeScript configuration with proper paths
- ✅ Vitest configuration for self-testing
- ✅ Build configuration with tsup

### Directory Structure
```
packages/testkit/
├── src/
│   ├── bootstrap.ts       # Import order enforcement
│   ├── register.ts        # Global setup
│   ├── setup.ts          # Test lifecycle hooks
│   ├── index.ts          # Main exports
│   ├── cli/             # CLI mocking utilities
│   ├── config/          # Vitest configurations
│   ├── containers/      # Database containers
│   ├── convex/         # Convex test harness
│   ├── env/            # Environment utilities
│   ├── fs/             # File system utilities
│   └── msw/            # MSW server setup
└── tests/              # Consumer API tests
```

### Export Structure
- Main barrel export: `@template/testkit`
- Subpath exports for each module:
  - `@template/testkit/msw`
  - `@template/testkit/cli`
  - `@template/testkit/env`
  - `@template/testkit/fs`
  - `@template/testkit/containers`
  - `@template/testkit/convex`
  - `@template/testkit/config`

## Verification
- Package builds successfully
- All exports resolve correctly
- Tests pass with proper isolation
- Wallaby integration working