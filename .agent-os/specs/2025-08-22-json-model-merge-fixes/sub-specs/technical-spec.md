# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-22-json-model-merge-fixes/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Technical Requirements

### Critical Fix Requirements

1. **Property Test Stabilization**
   - Failing test: `packages/core/src/event-bus-property.test.ts:152`
   - Issue: Circular buffer FIFO order test with flaky assertions
   - Solution: Fix test logic or mark as skipped with detailed TODO

2. **TypeScript `any` Type Elimination**
   - Zero tolerance policy violation in CLI package
   - 36+ instances of forbidden `any` types
   - Must use proper type definitions or `unknown` with type guards

3. **ESLint Compliance**
   - 63 total linting errors across CLI package
   - Import/export ordering violations (perfectionist plugin)
   - Missing type imports consistency

4. **Test Coverage Restoration**
   - New files without corresponding tests
   - Coverage below 80% target requirement
   - Missing integration tests for enhanced journal

### High Priority Requirements

1. **Memory Leak Prevention**
   - Event listener cleanup in `EnhancedExecutionJournal`
   - Proper disposal patterns for long-running objects
   - WeakMap usage for automatic cleanup

2. **Race Condition Resolution**
   - Journal entry processing order consistency
   - Replace `setImmediate` with ordered queue
   - Prevent concurrent modification issues

3. **CLI Implementation Completion**
   - Unfinished command implementations
   - Missing error handling in CLI commands
   - Incomplete test coverage for CLI functionality

## Approach Options

### Option A: Quick Fix (Selected)

- Focus only on merge-blocking issues
- Minimal changes to existing code
- Fast path to production deployment

**Pros:**

- Fastest time to merge
- Lowest risk of introducing new bugs
- Maintains current functionality

**Cons:**

- Some issues remain for future sprints
- Technical debt accumulation

### Option B: Complete Overhaul

- Comprehensive refactoring of problem areas
- Full test suite enhancement
- Perfect code quality across all packages

**Pros:**

- Eliminates all technical debt
- Perfect code quality standards
- Future-proof implementation

**Cons:**

- Significantly longer timeline
- Higher risk of introducing regressions
- Delays critical MVP delivery

**Rationale:** Option A selected to unblock immediate merge while maintaining quality standards for critical issues.

## External Dependencies

### Required Tools

- **ESLint**: Code quality enforcement
- **Prettier**: Code formatting consistency
- **Vitest**: Test framework for new tests
- **TypeScript**: Type checking and compilation

### New Dependencies

- None required - using existing toolchain

## Implementation Strategy

### Phase 1: Critical Blockers (Day 1)

1. Fix the failing property test immediately
2. Run `pnpm lint --fix` to auto-fix ordering issues
3. Manually fix all `any` type violations
4. Verify all tests pass

### Phase 2: High Priority (Day 2)

1. Add missing test files for new functionality
2. Implement proper disposal patterns
3. Fix race conditions in journal processing
4. Complete or remove CLI command stubs

### Phase 3: Validation (Day 3)

1. Run full test suite multiple times to ensure stability
2. Verify linting and type checking pass
3. Confirm test coverage meets 80% requirement
4. Validate branch is ready for merge

## Quality Gates

Before marking this spec complete, all of the following must pass:

- [ ] `pnpm test:ci` succeeds consistently (3 runs minimum)
- [ ] `pnpm lint` shows zero errors
- [ ] `pnpm type-check` passes without warnings
- [ ] `pnpm format:check` passes
- [ ] Test coverage ≥80% maintained
- [ ] No `any` types remain in codebase
- [ ] All import ordering follows perfectionist rules
