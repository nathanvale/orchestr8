---
name: simplefied-zombie-management
description:
  Simplify zombie process prevention from 1000+ lines of complex code to 5 lines
  of modern Vitest config
status: backlog
created: 2025-09-20T00:50:18Z
prd_reference: .claude/prds/simplefied-zombie-management.md
priority: high
estimated_effort: 3 days
---

# Epic: Simplified Zombie Management

## Overview

Replace the current over-engineered zombie process prevention system (1000+
lines across 8 files) with a modern, simple Vitest 3.2+ configuration approach
to eliminate machine crashes from zombie processes.

**Core Strategy**: Replace complex process tracking, timeouts, and signal
handlers with `pool: 'forks'` + `teardownTimeout: 20_000` configuration.

## Success Criteria

- ✅ Zero machine crashes from zombie processes (30-day measurement)
- ✅ >90% code reduction in zombie management (1000+ to <50 lines)
- ✅ Zero manual Activity Monitor cleanup required
- ✅ Test suite runs reliably in all scenarios (normal, Ctrl+C, CI)

## Epic Breakdown

### Phase 1: Legacy System Audit & Backup 🔍

**Goal**: Safely inventory and backup current complex zombie management system

#### Task 1.1: Complete File Inventory

- **Effort**: 2 hours
- **Description**: Audit all zombie management files for removal
- **Deliverables**:
  - Line count verification for 8 target files
  - Import/reference mapping across codebase
  - Backup of current working system

**Files to Inventory:**

```
vitest.force-kill.setup.ts                    (330 lines)
vitest.globalSetup.ts                         (29 lines)
vitest.globalTeardown.ts                      (91 lines)
tests/setup/zombie-prevention.ts              (77 lines)
packages/quality-check/src/process-tracker.ts (339 lines)
scripts/emergency-cleanup.ts                  (TBD lines)
scripts/kill-all-zombies.sh                   (TBD lines)
scripts/detect-zombies.sh                     (TBD lines)
```

#### Task 1.2: Reference Dependency Mapping

- **Effort**: 1 hour
- **Description**: Map all imports and references to zombie management code
- **Deliverables**:
  - List of files importing `processTracker`
  - List of files referencing global setup/teardown
  - List of tests using complex cleanup patterns

#### Task 1.3: Create Backup Commit

- **Effort**: 30 minutes
- **Description**: Commit current state as safety fallback
- **Deliverables**:
  - Clean commit with message: "backup: preserve complex zombie management
    before simplification"

### Phase 2: Implement Modern Vitest Configuration 🚀

**Goal**: Replace complex system with 5-line modern Vitest config

#### Task 2.1: Update Core Vitest Configuration

- **Effort**: 1 hour
- **Description**: Implement simplified vitest.config.ts
- **Deliverables**:

```typescript
// vitest.config.ts - SIMPLIFIED VERSION
export default defineConfig({
  test: {
    // 🎯 Core zombie prevention (5 lines)
    pool: 'forks', // Stable process isolation
    teardownTimeout: 20_000, // Give cleanup time
    isolate: true, // Clean worker lifecycle
    fileParallelism: true, // Control concurrency

    // CI stability
    bail: process.env.CI ? 1 : false,

    // Minimal setup
    setupFiles: ['./vitest.setup.tsx'],
    globalSetup: './test/global-setup.ts',
  },
})
```

#### Task 2.2: Create Minimal Global Setup

- **Effort**: 30 minutes
- **Description**: Replace complex global setup/teardown with minimal version
- **Deliverables**:

```typescript
// test/global-setup.ts
export default async function globalSetup() {
  return async function globalTeardown() {
    await Promise.allSettled([
      // Simple resource cleanup without process tracking
    ])
  }
}
```

#### Task 2.3: Validate New Configuration

- **Effort**: 1 hour
- **Description**: Test new config thoroughly before removing old system
- **Deliverables**:
  - Successful test runs (normal execution)
  - Successful interruption handling (Ctrl+C)
  - CI pipeline validation
  - No zombie processes detected

