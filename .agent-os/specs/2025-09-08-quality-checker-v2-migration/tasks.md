# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-09-08-quality-checker-v2-migration/spec.md

> Created: 2025-09-08 Status: Ready for Implementation

## Tasks

### Phase 1: Facade Testing and Preparation

- [x] 1. Write comprehensive V2 facade compatibility tests
  - [x] 1.1 Create test suite for api.ts facade with V2 implementation
  - [x] 1.2 Create test suite for git-hook.ts facade with V2 implementation
  - [x] 1.3 Create test suite for test-utils/api-wrappers.ts with V2
  - [x] 1.4 Write backward compatibility verification tests
  - [x] 1.5 Add integration tests for facade interactions
  - [x] 1.6 Verify all new tests pass

- [x] 2. Update api.ts facade to use QualityCheckerV2
  - [x] 2.1 Replace QualityChecker import with QualityCheckerV2
  - [x] 2.2 Update instantiation and configuration logic
  - [x] 2.3 Verify all API methods work correctly with V2
  - [x] 2.4 Run api.test.ts to confirm functionality
  - [x] 2.5 Fix any compatibility issues found
  - [x] 2.6 Verify api.ts tests pass with V2

- [x] 3. Update git-hook.ts facade to use QualityCheckerV2
  - [x] 3.1 Replace QualityChecker import with QualityCheckerV2
  - [x] 3.2 Update pre-commit hook integration code
  - [x] 3.3 Test staged file processing with V2
  - [x] 3.4 Verify error reporting and exit codes work correctly
  - [x] 3.5 Test git hook in actual git workflow
  - [x] 3.6 Verify git-hook.ts tests pass

- [x] 4. Update test-utils/api-wrappers.ts to use V2
  - [x] 4.1 Update imports and initialization to V2
  - [x] 4.2 Verify test utility functions work with V2
  - [x] 4.3 Ensure mock and stub helpers are compatible
  - [x] 4.4 Update any type definitions for V2
  - [x] 4.5 Run tests using api-wrappers
  - [x] 4.6 Verify all wrapper tests pass

- [ ] 5. Clean up deprecated V2 facades
  - [ ] 5.1 Identify all references to claude-v2.ts
  - [ ] 5.2 Update references to use proper V2 implementation
  - [ ] 5.3 Delete claude-v2.ts file
  - [ ] 5.4 Delete claude-facade-v2.ts file
  - [ ] 5.5 Delete claude-facade-v2.test.ts file
  - [ ] 5.6 Update any remaining references in codebase
  - [ ] 5.7 Verify no broken imports after cleanup

### Phase 2: Test Coverage Migration

- [ ] 6. Create V2 error handling test suite
  - [ ] 6.1 Create quality-checker.error-handling.test.ts for V2
  - [ ] 6.2 Set up test structure and imports
  - [ ] 6.3 Port error boundary tests from V1
  - [ ] 6.4 Port exception handling tests from V1
  - [ ] 6.5 Add new edge case tests specific to V2
  - [ ] 6.6 Verify error handling tests pass

- [ ] 7. Migrate TypeScript error enhancement tests
  - [ ] 7.1 Create TypeScript error test file for V2
  - [ ] 7.2 Port type error formatting tests
  - [ ] 7.3 Port compilation error tests
  - [ ] 7.4 Port tsconfig validation tests
  - [ ] 7.5 Add tests for TypeScript 5.x specific features
  - [ ] 7.6 Verify TypeScript enhancement tests pass

- [ ] 8. Migrate ESLint error enhancement tests
  - [ ] 8.1 Create ESLint error test file for V2
  - [ ] 8.2 Port rule violation formatting tests
  - [ ] 8.3 Port warning vs error distinction tests
  - [ ] 8.4 Port eslintrc configuration tests
  - [ ] 8.5 Add tests for custom rule handling
  - [ ] 8.6 Verify ESLint enhancement tests pass

- [ ] 9. Migrate combined error reporting tests
  - [ ] 9.1 Create combined error reporting test file
  - [ ] 9.2 Port multi-error aggregation tests
  - [ ] 9.3 Port error sorting and prioritization tests
  - [ ] 9.4 Port summary generation tests
  - [ ] 9.5 Add tests for error deduplication logic
  - [ ] 9.6 Verify combined reporting tests pass

- [ ] 10. Improve test coverage to >60%
  - [ ] 10.1 Run coverage report for baseline measurement
  - [ ] 10.2 Identify uncovered code paths in V2
  - [ ] 10.3 Add tests for uncovered branches
  - [ ] 10.4 Add tests for edge cases and error conditions
  - [ ] 10.5 Run coverage report to verify >60% coverage
  - [ ] 10.6 Document coverage improvements

### Phase 3: Implementation Consolidation

- [ ] 11. Prepare for QualityChecker class rename
  - [ ] 11.1 Create tests for class rename compatibility
  - [ ] 11.2 Test that public API remains unchanged
  - [ ] 11.3 Test internal method references will work
  - [ ] 11.4 Verify type exports will work correctly
  - [ ] 11.5 Create migration checklist
  - [ ] 11.6 Run preparatory tests

