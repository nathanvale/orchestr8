# Tests Specification

This is the tests coverage details for the spec detailed in
@.agent-os/specs/2025-09-03-adhd-monorepo-cleanup/spec.md

> Created: 2025-09-03 Version: 1.0.0

## Test Coverage

### Unit Tests

**tsup Configuration**

- Validate shared config exports ESM modules correctly
- Test tree-shaking with sideEffects: false
- Verify TypeScript declaration file generation
- Test source map generation for debugging

**Package Build Validation**

- Confirm all packages produce consistent dist/ structure
- Validate ESM module compatibility across packages
- Test import/export resolution between packages
- Verify package.json exports field compatibility

### Integration Tests

**Turborepo Orchestration**

- Test `pnpm build:all` completes under performance target
- Validate dependency graph resolution with simplified config
- Test cache hit rates with new input/output patterns
- Verify task parallelization works correctly

**Release Pipeline**

- Test Changesets detects package changes correctly
- Validate conventional commit parsing
- Test automated version bumping
- Verify release notes generation

**ADHD Developer Experience**

- Test `dx:status` command provides clear build status
- Validate consistent command patterns across packages
- Test error messages provide clear next actions
- Verify zero-config experience for new packages

### Feature Tests

**End-to-End Build Workflow**

- Developer modifies package source
- Runs `pnpm build` and gets consistent output
- Turborepo cache optimizes subsequent builds
- All tests pass with new build system

**Release Workflow**

- Developer commits with conventional commit message
- Changesets detects changes and suggests version bump
- Release process generates changelog automatically
- Published packages work correctly in consuming projects

### Mocking Requirements

- **File System Operations**: Mock tsup output validation to avoid actual file
  generation during tests
- **Turborepo Cache**: Mock cache hit/miss scenarios to test performance
  assumptions
- **NPM Registry**: Mock package publishing for release workflow tests without
  actual publishing
