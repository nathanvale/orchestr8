# Script Refactoring Guide (Lean)

> Purpose: Shrink monolithic scripts fast. Focus on clarity + testability. Avoid
> premature abstraction. Only refactor what blocks reliability or speed.

## Use This When

You touch a script that is either:

| Trigger                | Threshold (Ship Blocker) | Action                            |
| ---------------------- | ------------------------ | --------------------------------- |
| File length            | > 300 LOC                | Slice into orchestrator + modules |
| Mixed responsibilities | ≥ 3 distinct concerns    | Separate per concern              |
| Hard to test           | No pure units exported   | Extract pure functions            |
| Deep nesting           | > 3 levels               | Flatten via early returns         |
| Repeated patterns      | 3+ similar blocks        | Create small helper (local)       |

If none of these triggers apply: STOP. Do not refactor.

## Target Scripts (Current Cycle)

1. `security-scan.ts` (oversized, mixed concerns)
1. `record-baselines.ts` (state + IO tangled)
1. `export-map-linter.ts` (nested condition chains)
1. `dx-status.ts` (formatting + data collection tightly coupled)
1. `pre-release-guard.ts` (validation monolith)

## Refactor Definition of Done

| Dimension    | Requirement                                      |
| ------------ | ------------------------------------------------ |
| Size         | Orchestrator ≤ 120 LOC                           |
| Structure    | `orchestrator` + focused modules (≤ ~150 LOC ea) |
| Testability  | Each module has at least 1 unit test             |
| Logging      | Uses shared `logger` (no ad-hoc `console.*`)     |
| Errors       | Throws typed errors from shared `errors` module  |
| Coupling     | No direct shell calls in pure logic              |
| Side Effects | Isolated behind tiny adapter functions           |
| Parallelism  | Independent IO tasks batched via `Promise.all`   |
| Exit Codes   | Single exit point decides process code           |

## Minimal Module Layout Template

```text
scripts/
  security-scan.ts          # Orchestrator (deps wiring + sequencing only)
  lib/security/
    sbom.ts                 # Pure generation + validation
    vulnerabilities.ts      # Wrapper around scanner tool
    licenses.ts             # License allow/deny logic
    baseline.ts             # Load/update baseline JSON
    report.ts               # Shape final result (pure)
    types.ts                # Narrow domain types only
```

Rules:

1. Keep each module single-purpose (name matches exported intent).
1. Export only functions + types (avoid classes unless stateful strategy).
1. Orchestrator performs: parse args → schedule tasks → aggregate → print /
   exit.

## Fast Refactor Playbook (30–60 min)

1. Snapshot: copy original file → `.bak` (temporary, deleted before commit).
1. Identify concerns (scan comments / sections) – list them.
1. Inline mark segments with `// EXTRACT: <concern>`.
1. Create modules matching concerns; move code verbatim first (no polishing).
1. Replace moved blocks with slim function calls.
1. Run tests / add minimal new ones for extracted pure functions.
1. Introduce early returns to cut nesting.
1. Replace repeated literals (paths, flags) with local `const` (not global
   config).
1. Delete `.bak`. Commit.

## Allowed Refactor Types (Scope Guard)

| Refactor Type        | Allowed? | Notes                                 |
| -------------------- | -------- | ------------------------------------- |
| Logic extraction     | ✅       | Prefer pure functions first           |
| Rename for clarity   | ✅       | If improves intent (no churn)         |
| Convert to class     | ❌       | Unless real polymorphism/state needed |
| Add new dependency   | ❌       | Use existing libs only                |
| Introduce framework  | ❌       | No heavy orchestration libs           |
| Add color/spinner UX | Deferred | Optional – not part of core refactor  |

## Anti-Patterns To Remove

| Pattern                           | Replace With                           |
| --------------------------------- | -------------------------------------- |
| Nested try/catch chains           | Single try around task loop            |
| Long `switch` with 30+ lines      | Command map object                     |
| Re-building JSON output piecewise | Collect → pure formatter function      |
| Inline shell + parse + logic      | `runCommand()` adapter + pure parse    |
| Silent failures                   | Throw typed error + single top handler |

## Core Snippets (Reference Only)

Task batching:

```ts
const tasks = [genSbom, scanVulns, checkLicenses]
const results = await Promise.all(tasks.map((t) => t()))
```

Early return flattening:

```ts
if (!config.enabled) return { skipped: true }
```

Adapter isolation:

```ts
export async function runCommand(cmd: string, args: string[]): Promise<string> {
  // wraps child_process / safe exec; throws TypedError on non‑zero
}
```

Pure formatting:

```ts
export function formatReport(sections: Section[]): string {
  /* no IO */
}
```

Guarded error use:

```ts
try {
  await step()
} catch (err) {
  logger.error('step_failed', { step, err })
}
```

## When NOT To Refactor

| Situation                   | Action                        |
| --------------------------- | ----------------------------- |
| Feature flag experiment     | Wait until flag stabilizes    |
| Script < 150 LOC & readable | Leave as-is                   |
| Imminent deprecation        | Do minimal patch only         |
| Perf issue unproven         | Add metric first, then decide |

## DX Status Split (Planned)

| Concern      | Module                 | Status   |
| ------------ | ---------------------- | -------- |
| Checks       | `status-checker.ts`    | Planned  |
| Formatting   | `status-format.ts`     | Planned  |
| Output style | (deferred)             | Deferred |
| Spinner/UX   | (remove unless needed) | Deferred |

## Security Scan Refactor (Essentials Only)

| Concern         | Module               | Notes                       |
| --------------- | -------------------- | --------------------------- |
| SBOM            | `sbom.ts`            | Generation + validation     |
| Vulns           | `vulnerabilities.ts` | Scanner wrapper             |
| Licenses        | `licenses.ts`        | Allow/deny + summary        |
| Baseline mgmt   | `baseline.ts`        | Load + diff + update gating |
| Report assembly | `report.ts`          | Pure; returns JSON object   |

Baseline update must be explicit via flag (e.g. `--update-baseline`) to avoid
accidental drift.

## Refactor Review Checklist

| Check                        | ✅  |
| ---------------------------- | --- |
| Orchestrator shrunk          |     |
| Modules single-purpose       |     |
| No new deps introduced       |     |
| Pure functions unit tested   |     |
| Shared logger used           |     |
| Typed errors thrown/caught   |     |
| Parallelizable tasks batched |     |
| No dead code / leftovers     |     |

## Deferred / Nice-to-Have (Track Separately)

| Idea                  | Reason Deferred             |
| --------------------- | --------------------------- |
| Interactive help TUI  | Cosmetic; zero gating value |
| Animated spinners     | Adds dependency weight      |
| Rich color gradients  | Noise vs signal             |
| Generic plugin system | Overkill at current scale   |

## Success Signals

| Signal              | Measurement                             |
| ------------------- | --------------------------------------- |
| Cognitive load drop | Time-to-understand file < 2 min         |
| Test granularity    | ≥ 1 pure unit test per extracted module |
| Change locality     | PR diff touches ≤ 2 modules on tweaks   |
| Failure clarity     | Errors show domain + context fields     |

## Appendix (Optional Deep Dives)

Removed verbose before/after blocks. If specific examples required, add them to
a dedicated `docs/refactor-examples.md` rather than bloating this lean guide.

---

If you feel compelled to add more patterns ask: Will this help ship faster next
week? If not, defer.
