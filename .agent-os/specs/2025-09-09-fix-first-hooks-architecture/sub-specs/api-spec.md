# API Specification

This is the API specification for the spec detailed in
@.agent-os/specs/2025-09-09-fix-first-hooks-architecture/spec.md

> Created: 2025-09-09 Version: 1.0.0

## Interface Changes

### QualityChecker API

#### Current Interface

```typescript
class QualityChecker {
  async execute(files: string[]): Promise<QualityResult[]>
}
```

#### New Fix-First Interface

```typescript
class QualityChecker {
  async execute(
    files: string[],
    options?: QualityOptions,
  ): Promise<QualityResult[]>
}

interface QualityOptions {
  fixFirst?: boolean // Default: true
  autoStage?: boolean // Default: true
  reportFixed?: boolean // Default: false
}
```

### Engine API Updates

#### ESLintEngine Interface

```typescript
// Current
async check(files: string[]): Promise<ESLintResult[]>

// New (backward compatible)
async check(files: string[], options?: EngineOptions): Promise<ESLintResult[]>

interface EngineOptions {
  fix?: boolean; // Default: false (for backward compatibility)
  reportFixedIssues?: boolean; // Default: false
}
```

#### PrettierEngine Interface

```typescript
// Current
async check(files: string[]): Promise<PrettierResult[]>

// New (backward compatible)
async check(files: string[], options?: EngineOptions): Promise<PrettierResult[]>
```

### Result Format Enhancements

#### QualityResult Interface

```typescript
interface QualityResult {
  file: string
  issues: Issue[]
  fixed: boolean // NEW: Indicates if file was auto-fixed
  fixedIssues?: Issue[] // NEW: Issues that were automatically fixed
}

interface Issue {
  // ... existing fields
  autoFixable?: boolean // NEW: Indicates if issue can be auto-fixed
  wasFixed?: boolean // NEW: Indicates if this issue was fixed
}
```

## Hook Integration API

### Git Hook Entry Point

```typescript
// packages/quality-check/src/facades/git-hook.ts

// Current
export async function runQualityCheck(files: string[]): Promise<void>

// Enhanced (backward compatible)
export async function runQualityCheck(
  files: string[],
  options?: HookOptions,
): Promise<QualityHookResult>

interface HookOptions {
  mode?: 'check-then-fix' | 'fix-first' // Default: 'fix-first'
  autoStage?: boolean // Default: true
  verbose?: boolean // Default: false
}

interface QualityHookResult {
  success: boolean
  fixedFiles: string[]
  unfixableIssues: Issue[]
  executionTime: number
}
```

### Auto-staging Integration

```typescript
// New utility for git operations
export class GitStager {
  async stageFiles(files: string[]): Promise<string[]>
  async getModifiedFiles(files: string[]): Promise<string[]>
  async isFileStaged(file: string): Promise<boolean>
}
```

## Backward Compatibility Layer

### Legacy Support

```typescript
// Support for existing hook implementations
export class LegacyHookAdapter {
  // Wraps new fix-first behavior in old interface
  static async runLegacyHook(files: string[]): Promise<void> {
    const result = await runQualityCheck(files, {
      mode: 'check-then-fix',
      autoStage: false,
    })

    if (!result.success) {
      throw new Error('Quality check failed')
    }
  }
}
```

### Migration Support

```typescript
// Feature flag for gradual rollout
export interface MigrationOptions {
  enableFixFirst?: boolean // Default: true
  fallbackOnError?: boolean // Default: true
  logPerformanceMetrics?: boolean // Default: false
}
```

## Error Handling Patterns

### Fix-First Error Recovery

```typescript
interface FixFirstError extends Error {
  type: 'FIX_FAILED' | 'STAGE_FAILED' | 'CHECK_FAILED'
  file?: string
  originalError?: Error
  recoverable: boolean
}

// Graceful degradation strategy
class FixFirstErrorHandler {
  async handleFixError(
    error: FixFirstError,
    files: string[],
  ): Promise<QualityResult[]> {
    if (error.recoverable) {
      // Fallback to check-then-fix mode
      return this.runLegacyMode(files)
    }
    throw error
  }
}
```

## Performance Monitoring API

### Metrics Collection

```typescript
interface PerformanceMetrics {
  executionTime: number
  filesProcessed: number
  filesFixed: number
  toolExecutions: number // Should be ~50% of old system
  memoryUsage: number
}

export class PerformanceTracker {
  startTimer(): void
  recordFileProcessed(file: string): void
  recordFileFixed(file: string): void
  recordToolExecution(tool: string): void
  getMetrics(): PerformanceMetrics
}
```
