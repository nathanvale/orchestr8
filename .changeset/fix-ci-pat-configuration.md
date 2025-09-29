---
"@orchestr8/quality-check": patch
---

Configure PAT for automatic CI triggering on changeset release PRs

- Updated release workflow to use CHANGESET_GITHUB_TOKEN for checkout and changeset actions
- Added fallback to GITHUB_TOKEN for backwards compatibility
- Documented PAT setup requirements in workflow comments
- Marked changeset-pr-trigger workflow as temporary workaround

This ensures CI runs automatically on bot-created PRs when PAT is configured.