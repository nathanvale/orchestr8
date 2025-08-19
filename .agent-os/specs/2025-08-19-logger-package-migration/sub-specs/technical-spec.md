# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-19-logger-package-migration/spec.md

> Created: 2025-08-19
> Version: 1.0.0

## Technical Requirements

### Logger Package Enhancements

- Port MemoryLogger class from @orchestr8/core/src/logger.ts to @orchestr8/logger
- Ensure MemoryLogger implements the Logger interface from @orchestr8/logger/src/types.ts
- Add MemoryLogger export to @orchestr8/logger/src/index.ts
- Maintain full API compatibility with existing MemoryLogger usage

### Core Package Modifications

- Add @orchestr8/logger as a dependency in package.json
- Remove Logger, LogLevel, and LogEntry type definitions from core/src/types.ts
- Delete entire core/src/logger.ts file
- Update core/src/index.ts to re-export logger types and implementations from @orchestr8/logger

### Import Path Updates

- Replace all imports of logger types from './types.js' with '@orchestr8/logger'
- Update test files to import MemoryLogger from '@orchestr8/logger'
- Ensure all logger usage points to the centralized package

## Dependency Architecture

### Before Migration

```
schema → resilience → core (contains logger) → testing → cli
            ↓
       agent-base
```

### After Migration

```
logger (no @orchestr8 deps)
    ↓
schema → resilience → core → testing → cli
            ↓
       agent-base
```

## Implementation Details

### MemoryLogger Implementation

The MemoryLogger in @orchestr8/logger should:

- Store log entries in memory with full structured data
- Support child logger creation with context inheritance
- Provide methods to retrieve and filter log entries
- Clear logs on demand for test isolation
- Match the existing API from core's implementation

### Type Alignment

The @orchestr8/logger package already defines:

- `Logger` interface with child(), trace(), debug(), info(), warn(), error() methods
- `LogLevel` type as union of 'trace' | 'debug' | 'info' | 'warn' | 'error'
- `LogFields` type alias for Record<string, unknown>

These align with core's current types, enabling a clean migration.

### Build Order

Turborepo will automatically handle the build order:

1. @orchestr8/logger (no dependencies)
2. @orchestr8/schema (no dependencies)
3. @orchestr8/resilience (depends on schema)
4. @orchestr8/agent-base (depends on schema)
5. @orchestr8/core (depends on logger, resilience, schema, agent-base)
6. @orchestr8/testing (depends on core, agent-base, schema)
7. @orchestr8/cli (depends on core, schema)

## External Dependencies

No new external dependencies are required. The @orchestr8/logger package already exists and has all necessary infrastructure.

## Migration Risks

- **Risk**: Import path errors if not all references are updated
  - **Mitigation**: TypeScript compilation will catch missing imports
- **Risk**: Runtime errors if logger initialization changes
  - **Mitigation**: Keep exact same API surface, only change import location

- **Risk**: Test failures if MemoryLogger behavior differs
  - **Mitigation**: Port implementation exactly as-is, enhance later if needed
