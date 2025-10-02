---
"@orchestr8/testkit": patch
---

Fix critical ESM module resolution issues

Fixed ERR_MODULE_NOT_FOUND errors by adding missing .js extensions to relative imports in TypeScript source files. This resolves build issues where certain JavaScript files were not being generated correctly when using tsup with bundle: false for ESM builds.

**Changes:**
- Added .js extensions to utils/concurrency and object-pool imports
- Added .js extension to msw/handlers import

**Impact:**
- dist/utils/concurrency.js now generates correctly
- dist/utils/object-pool.js now generates correctly
- dist/msw/handlers.js now generates correctly

All 1359 tests pass.
