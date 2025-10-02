---
"@orchestr8/testkit": patch
---

Fix ES module compatibility issues

- Fixed directory imports in utils/index.ts - now uses explicit .js extensions for security and resources imports
- Added missing export for msw/handlers module in package.json
- Improved FileDatabase type export to prevent "is not a constructor" errors
