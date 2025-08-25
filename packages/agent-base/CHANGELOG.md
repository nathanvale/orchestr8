# @orchestr8/agent-base

## 0.2.1

### Patch Changes

- [#12](https://github.com/nathanvale/orchestr8/pull/12) [`6848811`](https://github.com/nathanvale/orchestr8/commit/68488117bb0ffcf0ea2490778747d613e26bffc9) Thanks [@nathanvale](https://github.com/nathanvale)! - fix: republish all packages with clean exports

  Remove development export conditions from all published packages to ensure
  external consumers receive clean, production-ready package.json files without
  development-specific export mappings that could cause module resolution issues.

  The prepublishOnly scripts automatically strip development exports during
  npm publishing while preserving them for fast local development workflow.

- Updated dependencies [[`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`e838447`](https://github.com/nathanvale/orchestr8/commit/e838447bae32d4efaac5f0742880d292d448eee8), [`6848811`](https://github.com/nathanvale/orchestr8/commit/68488117bb0ffcf0ea2490778747d613e26bffc9)]:
  - @orchestr8/schema@1.1.0

## 0.2.0

### Patch Changes

- Initial alpha release for agent base package

- Updated dependencies []:
  - @orchestr8/schema@1.0.0

## 0.1.1

### Patch Changes

- Updated dependencies []:
  - @orchestr8/schema@0.1.1
