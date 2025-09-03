# Steps to Remove claude-hooks Package Completely

## Current Status (COMPLETED)

- ✅ Package excluded from pnpm workspace (`!packages/claude-hooks` in
  pnpm-workspace.yaml)
- ✅ Package excluded from lint-staged hooks (`.lintstagedrc.json`)
- ✅ Package still exists in filesystem for reference only
- ✅ No longer blocking build pipeline or pre-commit hooks

## Complete Removal Checklist

### 1. Remove Package Directory

```bash
rm -rf packages/claude-hooks
```

### 2. Clean up Dependencies

- Remove from root package.json if referenced
- Remove from any other package dependencies

### 3. Update Configuration Files

- [x] Already excluded from pnpm-workspace.yaml
- [ ] Remove any references in turbo.json (globalEnv: CLAUDE*HOOKS*\*)
- [ ] Remove from .changeset/config.json if listed

### 4. Clean up Git

```bash
git rm -r packages/claude-hooks
git commit -m "chore: remove claude-hooks package from monorepo"
```

### 5. Clean pnpm Store

```bash
pnpm store prune
pnpm install
```

### 6. Update Documentation

- Remove mentions from README.md
- Remove from any architecture diagrams
- Update CLAUDE.md if referenced

## Keeping as Reference Only

If you want to keep the code as reference without it being part of the build:

1. Move to a `.reference/` directory outside the monorepo structure
2. Add `.reference/` to .gitignore if you don't want it committed
3. Or keep it committed but outside the workspace structure

## Current Issues Being Avoided

- ESLint errors in claude-hooks blocking pre-push hooks
- Package-specific ESLint overrides needed for gradual migration
- Build pipeline complexity
