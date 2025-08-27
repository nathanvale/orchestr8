# Product Roadmap

> Last Updated: 2025-08-28 Version: 4.0.0 Status: Active Development - Monorepo
> Pivot Roadmap version tracks planning iteration, not semver

## Phase 0: Already Completed (Foundation Established)

### Core Infrastructure

- [x] Bun runtime configuration with native bundler
- [x] ESLint 9+ setup with strict type rules, Security, and SonarJS plugins
- [x] Changesets configuration with npm provenance support
- [x] Vitest testing infrastructure (chosen over Bun test for ecosystem)
- [x] Multi-OS CI/CD pipeline (Linux, macOS, Windows)
- [x] Security scanning baseline (Trivy with SBOM generation)
- [x] Comprehensive git hooks (Husky, lint-staged, commitlint)
- [x] ADHD-friendly script consolidation (200+ development scripts)
- [x] Single-threaded Vitest workaround for Bun stability

### Build & Packaging

- [x] Dual build pipeline (Bun vs Node) with exports mapping
- [x] Type validation script with defensive path guards
- [x] Prepublish guard script for library publishing
- [x] Complete type generation for all build targets
- [x] SideEffects: false + explicit files export for tree-shaking
- [x] Bundle size tracking with size-limit

### Testing & Quality

- [x] MSW integration with handlers and setup
- [x] Extensive numeric + path utility test coverage (edge cases)
- [x] React Testing Library utilities standardization
- [x] Contract tests for critical behaviors (shouldAutoStart, MSW logging)
- [x] Dynamic Bun import failure path test
- [x] Removed broad console warning/error spies
- [x] Cross-platform path handling implementation

### Documentation & DX

- [x] SECURITY.md with disclosure process
- [x] CODEOWNERS file for review gates
- [x] CONTRIBUTING.md with detailed guidelines
- [x] First 15 Minutes onboarding documentation
- [x] .editorconfig for consistent formatting
- [x] Extensive inline "Why" comments (ADHD-friendly)
- [x] dev:test script for low-noise watch mode
- [x] Emoji anchors in spec sections for faster scanning
- [x] Short comments in config files to prevent over-optimization

### Configuration Fixes

- [x] Unified commitlint configuration (removed duplicates)
- [x] Fixed release workflow test execution (bun run test:ci)
- [x] Corrected CI build steps (bun run build:all)
- [x] Updated Vitest config coverage exclusions
- [x] MSW pagination handler guard against limit=0/NaN

## Phase 1: Monorepo Evolution Foundation (P0 - PRIORITY PIVOT) (1 week)

**Goal:** Enable seamless single-package → monorepo promotion with Turborepo +
Bun + Changesets **Success Criteria:**

- `bun run promote:monorepo` re-run exits 0 with "already promoted" message
- Post-promotion: lint, typecheck, build, test all pass
- Turborepo second build run shows ≥1 cache hit
- Changesets recognizes ≥2 publishable packages (core, utilities) and ignores
  private server if present
- Git status clean after script (no stray temp files)

### Core Monorepo Infrastructure

- [ ] Design target package structure (packages/core, packages/utilities,
      packages/server) - `M`
- [ ] Implement Turborepo pipeline configuration (`turbo.json`) - `M`
- [ ] Create shared TypeScript configurations under `tooling/tsconfig/` - `S`
- [ ] Update Vitest config for monorepo glob patterns
      (`packages/*/src/**/*.test.ts`) - `S`

### Promotion Script Implementation (`promote:monorepo`)

- [ ] **Detect preconditions** - Validate clean git state, check for existing
      packages/ directory - `S`
- [ ] **Structural migration** - Move current source to `packages/core` with
      preserved structure - `M`
- [ ] **Config rewrite & validation** - Inject workspaces configuration, mark
      root `private: true`, update imports - `M`
- [ ] **Optional server package scaffold** - Generate `packages/server` with
      `--with-server` flag - `M`
- [ ] **Post-migration diagnostics report** - Run lint → typecheck → build →
      test, report success/failure - `S`
- [ ] **Idempotent execution safeguards** - Allow script to run multiple times
      without corruption - `S`

### Enhanced Script Features

- [ ] Generate `packages/utilities` sample package with basic util + test - `S`
- [ ] Add dry run mode (`--plan` flag) to preview changes without execution -
      `S`
- [ ] Create promotion post-flight script (`bun run promote:verify`) for
      validation - `S`

### Documentation & Examples

- [ ] Add monorepo upgrade guide to main documentation - `S`
- [ ] Create architecture diagram (Mermaid) showing package relationships - `XS`
- [ ] Document Changesets strategy for independent vs fixed versioning - `S`
- [ ] Add FAQ section addressing common monorepo questions - `S`
- [ ] Create troubleshooting guide for promotion edge cases - `M`

### Quality Assurance

- [ ] Test promotion script on clean template clone - `M`
- [ ] Validate Turborepo caching (local + remote ready) - `S`
- [ ] Ensure security workflows continue working post-promotion - `S`
- [ ] Test changesets across multiple packages - `S`

