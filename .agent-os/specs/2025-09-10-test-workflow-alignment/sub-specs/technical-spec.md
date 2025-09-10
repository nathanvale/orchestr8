# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-10-test-workflow-alignment/spec.md

> Created: 2025-09-10 Version: 1.0.0

## Technical Requirements

### Test File Updates Required

- **ci-modular-jobs.integration.test.ts** - Complete rewrite to validate 8 jobs instead of 11+, remove complex logic expectations
- **ci-cd-pipeline.integration.test.ts** - Rewrite to focus on GitHub Actions workflow structure instead of JSON output
- **progressive-testing-tiers.test.ts** - Update from 3-tier to 2-tier testing validation (quick/focused)  
- **cognitive-load-reducers.test.ts** - Align with specific emoji/timeout/step limit features
- **github-step-summaries.test.ts** - Update to match simple emoji-based status reporting

### Workflow Structure Validation

- Validate exactly 8 focused jobs: setup, quick-tests, focused-tests, format, lint, types, commit-lint, ci-status
- Verify emoji indicators in all job names: 🔧, ⚡, 🎯, 💅, 🔍, ⚧, 📊
- Confirm timeout limits displayed in job names: (1m) for quick tests, (5m) for other jobs
- Ensure maximum 3 essential steps per job (excluding setup steps)
- Validate parallel execution of quality check jobs (format, lint, types)

### Progressive Testing Alignment

- Validate 2-tier system: quick tests (1 minute, bail-fast) and focused tests (5 minutes, comprehensive)
- Remove expectations for smoke/quick/full 3-tier system
- Verify test:smoke and test:focused scripts exist and are used by CI
- Ensure quick-tests job uses test:smoke for sub-1-minute feedback
- Confirm focused-tests job provides comprehensive coverage

### ADHD Feature Preservation

- Test for consistent emoji usage across all workflow jobs
- Validate timeout clarity in job naming convention
- Ensure step count limits maintain cognitive load reduction
- Verify visual status aggregation with emoji feedback
- Confirm breadcrumb navigation structure remains intact

### Integration Requirements

- Tests must pass against both local and CI environments  
- Use existing test utilities from vitest setup files
- Load actual .github/workflows/ci.yml file for validation
- Parse YAML workflow structure for accurate testing
- Maintain compatibility with existing test infrastructure

### Performance Criteria

- Test execution should complete within ADHD-friendly timeframes
- Individual test files should run in under 30 seconds
- Full test suite should maintain sub-5-minute execution time
- Tests should provide clear, immediate feedback on failures