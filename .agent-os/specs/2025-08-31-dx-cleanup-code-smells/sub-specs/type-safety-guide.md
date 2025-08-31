# Type Safety Guide

> Comprehensive TypeScript type safety improvements with real examples from the
> codebase Version: 1.0.0 Created: 2025-08-31

## Overview

This guide provides detailed patterns and examples for eliminating type safety
issues across the codebase. Every pattern includes actual code from our
repository with before/after examples.

## Files Requiring Type Safety Fixes

### Critical Files with `any` Types

1. `/tests/turborepo-validation.test.ts` - Multiple `any` casts
2. `/packages/utils/src/test-utils.tsx` - Generic test utilities
3. `/scripts/dx-status.ts` - Command execution results
4. `/scripts/security-scan.ts` - JSON parsing and external tool results

## Pattern 1: Eliminating `any` Types

### Example 1: Turborepo Validation Test

**File:** `/tests/turborepo-validation.test.ts`

```typescript
// ❌ BEFORE - Current Code with any
const turboConfig = JSON.parse(turboConfigContent) as any
const scriptName = turboConfig.tasks[taskName] as any

// ✅ AFTER - Type Safe Version
interface TurboConfig {
  $schema: string
  tasks: Record<string, TurboTask>
  globalDependencies?: string[]
  globalEnv?: string[]
}

interface TurboTask {
  dependsOn?: string[]
  inputs?: string[]
  outputs?: string[]
  cache?: boolean
  persistent?: boolean
}

const turboConfig = JSON.parse(turboConfigContent) as TurboConfig
const task = turboConfig.tasks[taskName]
```

### Example 2: Test Utils

**File:** `/packages/utils/src/test-utils.tsx`

```typescript
// ❌ BEFORE - Generic any type
export function renderWithProviders(ui: React.ReactElement, options?: any) {
  const { initialState, ...renderOptions } = options || {}
  // ...
}

// ✅ AFTER - Properly typed
interface RenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: Partial<RootState>
  store?: Store
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions,
): RenderResult & { store: Store } {
  const { initialState, ...renderOptions } = options ?? {}
  // ...
}
```

### Example 3: Script Execution Results

**File:** `/scripts/dx-status.ts`

```typescript
// ❌ BEFORE - Untyped command results
const result = execSync('pnpm outdated --json', { encoding: 'utf-8' })
const outdated = JSON.parse(result) as any

// ✅ AFTER - Typed command results
interface OutdatedPackage {
  current: string
  wanted: string
  latest: string
  dependent: string
  location: string
}

interface PnpmOutdatedResult {
  [packageName: string]: OutdatedPackage
}

const result = execSync('pnpm outdated --json', { encoding: 'utf-8' })
const outdated = JSON.parse(result) as PnpmOutdatedResult
```

## Pattern 2: Adding Explicit Return Types

### Example 1: Async Functions

**File:** `/scripts/security-scan.ts`

```typescript
// ❌ BEFORE - Missing return type
async function runSecurityScan(options) {
  // ... implementation
}

// ✅ AFTER - Explicit return type
interface SecurityScanResult {
  vulnerabilities: Vulnerability[]
  sbomGenerated: boolean
  timestamp: string
  summary: {
    critical: number
    high: number
    moderate: number
    low: number
  }
}

async function runSecurityScan(
  options: ScanOptions,
): Promise<SecurityScanResult> {
  // ... implementation
}
```

### Example 2: React Components

**File:** `/apps/web/app/page.tsx`

```typescript
// ❌ BEFORE - Missing return type
export default function HomePage() {
  return <div>Home</div>
}

// ✅ AFTER - Explicit JSX return type
export default function HomePage(): React.JSX.Element {
  return <div>Home</div>
}
```

### Example 3: Event Handlers

**File:** `/apps/app/src/components/LogDashboard.tsx`

```typescript
// ❌ BEFORE - Inline handler without type
<button onClick={(e) => handleClick(e)}>Click</button>

// ✅ AFTER - Typed event handler
const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
  event.preventDefault()
  // ... handler logic
}

<button onClick={handleClick}>Click</button>
```

## Pattern 3: Strict Boolean Expressions

### Example 1: Nullable Checks

**File:** `/scripts/validate-pre-release.ts`

```typescript
// ❌ BEFORE - Implicit boolean coercion
if (value) { ... }
if (!array.length) { ... }
if (str) { ... }

// ✅ AFTER - Explicit null and empty checks
if (value != null && value !== '') { ... }
if (array.length === 0) { ... }
if (str != null && str.length > 0) { ... }
```

### Example 2: Array Length Checks

**File:** `/scripts/coverage-gate.ts`

```typescript
// ❌ BEFORE - Truthy check on length
if (failures.length) {
  console.error('Coverage failures detected')
}

// ✅ AFTER - Explicit comparison
if (failures.length > 0) {
  console.error('Coverage failures detected')
}
```

## Pattern 4: Type Guards and Narrowing

