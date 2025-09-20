---
task_id: 003
title: Record current test execution metrics
status: analyzed
created: 2025-09-19T19:50:00Z
analysis_type: parallel_execution
estimated_total_hours: 2
---

# Task 003 Analysis: Test Execution Metrics

## Parallel Execution Plan

### Stream A: Vitest Configuration for Detailed Reporting (0.5h)

**Files to create/modify:**

- `vitest.config.ts` (add reporters and outputFile)
- `.claude/metrics/test-run.json` (output file)

**Deliverables:**

- Enable JSON reporter with detailed metrics
- Configure heap usage logging
- Set up output file in metrics directory

**Dependencies:** None - can start immediately

### Stream B: Test Categorization and Counting (0.5h)

**Files to create/modify:**

- `scripts/categorize-tests.sh`
- `.claude/metrics/test-inventory.json`

**Deliverables:**

- Count tests by type (.test.ts, .unit.test.ts, .integration.test.ts,
  .e2e.test.ts)
- Generate test file inventory
- Identify naming inconsistencies

**Dependencies:** None - can start immediately (parallel with A)

### Stream C: Timed Test Execution Scenarios (0.7h)

**Files to create/modify:**

- `scripts/timed-execution.sh`
- `.claude/metrics/execution-times-{timestamp}.json`

**Deliverables:**

- Execute and time different test scenarios:
  1. Full suite (`pnpm test`)
  2. Unit tests only (`pnpm test:unit` - if exists)
  3. With coverage (`pnpm test:coverage` - if exists)
  4. Watch mode timing (manual 10-minute observation)

**Dependencies:** Stream A completion (needs configured reporting)

### Stream D: Flaky Test Identification (0.5h)

**Files to create/modify:**

- `scripts/flaky-test-detector.sh`
- `.claude/metrics/flaky-tests-{timestamp}.json`

**Deliverables:**

- Run test suite 5 times consecutively
- Compare results to identify inconsistent tests
- Generate flakiness report with failure patterns

**Dependencies:** Stream A completion (needs JSON output for comparison)

### Stream E: Baseline Report Generation (0.25h)

**Files to create/modify:**

- `.claude/metrics/baseline-execution-{timestamp}.json`
- Summary analysis and performance insights

**Deliverables:**

- Comprehensive test execution baseline report
- Performance metrics and bottleneck identification
- Recommendations for optimization

**Dependencies:** Streams C & D completion (needs timing and flaky data)

## Coordination Requirements

1. **Stream A → Streams C & D**: Configured reporting needed for execution
   scenarios
2. **Streams C & D → Stream E**: Both timing and flaky data needed for final
   report
3. **Streams A & B**: Can run completely in parallel
4. **Critical Path**: A → C/D → E (1.45 hours)
5. **Time Savings**: 27% reduction (1.45h parallel vs 2.0h sequential)

## Test Categorization Commands

### Find Different Test Types

```bash
# Unit tests (.test.ts and .unit.test.ts)
find . -name "*.test.ts" -not -name "*.integration.test.ts" -not -name "*.e2e.test.ts" | wc -l

# Integration tests
find . -name "*.integration.test.ts" | wc -l

# E2E tests
find . -name "*.e2e.test.ts" | wc -l

# All test files
find . -name "*.test.ts" | wc -l
```

## Timing Commands

### Full Suite Timing

```bash
time pnpm test 2>&1 | tee .claude/metrics/full-suite-output.log
```

### Coverage Timing

```bash
time pnpm test:coverage 2>&1 | tee .claude/metrics/coverage-output.log
```

## Flaky Test Detection

### Multiple Run Script

```bash
for i in {1..5}; do
  echo "Run #$i"
  pnpm test --reporter=json > .claude/metrics/run-$i.json 2>&1
  echo "Exit code: $?" >> .claude/metrics/run-$i.json
done
```

## Expected Baseline Report Structure

```json
{
  "timestamp": "2025-09-19T10:00:00Z",
  "summary": {
    "total_tests": 956,
    "unit_tests": 850,
    "integration_tests": 85,
    "e2e_tests": 21,
    "test_files": 56,
    "execution_time_ms": 32680,
    "flaky_tests": 3
  },
  "performance": {
    "slowest_tests": [
      {"file": "file1.test.ts", "duration_ms": 5000},
      {"file": "file2.test.ts", "duration_ms": 3500}
    ],
    "fastest_tests": [...],
    "avg_test_duration_ms": 34
  },
  "flakiness": {
    "flaky_test_files": ["flaky1.test.ts"],
    "consistency_rate": 97.2
  }
}
```

## Success Criteria

- [ ] Vitest configured for detailed JSON reporting
- [ ] Test categorization complete with accurate counts
- [ ] All execution scenarios timed and documented
- [ ] Flaky tests identified through multiple runs
- [ ] Comprehensive baseline execution report generated
- [ ] Performance bottlenecks and optimization opportunities identified
