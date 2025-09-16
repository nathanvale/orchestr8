# Memory Optimization Patterns

## Core Principles

1. **Measure First**: Profile before optimizing
2. **Monitor Continuously**: Track memory in real-time
3. **Set Limits**: Enforce boundaries to catch issues early
4. **Clean Up**: Always dispose of resources
5. **Pool Resources**: Reuse objects when possible

## Implementation Patterns

### 1. Resource Disposal Pattern

```typescript
class ResourceManager {
  private resources: Resource[] = []

  dispose(): void {
    // Release all resources
    this.resources.forEach(r => r.release())
    this.resources = []

    // Clear caches
    this.cache?.clear()

    // Trigger garbage collection if available
    if (global.gc) {
      global.gc()
    }
  }
}
```

**When to Use**:
- Long-lived objects with state
- Objects holding file handles or connections
- Cache managers

### 2. Buffer Pooling Pattern

```typescript
class BufferPool {
  private available: Buffer[] = []
  private inUse: Set<Buffer> = new Set()

  acquire(size: number): Buffer {
    // Reuse existing buffer if available
    const buffer = this.available.pop() || Buffer.allocUnsafe(size)
    this.inUse.add(buffer)
    return buffer
  }

  release(buffer: Buffer): void {
    this.inUse.delete(buffer)
    buffer.fill(0) // Clear sensitive data
    this.available.push(buffer)
  }
}
```

**When to Use**:
- High-frequency buffer allocations
- File I/O operations
- Network communication

### 3. Streaming Processing Pattern

```typescript
async function processLargeFile(filepath: string) {
  const stream = fs.createReadStream(filepath, {
    highWaterMark: 64 * 1024 // 64KB chunks
  })

  for await (const chunk of stream) {
    await processChunk(chunk)
    // Chunk is released after processing
  }
}
```

**When to Use**:
- Files larger than 10MB
- Real-time data processing
- Memory-constrained environments

### 4. Adaptive Batch Processing Pattern

```typescript
class AdaptiveBatchProcessor {
  async processBatch(items: Item[]) {
    const batchSize = this.calculateBatchSize()

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      await this.process(batch)

      // Apply backpressure if needed
      if (this.isMemoryPressure()) {
        await this.delay(100)
      }
    }
  }

  calculateBatchSize(): number {
    const memoryUsage = process.memoryUsage().heapUsed
    const available = this.maxMemory - memoryUsage

    // Reduce batch size under pressure
    return available < this.threshold
      ? Math.max(1, this.defaultBatch / 2)
      : this.defaultBatch
  }
}
```

**When to Use**:
- Bulk operations
- Variable workload sizes
- Memory-sensitive operations

### 5. Memory Monitoring Pattern

```typescript
class MemoryMonitor {
  private snapshots: MemorySnapshot[] = []

  beforeOperation(name: string): void {
    this.snapshots.push({
      name,
      timestamp: Date.now(),
      memory: process.memoryUsage()
    })
  }

  afterOperation(name: string): MemoryDelta {
    const before = this.snapshots.find(s => s.name === name)
    const after = process.memoryUsage()

    return {
      heapUsed: after.heapUsed - before.memory.heapUsed,
      rss: after.rss - before.memory.rss
    }
  }
}
```

**When to Use**:
- Test suites
- Performance benchmarking
- Production monitoring

### 6. Incremental Compilation Pattern

```typescript
class CompilerEngine {
  private program: Program | undefined

  compile(files: string[]): CompilationResult {
    // Reuse existing program for incremental compilation
    if (!this.program) {
      this.program = createProgram(this.getAllProjectFiles())
    }

    // Only check specific files, reusing compilation state
    return this.program.checkFiles(files)
  }
}
```

**When to Use**:
- TypeScript compilation
- Build systems
- Static analysis tools

### 7. Weak Reference Pattern

```typescript
class CacheWithWeakRefs {
  private cache = new WeakMap<object, CachedData>()

  get(key: object): CachedData | undefined {
    // Automatically garbage collected when key is no longer referenced
    return this.cache.get(key)
  }

  set(key: object, value: CachedData): void {
    this.cache.set(key, value)
  }
}
```

**When to Use**:
- Caching with automatic cleanup
- Metadata storage
- Memory-sensitive caches

### 8. Memory Pressure Detection Pattern

```typescript
class MemoryPressureDetector {
  isUnderPressure(): boolean {
    const usage = process.memoryUsage()
    const percentUsed = usage.heapUsed / usage.heapTotal

    return percentUsed > 0.85 // 85% threshold
  }

  async waitForRelief(): Promise<void> {
    while (this.isUnderPressure()) {
      // Force garbage collection
      if (global.gc) global.gc()

      // Wait for memory to be freed
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}
```

