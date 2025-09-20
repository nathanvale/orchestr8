---
task_id: 002
title: Document zombie process frequency
status: analyzed
created: 2025-09-19T19:50:00Z
analysis_type: parallel_execution
estimated_total_hours: 2
---

# Task 002 Analysis: Zombie Process Documentation

## Parallel Execution Plan

### Stream A: Zombie Detection Script Development (0.5h)

**Files to create/modify:**

- `scripts/detect-zombies.sh`
- `scripts/zombie-monitor.ts`

**Deliverables:**

- Process detection and counting scripts
- Memory usage calculation for zombie processes
- PID tracking and identification

**Dependencies:** None - can start immediately

### Stream B: Baseline Documentation and Clean State (0.5h)

**Files to create/modify:**

- `.claude/metrics/clean-state-{timestamp}.json`
- `scripts/capture-clean-state.sh`
- Screenshots/documentation of clean Activity Monitor

**Deliverables:**

- Clean system state documentation
- Baseline process count before any tests
- Activity Monitor screenshots for reference

**Dependencies:** None - can start immediately (parallel with A)

### Stream C: Test Scenario Execution (0.75h)

**Files to create/modify:**

- `scripts/test-scenarios.sh`
- `.claude/metrics/zombie-scenarios-{timestamp}.json`

**Deliverables:**

- Execute 5 test scenarios with zombie measurement:
  1. Single test file run
  2. Package test run
  3. Full test suite
  4. Multiple consecutive runs (5x)
  5. Watch mode for 10 minutes

**Dependencies:** Stream A completion (needs zombie detection scripts)

### Stream D: Report Generation (0.25h)

**Files to create/modify:**

- `.claude/metrics/baseline-zombies-{timestamp}.json`
- Summary analysis and trend identification

**Deliverables:**

- Comprehensive zombie frequency baseline report
- Correlation analysis between test types and zombie creation
- Actionable insights for prevention mechanisms

**Dependencies:** Streams B & C completion (needs clean state + scenario data)

## Coordination Requirements

1. **Stream A → Stream C**: Detection scripts needed before scenario execution
2. **Streams B & C → Stream D**: Both baseline and scenario data needed for
   final report
3. **Streams A & B**: Can run completely in parallel
4. **Critical Path**: A → C → D (1.5 hours)
5. **Time Savings**: 25% reduction (1.5h parallel vs 2.0h sequential)

## Test Scenarios Detail

### Scenario 1: Single File Test

```bash
pnpm test packages/quality-check/src/utils/logger.test.ts
```

### Scenario 2: Package Test

```bash
pnpm test:package quality-check
```

### Scenario 3: Full Suite

```bash
pnpm test
```

### Scenario 4: Multiple Consecutive

```bash
for i in {1..5}; do pnpm test; done
```

### Scenario 5: Watch Mode

```bash
pnpm test:watch
# Monitor for 10 minutes, document zombie accumulation
```

## Detection Commands

### Zombie Process Detection

```bash
ps aux | grep -E "node.*vitest" | grep -v grep
```

### Count Zombies

```bash
ps aux | grep -E "node.*vitest" | grep -v grep | wc -l
```

### Memory Usage

```bash
ps aux | grep -E "node.*vitest" | grep -v grep | awk '{sum+=$6} END {print sum/1024 " MB"}'
```

## Success Criteria

- [ ] Zombie detection scripts functional
- [ ] Clean system state documented
- [ ] All 5 test scenarios executed and measured
- [ ] Baseline zombie frequency report generated
- [ ] Clear correlation patterns identified between tests and zombies
