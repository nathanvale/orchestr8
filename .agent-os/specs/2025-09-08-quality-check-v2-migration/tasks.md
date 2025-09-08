# Spec Tasks

## Tasks

- [ ] 1. Migrate Facades to V2 Implementation
  - [ ] 1.1 Write tests for V2 facade compatibility
  - [ ] 1.2 Update api.ts to use QualityCheckerV2
  - [ ] 1.3 Update git-hook.ts to use QualityCheckerV2
  - [ ] 1.4 Update test-utils/api-wrappers.ts to use V2
  - [ ] 1.5 Remove claude-v2.ts facade (confusingly uses V1)
  - [ ] 1.6 Remove claude-facade-v2.ts and related tests
  - [ ] 1.7 Verify all facade tests pass

- [ ] 2. Port V1 Test Coverage to V2
  - [ ] 2.1 Create quality-checker.error-handling.test.ts for V2
  - [ ] 2.2 Migrate TypeScript error enhancement tests
  - [ ] 2.3 Migrate ESLint error enhancement tests
  - [ ] 2.4 Migrate combined error reporting tests
  - [ ] 2.5 Ensure V2 coverage increases from 46.61% to >60%
  - [ ] 2.6 Verify all migrated tests pass

- [ ] 3. Consolidate Implementation
  - [ ] 3.1 Write tests for renamed QualityChecker class
  - [ ] 3.2 Delete /src/core/quality-checker.ts (V1 implementation)
  - [ ] 3.3 Delete /src/core/error-parser.ts if unused by V2
  - [ ] 3.4 Rename quality-checker-v2.ts to quality-checker.ts
  - [ ] 3.5 Rename QualityCheckerV2 class to QualityChecker
  - [ ] 3.6 Verify renamed implementation tests pass

- [ ] 4. Update All References and Imports
  - [ ] 4.1 Write tests for updated exports
  - [ ] 4.2 Update /src/index.ts exports (remove V2 export)
  - [ ] 4.3 Update claude.ts imports to use renamed QualityChecker
  - [ ] 4.4 Update cli.ts imports to use renamed QualityChecker
  - [ ] 4.5 Update all test file imports
  - [ ] 4.6 Search and replace all QualityCheckerV2 references
  - [ ] 4.7 Verify all import tests pass

- [ ] 5. Validate Performance and Integration
  - [ ] 5.1 Run performance benchmark tests
  - [ ] 5.2 Verify <300ms warm run performance
  - [ ] 5.3 Test CLI entry point (quality-check command)
  - [ ] 5.4 Test API entry point functionality
  - [ ] 5.5 Test Git hook integration
  - [ ] 5.6 Run full test suite with coverage report
  - [ ] 5.7 Verify all integration tests pass
