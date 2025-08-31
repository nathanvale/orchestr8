---
title: Prettier 2025 Monorepo Audit & Uplift Plan
status: Draft
owner: Tooling / DX
last_reviewed: 2025-09-01
related:
  - prettier.config.mjs
  - docs/prettier-tailwind-action-plan.md
  - package.json (scripts)
---

> Objective: Ensure formatting pipeline (Prettier 3) is future‑proof,
> deterministic, performant, observable, and governance-friendly across the
> Turborepo.

## 1. Executive Summary

The repository already uses a strong baseline: single ESM config, stable
stylistic rules, import + `package.json` ordering plugins, and pre‑commit
enforcement via lint‑staged. Remaining gaps focus on: plugin safety
(`pluginSearchDirs`), conditional CI performance (changed‑file mode), telemetry,
Tailwind class ordering (when/if Tailwind usage scales), harmonizing
`.editorconfig`, and optional shareable config extraction for multi‑repo reuse.

## 2. Current State Snapshot

| Aspect               | Current                              | Notes                                  |
| -------------------- | ------------------------------------ | -------------------------------------- |
| Config file          | `prettier.config.mjs` (ESM)          | Centralized with rationale comments ✅ |
| Width                | `printWidth: 80` (JSON override 100) | Aligns with internal guidelines ✅     |
| Semicolons           | `semi: false`                        | Consistent diff minimization ✅        |
| Quotes               | `singleQuote: true`                  | Matches style guide ✅                 |
| Trailing commas      | `all`                                | Stable diffs ✅                        |
| Plugins              | organize-imports, packagejson        | Deterministic ordering ✅              |
| Tailwind sorting     | Not yet                              | Planned (see Tailwind action plan)     |
| Plugin safety        | No `pluginSearchDirs`                | Potential accidental plugin pickup ⚠️  |
| `.prettierignore`    | Present                              | Could normalize & annotate             |
| `.editorconfig`      | Global `max_line_length = 100`       | Diverges from Prettier 80 default      |
| CI check             | Full `prettier --check .`            | O(n) scaling for large PRs ⚠️          |
| Changed-files mode   | Absent                               | Opportunity to cut cold PR time        |
| Telemetry            | None                                 | Lacks regression detection             |
| Shareable package    | None                                 | Optional future reuse                  |
| Lint-staged strategy | Multiple granular globs              | Could unify (benchmark first)          |

## 3. Strengths

1. **Single authoritative config** reduces drift.
2. **Deterministic structural ordering** (imports & package.json) already
   enforced.
3. **Pre-commit formatting** lowers CI churn and reduces noisy style PR
   feedback.

4. **Clear stylistic conventions** (80 cols prose, no semicolons) documented
   elsewhere.
5. **Ignore list covers heavy directories** (dist, coverage, caches) aiding
   performance.

## 4. Gaps & Risks (2025 Lens)

| Gap                               | Risk                         | Impact                                  | Priority |
| --------------------------------- | ---------------------------- | --------------------------------------- | -------- |
| Missing `pluginSearchDirs: false` | Phantom plugin load          | Inconsistent formatting across machines | High     |
| Full-repo CI formatting           | Linear scaling               | Longer feedback cycles                  | High     |
| No telemetry                      | Invisible regressions        | Hard to justify perf changes            | High     |
| `.editorconfig` mismatch          | Cognitive friction           | New contributors confused               | Medium   |
| Tailwind ordering absent (future) | Review noise                 | Manual class sorting comments           | Medium   |
| Lint-staged duplication           | Maintenance & small overhead | Minor wasted time                       | Low      |
| Ignore normalization              | Minor redundancy             | Slight config drift                     | Low      |
| No shareable config pkg           | Reuse friction               | Future multi-repo cost                  | Optional |

## 5. Best-Practice Alignment (Context‑7 Ecosystem Trends 2025)

1. **Single root ESM config** (done).
2. **Explicit plugin dirs** for reproducible builds.
3. **Tailwind plugin last** when used, to avoid reordering conflicts.
4. **Changed‑file CI mode + periodic full run** for scale efficiency.
5. **Telemetry + median-based guardrail** to surface regressions early.
6. **Avoid style rules in ESLint**; keep Prettier authoritative (already aligned
   via `eslint-config-prettier`).
7. **Config-as-package** pattern for cross-repo consistency.

## 6. Recommended Config Enhancements

### 6.1 `prettier.config.mjs` Update (Excerpt)

