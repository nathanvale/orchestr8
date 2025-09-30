# README Documentation Drift Report

**Generated:** 2025-10-01
**Analyzer:** code-analyzer agent
**Overall Accuracy:** ~70%

---

## Executive Summary

Found **8 documentation issues** (4 critical, 4 potential) where README.md documents functions or APIs that don't match the actual codebase exports.

**Critical Issues:**
1. Missing core exports from main package (`useFakeTime`, `createRandomSeed`, `generateId`)
2. MSW API mismatch (v1 `rest` vs v2 `http` syntax)
3. SQLite function naming (`seedDatabase` vs actual `seedWithSql`/`seedWithFiles`)
4. Type export path incorrect (`TempDirectory` not in main export)

---

## CRITICAL FINDINGS

### 1. Missing Core Exports from Main Package ⛔
**Lines:** 76-86, 31-41
**Severity:** CRITICAL (won't work)

**Documented (WRONG):**
```typescript
import { useFakeTime, createRandomSeed, generateId } from '@orchestr8/testkit'
```

**Actual Exports:**
- ❌ `useFakeTime` - Does NOT exist
  - Actual: `useFakeTimers` in `/env/fake-time.ts`
- ❌ `createRandomSeed` - Does NOT exist
  - Actual: `createSeedContext` or `SeededRandom` in `/env/seed.ts`
- ❌ `generateId` - Does NOT exist
  - Actual: `DeterministicGenerator.id()` in `/env/generators.ts`

**Impact:** Users will get "export not found" errors

**Recommendation:**
```typescript
// Option 1: Update README to show sub-exports
import { useFakeTimers } from '@orchestr8/testkit/env'
import { createSeedContext } from '@orchestr8/testkit/env'
import { DeterministicGenerator } from '@orchestr8/testkit/env'

// Option 2: Add re-exports to main index.ts (if desired)
export { useFakeTimers, createSeedContext, DeterministicGenerator } from './env/index.js'
```

---

### 2. MSW API Mismatch (v1 vs v2) ⛔
**Lines:** 110-115, 262-277
**Severity:** CRITICAL (won't work)

**Documented (WRONG - MSW v1 syntax):**
```typescript
import { setupMSW, createAuthHandlers, HttpResponse } from '@orchestr8/testkit/msw'

const server = setupMSW([
  ...createAuthHandlers(),
  rest.get('/api/users', () => {  // ❌ rest is not exported
    return HttpResponse.json([...])
  }),
])
```

**Actual (MSW v2 syntax):**
```typescript
import { setupMSW, createAuthHandlers, HttpResponse, http } from '@orchestr8/testkit/msw'

const server = setupMSW([
  ...createAuthHandlers(),
  http.get('/api/users', () => {  // ✅ Use http from MSW v2
    return HttpResponse.json([...])
  }),
])
```

**Impact:** `rest.get` will fail with "rest is not defined"

**Recommendation:**
- Replace all occurrences of `rest.get`, `rest.post` with `http.get`, `http.post`
- Add migration note at top of MSW section

---

### 3. SQLite Function Naming Mismatch ⛔
**Lines:** 122-130, 286-312
**Severity:** CRITICAL (won't work)

**Documented (WRONG):**
```typescript
import { seedDatabase } from '@orchestr8/testkit/sqlite'  // ❌ Does not exist
```

**Actual Exports:**
```typescript
import { seedWithSql, seedWithFiles } from '@orchestr8/testkit/sqlite'  // ✅ Correct

// Usage:
await seedWithSql(db, 'INSERT INTO users (name) VALUES (?)', ['Alice'])
// OR
await seedWithFiles(db, { dir: './seeds' })
```

**Impact:** Function not found error

**Recommendation:** Update all references to use actual function names

---

### 4. TempDirectory Type Export Path ⛔
**Lines:** 467-472
**Severity:** CRITICAL (won't work)

**Documented (WRONG):**
```typescript
import type { TempDirectory } from '@orchestr8/testkit'  // ❌ Not in main export
```

**Actual:**
```typescript
import type { TempDirectory } from '@orchestr8/testkit/fs'  // ✅ Correct path
```

**Impact:** Type import fails

**Recommendation:** Update type import paths or add type re-export to main index

---

## POTENTIAL ISSUES

### 5. Deprecated Function Still Documented ⚠️
**Lines:** 406-412
**Severity:** MINOR (confusing)

**Issue:** Both `useTempDirectory()` and `createManagedTempDirectory()` are documented without clarity on which is preferred

**Recommendation:** Add deprecation notice or clarify usage scenarios

---

### 6. Environment Detection Return Type Incomplete ⚠️
**Lines:** 27-35, 218-230
**Severity:** INFO (documentation gap)

**Documented:**
```typescript
const env = getTestEnvironment()
// Shows: env.isCI, env.isWallaby
```

**Actual Return Type:**
```typescript
{
  isCI: boolean,
  isWallaby: boolean,
  isVitest: boolean,
  isJest: boolean,
  nodeEnv: string,
  // ... more fields
}
```

**Recommendation:** Document all available fields

---

### 7. Transaction Adapter Complexity Not Shown ⚠️
**Lines:** 294-308
**Severity:** MINOR (incomplete example)

**Documented (simplified):**
```typescript
await withTransaction(db, async (tx) => {
  // ...
})
```

**Actual Signature:**
```typescript
withTransaction<Result, DatabaseConnection, TransactionContext>(
  db: DatabaseConnection,
  adapter: TransactionAdapter<DatabaseConnection, TransactionContext>,
  fn: (tx: TransactionContext) => Promise<Result>
)
```

**Impact:** Example won't work without adapter parameter

**Recommendation:** Show complete working example with adapter

---

### 8. Config Path Inconsistency ⚠️
**Lines:** 447-459
**Severity:** INFO (confusing but works)

**Issue:** Both import paths are shown as equivalent:
```typescript
import { createVitestConfig } from '@orchestr8/testkit/config'
import { createVitestConfig } from '@orchestr8/testkit'
```

**Verification:** Both paths DO work (main re-exports config)

**Recommendation:** Clarify that both are valid but sub-export is more explicit

---

## VERIFIED SAFE ✅

**25+ Functions Correctly Documented:**
- `delay()`, `retry()`, `withTimeout()`, `createMockFn()` ✓
- `getTestEnvironment()`, `setupTestEnv()`, `getTestTimeouts()` ✓
- `createTempDirectory()`, `createNamedTempDirectory()`, `createManagedTempDirectory()` ✓
- `setupMSW()`, `createMSWServer()`, `createAuthHandlers()`, `HttpResponse` ✓
- `createMemoryUrl()`, `createFileDatabase()`, `createSQLitePool()`, `withTransaction()` ✓
- `createPostgresContext()`, `createMySQLContext()` ✓
- `createConvexTestHarness()` ✓
- `createVitestConfig()`, `defineVitestConfig()` ✓

**Package.json Dependencies:** All correct ✓

---

## RECOMMENDATIONS

### Priority 1 - Fix Critical Issues (Breaking)

1. **Lines 76-86, 31-41:** Remove or fix references to non-existent functions
   ```diff
   -import { useFakeTime, createRandomSeed, generateId } from '@orchestr8/testkit'
   +import { useFakeTimers, createSeedContext, DeterministicGenerator } from '@orchestr8/testkit/env'
   ```

2. **Lines 110-115, 262-277:** Update MSW examples to v2 syntax
   ```diff
   -  rest.get('/api/users', () => {
   +  http.get('/api/users', () => {
   ```

3. **Lines 122-130:** Fix SQLite seed function name
   ```diff
   -  seedDatabase,
   +  seedWithSql,
   +  seedWithFiles,
   ```

4. **Line 471:** Fix TempDirectory import path
   ```diff
   -import type { TempDirectory } from '@orchestr8/testkit'
   +import type { TempDirectory } from '@orchestr8/testkit/fs'
   ```

### Priority 2 - Improve Accuracy

5. **Lines 294-308:** Show complete `withTransaction` example with adapter
6. **Lines 218-230:** Document all `getTestEnvironment()` return fields
7. Add MSW v2 migration note at top of MSW section

### Priority 3 - Enhance Documentation

8. Add note explaining lean core architecture (main export vs sub-exports)
9. Create MIGRATION.md for users upgrading
10. Add working examples directory with executable code

---

## STATISTICS

| Metric | Count |
|--------|-------|
| **Total Issues** | 8 |
| **Critical Issues** | 4 |
| **Potential Issues** | 4 |
| **Verified Correct** | 25+ |
| **Overall Accuracy** | ~70% |

**Areas with Most Drift:**
1. Main export vs documented exports (missing re-exports)
2. MSW v1 → v2 API changes
3. Function naming mismatches
4. Type export paths

---

## NEXT STEPS

1. Create task list for fixing critical issues
2. Update README.md with corrections
3. Add README validation tests for these specific cases
4. Run `pnpm test readme-validation` to verify fixes
5. Consider adding linting rule to catch these patterns

---

**Report Generated By:** code-analyzer agent
**Evidence Files:**
- `/Users/nathanvale/code/@orchestr8/packages/testkit/src/index.ts` - Main export
- `/Users/nathanvale/code/@orchestr8/packages/testkit/src/*/index.ts` - Sub-exports
- `/Users/nathanvale/code/@orchestr8/packages/testkit/package.json` - Dependencies
