# Vitest Configuration Migration Notes

## Environment Detection Changes

### Wallaby Environment Detection
- **Previous**: Detection used various environment variables
- **Current**: Detection now uses `WALLABY_ENV === 'true'`
- **Impact**: Wallaby configuration is simplified and more reliable

## Test Execution Changes

### Single Worker for CLI Tests
- **Issue**: Process mock registry wasn't shared between multiple workers
- **Solution**: CLI tests now run with `pool: 'forks'` and `singleFork: true`
- **Rationale**: Global registries require single worker to maintain consistent state
- **Files Affected**: `packages/testkit/vitest.config.ts`

### Command Normalization
- **New Features**:
  - Automatic whitespace collapsing
  - Quote stripping from command tokens
  - Path separator normalization (\ → /)
- **Benefits**: More resilient command matching in process mocks
- **Implementation**: `packages/testkit/src/cli/mock-factory.ts`

## Best Practices

### Global State Management
- Tests requiring global state should use single worker configuration
- Consider using project-specific configurations for test isolation
- Prefer dependency injection over globals when possible

### Process Mocking
- Always normalize commands at both registration and lookup
- Use fallback chains (execSync → exec → spawn → fork) for compatibility
- Add smoke tests to verify mock setup early in test suites

## Migration Checklist

- [ ] Update Wallaby configuration to set `WALLABY_ENV=true`
- [ ] Move global-dependent tests to single-worker projects
- [ ] Add command normalization to process mock registrations
- [ ] Verify bootstrap order with smoke tests
- [ ] Document any package-specific worker configurations

## Troubleshooting

### "No mock registered" Errors
1. Ensure single worker configuration for affected tests
2. Verify mock registration happens before test execution
3. Check command normalization is applied consistently
4. Use debug logging to trace registration and lookup

### Worker Isolation Issues
- Symptoms: Inconsistent test failures, missing global state
- Solution: Force single worker with `singleFork: true` or `singleThread: true`
- Alternative: Refactor to avoid global state dependencies

## Related Files
- `packages/testkit/vitest.config.ts` - Main configuration with single fork setup
- `packages/testkit/src/cli/mock-factory.ts` - Command normalization implementation
- `packages/testkit/src/bootstrap.ts` - Mock setup and lifecycle management
- `packages/testkit/src/cli/__tests__/00-bootstrap-smoke.test.ts` - Bootstrap verification