**When to Use**:
- Before memory-intensive operations
- Resource allocation decisions
- Backpressure implementation

## Anti-Patterns to Avoid

### 1. Memory Leaks
```typescript
// ❌ BAD: Event listeners not removed
element.addEventListener('click', handler)

// ✅ GOOD: Clean up listeners
element.addEventListener('click', handler)
// Later...
element.removeEventListener('click', handler)
```

### 2. Unbounded Caches
```typescript
// ❌ BAD: Cache grows indefinitely
class Cache {
  private data = new Map()
  set(key, value) { this.data.set(key, value) }
}

// ✅ GOOD: LRU cache with size limit
class LRUCache {
  constructor(private maxSize: number) {}
  set(key, value) {
    if (this.data.size >= this.maxSize) {
      const firstKey = this.data.keys().next().value
      this.data.delete(firstKey)
    }
    this.data.set(key, value)
  }
}
```

### 3. Large Object Cloning
```typescript
// ❌ BAD: Deep cloning large objects
const copy = JSON.parse(JSON.stringify(largeObject))

// ✅ GOOD: Selective copying
const copy = {
  needed: largeObject.needed,
  required: largeObject.required
}
```

### 4. Synchronous File Loading
```typescript
// ❌ BAD: Loading entire file into memory
const content = fs.readFileSync('huge-file.txt', 'utf8')

// ✅ GOOD: Streaming processing
const stream = fs.createReadStream('huge-file.txt')
stream.on('data', chunk => process(chunk))
```

## Testing Patterns

### Memory Leak Detection Test
```typescript
test('should not leak memory', async () => {
  const profiler = new MemoryProfiler()

  // Warm up
  for (let i = 0; i < 3; i++) {
    await operation()
  }

  // Measure
  profiler.snapshot('before')
  for (let i = 0; i < 100; i++) {
    await operation()
  }
  profiler.snapshot('after')

  // Check for leaks
  const leak = profiler.detectLeaks()
  expect(leak.potentialLeak).toBe(false)
})
```

### Memory Limit Test
```typescript
test('should respect memory limit', async () => {
  const monitor = new MemoryMonitor({ maxMemoryMB: 100 })

  monitor.beforeTest('memory-test')
  await memoryIntensiveOperation()
  monitor.afterTest('memory-test')

  expect(() => monitor.checkMemoryLimit('memory-test')).not.toThrow()
})
```

## Monitoring and Alerting

### Production Memory Monitoring
```typescript
class ProductionMonitor {
  constructor() {
    setInterval(() => this.checkMemory(), 60000) // Every minute
  }

  checkMemory(): void {
    const usage = process.memoryUsage()
    const percentUsed = usage.heapUsed / usage.heapTotal

    if (percentUsed > 0.9) {
      this.alert('Critical memory usage', usage)
    } else if (percentUsed > 0.8) {
      this.warn('High memory usage', usage)
    }

    this.metrics.record('memory.heap.used', usage.heapUsed)
    this.metrics.record('memory.rss', usage.rss)
  }
}
```

## Configuration Guidelines

### Recommended Settings
```javascript
// Node.js Options
NODE_OPTIONS='--max-old-space-size=4096' // 4GB heap

// Application Config
{
  memory: {
    maxHeapMB: 3500,        // Leave buffer below NODE_OPTIONS
    warningThresholdMB: 2800, // 80% of max
    criticalThresholdMB: 3200, // 90% of max
    gcInterval: 60000,      // Force GC every minute
    monitoringInterval: 5000 // Check every 5 seconds
  }
}
```

### Environment-Specific Settings

**Development**:
- Enable detailed monitoring
- Lower thresholds for early detection
- Verbose logging

**Testing**:
- Per-test memory limits
- Leak detection enabled
- Fail fast on memory issues

**Production**:
- Conservative limits
- Graceful degradation
- Alerting without crashing

## Tools and Utilities

### Memory Profiling Tools
- Chrome DevTools (--inspect flag)
- clinic.js
- heapdump module
- v8-profiler-next

### Monitoring Libraries
- prom-client (Prometheus metrics)
- @opentelemetry/metrics
- newrelic

### Testing Tools
- Vitest with memory hooks
- Jest with --detectLeaks
- Wallaby.js for real-time feedback

## Checklist for Memory Optimization

- [ ] Profile current memory usage
- [ ] Identify memory hotspots
- [ ] Implement disposal patterns
- [ ] Add resource pooling where appropriate
- [ ] Use streaming for large data
- [ ] Implement monitoring
- [ ] Set memory limits
- [ ] Add memory tests
- [ ] Document configuration
- [ ] Monitor in production