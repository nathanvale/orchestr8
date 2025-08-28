# Technical Specification

Specification for:
`@.agent-os/specs/2025-08-28-monorepo-package-structure/spec.md`

Created: 2025-08-28  
Version: 1.1.0 (2025 Pivot Applied)

## 1. Technical Requirements

### 1.1 Package Structure

Four logical package types (three guaranteed + one optional):

1. `packages/core` – Template / domain specific functions
2. `packages/utils` – Pure utilities (no external deps)
3. `apps/testing` – Private test utilities (dev-only)
4. `apps/server` – Optional example application (`--with-server` flag)

### 1.2 TypeScript Project References (Hybrid 2025 Strategy)

Adopt **hybrid** references to keep velocity high:

- Publishable library packages (`core`, `utils`) -> `composite: true` + in root
  references file
- Private/internal app packages (e.g. `apps/testing`, optional `apps/server`) ->
  may omit `composite` & references (compile via consumer) unless they become
  transitive build inputs
- Root will eventually expose minimal references file (`files: []`,
  `references: [...]`) named `tsconfig.references.json` (or reuse
  `tsconfig.json` after promotion) – deferred until packages exist
- Rationale: Minimizes `.tsbuildinfo` churn & IDE overhead while preserving
  incremental builds where it matters (published surface area & API boundaries)

### 1.3 Turborepo Tasks Integration (v2.4 / v2.5 Pivot)

Replace deprecated `pipeline` with `tasks` and selectively adopt new features:

- Deterministic `tasks` graph with `dependsOn` (using `^` for upstream)
- Explicit `outputs` for all cacheable tasks (`dist/**`, `coverage/**`,
  `.eslintcache`)
- `$TURBO_ROOT$` used inside `inputs` for cross-root config stability (prevents
  accidental misses on folder moves)
- Remote caching: **recommended** (Vercel remote cache is free) but not required
  (tests treat remote as optional capability)
- Sidecar tasks via `with`: **deferred** until multi-service emerges
  (placeholder comment kept)
- Boundaries (`turbo boundaries`): run in warning mode initially; escalate to
  error after migration stabilizes
- Watch mode write-cache (`turbo watch dev --experimental-write-cache`):
  documented opt-in, not required
- `--continue=dependencies-successful` to be adopted in CI once multi-package
  filtering active
- `turbo prune` (Bun lockfile now supported) documented for CI/CD packaging, not
  mandatory for template baseline

### 1.4 Build System

Option A (Pure `tsc --build`) chosen:

- Single tool -> minimal cognitive load
- Accurate source maps
- Works seamlessly with project references & incremental builds
- Hybrid: publishable libs output `dist/`; internal apps can stay source-first

### 1.5 Import Migration

Promotion script performs safe AST (ts-morph) transformations:

- Strip extensions & `/index` suffix
- Map relative local paths to package subpath exports
- Enforce no cross-boundary relative traversals (`../../` across package root)
- All internal deps use `workspace:*` protocol post-move

## 2. Approach Evaluation

| Option | Summary               | Pros                          | Cons                         | Status               |
| ------ | --------------------- | ----------------------------- | ---------------------------- | -------------------- |
| A      | Pure `tsc --build`    | Simple, incremental, low risk | Larger output vs bundling    | SELECTED             |
| B      | `tsc` + Bun bundling  | Smaller bundles               | Dual pipeline complexity     | Rejected (premature) |
| C      | ESBuild + `tsc` types | Fast, smaller JS              | Config surface, feature gaps | Rejected             |

## 3. 2025 Pivot Additions (Delta)

| Area              | Pivot Enhancement                    | Adoption Mode                  |
| ----------------- | ------------------------------------ | ------------------------------ |
| Tasks API         | `pipeline` -> `tasks`                | Immediate                      |
| Inputs            | Use `$TURBO_ROOT$` for shared config | Immediate                      |
| Boundaries        | Graph validation (warn)              | Phase 1 warn / Phase 2 enforce |
| Sidecars          | `with` for coupled dev processes     | Deferred                       |
| Remote Cache      | Encourage + doc fallback behavior    | Optional (recommended)         |
| Prune             | Document lean deploy (`turbo prune`) | Optional                       |
| Watch Write Cache | Faster hot loops                     | Optional opt‑in                |
| Hybrid TS Refs    | Only publishable libs composite      | Immediate                      |

## 4. Reference Configuration (Authoritative Examples)

