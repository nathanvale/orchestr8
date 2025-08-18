# Repository Prerequisites

This document outlines the repository-level infrastructure changes required before beginning core orchestration engine implementation.

> Created: 2025-08-18
> Version: 1.1.0
> Updated: 2025-08-18
> Status: Prerequisites Checklist

## Overview

The core orchestration engine requires specific infrastructure prerequisites to support modern JavaScript features, expression evaluation, and proper dependency management. **All items must be completed before any implementation begins.**

## Node.js Version Requirements

### Engine Specification

**Required Change:** Add engines field to package.json files

**Files to update:**

- Root package.json
- packages/schema/package.json
- packages/resilience/package.json
- packages/agent-base/package.json
- packages/core/package.json
- packages/testing/package.json
- packages/cli/package.json

**Required engines field:**

```json
{
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Rationale:** Node >=20 provides:

- `AbortSignal.any()` for cascading cancellation
- `AbortSignal.timeout()` for timeout implementation
- Improved performance for modern JavaScript features
- Required for resilience pattern implementation

### Validation Command

```bash
# Verify Node version meets requirements
node --version  # Must output v20.x.x or higher
```

## JMESPath Dependency

### Package Installation

**Required Change:** Add jmespath dependency to @orchestr8/core

**Command:**

```bash
cd packages/core
pnpm add jmespath@^0.16.0
```

**Package selection rationale:**

- Mature, stable library with extensive test coverage
- Safe expression evaluation (no arbitrary code execution)
- Compilation and caching support for performance
- TypeScript definitions available

### Import verification

**Test command:**

```bash
cd packages/core
NODE_ENV=development node -e "import('jmespath').then(m => console.log('✅ JMESPath import works'))"
```

## TypeScript Configuration

### Target and Module Settings

**Required verification:** Ensure ES2022+ target in all tsconfig.json files

**Check command:**

```bash
# Verify TypeScript configuration
pnpm type-check
```

**Required settings in tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Strict Mode Validation

**Purpose:** Ensure type safety for expression evaluation and error handling

**Critical settings:**

- `strict: true` - Enable all strict type-checking options
- `noUncheckedIndexedAccess: true` - Prevent runtime errors from undefined properties
- `exactOptionalPropertyTypes: true` - Strict optional property handling

## Test Framework Compatibility

### Wallaby.js Setup

**Required verification:** Ensure Wallaby.js compatible mock patterns

**Test pattern requirement:**

```typescript
// Use mockImplementation instead of mockReturnValue for Wallaby compatibility
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockImplementation(() => 'mock-content'),
}))
```

**Validation:**

- Wallaby.js can run all existing tests
- Mock patterns use mockImplementation for compatibility
- No test timing issues with fake timers

### Vitest Configuration

**Required settings in vitest.config.ts:**

```typescript
export default defineConfig({
  test: {
    pool: 'threads',
    environment: 'node',
    setupFiles: ['./test-setup.ts'],
  },
})
```

**Test setup requirements:**

```typescript
// test-setup.ts
import { beforeEach } from 'vitest'
import { vi } from 'vitest'

beforeEach(() => {
  vi.resetAllMocks()
})
```

## Build System Validation

### Turborepo Compatibility

**Verification command:**

```bash
# Ensure Turborepo can build with new dependencies
pnpm build
```

**Expected outcome:**

- All packages build successfully
- No dependency resolution errors
- TypeScript compilation passes
- ES module resolution works correctly

### Package Export Validation

**Command:**

```bash
# Validate dual package consumption works with new setup
pnpm validate:dual-consumption
```

**Critical check:** Ensure jmespath import works in both development and production conditions.

## Prerequisites Completion Checklist

### Infrastructure Setup

- [ ] Node >=20 engines field added to all package.json files
- [ ] jmespath dependency added to @orchestr8/core
- [ ] TypeScript target ES2022+ verified in all packages
- [ ] Strict mode enabled across all TypeScript configurations

### Validation Passing

- [ ] `node --version` shows >=20.0.0
- [ ] `pnpm type-check` passes without errors
- [ ] `pnpm build` completes successfully
- [ ] `pnpm test` runs with Wallaby.js compatibility
- [ ] `pnpm validate:dual-consumption` passes
- [ ] JMESPath import test succeeds

### Documentation Updates

- [ ] CLAUDE.md updated with new dependency information
- [ ] README dependencies section reflects Node >=20 requirement
- [ ] Development guide mentions jmespath for expression evaluation

## Schema Hash Helper Export

### API Naming Clarification

**Required Change:** Export schema hash helper with clear naming in @orchestr8/schema

**Current State:** `WorkflowSchemaValidator.calculateSchemaHash` exists but naming is ambiguous

**Required Action:**

1. Create clear export alias: `computeWorkflowSchemaHash`
2. Update documentation to clarify this is a **schema structure hash** (constant per schema version)
3. Not a content hash of individual workflows

**Implementation in @orchestr8/schema:**

```typescript
// Export with clear naming
export { calculateSchemaHash as computeWorkflowSchemaHash } from './validators/workflow-schema-validator.js'

// Or create explicit function
export function computeWorkflowSchemaHash(): string {
  // Returns hash of the workflow schema structure
  // This is constant for a given schema version
  return WorkflowSchemaValidator.calculateSchemaHash()
}
```

**CLI Command for Schema Hash:**

```bash
# Add to @orchestr8/cli
orchestr8 schema hash  # Outputs current schema hash for workflow files
```

**Documentation Update:**

- `schemaHash` is a constant identifier for the workflow schema version/structure
- Used to validate that workflows match the expected schema version
- Not unique per workflow content (that would be a different feature)

## Troubleshooting

### Common Issues

**Node version mismatch:**

```bash
# Update Node using your preferred method
nvm install 20
nvm use 20
```

**TypeScript compilation errors:**

```bash
# Clean and rebuild TypeScript artifacts
pnpm clean
pnpm type-check
```

**JMESPath import failures:**

```bash
# Verify installation
cd packages/core
npm list jmespath
```

### Validation Failures

**Build failures after jmespath addition:**

1. Verify package.json syntax is correct
2. Check TypeScript import statements use ES module syntax
3. Ensure no circular dependencies introduced

**Test compatibility issues:**

1. Verify Wallaby.js configuration includes new dependencies
2. Check mock patterns use mockImplementation
3. Validate fake timer setup for expression timeouts

## Go/No-Go Criteria

### GREEN (Ready to Proceed) ✅

- All infrastructure changes completed
- All validation commands pass
- Documentation updated
- No build or test failures

### RED (Blocked) 🔴

- Node version <20.0.0
- JMESPath import failures
- TypeScript compilation errors
- Test framework incompatibilities
- Build system failures

**Implementation cannot begin until all criteria are GREEN.**
