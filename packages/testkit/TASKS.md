# @orchestr8/testkit - Comprehensive Task List

## 🚨 Priority 0: Critical Security Fixes (IMMEDIATE - Block v1.0.3)

### Command Injection Prevention
- [ ] Create `packages/testkit/src/security/index.ts` module
  - [ ] Implement `sanitizeCommand()` function with shell metacharacter escaping
  - [ ] Implement `validateCommand()` with allowlist validation
  - [ ] Add comprehensive tests for command sanitization
- [ ] Fix `packages/testkit/src/cli/spawn.ts:84-85`
  - [ ] Apply command sanitization to all spawn operations
  - [ ] Add validation for command arguments
  - [ ] Update tests to verify security measures

### Path Traversal Prevention
- [ ] Update `packages/testkit/src/fs/core.ts`
  - [ ] Implement `validatePath()` function for all file operations
  - [ ] Fix vulnerable join() calls at lines 96, 107, 113, 117, 137
  - [ ] Add boundary checks for temp directory operations
  - [ ] Create tests for path traversal attempts

### SQL Injection Prevention
- [ ] Review `packages/testkit/src/sqlite/*.ts`
  - [ ] Implement parameterized queries for all SQL operations
  - [ ] Add input validation for database names and table names
  - [ ] Create SQL injection test suite

## 🔴 Priority 1: Critical Bugs & Test Coverage (Before v1.0.3)

### Test Coverage for Fixed Functions
- [ ] Add tests for `createMockFn()` in utils
  - [ ] Test vitest detection logic
  - [ ] Test fallback implementation
  - [ ] Test mock tracking capabilities
- [ ] Add tests for `retry()` exponential backoff
  - [ ] Verify delay progression (100ms, 200ms, 400ms)
  - [ ] Test max attempts behavior
  - [ ] Test error propagation
- [ ] Add tests for `withTimeout()`
  - [ ] Verify timeout error message format
  - [ ] Test promise resolution/rejection
  - [ ] Test cleanup on timeout

### Zero Coverage Modules
- [ ] Add comprehensive tests for `packages/testkit/src/config/`
  - [ ] Test all 16 exported functions
  - [ ] Test environment detection logic
  - [ ] Test configuration merging
  - [ ] Achieve minimum 80% coverage
- [ ] Add tests for `packages/testkit/src/containers/`
  - [ ] Test PostgresContainer class
  - [ ] Test MySQLContainer class
  - [ ] Test container lifecycle management
  - [ ] Test error scenarios

### Resource Management
- [ ] Create `packages/testkit/src/resources/manager.ts`
  - [ ] Implement ResourceManager class
  - [ ] Add automatic cleanup registration
  - [ ] Handle cleanup errors gracefully
- [ ] Fix process event listener leaks
  - [ ] Add listener tracking
  - [ ] Implement automatic removal
  - [ ] Add tests for leak prevention
- [ ] Fix file descriptor leaks
  - [ ] Add try-finally blocks to all file operations
  - [ ] Ensure cleanup in error paths
  - [ ] Add resource counting tests

## 🟡 Priority 2: Performance Optimizations (Before v1.1.0)

### Async Operations
- [ ] Replace synchronous operations
  - [ ] Convert `execSync` to `exec` with promises
  - [ ] Make file operations async where appropriate
  - [ ] Update emergency cleanup to be non-blocking
- [ ] Add concurrency control
  - [ ] Implement p-limit for batch operations
  - [ ] Add configurable concurrency limits
  - [ ] Prevent memory pressure from unbounded operations

### Database Performance
- [ ] Implement SQLite connection pooling
  - [ ] Create connection pool manager
  - [ ] Add pool size configuration
  - [ ] Implement connection recycling
- [ ] Add shared cache mode
  - [ ] Enable cache=shared for SQLite
  - [ ] Add cache configuration options
  - [ ] Test performance improvements

### Memory Optimization
- [ ] Reduce memory allocations
  - [ ] Reuse buffers where possible
  - [ ] Implement object pooling for frequent allocations
  - [ ] Add memory profiling tests
- [ ] Fix memory leaks
  - [ ] Clear all timers and intervals
  - [ ] Remove all event listeners
  - [ ] Implement weak references where appropriate

## 🟠 Priority 3: API Consistency & DX (Before v2.0.0)

### Naming Standardization
- [ ] Standardize function prefixes
  - [ ] `create*` - Factory functions returning instances
  - [ ] `setup*` - One-time initialization with side effects
  - [ ] `use*` - Hook-style functions for test lifecycle
  - [ ] `with*` - Scoped operations with cleanup
  - [ ] `get*` - Pure getters without side effects