### 4.1 `turbo.jsonc` (will replace `turbo.json` at promotion)

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "cache": true,
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "cache": true,
      "env": ["NODE_ENV"],
    },
    "test:dist": {
      "dependsOn": ["build"],
      "cache": true,
    },
    "lint": {
      "outputs": [".eslintcache"],
      "cache": true,
      "inputs": ["**/*.{ts,tsx,js,jsx}", "$TURBO_ROOT$/eslint.config.js"],
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "cache": true,
      "inputs": [
        "**/*.{ts,tsx}",
        "$TURBO_ROOT$/tsconfig.json",
        "$TURBO_ROOT$/tooling/tsconfig/*.json",
      ],
    },
    "clean": { "cache": false },
    "dev": {
      "cache": false,
      "persistent": true,
      /* "with": ["server#dev"] (add once server sidecar exists) */
    },
  },
  "globalEnv": ["CI"],
  "globalDependencies": [
    "tsconfig.json",
    "tooling/tsconfig/base.json",
    "tooling/tsconfig/library.json",
    ".changeset/config.json",
    "eslint.config.js",
    "vitest.config.ts",
    "turbo.json", // renamed to turbo.jsonc at cut‑over
  ],
}
```

### 4.2 Root TypeScript References (Deferred Shape)

```json
{
  "files": [],
  "references": [{ "path": "./packages/core" }, { "path": "./packages/utils" }]
}
```

Internal apps added only if they create dependency ordering / tooling benefits.

### 4.3 Library Package `tsconfig.json`

```json
{
  "extends": "../../tooling/tsconfig/base.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "tsBuildInfoFile": "./.tsbuildinfo"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.*", "**/*.spec.*"],
  "references": []
}
```

### 4.4 Import Migration Mapping (Excerpt)

```typescript
const migrations: Record<string, string> = {
  './number-utils': '@bun-template/utils/number',
  '../src/number-utils': '@bun-template/utils/number',
  './path-utils': '@bun-template/utils/path',
  '../src/path-utils': '@bun-template/utils/path',
  './test-utils': '@bun-template/testing',
  '../test-utils': '@bun-template/testing',
  '../../test-utils': '@bun-template/testing',
  './index': '@bun-template/core',
  '../src/index': '@bun-template/core',
}
```

## 5. Validation Matrix (Updated 2025)

| Category           | Requirement                                  | Evidence / Tool                 |
| ------------------ | -------------------------------------------- | ------------------------------- |
| Build              | `turbo run build` succeeds                   | CI logs                         |
| Cache              | >90% warm hit rate                           | `--dry-run=json` task stats     |
| Boundaries         | No cross-package relative imports            | `turbo boundaries` (warn→error) |
| Types              | Declarations for publishable libs            | `dist/*.d.ts` present           |
| Imports            | Only package or relative inside same package | grep + AST check                |
| Changesets         | Exactly 2 publishable packages detected      | `changeset status`              |
| Hybrid Refs        | Only libs in root references file            | root `tsconfig*.json`           |
| Remote Cache (opt) | If enabled, non-zero remote hits             | turbo task JSON                 |
| Watch Cache (opt)  | Documented usage, not required               | docs reference                  |

## 6. Phase Plan

### Phase 1 (Completed)

- Tasks migration (`pipeline` → `tasks`)
- Base & library tsconfig scaffolding
- Enhanced globalDependencies list
- Documentation pivot + validation strengthening
- Hybrid references decision recorded

### Phase 2 (Promotion Script – Deferred)

- Materialize package directories & move sources
- Generate package manifests (`core`, `utils`, `testing`, optional `server`)
- Convert root tsconfig to minimalist references file
- Update root scripts to `turbo run` variants with
  `--continue=dependencies-successful` in CI
- Apply Changesets fixed/ignore arrays
- Optional enable boundaries error mode after green baseline

## 7. Risks & Mitigations

| Risk                                      | Impact                         | Mitigation                          |
| ----------------------------------------- | ------------------------------ | ----------------------------------- |
| Over‑eager references on private apps     | Slow IDE, unnecessary rebuilds | Hybrid strategy (skip until needed) |
| Cache flakiness due to moved config files | False misses                   | Use `$TURBO_ROOT$` + narrow inputs  |
| Sidecar premature adoption                | Dev complexity                 | Defer until multi-service need      |
| Boundaries false positives early          | Developer friction             | Start warn-only phase               |

## 8. Future Enhancements

- Integrate `turbo prune` into release build path (artifact slimming)
- Automate boundaries diff snapshot to detect new cross edges
- Add performance budget assertions (hyperfine JSON benchmarks) in CI
- Optional Bun test micro-suites for ultra-fast pure util assertions

## 9. Summary

This specification encodes the monorepo architecture plus 2025 Turborepo pivot
decisions (tasks API, hybrid TS references, boundaries, `$TURBO_ROOT$`, optional
remote & watch caching). Deferred actions are isolated to the promotion script
to avoid breakage in the pre-migration state while giving a clear, incremental
path to full adoption.
