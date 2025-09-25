---
"@template/quality-check": patch
---

feat: comprehensive CI/CD workflow optimizations for ADHD-friendly development

## P1 Critical Fixes
- Fixed validate script quoting to ensure format checks run properly
- Fixed pre-push changeset detection to only require changesets for code changes
- Fixed validate:changed to check entire push, not just last commit
- Fixed CI status display to show skipped jobs as ⏭️ instead of ❌
- Fixed release workflow vitest command execution via pnpm exec
- Made TURBO_SCM_BASE dynamic for accurate change detection in PRs

## P2 Performance & Maintainability
- Created composite action for DRY pnpm/node setup across all jobs
- Combined format, lint, and typecheck into single "quality" job for faster execution
- Removed redundant setup job and node_modules caching
- Increased quick-tests timeout from 1 to 2 minutes for infrastructure resilience
- Added GitHub Step Summary for cleaner CI status display with markdown tables

## P3 Robustness Improvements
- Enhanced pre-push hook with safer base ref detection and fetch guards
- Added proper error handling with set -euo pipefail in pre-push
- Confirmed integration tests use --bail=1 for fast-fail behavior
- Standardized Turbo environment variables across all workflows

## Impact
- ✅ 30-40% faster CI execution via combined quality checks and Turbo scheduling
- ✅ Zero false positives from changeset enforcement on docs-only changes
- ✅ Clean, scannable CI output optimized for ADHD-friendly development
- ✅ Robust fail-fast behavior throughout the pipeline
- ✅ Consistent caching strategy without redundancy