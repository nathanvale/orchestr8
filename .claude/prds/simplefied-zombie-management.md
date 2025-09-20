---
name: simplefied-zombie-management
description:
  Simplify zombie process prevention from 1000+ lines of complex code to 5 lines
  of modern Vitest config
status: epic_created
created: 2025-09-20T00:39:18Z
---

# PRD: Simplified Zombie Management

## Executive Summary

Replace the current over-engineered zombie process prevention system (1000+
lines across 8 files) with a modern, simple Vitest 3.2+ configuration approach.
The goal is to eliminate machine crashes from zombie processes while
dramatically reducing maintenance overhead and system complexity.

**Key Change**: Replace complex process tracking, timeouts, and signal handlers
with `pool: 'forks'` + `teardownTimeout: 20_000` configuration.

## Problem Statement

### Current Pain Points

1. **Machine Crashes**: Developer machines crash requiring manual Activity
   Monitor cleanup of zombie Node/Vitest processes
2. **Over-Engineering**: 1000+ lines of complex zombie management code across
   multiple files
3. **Maintenance Burden**: Complex timeout systems, signal handlers, and process
   trackers that are hard to debug
4. **Unreliable Protection**: Despite complexity, zombies still escape and crash
   machines

### Why This is Critical Now

- **Developer Productivity**: Manual zombie cleanup disrupts development flow
- **System Stability**: Machine crashes are unacceptable for daily development
- **Code Debt**: Complex system is harder to maintain than the problem it solves
- **Modern Solutions**: Vitest 3.2+ provides better built-in zombie prevention

## User Stories

### Primary Persona: Developer

**As a developer, I want to:**

- Run tests without worrying about machine crashes
- Never need to manually kill zombie processes in Activity Monitor
- Have a simple, reliable test infrastructure that "just works"
- Understand the zombie prevention system without reading 1000+ lines

**Acceptance Criteria:**

- Zero machine crashes from zombie processes
- Zero manual Activity Monitor cleanup required
- Test suite runs reliably in all scenarios (normal run, Ctrl+C interrupt, CI)
- Zombie management code is under 50 lines total

### Secondary Persona: Team Lead

**As a team lead, I want to:**

- Reduce system complexity and maintenance overhead
- Have predictable test infrastructure that new team members can understand
- Eliminate "mystery crashes" that waste team time

## Requirements

### Functional Requirements

#### Core Zombie Prevention

- **FR-1**: Prevent zombie Node/Vitest processes from surviving test runs
- **FR-2**: Handle graceful test interruption (Ctrl+C) without leaving zombies
- **FR-3**: Clean up resources in CI environments reliably
- **FR-4**: Support development, CI, and Wallaby environments

#### Resource Management

- **FR-5**: Provide simple patterns for test-level resource cleanup (servers, DB
  connections)
- **FR-6**: Global setup/teardown for shared resources
- **FR-7**: Hanging process detection for debugging (on-demand only)

### Non-Functional Requirements

#### Performance

- **NFR-1**: Test execution time should not increase significantly
- **NFR-2**: Memory usage should remain stable or improve
- **NFR-3**: Startup time should improve due to reduced complexity

#### Reliability

- **NFR-4**: 100% zombie process prevention (zero tolerance for machine crashes)
- **NFR-5**: Graceful degradation if cleanup fails
- **NFR-6**: Works across Node.js LTS versions

#### Maintainability

- **NFR-7**: Zombie management code under 50 lines total
- **NFR-8**: New team members can understand system in <30 minutes
- **NFR-9**: Zero custom process tracking required

## Success Criteria

### Primary Metrics

1. **Zero machine crashes** from zombie processes (measured over 30 days
   post-implementation)
2. **>90% code reduction** in zombie management (from 1000+ to <50 lines)
3. **Zero manual zombie cleanup** required in Activity Monitor

### Secondary Metrics

4. **Faster test startup** due to reduced setup complexity
5. **Improved developer onboarding** (zombie system understanding time)
6. **Reduced support tickets** related to test infrastructure issues

## Legacy System Cleanup Audit

### Phase 1: Complete File Removal

**Files to Delete Entirely:**

```
vitest.force-kill.setup.ts                    (330 lines) ❌
vitest.globalSetup.ts                         (29 lines)  ❌
vitest.globalTeardown.ts                      (91 lines)  ❌
tests/setup/zombie-prevention.ts              (77 lines)  ❌
packages/quality-check/src/process-tracker.ts (339 lines) ❌
scripts/emergency-cleanup.ts                  (TBD lines) ❌
scripts/kill-all-zombies.sh                   (TBD lines) ❌
scripts/detect-zombies.sh                     (TBD lines) ❌
```

**Total Removal**: ~866+ lines of zombie management code

### Phase 2: Configuration Cleanup

**vitest.config.ts - Remove Complex Sections:**

