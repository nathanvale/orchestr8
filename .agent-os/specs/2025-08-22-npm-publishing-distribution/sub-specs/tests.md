# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-22-npm-publishing-distribution/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Test Coverage

### Unit Tests

**Dual Module Export Tests**

- Verify ES module imports work correctly
- Verify CommonJS requires work correctly
- Test TypeScript declaration file accuracy
- Validate export field resolution

**Changeset Configuration Tests**

- Test changeset file parsing and validation
- Verify version bump calculations
- Test internal dependency updates
- Validate changelog generation

**Build Pipeline Tests**

- Test TypeScript compilation for both targets
- Verify output file structure and naming
- Test package.json manipulation scripts
- Validate file extensions and module markers

### Integration Tests

**Package Installation Tests**

- Install and import from ES module project
- Install and require from CommonJS project
- Test mixed module environments
- Verify TypeScript integration works

**CI/CD Pipeline Tests**

- Test GitHub Actions workflow execution
- Verify changeset detection and processing
- Test NPM publishing simulation
- Validate secret handling and token usage

**Version Management Tests**

- Test pre-release mode entry/exit
- Verify linked package version alignment
- Test dependency update cascades
- Validate version graduation workflows

### End-to-End Tests

**Full Release Workflow**

- Create changeset → Version PR → Publish cycle
- Test from development to stable release progression
- Verify changelog and release notes generation
- Test rollback and recovery procedures

**Consumer Compatibility Tests**

- Test packages in Next.js project (ES modules)
- Test packages in Express.js project (CommonJS)
- Test packages in TypeScript strict mode
- Test packages with bundlers (Webpack, Vite, Rollup)

### Performance Tests

**Build Performance**

- Measure dual compilation time
- Test incremental build efficiency
- Validate memory usage during build
- Benchmark against single-module builds

**Package Size Tests**

- Monitor bundle size for each format
- Test tree-shaking effectiveness
- Validate declaration file sizes
- Track size regression over time

## Mocking Requirements

### NPM Registry Mocking

- Mock NPM publish API for testing
- Simulate registry failures and retries
- Mock package installation workflows
- Test token validation without real tokens

### GitHub API Mocking

- Mock PR creation and status updates
- Simulate changeset detection workflows
- Mock release creation and publishing
- Test webhook and action triggers

### File System Mocking

- Mock package.json modifications
- Simulate build output generation
- Test file cleanup and organization
- Mock TypeScript compilation outputs

## Test Execution Strategy

### Local Development Testing

```bash
# Test dual module consumption
pnpm test:dual-consumption

# Test changeset workflows
pnpm test:changesets

# Test build outputs
pnpm test:build-validation

# Full publishing simulation
pnpm test:publish-simulation
```

### CI/CD Testing

- Run full test suite on all PRs
- Test changeset validation on PR creation
- Simulate publishing workflow without actual publish
- Test failure scenarios and recovery

### Pre-Release Testing

- Deploy to internal staging NPM registry
- Test installation across multiple Node.js versions
- Validate consumer projects can upgrade successfully
- Performance and compatibility regression testing

## Test Data Management

### Fixture Packages

- Create minimal test packages for each format
- Maintain version of published packages for regression testing
- Mock external package dependencies
- Test data for various changeset scenarios

### Environment Configuration

- Test matrix across Node.js versions (18, 20, 22)
- Test across package managers (npm, yarn, pnpm)
- Test across operating systems (Linux, macOS, Windows)
- Test across TypeScript versions (5.0+)

## Coverage Requirements

### Minimum Coverage Targets

- **Unit Tests:** 85% line coverage for all publishing-related code
- **Integration Tests:** 75% coverage of CI/CD workflows
- **E2E Tests:** 90% coverage of critical publishing paths

### Critical Path Coverage

- 100% coverage of version calculation logic
- 100% coverage of dual module export configuration
- 100% coverage of NPM publishing workflows
- 100% coverage of changeset processing logic

### Regression Test Strategy

- Add test case for each publishing bug discovered
- Maintain backward compatibility test suite
- Test upgrade paths between versions
- Validate migration scripts and tooling