```js
// prettier.config.mjs (delta excerpt)
export default {
  // ...existing options
  pluginSearchDirs: false, // Ensures only declared plugins are resolved
  plugins: [
    'prettier-plugin-organize-imports',
    'prettier-plugin-packagejson',
    // 'prettier-plugin-tailwindcss', // Enable when Tailwind usage confirmed
  ],
  // overrides: [...existing, potential future MDX override]
}
```

### 6.2 Harmonize `.editorconfig`

Current global `max_line_length = 100` contradicts Prettier 80. Proposed:

```ini
[*]
max_line_length = 80

[*.json]
max_line_length = 100

[*.md]
max_line_length = 80
```

If preferring editor soft-wrap for Markdown, keep `off` but add a comment
referencing Prettier’s enforced wrapping to avoid confusion.

### 6.3 Normalize `.prettierignore`

Remove redundant patterns & annotate intent (example):

```ignore
# Workspace meta
.agent-os/.obsidian/

# Build & caches
dist
dist-*
coverage
**/dist
**/dist-types
**/.turbo
**/.next
**/.cache
**/build

# Dependencies
pnpm-lock.yaml
**/node_modules

# Reports / logs
*.log
logs/format-metrics.json

# Artifacts
sbom.json
security-sbom.json
*.snap
```

### 6.4 Tailwind Plugin Integration (Deferred Switch)

Enable only after confirming Tailwind usage surface area (see
`docs/prettier-tailwind-action-plan.md`). Add a commented placeholder now to
minimize future merge friction.

## 7. CI Strategy Evolution

| Stage     | Before                      | After                                                  |
| --------- | --------------------------- | ------------------------------------------------------ |
| PR CI     | Always `prettier --check .` | Conditional: changed-file mode (< threshold) else full |
| Nightly   | N/A                         | Full `--check` for drift detection                     |
| Telemetry | None                        | JSON artifact `logs/format-metrics.json` uploaded      |

### 7.1 Changed-File Script

```jsonc
// package.json scripts (add)
"format:changed": "git diff --name-only origin/main... | grep -E '\\.(ts|tsx|js|jsx|json|md|mdx|yml|yaml|mjs|cjs)$' | xargs -r prettier --check"
```

### 7.2 Workflow Snippet (Pseudo)

```bash
CHANGED=$(git diff --name-only origin/main... | wc -l | tr -d ' ')
if [ "$CHANGED" -lt 600 ]; then
  pnpm format:changed
else
  pnpm format:check
fi
```

## 8. Telemetry & Observability

### 8.1 Metrics Schema

```json
{
  "timestamp": "ISO-8601",
  "mode": "check|write|changed",
  "durationMs": 1234,
  "filesScanned": 950,
  "filesChanged": 12,
  "exitCode": 0
}
```

### 8.2 Script Skeleton (`scripts/format-metrics.ts`)

```ts
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import path from 'node:path'

const mode =
  process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1] || 'check'
const start = performance.now()

function countTracked(): number {
  return Number(execSync('git ls-files | wc -l').toString().trim())
}

function listDifferent(): string[] {
  const out = spawnSync('prettier', ['--list-different', '.'], {
    encoding: 'utf-8',
  })
  if (out.status && out.status > 1) process.exit(out.status)
  return out.stdout.trim() ? out.stdout.trim().split('\n') : []
}

let filesChanged = 0
let filesScanned = countTracked()
if (mode === 'check' || mode === 'changed') {
  filesChanged = listDifferent().length
} else if (mode === 'write') {
  spawnSync('prettier', ['--write', '.'], { stdio: 'inherit' })
}

const durationMs = Math.round(performance.now() - start)
const record = {
  timestamp: new Date().toISOString(),
  mode,
  durationMs,
  filesScanned,
  filesChanged,
  exitCode: 0,
}

const logPath = path.resolve('logs/format-metrics.json')
let data: any[] = []
if (existsSync(logPath)) {
  try {
    data = JSON.parse(readFileSync(logPath, 'utf-8'))
  } catch {
    data = []
  }
}
data.push(record)
writeFileSync(logPath, JSON.stringify(data, null, 2) + '\n')
console.log('[format-metrics]', record)
```

### 8.3 Regression Guard (Concept)

Compute rolling median over last N (e.g. 20) entries; flag if current
`durationMs` > 2× median without >10% `filesScanned` increase.

## 9. Lint-Staged Simplification (Optional)

