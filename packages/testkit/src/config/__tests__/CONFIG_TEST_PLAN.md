# Config Module Test Plan

This document tracks comprehensive test coverage for the `@orchestr8/testkit` config module.

## Overview

**Target**: Achieve minimum 80% line coverage across all config module functions
**Current Status**: Building comprehensive test suite from 0% coverage

## Test Files

### ✅ vitest.base.test.ts
Core Vitest configuration functions and environment detection.

### ✅ edge-runtime.test.ts
Edge runtime configuration and dependency detection.

## Functions to Test

### Core Configuration Functions

- [x] `createVitestEnvironmentConfig()` - Environment detection (CI, Wallaby, Vitest, Jest)
- [x] `createVitestPoolOptions()` - Pool configuration for different environments
- [x] `createVitestTimeouts()` - Timeout configuration
- [x] `createVitestCoverage()` - Coverage configuration and thresholds
- [ ] `createVitestBaseConfig()` - Complete base configuration object
- [x] `createBaseVitestConfig()` - Main config creation with overrides
- [x] `defineVitestConfig()` - Convenience wrapper for defineConfig
- [x] `createWallabyOptimizedConfig()` - Wallaby-specific optimizations
- [x] `createCIOptimizedConfig()` - CI-specific optimizations

### Edge Runtime Functions

- [ ] `canUseEdgeRuntime()` - Dependency availability detection
- [ ] `hasConvexTests()` - Convex test directory detection

### Configuration Merging

- [x] `mergeVitestConfig()` - Deep merge of configurations (tested via public API)

## Test Scenarios

### Environment Detection
- [x] Local development environment
- [x] CI environment (CI=true)
- [x] Wallaby environment (WALLABY_ENV=true)
- [x] Mixed environment variables
- [ ] Node.js vs browser environment detection
- [ ] Custom NODE_ENV values

### Pool Configuration
- [x] Default pool options (forks, 4 workers)
- [x] CI optimized (forks, 2 workers, bail=1)
- [x] Wallaby optimized (single fork)
- [ ] Custom worker counts
- [ ] Pool isolation settings
- [ ] Thread vs fork selection

### Timeout Configuration
- [x] Base timeout creation
- [ ] Environment-specific timeout adjustments
- [ ] Custom timeout overrides
- [ ] CI timeout multipliers

### Coverage Configuration
- [x] CI coverage enabled with json/clover reporters
- [x] Local coverage disabled with text/html reporters
- [x] Wallaby coverage disabled
- [ ] Custom coverage threshold (COVERAGE_THRESHOLD env)
- [ ] Coverage provider selection
- [ ] Coverage exclusion patterns

### Configuration Merging
- [x] Basic property overrides
- [x] Nested object merging (env, poolOptions, coverage)
- [x] Array property handling
- [x] Undefined/empty override handling
- [ ] Deep nested property merging
- [ ] Array concatenation vs replacement
- [ ] Type safety in merging

### Setup Files Resolution
- [x] Local testkit development (TESTKIT_LOCAL=1)
- [x] Package consumer usage
- [x] Path-based detection fallback
- [x] Custom setupFiles overrides
- [ ] Array vs string setupFiles handling
- [ ] Relative vs absolute path resolution

### Project Configuration
- [x] Default project structure
- [x] Edge runtime project inclusion
- [x] Examples inclusion (TESTKIT_INCLUDE_EXAMPLES=1)
- [x] Project exclusion patterns
- [ ] Custom project configurations
- [ ] Project-specific overrides

### Edge Runtime Detection
- [ ] `@edge-runtime/vm` dependency detection
- [ ] Convex directory existence check
- [ ] Edge runtime forcing (TESTKIT_ENABLE_EDGE_RUNTIME=1)
- [ ] Edge runtime disabling (TESTKIT_DISABLE_EDGE_RUNTIME=1)
- [ ] `import.meta.resolve` availability
- [ ] Graceful degradation when unavailable

### Error Handling & Edge Cases
- [ ] Missing dependencies
- [ ] Invalid environment variables
- [ ] File system access errors
- [ ] Malformed configuration overrides
- [ ] Missing import.meta.resolve
- [ ] Process.cwd() failures
- [ ] Invalid coverage thresholds

### Reporter Configuration
- [x] CI reporters (verbose, junit)
- [x] Wallaby reporters (verbose only)
- [x] Local reporters (default)
- [ ] Custom reporter configurations
- [ ] Output file configurations

### Environment Variables
- [x] COVERAGE_THRESHOLD handling
- [x] TESTKIT_LOCAL detection
- [x] TESTKIT_INCLUDE_EXAMPLES handling
- [x] TESTKIT_ENABLE_EDGE_RUNTIME handling
- [ ] TESTKIT_DISABLE_EDGE_RUNTIME handling
- [ ] NODE_ENV variations
- [ ] Invalid environment variable values

## Coverage Targets

### Minimum Requirements (80%)
- [ ] All exported functions tested
- [ ] All conditional branches covered
- [ ] Error paths tested
- [ ] Environment detection logic verified

### Comprehensive Coverage (90%+)
- [ ] Edge cases and error scenarios
- [ ] Complex configuration merging
- [ ] File system interaction mocking
- [ ] Dynamic import behavior
- [ ] Process environment manipulation

## Test Quality Standards

### Test Design
- [x] Verbose test output for debugging
- [x] Real implementations (no mocks unless necessary)
- [x] Accurate reflection of real usage
- [x] Tests designed to reveal flaws
- [ ] Complete edge case coverage
- [ ] Performance impact testing

### Test Structure
- [x] Proper setup/teardown for environment
- [x] Isolated test execution
- [x] Clear test descriptions
- [x] Grouped related functionality
- [ ] Property-based testing for complex scenarios
- [ ] Integration testing with real Vitest configs

## Progress Tracking

**Phase 1: Core Functions** ✅
- Environment detection
- Pool configuration
- Timeout configuration
- Coverage configuration

**Phase 2: Advanced Features** 🔄
- Edge runtime detection
- Project configuration
- Setup file resolution
- Configuration merging

**Phase 3: Edge Cases** 📋
- Error handling
- Invalid inputs
- File system errors
- Missing dependencies

**Phase 4: Validation** 📋
- Coverage verification
- Performance testing
- Integration testing
- Documentation updates

## Notes

- Tests must be environment-aware and restore state
- Mock file system operations where needed for deterministic tests
- Test both positive and negative cases for all functions
- Verify configuration objects match expected Vitest schema
- Ensure tests work in CI, local, and Wallaby environments