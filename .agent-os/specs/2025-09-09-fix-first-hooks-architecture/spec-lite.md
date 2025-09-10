# Fix-First Hooks Architecture - Lite Summary

Restructure Claude Code hooks from check-then-fix to fix-first architecture,
eliminating noisy feedback loops and cluttered git history. Auto-fix formatting
issues immediately, then only report unfixable problems, reducing execution time
by 50% and eliminating 99%+ of formatting noise in Claude feedback.

## Key Points

- Fix-first flow: Apply auto-fixes immediately before validation instead of
  after
- Performance gain: Eliminate duplicate ESLint/Prettier execution (50% time
  reduction)
- Clean git history: No separate "style:" commits needed, fixes included in
  feature commits
