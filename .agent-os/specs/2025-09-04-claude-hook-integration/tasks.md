# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-09-04-claude-hook-integration/spec.md

> Created: 2025-09-04 Status: Ready for Implementation

## Tasks

- [x] 1. Create NPM Binary Infrastructure
  - [x] 1.1 Write tests for bin/claude-hook binary processing
  - [x] 1.2 Create bin/claude-hook executable (~20 lines)
  - [x] 1.3 Update package.json with quality-check-claude-hook binary
  - [x] 1.4 Add proper error handling and exit code propagation
  - [x] 1.5 Create development hooks/claude-hook.js alternative (optional)
  - [x] 1.6 Verify binary tests pass with Wallaby

- [ ] 2. Implement Three-Tier Classification System
  - [ ] 2.1 Write tests for auto-fixable rule detection
  - [ ] 2.2 Write tests for Claude-fixable instruction generation
  - [ ] 2.3 Write tests for human-required educational content
  - [ ] 2.4 Enhance ErrorClassifier with Claude-specific logic
  - [ ] 2.5 Verify classification tests pass with Wallaby

- [ ] 3. Hook Payload Processing Integration
  - [ ] 3.1 Write tests for stdin JSON payload parsing
  - [ ] 3.2 Write tests for legacy payload format support
  - [ ] 3.3 Implement payload normalization in Claude facade
  - [ ] 3.4 Add file type filtering logic
  - [ ] 3.5 Verify payload processing tests pass with Wallaby

- [ ] 4. Configuration and Settings Integration
  - [ ] 4.1 Write tests for .claude/settings.json hook configuration
  - [ ] 4.2 Update .claude/settings.json to point to new hook wrapper
  - [ ] 4.3 Add environment variable processing
  - [ ] 4.4 Implement graceful configuration fallbacks
  - [ ] 4.5 Verify configuration tests pass with Wallaby

- [ ] 5. End-to-End Integration Testing
  - [ ] 5.1 Write integration tests for complete hook workflow
  - [ ] 5.2 Test with real Claude Code PostToolUse operations
  - [ ] 5.3 Validate silent fixing for auto-fixable issues
  - [ ] 5.4 Validate blocking behavior for Claude/Human-fixable issues
  - [ ] 5.5 Verify performance requirements (sub-2s execution)
  - [ ] 5.6 Verify all integration tests pass

## Implementation Approach

### Test-Driven Development (TDD)

Each major task follows the TDD cycle:

1. **Red**: Write failing test for expected behavior
2. **Green**: Implement minimal code to pass the test
3. **Refactor**: Improve code while keeping tests green

### Performance-First Implementation

- Use Wallaby.js for instant test feedback during development
- Optimize for sub-2s execution from first implementation
- Monitor memory usage during development

### Integration Strategy

- Build incrementally on existing quality-check infrastructure
- Test each component in isolation before integration
- Validate with real Claude Code payloads throughout development

### Quality Assurance

- All tests must pass before proceeding to next task
- Use existing quality-check to validate own code quality
- Follow established coding patterns from existing facades

## Task Dependencies

- **Task 1** has no dependencies - can start immediately
- **Task 2** depends on understanding existing ErrorClassifier structure
- **Task 3** depends on Task 1 (hook wrapper) completion
- **Task 4** depends on Tasks 1-3 (functional hook needed)
- **Task 5** depends on all previous tasks (complete system needed)

## Success Criteria

### Functional Criteria

- [ ] Hook executes successfully on Claude Code Write/Edit operations
- [ ] Three-tier classification system responds appropriately to different error
      types
- [ ] Silent fixing works for formatting/style issues
- [ ] Blocking works for type errors and complexity issues

### Performance Criteria

- [ ] Hook execution completes in under 2 seconds
- [ ] Memory usage stays under 50MB peak
- [ ] No performance degradation on files up to 5MB

### Integration Criteria

- [ ] Works seamlessly with existing .claude/settings.json configuration
- [ ] Maintains compatibility with existing quality-check consumers
- [ ] Provides appropriate feedback for each user persona (Claude, Senior Dev,
      Junior Dev)

This task breakdown follows TDD principles and ensures comprehensive testing
coverage for the Claude hook integration system.
