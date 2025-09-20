---
task: 004
title: Create zombie process tracking system
analyzed: 2025-09-19T21:20:00Z
status: implementation-ready
---

# Task #004 Analysis: Zombie Process Tracking System

## Overview

Implement a comprehensive process tracking system to monitor and terminate all
child processes spawned during test execution, preventing zombie process
accumulation.

## Current State Analysis

### Existing Infrastructure

1. **Memory monitoring** already implemented in:
   - `tests/setup/memory-cleanup.ts`
   - `tests/setup/memory-monitor.ts`
2. **Process spawning patterns** in:
   - `packages/quality-check/src/utils/secure-git-operations.ts`
3. **Vitest hooks** established in:
   - `vitest.setup.tsx`
   - Test setup patterns

### Key Findings

- No existing process tracking mechanism
- Memory monitoring infrastructure can be extended
- Secure spawn patterns available for reuse
- Hook infrastructure ready for integration

## Parallel Work Streams

### Stream A: Core Process Tracker Module

**Files:** `packages/quality-check/src/process-tracker.ts`

- ProcessInfo interface (pid, ppid, testFile, startTime, command, status)
- ProcessTracker class with Map<number, ProcessInfo>
- Methods: trackProcess, terminateProcess, terminateAll, getZombieProcesses
- SIGTERM with 5s timeout, then SIGKILL fallback
- Process status monitoring

### Stream B: Node.js Process Interception

**Files:** `packages/quality-check/src/process-interceptor.ts`

- Override child_process.spawn, exec, fork
- Automatic process tracking on spawn
- Parent-child relationship maintenance
- Exit event handling
- Integration with ProcessTracker

### Stream C: Vitest Integration

**Files:** Update existing test setup files

- Hook into beforeEach/afterEach/afterAll
- Track current test file context
- Per-test process cleanup
- Zombie detection and reporting
- Integration with memory monitoring

### Stream D: CLI Utilities

**Files:** `scripts/zombie-management.ts`

- pnpm zombies:check - detect zombie processes
- pnpm zombies:kill - force kill all test processes
- pnpm zombies:monitor - real-time monitoring
- Update package.json scripts

## Implementation Strategy

### Technical Decisions

1. **Data Structure**: Map for O(1) process lookups
2. **Termination**: Graceful SIGTERM, forceful SIGKILL
3. **Timeout**: 5 second grace period
4. **Monitoring**: Poll-based for cross-platform compatibility
5. **Integration**: Extend existing infrastructure

### Coordination Points

- Stream A must complete ProcessTracker before Stream C integration
- Stream B exports for Stream C consumption
- Stream D can proceed independently
- All streams share process tracking types

### Risk Mitigation

- Configurable timeouts for different environments
- Opt-in force kill to prevent data corruption
- Whitelist for legitimate long-running processes
- Graceful degradation if tracking fails

## Success Metrics

- Zero zombie processes after test runs
- All spawned processes tracked
- Successful termination of all test processes
- CLI utilities functional
- No interference with legitimate processes

## Testing Requirements

1. Unit tests for ProcessTracker class
2. Integration tests for process interception
3. End-to-end test running verification
4. Force kill functionality tests
5. CLI utility tests

## Dependencies

- Node.js child_process module
- Vitest hooks system
- Existing memory monitoring
- Unix process management tools

## Estimated Completion

- Stream A: 2 hours
- Stream B: 2 hours
- Stream C: 1 hour
- Stream D: 1 hour
- Testing: 2 hours
- Total: ~8 hours with parallel execution (~3 hours)
