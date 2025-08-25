# Bun + Changesets + Commitizen Template

This template gives you:
- Bun everywhere (scripts/tests/builds)
- Conventional Commits via Commitizen (`git cz`)
- Commitlint in hooks & CI
- Changesets for versioning + automated Release PR
- GitHub Actions for CI + Release (with npm provenance)

## Quick Start

```bash
# install toolchain
bun add -d changesets commitizen cz-git commitlint @commitlint/config-conventional @changesets/changelog-github husky lint-staged

# init husky
bunx husky init

# init changesets
bunx changeset init
```

## Dev Flow
1. `bun run commit`
2. `bun run release`
3. Push → CI runs, Release PR opens
4. Merge PR → versions & changelog updated (and publish if not private)
