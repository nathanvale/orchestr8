# Memory Profiling Guide

## Chrome DevTools Workflow

### Setup
1. Run tests with inspector: `pnpm test:debug`
2. Open Chrome and navigate to `chrome://inspect`
3. Click "inspect" under Remote Target

### Key Profiling Techniques

#### Heap Snapshots
- Take before/after snapshots
- Compare to identify memory growth
- Use Summary, Comparison, and Containment views

#### Allocation Timeline
- Record allocations over time
- Identify memory spikes and patterns

#### Built-in Scripts
```bash
pnpm profile:memory    # Profile with GC exposed
pnpm profile:heap      # Generate heap trace log
pnpm profile:snapshot  # Take snapshots on signal
```

### Using MemoryProfiler
```typescript
const profiler = new MemoryProfiler();
profiler.snapshot('before');
await operation();
profiler.snapshot('after');

const delta = profiler.getDelta('before', 'after');
const leaks = profiler.detectLeaks();
```

### Using MemoryBaseline
```typescript
const baseline = new MemoryBaseline();
const result = await baseline.measure('operation', fn);

// Compare operations
const comparison = await baseline.compare(
  { name: 'A', fn: fnA },
  { name: 'B', fn: fnB }
);
```

## Common Issues & Solutions

### Memory Leaks
- Continuous heap growth
- Use `detectLeaks()` method
- Profile with multiple iterations

### Large Allocations
- Check Shallow/Retained Size in snapshots
- Look for unexpected large objects

### High Allocation Rate
- Use allocation timeline
- Monitor with `--trace-gc`

## Best Practices
1. Establish baseline measurements
2. Force GC before measurements (`--expose-gc`)
3. Profile operations in isolation
4. Set memory thresholds in CI/CD