# Memory Issues Troubleshooting Guide

## Common Memory Problems and Solutions

### 1. Heap Out of Memory Error

**Symptoms**:
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Causes**:
- Default Node.js heap size too small
- Memory leak in application
- Processing too much data at once

**Solutions**:

1. **Increase heap size**:
```bash
# Set to 4GB
export NODE_OPTIONS='--max-old-space-size=4096'

# Or in package.json scripts
"test": "NODE_OPTIONS='--max-old-space-size=4096' vitest"
```

2. **Check for memory leaks**:
```typescript
// Run memory profiling
const profiler = new MemoryProfiler()
profiler.snapshot('start')
// ... run operation multiple times ...
profiler.snapshot('end')
console.log(profiler.detectLeaks())
```

3. **Use batch processing**:
```typescript
const processor = new FileBatchProcessor({ batchSize: 50 })
await processor.processBatches(files, processFile)
```

### 2. Slow Performance / High Memory Usage

**Symptoms**:
- Tests running slowly
- System becoming unresponsive
- Memory usage constantly high

**Causes**:
- Not disposing resources
- Accumulating cache data
- Creating too many objects

**Solutions**:

1. **Implement disposal**:
```typescript
afterEach(() => {
  engine.dispose()
  cache.clear()
  if (global.gc) global.gc()
})
```

2. **Use resource pooling**:
```typescript
const bufferPool = new BufferPool(10, 1024 * 64)
const buffer = bufferPool.acquire()
try {
  // Use buffer
} finally {
  bufferPool.release(buffer)
}
```

3. **Monitor memory usage**:
```typescript
const monitor = new MemoryMonitor()
monitor.beforeTest('test-name')
// ... run test ...
monitor.afterTest('test-name')
console.log(monitor.getTestData('test-name'))
```

### 3. Memory Leaks in Tests

**Symptoms**:
- Memory usage grows with each test
- Later tests fail with OOM
- CI/CD pipeline failures

**Causes**:
- Event listeners not removed
- Timers not cleared
- Global state accumulation

**Solutions**:

1. **Clean up in afterEach**:
```typescript
afterEach(() => {
  // Clear all timers
  vi.clearAllTimers()

  // Remove event listeners
  emitter.removeAllListeners()

  // Reset mocks
  vi.resetAllMocks()

  // Clear module cache if needed
  vi.resetModules()
})
```

2. **Use memory monitoring hooks**:
```typescript
// In vitest.config.ts
export default {
  test: {
    setupFiles: ['./tests/setup/memory-cleanup.ts']
  }
}
```

3. **Set per-test limits**:
```typescript
const monitor = new MemoryMonitor({ maxMemoryMB: 500 })
monitor.checkMemoryLimit('test-name') // Throws if over limit
```

### 4. TypeScript Compilation Memory Issues

**Symptoms**:
- TypeScript check consuming excessive memory
- Multiple program instances created
- Incremental compilation not working

**Causes**:
- Creating new program for each check
- Not reusing compilation state
- Loading all type definitions repeatedly

**Solutions**:

1. **Reuse TypeScript program**:
```typescript
class TypeScriptEngine {
  private program: ts.BuilderProgram | undefined

  check(files: string[]) {
    if (!this.program) {
      // Create once with all project files
      this.program = ts.createIncrementalProgram({
        rootNames: parsedConfig.fileNames,
        options,
        host
      })
    }
    // Check only specific files
    return this.getDiagnostics(files)
  }
}
```

2. **Enable incremental compilation**:
```json
// tsconfig.json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

### 5. File Processing Memory Issues

**Symptoms**:
- OOM when processing large files
- Cannot handle many files at once
- Memory spikes during file operations

**Causes**:
- Loading entire files into memory
- Processing all files simultaneously
- Not releasing file buffers

**Solutions**:

1. **Stream large files**:
```typescript
const reader = new StreamingFileReader({
  chunkSize: 64 * 1024 // 64KB chunks
})

await reader.readInChunks(filepath, async (chunk) => {
  await processChunk(chunk)
})
```

2. **Batch file processing**:
```typescript
const processor = new FileBatchProcessor({
  batchSize: 100,
  enableBackpressure: true
})

