---
'@orchestr8/quality-check': minor
---

Improve ESLint parser resilience with graceful degradation

Implements a 3-layer defense against TypeScript parser service failures:

1. **ESLint Config Hardening**: Add `warnOnUnsupportedTypeScriptVersion: false` to suppress version mismatch warnings that can cause parser initialization failures in monorepo environments

2. **Engine-Level Fallback**: Wrap ESLint instantiation in try-catch with cache-disabled retry for `fileExists` errors. If parser service fails with type-aware linting, retry without cache as fallback

3. **Enhanced Error Handling**: Downgrade parser service failures to warnings with actionable error messages suggesting:
   - Verify all tsconfig.json files are valid
   - Check for circular project references
   - Disable type-aware linting for specific files if needed

This ensures the quality-check pipeline continues functioning even when TypeScript parser initialization fails in edge cases, such as:
- Circular project references in monorepo
- TypeScript version mismatches
- Missing or invalid tsconfig.json files
- Complex monorepo configurations

Includes comprehensive tests verifying graceful degradation behavior and resource cleanup.
