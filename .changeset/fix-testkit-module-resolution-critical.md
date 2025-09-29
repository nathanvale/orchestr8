---
"@orchestr8/testkit": patch
---

Fix critical module resolution issues for vitest/vite environments

- Added missing "default" conditions to all package.json exports for broader compatibility with vite/vitest environments
- Added missing optional peer dependencies: `msw` and `happy-dom` are now properly declared as optional peer dependencies alongside existing optional deps
- Created lean main export that excludes optional dependencies, with full functionality preserved via sub-exports
- Resolves "Cannot find package" errors when importing sub-exports like `@orchestr8/testkit/utils`, `@orchestr8/testkit/msw`, etc.

This fix enables proper consumption of @orchestr8/testkit in modern JavaScript toolchains without requiring installation of optional dependencies.