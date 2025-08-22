# CI/CD Specification

This is the CI/CD specification for the spec detailed in @.agent-os/specs/2025-08-22-npm-publishing-distribution/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## GitHub Actions Workflow Architecture

### Release Workflow (.github/workflows/release.yml)

**Trigger:** Push to main branch with changeset files
**Purpose:** Automated version bumping and package publishing

```yaml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v4

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Run tests
        run: pnpm test:ci

      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm release:publish
          commit: 'chore: release packages'
          title: 'chore: release packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Pull Request Validation (.github/workflows/ci.yml)

**Trigger:** Pull request creation/update
**Purpose:** Validate changes and ensure changeset presence

```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js & pnpm
        # ... setup steps

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint & Format
        run: pnpm check

      - name: Build packages
        run: pnpm build

      - name: Run tests
        run: pnpm test:ci

      - name: Check for changeset
        run: pnpm changeset status --since=origin/main
```

## Secret Configuration

### Required GitHub Secrets

1. **NPM_TOKEN**
   - NPM automation token with publish permissions
   - Generated from npmjs.com user settings
   - Configured with @orchestr8 scope access

2. **GITHUB_TOKEN**
   - Automatically provided by GitHub Actions
   - Used for PR creation and repository operations
   - No additional configuration needed

### NPM Token Setup Process

1. Login to npmjs.com with @orchestr8 organization access
2. Navigate to User Settings > Access Tokens
3. Create new "Automation" token (bypasses 2FA)
4. Scope token to @orchestr8 organization
5. Add token to repository secrets as NPM_TOKEN

## Changeset Automation Workflow

### Developer Workflow

1. Make code changes
2. Run `pnpm changeset` to create changeset file
3. Commit changeset with code changes
4. Create pull request

### Automated Release Process

1. PR merged to main with changeset files
2. GitHub Action detects changesets
3. Action creates "Version Packages" PR with:
   - Updated package.json versions
   - Generated CHANGELOG.md files
   - Consumed changeset files
4. Maintainer reviews and merges version PR
5. Merge triggers automated publishing to NPM

### Pre-release Workflow

1. Enter pre-release mode: `pnpm changeset pre enter beta`
2. Create changesets normally
3. Version and publish create beta versions (1.0.0-beta.0)
4. Exit pre-release: `pnpm changeset pre exit`
5. Final version creates stable release (1.0.0)

## Quality Gates

### Pre-Publish Validation

- All tests passing (pnpm test:ci)
- Linting and formatting checks (pnpm check)
- TypeScript compilation successful
- Dual module build verification
- Package validation (pnpm validate:dual-consumption)

### Publish Conditions

- Only publish from main branch
- Only publish after version bump PR merge
- Require clean working directory
- Validate NPM token permissions before publish

## Error Handling

### Failed Publish Recovery

- GitHub Action creates issue with failure details
- Manual intervention required for token/permission issues
- Retry mechanism for transient NPM registry issues
- Rollback strategy documented in runbook

### Changeset Validation

- Block PRs without changesets (when code changes detected)
- Validate changeset format and content
- Ensure proper package selection in changesets
- Warn on missing changeset summaries
