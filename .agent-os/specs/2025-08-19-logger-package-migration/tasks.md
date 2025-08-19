# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-19-logger-package-migration/spec.md

> Created: 2025-08-19
> Status: Ready for Implementation

## Tasks

- [x] 1. Add MemoryLogger to @orchestr8/logger package
  - [x] 1.1 Create packages/logger/src/adapters/memory.ts with MemoryLogger implementation
  - [x] 1.2 Add comprehensive tests in packages/logger/src/adapters/memory.test.ts
  - [x] 1.3 Export MemoryLogger from packages/logger/src/index.ts
  - [x] 1.4 Verify MemoryLogger implements Logger interface correctly

- [x] 2. Update @orchestr8/core package dependencies
  - [x] 2.1 Add "@orchestr8/logger": "workspace:\*" to core/package.json dependencies
  - [x] 2.2 Run pnpm install to update lockfile
  - [x] 2.3 Verify dependency resolution works correctly

- [x] 3. Remove logger implementations from @orchestr8/core
  - [x] 3.1 Delete packages/core/src/logger.ts file entirely
  - [x] 3.2 Delete packages/core/src/logger.test.ts file
  - [x] 3.3 Remove Logger, LogLevel, LogEntry types from packages/core/src/types.ts
  - [x] 3.4 Update packages/core/src/index.ts to import and re-export from @orchestr8/logger

- [x] 4. Update all imports in @orchestr8/core
  - [x] 4.1 Update orchestration-engine.ts to import Logger from @orchestr8/logger
  - [x] 4.2 Update structured-logging.test.ts to import MemoryLogger from @orchestr8/logger
  - [x] 4.3 Update any other files that reference logger types
  - [x] 4.4 Ensure all imports use correct paths

- [x] 5. Verify build and test pipeline
  - [x] 5.1 Run pnpm build from root to verify build order
  - [x] 5.2 Run pnpm test:ci to ensure all tests pass
  - [x] 5.3 Run pnpm check for formatting, linting, and type checking
  - [x] 5.4 Verify no circular dependency warnings