### Phase 3: Legacy System Removal 🧹

**Goal**: Systematically remove 1000+ lines of complex zombie management

#### Task 3.1: Remove Zombie Management Files

- **Effort**: 30 minutes
- **Description**: Delete 8 zombie management files entirely
- **Files to Delete**:
  - `vitest.force-kill.setup.ts` ❌
  - `vitest.globalSetup.ts` ❌
  - `vitest.globalTeardown.ts` ❌
  - `tests/setup/zombie-prevention.ts` ❌
  - `packages/quality-check/src/process-tracker.ts` ❌
  - `scripts/emergency-cleanup.ts` ❌
  - `scripts/kill-all-zombies.sh` ❌
  - `scripts/detect-zombies.sh` ❌

#### Task 3.2: Clean Up Configuration References

- **Effort**: 45 minutes
- **Description**: Remove complex configuration from vitest.config.ts
- **Remove**:
  - Complex `setupFiles` array with zombie-prevention.ts
  - Environment-aware `poolOptions` configuration
  - Commented global setup/teardown references
  - Aggressive timeout configurations

#### Task 3.3: Clean Up Package.json Scripts

- **Effort**: 15 minutes
- **Description**: Remove zombie-specific npm scripts
- **Remove**:
  - `"zombies": "tsx scripts/emergency-cleanup.ts"`
  - `"zombies:kill": "./scripts/kill-all-zombies.sh"`
  - `"test:safe": "./scripts/test-with-cleanup.sh"`
  - Complex `test:debug` with thread configuration

#### Task 3.4: Remove Import References

- **Effort**: 30 minutes
- **Description**: Clean up all imports and references to removed code
- **Actions**:
  - Remove `processTracker` imports
  - Remove references to deleted global setup files
  - Update any test files using complex cleanup patterns

### Phase 4: Implement Simple Resource Patterns 🔧

**Goal**: Provide clean, simple patterns for resource cleanup

#### Task 4.1: Document Standard Cleanup Patterns

- **Effort**: 1 hour
- **Description**: Create documentation for simple resource cleanup
- **Deliverables**:

```typescript
// Standard cleanup pattern for tests
let server: Server | undefined

beforeEach(async () => {
  server = await startTestServer()
})

afterEach(async () => {
  await server?.close()
  server = undefined
})
```

#### Task 4.2: Add Debug Tools

- **Effort**: 30 minutes
- **Description**: Add hanging process detection for debugging
- **Deliverables**:

```json
{
  "test:debug-hangs": "vitest run --reporter=hanging-process"
}
```

#### Task 4.3: Update Quality-Check Package

- **Effort**: 1 hour
- **Description**: Remove processTracker dependencies from quality-check
- **Actions**:
  - Remove or refactor any code importing processTracker
  - Ensure quality-check works without zombie management
  - Update tests if they relied on process tracking

### Phase 5: Validation & Monitoring 🔬

**Goal**: Ensure new system prevents zombie processes reliably

#### Task 5.1: Extended Testing Period

- **Effort**: 48 hours (monitoring)
- **Description**: Monitor for zombie processes over 2-day period
- **Test Scenarios**:
  - Normal test runs
  - Interrupted test runs (Ctrl+C)
  - CI pipeline runs
  - Integration test runs
  - Wallaby.js compatibility

#### Task 5.2: Performance Benchmarking

- **Effort**: 2 hours
- **Description**: Compare before/after performance
- **Metrics**:
  - Test execution time
  - Memory usage
  - Startup time
  - Resource utilization

#### Task 5.3: Documentation Update

- **Effort**: 1 hour
- **Description**: Update project documentation
- **Updates**:
  - Remove references to complex zombie management
  - Document new simple approach
  - Update troubleshooting guides
  - Update team onboarding docs

## Risk Mitigation

### High Risk: Regression Prevention