### Example 1: Error Type Guards

**File:** `/scripts/lib/error-utils.ts` (to be created)

```typescript
// Create reusable type guards
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

export function isAxiosError(error: unknown): error is AxiosError {
  return error instanceof Error && 'isAxiosError' in error
}

// Usage in scripts
try {
  // ... operation
} catch (error) {
  if (isNodeError(error) && error.code === 'ENOENT') {
    console.error('File not found:', error.path)
  } else if (isAxiosError(error)) {
    console.error('Network error:', error.response?.status)
  } else if (error instanceof Error) {
    console.error('Unknown error:', error.message)
  } else {
    console.error('Unexpected error type:', error)
  }
}
```

### Example 2: API Response Guards

**File:** `/apps/app/src/services/api.ts`

```typescript
// ❌ BEFORE - Type assertion
const data = response.json() as LogEntry[]

// ✅ AFTER - Type guard validation
interface LogEntry {
  id: string
  message: string
  level: 'info' | 'warn' | 'error'
  timestamp: string
}

function isLogEntry(value: unknown): value is LogEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'message' in value &&
    'level' in value &&
    ['info', 'warn', 'error'].includes((value as LogEntry).level)
  )
}

function isLogEntryArray(value: unknown): value is LogEntry[] {
  return Array.isArray(value) && value.every(isLogEntry)
}

// Usage
const data = await response.json()
if (!isLogEntryArray(data)) {
  throw new TypeError('Invalid API response format')
}
// data is now typed as LogEntry[]
```

## Pattern 5: Discriminated Unions

### Example 1: Result Types

**File:** `/scripts/lib/result.ts` (to be created)

```typescript
// Instead of boolean flags, use discriminated unions
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

// Usage example
function parseConfig(content: string): Result<Config, ConfigError> {
  try {
    const config = JSON.parse(content) as Config
    return { success: true, data: config }
  } catch (error) {
    return {
      success: false,
      error: new ConfigError('Failed to parse config', { cause: error }),
    }
  }
}

// Type-safe consumption
const result = parseConfig(configContent)
if (result.success) {
  // result.data is available and typed
  console.log('Config loaded:', result.data.version)
} else {
  // result.error is available and typed
  console.error('Config error:', result.error.message)
}
```

## Pattern 6: Generic Type Improvements

### Example 1: Meaningful Generic Names

**File:** `/packages/utils/src/array-utils.ts`

```typescript
// ❌ BEFORE - Single letter generics
function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  // ...
}

// ✅ AFTER - Descriptive generic names
function groupBy<ItemType, KeyType>(
  items: ItemType[],
  keySelector: (item: ItemType) => KeyType,
): Map<KeyType, ItemType[]> {
  const groups = new Map<KeyType, ItemType[]>()
  for (const item of items) {
    const key = keySelector(item)
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }
  return groups
}
```

## Pattern 7: Promise and Async Types

### Example 1: Floating Promises

**File:** `/apps/app/src/main.tsx`

```typescript
// ❌ BEFORE - Floating promise
prepare()
setInterval(fetchData, 5000)

// ✅ AFTER - Handled promises
// Top-level await
await prepare()

// Wrapped in void for fire-and-forget
setInterval(() => {
  void fetchData()
}, 5000)
```

### Example 2: Promise Return Types

**File:** `/scripts/lib/async-utils.ts`

```typescript
// ❌ BEFORE - Implicit return type
async function retry(fn, attempts = 3) {
  // ...
}

// ✅ AFTER - Explicit Promise type
async function retry<T>(
  fn: () => Promise<T>,
  attempts: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error | undefined

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (i < attempts - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, i)),
        )
      }
    }
  }

  throw lastError ?? new Error('Retry failed')
}
```

## Implementation Checklist

### Phase 1: Critical Type Fixes

- [ ] Replace `any` in test files
- [ ] Add return types to all exported functions
- [ ] Fix strict boolean expressions

### Phase 2: Type Infrastructure

- [ ] Create type guard utilities
- [ ] Implement Result type pattern
- [ ] Add API response validators

### Phase 3: Advanced Patterns

- [ ] Convert to discriminated unions
- [ ] Improve generic type names
- [ ] Add exhaustive type checking

## Validation Commands

```bash
# Check for any types
pnpm exec tsc --noEmit --strict

# Run ESLint type checks
pnpm lint:types

# Generate type coverage report
pnpm type-coverage

# Check for implicit any
grep -r "as any" --include="*.ts" --include="*.tsx" .
```

## Common Pitfalls to Avoid

1. **Don't use `as` for type assertions** - Use type guards instead
2. **Don't ignore TypeScript errors** - Fix them properly
3. **Don't use `@ts-ignore`** - Find the root cause
4. **Don't overuse union types** - Consider discriminated unions
5. **Don't forget null checks** - TypeScript strict null checks help

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Type Guards Documentation](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
- [Strict Mode Benefits](https://www.typescriptlang.org/tsconfig#strict)
