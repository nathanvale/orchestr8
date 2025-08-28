# Spec Requirements Document

> Spec: Monorepo Package Structure Design  
> Created: 2025-08-28  
> Status: In Progress (~60% Complete)

## Overview

Design and document a comprehensive monorepo package structure that enables
seamless evolution from single-package to multi-package architecture using Bun
workspaces, Turborepo orchestration, and Changesets for coordinated releases.

### 2025 Pivot Addendum (Turbo 2.4 / 2.5)

Recent Turborepo releases (2.4 & 2.5) introduce new ergonomics & safety
features. This spec is **pivoted** to explicitly incorporate and/or rationalize
adoption of:

| Feature                              | Spec Stance                                                                           | Rationale                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `with` (Sidecar tasks)               | Adopt when an app requires a long‑running dependency (deferred until such app exists) | Avoid manual filter complexity for coupled dev processes      |
| `--continue=dependencies-successful` | Adopt in CI recommended profile                                                       | Surfaces unrelated successes while preventing cascading noise |
| `turbo.jsonc` + comments             | Planned (convert during promotion)                                                    | Improves maintainability & onboarding clarity                 |
| `$TURBO_ROOT$` microsyntax           | Adopt for shared root config inputs                                                   | Stable path hashing & resilience to directory moves           |
| Boundaries (experimental)            | Add optional validation step (non-blocking initially)                                 | Early detection of unsafe imports & undeclared deps           |
| Watch Mode caching (experimental)    | Document optional usage; not required for baseline                                    | Speed iterative dev loops; gated until stable                 |
| Bun `turbo prune` support            | Add deployment pathway section                                                        | Enables slim production images / partial clones               |
| Remote cache (now free)              | Encourage default linking when repo public/private on Vercel                          | Faster CI & shared artifact reuse                             |
| Hybrid TS project references         | Adopt selective (publishable libs only)                                               | Reduces complexity for internal-only packages                 |

The remainder of the spec folds these decisions into technical & test sections.

## User Stories

### Package Architecture Designer

As a template maintainer, I want to design a clear package structure, so that
the promotion script has an unambiguous target architecture to implement.

The design must define exact package boundaries, dependencies, and build
pipelines. It should specify which current source files move to which packages,
how imports will be rewritten, and what new functionality will be added to
demonstrate the monorepo capabilities. The structure must support both
publishable libraries and private applications while maintaining the template's
ADHD-friendly philosophy of opt-in complexity.

### Developer Experience Architect

As a developer using the template, I want a well-organized monorepo structure,
so that I can easily understand package responsibilities and add new packages as
my project grows.

The monorepo should have clear separation between core functionality, utils, and
applications. Each package should have a single, well-defined purpose. The
structure should make it obvious where new code belongs and how packages can
depend on each other without creating circular dependencies.

### CI/CD Pipeline Engineer

As a DevOps engineer, I want a monorepo structure optimized for build caching
and parallel execution, so that CI/CD pipelines run efficiently even as the
codebase grows.

The structure must work seamlessly with Turborepo's caching mechanisms, define
explicit build outputs, and support incremental builds through TypeScript
project references. The design should minimize unnecessary rebuilds and maximize
cache hit rates.

## Spec Scope

1. **Package Boundaries Definition** - Clear delineation of what belongs in
   core, utils, testing, and server packages
2. **TypeScript Project References Architecture** - Complete configuration for
   incremental builds across packages
3. **Turborepo Tasks Configuration** - Task orchestration with proper
   dependencies and caching strategies
4. **Build System Design** - Unified approach using TypeScript compilation with
   explicit output management
5. **Import Migration Strategy** - AST-based transformation rules for updating
   cross-package imports

## Out of Scope

- Actual implementation of the promote:monorepo script
- Migration of existing code files
- CI/CD workflow modifications
- Deployment configurations
- Framework-specific integrations (React, Vue, etc.)

## Expected Deliverable

1. Complete package structure with all configuration files documented
2. Migration mapping showing exactly which files move where
3. Validation checklist that can verify successful structure implementation
4. Pivot appendix capturing rationale & adoption status of 2025 Turborepo
   features

## Spec Documentation

- **Tasks:** @.agent-os/specs/2025-08-28-monorepo-package-structure/tasks.md
- **Technical Specification:**
  @.agent-os/specs/2025-08-28-monorepo-package-structure/sub-specs/technical-spec.md
- **Tests Specification:**
  @.agent-os/specs/2025-08-28-monorepo-package-structure/sub-specs/tests.md
- **Architecture Guide:**
  @.agent-os/specs/2025-08-28-monorepo-package-structure/sub-specs/monorepo-architecture-guide.md
- **Database Schema:** Not applicable for this spec
- **API Specification:** Not applicable for this spec

---

### Pivot Tracking Metadata

| Capability     | Adoption Phase           | Trigger for Full Enablement                                       |
| -------------- | ------------------------ | ----------------------------------------------------------------- |
| Sidecar `with` | Deferred                 | Introduction of multi-service dev (e.g. `apps/server`)            |
| Boundaries     | Optional (warn)          | Stabilize rule set & zero false positives for 2 consecutive weeks |
| `$TURBO_ROOT$` | Immediate                | Convert inputs list at promotion                                  |
| `turbo.jsonc`  | At promotion             | Script writes commented config replacing `turbo.json`             |
| Watch cache    | Optional                 | Developer opt-in flag `RUN_TURBO_WATCH_CACHE=1`                   |
| Prune (Bun)    | Optional deployment step | Containerization or partial clone requirement                     |
| Remote cache   | Recommended default      | Repo linked to Vercel project                                     |
| Hybrid TS refs | Immediate                | Only publishable libs (`core`,`utils`) keep composite refs        |