### Risk Mitigation Strategy

| Risk                          | Impact                   | Mitigation                               |
| ----------------------------- | ------------------------ | ---------------------------------------- |
| Existing packages/ dir        | Abort mid-migration      | Pre-flight check + --force override      |
| Non-standard source root      | Script fails to relocate | Flag --src-dir=<path>                    |
| Custom exports map            | Broken entrypoints       | Backup + diff output + prompt            |
| Unreleased changesets present | Version confusion        | Preserve; warn with guidance             |
| CI depends on paths           | Pipeline break           | Emit migration report with renamed paths |

## Phase 2: Critical Fixes & Stability (P1 - Postponed from Phase 1) (3 days)

**Goal:** Address critical configuration gaps and test stability issues
(deferred to prioritize monorepo) **Success Criteria:** Zero flaky tests,
complete package metadata, Node compatibility verified

### Package Configuration

- [ ] Add `packageManager: "bun@1.1.38"` field to package.json - `XS`
- [ ] Add optional `engines.node: ">=18"` guard - `XS`
- [ ] Add `module` field pointing to ESM build for legacy bundlers - `XS`

### Test Stability

- [ ] Stabilize timing-sensitive tests (widen <100ms to <300ms or gate with CI
      env) - `S`
- [ ] Add minimal Node consumer smoke test (dynamic import validation) - `S`
- [ ] Add MSW handler teardown test (prevent latent leaks) - `S`

### Error Detection & Documentation

- [ ] Strengthen startServer error detection (both "Cannot find module" and
      "Cannot find package 'bun'") - `S`
- [ ] Document external CLI dependencies in CONTRIBUTING (hyperfine, jq) - `XS`
- [ ] Add TODO marker in vitest.config.ts for multi-thread re-enable criteria -
      `XS`

### Coverage Strategy

- [ ] Implement gradual coverage ramp plan (branches: 50→60→70) - `S`
- [ ] Document coverage increase timeline in testing strategy - `XS`

## Phase 3: Monorepo DX & Advanced Features (1 week)

**Goal:** Enhance monorepo developer experience and add advanced tooling
**Success Criteria:** Optimized workflows, package generators, remote caching
ready

### Enhanced Monorepo Tooling

- [ ] Create `bun run create:package <name>` generator script - `M`
- [ ] Add per-package size-limit budgets with aggregated reporting - `S`
- [ ] Implement config sync workflow (main → monorepo branch drift detection) -
      `L`
- [ ] Add matrix CI for package subsets (when >5 packages) - `M`
- [ ] Create graph-based selective testing strategy - `L`

### Remote Caching & Performance

- [ ] Document Turborepo remote cache setup (TURBO_TEAM, TURBO_TOKEN) - `S`
- [ ] Add signed artifact verification setup
      (TURBO_REMOTE_CACHE_SIGNATURE_KEY) - `S`
- [ ] Create performance comparison benchmarks (single vs monorepo) - `M`
- [ ] Implement cache warming strategies for CI - `M`

### DX Optimizations

- [ ] Add `focus` script (test:changed + minimal reporter) for promoted repos -
      `XS`
- [ ] Create workspace-aware status script (`bun run status:all`) - `S`
- [ ] Add package dependency graph visualization - `M`
- [ ] Implement selective build/test based on changed packages - `L`

### CI/CD Polish

- [ ] Consolidate commitlint step (reuse deps cache or merge into quality job) -
      `S`
- [ ] Split security scan into reusable workflow (monorepo-ready) - `M`
- [ ] Add slim "Quick Start (90-second path)" at top of README - `S`

## Phase 4: Security & Supply Chain Hardening (1 week)

**Goal:** Enhance supply chain security and compliance for both single-package
and monorepo **Success Criteria:** Comprehensive security monitoring and
transparent practices

### Security Automation

- [ ] Add weekly dependency freshness workflow (npm-check-updates in draft PR) -
      `M`
- [ ] Add weekly `bun audit` workflow with diff severity tracking - `M`
- [ ] Enable CodeQL JavaScript scanning - `S`
- [ ] Add license scanning (bunx license-checker-rseidelsohn) - `S`
- [ ] Sign or attach hash to SBOM artifacts - `S`
- [ ] Verify SBOM upload even when not publishing (traceability) - `XS`

### Monorepo Security Considerations

- [ ] Extend security scanning to work with workspace structure - `M`
- [ ] Create per-package SBOM generation for published packages - `M`
- [ ] Document security implications of monorepo promotion - `S`
- [ ] Add security validation to promote:monorepo script - `S`

### Documentation & Compliance

- [ ] Update README with supply chain security references - `XS`
- [ ] Prepare npm provenance verification badge instructions - `S`
- [ ] Add SLSA provenance documentation - `M`
- [ ] Document how to verify published package integrity - `S`

## Phase 5: Performance & Advanced DX (P2 - Opportunistic) (2 weeks)

**Goal:** Optimize performance monitoring and advanced developer workflows
(adjusted for monorepo) **Success Criteria:** Performance regression detection,
enhanced cognitive support

### Performance Monitoring

