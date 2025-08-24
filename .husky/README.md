# Git Hooks Configuration

This directory contains Git hooks configured with Husky for the @orchestr8 monorepo.

## Hooks Overview

### Pre-commit Hook

- **Purpose**: Automatically format and fix code issues before commits
- **Scope**: Only processes staged files (fast execution)
- **Actions**:
  1. Runs Prettier to format code
  2. Runs ESLint with `--fix` to auto-fix issues
  3. Re-stages fixed files automatically
  4. Fails if there are unfixable ESLint errors

### Pre-push Hook

- **Purpose**: Comprehensive validation before pushing to remote
- **Scope**: Only runs on feature branches (skips main/master)
- **Actions**:
  1. Runs full `pnpm check` command
  2. Includes format check, lint, type-check, and tests
  3. Uses Turborepo caching for performance
  4. Can be bypassed with `--no-verify` if needed

## Developer Workflow

### Normal Workflow

```bash
# Make changes
git add .
git commit -m "feat: add new feature"  # Pre-commit runs automatically
git push                               # Pre-push runs comprehensive checks
```

### Bypass Hooks (Emergency Only)

```bash
git commit --no-verify -m "emergency fix"
git push --no-verify
```

## Troubleshooting

### Pre-commit Hook Issues

#### Issue: "prettier command not found"

**Solution**: Ensure dependencies are installed

```bash
pnpm install
```

#### Issue: ESLint errors that can't be auto-fixed

**Solution**: Fix the errors manually, then commit again

```bash
# See specific errors
pnpm lint

# Fix in specific package
cd packages/core
pnpm lint:fix

# Or fix across all packages
pnpm lint:fix
```

#### Issue: Hook runs on too many files (slow)

**Cause**: You may have staged more files than intended
**Solution**: Check staged files and unstage unnecessary ones

```bash
git status
git reset HEAD <file>  # Unstage specific file
```

### Pre-push Hook Issues

#### Issue: Pre-push takes too long

**Solution**: Pre-push only runs on feature branches. On main/master, it's skipped.

```bash
# Check current branch
git branch --show-current

# If on feature branch, the full check is intentional
# Use Turborepo caching to speed up subsequent runs
```

#### Issue: Tests fail in pre-push

**Solution**: Fix the tests before pushing

```bash
# Run tests manually
pnpm test

# Run tests for specific package
cd packages/core && pnpm test

# Use Wallaby.js for faster feedback during development
```

### General Issues

#### Issue: Hooks not running at all

**Solution**: Reinstall Husky hooks

```bash
pnpm run setup:hooks
```

#### Issue: Permission denied on hook files

**Solution**: Make hooks executable

```bash
chmod +x .husky/pre-commit .husky/pre-push
```

#### Issue: Hooks running on CI/CD

**Cause**: CI environments should not run Git hooks
**Solution**: Hooks automatically detect CI environment and exit early

## Configuration Files

- `.husky/pre-commit` - Pre-commit hook script
- `.husky/pre-push` - Pre-push hook script
- `package.json` - lint-staged configuration
- `turbo.json` - Turborepo task configuration

## Performance Optimization

The hooks are optimized for performance:

1. **Pre-commit**: Only processes staged files
2. **ESLint caching**: Uses `--cache` flag for faster subsequent runs
3. **Turborepo caching**: Reuses build/test results when possible
4. **Package-aware**: Commands run in appropriate package context
5. **Parallel execution**: lint-staged runs commands in parallel where safe

## Emergency Procedures

### Completely Disable Hooks

```bash
# Temporary disable
export HUSKY=0

# Permanent disable (not recommended)
rm -rf .husky
```

### Reset Hook Configuration

```bash
# Reinstall from scratch
rm -rf .husky
pnpm run setup:hooks
```

### Skip Pre-push for Urgent Fixes

```bash
# Only for emergencies - CI will still validate
git push --no-verify
```

## Best Practices

1. **Don't bypass hooks unnecessarily** - They catch issues before CI
2. **Use Wallaby.js during development** - Faster than waiting for pre-push tests
3. **Stage only related files** - Faster pre-commit execution
4. **Run `pnpm check` before pushing** - Avoid pre-push failures
5. **Keep commits small** - Faster hook execution

## Support

If you encounter issues not covered here:

1. Check if the issue exists in CI as well
2. Try running the commands manually
3. Ensure all dependencies are up to date
4. Consider if the issue is with your changes or the hook configuration
