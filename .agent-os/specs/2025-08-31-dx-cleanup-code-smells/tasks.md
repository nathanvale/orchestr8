# DX Cleanup Task Board (Lean)

Spec: `specs/2025-08-31-dx-cleanup-code-smells/spec.md` (lean revision)

Intent: Ship core gates fast. Only track MUST work here. Deferred ideas live in
sub-specs.

Legend: ✅ Done · ⬜ Pending · 🟡 Soft/Optional · 🚫 Dropped

## P0 (Days 1–2) Core Enablement

- [ ] Capture baseline: create `.quality-baseline.json` (build_warm_ms,
      test_warm_ms, typeCoverage, lineCoverage, cacheHitRate)
- [ ] Add type coverage tool & CI gate (≥95%)
- [ ] Remove / justify all unsafe `any` (0 remaining or annotated // @intent)
- [ ] Prune root scripts to ≤30 & apply category prefixes (dev:, test:, build:,
      dx:, sec:, release:)
- [ ] Implement minimal `pnpm dx:status` showing: type %, coverage %, build/test
      warm ms, turbo hit %, vuln high count, script count
- [ ] Fix SBOM generation (valid CycloneDX, >300 components) & add validation
      step
- [ ] Add vuln scan gate (fail on High/Critical unless whitelisted)
- [ ] Add turbo inputs pruning in `turbo.jsonc` (remove `**/*` wildcards)
- [ ] Add performance guard scripts (warm build/test regression < +10%)

Exit P0 = All hard gates measurable + passing locally (type, coverage,
build/test time, vuln, SBOM, script count).

## P1 (Days 3–4) Runtime Hygiene

- [ ] Add `scripts/lib/errors.ts` (AppError + Validation/Script/File/Network)
- [ ] Add `scripts/lib/logger.ts` (JSON line logger)
- [ ] Add `scripts/lib/retry.ts` (exponential backoff helper)
- [ ] Add `scripts/lib/process-handlers.ts` (unhandled rejection / exception)
- [ ] Refactor `security-scan.ts` into orchestrator + modules (sbom,
      vulnerabilities, baseline, report)
- [ ] Refactor `pre-release-guard.ts` (shrink; single exit)
- [ ] Refactor `dx-status.ts` (split collection vs formatting)
- [ ] Replace stray `console.*` in touched scripts with logger
- [ ] Introduce coverage merge + threshold gate (≥85% lines; ratchet saved)

Exit P1 = Shared infra adopted by top 3 scripts; coverage gate active.

## P2 (Days 5–6) CI Acceleration

- [ ] Add validate job in `ci.yml` (typecheck, lint, security, gates) with early
      fail
- [ ] Implement Vitest sharding (≥4 fixed shards) command
- [ ] Add affected detection script producing `affected.json`
- [ ] Integrate shard + affected logic into CI (skip unaffected builds/tests)
- [ ] Merge coverage artifacts & enforce gate in CI
- [ ] Parse turbo dry-run → compute hit ratio ≥85% (warn if <70%, fail <60%)
- [ ] Upload `metrics.json` (build/test ms, turbo hit, coverage) as artifact

Exit P2 = CI wall time reduced; early-fail works; cache hit trending upward.

## P3 (Post-Core / Deferred)

- [ ] Enable remote turbo cache (TURBO_TOKEN/TEAM secrets) (slice 6)
- [ ] Docker multi-stage build (web) 🟡
- [ ] Flaky test detection (historical failure scan) 🟡
- [ ] License compliance check (optional if policy needed) 🟡
- [ ] Metrics trend badge publishing 🟡
- [ ] Affected-based build skip for purely docs changes (fine-tune) 🟡

## Hard Gate Summary (Must Stay Green)

| Gate          | Threshold                | Source                | Fail Action            |
| ------------- | ------------------------ | --------------------- | ---------------------- |
| Type coverage | ≥95%                     | type-coverage         | Block merge            |
| Line coverage | ≥85% (ratchet)           | coverage merge        | Block merge            |
| Unsafe any    | 0                        | ESLint rule           | Block merge            |
| Warm build    | <2s                      | perf script (2nd run) | Block (after baseline) |
| Warm tests    | <5s                      | perf script           | Block (after baseline) |
| Turbo hit     | ≥85% (warn <70%)         | dry-run parse         | Block <60%             |
| High vulns    | 0 (or whitelisted)       | security scan         | Block merge            |
| SBOM          | Exists + >300 components | sbom validate         | Block merge            |
| Script count  | ≤30                      | script lint           | Block merge            |

## Definition of Done (Project Core)

All P0–P2 tasks ✅ + Hard gates green in 2 consecutive CI runs + top target
scripts refactored + baseline updated intentionally (guard script used) + no new
deps outside allowlist.

## Quick Validation Flow

1. `pnpm dx:status` (local) → all hard gates green
2. Push branch → CI validate job passes (no early fail)
3. Sharded tests + coverage merge succeed
4. Metrics artifact uploaded & parsed (turbo hit visible)
5. Merge only if unchanged gates remain green post-rebase

## Guardrails

- Defer anything not improving a failing gate
- Reject new error types unless ≥2 examples lacking fit
- Reject new dependencies unless they collapse ≥3 duplicates
- No interactive CLI polish until core stability proven (post P2)

## Tracking Notes

Add context / blockers inline under task list (do not expand with new sections).
Remove completed lines instead of striking to keep surface minimal.

---

If a task feels like “nice to have”, move it to Deferred or delete.