- [ ] Add nightly performance workflow with artifact diffing - `M`
- [ ] Implement performance baseline regression detection - `L`
- [ ] Add benchmarking script using Vitest bench - `S`
- [ ] Enforce size-limit budget threshold (config + failing exit) - `S`
- [ ] Add pathParts(path) helper export for path introspection - `XS`

### ADHD-Friendly Enhancements

- [ ] Create DX_MODE.md with "When stuck → run:" guidance - `S`
- [ ] Add `bun run status` meta script aggregating lint/type/test - `S`
- [ ] Provide roadmap note for multi-threaded Vitest timeline - `XS`
- [ ] Add monorepo-specific "When stuck" guidance - `S`

### Build & Packaging Optimization

- [ ] Explore conditional exports mapping (future-proofing) - `M`
- [ ] Verify tree-shake friendly patterns are maintained - `S`
- [ ] Add JSON output option to validate-types.ts script - `S`
- [ ] Consider npmignore for future non-whitelisted artifacts - `XS`

### Utility Refinements

- [ ] Gradually raise test coverage thresholds per quarter - `M`
- [ ] Trim defensive guards in utility modules - `S`
- [ ] Add subpath exports strategy before wildcard (if needed) - `M`

## Phase 6: Documentation & Community (1 week)

**Goal:** Improve project documentation and community engagement **Success
Criteria:** Clear, accessible documentation and onboarding experience

### Documentation Modularization

- [ ] Modularize README (move deep sections to docs/, keep root lean) - `M`
- [ ] Create comprehensive README with all badges - `M`
- [ ] Develop migration guides (Node.js to Bun) - `L`
- [ ] Write troubleshooting guide - `M`
- [ ] Add CODE_OF_CONDUCT.md for community guidelines - `XS`

### Community Resources

- [ ] Prepare video tutorials and screencasts - `L`
- [ ] Create community template examples - `XL`
- [ ] Develop framework integration examples (React, Vue, Svelte) - `XL`
- [ ] Add provenance verification badge instructions (post first publish) - `S`

### Monorepo-Specific Documentation

- [ ] Create video walkthrough of promote:monorepo process - `M`
- [ ] Document common monorepo patterns and best practices - `M`
- [ ] Add examples of successful monorepo evolution stories - `S`
- [ ] Create troubleshooting guide for monorepo-specific issues - `M`

## Long-Term Evolution (Post-MVP)

### Advanced Monorepo Features

- [ ] Implement advanced package orchestration (build graphs, parallel
      execution) - `L`
- [ ] Add automatic dependency updating across workspace packages - `M`
- [ ] Create monorepo analytics and health monitoring - `L`
- [ ] Implement package-to-package change impact analysis - `L`

### Advanced Tooling

- [ ] Investigate AI-powered code review suggestions - `XL`
- [ ] Implement automated dependency vulnerability patching - `L`
- [ ] Add SLSA generator adoption for enhanced provenance - `L`
- [ ] Create machine-parsable CI annotations from validate-types - `M`

### Performance & Monitoring

- [ ] Develop real-time performance monitoring - `XL`
- [ ] Create advanced bundle optimization strategies - `L`
- [ ] Implement memory leak detection - `L`
- [ ] Re-enable multi-threaded Vitest when Bun worker stability improves - `M`

## Success Metrics

- **Adoption**: 200+ GitHub stars
- **Performance**: Sub-100ms cold start, sub-50ms hot reload
- **Quality**:
  - Current: 80% lines/statements, 50% branches
  - Q1 2025: branches 60%
  - Q2 2025: branches 70%, consider lines/statements 85%
- **Developer Experience**: <3 minute setup time (<90 seconds for quick start)
- **Security**: Zero critical vulnerabilities, weekly dependency updates
- **Enterprise Readiness**: npm provenance, SBOM, comprehensive security docs
- **Community Engagement**: Active discussions, contributions
- **Monorepo adoption**: ≥30% of cloned repos run promotion within 60 days
  (opt-in telemetry)
- **Reliability target**: Promotion script failure rate <2% (internal test runs)

## Coverage Ramp Plan

**Current State (Phase 0):**

- Lines: 80%
- Statements: 80%
- Branches: 50%
- Functions: 80%

**Q1 2025 Target (End of Phase 2):**

- Branches: 50% → 60%
- Maintain others at 80%

**Q2 2025 Target (End of Phase 4):**

- Branches: 60% → 70%
- Consider raising lines/statements to 85%

**Long-term (Post-MVP):**

- All metrics ≥ 85%
- Critical modules (validate-types.ts) at 95%+

**Monorepo Promotion Impact:**

- No coverage drop allowed during promotion process
- New packages must meet base thresholds: 80% lines/statements/functions, 50%
  branches
- Aggregated coverage across all packages must maintain current levels
- Promotion script validates coverage before completing migration

Promotion Summary: Moved: src/\* -> packages/core/src Added: packages/utilities
(sample) Added: turbo.json Updated: package.json (workspaces, private) Cache
Probe: build #2 (6/6 hits) Status: OK (idempotent safe)
