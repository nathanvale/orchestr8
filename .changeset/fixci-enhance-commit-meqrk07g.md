---
'@orchestr8/core': patch
'@orchestr8/logger': patch
'@orchestr8/schema': patch
---

fix(ci): enhance commit hook with error handling and safeguards

- Add comprehensive CI environment detection (CI, GITHUB_ACTIONS)
- Prevent recursion with SKIP_AUTO_CHANGESET guard
- Skip merge commits and release commits automatically
- Add file validation and graceful error handling
- Support --commit-msg-file parameter in auto-changeset script
- Fix undefined parsed.footer reference with proper extraction
- Ensure production-ready git hook robustness

Resolves CodeRabbit review feedback from PR #9.
