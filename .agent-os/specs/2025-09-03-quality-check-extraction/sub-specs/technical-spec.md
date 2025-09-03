# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-03-quality-check-extraction/spec.md

> Created: 2025-09-03 Version: 1.0.0

## Technical Requirements

### Performance Targets

- **Execution Time**: <2s for single file validation (complete ESLint +
  Prettier + TypeScript check)
- **Memory Usage**: <100MB peak memory consumption during validation
- **Cache Hit Rate**: >85% for TypeScript compilation cache in repeated
  validations
- **Thread Utilization**: Leverage multithread ESLint for 30-60% performance
  improvement

### Core Architecture Components

#### 1. Quality Checkers (Simplified from claude-hooks)

- **ESLint Checker**: Extract from
  `packages/claude-hooks/src/quality-check/checkers/eslint.ts`, remove AI
  sub-agent orchestration
- **Prettier Checker**: Extract from
  `packages/claude-hooks/src/quality-check/checkers/prettier.ts`, implement
  advanced caching
- **TypeScript Checker**: Extract from
  `packages/claude-hooks/src/quality-check/checkers/typescript.ts`, add compile
  cache support
- **Common Issues Checker**: Extract from
  `packages/claude-hooks/src/quality-check/checkers/common-issues.ts`, keep core
  patterns only

#### 2. Logging Infrastructure (@orchestr8/logger Integration)

- **Correlation ID Generation**: Follow Voice Vault pattern
  (`qc-${random}-${timestamp}`)
- **Structured Logging**: JSON format with performance metrics, error
  classification, fix statistics
- **Log Levels**: Support DEBUG, INFO, WARN, ERROR with environment variable
  control
- **Performance Tracking**: Log execution time, cache hit rates, memory usage
  per validation run

#### 3. File Processing Pipeline

- **Input Validation**: Verify file existence, readable permissions, supported
  file types
- **Parallel Processing**: Run ESLint, Prettier, TypeScript checks concurrently
  where possible
- **Auto-fix Orchestration**: Apply fixes in optimal order (Prettier → ESLint →
  TypeScript validation)
- **Error Aggregation**: Collect and deduplicate errors across all checkers

## Approach Options

### Option A: Sequential Processing (Safer)

- Run ESLint → Prettier → TypeScript in sequence
- Pros: Predictable behavior, easier debugging, no race conditions
- Cons: Slower execution (2.5-3s typical), doesn't leverage full performance
  potential

### Option B: Parallel Processing with Synchronization (Selected)

- Run ESLint and TypeScript checks in parallel, Prettier formatting separately
- Synchronize results before auto-fix application
- Pros: Faster execution (<2s target achievable), maximum performance
  utilization
- Cons: More complex coordination logic, potential for edge case conflicts

**Rationale**: Option B aligns with <2s performance target and ADHD workflow
optimization goals. The complexity trade-off is justified by the significant
performance improvement for the primary use case.

### Option C: Full Parallel with Conflict Resolution

- Run all checkers simultaneously with post-processing conflict resolution
- Pros: Maximum theoretical performance
- Cons: Complex conflict resolution logic, unpredictable behavior, higher risk

## 2025 Performance Optimizations

### ESLint v9.34+ Multithread Linting

```typescript
// Implementation approach
const eslintConfig = {
  useEslintrc: false,
  baseConfig: {
    // Optimized for single-file checking
    parserOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
    },
  },
  // Enable multithread processing
  cache: true,
  cacheStrategy: 'content',
  threads: Math.min(4, os.cpus().length), // Optimal thread count
}
```

### TypeScript 5.7+ Compile Cache

```typescript
// Leverage Node.js 22 compile cache
process.env.NODE_COMPILE_CACHE = path.join(
  os.tmpdir(),
  'quality-check-ts-cache',
)

const tsProgram = ts.createProgram({
  rootNames: [filePath],
  options: {
    // Optimized compiler options for single file checking
    skipLibCheck: true,
    noEmit: true,
    incremental: true,
    tsBuildInfoFile: path.join(cacheDir, 'tsbuildinfo'),
  },
})
```

### Prettier Advanced Caching

```typescript
// Implement content-based caching
const contentHash = crypto
  .createHash('sha256')
  .update(fileContent)
  .digest('hex')
const cacheKey = `${filePath}:${contentHash}:${prettierConfigHash}`

// Check cache before formatting
if (cache.has(cacheKey)) {
  return cache.get(cacheKey)
}
```

## Atomic File Operations

### Safe File Modification Implementation