Unified approach (benchmark before adopting):

```jsonc
"lint-staged": {
  "*.{ts,tsx,js,jsx,json,md,mdx,yml,yaml,mjs,cjs}": ["prettier --write"],
  "*.{ts,tsx,js,jsx}": ["turbo run lint:fix --filter=...[HEAD] --continue=dependencies-successful"],
  "*.{ts,tsx}": ["vitest related --run"]
}
```

## 10. Shareable Config Package (Optional Phase)

Structure:

```text
packages/prettier-config/
  package.json
  index.mjs
  README.md
```

Peer dependency: `prettier >=3`. Root `prettier.config.mjs` imports & re‑exports
to minimize duplication.

## 11. Prioritized TODO

### Immediate (High Value)

- [ ] Add `pluginSearchDirs: false` to `prettier.config.mjs`.
- [ ] Insert commented Tailwind plugin placeholder.
- [ ] Add `format:changed` script.
- [ ] Integrate conditional CI logic (changed vs full).
- [ ] Align `.editorconfig` line length guidance with Prettier.
- [ ] Normalize `.prettierignore` (annotated form).

### Short Term (1–2 Weeks)

- [ ] Implement `scripts/format-metrics.ts`.
- [ ] Upload telemetry artifact in CI.
- [ ] Benchmark & (maybe) simplify `lint-staged`.
- [ ] Add regression guard script (warn on perf spikes).

### Medium Term

- [ ] Publish optional `@template/prettier-config` package.
- [ ] Tailwind plugin activation (post verification of usage scope).
- [ ] Add MDX override when MDX introduced.

### Future / Nice-to-Have

- [ ] Cache `.prettiercache` across CI jobs (if cost > benefit validated).
- [ ] PR bot summary (files changed + format duration).
- [ ] Turborepo task entry for `format` with remote caching semantics.

## 12. Decision Log Template

```md
### Decision: Conditional Prettier & Tailwind Plugin Adoption

Date: YYYY-MM-DD Context: Full formatting cost scaling; anticipate Tailwind
class review noise. Decision: Add changed-file formatting; stage Tailwind plugin
integration; add telemetry. Consequences: Faster PR feedback; new telemetry
maintenance overhead. Review: +90 days Rollback: Remove plugin + scripts; revert
CI step.
```

## 13. Validation Checklist

- [ ] `pnpm run format:check` passes clean baseline.
- [ ] `pnpm run format:changed` only scans staged diff subset.
- [ ] Telemetry file produced with valid JSON schema.
- [ ] CI logs show conditional path selection.
- [ ] (When enabled) Tailwind class ordering diffs isolated & expected.

## 14. Rollback Strategy

1. Remove newly added script lines & config keys.
2. Delete telemetry file and ignore entries if obsolete.
3. Remove Tailwind plugin dependency & entry if introduced.
4. Run `pnpm run format` (stabilize diffs), commit
   `revert(format): rollback formatting enhancements`.

## 15. Acceptance Criteria (Success Indicators)

| Metric                                           | Target              |
| ------------------------------------------------ | ------------------- |
| Full-run format (cold CI)                        | < 25s               |
| Changed-file format median                       | < 5s                |
| Tailwind ordering comments after adoption window | → 0                 |
| Perf regression alerts (per quarter)             | < 2 false positives |

## 16. Appendix

### 16.1 Current vs Proposed Delta (Conceptual)

| Item          | Current        | Proposed                             |
| ------------- | -------------- | ------------------------------------ |
| Plugin safety | (implicit)     | `pluginSearchDirs: false`            |
| Tailwind      | none           | commented placeholder (enable later) |
| CI formatting | always full    | conditional + nightly full           |
| Telemetry     | none           | JSON metrics & regression guard      |
| EditorConfig  | width mismatch | harmonized semantics                 |

### 16.2 Frequently Asked Questions

**Q:** Why not adopt Biome or dprint now? **A:** Scope focuses on incremental
hardening; migration introduces heavier organizational change & rule parity
audits.

**Q:** Why not enable Tailwind immediately? **A:** Avoid churn if Tailwind usage
remains minimal; stage until confirming class density.

**Q:** Why changed-file threshold (e.g. 600)? **A:** Empirical break-even where
full scan time ≈ incremental + overhead; tune with telemetry.

---

> Next Action: Execute Immediate TODO items; open a PR titled
> `chore(format): add pluginSearchDirs & conditional formatting` referencing
> this document.
