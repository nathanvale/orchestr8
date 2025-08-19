# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-19-logger-package-migration/spec.md

> Created: 2025-08-19
> Version: 1.0.0

## Test Coverage

### Unit Tests

**MemoryLogger (@orchestr8/logger)**

- Constructor initializes with empty entries and optional context
- log() method stores entries with correct level, message, and data
- trace/debug/info/warn/error methods delegate to log() correctly
- child() creates new logger with merged context
- getEntries() returns all stored log entries
- getEntriesByLevel() filters entries by log level
- clear() removes all entries
- count() returns correct number of entries
- Context inheritance works across child loggers

**NoopLogger (@orchestr8/logger)**

- All log methods are no-ops (already tested)
- child() returns same instance (already tested)

### Integration Tests

**Core Package Logger Usage**

- OrchestrationEngine accepts logger from @orchestr8/logger
- Structured logging events are emitted during workflow execution
- Child loggers are created with execution context
- Logger can be undefined (uses NoOpLogger by default)

**Test Package Logger Usage**

- Test utilities can use MemoryLogger to verify logging
- MemoryLogger captures all expected log events
- Log entries can be asserted in tests

### Migration Verification Tests

**Import Resolution**

- All files importing logger types compile without errors
- No remaining references to core/logger.ts
- No remaining Logger types in core/types.ts

**Build Tests**

- `pnpm build` completes successfully
- No circular dependency warnings
- Correct build order with logger package first

**Runtime Tests**

- All existing tests pass after migration
- No runtime import errors
- Logger functionality unchanged

## Test Execution Strategy

1. **Pre-Migration Baseline**
   - Run all tests to establish passing baseline
   - Note any logger-specific test patterns

2. **Post-Migration Validation**
   - Run `pnpm test:ci` from root
   - Verify all packages pass tests
   - Check for any new TypeScript errors

3. **Specific Test Commands**

   ```bash
   # Test logger package
   cd packages/logger && pnpm test:ci

   # Test core package
   cd packages/core && pnpm test:ci

   # Test from root (all packages)
   pnpm test:ci
   ```

## Mocking Requirements

- No special mocking needed for MemoryLogger (it's already a test double)
- NoopLogger can be used when logging behavior doesn't need verification
- No external service mocks required
