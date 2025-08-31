# CI Optimization (Lean)

Purpose: Fast, deterministic feedback. Make the green path (changed code only)
cheap; fail early on structural breaks; surface performance regressions before
they ossify.

Version: 2025-08-31-lean

## Scope Table

| Category   | MUST (immediately)                                                | SOFT (helpful)                | DEFER (after core stable)                      | DROP (out of scope)                         |
| ---------- | ----------------------------------------------------------------- | ----------------------------- | ---------------------------------------------- | ------------------------------------------- |
| Pipelines  | Single consolidated `ci.yml` with validate→(tests+build) parallel | Nightly perf workflow         | Multi-cloud runners                            | Multi-branch bespoke workflows              |
| Caching    | Precise Turbo inputs; remote cache enabled; pnpm store cache      | Layered Docker build cache    | Self-hosted cache proxy                        | Exotic multi-layer caching scripts          |
| Test Exec  | Sharded Vitest (≥4 shards) + affected-only fast path              | Flaky detector flagging       | Automatic shard rebalancing                    | Dynamic infra spin-up per test              |
| Build      | Per-package parallel builds (matrix)                              | Docker multi-stage (web)      | Multi-arch images                              | Full Bazel migration                        |
| Metrics    | Collect: warm build ms, warm test ms, turbo hit %, coverage %     | Publish trend badge           | SLA alerts                                     | Real-time streaming dashboards              |
| Governance | Concurrency cancel in-progress; required gates enforced           | Code owners on workflow edits | Signed workflow provenance                     | Full supply‑chain SBOM attestation pipeline |
| Security   | Principle: frozen lockfile & immutable base images                | Image CVE scan (scheduled)    | Reproducible builds (deterministic timestamps) | On-cluster admission controllers            |

## Hard Gates (enforced by central validation)

| Gate                    | Target           | Source                              | Enforcement Moment     |
| ----------------------- | ---------------- | ----------------------------------- | ---------------------- |
| Warm build (single pkg) | <2s              | `dx:status` script timing           | Post validate job      |
| Warm test (core shard)  | <5s              | Vitest timing aggregated            | Test matrix completion |
| Turbo cache hit         | ≥85%             | `turbo run ... --dry-run=json`      | Validate job           |
| Coverage (lines)        | ≥85%             | Merged lcov                         | After coverage merge   |
| Type safety             | ≥95%             | `tsc --noEmit` + type coverage tool | Validate job           |
| High/Critical vulns     | 0 (or baselined) | osv / audit scan                    | Validate job           |

Fail early: if any hard gate fails in `validate`, skip downstream matrix
(short-circuit).

## Pipeline Shape (Happy Path)

1. validate (fast ≤3m)
   - checkout (fetch-depth 0)
   - pnpm install (frozen)
   - turbo warm-up (dry-run to confirm cache scope)
   - typecheck + lint + security scan + quality gates (no build yet if
     avoidable)
   - compute affected graph + export JSON artifact (used by tests & builds)
2. test (matrix)
   - shards only for affected packages; if root change → all
   - vitest shard command: `pnpm test:ci --shard=N/total`
3. build (matrix)
   - only affected build targets (skip if purely doc/tests)
4. coverage-merge
   - download shard artifacts, merge, enforce threshold
5. quality-report (optional soft)
   - push metrics JSON for trend tracking

## Minimal Workflow Skeleton (reference only)

```yaml
name: CI
on:
  pull_request:
  push:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc', cache: pnpm }
      - run: pnpm install --frozen-lockfile --prefer-offline
      - name: Turbo cache dry-run
        run: turbo run build --dry-run=json > turbo-dry-run.json
      - name: Validate gates
        run: pnpm validate
      - name: Detect affected
        run: pnpm ts-node scripts/affected.ts > affected.json
      - uses: actions/upload-artifact@v4
        with: { name: affected, path: affected.json }

  test:
    needs: validate
    if: needs.validate.result == 'success'
    strategy:
      fail-fast: false
      matrix: { shard: [1,2,3,4] }
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: affected }
      - uses: ./.github/actions/setup
      - run: pnpm test:ci --shard=${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v4
        with: { name: cov-${{ matrix.shard }}, path: coverage }

  coverage-merge:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { path: ./artifacts }
      - run: pnpm merge:coverage ./artifacts
      - run: pnpm coverage:gate
```

## Turbo Inputs (Principle)

Only list files that materially change outputs. Avoid wildcards that explode
dependency graph.

