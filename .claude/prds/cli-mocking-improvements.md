---
title: CLI Mocking Improvements
created: 2025-01-24
status: draft
stakeholder: nathanvale
---

# PRD: CLI Mocking Improvements

## Context

The CLI mocking system in the testkit package has been reviewed and several
improvement opportunities have been identified. While there are no critical
blockers, there are multiple areas for enhancement in correctness,
maintainability, and test coverage.

## Problem Statement

Current issues identified:

1. Potential silent mismatches in fallback resolution
2. Inconsistent error object shaping across different exec methods
3. Documentation gaps around fallback precedence and limitations
4. Code duplication in error handling and registry management
5. Mixed responsibilities in spawn.ts file
6. Missing test coverage for edge cases

## Goals

- **Primary**: Improve correctness and consistency of CLI mocking behavior
- **Secondary**: Enhance maintainability through better code organization
- **Tertiary**: Increase test coverage to 95%+ with comprehensive edge cases

## Requirements

### P0 (Critical Blockers)

- None identified

### P1 (Correctness & Security)

1. **Fallback Warning System**: Introduce warnings when fallback resolution
   occurs unexpectedly
2. **Error Consistency**: Normalize error object creation across all exec
   methods
3. **Documentation**: Explicitly document MockChildProcess limitations

### P2 (Maintainability & Clarity)

1. **Code Organization**: Split spawn.ts into focused modules
2. **Helper Extraction**: Create shared utilities for error creation and
   registry management
3. **Terminology Consistency**: Update all "quad-register" references to
   "hexa-register"
4. **Documentation Structure**: Add dedicated "Resolution Semantics" section

### P3 (Tests & Coverage)

1. **Edge Case Tests**: Add tests for fallback selection, strict mode, and error
   shaping
2. **Signal Handling**: Test process kill during delays and signal-driven
   termination
3. **Promisify Variants**: Test both **promisify** and util.promisify paths
4. **Normalization Extremes**: Test commands with various edge case formats

## Technical Approach

### Phase 1: Error Handling & Consistency

- Extract shared error factory: `buildExecLikeError()`
- Unify error object property assignment
- Add consistent property descriptors

### Phase 2: Code Organization

- Split spawn.ts into:
  - spawn-builder.ts
  - common-commands.ts
  - quick-mocks.ts
  - spawn-utils.ts (keep existing)
- Extract registry management utilities

### Phase 3: Enhanced Testing

- Implement comprehensive test suite for edge cases
- Add diagnostic helpers for debugging
- Create `withStrictMocks()` utility

### Phase 4: Documentation

- Update all terminology references
- Add "Resolution Semantics" section with truth table
- Document extension roadmap and limitations

## Success Criteria

1. All P1 issues resolved
2. Test coverage increased to 95%+
3. No regression in existing functionality
4. Documentation clearly explains all behaviors and limitations
5. Code passes all quality checks without warnings

## Timeline

- **Week 1**: P1 improvements (error handling, warnings)
- **Week 2**: P2 code organization and cleanup
- **Week 3**: P3 test coverage enhancements
- **Week 4**: Documentation and final polish

## Risks & Mitigations

- **Risk**: Breaking changes to existing API
  - **Mitigation**: Maintain backward compatibility, deprecate old patterns
    gradually

- **Risk**: Performance impact from additional warnings/checks
  - **Mitigation**: Make features opt-in via environment variables

## Dependencies

- Existing testkit package infrastructure
- Vitest test framework
- Quality-check tooling
