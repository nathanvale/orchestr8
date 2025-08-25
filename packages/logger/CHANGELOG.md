# @orchestr8/logger

## 2.0.0

### Major Changes

- [#9](https://github.com/nathanvale/orchestr8/pull/9) [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8) Thanks [@nathanvale](https://github.com/nathanvale)! - feat(logger): redesign logging API with structured format

  BREAKING CHANGE: Logger.log() now requires structured format instead of string

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

- [#12](https://github.com/nathanvale/orchestr8/pull/12) [`6848811`](https://github.com/nathanvale/orchestr8/commit/68488117bb0ffcf0ea2490778747d613e26bffc9) Thanks [@nathanvale](https://github.com/nathanvale)! - fix: republish all packages with clean exports

  Remove development export conditions from all published packages to ensure
  external consumers receive clean, production-ready package.json files without
  development-specific export mappings that could cause module resolution issues.

  The prepublishOnly scripts automatically strip development exports during
  npm publishing while preserving them for fast local development workflow.

## 1.0.0

### Patch Changes

- Initial NPM publication setup for logger package

## 1.0.0

### Major Changes

- Initial beta release of @orchestr8 foundational packages

  This release introduces the core foundation packages for the @orchestr8 agent orchestration platform:
  - **@orchestr8/schema**: Zod validation schemas for workflows, agents, and steps with full TypeScript support
  - **@orchestr8/logger**: Structured logging with correlation IDs and multiple adapter support
  - **@orchestr8/resilience**: Retry, circuit breaker, and timeout patterns with composition support

  All packages support dual ES module and CommonJS exports with complete TypeScript definitions.

  These packages are stable and ready for beta testing in production environments.
