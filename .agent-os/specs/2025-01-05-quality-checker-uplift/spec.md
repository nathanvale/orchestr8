# Spec Requirements Document

> Spec: Quality Checker Uplift Created: 2025-01-05

## Overview

Upgrade the Quality Checker to implement TypeScript 5.7+ file-scoped incremental
checks, ESLint v9 flat config support, and Prettier Node API integration for
sub-300ms warm feedback. This enhancement will maintain compatibility with
existing facade interfaces while delivering deterministic CI output through
stylish and JSON reporting modes.

## User Stories

### Local Developer Experience

As a developer, I want to run quality checks on individual files with sub-300ms
feedback, so that I can maintain code quality without disrupting my flow.

The developer runs `qc src/foo.ts` and receives immediate feedback about
TypeScript errors, ESLint violations, and Prettier formatting issues. The tool
uses incremental caching for TypeScript compilation, programmatic ESLint with
cache, and Prettier's Node API to achieve consistent sub-300ms warm performance.
Optional `--fix` flag automatically applies ESLint and Prettier fixes.

### CI/CD Pipeline Integration

As a DevOps engineer, I want machine-readable quality check output in CI
pipelines, so that I can gate deployments and generate actionable PR
annotations.

The CI pipeline runs `qc --since origin/main --format json` to check only
changed files. The tool outputs structured JSON with per-issue objects
containing tool, file, line, column, code, severity, and message fields. Exit
codes (0=ok, 1=issues, 2=internal error) enable proper pipeline gating.

### Pre-commit Hook Workflow

As a team lead, I want staged files automatically validated before commit, so
that code quality issues never reach the repository.

The pre-commit hook runs `qc --staged` to validate only staged files using the
same TypeScript incremental, ESLint, and Prettier engines. The check completes
in under 300ms for typical commits, preventing developer frustration while
maintaining code standards.

## Spec Scope

1. **TypeScript Engine** - Implement file-scoped incremental compilation using
   TS 5.7+ with persistent tsBuildInfo cache
2. **ESLint Integration** - Upgrade to ESLint v9 Node API with flat config
   support and built-in caching
3. **Prettier Engine** - Integrate Prettier Node API with resolveConfig() and
   getFileInfo() for ignore handling
4. **Output Formatters** - Develop stylish (human-readable) and JSON
   (CI-friendly) output modes
5. **Facade Compatibility** - Ensure seamless integration with existing CLI,
   hook, and API facades without breaking changes

## Out of Scope

- TypeScript project references or solution-wide builds
- Custom ESLint rule development or Prettier plugin creation
- IDE or editor plugin development
- Multi-root tsconfig.json hierarchies
- Breaking changes to existing facade interfaces

## Expected Deliverable

1. Quality Checker achieves median warm check time ≤300ms for individual files
   with full TypeScript, ESLint, and Prettier validation
2. JSON output mode provides structured data with tool, file, line, column,
   code, severity, and message fields for CI integration
3. All existing facade interfaces (CLI, hook, pre-commit, API) continue
   functioning without modification