- [ ] Fix inconsistent naming
  - [ ] Rename conflicting functions
  - [ ] Add deprecation warnings for old names
  - [ ] Update all documentation

### Error Handling
- [ ] Create base error classes
  - [ ] Implement `TestkitError` base class
  - [ ] Add error codes and categories
  - [ ] Standardize error messages
- [ ] Update all modules to use structured errors
  - [ ] Replace plain Error throws
  - [ ] Add error context and metadata
  - [ ] Implement error serialization

### Breaking Changes Management
- [ ] Add CommonJS compatibility
  - [ ] Add "require" export conditions
  - [ ] Test with CJS consumers
  - [ ] Document dual package hazards
- [ ] Remove deprecated APIs
  - [ ] Remove deprecated auth methods
  - [ ] Clean up legacy exports
  - [ ] Update migration guide

## 🔵 Priority 4: Documentation & Quality (Ongoing)

### Documentation
- [ ] Test all README examples
  - [ ] Create example test suite
  - [ ] Automate example validation
  - [ ] Fix broken examples
- [ ] Create comprehensive guides
  - [ ] Getting started guide
  - [ ] Migration from v1.0.x guide
  - [ ] API reference documentation
  - [ ] Best practices guide
- [ ] Add JSDoc comments
  - [ ] Document all public APIs
  - [ ] Add @example tags
  - [ ] Include @since version tags

### Code Quality
- [ ] Remove all `any` types (9 occurrences)
  - [ ] Add proper type definitions
  - [ ] Use generics where appropriate
  - [ ] Enable strict TypeScript checks
- [ ] Fix module boundaries
  - [ ] Remove circular dependencies
  - [ ] Clarify module responsibilities
  - [ ] Update import/export structure
- [ ] Improve test quality
  - [ ] Replace timing-dependent tests (40+ occurrences)
  - [ ] Add integration test suite
  - [ ] Improve test isolation
  - [ ] Add property-based tests

### CI/CD Improvements
- [ ] Add coverage gates
  - [ ] Fail CI if coverage < 70%
  - [ ] Add per-module coverage requirements
  - [ ] Generate coverage badges
- [ ] Add security scanning
  - [ ] Integrate dependency scanning
  - [ ] Add SAST tools
  - [ ] Automate security updates
- [ ] Add performance benchmarks
  - [ ] Create benchmark suite
  - [ ] Track performance over time
  - [ ] Fail on performance regressions

## 📊 Success Metrics

### Version 1.0.3 Release Criteria
- ✅ All security vulnerabilities fixed
- ✅ Test coverage > 60%
- ✅ All P0 and P1 tasks complete
- ✅ No memory leaks in core paths
- ✅ PR #114 fixes tested

### Version 1.1.0 Release Criteria
- ✅ Test coverage > 80%
- ✅ All P2 tasks complete
- ✅ Performance improvements verified
- ✅ No synchronous blocking operations
- ✅ Connection pooling implemented

### Version 2.0.0 Release Criteria
- ✅ All P3 tasks complete
- ✅ API fully standardized
- ✅ Breaking changes documented
- ✅ Migration guide complete
- ✅ Test coverage > 90%

## 🎯 Task Assignment Suggestions

### Immediate (This Week)
1. Security fixes (P0) - Senior developer
2. Test coverage for utils (P1) - Any developer
3. Resource manager implementation (P1) - Senior developer

### Next Sprint
1. Config module tests (P1) - Mid-level developer
2. Async operation conversion (P2) - Senior developer
3. SQLite pooling (P2) - Database specialist

### Future Sprints
1. API standardization (P3) - Tech lead + team
2. Documentation (P4) - Technical writer + developers
3. Performance benchmarks (P4) - Performance engineer

## 📈 Estimated Timeline

- **Week 1**: Security fixes + critical tests = v1.0.3-beta
- **Week 2-3**: Coverage improvements + resource management = v1.0.3
- **Week 4-6**: Performance optimizations = v1.1.0-beta
- **Week 7-10**: API standardization + breaking changes = v2.0.0-alpha
- **Week 11-12**: Final testing + documentation = v2.0.0

## 🚀 Quick Start Commands

```bash
# Run security audit
pnpm --filter @orchestr8/testkit audit

# Run test coverage
pnpm --filter @orchestr8/testkit test:coverage

# Run performance benchmarks (after creation)
pnpm --filter @orchestr8/testkit bench

# Validate all examples (after creation)
pnpm --filter @orchestr8/testkit test:examples
```

---

**Last Updated**: 2025-09-30
**Total Tasks**: 95
**Critical (P0)**: 12
**High (P1)**: 23
**Medium (P2)**: 25
**Low (P3-P4)**: 35