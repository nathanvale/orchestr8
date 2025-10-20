---
'@orchestr8/quality-check': patch
'@orchestr8/voice-vault': patch
'@orchestr8/testkit': patch
---

Fix validation issues across packages

- Add ESLint benchmark file overrides to prevent parsing errors
- Update voice-vault type references to match current type definitions
- Remove PostgreSQL container tests requiring Docker runtime
- Rebuild better-sqlite3 native module for current Node.js version
