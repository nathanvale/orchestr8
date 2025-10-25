---
"@orchestr8/quality-check": patch
---

fix: use logs/ instead of .logs/ for centralized log directory

Changes the centralized log directory from `.logs/` to `logs/` at the git repository root.

- **Before:** `<git-root>/.logs/quality-check/{errors,debug}/`
- **After:** `<git-root>/logs/quality-check/{errors,debug}/`

The `logs/` directory is already covered by `.gitignore`.
