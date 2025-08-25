# @orchestr8/core

## 0.3.0

### Minor Changes

- [#9](https://github.com/nathanvale/orchestr8/pull/9) [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8) Thanks [@nathanvale](https://github.com/nathanvale)! - feat(ci): add commitlint for conventional commit validation

- [#9](https://github.com/nathanvale/orchestr8/pull/9) [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8) Thanks [@nathanvale](https://github.com/nathanvale)! - feat(ci): add commitlint validation with comprehensive rules and documentation

- [#9](https://github.com/nathanvale/orchestr8/pull/9) [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8) Thanks [@nathanvale](https://github.com/nathanvale)! - feat(ci): implement automatic changeset generation from conventional commits

### Patch Changes

- [#9](https://github.com/nathanvale/orchestr8/pull/9) [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8) Thanks [@nathanvale](https://github.com/nathanvale)! - fix(ci): enhance commit hook with error handling and safeguards
  - Add comprehensive CI environment detection (CI, GITHUB_ACTIONS)
  - Prevent recursion with SKIP_AUTO_CHANGESET guard
  - Skip merge commits and release commits automatically
  - Add file validation and graceful error handling
  - Support --commit-msg-file parameter in auto-changeset script
  - Fix undefined parsed.footer reference with proper extraction
  - Ensure production-ready git hook robustness

  Resolves CodeRabbit review feedback from PR #9.

- [#9](https://github.com/nathanvale/orchestr8/pull/9) [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8) Thanks [@nathanvale](https://github.com/nathanvale)! - fix(core): resolve test functionality issue

- [#12](https://github.com/nathanvale/orchestr8/pull/12) [`6848811`](https://github.com/nathanvale/orchestr8/commit/68488117bb0ffcf0ea2490778747d613e26bffc9) Thanks [@nathanvale](https://github.com/nathanvale)! - fix: republish all packages with clean exports

  Remove development export conditions from all published packages to ensure
  external consumers receive clean, production-ready package.json files without
  development-specific export mappings that could cause module resolution issues.

  The prepublishOnly scripts automatically strip development exports during
  npm publishing while preserving them for fast local development workflow.

- Updated dependencies [[`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`6848811`](https://github.com/nathanvale/orchestr8/commit/68488117bb0ffcf0ea2490778747d613e26bffc9)]:
  - @orchestr8/logger@2.0.0
  - @orchestr8/schema@1.1.0

## 0.2.0

### Patch Changes

- Initial alpha release for core orchestration package

- Updated dependencies []:
  - @orchestr8/logger@1.0.0
  - @orchestr8/schema@1.0.0

## 0.1.1

### Patch Changes

- Updated dependencies []:
  - @orchestr8/schema@0.1.1
