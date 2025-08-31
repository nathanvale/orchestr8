# Technical Specification (Lean)

> Purpose: Single-page implementation compass tied to enforcement gates. Strip
> narrative; keep actionable constraints.

## Scope Table (Must / Defer / Drop)

| Domain      | Must (Current Cycle)                                   | Defer (Later)                   | Drop (Out)                  |
| ----------- | ------------------------------------------------------ | ------------------------------- | --------------------------- |
| Types       | 0 unsafe `any`, ≥95% type coverage, explicit returns   | Discriminated unions everywhere | Broad domain modeling       |
| Scripts     | Core scripts <30, unified `dx:status`, aliases trimmed | Interactive explorer UI         | Spinner art / emojis        |
| Errors/Logs | Shared errors+logger+retry+handlers                    | React ErrorBoundary             | Mega class hierarchy        |
| Security    | SBOM working, vuln scan, command/path sanitize         | Automated CVE alert pipeline    | Multiple redundant scanners |
| Performance | Warm build <2s, tests <5s, turbo hit ≥85%              | Fine-grained perf dashboards    | Micro-optim premature       |
| Coverage    | Lines ≥85%, branch tracked (ratchet)                   | 90%+ branches                   | 100% blanket coverage       |
| DX Flow     | Context recovery <10s via `dx:status`                  | Animated interactive help       | Gamified progress bars      |

## Enforcement Mapping

| Gate                 | Command / Source      | Pass Criteria                    |
| -------------------- | --------------------- | -------------------------------- |
| Type safety          | `pnpm type:coverage`  | ≥95% + 0 unsafe any              |
| Test coverage        | `pnpm test:coverage`  | ≥85% lines                       |
| Build perf (warm)    | 2nd `pnpm build:core` | <2s                              |
| Test perf (warm)     | `pnpm test:ci --run`  | <5s                              |
| Turbo cache          | CI summary / status   | ≥85% hit                         |
| Security scan        | `pnpm security:scan`  | 0 high/critical (or whitelisted) |
| SBOM                 | `security-sbom.json`  | Exists + >300 components         |
| Script count         | `package.json`        | <30 top-level                    |
| Logging/Errors infra | File presence check   | Modules exist                    |

## Minimal Decisions (Why)

| Decision                               | Rationale (1-liner)            |
| -------------------------------------- | ------------------------------ |
| Automated type migration + manual diff | Speed + consistency            |
| Single orchestrator per large script   | Limits cognitive load          |
| JSON line logger (no color)            | Grep + CI friendly             |
| 5 canonical error types only           | Prevent taxonomy creep         |
| Skip interactive help v1               | Not gating shipping            |
| Central retry helper                   | Remove duplicated ad-hoc loops |
| Baseline files tracked in git          | Enables regress detection      |

## Dependency Policy

| Package                | Status | Justification                     |
| ---------------------- | ------ | --------------------------------- |
| @cyclonedx/cdxgen      | Keep   | SBOM generation                   |
| osv-scanner            | Keep   | Vuln DB coverage                  |
| inquirer / chalk / ora | Defer  | Cosmetic; not needed for gates    |
| New runtime libs       | Block  | Require written rationale + owner |

## Implementation Slice Plan

| Day | Focus                  | Outputs / Checkpoints                           |
| --- | ---------------------- | ----------------------------------------------- |
| 1   | SBOM + security scan   | Working `security-sbom.json`, scan passes       |
| 2   | Type migration pass 1  | Remove bulk unsafe any                          |
| 3   | Type migration cleanup | Reach ≥95% coverage, add guards where needed    |
| 4   | Script consolidation   | <30 scripts; add `dx:status` minimal            |
| 5   | Error/log infra        | errors.ts logger.ts retry.ts handlers.ts        |
| 6   | Refactor top scripts   | security-scan, coverage-gate, pre-release guard |
| 7   | Perf & cache tuning    | Warm build <2s, turbo metrics captured          |
| 8   | Coverage ratchet setup | Baseline file, enforce threshold CI             |
| 9   | Hardening & polish     | Remove dead code / finalize docs pointers       |

Parallel allowance: small test additions can occur any day if failing gate.

## Refactor Rules (Large Scripts)

| Rule                  | Limit / Pattern                 |
| --------------------- | ------------------------------- |
| Orchestrator size     | ≤120 LOC                        |
| Module size (utility) | ≤150 LOC                        |
| Nesting depth         | ≤3 (else early return)          |
| Side-effect isolation | All IO in adapters              |
| Parallel tasks        | `Promise.all` where independent |
| Exit paths            | Single tail handler             |

## Quick Pattern Snippets

Type guard minimal:

```ts
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}
```

Early return flattening:

```ts
if (!config.enabled) return { skipped: true }
```

Central command adapter:

```ts
async function run(cmd: string, args: string[]) {
  /* wraps child_process */
}
```

Retry usage:

```ts
await retry(() => fetchWithTimeout(url), { attempts: 3 })
```

Script wrapper:

```ts
main().catch((e) => {
  logger.error('script_fail', e)
  process.exit(1)
})
```

## Non-Goals

| Item                             | Reason                 |
| -------------------------------- | ---------------------- |
| 100% test coverage               | Diminishing returns    |
| Full domain event system         | Overhead not justified |
| Multi-logger pluggable framework | Complexity vs need     |
| CLI theming layer                | Cosmetic               |

## Metrics (Track & Ratchet)

| Metric               | Baseline (est) | Target | Ratchet Strategy                  |
| -------------------- | -------------- | ------ | --------------------------------- |
| Type coverage        | ~90%           | 95%    | Fail CI if below; raise quarterly |
| Test line coverage   | ~80%           | 85%    | Gate + incremental raise          |
| Warm build time      | ~3.5s          | <2s    | Profile top tasks; cache refine   |
| Test duration (warm) | ~7s            | <5s    | Split slow suites                 |
| Turbo cache hit      | ~60%           | 85%    | Input hashing audit               |
| High vulns           | 2              | 0      | Fail scan unless whitelisted      |

## Risk Snapshot & Mitigation

| Risk                        | Impact | Mitigation                                 |
| --------------------------- | ------ | ------------------------------------------ |
| Type churn breaks builds    | High   | Commit in small batches + CI per batch     |
| Over-refactor scripts       | Med    | Stop once gates green                      |
| Cache regressions unnoticed | Med    | Add cache metrics to `dx:status`           |
| Tool sprawl resurfaces      | Med    | Dependency allowlist review in PR template |
| Missed security regress     | High   | Baseline diff + scan in CI                 |

## Validation Flow

| Stage  | Action Set                                           | Pass Signal                    |
| ------ | ---------------------------------------------------- | ------------------------------ |
| Before | Capture baselines (types, coverage, build, security) | Baseline files committed       |
| During | Gate run on each major PR                            | All gates green or justified   |
| After  | Re-run full matrix + snapshot new baselines          | Stable metrics 2 runs in a row |

## Exit Criteria

All enforcement gates green in two consecutive CI runs + refactor rules
satisfied for target scripts + dependency diff shows no unapproved additions.

## Appendices

Verbose before/after examples removed; see previous commit history if needed.
Add new deep examples to `docs/refactor-examples.md` (do not expand this file).

---

If a proposal is not directly improving a failing gate, it is deferred.
