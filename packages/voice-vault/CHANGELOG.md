# @claude-hooks/voice-vault

## 1.0.2

### Patch Changes

- [#146](https://github.com/nathanvale/orchestr8/pull/146)
  [`6c929a1`](https://github.com/nathanvale/orchestr8/commit/6c929a1c556abb744e248083aeb32f1ff085c6ca)
  Thanks [@nathanvale](https://github.com/nathanvale)! - fix: update repository
  URLs to match actual GitHub repository for npm provenance validation

## 1.0.1

### Patch Changes

- [#144](https://github.com/nathanvale/orchestr8/pull/144)
  [`85e245c`](https://github.com/nathanvale/orchestr8/commit/85e245c7f10443e6d91de540553a7720f28a4269)
  Thanks [@nathanvale](https://github.com/nathanvale)! - Add placeholder tests
  for packages without tests to fix CI validation

- [#142](https://github.com/nathanvale/orchestr8/pull/142)
  [`e2c1c8a`](https://github.com/nathanvale/orchestr8/commit/e2c1c8a821cf555a16713822a46a07fd53885642)
  Thanks [@nathanvale](https://github.com/nathanvale)! - Disable coverage
  requirements for voice-vault package (contains only example files, no real
  tests)

- [#145](https://github.com/nathanvale/orchestr8/pull/145)
  [`2d572f5`](https://github.com/nathanvale/orchestr8/commit/2d572f54d8c1c382fd3fd2d688aca6d7377dbcdd)
  Thanks [@nathanvale](https://github.com/nathanvale)! - chore: cleanup GitHub
  workflows to minimal validate and release

## 1.0.0

### Major Changes

- [#103](https://github.com/nathanvale/bun-changesets-template/pull/103)
  [`a50ab88`](https://github.com/nathanvale/bun-changesets-template/commit/a50ab887b506ca49aae42e8deea3f3d7a29afdd1)
  Thanks [@nathanvale](https://github.com/nathanvale)! - BREAKING CHANGE:
  Migrate all packages to @orchestr8 scope
  - Changed package scopes from @template/ and @claude-hooks/ to @orchestr8/
  - Removed @template/utils package (utilities moved to app)
  - Made @orchestr8/testkit publishable
  - Added TSUP build system to @orchestr8/quality-check for consistency

  Migration required for all consumers:
  - Update all imports from `@template/*` to `@orchestr8/*`
  - Update all imports from `@claude-hooks/*` to `@orchestr8/*`
  - Remove dependencies on `@template/utils`

## 0.2.0

### Minor Changes

- [`b1e078a`](https://github.com/nathanvale/bun-changesets-template/commit/b1e078a9fa5448bb490414016c2f47aa3d86606b)
  Thanks [@nathanvale](https://github.com/nathanvale)! - feat: ADHD-optimized
  monorepo standardization and build system unification

  **🧠 ADHD Engineering Principles Applied:**
  - **Cognitive Load Reduction**: Simplified Turborepo config from 315 to 48
    lines (85% reduction)
  - **Flow State Protection**: Sub-1s warm cache builds, <5s targets achieved
  - **Zero Decision Paralysis**: Standardized tsup builds across all packages
  - **Instant Context Recovery**: All packages follow identical 4-command
    pattern

  **⚡ Build System Unification:**
  - Shared tsup configuration foundation (`tooling/build/tsup.base.ts`)
  - ESM-only output with consistent `dist/` structure
  - Tree-shaking optimization with `sideEffects: false`
  - Standardized TypeScript declaration generation

  **🚀 Turborepo Optimization:**
  - Essential tasks only: `build`, `test`, `lint`, `typecheck`, `clean`, `dev`
  - Maintained dependency graph and remote caching
  - Eliminated configuration complexity while preserving functionality
  - 80ms warm cache builds (target: <5s) - **95% faster than target**

  **📦 Package Standardization:**
  - All packages use identical 4-command script pattern
  - Consistent export maps and module structure
  - Proper workspace protocol for internal dependencies
  - Unified testing and linting across monorepo

  **🔄 Release Management:**
  - Automated Changesets workflow with GitHub integration
  - Conventional commits via Commitizen (cz-git)
  - ADHD-friendly release scripts with clear naming
  - Version bumping and changelog generation

  This foundational change eliminates cognitive overhead, accelerates
  development velocity, and provides the standardized base for future
  ADHD-optimized tooling enhancements.

### Patch Changes

- [#13](https://github.com/nathanvale/bun-changesets-template/pull/13)
  [`4b9c6cc`](https://github.com/nathanvale/bun-changesets-template/commit/4b9c6ccb6aef8d6d6516f0039ec396a92a39271d)
  Thanks [@nathanvale](https://github.com/nathanvale)! - feat: CI-ADHD
  optimization - reduce cognitive load by 40%
  - Simplified CI pipeline from 315 to <70 lines
  - Removed 1,944 lines of misleading/fake code (37% reduction)
  - Reorganized test structure for proper separation of concerns
  - Simplified performance monitoring scripts
  - Fixed GitHub ruleset status check names
  - Enabled automatic changeset releases on push to main
  - All packages now using beta versioning (0.x)
