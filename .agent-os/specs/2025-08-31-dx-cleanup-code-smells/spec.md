# Spec Requirements Document (Lean Revision)

> Spec: DX Cleanup & Code Smell Elimination  
> Created: 2025-08-31  
> Status: Planning (Lean v2)  
> Intent: Ruthlessly reduce cognitive load + eliminate high‑leverage smells
> without over‑engineering.

## Purpose (Why This Exists)

We remove the small set of blockers that erode focus (untyped surfaces, noisy
scripts, inconsistent errors, broken security baseline) so the template delivers
on its mission: fast, predictable, ADHD‑friendly flow with a single mental
model.

## Guiding Principles

1. Flow > Features (opt for fewer, clearer tools).
2. Enforceability > Aspiration (every promise has a gate).
3. Defaults First (opt‑in for advanced layers).
4. Minimize Surface Area (no new deps unless they collapse multiple problems).
5. Fast Feedback Always (<5s tests warm, <2s warm builds—measured, not hoped).

## In Scope (Trimmed)

Core (must land):

- Critical type safety (remove unsafe / implicit any + add return types on
  exported/public functions only)
- Script consolidation + discoverability (reduce noise; interactive help is
  optional, not required P0)
- Consistent error & logging contract (lightweight, pluggable, no framework
  lock‑in)
- SBOM + vuln scan fixed (valid CycloneDX + actionable vulnerability diff)
- Baseline + gates (coverage, type coverage, build/test time snapshot + CI
  enforcement)

Deferred / Optional (do NOT block Core):

- Advanced discriminated unions refactors
- Full interactive script explorer UI polish
- Retry orchestration beyond simple exponential backoff helper
- Port orchestration heuristics (basic collision guard only for now)

Out of Scope (explicit): new product features, architectural rewrites, perf
micro‑optimizations beyond hitting gates, aesthetic CLI theming, telemetry
storage backend.

## Deliverables (Concrete + Testable)

1. Zero unsafe `any` (explicit `any` allowed ONLY behind // @intent any
   comment + eslint rule ignoring count = 0).
2. Type coverage ≥95% (using type-coverage) enforced in CI.
3. Line coverage ≥85% + no per-file regression (ratchet).
4. Valid SBOM (CycloneDX) generated in CI; schema validation passes; vuln scan
   produces zero High/Critical unapproved.
5. Script count reduced: root `package.json` top-level runnable scripts ≤30;
   categorized with prefix buckets (dev:, test:, build:, release:, dx:, sec:).
6. Logging + error contract file (`scripts/lib/logging.ts`,
   `scripts/lib/errors.ts`) with documented shape + redaction rules.
7. Baseline performance snapshot committed (`.quality-baseline.json`) capturing:
   warm build time, warm test time, cache hit rate, coverage, type coverage.
8. CI gates fail on: coverage drop, type coverage drop, added unapproved high
   vuln, >10% build or test time regression vs baseline (with env override
   escape hatch `ALLOW_TEMP_REGRESSION=1`).

## User Stories (Condensed)

Enterprise Dev: I need predictable typed surfaces & enforced quality gates so I
trust changes.  
ADHD Dev: I need one obvious start command + short script list so I enter flow
fast.  
Security Dev: I need a reproducible SBOM + vuln diff so I can act, not triage
noise.

## Phased Execution (Realistic)

P0 (Day 1–2): Baselines, unsafe any removal, gating scaffolding, SBOM fix,
script audit + prune draft.  
P1 (Day 3–4): Logging/error contract + implementation, finalize script
categories + lightweight dx:help (optional).  
P2 (Day 5): Coverage ratchet + per-file thresholds, simple retry helper, port
collision guard.  
P3 (Post-Core, optional): Interactive explorer enhancements, advanced union
modeling, richer retry / circuit breaker, telemetry opt‑in.

## Ownership Map

| Domain           | Owner (Alias) | Artifact                                | CI Gate                      |
| ---------------- | ------------- | --------------------------------------- | ---------------------------- |
| Types & Coverage | @types        | type-coverage config, coverage-baseline | type & coverage thresholds   |
| Scripts Hygiene  | @dx           | script inventory report                 | script count + category lint |
| Security         | @sec          | sbom, vuln-report.json                  | high/critical block          |
| Build Perf       | @build        | .quality-baseline.json                  | regression threshold         |
| Error/Logging    | @platform     | logging.ts/errors.ts                    | contract lint (shape)        |

## Enforcement (CI Gate Matrix)

| Gate                  | Tool                               | Threshold                          | Action on Fail      |
| --------------------- | ---------------------------------- | ---------------------------------- | ------------------- |
| Type Coverage         | type-coverage                      | ≥95%                               | Fail job            |
| Unsafe Any            | ESLint custom rule                 | 0 occurrences                      | Fail job            |
| Test Coverage (lines) | Vitest + coverage gate script      | ≥85% & no drop                     | Fail job            |
| Build Time Regression | custom performance guard           | <+10% vs baseline                  | Warn → Fail if >10% |
| Test Time Regression  | performance guard                  | <+10%                              | Same as build       |
| Vulnerabilities       | osv-scanner (or cdxgen integrated) | 0 High/Critical unless whitelisted | Fail job            |
| Script Count          | lint script                        | ≤30 root scripts                   | Fail job            |
| SBOM Validity         | schema validate                    | pass                               | Fail job            |

