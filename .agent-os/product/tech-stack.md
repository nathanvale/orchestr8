# Technical Stack

> Last Updated: 2025-01-27 Version: 1.1.1

## Core Technologies

### Application Framework

- **Framework:** Bun Runtime + TypeScript
- **Version:** Bun 1.1.38+, TypeScript 5.7+
- **Language:** TypeScript with strict configuration
- **Monorepo Support:** Built-in workspace architecture with seamless evolution
  capability

### Database

- **Primary:** Not applicable (this is a development template)
- **Version:** N/A
- **ORM:** N/A

## Frontend Stack

### JavaScript Framework

- **Framework:** Template supports any framework (React/Vue/Svelte)
- **Version:** Latest stable versions
- **Build Tool:** Bun (native bundler)

### Import Strategy

- **Strategy:** Node.js ES Modules
- **Package Manager:** Bun with workspace support
- **Node Version:** Not applicable (Bun runtime)
- **Monorepo Promotion:** Single-package to workspace migration via
  `bun run promote:monorepo` script

### CSS Framework

- **Framework:** Template agnostic (configurable)
- **Version:** Latest stable
- **PostCSS:** Supported via configuration

### UI Components

- **Library:** Template agnostic
- **Version:** Latest
- **Installation:** Via Bun package manager

## Assets & Media

### Fonts

- **Provider:** Template agnostic
- **Loading Strategy:** Configurable per implementation

### Icons

- **Library:** Template agnostic
- **Implementation:** Configurable per framework choice

## Monorepo Orchestration

### Build Orchestration

- **Tool:** Turborepo (integrated via `bun run promote:monorepo` script)
- **Caching:** Local and remote caching with Bun compatibility
- **Remote Cache:** Remote cache is optional; builds never fail if unset
  (warn-only)
- **Dependency Management:** Workspace-aware builds and testing
- **Architecture:** Packages/core, packages/utilities, packages/server structure

### Configuration Management

- **TypeScript:** Shared configurations under tooling/tsconfig/
- **ESLint/Prettier:** Workspace-aware configuration inheritance
- **Changesets:** Multi-package versioning and release coordination
- **Philosophy:** Opt-in complexity only when you need >1 package

## Development Tools

### Code Quality

- **Linter:** ESLint 9+ with TypeScript, Security, and SonarJS plugins
- **Formatter:** Prettier 3+ with plugin ecosystem
- **Type Checker:** TypeScript compiler with strict configuration
- **Commit Hooks:** Husky with lint-staged and commitlint

### Testing Framework

- **Test Runner:** Vitest (chosen over Bun test runner for richer ecosystem &
  tooling)
- **Environment:** happy-dom by default (opt-in jsdom via DOM_ENV=jsdom)
- **Coverage:** V8 coverage via @vitest/coverage-v8
- **E2E Testing:** Template supports adding Playwright separately
- **Mocking:** Vitest `vi` APIs + MSW for network; selective Bun module mocking

### Release Management

- **Versioning:** Changesets CLI 2.29+ with monorepo support
- **Changelog:** GitHub-integrated changelog generation (single-package and
  multi-package)
- **Publishing:** NPM with provenance support (workspace-aware)
- **Git Hooks:** Conventional commits with Commitizen
- **Monorepo Integration:** Automatic workspace detection and coordinated
  releases

## Infrastructure

### Application Hosting

- **Platform:** Template agnostic (supports all major platforms)
- **Service:** Configurable deployment targets
- **Region:** User-defined

### Database Hosting

- **Provider:** Not applicable (template project)
- **Service:** N/A
- **Backups:** N/A

### Asset Storage

- **Provider:** Template agnostic
- **CDN:** Configurable per implementation
- **Access:** User-defined security model

## Deployment

### CI/CD Pipeline

- **Platform:** GitHub Actions (with multi-platform support)
- **Trigger:** Push to main/staging, PR creation
- **Tests:** Multi-OS matrix testing (Linux, macOS, Windows)
- **Security:** Trivy scanning, dependency audit, SBOM generation
- **Monorepo Support:** Workspace-aware builds with Turborepo caching
  integration

### Package Registry

- **Registry:** NPM Registry
- **Authentication:** NPM tokens with OIDC support
- **Provenance:** npm provenance enabled for supply chain security
- **Distribution:** Public or private packages (configurable)
- **Workspace Publishing:** Coordinated multi-package releases with Changesets

### Environments

- **Development:** Local Bun runtime with hot reload
- **CI/CD:** GitHub Actions with Bun 1.1.38
- **Testing:** Multi-OS compatibility testing
- **Production:** User-defined deployment targets

## Performance Optimization

### Build Performance

- **Bundler:** Bun native bundler (3-5x faster than Webpack/Vite)
- **Hot Reload:** <50ms reload times
- **Cold Start:** <100ms startup
- **Memory Usage:** 50% lower than Node.js equivalents
- **Monorepo Scaling:** Turborepo caching for incremental builds across packages

### Runtime Performance

- **JavaScript Engine:** JavaScriptCore (Safari's V8 alternative)
- **Package Resolution:** Bun's optimized resolver
- **Module Loading:** Native ES Module support
- **Caching:** Aggressive caching with .bun directory

## Security & Compliance

### Supply Chain Security

- **Package Integrity:** npm provenance with OIDC signing
- **Vulnerability Scanning:** Trivy security scanner in CI
- **Dependency Auditing:** Bun audit + automated dependency updates
- **SBOM Generation:** CycloneDX SBOM for compliance

### Code Security

- **Static Analysis:** ESLint security plugin
- **Secret Detection:** Git hooks prevent secret commits
- **License Compliance:** Dependency license checking
- **Code Signing:** NPM package signing

## Monitoring & Analytics

### Development Metrics

- **Bundle Size:** Size-limit monitoring with PR comments
- **Performance:** Hyperfine benchmarking
- **Memory Usage:** Built-in memory profiling
- **Build Times:** CI/CD performance tracking

### Quality Metrics

- **Test Coverage:** 80% minimum coverage enforcement
- **Code Quality:** SonarJS complexity analysis
- **Type Safety:** Strict TypeScript with 100% coverage
- **Security Score:** Automated security scanning results
- **Coverage Requirements:** New packages must meet base thresholds immediately;
  no grace period for coverage requirements

### Usage Analytics (Optional)

- **Telemetry:** Opt-in usage analytics for promotion success tracking
- **Privacy:** Anonymous usage patterns only, no code/data collection
- **Purpose:** Measure monorepo promotion adoption rates and success metrics
- **Observability Hook:** Promotion script emits JSON report for analytics
  (future enhancement)
