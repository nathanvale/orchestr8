---
"@orchestr8/quality-check": major
"@orchestr8/testkit": major
"@orchestr8/voice-vault": major
---

BREAKING CHANGE: Migrate all packages to @orchestr8 scope

- Changed package scopes from @template/ and @claude-hooks/ to @orchestr8/
- Removed @template/utils package (utilities moved to app)
- Made @orchestr8/testkit publishable
- Added TSUP build system to @orchestr8/quality-check for consistency

Migration required for all consumers:
- Update all imports from `@template/*` to `@orchestr8/*`
- Update all imports from `@claude-hooks/*` to `@orchestr8/*`
- Remove dependencies on `@template/utils`