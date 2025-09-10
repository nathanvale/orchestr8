# Spec Requirements Document

> Spec: Fix-First Hooks Architecture  
> Created: 2025-09-09  
> Status: Planning

## Overview

Restructure the Claude Code hooks system from a check-then-fix architecture to a
fix-first architecture, eliminating noisy feedback loops and cluttered git
history. This change will reduce execution time by ~50%, eliminate 99%+ of
formatting noise in Claude feedback, and prevent separate "style:" commits by
applying auto-fixes immediately before validation.

## User Stories

### Developer Experience Optimization

As a developer using Claude Code, I want the hooks system to automatically fix
formatting and style issues without blocking my workflow, so that I only receive
feedback about actual logical errors that require my attention.

The current system checks files first, reports all issues (including
auto-fixable formatting), then applies fixes separately. This creates noise in
Claude's feedback and requires separate commits for style changes. The new
fix-first approach will silently fix formatting issues and only surface
unfixable problems.

### Clean Git History

As a developer, I want commits to contain properly formatted code from the
start, so that my git history shows only meaningful changes without separate
"style:" commits cluttering the timeline.

When hooks detect formatting issues, they should fix them immediately and
include the fixes in the same commit, rather than requiring follow-up style
commits.

### Performance Optimization

As a developer, I want hooks to run efficiently without duplicate tool
execution, so that the development feedback loop remains fast and responsive.

The current system runs ESLint and Prettier twice (check mode then fix mode),
doubling execution time. The fix-first approach eliminates this redundancy.

## Spec Scope

1. **QualityChecker Orchestration** - Restructure the main quality checking flow
   to fix-first mode
2. **Engine Integration** - Modify ESLint and Prettier engines to use built-in
   fix capabilities
3. **Fixer Adapter Simplification** - Remove external execSync calls and
   leverage engine fix modes
4. **Auto-staging Logic** - Automatically git add files after successful fixes
5. **Error Reporting Optimization** - Only report unfixable issues to reduce
   noise

## Out of Scope

- Changes to individual engine implementations (ESLint, Prettier, TypeScript)
- Modifications to the Autopilot decision rules
- Changes to hook entry points or git integration points
- New quality check engines or rules

## Expected Deliverable

1. Hooks system applies auto-fixes immediately and only reports unfixable issues
2. 50% reduction in hook execution time by eliminating duplicate tool runs
3. Clean git history with no separate formatting commits required

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-09-fix-first-hooks-architecture/tasks.md
- Technical Specification:
  @.agent-os/specs/2025-09-09-fix-first-hooks-architecture/sub-specs/technical-spec.md
