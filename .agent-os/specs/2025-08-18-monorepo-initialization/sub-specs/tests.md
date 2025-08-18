# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-18-monorepo-initialization/spec.md

> Created: 2025-08-18
> Version: 1.0.0

## Test Coverage

### Build System Tests

**Monorepo Commands**

- Verify `pnpm install` installs all dependencies
- Verify `pnpm build` compiles all packages in dependency order
- Verify `pnpm test` runs tests across all packages
- Verify `pnpm dev` starts development mode
- Verify `pnpm lint` checks all packages

**Turborepo Caching**

- Verify build cache works correctly
- Verify test cache invalidates on source changes
- Verify pipeline dependencies execute in order

### Package Structure Tests

**Each Package (@orchestr8/core, resilience, schema, agent-base, testing, cli)**

- Verify package.json has correct name and type: "module"
- Verify TypeScript configuration extends base config
- Verify Vitest configuration works
- Verify exports are properly defined
- Verify inter-package imports resolve correctly

### TypeScript Configuration Tests

**Project References**

- Verify all packages compile with strict mode
- Verify type checking works across package boundaries
- Verify incremental builds work correctly
- Verify no circular dependencies

### Wallaby.js Integration Tests

**Configuration Validation**

- Verify Wallaby.js starts successfully
- Verify inline test feedback works
- Verify coverage reporting functions
- Verify all packages are included in Wallaby scope
- Verify mnemosyne patterns are properly applied

### Development Workflow Tests

**Hot Reload**

- Verify changes in one package trigger rebuilds
- Verify dependent packages update automatically
- Verify test watch mode works

## Mocking Requirements

- **File System:** Mock file operations for testing build outputs
- **Process Spawning:** Mock child processes for testing CLI commands
- **Module Resolution:** Mock node module resolution for testing imports

## Validation Against Mnemosyne

The test suite should validate that our setup matches critical aspects of the mnemosyne repository:

- Wallaby.js configuration structure
- Vitest setup patterns
- Turborepo pipeline definitions
- Package naming conventions
- Test file organization
