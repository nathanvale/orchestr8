# Changesets

**Flow**

1. `pnpm release` → create a changeset (pick patch/minor/major).
2. Push → the Release workflow opens/updates a **Version Packages** PR.
3. Merge that PR → versions + changelogs update; if `"private": false` and
   `NPM_TOKEN` is set, publish occurs with npm provenance.

**Notes**

- Use Conventional Commits (`pnpm commit` / `git cz`).
- Monorepos are supported; list multiple packages in one changeset if needed.