- [ ] 12. Remove V1 implementation files
  - [ ] 12.1 Verify no active references to V1 quality-checker.ts
  - [ ] 12.2 Create backup of V1 implementation for reference
  - [ ] 12.3 Delete /src/core/quality-checker.ts file
  - [ ] 12.4 Remove V1-specific test files
  - [ ] 12.5 Verify build still works without V1
  - [ ] 12.6 Run tests to ensure no regressions

- [ ] 13. Clean up unused V1 dependencies
  - [ ] 13.1 Check if error-parser.ts is used by V2
  - [ ] 13.2 Verify no other files depend on error-parser.ts
  - [ ] 13.3 Delete error-parser.ts if unused
  - [ ] 13.4 Update any error parsing logic in V2 if needed
  - [ ] 13.5 Remove any other V1-only utility files
  - [ ] 13.6 Verify build and tests still pass

- [ ] 14. Rename V2 files to primary implementation
  - [ ] 14.1 Use git mv to rename quality-checker-v2.ts to quality-checker.ts
  - [ ] 14.2 Update file header comments to remove V2 references
  - [ ] 14.3 Verify file permissions are correct
  - [ ] 14.4 Update any build configuration if needed
  - [ ] 14.5 Commit the rename with clear message
  - [ ] 14.6 Verify git history is preserved

- [ ] 15. Rename QualityCheckerV2 class to QualityChecker
  - [ ] 15.1 Update class declaration from QualityCheckerV2 to QualityChecker
  - [ ] 15.2 Update constructor name
  - [ ] 15.3 Update all internal class references
  - [ ] 15.4 Update JSDoc comments to remove V2
  - [ ] 15.5 Update type definitions
  - [ ] 15.6 Verify renamed class works correctly

### Phase 4: Reference and Import Updates

- [ ] 16. Update main export files
  - [ ] 16.1 Remove QualityCheckerV2 export from index.ts
  - [ ] 16.2 Add QualityChecker export to index.ts
  - [ ] 16.3 Update type exports to use new names
  - [ ] 16.4 Add backward compatibility type aliases if needed
  - [ ] 16.5 Test that exports work correctly
  - [ ] 16.6 Verify no breaking changes for consumers

- [ ] 17. Update facade imports
  - [ ] 17.1 Update claude.ts imports to use QualityChecker
  - [ ] 17.2 Update type annotations in claude.ts
  - [ ] 17.3 Test Claude integration functionality
  - [ ] 17.4 Update any Claude-specific configuration
  - [ ] 17.5 Verify Claude facade tests pass
  - [ ] 17.6 Test end-to-end Claude workflow

- [ ] 18. Update CLI imports and functionality
  - [ ] 18.1 Update cli.ts imports to use QualityChecker
  - [ ] 18.2 Update CLI command handlers
  - [ ] 18.3 Test all CLI commands work correctly
  - [ ] 18.4 Verify help text is accurate
  - [ ] 18.5 Update CLI documentation if needed
  - [ ] 18.6 Test CLI in actual usage scenarios

- [ ] 19. Update test file imports
  - [ ] 19.1 Find all test files with QualityCheckerV2 imports
  - [ ] 19.2 Update import statements in unit tests
  - [ ] 19.3 Update import statements in integration tests
  - [ ] 19.4 Update mock and stub references
  - [ ] 19.5 Verify test compilation succeeds
  - [ ] 19.6 Run all tests to verify they pass

- [ ] 20. Global reference cleanup
  - [ ] 20.1 Use grep to find all QualityCheckerV2 occurrences
  - [ ] 20.2 Update variable names throughout codebase
  - [ ] 20.3 Update comments and inline documentation
  - [ ] 20.4 Update type definitions and interfaces
  - [ ] 20.5 Update README and documentation files
  - [ ] 20.6 Verify no V2 references remain

- [ ] 21. Final import and type verification
  - [ ] 21.1 Run tsc for comprehensive type checking
  - [ ] 21.2 Fix any type errors found
  - [ ] 21.3 Check for circular dependencies
  - [ ] 21.4 Verify all imports resolve correctly
  - [ ] 21.5 Run full test suite
  - [ ] 21.6 Fix any remaining issues

### Phase 5: Performance and Integration Validation

- [ ] 22. Validate performance and integration
  - [ ] 22.1 Run performance benchmark tests
  - [ ] 22.2 Verify <300ms warm run performance
  - [ ] 22.3 Test CLI entry point (quality-check command)
  - [ ] 22.4 Test API entry point functionality
  - [ ] 22.5 Test Git hook integration
  - [ ] 22.6 Run full test suite with coverage report
  - [ ] 22.7 Verify all integration tests pass

This structure breaks the original 5 tasks into 22 more granular tasks, making
it easier to track progress and work on individual components. Each task now has
5-7 subtasks for detailed implementation guidance.
