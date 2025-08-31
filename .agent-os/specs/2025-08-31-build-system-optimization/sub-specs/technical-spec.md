# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-08-31-build-system-optimization/spec.md

> Created: 2025-08-31 Version: 1.0.0

## Technical Requirements

- **Configuration Consistency**: All packages must use identical tsup
  configuration patterns with no conflicting options
- **Build Performance**: Warm builds must complete in <2s to maintain ADHD flow
  state
- **Cache Efficiency**: Turborepo cache hit rate >85% through optimized inputs
  and outputs
- **Bundle Analysis**: Automated metafile consumption for size regression
  detection
- **Strategic Risk Documentation**: Clear documentation of tsup maintenance
  status and migration timeline
- **Tree-shaking Safety**: Validated sideEffects: false across all packages with
  audit trail
- **Entry/Export Alignment**: Build entry names match export subpath names
  exactly
- **External Dependencies Cleanup**: Remove redundant externals and overly broad
  patterns

## Approach Options

**Option A:** Incremental Configuration Cleanup

- Pros: Low risk, maintains current functionality, can be done quickly
- Cons: Doesn't address strategic tsup dependency risk, only fixes symptoms

**Option B:** Comprehensive Build System Audit + Optimization (Selected)

- Pros: Addresses both immediate P0/P1 issues and sets foundation for future
  migration
- Cons: More complex, requires careful validation of sideEffects
- **Rationale:** Aligns with ADHD-optimized developer experience goals by
  eliminating configuration complexity while addressing strategic risks. Creates
  clear documentation for future migration decisions.

**Option C:** Immediate Migration to tsdown/rolldown

- Pros: Eliminates strategic dependency risk immediately
- Cons: High risk, significant scope creep, breaks focus on optimization

## P0 Critical Fixes

### Strategic Dependency Risk

- **Issue**: tsup is no longer actively maintained (2025 status)
- **Immediate Action**: Document current version lock and create migration
  decision framework
- **Timeline**: Document risks now, plan migration in future spec

### sideEffects Audit

- **Issue**: sideEffects: false requires guarantee of no top-level side effects
- **Action**: Audit all package entry points for side effects (imports, global
  mutations, etc.)
- **Risk**: Runtime breakage via aggressive tree shaking if violations exist

## P1 High Priority Fixes

### Configuration Inconsistencies

- **Base Config Splitting**: Remove splitting: true from baseTsupConfig since it
  conflicts with mixed format factory logic
- **External Redundancy**: Consolidate node:\* and individual core modules into
  single pattern
- **Platform Targeting**: Change @template/utils to platform: 'browser' due to
  React dependency

### Entry/Export Misalignment

- **Current Issue**: 'number-utils' entry vs "./number" export subpath
- **Solution**: Align build entries with package.json exports exactly
- **Impact**: Reduces cognitive load during refactoring and package consumption

### Turborepo Cache Optimization

- **Remove Phantom Outputs**: dist-node, dist-types not produced by tsup
- **Input Optimization**: Ensure inputs match actual source file patterns
- **Performance Target**: >85% cache hit rate

## P2 Medium Priority Improvements

### Build Quality Enhancements

- **Disable Library Minification**: Remove minification for library packages to
  improve debuggability and stack traces
- **Consumer Benefits**: Consumers typically re-minify anyway, readable builds
  help with debugging
- **Bundle Analysis**: Implement automated metafile consumption for size
  regression detection

### Platform & Configuration Refinements

- **Platform Targeting**: Update React-dependent packages from neutral to
  browser for better downstream optimizations
- **TypeScript Config Alignment**: Add explicit tsconfig references to prevent
  build setting divergence
- **Turborepo Output Cleanup**: Remove unused directories (dist-node,
  dist-types) from cache configuration

### ESM Optimization & Future Planning

- **ESM-Only Builds**: Plan separate ESM-only build step leveraging splitting
  for optimal tree-shaken distribution
- **Migration Path Documentation**: Create comprehensive tsup → tsdown/rolldown
  migration guide and timeline
- **Strategic Planning**: Document decision framework for future bundler
  migrations

## ADHD Performance Impact

### Current State Analysis

- Build all packages: ~5s (current) → ≤2s (target)
- Configuration complexity: High (multiple conflicting patterns) → Low (single
  consistent pattern)
- Error clarity: Poor (buried in config conflicts) → Clear (standardized
  messaging)

### Optimization Strategies

- **Eliminate Decision Paralysis**: Single createPackageConfig pattern, no base
  config exposure
- **Reduce Context Switching**: Consistent error messages and build behavior
  across packages
- **Maintain Flow State**: Fast feedback loops with clear visual indicators
- **Single Mental Model**: One way to configure builds, predictable behavior

## Implementation Strategy

### Phase 1: Critical Risk Mitigation (P0)

1. Audit sideEffects usage across all packages
2. Document tsup maintenance status and strategic options
3. Create rollback plan for any configuration changes

### Phase 2: Configuration Standardization (P1)

1. Clean up redundant externals in base configuration
2. Fix splitting logic inconsistencies
3. Align entry/export naming patterns
4. Update platform targeting for React packages

### Phase 3: Performance & Observability (P1)

1. Optimize Turborepo cache configuration
2. Implement metafile analysis for bundle size tracking
3. Add build performance monitoring to dx:status command
4. Validate <2s build time targets

### Phase 4: Build Quality & Future Planning (P2)

1. Disable minification for library packages
2. Update platform targeting for React packages
3. Add explicit tsconfig references
4. Plan ESM-only optimization builds
5. Document comprehensive migration path to tsdown/rolldown

## External Dependencies

**No new dependencies required** - this is an optimization of existing tooling
configuration.

## Success Criteria

- [ ] All packages build in <2s (warm cache)
- [ ] Zero configuration conflicts between base and factory
- [ ] sideEffects: false validated as safe across all packages
- [ ] Entry names match export subpaths exactly
- [ ] Turborepo cache hit rate >85%
- [ ] Strategic risks documented with clear timeline
- [ ] Build behavior consistent across all packages
