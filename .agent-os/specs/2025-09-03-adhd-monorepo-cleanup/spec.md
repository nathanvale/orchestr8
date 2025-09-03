# Spec Requirements Document

> Spec: ADHD-Friendly Monorepo Cleanup & Standardization Created: 2025-09-03
> Status: Planning

## Overview

Transform the current complex Turborepo monorepo into an ADHD-optimized
development environment with standardized builds, minimal configuration, and
sub-5s feedback loops. Eliminate cognitive overhead through tsup
standardization, simplified Turborepo config, and automated release management.

## User Stories

### ADHD Developer Flow State Protection

As an ADHD developer, I want consistent build commands across all packages, so
that I don't experience decision paralysis or context switching when working on
different parts of the monorepo.

**Workflow:** Developer runs `pnpm build` in any package and gets identical
tsup-based output structure (dist/) with ESM modules. All packages follow the
same 4-command pattern: build, test, lint, typecheck.

### Instant Context Recovery

As a developer with ADHD, I want to understand the build status across all
packages in under 10 seconds, so that interruptions don't derail my
productivity.

**Workflow:** Developer runs `pnpm dx:status` and immediately sees which
packages built successfully, test coverage status, and any build failures with
clear next actions.

### Zero-Config Package Development

As a team member, I want new packages to follow the established patterns
automatically, so that I can focus on business logic instead of build
configuration.

**Workflow:** Developer creates new package, extends shared tsup config, and
immediately has working builds, tests, and releases without custom
configuration.

## Spec Scope

1. **Shared tsup Configuration** - Create tooling/build/tsup.base.ts with
   standardized ESM-only builds
2. **Turborepo Simplification** - Reduce turbo.json from 315 lines to ~20 lines
   with essential tasks only
3. **Package Script Standardization** - Normalize all packages to 4-command
   pattern (build/test/lint/typecheck)
4. **Changesets Integration** - Setup automated versioning and release
   management
5. **Commitizen Configuration** - Enforce conventional commits for release
   automation

## Out of Scope

- Migration from pnpm workspaces (keeping current dependency management)
- Changes to Next.js app build process (only package builds)
- VSCode configuration updates (focus on build system only)
- Docker containerization optimizations

## Expected Deliverable

1. All packages build to consistent dist/ folders with ESM modules
2. Single `pnpm build:all` command completes in <5s (warm cache)
3. turbo.json configuration reduced by >90% complexity
4. Automated release pipeline functional with conventional commits

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-03-adhd-monorepo-cleanup/tasks.md
- Technical Specification:
  @.agent-os/specs/2025-09-03-adhd-monorepo-cleanup/sub-specs/technical-spec.md
- Tests Specification:
  @.agent-os/specs/2025-09-03-adhd-monorepo-cleanup/sub-specs/tests.md
