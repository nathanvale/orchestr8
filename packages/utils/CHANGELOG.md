# @template/utils

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

- [`cbf5d7e`](https://github.com/nathanvale/bun-changesets-template/commit/cbf5d7ee30e4b81a4bf2abdbd7ea0451b38910d8)
  Thanks [@nathanvale](https://github.com/nathanvale)! - feat: modernize Husky
  git hooks with ADHD-friendly enhancements
  - Fix critical typo: pre-cdommit → pre-commit (hooks now work!)
  - Replace all bun/bunx commands with pnpm equivalents
  - Add ADHD-optimized progress indicators and helpful error messages
  - Implement branch-aware changeset validation in pre-push hook
  - Create comprehensive .gitmessage template with emoji guide
  - Optimize lint-staged for better Turborepo integration
  - Add emergency bypass instructions for all hooks
  - Preserve full compatibility with Changesets and Commitizen workflows

  This completes the Husky modernization with zero breaking changes.
