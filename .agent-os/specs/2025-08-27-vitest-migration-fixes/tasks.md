# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-08-27-vitest-migration-fixes/spec.md

> Created: 2025-08-27 Status: Ready for Implementation

## Tasks

- [x] 1. Fix Critical Production Blockers (P0)
  - [x] 1.1 Write tests to verify MSW network interception works
  - [x] 1.2 Remove global fetch mock from vitest.setup.tsx (lines 124-126)
  - [x] 1.3 Add whatwg-fetch polyfill import with environment check
  - [x] 1.4 Update vitest.config.ts to enable isolation only in CI (line 14)
  - [x] 1.5 Fix CI TypeScript coverage to check both configs (ci.yml line 72)
  - [x] 1.6 Add --coverage flag to CI test command (ci.yml line 124)
  - [x] 1.7 Configure JUnit reporter with safety checks (vitest.config.ts lines
        85-89)
  - [x] 1.8 Verify all tests pass with new configuration

- [x] 2. Implement High Priority Fixes (P1)
  - [x] 2.1 Write tests for DOM mock environment checks
  - [x] 2.2 Wrap DOM mocks in environment conditionals (vitest.setup.tsx lines
        77-131)
  - [x] 2.3 Remove redundant mock reset options (vitest.config.ts lines 45-47)
  - [x] 2.4 Remove vi.clearAllMocks from beforeEach in setup
  - [x] 2.5 Configure .vitest cache directory in config
  - [x] 2.6 Add .vitest/ to .gitignore
  - [x] 2.7 Verify mock clearing works correctly

- [x] 3. Apply Medium Priority Optimizations (P2)
  - [x] 3.1 Implement CPU-based fork limits (vitest.config.ts line 16)
  - [x] 3.2 Remove Node.js setup from CI workflow (ci.yml lines 42-44, 105-108)
  - [x] 3.3 Update reporter configuration for quieter output
  - [x] 3.4 Test performance with new fork limits
  - [x] 3.5 Verify Bun handles all CI tasks without Node.js

- [x] 4. Complete Low Priority Enhancements (P3)
  - [x] 4.1 Consolidate test scripts in package.json
  - [x] 4.2 Create nightly-performance.yml workflow
  - [x] 4.3 Remove performance benchmarks from main CI (ci.yml lines 267-313)
  - [x] 4.4 Configure ESLint vitest plugin rules
  - [x] 4.5 Test nightly workflow manually
  - [x] 4.6 Verify all consolidated scripts work correctly

- [ ] 5. Final Validation and Documentation
  - [x] 5.1 Run full test suite locally with all changes
  - [ ] 5.2 Push to CI and verify pipeline passes
  - [ ] 5.3 Confirm coverage uploads to Codecov
  - [x] 5.4 Verify JUnit reports generate correctly
  - [x] 5.5 Test execution time meets targets (< 30s local, < 5min CI)
  - [ ] 5.6 Update any documentation affected by changes
  - [ ] 5.7 Create PR with comprehensive description of fixes
