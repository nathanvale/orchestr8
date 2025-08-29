# Product Roadmap

> Last Updated: 2025-08-29 Version: 8.0.0 Status: Active Development - DX Unification Sprint
> Roadmap version tracks planning iteration, not semver

## Executive Summary

**Current State:** Migration to Node.js + pnpm in progress with partial Bun artifacts creating cognitive dissonance. Strong foundation (Turborepo, Vitest, Changesets) but missing critical DX unification.

**Immediate Focus:** P0 priorities to eliminate dual mental models, standardize builds, and add ADHD-optimized flow accelerators. Target: <5s feedback loops, single-command status recovery, zero-config scaffolding.

## Success Metrics Dashboard

| Metric | Current | Target | Priority |
|--------|---------|--------|----------|
| First meaningful commit | ~15 min | <5 min | P0 |
| Full test run (warm) | ~10s | ≤5s | P0 |
| Build all packages (warm) | ~5s | ≤2s | P0 |
| Test coverage (lines) | ~60% | 85% | P1 |
| Turbo cache hit (CI) | ~50% | ≥85% | P0 |
| Context recovery time | N/A | ≤10s | P0 |

## P0: Critical Path (Must Fix Now)

**Timeline:** 1-2 days
**Goal:** Eliminate cognitive dissonance, establish unified mental model
**Success:** Clean pnpm-only install, consistent builds, single status command

### 🔥 Runtime Pivot Finalization

- [x] **Remove all Bun artifacts** `XS` [Quick Win]
  - [x] Delete bun.lockb, bunfig.toml, bun-types
  - [x] Remove Bun references from README and docs
  - [x] Update package.json scripts to pnpm
  - [x] Add .nvmrc with Node 20.x LTS

- [x] **Enforce Node.js standards** `XS`
  - [x] Set engines field in package.json
  - [x] Update CI matrix to Node 20.x only
  - [x] Remove EPIPE-SOLUTION.md

### 🏗️ Build System Standardization

- [x] **Create shared tsup configuration** `S`
  - [x] Create /tooling/build/tsup.base.ts
  - [x] Export base config with CJS + ESM + types
  - [x] Configure sideEffects: false, treeshaking
  - [x] Each package extends base config

- [x] **Normalize export maps** `S`
  - [x] Standardize exports field structure
  - [x] Add proper types resolution
  - [x] Validate with smoke tests

### 🧪 Testing Unification

- [x] **Unified Vitest multi-project config** `S`
  - [x] Root vitest.config.ts with test.projects
  - [x] Configure jsdom vs node environments
  - [x] Add coverage.include for uncovered files
  - [x] Set baseline thresholds (70% → 85% ratchet)

- [x] **Consolidate test utilities** `XS`
  - [x] Remove duplicate test-utils files
  - [x] Create canonical test helpers location

### ⚡ Performance & Caching

- [x] **Configure Turborepo remote cache** `XS` [Quick Win]
  - [x] Setup Vercel remote cache (free tier)
  - [x] Add TURBO_TOKEN to CI
  - [x] Add --continue=dependencies-successful flags
  - [x] Verify >85% cache hit rates

### 🎯 ADHD Flow Accelerators

- [ ] **Create dx:status command** `XS` [Quick Win]
  - [ ] Show pending changesets count
  - [ ] Display coverage percentage
  - [ ] List outdated dependencies
  - [ ] Report last test timestamp
  - [ ] Show Turbo cache status

- [ ] **Add pre-release guardrails** `S`
  - [ ] Changeset validation script
  - [ ] Security scan automation
  - [ ] Export map linting
  - [ ] Stale changeset alerts

### 🔒 Security Baseline

- [ ] **Update supply chain security** `S`
  - [ ] Replace deprecated npm audit
  - [ ] Add license scanning to CI
  - [ ] Generate SBOM after builds
  - [ ] Configure vulnerability gating

## P1: High-Leverage DX (Flow State)

**Timeline:** Days 3-5
**Goal:** Accelerate development velocity, reduce context switches
**Success:** <20s package creation, visual feedback, onboarding <5min

### 🚀 Scaffolding & Generators

- [ ] **Package creation scaffolder** `M`
  - [ ] Script: pnpm gen:package <name>
  - [ ] Copy template structure
  - [ ] Setup tsup config automatically
  - [ ] Create test folder and stubs
  - [ ] Generate changeset template

- [ ] **Fast onboarding script** `M`
  - [ ] Verify Node version
  - [ ] Install git hooks
  - [ ] Run first test suite
  - [ ] Print essential commands
  - [ ] Open README at quickstart

### 🌐 Next.js Maturity

- [ ] **API route handlers** `M`
  - [ ] /api/health endpoint
  - [ ] /api/metrics with server parity
  - [ ] WebVitals client boundary
  - [ ] Correlation ID propagation

- [ ] **Production patterns** `M`
  - [ ] SSR + RSC examples
  - [ ] ISR with revalidate tags
  - [ ] Streaming suspense demo
  - [ ] Cache mode examples

### 📊 Observability & Profiling

- [ ] **Vitest performance profiling** `S`
  - [ ] Add DEBUG presets
  - [ ] Script: pnpm test:profile
  - [ ] Identify slow test files
  - [ ] Track time-to-run trends

- [ ] **Coverage ratcheting** `S`
  - [ ] Create coverage-baseline.json
  - [ ] Auto-update thresholds (up only)
  - [ ] Per-file threshold tracking
  - [ ] CI enforcement

### 🔧 Build Optimization

- [ ] **Turborepo prune for Docker** `S`
  - [ ] Add ci:prune stage
  - [ ] Generate pruned outputs
  - [ ] Optimize container builds
  - [ ] Target >30% size reduction

