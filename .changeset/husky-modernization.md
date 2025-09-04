---
'@template/utils': patch
---

feat: modernize Husky git hooks with ADHD-friendly enhancements

- Fix critical typo: pre-cdommit → pre-commit (hooks now work!)
- Replace all bun/bunx commands with pnpm equivalents
- Add ADHD-optimized progress indicators and helpful error messages
- Implement branch-aware changeset validation in pre-push hook
- Create comprehensive .gitmessage template with emoji guide
- Optimize lint-staged for better Turborepo integration
- Add emergency bypass instructions for all hooks
- Preserve full compatibility with Changesets and Commitizen workflows

This completes the Husky modernization with zero breaking changes.