```typescript
import writeFileAtomic from 'write-file-atomic'
import * as lockfile from 'proper-lockfile'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'

export class SafeFileOperations {
  private readonly backupDir: string

  constructor(projectRoot: string) {
    this.backupDir = path.join(
      projectRoot,
      '.cache',
      'quality-check',
      'backups',
    )
  }

  async safeAutoFix(filepath: string, content: string): Promise<void> {
    const backupPath = await this.createBackup(filepath)

    try {
      // Acquire exclusive lock
      const release = await lockfile.lock(filepath, {
        stale: 10000,
        retries: {
          retries: 3,
          minTimeout: 100,
          maxTimeout: 1000,
        },
      })

      try {
        // Atomic write with fsync
        await writeFileAtomic(filepath, content, {
          fsync: true,
          mode: await this.getFileMode(filepath),
        })

        // Verify write succeeded
        const written = await fs.readFile(filepath, 'utf-8')
        if (written !== content) {
          throw new Error('Write verification failed')
        }

        // Clean up backup on success
        await fs.unlink(backupPath)
      } finally {
        await release()
      }
    } catch (error) {
      // Restore from backup on failure
      await this.restoreBackup(filepath, backupPath)
      throw error
    }
  }

  private async createBackup(filepath: string): Promise<string> {
    await fs.mkdir(this.backupDir, { recursive: true })
    const hash = crypto.createHash('md5').update(filepath).digest('hex')
    const backupPath = path.join(this.backupDir, `${hash}-${Date.now()}.backup`)
    await fs.copyFile(filepath, backupPath)
    return backupPath
  }

  private async restoreBackup(
    filepath: string,
    backupPath: string,
  ): Promise<void> {
    await fs.copyFile(backupPath, filepath)
    await fs.unlink(backupPath)
  }

  private async getFileMode(filepath: string): Promise<number> {
    const stats = await fs.stat(filepath)
    return stats.mode
  }
}
```

### Concurrent Access Protection

```typescript
export class FileLockManager {
  private readonly locks = new Map<string, Promise<void>>()

  async withLock<T>(filepath: string, operation: () => Promise<T>): Promise<T> {
    // Wait for any existing operations on this file
    const existingLock = this.locks.get(filepath)
    if (existingLock) {
      await existingLock
    }

    // Create new lock promise
    let resolve: () => void
    const lockPromise = new Promise<void>((r) => {
      resolve = r
    })
    this.locks.set(filepath, lockPromise)

    try {
      return await operation()
    } finally {
      this.locks.delete(filepath)
      resolve!()
    }
  }
}
```

## Main Entry Point (No-Bin Architecture)

```typescript
#!/usr/bin/env node

import { hookMode } from './modes/hook-mode.js'
import { fileMode } from './modes/file-mode.js'
import { ProcessLifecycle } from './core/process-lifecycle.js'
import { createLogger } from './logging/logger.js'

// Auto-detect if running as CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  })
}

async function main() {
  const lifecycle = new ProcessLifecycle()
  const logger = createLogger('main')

  // Check Node version
  const nodeVersion = parseInt(process.versions.node.split('.')[0], 10)
  if (nodeVersion < 18) {
    console.error('❌ Node.js 18+ required')
    process.exit(1)
  }

  // Parse arguments
  const args = process.argv.slice(2)
  const options = parseArgs(args)

  // Default to hook mode when called via npx from Claude Code
  if (process.stdin.isTTY === false || options.hook) {
    // Hook mode - reading from stdin
    await hookMode(options)
  } else if (options.file) {
    // Direct file mode
    await fileMode(options.file, options)
  } else if (options.help) {
    showHelp()
  } else {
    // Default to hook mode if no args
    await hookMode(options)
  }
}

// Export for programmatic use
export { QualityChecker } from './core/quality-checker.js'
export { SafeFileOperations } from './core/safe-file-operations.js'
export { GitIntegration } from './git/git-integration.js'
export type * from './core/types.js'
```

## External Dependencies

### Core Dependencies

- **@orchestr8/logger** - Structured logging with correlation IDs (following
  Voice Vault patterns)
  - Justification: Consistent logging across template ecosystem, proven
    correlation ID implementation
- **eslint ^9.34.0** - JavaScript/TypeScript linting with multithread support
  - Justification: Latest performance optimizations, multithread linting
    capability
- **prettier ^3.0.0** - Code formatting with advanced caching
  - Justification: Industry standard formatting, extensive caching capabilities
- **typescript ^5.7.0** - Type checking with compile cache support
  - Justification: Node.js 22 compile cache integration, significant performance
    improvements
- **write-file-atomic ^5.0.0** - Atomic file writes with fsync
  - Justification: Prevents file corruption during writes, ensures data
    integrity
- **proper-lockfile ^4.1.0** - Cross-platform file locking
  - Justification: Prevents concurrent file modifications, ensures safe
    operations
