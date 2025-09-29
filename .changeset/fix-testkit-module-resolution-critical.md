---
"@orchestr8/testkit": patch
---

Fix critical module resolution issues for vitest/vite environments

- Fixed conditional exports: All `vitest` and `development` conditions now correctly point to built files in `dist/` instead of source files in `src/`
- Added missing optional peer dependencies: `better-sqlite3`, `convex-test`, `testcontainers`, `mysql2`, and `pg` are now properly declared as optional peer dependencies
- Resolves "Cannot find package" errors when importing sub-exports like `@orchestr8/testkit/utils`, `@orchestr8/testkit/msw`, etc.

This fix enables proper consumption of @orchestr8/testkit in modern JavaScript toolchains (Vite, Vitest, pnpm workspaces).