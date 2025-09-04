# Dependency Management - Preventing Version Conflicts

## How to Prevent Version Mismatches in Future

### 1. **Use Workspace Dependencies**
```json
// In package.json of individual packages
{
  "devDependencies": {
    "vitest": "workspace:*"
  }
}
```
This ensures all packages use the same version as the root workspace.

### 2. **Root-Level Tool Dependencies**
Add testing tools to the root `package.json` instead of individual packages:

```json
// Root package.json
{
  "devDependencies": {
    "vitest": "^3.2.4",
    "@vitest/coverage-v8": "^3.2.4",
    "@vitest/ui": "^3.2.4"
  }
}
```

### 3. **Regular Dependency Audits**
Add these scripts to root `package.json`:

```json
{
  "scripts": {
    "audit:deps": "pnpm list --depth=0 | grep -E '(vitest|@vitest)'",
    "audit:conflicts": "pnpm list vitest",
    "sync:deps": "pnpm update vitest @vitest/coverage-v8 @vitest/ui"
  }
}
```

### 4. **Pre-commit Checks**
Add dependency version check to your workflow:

```bash
#!/bin/bash
# Check for Vitest version mismatches
ROOT_VERSION=$(pnpm list vitest --depth=0 --parseable | grep vitest | cut -d@ -f3)
PACKAGE_VERSIONS=$(find packages -name "package.json" -exec grep -l "vitest" {} \; -exec pnpm list vitest --depth=0 {} \;)

if [ "$ROOT_VERSION" != "$PACKAGE_VERSION" ]; then
  echo "⚠️  Vitest version mismatch detected!"
  echo "Run: pnpm run sync:deps"
  exit 1
fi
```

### 5. **pnpm Workspace Configuration**
Ensure your root `package.json` has:

```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

And use pnpm's workspace protocol for shared dependencies.

## Quick Fixes for Common Issues

### Version Mismatch Detected
```bash
# 1. Check all versions
pnpm list vitest

# 2. Update all packages to match root
pnpm -r update vitest @vitest/coverage-v8

# 3. Or force specific version
pnpm -r add -D vitest@^3.2.4
```

### Wallaby Not Working
```bash
# 1. First check versions are aligned
pnpm list vitest

# 2. If mismatched, sync them
pnpm run sync:deps

# 3. Restart Wallaby completely
```

### Adding New Packages
When creating new packages, use workspace dependencies:

```json
{
  "devDependencies": {
    "vitest": "workspace:*",
    "@vitest/coverage-v8": "workspace:*"
  }
}
```

## Monitoring Commands

```bash
# Check for all dependency conflicts
pnpm ls --depth=0 | grep -i warn

# Audit specific tools
pnpm list vitest @vitest/coverage-v8 @vitest/ui

# Update all workspace dependencies
pnpm -r update

# Fix specific version mismatches
pnpm -r exec pnpm add -D vitest@^3.2.4
```

## Why This Matters

**Wallaby.js Issues**: Version mismatches are the #1 cause of "Wallaby did not detect that any vitest tasks were executed" errors.

**Performance**: Consistent versions ensure optimal caching and faster builds.

**Reliability**: Prevents subtle test behavior differences between packages.

**ADHD-Friendly**: Eliminates debugging time spent on version conflicts.

---

By following these practices, you'll avoid the version mismatch issues that caused today's Wallaby problems.