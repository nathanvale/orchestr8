# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-08-26-vitest-migration/spec.md

> Created: 2025-08-26 Status: Ready for Implementation

## Tasks

- [x] 1. Install and Configure Vitest Dependencies
  - [x] 1.1 Write tests for dependency installation validation
  - [x] 1.2 Install Vitest and related packages (vitest, @vitest/ui,
        @vitest/coverage-v8)
  - [x] 1.3 Install testing utilities (happy-dom, @testing-library/react, msw,
        whatwg-fetch)
  - [x] 1.4 Install configuration packages (vite-tsconfig-paths)
  - [x] 1.5 Verify all dependencies installed correctly with no peer dependency
        warnings
  - [x] 1.6 Verify all tests pass

- [ ] 2. Create Vitest Configuration and Setup Files
  - [ ] 2.1 Write tests for configuration validation
  - [ ] 2.2 Create vitest.config.ts with optimized settings for Bun runtime
  - [ ] 2.3 Create tests/vitest.setup.ts with MSW server configuration
  - [ ] 2.4 Create tests/mocks/handlers.ts with example MSW handlers
  - [ ] 2.5 Create tests/utils/test-utils.ts with React Testing Library custom
        render
  - [ ] 2.6 Configure module resolution for MSW compatibility
  - [ ] 2.7 Verify all tests pass

- [ ] 3. Configure Wallaby.js Integration
  - [ ] 3.1 Write tests for Wallaby configuration validation
  - [ ] 3.2 Create wallaby.js configuration file with Bun runtime settings
  - [ ] 3.3 Update VS Code settings.json with Wallaby preferences
  - [ ] 3.4 Test Wallaby startup and verify inline indicators work
  - [ ] 3.5 Verify coverage display in editor
  - [ ] 3.6 Document Wallaby troubleshooting steps
  - [ ] 3.7 Verify all tests pass

- [ ] 4. Update Package Scripts and Commands
  - [ ] 4.1 Write tests for script execution validation
  - [ ] 4.2 Replace all bun test scripts with Vitest equivalents
  - [ ] 4.3 Update test script to use "bun run vitest run"
  - [ ] 4.4 Update test:watch script to use "bun run vitest"
  - [ ] 4.5 Add test:ui script for Vitest UI mode
  - [ ] 4.6 Update coverage script with Vitest coverage command
  - [ ] 4.7 Remove any remaining bun test references
  - [ ] 4.8 Verify all tests pass

- [ ] 5. Update CI/CD Pipeline for Vitest
  - [ ] 5.1 Write tests for CI configuration validation
  - [ ] 5.2 Update GitHub Actions workflow to use Vitest
  - [ ] 5.3 Replace bun test jobs with Vitest equivalents
  - [ ] 5.4 Configure coverage upload to Codecov
  - [ ] 5.5 Set Vitest tests as required status checks
  - [ ] 5.6 Test CI pipeline with a test PR
  - [ ] 5.7 Verify all tests pass

- [ ] 6. Migrate Existing Tests to Vitest
  - [ ] 6.1 Write migration validation tests
  - [ ] 6.2 Update import statements from 'bun:test' to 'vitest'
  - [ ] 6.3 Convert mock() calls to vi.fn()
  - [ ] 6.4 Update timer mocks to use vi.useFakeTimers()
  - [ ] 6.5 Update assertion patterns if needed
  - [ ] 6.6 Verify each migrated test passes
  - [ ] 6.7 Run full test suite to ensure no regressions
  - [ ] 6.8 Verify all tests pass

- [ ] 7. Update Documentation and Examples
  - [ ] 7.1 Write tests for documentation accuracy
  - [ ] 7.2 Update README.md with Vitest commands
  - [ ] 7.3 Add Wallaby.js usage instructions
  - [ ] 7.4 Create migration guide for developers
  - [ ] 7.5 Update troubleshooting documentation
  - [ ] 7.6 Add example tests showcasing new capabilities
  - [ ] 7.7 Verify all documentation examples work
  - [ ] 7.8 Verify all tests pass
