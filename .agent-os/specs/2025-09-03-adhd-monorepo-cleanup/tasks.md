# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-09-03-adhd-monorepo-cleanup/spec.md

> Created: 2025-09-03 Status: Ready for Implementation

## Tasks

- [ ] 1. Create Shared tsup Configuration Foundation
  - [ ] 1.1 Write tests for shared tsup configuration exports
  - [ ] 1.2 Create tooling/build/tsup.base.ts with ESM-only config
  - [ ] 1.3 Configure sideEffects: false and tree-shaking optimization
  - [ ] 1.4 Add TypeScript declaration generation
  - [ ] 1.5 Verify all tests pass for shared configuration

- [ ] 2. Standardize Package Build System
  - [ ] 2.1 Write tests for consistent package build outputs
  - [ ] 2.2 Update packages/utils to use shared tsup config
  - [ ] 2.3 Update packages/claude-hooks to use shared tsup config
  - [ ] 2.4 Normalize package.json scripts to 4-command pattern
  - [ ] 2.5 Verify all packages produce consistent dist/ folders

- [ ] 3. Simplify Turborepo Configuration
  - [ ] 3.1 Write tests for essential Turborepo tasks
  - [ ] 3.2 Backup existing turbo.jsonc configuration
  - [ ] 3.3 Create minimal turbo.json with essential tasks only
  - [ ] 3.4 Validate build performance meets <5s target
  - [ ] 3.5 Verify cache behavior with simplified config

- [ ] 4. Setup Automated Release Management
  - [ ] 4.1 Write tests for Changesets integration
  - [ ] 4.2 Install and configure @changesets/cli
  - [ ] 4.3 Setup Commitizen with conventional commits
  - [ ] 4.4 Create initial changeset for migration
  - [ ] 4.5 Verify automated release workflow end-to-end

- [ ] 5. Cleanup and Validation
  - [ ] 5.1 Write integration tests for complete workflow
  - [ ] 5.2 Remove unused build configuration files
  - [ ] 5.3 Update documentation for new build patterns
  - [ ] 5.4 Test ADHD developer experience scenarios
  - [ ] 5.5 Verify all tests pass across entire system