- **Risk**: New approach might miss edge cases
- **Mitigation**: 48-hour monitoring period before final cleanup
- **Rollback Plan**: Revert to backup commit if zombies detected

### Medium Risk: Performance Impact

- **Risk**: Fork pool might be slower than threads
- **Mitigation**: Benchmark before/after, adjust if needed
- **Fallback**: Can tune `fileParallelism` if performance degrades

### Low Risk: Environment Compatibility

- **Risk**: Wallaby or CI issues with new config
- **Mitigation**: Test in all environments during validation
- **Adjustment**: Minor config tweaks if needed

## Dependencies

### External Dependencies

- ✅ Vitest 3.2.4+ (already satisfied)
- ✅ Node.js LTS (already satisfied)

### Internal Dependencies

- 🔄 Quality-check package cleanup (Task 4.3)
- 🔄 Wallaby configuration adjustment (if needed)
- 🔄 CI pipeline validation (Task 2.3)

## Definition of Done

### Phase Completion Criteria

- [ ] **Phase 1**: Complete file inventory and backup created
- [ ] **Phase 2**: New config implemented and validated
- [ ] **Phase 3**: All legacy files removed, references cleaned
- [ ] **Phase 4**: Simple patterns documented and implemented
- [ ] **Phase 5**: 48-hour monitoring complete with zero zombies

### Epic Completion Criteria

- [ ] Zero machine crashes from zombie processes
- [ ] > 90% reduction in zombie management code
- [ ] All tests pass with new configuration
- [ ] Documentation updated
- [ ] Team notified of changes

## Implementation Timeline

**Day 1**: Phase 1-2 (Audit + Implementation)

- Morning: Complete file inventory and backup
- Afternoon: Implement new Vitest config and validate

**Day 2**: Phase 3-4 (Cleanup + Patterns)

- Morning: Remove legacy files and clean references
- Afternoon: Implement simple patterns and update quality-check

**Day 3**: Phase 5 (Validation)

- Full day: Extended testing and monitoring
- End of day: Documentation and team notification

**Days 4-5**: 48-hour monitoring period

## Success Metrics

### Code Reduction

- **Before**: 1000+ lines across 8 files
- **After**: <50 lines total
- **Target**: >90% reduction

### Reliability

- **Before**: Machine crashes requiring Activity Monitor cleanup
- **After**: Zero machine crashes, zero manual cleanup
- **Target**: 100% reliability over 30 days

### Maintainability

- **Before**: Complex system requiring expert knowledge
- **After**: Simple config new team members can understand
- **Target**: <30 minutes to understand zombie prevention

## Tasks Created

- [ ] 001.md - Complete File Inventory and Line Count Verification (parallel:
      true)
- [ ] 002.md - Reference Dependency Mapping (parallel: true)
- [ ] 003.md - Create Backup Commit (parallel: false)
- [ ] 004.md - Update Core Vitest Configuration (parallel: false)
- [ ] 005.md - Create Minimal Global Setup (parallel: false)
- [ ] 006.md - Validate New Configuration (parallel: false)
- [ ] 007.md - Remove Zombie Management Files (parallel: true)
- [ ] 008.md - Clean Up Configuration References (parallel: true)
- [ ] 009.md - Clean Up Package.json Scripts (parallel: true)
- [ ] 010.md - Remove Import References (parallel: true)
- [ ] 011.md - Document Standard Cleanup Patterns (parallel: true)
- [ ] 012.md - Add Debug Tools (parallel: true)
- [ ] 013.md - Update Quality-Check Package (parallel: false)
- [ ] 014.md - Extended Testing Period (parallel: false)
- [ ] 015.md - Performance Benchmarking (parallel: true)
- [ ] 016.md - Documentation Update (parallel: false)

**Total tasks:** 16 **Parallel tasks:** 10 **Sequential tasks:** 6 **Estimated
total effort:** 10.25 hours

---

_This epic follows the "fix-first" philosophy: solve the root cause (unstable
worker pools) rather than treating symptoms (complex cleanup systems)._
