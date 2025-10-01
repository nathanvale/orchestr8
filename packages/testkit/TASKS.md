# @orchestr8/testkit - Comprehensive Task List

## 🚨 Priority 0: Critical Security Fixes (IMMEDIATE - Block v1.0.3)

### Command Injection Prevention
- [x] Create `packages/testkit/src/security/index.ts` module ✅
  - [x] Implement `sanitizeCommand()` function with shell metacharacter escaping ✅
  - [x] Implement `validateCommand()` with allowlist validation ✅
  - [x] Add comprehensive tests for command sanitization ✅
- [x] Fix `packages/testkit/src/cli/spawn.ts:84-85` ✅
  - [x] Apply command sanitization to all spawn operations ✅
  - [x] Add validation for command arguments ✅
  - [x] Update tests to verify security measures ✅

### Path Traversal Prevention
- [x] Update `packages/testkit/src/fs/core.ts` ✅
  - [x] Implement `validatePath()` function for all file operations ✅
  - [x] Fix vulnerable join() calls at lines 96, 107, 113, 117, 137 ✅
  - [x] Add boundary checks for temp directory operations ✅
  - [x] Create tests for path traversal attempts ✅

### SQL Injection Prevention
- [x] Review `packages/testkit/src/sqlite/*.ts` ✅
  - [x] Implement parameterized queries for all SQL operations ✅
  - [x] Add input validation for database names and table names ✅
  - [x] Create SQL injection test suite ✅

## 🔴 Priority 1: Critical Bugs & Test Coverage (Before v1.0.3)

### Test Coverage for Fixed Functions
- [x] Add tests for `createMockFn()` in utils ✅
  - [x] Test vitest detection logic ✅
  - [x] Test fallback implementation ✅
  - [x] Test mock tracking capabilities ✅
- [x] Add tests for `retry()` exponential backoff ✅
  - [x] Verify delay progression (100ms, 200ms, 400ms) ✅
  - [x] Test max attempts behavior ✅
  - [x] Test error propagation ✅
- [x] Add tests for `withTimeout()` ✅
  - [x] Verify timeout error message format ✅
  - [x] Test promise resolution/rejection ✅
  - [x] Test cleanup on timeout ✅

### Zero Coverage Modules
- [x] Add comprehensive tests for `packages/testkit/src/config/` ✅
  - [x] Test all 16 exported functions ✅
  - [x] Test environment detection logic ✅
  - [x] Test configuration merging ✅
  - [x] Achieve minimum 80% coverage ✅
- [x] Add tests for `packages/testkit/src/containers/` ✅
  - [x] Test PostgresContainer class ✅
  - [x] Test MySQLContainer class ✅
  - [x] Test container lifecycle management ✅
  - [x] Test error scenarios ✅

### Resource Management
- [x] Create `packages/testkit/src/resources/manager.ts` ✅
  - [x] Implement ResourceManager class ✅
  - [x] Add automatic cleanup registration ✅
  - [x] Handle cleanup errors gracefully ✅
- [x] Fix process event listener leaks ✅
  - [x] Add listener tracking in ProcessListenerManager ✅
  - [x] Implement automatic removal on cleanup ✅
  - [x] Add tests for leak prevention ✅
- [x] Fix file descriptor leaks ✅
  - [x] Add `registerFileDescriptor()` to ResourceManager ✅
  - [x] Automatic cleanup on process exit ✅
  - [x] Add resource counting tests ✅

## 🟡 Priority 2: Performance Optimizations (Before v1.1.0)

### Async Operations
- [x] Replace synchronous operations ✅
  - [x] Convert `execSync` to `exec` with promises in scripts ✅
  - [x] Made cleanup-teardown.ts fully async ✅
  - [x] Made performance-monitor.ts fully async ✅
- [x] Add concurrency control ✅
  - [x] Implement p-limit for batch operations ✅
  - [x] Add configurable concurrency limits ✅
  - [x] Prevent memory pressure from unbounded operations ✅

### Database Performance
- [x] Implement SQLite connection pooling ✅
  - [x] Create connection pool manager ✅
  - [x] Add pool size configuration ✅
  - [x] Implement connection recycling ✅
- [x] Add shared cache mode ✅
  - [x] Enable cache=shared for SQLite ✅
  - [x] Add cache configuration options ✅
  - [x] Test performance improvements ✅

### Memory Optimization
- [x] Reduce memory allocations ✅
  - [x] Implement object pooling for frequent allocations ✅
  - [x] Add BufferPool, ArrayPool, and PromisePool ✅
  - [x] Add memory profiling tests ✅
- [x] Fix memory leaks ✅
  - [x] Clear all timers and intervals ✅
  - [x] Remove all event listeners ✅
  - [x] Implement weak references where appropriate ✅

## 🟠 Priority 3: API Consistency & DX (Before v2.0.0)

### Naming Standardization
- [x] Standardize function prefixes ✅
  - [x] `create*` - Factory functions returning instances ✅
  - [x] `setup*` - One-time initialization with side effects ✅
  - [x] `use*` - Hook-style functions for test lifecycle ✅
  - [x] `with*` - Scoped operations with cleanup ✅
  - [x] `get*` - Pure getters without side effects ✅
- [x] Fix inconsistent naming ✅
  - [x] Rename conflicting functions ✅
  - [x] Add deprecation warnings for old names ✅
  - [x] Update all documentation ✅

### Error Handling
- [x] Create base error classes ✅
  - [x] Implement `TestkitError` base class ✅
  - [x] Add error codes and categories ✅
  - [x] Standardize error messages ✅
- [x] Update all modules to use structured errors ✅
  - [x] Replace plain Error throws ✅
  - [x] Add error context and metadata ✅
  - [x] Implement error serialization ✅

### Breaking Changes Management
- [x] Add CommonJS compatibility ✅
  - [x] Add "require" export conditions ✅
  - [x] Test with CJS consumers ✅
  - [x] Document dual package hazards ✅
- [x] Remove deprecated APIs ✅
  - [x] Remove deprecated auth methods ✅
  - [x] Clean up legacy exports ✅
  - [x] Update migration guide ✅

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