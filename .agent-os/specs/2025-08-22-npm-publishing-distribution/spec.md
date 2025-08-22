# Spec Requirements Document

> Spec: NPM Publishing & Distribution
> Created: 2025-08-22
> Status: Planning

## Overview

Implement a comprehensive NPM publishing system for the @orchestr8 monorepo with dual ES/CJS module support, automated releases via GitHub Actions, and proper versioning strategy using Changesets. This will enable community adoption and distribution of @orchestr8 packages while maintaining high quality standards and developer experience.

## User Stories

### Package Consumer (Developer)

As a developer using @orchestr8 packages, I want to install and use them in both ES module and CommonJS projects, so that I can integrate orchestration capabilities regardless of my project's module system.

**Workflow:**

1. Install @orchestr8 packages via `npm install @orchestr8/core`
2. Import using either `import` or `require()` syntax
3. Use TypeScript types seamlessly with full intellisense
4. Receive timely updates with clear changelogs

### Package Maintainer (Core Team)

As a core team member, I want automated package publishing with proper versioning, so that I can focus on development while ensuring reliable releases.

**Workflow:**

1. Create changesets for code changes
2. GitHub Actions automatically creates versioning PRs
3. Merge PR triggers automated publishing
4. Monitor release success and package adoption

### Early Adopter (Beta Tester)

As an early adopter, I want access to beta and alpha versions, so that I can test new features and provide feedback before stable releases.

**Workflow:**

1. Install pre-release versions using tags (`@orchestr8/core@beta`)
2. Test against my codebase
3. Report issues via GitHub
4. Upgrade to stable releases when available

## Spec Scope

1. **Changesets Configuration** - Set up automated versioning and changelog generation for monorepo
2. **Dual Module Export** - Configure all packages to export both ES modules and CommonJS formats
3. **GitHub Actions Automation** - Implement automated release workflow with changeset integration
4. **NPM Scope Setup** - Configure @orchestr8 NPM organization and publishing permissions
5. **Version Strategy Implementation** - Define beta RC vs alpha release tiers based on package maturity
6. **CI/CD Pipeline** - Build, test, and publish pipeline with proper quality gates

## Out of Scope

- Manual publishing processes (fully automated)
- Complex package splitting or restructuring
- Package marketplace/registry alternatives to NPM
- Paid/premium package tiers

## Expected Deliverable

1. **Working NPM Packages** - All 6 packages (@orchestr8/schema, @orchestr8/logger, @orchestr8/resilience, @orchestr8/core, @orchestr8/cli, @orchestr8/testing) published and installable from NPM
2. **Automated Release Process** - GitHub Actions workflow that handles versioning, building, and publishing
3. **Dual Module Support** - Packages work seamlessly in both ES module and CommonJS projects with full TypeScript support

## Spec Documentation

- Tasks: @.agent-os/specs/2025-08-22-npm-publishing-distribution/tasks.md
- Technical Specification: @.agent-os/specs/2025-08-22-npm-publishing-distribution/sub-specs/technical-spec.md
- CI/CD Specification: @.agent-os/specs/2025-08-22-npm-publishing-distribution/sub-specs/ci-cd-spec.md
- Publishing Strategy: @.agent-os/specs/2025-08-22-npm-publishing-distribution/sub-specs/publishing-strategy.md
- Tests Specification: @.agent-os/specs/2025-08-22-npm-publishing-distribution/sub-specs/tests.md
