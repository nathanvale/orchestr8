# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-09-03-adhd-monorepo-cleanup/spec.md

> Created: 2025-09-03 Status: Ready for Implementation

## Tasks

- [x] 1. Create Shared tsup Configuration Foundation
  - [x] 1.1 Write tests for shared tsup configuration exports
  - [x] 1.2 Create tooling/build/tsup.base.ts with ESM-only config
  - [x] 1.3 Configure sideEffects: false and tree-shaking optimization
  - [x] 1.4 Add TypeScript declaration generation
  - [x] 1.5 Verify all tests pass for shared configuration

- [x] 2. Standardize Package Build System
  - [x] 2.1 Write tests for consistent package build outputs (packages + apps)
  - [x] 2.2 Update packages/utils to use shared tsup config
  - [x] 2.3 Update packages/claude-hooks to use shared tsup config
  - [x] 2.4 Normalize package.json scripts to 4-command pattern (packages +
        apps)
  - [x] 2.5 Verify all packages produce consistent dist/ folders

- [x] 3. Simplify Turborepo Configuration
  - [x] 3.1 Write tests for essential Turborepo tasks
  - [x] 3.2 Backup existing turbo.jsonc configuration
  - [x] 3.3 Create minimal turbo.json with essential tasks only
  - [x] 3.4 Validate build performance meets <5s target
  - [x] 3.5 Verify cache behavior with simplified config

- [x] 4. Setup Automated Release Management
  - [x] 4.1 Write tests for Changesets integration
  - [x] 4.2 Install and configure @changesets/cli
  - [x] 4.3 Setup Commitizen with conventional commits
  - [x] 4.4 Create initial changeset for migration
  - [x] 4.5 Verify automated release workflow end-to-end

- [ ] 5. Cleanup and Validation
  - [x] 5.1 Write integration tests for complete workflow
  - [x] 5.2 Remove unused build configuration files
  - [x] 5.3 Update documentation for new build patterns
  - [ ] 5.4 Test ADHD developer experience scenarios
  - [ ] 5.5 Verify all tests pass across entire system
