# GitHub Workflows

This repository uses two minimal workflows for continuous integration and deployment:

## CI Workflow (`ci.yml`)

Validates code quality on every PR and push to main/develop branches.

**Triggers:**
- Pull requests
- Push to `main` or `develop`
- Manual dispatch

**Jobs:**

### Validate
- **PRs**: Only validates packages affected by changes (using Turborepo filtering)
- **Push/Manual**: Validates all packages
- Runs: `build`, `lint`, `typecheck`, `test`

### Coverage (main branch only)
- Generates and uploads coverage reports
- Informational only - does not block PRs

## Release Workflow (`release.yml`)

Automates package versioning and publishing using Changesets.

**Triggers:**
- Push to `main`
- Manual dispatch

**Jobs:**

### Release
- Creates version PR (when changesets exist)
- Publishes to npm (when version PR is merged)
- Creates GitHub releases automatically
- Uses npm provenance for security

## Configuration

Both workflows use:
- Node.js 20.18.1
- pnpm 9.15.4
- Turborepo remote caching (if configured)
- Environment-aware memory limits (4GB)

## Setup Requirements

Required secrets:
- `NPM_TOKEN`: For publishing packages
- `TURBO_TOKEN`: (Optional) For remote caching
- `TURBO_TEAM`: (Optional) For remote caching
- `TURBO_REMOTE_CACHE_SIGNATURE_KEY`: (Optional) For remote caching

The `GITHUB_TOKEN` is automatically provided and used for creating PRs and releases.
