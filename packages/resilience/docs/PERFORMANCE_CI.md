# Performance Testing in CI

## Overview

Performance benchmarks are automatically run in CI to ensure resilience patterns maintain acceptable overhead. The benchmarks validate that our resilience middleware adds minimal latency to operations.

## Performance Targets

### Local Development

- **Median latency:** < 1ms overhead
- **P95 latency:** < 2ms overhead

### CI Environment

- **Median latency:** < 2ms overhead (relaxed due to CI variability)
- **P95 latency:** < 5ms overhead (relaxed due to CI variability)

## Running Benchmarks

### Locally

```bash
# Run performance benchmarks
PERF=1 pnpm test

# Or run benchmark directly
PERF=1 tsx packages/resilience/src/benchmark.ts
```

### In CI

Benchmarks run automatically when `CI=true` is set. The CI pipeline will fail if performance targets are not met.

## Handling CI Flakiness

### Common Causes of Flakes

1. **Resource contention:** CI runners may share resources with other jobs
2. **Cold starts:** First runs may be slower due to JIT compilation
3. **Network variability:** Even local operations can have variance in CI
4. **GC pauses:** Garbage collection can cause timing spikes

### Mitigation Strategies

1. **Warm-up iterations:** Benchmarks include warm-up runs before measurement
2. **Statistical analysis:** Use median instead of mean to reduce outlier impact
3. **Multiple iterations:** Run sufficient iterations (1000+) for stable results
4. **Relaxed CI thresholds:** CI uses 2x the local thresholds

### Dealing with Failures

If performance benchmarks fail in CI:

1. **Check if it's a flake:**
   - Re-run the CI job once to see if it passes
   - Look for outliers in the benchmark output

2. **If consistently failing:**
   - Review recent changes for performance regressions
   - Run benchmarks locally to reproduce
   - Profile the code to identify bottlenecks

3. **Temporary workarounds:**
   - If urgent, can temporarily set `SKIP_PERF=1` in CI
   - Must create issue to investigate and fix

## Benchmark Implementation

The benchmarks test various resilience patterns:

- Baseline (no resilience)
- Timeout only
- Retry only
- Circuit breaker only
- Full composition (retry + circuit breaker + timeout)

Each benchmark:

1. Runs 100 warm-up iterations
2. Runs 1000 measured iterations
3. Calculates median, P95, P99 times
4. Validates against targets
5. Fails CI if targets not met (in CI mode only)

## Future Improvements

- [ ] Add memory usage benchmarks
- [ ] Track performance trends over time
- [ ] Add benchmarks for error scenarios
- [ ] Consider using dedicated performance testing infrastructure
