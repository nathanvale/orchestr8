---
created: 2025-09-18T07:32:12Z
last_updated: 2025-09-18T07:32:12Z
version: 1.0
author: Claude Code PM System
---

# Technical Context

## Runtime Requirements

- **Node.js:** >=20.0.0 (LTS)
- **pnpm:** >=9.0.0
- **npm:** >=10.0.0

## Core Technologies

### Language & Type System

- **TypeScript:** 5.7.3
  - Strict mode enabled
  - ESNext target
  - Node16 module resolution
  - Composite projects for monorepo

### Package Management

- **pnpm:** 9.x with workspaces
  - Efficient disk usage
  - Strict dependency resolution
  - Workspace protocol for internal packages

### Build System

- **Turborepo:** 2.5.6
  - Incremental builds
  - Intelligent caching
  - Parallel task execution
  - Dependency graph optimization
- **tsup:** For package building
  - ESM and CJS outputs
  - Type declarations
  - Tree shaking

## Testing Stack

### Test Framework

- **Vitest:** 3.2.4
  - Threads pool for performance
  - V8 coverage provider
  - 70% coverage thresholds
  - ADHD-optimized output modes

### Test Utilities

- **@testing-library/react:** 16.3.0
- **@testing-library/jest-dom:** 6.8.0
- **@testing-library/user-event:** 14.6.1
- **happy-dom:** 18.0.1 (for DOM testing)

### IDE Integration

- **Wallaby.js:** Configuration for real-time testing
  - Automatic test discovery
  - Inline coverage indicators
  - Immediate feedback

## Code Quality

### Linting

- **ESLint:** 9.34.0
  - Flat config format
  - TypeScript integration
  - React rules
  - Vitest plugin

### Formatting

- **Prettier:** 3.5.1
  - Consistent code style
  - Integrated with ESLint
  - Pre-commit hooks

### Type Checking

- **TypeScript:** Strict mode
  - No implicit any
  - Strict null checks
  - Strict function types

## Development Tools

### Version Control

- **Git:** With conventional commits
- **Husky:** 10.0.0 - Git hooks
- **lint-staged:** 16.0.2 - Pre-commit validation
- **Commitizen:** Interactive commit messages
- **Commitlint:** Enforce commit conventions

### Release Management

- **Changesets:** 2.28.0
  - Automated versioning
  - Changelog generation
  - Monorepo release coordination

### Developer Experience

- **Concurrently:** 10.0.1 - Parallel command execution
- **Chalk:** 6.0.1 - Terminal styling
- **Pino:** 10.0.1 - Structured logging
- **Simple-git:** 3.29.0 - Git operations

## Frontend Dependencies

- **React:** 19.1.1 (latest)
- **React-DOM:** 19.1.1
- Support for modern React features

## Performance Optimizations

### Memory Management

- NODE_OPTIONS: --max-old-space-size=4096
- Memory monitoring utilities
- Leak detection in tests

### Build Performance

- <8s warm builds target
- Turborepo caching
- Incremental TypeScript compilation

### Test Performance

- <3s focused test runs
- Parallel test execution with thread pool
- Silent mode for reduced I/O overhead

## Environment Variables

### Testing

- `VITEST_SILENT`: Enable quiet test output
- `VITEST_WATCH`: Control watch mode
- `DEBUG`: Enable verbose debugging
- `CI`: Continuous integration mode

### Development

- `NODE_ENV`: development/test/production
- `NODE_OPTIONS`: Node.js runtime flags

## Package Registry

- **npm Registry:** Default package source
- **GitHub Packages:** For private packages (if configured)

## CI/CD

- **GitHub Actions:** Automated workflows
  - Test on push/PR
  - Build validation
  - Release automation

## Monitoring & Logging

- **Pino:** Structured JSON logging
- Console suppression in tests
- Memory usage tracking
- Test execution metrics
