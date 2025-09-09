# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-09-09-markdown-prettier-support/spec.md

> Created: 2025-09-09 Status: Ready for Implementation

## Tasks

- [x] 1. Update File Filtering to Support Markdown Files
  - [x] 1.1 Write tests for Markdown file filtering in file-matcher
  - [x] 1.2 Update file filtering regex patterns to include .md extension
  - [x] 1.3 Update all facade file filters to accept .md files
  - [x] 1.4 Verify file filtering tests pass for all facades

- [ ] 2. Configure Prettier Engine for Markdown Support
  - [ ] 2.1 Write tests for Prettier markdown parsing
  - [ ] 2.2 Add markdown parser configuration to prettier-engine.ts
  - [ ] 2.3 Handle Prettier's markdown-specific options
  - [ ] 2.4 Add performance tests for markdown formatting
  - [ ] 2.5 Verify all Prettier engine tests pass

- [ ] 3. Update Autopilot Decision Logic for Markdown
  - [ ] 3.1 Write tests for autopilot markdown issue handling
  - [ ] 3.2 Add markdown formatting issues to auto-fixable patterns
  - [ ] 3.3 Ensure FIX_SILENTLY action applies to markdown formatting
  - [ ] 3.4 Verify autopilot tests pass with markdown scenarios

- [ ] 4. Integration Testing and Validation
  - [ ] 4.1 Write end-to-end tests for Claude hook with .md files
  - [ ] 4.2 Test CLI facade with markdown files
  - [ ] 4.3 Test git-hook facade with markdown files
  - [ ] 4.4 Test API facade with markdown files
  - [ ] 4.5 Verify performance meets <2s requirement for large markdown files
  - [ ] 4.6 Run full test suite to ensure no regressions

- [ ] 5. Documentation and Final Verification
  - [ ] 5.1 Update README with markdown support information
  - [ ] 5.2 Test with real-world markdown files (specs, docs, README)
  - [ ] 5.3 Verify auto-formatting works through Claude Code
  - [ ] 5.4 Create example markdown file for testing
  - [ ] 5.5 Confirm all expected deliverables are met

## Implementation Notes

### Priority Order

1. Core file filtering must be updated first (Task 1)
2. Prettier engine configuration enables formatting (Task 2)
3. Autopilot ensures correct auto-fix behavior (Task 3)
4. Integration testing validates all entry points (Task 4)
5. Documentation and verification confirms success (Task 5)

### Key Files to Modify

- `packages/quality-check/src/core/file-matcher.ts`
- `packages/quality-check/src/engines/prettier-engine.ts`
- `packages/quality-check/src/adapters/autopilot.ts`
- `packages/quality-check/src/facades/*.ts` (all facades)

### Testing Strategy

- TDD approach: Write tests first for each component
- Test each facade independently
- End-to-end testing through Claude hook
- Performance validation with various file sizes

### Success Criteria

- All .md files are processed by quality checker
- Prettier formats markdown files correctly
- Auto-fix works silently for formatting issues
- All existing tests continue to pass
- Performance remains under 2 seconds
