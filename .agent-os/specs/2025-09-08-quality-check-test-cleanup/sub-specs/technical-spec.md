# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-08-quality-check-test-cleanup/spec.md

## Technical Requirements

### Files to Delete

**From packages/quality-check/**

- `test-cwd-debug.sh` - Debug script for testing claude-hook with working
  directory issues
- `test-hook-debug.sh` - Script for testing strict null check scenarios
- `test-hook-manually.sh` - Manual test scenarios for claude-hook
- `test-strict.ts` - TypeScript file with deliberate errors for testing
- `test.js` - Minimal JavaScript file with simple export

**From repository root/**

- `test-strict-check.js` - Similar debug script in repository root

### Verification Steps

1. Confirm none of these files are referenced in:
   - package.json scripts
   - Other source files
   - Documentation
   - CI/CD pipelines

2. Verify test coverage remains intact:
   - `src/bin/claude-hook.unit.test.ts` covers hook functionality
   - Integration tests in `tests/` directory provide comprehensive coverage

### .gitignore Updates

Add the following patterns to prevent future accumulation:

```gitignore
# Debug and manual test files
test-*.sh
test-*.js
test-*.ts
!src/**/*.test.ts
!tests/**/*.test.ts
```

### Implementation Order

1. Run final verification grep to ensure no references
2. Delete all 6 identified files
3. Update .gitignore with new patterns
4. Verify git status shows expected changes
5. Commit with descriptive message

## Performance Criteria

- Deletion should be atomic (all or nothing)
- No broken references after deletion
- Test suite should continue to pass without modification
- Package size reduced by removing unnecessary files
