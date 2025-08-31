# Validation Checklist (Lean)

> Purpose: Fast, ADHD-friendly confirmation that the DX Cleanup is READY. This
> file is intentionally short. Deep/verbose command recipes moved to Appendix.

## How To Use

1. Run the single consolidated status command:

```bash
pnpm dx:status
```

1. Compare against the Enforcement Matrix in the main spec
   (`specs/2025-08-31-dx-cleanup-code-smells/spec.md`).

1. Only investigate a section below if `dx:status` (or CI) shows a FAIL / WARN.

## MUST PASS (Hard Gates)

| Gate               | Threshold / Condition         | Source Of Truth             | Status |
| ------------------ | ----------------------------- | --------------------------- | ------ |
| Type coverage      | ≥ 95%                         | `pnpm type:coverage`        | ⬜     |
| Test line coverage | ≥ 85%                         | `pnpm test:coverage`        | ⬜     |
| `any` types        | 0 unsafe (`: any`, `any /*`)  | lint + typecheck            | ⬜     |
| Build (warm)       | < 2s core packages            | `pnpm build:core` (2nd run) | ⬜     |
| Test duration      | < 5s (local warm)             | `pnpm test:ci --run`        | ⬜     |
| Turbo cache hit    | ≥ 85%                         | CI summary / `dx:status`    | ⬜     |
| High vulns         | 0 (unless whitelisted)        | `pnpm security:scan`        | ⬜     |
| SBOM generated     | `security-sbom.json` present  | repo root                   | ⬜     |
| Scripts count      | < 30 top-level                | `package.json`              | ⬜     |
| Export maps        | Present & valid               | lint / build                | ⬜     |
| Structured logging | Logger module exists          | `scripts/lib/logger.ts`     | ⬜     |
| Error hierarchy    | Errors module exists          | `scripts/lib/errors.ts`     | ⬜     |
| Sanitization utils | `command` & `path` safe utils | `scripts/lib/*`             | ⬜     |

Mark all ⬜ → ✅. Stop if any remain.

## SHOULD PASS (Soft / Yellow Gates)

| Item                 | Target              | Why it matters                | Status |
| -------------------- | ------------------- | ----------------------------- | ------ |
| CI total time        | < 10 min            | Fast feedback loop            | ⬜     |
| Image size (if used) | < 200MB             | Deploy speed / cost           | ⬜     |
| HMR latency          | < 1s edit→refresh   | Flow / focus retention        | ⬜     |
| Context recovery     | < 10s after return  | ADHD cognitive load reduction | ⬜     |
| Onboarding           | First commit < 5min | Team scalability              | ⬜     |

Soft gates can ship with a documented follow-up if ≥ 80% of soft targets are
green.

## QUICK CHECK COMMANDS

| Category  | Command (Representative)                  | What To Scan For |
| --------- | ----------------------------------------- | ---------------- |
| Types     | `pnpm typecheck`                          | 0 errors         |
| Coverage  | `pnpm test:coverage`                      | ≥ thresholds     |
| Any types | `pnpm lint:types`                         | No unsafe any    |
| Security  | `pnpm security:scan`                      | 0 high/critical  |
| Build     | `time pnpm build:core`                    | Warm < 2s        |
| Cache     | `pnpm build:core` (run twice)             | Cache hits       |
| Scripts   | Count script keys via jq (scripts length) | < 30             |
| Exports   | `pnpm lint:exports` (if configured)       | No violations    |

## ARTIFACT EXISTENCE SNAPSHOT

| Path / Artifact                | Exists | Notes                |
| ------------------------------ | ------ | -------------------- |
| `scripts/lib/logger.ts`        | ⬜     | Structured JSON logs |
| `scripts/lib/errors.ts`        | ⬜     | Base + domain errors |
| `scripts/lib/retry.ts`         | ⬜     | Exponential backoff  |
| `scripts/lib/command-utils.ts` | ⬜     | Safe exec wrapper    |
| `scripts/lib/path-utils.ts`    | ⬜     | Path traversal guard |
| `security-sbom.json`           | ⬜     | CycloneDX            |
| `.quality-baseline.json`       | ⬜     | Performance + types  |
| `.security-baseline.json`      | ⬜     | Vuln snapshot        |

All should be ✅.

## SIGN-OFF FLOW

1. Run `pnpm dx:status` → capture snapshot (commit if new baselines updated).
2. Ensure all MUST PASS gates green.
3. Log soft gate misses (if any) in follow-up issue with owner + ETA.
4. Tag release branch / proceed with merge.

## ROLLBACK (Simplified)

| Scenario               | Action                              |
| ---------------------- | ----------------------------------- |
| Broken build           | Revert last commit                  |
| Widespread type fail   | Restore previous `tsconfig*` files  |
| Security regression    | Re-run scan; revert dependency bump |
| Performance regression | Revert perf-impact commit           |

Use `git revert <sha>` (avoid force-push to main).

## SUCCESS SNAPSHOT

| Metric Group | Primary Signals               | Improvement Definition                   |
| ------------ | ----------------------------- | ---------------------------------------- |
| Reliability  | 0 flaky tests / stable CI     | No re-runs required                      |
| Safety       | 0 high vulns / 0 unsafe any   | All enforced by gates                    |
| Speed        | Build + Test within targets   | Warm loops feel instant                  |
| Focus        | Commands memorable (< 7 core) | Dev can resume context < 10s             |
| Maintainable | Modules small & typed         | No >500 line script / no sprawling utils |

If all five groups satisfy definitions → PROJECT READY.

## APPENDIX (Deep Dives – Only When Red)

Rather than clutter the main checklist, detailed one-off commands for forensic
investigation live in `docs/dx-status-enhancement-plan.md` & security / CI
sub-specs. Add new deep-dive commands there, not here.

---

Minimal surface area = faster green. If you feel pulled to add more boxes, first
ask: Does the main spec gate already cover it? If yes — link, don't add.