- **simple-git ^3.20.0** - Git integration for file awareness
  - Justification: Respects gitignore, enables pre-commit mode
- **ignore ^5.3.0** - Gitignore pattern matching
  - Justification: Efficient pattern matching for ignored files

### Development Dependencies

- **tsup ^8.0.0** - Package build tool (following template standards)
  - Justification: Consistent with template build system, optimal TypeScript
    compilation
- **vitest ^2.0.0** - Testing framework for end-to-end integration tests
  - Justification: Template standard, excellent TypeScript support, fast
    execution

## Package Structure (No-Bin Architecture)

```
@template/quality-check/
├── src/
│   ├── index.ts                      # Main entry point (handles CLI & programmatic)
│   ├── core/
│   │   ├── checkers/
│   │   │   ├── eslint-checker.ts     # Optimized ESLint with multithread
│   │   │   ├── prettier-checker.ts   # Prettier with content caching
│   │   │   ├── typescript-checker.ts # TypeScript with compile cache
│   │   │   └── common-checker.ts     # Common issue detection
│   │   ├── pipeline.ts               # Parallel processing orchestration
│   │   ├── safe-file-operations.ts   # Atomic writes with backup/restore
│   │   ├── path-validator.ts         # Path traversal prevention
│   │   ├── resource-manager.ts       # Memory and timeout management
│   │   ├── process-lifecycle.ts      # Signal handling and cleanup
│   │   └── types.ts                  # Core type definitions
│   ├── modes/
│   │   ├── hook-mode.ts              # Claude Code hook integration
│   │   ├── file-mode.ts              # Direct file checking
│   │   └── pre-commit-mode.ts        # Git pre-commit support
│   ├── security/
│   │   ├── input-sanitizer.ts        # Input validation and sanitization
│   │   ├── secure-environment.ts     # Environment variable security
│   │   └── file-lock-manager.ts      # Concurrent access protection
│   ├── logging/
│   │   ├── correlation.ts            # Correlation ID generation
│   │   ├── logger.ts                 # @orchestr8/logger integration
│   │   ├── debug-logger.ts           # Debug mode with tracing
│   │   └── performance-profiler.ts   # Performance metrics tracking
│   ├── git/
│   │   └── git-integration.ts        # Git-aware file processing
│   └── cache/
│       ├── cache-manager.ts          # Unified cache management
│       └── cache-strategies.ts       # Tool-specific caching
├── tests/
│   ├── integration/
│   │   ├── claude-hooks.test.ts      # End-to-end hook integration
│   │   ├── performance.test.ts       # <2s validation benchmarks
│   │   ├── auto-fix.test.ts          # Atomic file operation tests
│   │   ├── security.test.ts          # Path traversal, injection tests
│   │   ├── concurrency.test.ts       # Parallel processing tests
│   │   └── recovery.test.ts          # Error recovery tests
│   └── fixtures/                     # Test files and mock data
├── package.json                      # NPM configuration (no bin field)
├── tsup.config.ts                    # Simplified build configuration
└── README.md                         # Usage documentation
```

## Build Configuration (Simplified No-Bin)

### tsup Configuration

```typescript
// tsup.config.ts - simplified for single entry point
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'], // Single entry point
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18', // Broader compatibility
  platform: 'node',
  shims: true,
  splitting: false,
  minify: false, // Keep readable for debugging
  // Make the output executable
  esbuildOptions(options) {
    options.banner = {
      js: '#!/usr/bin/env node\n',
    }
  },
})
```

### NPM Package Configuration (No Bin)

```json
{
  "name": "@template/quality-check",
  "version": "2.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  // No bin field - simplified architecture
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

## Environment Variables

### Core Configuration

- `LOG_LEVEL`: Logging verbosity (DEBUG, INFO, WARN, ERROR) - Default: INFO
- `QUALITY_CHECK_LOG_DIR`: Custom log directory - Default:
  os.tmpdir()/quality-check-logs
- `NODE_COMPILE_CACHE`: TypeScript compile cache directory - Default:
  os.tmpdir()/quality-check-ts-cache

### Claude Code Integration

- `CLAUDE_PROJECT_DIR`: Project root directory (provided by Claude Code hooks)
- `QUALITY_CHECK_TIMEOUT`: Maximum execution timeout in milliseconds - Default:
  5000 (5s safety buffer)

### Performance Tuning

- `ESLINT_THREADS`: Number of ESLint threads - Default: Math.min(4,
  os.cpus().length)
- `TYPESCRIPT_CACHE_SIZE`: TypeScript cache size limit in MB - Default: 50
- `PRETTIER_CACHE_SIZE`: Prettier cache size limit in MB - Default: 10