```json
{
  "$schema": "./node_modules/turbo/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**/*.ts",
        "src/**/*.tsx",
        "tsconfig.json",
        "package.json"
      ],
      "outputs": ["dist/**"]
    }
  },
  "globalDependencies": ["pnpm-lock.yaml", ".nvmrc"]
}
```

## Sharding Rules

| Rule                                                      | Rationale                              |
| --------------------------------------------------------- | -------------------------------------- |
| Fixed shard count (start at 4)                            | Keep deterministic timing & simplicity |
| Rebalance only if P95 shard > 1.5× median 3 runs in a row | Avoid churn                            |
| Do not shard <25 total test files                         | Overhead > benefit                     |
| Fail one shard → fail whole job                           | Integrity                              |

## Affected Logic (Concept)

Pseudo: diff base→HEAD, map to top-level package/app directories. Any root file
change sets global rebuild flag. Output JSON consumed by tests/build jobs to
filter.

Invoke: `pnpm affected:list --json > affected.json`

If global flag = true → run full matrix regardless.

## Metrics & Collection

| Metric          | Tool / Command                              | Stored As             | Gate?     |
| --------------- | ------------------------------------------- | --------------------- | --------- |
| build_warm_ms   | `pnpm perf:build` (script times second run) | metrics.json          | Yes       |
| test_warm_ms    | Vitest summary parse                        | metrics.json          | Yes       |
| turbo_hit_ratio | parse `turbo-dry-run.json`                  | metrics.json          | Yes       |
| coverage_lines  | lcov merge                                  | coverage-summary.json | Yes       |
| vuln_high       | osv scan                                    | security-summary.json | Yes       |
| flaky_tests     | (future) repeated failure detector          | metrics.json          | No (soft) |

## Anti-Patterns

| Anti-Pattern                     | Why Bad                      | Replacement                |
| -------------------------------- | ---------------------------- | -------------------------- |
| Wildcard inputs (`"**/*"`)       | Invalidates cache constantly | Minimal file lists         |
| Sequential mega-job              | Slow feedback / late fail    | Validate + parallel shards |
| Reinstall per job w/out cache    | Wastes minutes               | Shared pnpm store cache    |
| Running all tests on doc changes | Wasted compute               | Affected detection skip    |
| Hiding performance regressions   | Drift accumulates            | Trend metrics + gates      |
| Silent gate failures (warn only) | False sense of quality       | Hard fail validate         |

## Rollout Slices

| Slice | Change                             | Success Signal                |
| ----- | ---------------------------------- | ----------------------------- |
| 1     | Introduce validate job + gates     | Pipeline time drops (<12m)    |
| 2     | Add Turbo input pruning            | Cache hit ≥70%                |
| 3     | Add sharded tests                  | Test wall time 50%+ reduction |
| 4     | Add affected detection             | Skips on doc-only PRs         |
| 5     | Add coverage merge + gating        | Stable ≥85% lines             |
| 6     | Add remote cache + metrics publish | Cache hit ≥85% sustained      |

## Minimal Checklist

- [ ] Validate job: typecheck, lint, security, turbo dry-run
- [ ] Hard gate script exits non-zero on breach
- [ ] Turbo inputs pruned (no `**/*`)
- [ ] Sharded test command implemented
- [ ] Coverage merge & threshold gate
- [ ] Affected detection JSON artifact
- [ ] Concurrency cancellation configured
- [ ] Remote cache secrets present (TURBO_TOKEN/TEAM)
- [ ] Metrics artifact (metrics.json) uploaded

## Troubleshooting (Essentials Only)

```bash
# Turbo cache status
turbo run build --dry-run=json | jq '.tasks[].cache'

# Force rebuild to repopulate
turbo run build --force

# Find slow tests (>1s)
pnpm test:ci --reporter=json | jq '.testResults[].assertionResults[] | select(.duration>1000)'
```

## Principles Recap

1. Fast fail > full completion
2. Deterministic inputs > clever heuristics (start simple)
3. Enforce gates centrally, not per workflow copy
4. Avoid premature micro-optimizations (rebalance shards later)
5. Measure before expanding complexity

## Deferred / Future Notes

- Flaky test quarantine lane (requires historical store)
- Automatic shard weight balancing
- Performance regression alert workflow (status checks)
- Multi-arch Docker builds once needed

## References

- Turborepo caching docs
- GitHub Actions concurrency docs
- Vitest sharding docs
- pnpm store caching
- OWASP dependency guidance (for vuln gating)

Legacy long-form examples removed: consult commit history if deep context
required.