## Minimal Tooling Policy

Add dependency ONLY if it:

1. Eliminates ≥3 duplicated patterns, OR
2. Replaces ≥2 heavier deps, OR

Planned additions (current justification):

- type-coverage (measurement)
- osv-scanner or cdxgen (security)  
  Potential (defer unless clear win): inquirer / chalk / ora (only if dx:help
  adoption blocked by plain text).

## Error & Logging Contract (Summary)

Structure (JSON line capable):

```ts
{
   level: 'info' | 'warn' | 'error' | 'debug',
   ts: ISO8601,
   msg: string,
   context?: Record<string, unknown>,
   err?: { name: string; message: string; stack?: string; code?: string },
   corr?: string  // correlation id
}
```

Redaction: never log secrets, tokens, PII; introduce `redact(keys:string[])`
helper.  
Error taxonomy: OperationalError (retryable flag), ValidationError,
ConfigurationError, SecurityError.

## Script Hygiene Strategy

1. Inventory (auto-generate JSON: name, category guess, keep/drop).
2. Apply naming prefixes.
3. Add `pnpm dx:help` (plain text first).
4. Mark deprecated scripts (warn) for 1 minor version then remove.

## Metrics & Baselines

File: `.quality-baseline.json`:

```json
{
  "buildTimeMs": 0,
  "testTimeMs": 0,
  "typeCoverage": 0,
  "lineCoverage": 0,
  "cacheHitRate": 0
}
```

Updated only via explicit `pnpm quality:record` command (guard prevents
accidental regression commit).

## Success Criteria Recap

| Goal           | Target            | Measured By             |
| -------------- | ----------------- | ----------------------- |
| Flow Start     | Single `pnpm dev` | manual + script check   |
| Warm Build     | <2s               | guard script timing     |
| Warm Tests     | <5s               | timing guard            |
| Type Coverage  | ≥95%              | type-coverage           |
| Line Coverage  | ≥85% (ratchet)    | coverage-ratchet script |
| Cache Hit (CI) | ≥85%              | turbo summary           |
| Script Count   | ≤30               | script lint             |
| Unsafe Any     | 0                 | ESLint rule             |
| High Vulns     | 0                 | scan report             |

## Risk Mitigation (Top 5)

| Risk                | Mitigation                                  |
| ------------------- | ------------------------------------------- |
| Timeline Slip       | Phased scope w/ Core vs Deferred list       |
| Over-engineering    | Dependency gate + minimal contract patterns |
| Perf Regression     | Baseline + guard thresholds                 |
| Security Noise      | Whitelist file for known acceptable CVEs    |
| Drift After Cleanup | CI gates + ownership map                    |

## Rollback Strategy (Granular)

Feature flags / toggles: `DX_LOGGING=off`, `DX_SCRIPT_HELP=off`.  
If regression: revert specific feature commit; baseline file unchanged until
healing commit passes gates.

## Next Concrete Actions (Execution Kickoff)

1. Capture baselines + write `.quality-baseline.json`.
2. Add type-coverage + eslint rule for unsafe any.
3. Implement SBOM + vuln scan (failing gate).
4. Generate script inventory + prune.
5. Add logging & error contract files + simple util usage in 1–2 scripts
   (pilot).
6. Add guard scripts (coverage, performance, vuln).

---

This lean revision intentionally trims abstraction and focuses on enforceable,
high-leverage changes that protect ADHD flow and template clarity.

<!-- Legacy detailed spec content below intentionally removed to keep lean revision authoritative. -->

<!-- START: Removed Legacy Section -->

### Enterprise Developer Story

As an **Enterprise Developer**, I want to work in a codebase with zero `any`
types and comprehensive error handling, so that I can maintain production-grade
code quality and catch issues at compile time rather than runtime.

Working in enterprise environments requires strict type safety and predictable
error handling. Currently, the codebase has multiple instances of `any` types
that undermine TypeScript's benefits, and inconsistent error handling patterns
that make debugging production issues challenging. After this cleanup, I'll have
confidence that the type system catches potential bugs before they reach
production, and errors are handled consistently with proper logging and recovery
strategies.

### ADHD Developer Story

As an **ADHD Developer**, I want a single-command development startup and
organized script discovery, so that I can maintain flow state without getting
overwhelmed by complex setup procedures or hunting through 94+ unorganized
scripts.

Context switching is cognitively expensive for developers with ADHD. The current
requirement for multiple terminal windows and manual service coordination breaks
flow state before coding even begins. With unified commands and organized
scripts, I can start coding within seconds and find the right command without
decision paralysis, maintaining focus on the actual development work.

### Security-Conscious Developer Story

As a **Security-Conscious Developer**, I want fully functional SBOM generation
and comprehensive vulnerability scanning, so that I can ensure supply chain
security compliance and track component vulnerabilities effectively.

Security compliance requires accurate Software Bill of Materials (SBOM)
generation, which is currently failing due to ESM/CommonJS compatibility issues.
This blocks our ability to track vulnerabilities in our dependency tree. After
remediation, we'll have complete visibility into our supply chain security
posture with automated scanning and baseline tracking.

<!-- END: Removed Legacy Section -->