```typescript
// ❌ REMOVE: Complex setup files array
setupFiles: [
  './vitest.setup.tsx',
  './tests/setup/console-suppression.ts',
  './tests/setup/memory-cleanup.ts',
  './tests/setup/zombie-prevention.ts',  // 🎯 Main removal
],

// ❌ REMOVE: Environment-aware pool configuration
pool: process.env['WALLABY_WORKER'] ? 'threads' : 'forks',
poolOptions: {
  threads: {
    singleThread: !!process.env['WALLABY_WORKER'],
    isolate: true,
    useAtomics: false,
  },
  forks: {
    singleFork: false,
    maxForks: isCI ? 2 : Math.max(1, cpus().length - 1),
    minForks: 1,
    isolate: true,
  },
},

// ❌ REMOVE: Commented global setup/teardown references
// globalSetup: './vitest.globalSetup.ts',
// globalTeardown: './vitest.globalTeardown.ts',

// ❌ REMOVE: Aggressive timeouts
testTimeout: 5000,
hookTimeout: 10000,
teardownTimeout: 5000,
```

### Phase 3: Package.json Script Cleanup

**Remove Zombie-Specific Scripts:**

```json
{
  "zombies": "tsx scripts/emergency-cleanup.ts",        ❌
  "zombies:kill": "./scripts/kill-all-zombies.sh",     ❌
  "test:safe": "./scripts/test-with-cleanup.sh",       ❌
  "test:debug": "vitest --inspect-brk --pool=threads --poolOptions.threads.singleThread" ❌
}
```

### Phase 4: Import/Reference Cleanup

**Files Referencing Removed Components:**

- Search for imports of `processTracker`
- Remove references to `vitest.globalSetup.ts`
- Clean up any emergency cleanup script calls
- Update documentation removing zombie management references

### Phase 5: Test File Cleanup

**Audit Test Files Using Complex Patterns:**

- Remove manual process tracking calls
- Simplify test-level cleanup to standard patterns
- Remove emergency timeout handlers in individual tests

## Implementation Approach

### Phase 1: Modern Vitest Configuration (Day 1)

```typescript
// vitest.config.ts - NEW SIMPLIFIED VERSION
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

### Phase 2: Minimal Global Setup (Day 1)

```typescript
// test/global-setup.ts - MINIMAL REPLACEMENT
export default async function globalSetup() {
  // Only truly global resources here

  return async function globalTeardown() {
    // Simple cleanup without process tracking
    await Promise.allSettled([
      // server?.close?.(),
      // prisma?.$disconnect?.(),
      // redis?.quit?.(),
    ])
  }
}
```

### Phase 3: Simple Resource Patterns (Day 2)

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

### Phase 4: Debugging Tools (Day 3)

```json
{
  "test:debug-hangs": "vitest run --reporter=hanging-process"
}
```

## Constraints & Assumptions

### Technical Constraints

- Must work with Vitest 3.2.4 (current version)
- Must support Node.js LTS versions
- Must maintain Wallaby.js compatibility
- Must work in GitHub Actions CI

### Timeline Constraints

- **Critical**: Implementation must complete within 1 sprint
- **Urgent**: Machine crashes are affecting daily productivity

### Resource Constraints

- **Single developer** can implement (no team coordination needed)
- **Low risk** change (can revert easily if issues)

## Out of Scope

### Explicitly NOT Building

- **Custom process monitoring systems** - Use Vitest built-ins
- **Complex timeout management** - Use simple teardownTimeout
- **Emergency zombie killing scripts** - Prevent rather than clean up
- **Process tracking analytics** - Keep it simple
- **Environment-specific worker pools** - Use forks everywhere

### Future Considerations

- Memory leak detection (separate from zombie prevention)
- Test performance optimization (separate concern)
- Advanced CI parallelization (if needed later)

## Dependencies

### External Dependencies

- **Vitest 3.2.4+** (already satisfied)
- **Node.js LTS** (already satisfied)

### Internal Dependencies

- **Quality-check package** may need updates if it imports processTracker
- **Wallaby configuration** may need adjustment for new pool config
- **CI pipeline** should not require changes (forks work in CI)

### Cleanup Dependencies

- **Complete audit** of all files referencing removed zombie management
- **Documentation updates** removing complex zombie management references
- **Team notification** about simplified approach

## Risk Assessment

### High Risk (Mitigation Required)

- **Regression Risk**: New approach might miss edge cases the complex system
  handled
  - _Mitigation_: Gradual rollout, monitor for 48 hours before removing old
    files

### Medium Risk (Monitor)

- **Performance Impact**: Fork pool might be slower than threads in some
  scenarios
  - _Mitigation_: Benchmark before/after, can adjust if needed

### Low Risk (Accept)

- **Wallaby Compatibility**: May need minor wallaby.js config adjustments
- **CI Environment**: Forks should work fine in CI, but monitor first few runs

## Next Steps

1. **Create Epic**: Run `/pm:prd-parse simplefied-zombie-management`
2. **Backup Current System**: Commit current state before changes
3. **Implement Core Config**: Update vitest.config.ts with 5-line approach
4. **Test Extensively**: Run test suite multiple times, try interrupting
5. **Monitor Results**: Watch for zombie processes over 48 hours
6. **Complete Cleanup**: Remove old files once new approach is proven

---

_This PRD follows the "fix-first" philosophy: solve the root cause (unstable
worker pools) rather than treating symptoms (complex cleanup systems)._
