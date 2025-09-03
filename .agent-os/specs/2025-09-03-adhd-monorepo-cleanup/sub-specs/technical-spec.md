# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-03-adhd-monorepo-cleanup/spec.md

> Created: 2025-09-03 Version: 1.0.0

## Technical Requirements

- **Build Tool Standardization**: All packages must use tsup for consistent
  ESM-only output
- **Performance Requirement**: <5s build time for `pnpm build:all` with warm
  Turborepo cache
- **Configuration Reduction**: turbo.json must be <50 lines (down from 315
  lines)
- **Script Standardization**: All packages limited to 4 core scripts (build,
  test, lint, typecheck)
- **Output Consistency**: All packages produce dist/ folder with identical
  structure
- **Tree-shaking Safety**: sideEffects: false configuration required for optimal
  bundling
- **ADHD Compliance**: Zero decision paralysis - identical patterns across all
  packages

## Approach Options

**Option A: Gradual Package Migration**

- Pros: Lower risk, incremental validation, easier rollback
- Cons: Temporary inconsistency, longer timeline, cognitive overhead during
  transition

**Option B: Comprehensive Simultaneous Migration** (Selected)

- Pros: Eliminates inconsistency immediately, single validation cycle, cleaner
  git history
- Cons: Higher initial complexity, requires careful coordination

**Option C: Keep Mixed Build Systems**

- Pros: No disruption to working packages
- Cons: Maintains cognitive overhead, doesn't solve ADHD optimization goals

**Rationale:** Option B aligns with ADHD-first design principles by eliminating
configuration inconsistency that creates decision paralysis. Single cutover
reduces context switching and provides immediate cognitive load relief.

## External Dependencies

- **@tsup/config** - Shared tsup base configuration package
- **Justification:** Enables consistent build patterns without duplication,
  essential for ADHD-optimized zero-config approach

- **@changesets/cli** - Automated release management
- **Justification:** Eliminates manual release complexity, supports conventional
  commits workflow

- **commitizen + cz-conventional-changelog** - Commit message standardization
- **Justification:** Required for Changesets automation, reduces cognitive load
  of commit formatting

## Implementation Strategy

### Phase 1: Build System Foundation

1. Create tooling/build/tsup.base.ts with shared configuration
2. Audit all packages for sideEffects and tree-shaking safety
3. Convert all package builds to extend shared config
4. Validate output consistency across packages

### Phase 2: Turborepo Optimization

1. Identify essential tasks only (build, test, lint, typecheck)
2. Remove complex input/output specifications
3. Simplify to basic dependency graph
4. Validate cache behavior with simplified config

### Phase 3: Release Automation

1. Install and configure Changesets CLI
2. Setup Commitizen for conventional commits
3. Create release workflow integration
4. Test automated versioning cycle

## Validation Criteria

- All packages build successfully with identical tsup config
- Build performance meets <5s target for warm cache
- turbo.json complexity reduced by >90%
- Automated release cycle functional end-to-end
- Zero configuration differences between packages (except name/version)
