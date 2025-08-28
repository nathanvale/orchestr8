# Spec Tasks

Spec: `@.agent-os/specs/2025-08-28-monorepo-package-structure/spec.md`  
Created: 2025-08-28  
Status: In Progress (Implementation ~60% Complete)

Legend:

- [x] Completed
- [ ] Not Started / In Progress
- Optional items marked with "(Optional)" suffix

## Phase 1 (Pre-Promotion) – Architecture & Validation

- [x] 1. Package Architecture Design
  - [x] 1.1 Technical specification (configuration examples, rationale)
  - [x] 1.2 File migration mapping captured
  - [x] 1.3 Hybrid TS references strategy (publishable-only) documented
  - [x] 1.4 Testability & measurability check

- [x] 2. Turborepo Tasks Configuration (pipeline → tasks)
  - [x] 2.1 Task dependency validation tests (typecheck → build → test)
  - [x] 2.2 `turbo.json` outputs + cache strategy defined
  - [x] 2.3 Global dependencies + `$TURBO_ROOT$` inputs enumerated
  - [x] 2.4 Cache performance target (>90% warm HIT) specified

- [ ] 3. Build System Documentation
  - [ ] 3.1 Tests for `tsc --build` incremental behavior (hybrid libs)
  - [x] 3.2 Shared tsconfig scaffolding (`base.json`, `library.json`)
  - [x] 3.3 Build flow & incremental compilation rationale (Option A) documented
  - [ ] 3.4 Output integrity (declaration presence) test harness

- [x] 4. Import Migration Strategy
  - [x] 4.1 AST transform tests (mapping + normalization)
  - [x] 4.2 Mapping table (relative → package subpaths) recorded
  - [x] 4.3 Normalization rules (strip extensions, `/index`) documented
  - [x] 4.4 Post-migration boundary verification (after files moved)

- [x] 5. Comprehensive Test Suite Expansion
  - [x] 5.1 Integration scenarios enumerated (tasks, dist, boundaries,
        changesets)
  - [x] 5.2 Performance tests (incremental rebuild delta timing) implementation
  - [x] 5.3 Changesets recognition scenario defined (publishable vs private)
  - [x] 5.4 Edge/failure case coverage (corrupt mapping, partial move) tests

- [ ] 6. Package Boundary Rules
  - [x] 6.1 Boundary success criteria + warning → enforce plan
  - [ ] 6.2 Formal rule matrix (allowed/denied dependencies) codified
  - [ ] 6.3 Positive examples + anti-pattern examples in guide (partial)
  - [ ] 6.4 Automated circular detection gate (madge snapshot in CI)

- [x] 7. Migration Validation Checklist
  - [x] 7.1 Checklist items outlined (build, types, imports, changesets, cache)
  - [x] 7.2 Metrics capture script (cache JSON parsing) implementation
  - [x] 7.3 Rollback section (restore + clean) hardened with scripted prototype
  - [x] 7.4 CI automation wiring (GitHub workflow integration)

- [ ] 8. Documentation Architecture
  - [x] 8.1 Technical + architecture guides updated with pivot
  - [ ] 8.2 Package README templates (core/utils/testing) generated post-split
  - [x] 8.3 Troubleshooting section (build, cache, boundaries) added
  - [ ] 8.4 Persona coverage audit (consumer vs contributor) pending

## Phase 2 (Promotion Script Execution) – Deferred Deliverables

- [x] P1. File moves & directory creation (`packages/*`, `apps/*`)
- [x] P2. Root `tsconfig` conversion to minimalist references file
- [x] P3. Root scripts switch to `turbo run` +
      `--continue=dependencies-successful`
- [x] P4. Changesets `ignore` & `fixed` arrays applied (names exist)
- [x] P5. Sidecar `with` adoption (only if server app included) - configured in
      turbo.jsonc
- [x] P6. Boundaries escalation from warn → error after green baseline
- [x] P7. Add optional remote cache environment variable docs to README
- [x] P8. Introduce `turbo.jsonc` (rename from turbo.json for comments)

## Optional / Non-Gating Enhancements

- [ ] O1. `turbo prune` sample workflow for lean artifacts (Optional)
- [ ] O2. Watch write-cache developer workflow snippet (Optional)
- [ ] O3. Performance benchmarking harness (hyperfine) & thresholds gate
      (Optional)
- [ ] O4. Boundaries snapshot drift report in nightly job (Optional)
- [ ] O5. AST migration dry-run reporter (no-op preview mode) (Optional)

## Completion Gates (All Must Be Green Before Promotion)

1. Warm build >90% HIT confirmed
2. No cross-package relative imports (grep + boundaries warn = 0 errors)
3. Publishable libs type declarations present
4. Changesets status lists only intended publishable packages
5. Dist tests pass with parity to source tests

## Risk Register (Tracked Until Resolved)

| Risk                            | Mitigation                              | Owner | Status |
| ------------------------------- | --------------------------------------- | ----- | ------ |
| Over-ref of internal apps       | Hybrid refs (publishable only)          | Arch  | Active |
| Premature sidecar complexity    | Defer until multi-service               | Arch  | Active |
| Cache flakiness on config moves | `$TURBO_ROOT$` inputs + narrow patterns | DevEx | Active |
| Boundary false positives early  | Warn mode first                         | QA    | Active |

## Change Log (Pivot Additions)

- Added tasks API migration items & `$TURBO_ROOT$` input work
- Introduced hybrid references gating concept
- Added boundaries phased adoption & prune optionality
- Split mandatory vs optional tasks for clarity

---

This task list reflects current 2025 best practices and clearly separates
immediate, deferred, and optional work streams to keep promotion low-risk and
incremental.
