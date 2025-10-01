# Performance Benchmarks

This directory contains comprehensive performance benchmarks for the testkit package to track and optimize performance over time.

## 📊 Benchmark Coverage

### Core Utilities (`utils.bench.ts`)
- `delay()` function performance
- `retry()` with various failure scenarios
- `withTimeout()` promise racing
- `createMockFn()` creation and execution
- Complex utility combinations
- Memory allocation patterns

### Concurrency Management (`concurrency.bench.ts`)
- `ConcurrencyManager` creation and operations
- Batch processing with different sizes
- Limited promise execution patterns
- Global concurrency managers
- Stress tests with queue buildup
- Memory efficiency tests

### File System Operations (`fs.bench.ts`)
- Temporary directory creation and management
- File operations (read/write) with various sizes
- Directory operations and path handling
- Cleanup performance
- Concurrent operations

### SQLite Utilities (`sqlite.bench.ts`)
- Memory URL generation for different targets
- File database creation and management
- Database cleanup operations
- Connection pooling performance
- Resource management patterns

### Resource Management (`resources.bench.ts`)
- ResourceManager creation and configuration
- Resource registration and cleanup
- Dependency handling
- Error handling and timeouts
- Monitoring and leak detection
- Stress testing with many resources

## 🚀 Usage

### Running Benchmarks

```bash
# Run all benchmarks once
pnpm bench

# Run benchmarks in watch mode
pnpm bench:watch

# Generate JSON output for CI
pnpm bench:ci

# Compare against baseline
pnpm bench:compare

# Generate new baseline
pnpm bench:baseline
```

### Individual Benchmark Suites

```bash
# Run specific benchmark file
pnpm vitest bench benchmarks/utils.bench.ts

# Run with custom iterations
pnpm vitest bench benchmarks/concurrency.bench.ts --config vitest.bench.config.ts
```

## 📈 Performance Tracking

### Baseline Metrics
- `baseline.json` - Reference performance metrics
- `baseline-generated.json` - Auto-generated baseline from latest run

### Key Metrics Tracked
- **Operations per second (ops/sec)** - Throughput measurement
- **Average time (ms)** - Mean execution time
- **95th percentile (p95)** - Performance under load
- **Memory usage (MB)** - Memory allocation tracking
- **Garbage collection impact** - GC frequency and duration

### Regression Detection
- **10% decrease** in ops/sec triggers regression alert
- **15% increase** in execution time is flagged
- **20% increase** in memory usage is concerning
- **5-10% variance** is considered normal system noise

## 🔧 Configuration

### Benchmark Settings
```typescript
// vitest.bench.config.ts
{
  testTimeout: 60000,      // 60s timeout for slow benchmarks
  singleFork: true,        // Consistent results
  coverage: false,         // Disabled for performance
}
```

### Environment Variables
```bash
NODE_OPTIONS="--max-old-space-size=4096"  # Increase memory for large benchmarks
```

## 📊 CI Integration

### Automated Benchmarking
- Runs on every PR and main branch push
- Non-blocking (won't fail CI if benchmarks fail)
- Compares against baseline automatically
- Uploads results as artifacts

### Viewing Results
1. **GitHub Actions Summary** - Quick overview of performance changes
2. **Artifacts** - Download detailed JSON results
3. **Comparison Report** - Regression detection with specific metrics

### Performance Alerts
- Significant regressions are highlighted in PR comments
- Baseline is updated automatically on main branch
- Historical trends tracked through artifacts

## 🎯 Best Practices

### Writing Benchmarks
1. **Realistic scenarios** - Test actual usage patterns
2. **Multiple iterations** - Account for variance with adequate sample sizes
3. **Proper cleanup** - Prevent memory leaks between tests
4. **Meaningful names** - Clear benchmark descriptions
5. **Appropriate scales** - Test both small and large operations

### Interpreting Results
1. **Focus on trends** - Single runs can vary significantly
2. **System context** - CI results may differ from local runs
3. **Relative changes** - Compare against baseline, not absolute numbers
4. **Memory patterns** - Watch for memory leaks and GC pressure
5. **Real-world impact** - Consider if changes affect actual user experience

## 🔍 Troubleshooting

### Common Issues
- **High variance**: System load, use more iterations
- **Memory errors**: Increase Node.js memory limit
- **Timeouts**: Reduce benchmark complexity or increase timeout
- **Inconsistent results**: Check for resource cleanup issues

### Debugging
```bash
# Verbose benchmark output
pnpm vitest bench --reporter=verbose

# Single benchmark for debugging
pnpm vitest bench benchmarks/utils.bench.ts --reporter=verbose

# Memory profiling
NODE_OPTIONS="--inspect" pnpm bench
```

## 📚 Additional Resources

- [Vitest Benchmarking Guide](https://vitest.dev/guide/features.html#benchmarking)
- [Performance Best Practices](../docs/performance.md)
- [CI Configuration](../../.github/workflows/ci.yml)