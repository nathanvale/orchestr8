# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-09-03-quality-check-extraction/spec.md

> Created: 2025-09-03  
> Version: 2.0.0  
> Status: Ready for Implementation

## Tasks

- [x] 1. Create Package Structure and Configuration
  - [x] 1.1 Write integration tests for package creation and npx execution
  - [x] 1.2 Create packages/quality-check directory with no-bin structure
  - [x] 1.3 Setup package.json with @template/quality-check name (no bin field)
  - [x] 1.4 Configure single entry point src/index.ts for all modes
  - [x] 1.5 Setup exports map for ESM module usage
  - [x] 1.6 Verify npx execution works without global installation

- [x] 2. Implement Core Quality Checkers
  - [x] 2.1 Write integration tests for ESLint, Prettier, and TypeScript
        checking
  - [x] 2.2 Extract and simplify ESLint checker from claude-hooks system
  - [x] 2.3 Implement Prettier checker with advanced caching strategies
  - [x] 2.4 Create TypeScript checker with Node.js 22 compile cache support
  - [x] 2.5 Add common issues checker for basic patterns
  - [x] 2.6 Verify all checkers pass performance and functionality tests

- [x] 3. Build Claude Code PostToolUse Integration
  - [x] 3.1 Write integration tests for Claude Code hook JSON input formats
  - [x] 3.2 Implement file path extraction for production and legacy formats
  - [x] 3.3 Create stdin JSON parsing with auto-detection (no --hook flag)
  - [x] 3.4 Add environment variable integration (CLAUDE_PROJECT_DIR)
  - [x] 3.5 Implement exit code strategy (0-5, 124)
  - [x] 3.6 Verify hook integration with correlation ID tracking

- [x] 4. Implement No-Bin Architecture
  - [x] 4.1 Write integration tests for npx execution
  - [x] 4.2 Create single entry point with mode auto-detection
  - [x] 4.3 Implement hook mode auto-detection via stdin
  - [x] 4.4 Add file mode (--file) for direct file validation
  - [x] 4.5 Add shebang to dist/index.js for npx execution
  - [x] 4.6 Verify npx @template/quality-check works correctly

- [x] 5. Implement Security and File Safety
  - [x] 5.1 Write security tests for path traversal prevention
  - [x] 5.2 Implement atomic file operations with write-file-atomic
  - [x] 5.3 Add backup/restore capability for safe auto-fixes
  - [x] 5.4 Create file locking mechanism with proper-lockfile
  - [x] 5.5 Add input sanitization and command injection prevention
  - [x] 5.6 Implement resource limits (memory, timeout, concurrency)

- [x] 6. Add Structured Logging with Correlation IDs
  - [x] 6.1 Write integration tests for correlation ID generation
  - [x] 6.2 Implement correlation ID pattern (qc-node-timestamp-random)
  - [x] 6.3 Integrate @orchestr8/logger for structured logging
  - [x] 6.4 Add performance metrics collection and tracking
  - [x] 6.5 Create output formatting for Claude Code vs CLI
  - [x] 6.6 Implement debug mode with trace file support

- [x] 7. Optimize for 2025 Performance Requirements
  - [x] 7.1 Write performance tests for <2s execution target
  - [x] 7.2 Configure ESLint v9.34+ with multithread support
  - [x] 7.3 Implement TypeScript 5.7+ compile cache integration
  - [x] 7.4 Add Prettier content-based caching system
  - [x] 7.5 Optimize parallel checker execution where safe
  - [x] 7.6 Verify performance targets are consistently met

- [ ] 8. Implement Git Integration
  - [x] 8.1 Write tests for gitignore pattern matching
  - [ ] 8.2 Integrate simple-git for repository awareness
  - [ ] 8.3 Add gitignore parsing with ignore package
  - [ ] 8.4 Implement pre-commit mode for staged files only
  - [ ] 8.5 Add skip logic for ignored files
  - [ ] 8.6 Verify git integration works correctly

- [x] 9. Create Migration Support
  - [x] 9.1 Write migration guide documentation
  - [x] 9.2 Create configuration migration script
  - [x] 9.3 Add cache directory migration utility
  - [x] 9.4 Implement legacy config detection and conversion
  - [x] 9.5 Add rollback procedures documentation
  - [x] 9.6 Test migration from claude-hooks package

- [ ] 10. Final Integration and Package Testing
  - [ ] 10.1 Run complete end-to-end integration test suite
  - [ ] 10.2 Test npx execution without installation
  - [ ] 10.3 Validate Claude Code PostToolUse hook integration
  - [ ] 10.4 Verify all exit codes work correctly
  - [ ] 10.5 Confirm <2s performance requirement is met
  - [ ] 10.6 Package ready for NPM distribution
