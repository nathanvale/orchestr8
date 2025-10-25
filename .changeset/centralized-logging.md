---
"@orchestr8/quality-check": minor
---

feat: centralize logs to .logs/ directory at git root

**Problem:**
Log files were being created in multiple scattered locations throughout the monorepo:
- `./packages/quality-check/logs`
- `./apps/migration-cli/packages/quality-check/logs`  
- `./apps/portal/packages/quality-check/logs`

**Solution:**
All quality-check logs now write to a single, centralized `.logs/` directory:
- **Default:** `<git-root>/.logs/quality-check/{errors,debug}/`
- **Fallback:** `<cwd>/.logs/quality-check/{errors,debug}/` (if not in a git repo)

**Features:**
- ✨ Auto-detect git repository root for centralized logging
- 🔧 Environment variable support: `QUALITY_CHECK_LOG_DIR`
- 📝 Updated `.gitignore` to exclude `.logs/` directory
- 🧹 Cleaner monorepo workspace - no more scattered log directories

**Configuration Priority:**
1. Explicit `logDir` config option
2. `QUALITY_CHECK_LOG_DIR` environment variable  
3. Git root `.logs/` directory (auto-detected)
4. Current directory `.logs/` (fallback)

**Breaking Changes:**
None - backward compatible. Existing log directories will be ignored and new logs write to centralized location.