- [ ] **Unified validation pipeline** `S`
  - [ ] Single pnpm validate command
  - [ ] Colored output sections
  - [ ] Structured PASS/FAIL table
  - [ ] ADHD-friendly visual cues

### 📦 Dependency Management

- [ ] **Dependency drift monitoring** `XS`
  - [ ] Add .ncurc configuration
  - [ ] Weekly drift reports
  - [ ] Semver grouping (major/minor/patch)
  - [ ] Action tags for updates

- [ ] **Zod validation layer** `S`
  - [ ] Central validation utilities
  - [ ] API handler schemas
  - [ ] Config object validation
  - [ ] Type-level inference

## P2: Quality & Performance

**Timeline:** Week 2
**Goal:** Production hardening, performance baselines, observability
**Success:** Benchmarks tracked, multi-env testing, API docs stable

### 🏃 Performance Testing

- [ ] **Benchmark suite** `S`
  - [ ] Vitest bench for hot paths
  - [ ] Store baseline ops/sec
  - [ ] Alert on -10% regression
  - [ ] Track build time trends

- [ ] **Multi-environment tests** `M`
  - [ ] Browser (jsdom) project
  - [ ] Node.js project
  - [ ] Isomorphic validation
  - [ ] Catch accidental DOM usage

### 📚 Documentation & API

- [ ] **API documentation** `M`
  - [ ] Typedoc generation
  - [ ] API Extractor reports
  - [ ] Breaking change detection
  - [ ] Stable public API surface

- [ ] **Component showcase** `M`
  - [ ] Optional Storybook setup
  - [ ] MDX documentation
  - [ ] Visual regression ready
  - [ ] Next.js composition

### 📈 Metrics & Monitoring

- [ ] **Monorepo health dashboard** `M`
  - [ ] Coverage trend sparklines
  - [ ] Build duration tracking
  - [ ] Cache hit percentages
  - [ ] Dependency churn metrics

- [ ] **E2E smoke tests** `M`
  - [ ] Playwright minimal flow
  - [ ] Load Next.js pages
  - [ ] Call API routes
  - [ ] Assert metrics visible

### 🔐 Production Hardening

- [ ] **Import cost guards** `XS`
  - [ ] Bundle size limits
  - [ ] PR diff comments
  - [ ] Threshold gating
  - [ ] Size-limit integration

- [ ] **Release dry run** `S`
  - [ ] Simulate changeset version
  - [ ] Build and pack tarballs
  - [ ] Inspect bundle sizes
  - [ ] Pre-flight validation

## P3: Future Innovations

**Timeline:** Month 2+
**Goal:** Advanced capabilities, AI assistance, enterprise features
**Success:** Graph-based testing, feature generators, telemetry

### 🧠 Intelligence Layer

- [ ] **Graph-based test selection** `L`
  - [ ] Dependency graph building
  - [ ] Impact analysis
  - [ ] Selective test running
  - [ ] Beyond --changed flag

- [ ] **AI-assisted workflows** `M`
  - [ ] Commit message suggestions
  - [ ] Changelog summaries
  - [ ] PR body generation
  - [ ] Semantic analysis

### 🏭 Advanced Tooling

- [ ] **Feature generators** `L`
  - [ ] CLI: pnpm gen:feature
  - [ ] Coordinated slices
  - [ ] API + Web + Tests
  - [ ] Pluggable templates

- [ ] **Workspace play mode** `M`
  - [ ] Live REPL environment
  - [ ] Package exploration
  - [ ] Route introspection
  - [ ] Interactive debugging

### 🌍 Enterprise Features

- [ ] **Multi-tenant patterns** `L`
  - [ ] Structured layering
  - [ ] SaaS architecture
  - [ ] Isolation patterns
  - [ ] Configuration management

- [ ] **Edge runtime support** `M`
  - [ ] /api/edge examples
  - [ ] Portability demos
  - [ ] Performance comparisons
  - [ ] Deployment guides

### 📊 Analytics & Insights

- [ ] **Telemetry system** `M`
  - [ ] Opt-in metrics
  - [ ] Build time tracking
  - [ ] Test latency analysis
  - [ ] Historical trends

- [ ] **Semantic drift alerts** `M`
  - [ ] Type diff detection
  - [ ] API change categories
  - [ ] Breaking change alerts
  - [ ] Version compatibility

## Quick Wins Checklist (Do First!)

Execute these in order for maximum impact:

1. [ x] Remove all Bun artifacts (~15 min)
2. [x] Create dx:status command (~15 min)
3. [x] Setup remote Turbo cache (~5 min)
4. [x] Add shared tsup config (~30 min)
5. [x] Unify Vitest config (~30 min)
6. [x] Consolidate test utils (~10 min)
7. [x] Fix export maps (~20 min)
8. [x] Create coverage baseline (~10 min)

**Total: ~2.5 hours for massive DX improvement**

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Incomplete pivot creates confusion | High | P0 focus on removing all Bun artifacts |
| Slow feedback kills ADHD flow | High | Target <5s for all operations |
| Complex config overwhelms users | Medium | Zero-config scaffolding, clear defaults |
| Coverage regression | Medium | Ratchet mechanism prevents backsliding |
| Cache misses slow CI | Medium | Remote cache + input optimization |

## Definition of Done

Each phase is complete when:
- All tasks marked complete
- Tests passing at target coverage
- Performance metrics met
- Documentation updated
- No regression in existing features

## Notes

- **Philosophy:** Eliminate friction, accelerate flow, maintain focus
- **Priorities:** P0 fixes cognitive dissonance, P1 adds velocity, P2 ensures quality
- **ADHD Focus:** Every feature designed to reduce context switches and maintain momentum
- **Migration:** Clean break from Bun, full commitment to Node.js + pnpm ecosystem