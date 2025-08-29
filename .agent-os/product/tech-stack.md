# Technical Stack

> Last Updated: 2025-01-23 Version: 2.0.0

## Core Technologies

### Application Framework

- **Framework:** Node.js + TypeScript
- **Version:** Node.js 20 LTS+, TypeScript 5.7+
- **Language:** TypeScript with strict configuration
- **Architecture:** Monorepo with Turborepo orchestration

### Database

- **Primary:** Not applicable (this is a development template)
- **Version:** N/A
- **ORM:** N/A

## Frontend Stack

### JavaScript Framework

- **Framework:** Next.js with React
- **Version:** Next.js 15+, React 19+
- **Build Tool:** Next.js built-in (Turbopack/Webpack)

### Import Strategy

- **Strategy:** Node.js ES Modules
- **Package Manager:** pnpm with workspace support
- **Node Version:** 20 LTS (Iron)
- **Package Structure:** Monorepo with packages/*, apps/* workspaces

### CSS Framework

- **Framework:** Template agnostic (Tailwind CSS recommended)
- **Version:** Latest stable
- **PostCSS:** Supported via Next.js configuration

### UI Components

- **Library:** Template agnostic
- **Version:** Latest
- **Installation:** Via pnpm package manager

## Assets & Media

### Fonts

- **Provider:** Next.js Font Optimization
- **Loading Strategy:** Automatic optimization with next/font

### Icons

- **Library:** Template agnostic (Lucide recommended)
- **Implementation:** React components

## Monorepo Orchestration

### Build Orchestration

- **Tool:** Turborepo 2.5+ (native monorepo configuration)
- **Version:** Latest 2.5+ with pnpm optimization
- **Caching:** Local and remote caching with pnpm compatibility
- **Remote Cache:** Free Vercel remote cache (since Dec 2024); builds never fail
  if unset (warn-only)
- **Dependency Management:** Workspace-aware builds and testing
- **Architecture:** Three focused packages:
  - `packages/utils`: Shared utilities with tsup builds
  - `apps/web`: Next.js application with App Router
  - `apps/server`: Node.js API service (Express/Fastify)

### Turborepo 2.5 Configuration

- **Schema Strategy:** Local reference (`./node_modules/turbo/schema.json`) for
  stability
- **Input Scoping:** Tight globs for package-specific source tracking
- **Build Resilience:** `--continue=dependencies-successful` for partial build
  progress
- **Configuration Format:** turbo.jsonc with inline documentation comments
- **Container Optimization:** `turbo prune` support for pnpm Docker builds
- **Watch Mode:** Experimental write cache for faster iterative development
- **Sidecar Tasks:** `"with"` field for coupled long-running processes
- **Boundaries:** Cross-package import validation and enforcement
- **Performance Targets:** >90% cache hit rate through optimized inputs

### Configuration Management

- **TypeScript:** Shared configurations under tooling/tsconfig/
- **ESLint/Prettier:** Workspace-aware configuration inheritance
- **Changesets:** Multi-package versioning and release coordination
- **Philosophy:** Monorepo-first with simple, focused packages for clarity

## Development Tools

### Code Quality

- **Linter:** ESLint 9+ with TypeScript, Security, and SonarJS plugins
- **Formatter:** Prettier 3+ with plugin ecosystem
- **Type Checker:** TypeScript compiler with strict configuration
- **Commit Hooks:** Husky with lint-staged and commitlint

### Testing Framework

- **Test Runner:** Vitest with Node.js
- **Environment:** jsdom for React component testing
- **Coverage:** V8 coverage via @vitest/coverage-v8
- **E2E Testing:** Template supports adding Playwright separately
- **Mocking:** Vitest `vi` APIs + MSW for network mocking
- **Test Structure:**
  - Unit tests in `packages/utils`
  - Integration tests in `apps/web` with MSW handlers
  - Server API tests in `apps/server`

### Package Build System

- **Build Tool:** tsup for all packages
- **Configuration:** Standardized across all packages
- **Output:** ESM format with source maps
- **Type Generation:** Separate TypeScript compilation for .d.ts files
- **Entry Points:** Multiple entry points with code splitting

### Release Management

- **Versioning:** Changesets CLI 2.29+ with monorepo support
- **Changelog:** GitHub-integrated changelog generation
- **Publishing:** NPM with provenance support (workspace-aware)
- **Git Hooks:** Conventional commits with Commitizen
- **Monorepo Integration:** Automatic workspace detection and coordinated
  releases

## Infrastructure

### Application Hosting

- **Platform:** Vercel (optimized for Next.js)
- **Service:** Edge Functions and Serverless
- **Region:** Global edge network

### Database Hosting

- **Provider:** Not applicable (template project)
- **Service:** N/A
- **Backups:** N/A

### Asset Storage

- **Provider:** Vercel CDN for Next.js
- **CDN:** Built-in with Next.js deployment
- **Access:** Automatic optimization

## Deployment

### CI/CD Pipeline

- **Platform:** GitHub Actions with pnpm caching
- **Trigger:** Push to main/staging, PR creation
- **Tests:** Multi-OS matrix testing (Linux, macOS, Windows)
- **Security:** npm audit, dependency updates, SBOM generation
- **Monorepo Support:** Workspace-aware builds with Turborepo and pnpm cache

### Package Registry

- **Registry:** NPM Registry
- **Authentication:** NPM tokens with OIDC support
- **Provenance:** npm provenance enabled for supply chain security
- **Distribution:** Public or private packages (configurable)
- **Workspace Publishing:** Coordinated multi-package releases with Changesets

### Environments

- **Development:** Local Node.js with Next.js Fast Refresh
- **CI/CD:** GitHub Actions with Node.js 20 LTS
- **Testing:** Multi-OS compatibility testing
- **Production:** Vercel deployment with edge optimization

## Performance Optimization

### Build Performance

- **Bundler:** tsup for packages, Next.js bundler for app
- **Hot Reload:** Next.js Fast Refresh
- **Package Builds:** Parallel builds via Turborepo
- **Caching:** Aggressive pnpm and Turborepo caching

### Runtime Performance

- **JavaScript Engine:** V8 (Node.js)
- **Package Resolution:** pnpm's efficient linking
- **Module Loading:** ES Module support
- **Caching:** pnpm store and Turborepo cache

## Security & Compliance

### Supply Chain Security

- **Package Integrity:** npm provenance with OIDC signing
- **Vulnerability Scanning:** npm audit in CI
- **Dependency Auditing:** pnpm audit + automated dependency updates
- **SBOM Generation:** CycloneDX SBOM for compliance

### Code Security

- **Static Analysis:** ESLint security plugin
- **Secret Detection:** Git hooks prevent secret commits
- **License Compliance:** Dependency license checking
- **Code Signing:** NPM package signing

## Monitoring & Analytics

### Development Metrics

- **Bundle Size:** Next.js bundle analyzer
- **Performance:** Core Web Vitals monitoring
- **Build Times:** CI/CD performance tracking
- **Cache Hit Rate:** Turborepo analytics

### Quality Metrics

- **Test Coverage:** 80% minimum coverage enforcement
- **Code Quality:** SonarJS complexity analysis
- **Type Safety:** Strict TypeScript with 100% coverage
- **Security Score:** Automated security scanning results

### Usage Analytics (Optional)

- **Telemetry:** Next.js telemetry (opt-in)
- **Privacy:** Anonymous usage patterns only
- **Purpose:** Measure performance and adoption
- **Observability:** Vercel Analytics integration