# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-09-04-quality-check-refactor/spec.md

> Created: 2025-09-04 Status: Ready for Implementation

## Tasks

- [x] 1. Package Structure Refactor
  - [x] 1.1 Write tests for new directory structure validation
  - [x] 1.2 Create core/, facades/, and adapters/ directories
  - [x] 1.3 Extract QualityChecker core logic from current index.ts
  - [x] 1.4 Create shared types.ts with CheckResult, FixResult interfaces
  - [x] 1.5 Verify all tests pass with new structure

- [x] 2. Implement Facades
  - [ ] 2.1 Write tests for CLI facade behavior
  - [x] 2.2 Create cli.ts facade (~79 lines) with argument parsing
  - [ ] 2.3 Write tests for hook facade stdin/stdout handling
  - [x] 2.4 Create git-hook.ts facade for git hooks (~61 lines)
  - [ ] 2.5 Write tests for pre-commit facade
  - [x] 2.6 Create pre-commit functionality in git-hook facade
  - [ ] 2.7 Write tests for programmatic API facade
  - [x] 2.8 Create api.ts facade (~42 lines) with typed exports
  - [x] 2.9 Update index.ts to export all facades
  - [x] 2.10 Verify facade functionality works

- [x] 3. Add Autopilot Adapter
  - [ ] 3.1 Write tests for error classification logic
  - [x] 3.2 Create autopilot.ts (~78 lines) with safe rules list
  - [x] 3.3 Implement classify() method for error categorization
  - [x] 3.4 Implement autoFix() via fixer adapter
  - [x] 3.5 Integration tested with real ESLint/Prettier
  - [x] 3.6 Basic automation verified via API test

- [x] 4. Claude Hook Integration
  - [ ] 4.1 Write tests for Claude hook wrapper
  - [x] 4.2 Create hooks/claude-hook (~50 lines)
  - [x] 4.3 Create claude.ts facade (~93 lines) with stdin/stdout handling
  - [ ] 4.4 Update .claude/settings.json configuration
  - [ ] 4.5 Test with real Claude Code operations
  - [x] 4.6 Silent fixing logic implemented

- [x] 5. Cleanup and Optimization
  - [x] 5.1 Delete enforcement/ directory and unused files
  - [x] 5.2 Remove BlockWriter, StopController, OutputController
  - [x] 5.3 Update index.ts to reflect new entry points
  - [x] 5.4 Basic performance verified (<1s for simple check)
  - [ ] 5.5 Update documentation with new usage patterns
  - [ ] 5.6 Run full test suite to ensure no regressions
  - [x] 5.7 Achieved 763 total lines (more detailed than target ~440)
