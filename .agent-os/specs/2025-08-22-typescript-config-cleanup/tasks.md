# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-22-typescript-config-cleanup/spec.md

> Created: 2025-08-22
> Status: Ready for Implementation

## Tasks

- [x] 1. Remove TypeScript Project References
  - [x] 1.1 Write tests for root tsconfig.json validation
  - [x] 1.2 Remove "references" array from root tsconfig.json
  - [x] 1.3 Remove "references" from packages/agent-base/tsconfig.json
  - [x] 1.4 Remove "references" from packages/core/tsconfig.json
  - [x] 1.5 Remove "references" from packages/testing/tsconfig.json
  - [x] 1.6 Verify customConditions inheritance works properly
  - [x] 1.7 Test build process still works after reference removal
  - [x] 1.8 Verify all tests pass

- [x] 2. Standardize Type-Checking Configuration
  - [x] 2.1 Write tests for type-check script validation
  - [x] 2.2 Remove packages/agent-base/tsconfig.typecheck.json
  - [x] 2.3 Remove packages/cli/tsconfig.typecheck.json
  - [x] 2.4 Remove packages/core/tsconfig.typecheck.json
  - [x] 2.5 Remove packages/resilience/tsconfig.typecheck.json
  - [x] 2.6 Remove packages/testing/tsconfig.typecheck.json
  - [x] 2.7 Update package.json scripts to use "tsc --noEmit" for logger package
  - [x] 2.8 Update package.json scripts to use "tsc --noEmit" for schema package
  - [x] 2.9 Verify all packages have consistent type-check scripts
  - [x] 2.10 Test independent type-checking works for all packages
  - [x] 2.11 Verify all tests pass

- [x] 3. Fix Build Configuration Issues
  - [x] 3.1 Write tests for build artifact validation
  - [x] 3.2 Review CJS build configs for customConditions inheritance issues
  - [x] 3.3 Fix packages/core/tsconfig.cjs.json if needed
  - [x] 3.4 Ensure packages/logger/tsconfig.cjs.json remains standalone
  - [x] 3.5 Test dual package consumption (ESM/CJS) works correctly
  - [x] 3.6 Verify development condition points to source files
  - [x] 3.7 Verify all tests pass

- [x] 4. Optimize Turbo Configuration
  - [x] 4.1 Write tests for turbo task dependency validation
  - [x] 4.2 Remove type-check dependency on "^build" in turbo.json
  - [x] 4.3 Verify type-check task runs independently
  - [x] 4.4 Test parallel execution of build and type-check tasks
  - [x] 4.5 Validate Turbo caching works efficiently
  - [x] 4.6 Verify all tests pass

- [x] 5. Comprehensive Validation and Testing
  - [x] 5.1 Run complete test suite across all packages
  - [x] 5.2 Test `pnpm build` succeeds without TypeScript errors
  - [x] 5.3 Test `pnpm type-check` works independently
  - [x] 5.4 Validate `pnpm check` passes all quality gates
  - [x] 5.5 Test clean install and build from scratch
  - [x] 5.6 Verify Turbo cache effectiveness with repeated runs
  - [x] 5.7 Test individual package builds work correctly
  - [x] 5.8 Verify all tests pass
