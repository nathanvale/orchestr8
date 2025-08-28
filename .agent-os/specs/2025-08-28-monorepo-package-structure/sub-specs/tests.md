# Tests Specification

Spec reference:
`@.agent-os/specs/2025-08-28-monorepo-package-structure/spec.md`  
Created: 2025-08-28  
Version: 1.1.0 (2025 Pivot Applied)

## 1. Scope

Defines validation for hybrid TypeScript references, Turborepo `tasks` API,
boundaries, and promotion migration safety.

## 2. Unit Tests

### 2.1 Package Structure

- `core` contains template logic only
- `utils` contains only pure stateless utilities (no external deps)
- `apps/testing` contains test helpers only
- No circular dependencies (graph / madge snapshot)

### 2.2 TypeScript Config

- All library tsconfigs extend `tooling/tsconfig/base.json`
- Publishable libs have `composite: true` & build to `dist/`
- Root references file lists only publishable libs (hybrid)
- Declarations emitted for publishable libs

### 2.3 Build System

- `turbo run build` produces `dist/**` for libs only
- Subsequent build is cache HIT for unchanged tasks
- `.tsbuildinfo` generated only for composite packages

### 2.4 Import Migration Utilities

- Path normalization strips extensions & `/index`
- Relative -> package subpath mapping works for number/path/string utils
- External imports remain unchanged

## 3. Integration Tests

### 3.1 Turborepo Tasks Graph

- Order: typecheck → build → test enforced
- Warm run >90% HIT rate for build tasks
- `--dry-run=json` edges accurate for library dependency chain
- Lint MISS only when `eslint.config.js` changes (scoped invalidation)
- Typecheck MISS when base tsconfig changes

### 3.2 Boundaries & Imports

- No cross-package relative traversals (grep negative)
- `workspace:` protocol used for internal versions
- (Optional) `turbo boundaries --format=json` returns zero errors (warnings
  allowed initial)

### 3.3 Changesets

- `changeset status` lists only publishable packages
- Fixed group includes `core` + `utils`
- Private packages in `ignore`

### 3.4 Dist Integrity

- `test:dist` executes tests against built artifacts with identical pass count
- Exported d.ts surfaces match runtime JS (spot check subset)

### 3.5 Remote Cache (Optional)

- If `TURBO_TOKEN` present, at least one task shows remote hit OR test skipped
  gracefully

### 3.6 Watch Write Cache (Optional)

- Documentation-only run does not error
  (`turbo watch dev --experimental-write-cache`)

## 4. Performance Tests

### 4.1 Cache Performance

```typescript
describe('Cache Performance', () => {
  it('warm build >90% HIT', async () => {
    await execAsync('turbo run build')
    const result = await execAsync('turbo run build --dry-run=json')
    const tasks = JSON.parse(result.stdout).tasks.filter((t: any) =>
      t.task.includes(':build'),
    )
    const hitRate =
      tasks.filter((t: any) => t.cache.status === 'HIT').length / tasks.length
    expect(hitRate).toBeGreaterThan(0.9)
  })
})
```

### 4.2 Incremental Type Boundary

Touch single util file -> only downstream dependent builds MISS.

## 5. Example Scenarios

### 5.1 Fresh Package Creation

```typescript
describe('Package Skeleton', () => {
  it('scaffolds publishable packages', () => {
    expect(existsSync('packages/core/package.json')).toBe(true)
    expect(existsSync('packages/utils/package.json')).toBe(true)
  })
})
```

### 5.2 Hybrid Build Validation

```typescript
describe('Hybrid Build', () => {
  it('builds only libs', async () => {
    const res = await execAsync('turbo run build')
    expect(res.stdout).toContain('packages/core:build')
    expect(res.stdout).toContain('packages/utils:build')
  })
})
```

### 5.3 Import Migration (AST)

```typescript
describe('Import Migration', () => {
  it('maps relative util path', () => {
    const src = "import { sum } from './number-utils'"
    const out = transformImports(src)
    expect(out).toContain('@bun-template/utils/number')
  })
})
```

### 5.4 Boundaries

```typescript
describe('Boundaries', () => {
  it('no cross boundary relatives', async () => {
    const res = await execAsync(
      'grep -R ' + "'from \'..'" + ' packages/ apps/ || true',
    )
    expect(res.stdout.trim()).toBe('')
  })
})
```

### 5.5 Changesets

```typescript
describe('Changesets', () => {
  it('detects publishable libs only', async () => {
    const res = await execAsync('bunx changeset status')
    expect(res.stdout).toMatch(/@bun-template\/core/)
    expect(res.stdout).toMatch(/@bun-template\/utils/)
  })
})
```

## 6. Coverage Thresholds

| Package      | Lines %         |
| ------------ | --------------- |
| core         | >=90%           |
| utils        | >=85%           |
| apps/testing | >=70% (private) |

Dist tests must not reduce core/utils coverage below thresholds.

## 7. Optional / Non-Gating

1. Remote cache smoke (if env present)
2. Watch write-cache exploratory run
3. Boundaries escalate from warn→error after stable period

## 8. Test Environment

- Clean git working tree
- `bun install` completed
- Executed on macOS & CI Linux (consistency spot check)

## 9. Exit Criteria

All mandatory scenarios pass; optional scenarios documented; cache & coverage
targets met; no boundary violations.

---

This specification validates the 2025 pivot (tasks API, hybrid references,
boundaries, optional remote features) while preserving lean baseline
requirements.