await processor.processBatches(files, async (batch) => {
  for (const file of batch) {
    await processFile(file)
  }
})
```

### 6. CI/CD Memory Failures

**Symptoms**:
- Tests pass locally but fail in CI
- Random test failures
- "Kill signal" or timeout errors

**Causes**:
- CI containers have less memory
- No heap size configuration
- Memory leaks more impactful

**Solutions**:

1. **Configure CI memory**:
```yaml
# GitHub Actions
- name: Run Tests
  env:
    NODE_OPTIONS: '--max-old-space-size=4096'
  run: npm test

# GitLab CI
test:
  script:
    - export NODE_OPTIONS='--max-old-space-size=4096'
    - npm test
```

2. **Add memory reporting**:
```typescript
afterAll(async () => {
  if (process.env.CI) {
    const report = globalMemoryMonitor.generateTrendReport()
    console.log('Memory Report:', report)
    await globalMemoryMonitor.exportTrendReport('./memory-report.json')
  }
})
```

## Diagnostic Commands

### Check Current Memory Usage

```bash
# Node.js REPL
> process.memoryUsage()
{
  rss: 35880960,        # Resident Set Size
  heapTotal: 7376896,   # Total heap size
  heapUsed: 5275096,    # Used heap size
  external: 8772,       # C++ objects
  arrayBuffers: 9386    # ArrayBuffers
}
```

### Monitor Memory in Real-time

```bash
# Using built-in Node.js inspector
node --inspect --max-old-space-size=4096 script.js

# Then open chrome://inspect in Chrome
```

### Generate Heap Snapshot

```javascript
// Programmatically
const v8 = require('v8')
const fs = require('fs')

const snapshot = v8.writeHeapSnapshot()
const fileName = `heap-${Date.now()}.heapsnapshot`
fs.writeFileSync(fileName, snapshot)
```

### Force Garbage Collection

```bash
# Run with --expose-gc flag
node --expose-gc script.js
```

```javascript
// In code
if (global.gc) {
  global.gc()
  console.log('Garbage collection triggered')
}
```

## Memory Profiling Tools

### 1. Chrome DevTools
```bash
node --inspect app.js
# Open chrome://inspect
# Take heap snapshots and compare
```

### 2. Clinic.js
```bash
npm install -g clinic
clinic doctor -- node app.js
clinic heap -- node app.js
```

### 3. Heapdump
```javascript
const heapdump = require('heapdump')
heapdump.writeSnapshot((err, filename) => {
  console.log('Heap snapshot:', filename)
})
```

## Environment Variables Reference

```bash
# Memory Limits
NODE_OPTIONS='--max-old-space-size=4096'  # Heap size in MB
TEST_MEMORY_LIMIT_MB=500                  # Per-test limit

# Memory Monitoring
MEMORY_DEBUG=true                         # Enable debug output
MEMORY_TREND_REPORT=true                  # Generate trend reports
MEMORY_REPORT_PATH=./memory-report.json   # Report output path

# Failure Modes
FAIL_ON_MEMORY_LIMIT=true                 # Fail test on limit
FAIL_ON_MEMORY_LEAK=true                  # Fail on leak detection

# TypeScript Cache
QC_TS_CACHE_DIR=/tmp/ts-cache            # TypeScript cache location
```

## Quick Fixes Checklist

- [ ] Increase heap size with NODE_OPTIONS
- [ ] Add disposal methods to resource-heavy classes
- [ ] Implement cleanup in afterEach hooks
- [ ] Use streaming for files >10MB
- [ ] Enable incremental TypeScript compilation
- [ ] Add memory monitoring to tests
- [ ] Set per-test memory limits
- [ ] Use batch processing for bulk operations
- [ ] Pool frequently allocated buffers
- [ ] Clear caches periodically

## When to Escalate

Contact senior engineers if:
- Memory leaks persist after applying fixes
- OOM errors with heap size >8GB
- Memory usage pattern is unexplainable
- Performance degradation over time
- Production memory incidents

## Additional Resources

- [Node.js Memory Management](https://nodejs.org/en/docs/guides/diagnostics/memory)
- [V8 Memory Profiling](https://v8.dev/docs/memory)
- [Chrome DevTools Memory Profiling](https://developer.chrome.com/docs/devtools/memory-problems)
- [Memory Optimization Patterns](./.agent-os/standards/memory-optimization-patterns.md)