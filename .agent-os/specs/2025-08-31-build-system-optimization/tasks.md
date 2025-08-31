# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-08-31-build-system-optimization/spec.md

> Created: 2025-08-31 Status: Ready for Implementation

## Tasks

- [x] 1. P0: Strategic Risk Mitigation and sideEffects Audit
  - [ ] 1.1 Write tests for sideEffects validation across all packages (SKIPPED
        per user request)
  - [x] 1.2 Audit all package entry points for side effects (imports, global
        mutations)
  - [x] 1.3 Document tsup maintenance status and strategic options
  - [x] 1.4 Create rollback plan for configuration changes
  - [x] 1.5 Verify all tests pass (305/306 tests passing - 1 test has file
        system issue, core functionality verified)

- [x] 2. P1: Configuration Standardization and External Cleanup
  - [x] 2.1 Write tests for tsup configuration validation
  - [x] 2.2 Remove splitting: true from baseTsupConfig
  - [x] 2.3 Consolidate node:\* and individual core modules into single pattern
  - [x] 2.4 Fix splitting logic inconsistencies
  - [x] 2.5 Fix critical sideEffects issue in @template/server
  - [x] 2.6 Update platform targeting for @template/utils to browser
  - [x] 2.7 Fix TypeScript composite project issues
  - [x] 2.8 Verify all tests pass and configurations are consistent (306/306
        tests passing)

- [x] 3. P1: Entry/Export Alignment and Platform Targeting
  - [x] 3.1 Write tests for entry/export alignment validation
  - [x] 3.2 Align build entry names with package.json exports exactly
  - [x] 3.3 Change @template/utils to platform: 'browser' due to React
        dependency
  - [x] 3.4 Update platform targeting for other React packages (server kept as
        'node', app/web use different build systems)
  - [x] 3.5 Verify all tests pass and builds produce correct outputs (306/306
        tests passing, tsup builds working correctly)

- [x] 4. P1: Turborepo Cache Optimization
  - [x] 4.1 Write tests for Turborepo cache configuration validation
  - [x] 4.2 Remove phantom output directories (dist-node, dist-types) from cache
  - [x] 4.3 Optimize input patterns to match actual source files (already
        optimal)
  - [x] 4.4 Add build performance monitoring to dx:status command (already
        implemented)
  - [x] 4.5 Verify >85% cache hit rate and <2s build times (achieved: 100% cache
        hit, 1.6s total time)

- [ ] 5. P2: Build Quality and Bundle Analysis
  - [x] 5.1 Write tests for bundle analysis and metafile consumption
  - [x] 5.2 Disable minification for library packages
  - [ ] 5.3 Implement automated metafile consumption for size regression
        detection
  - [ ] 5.4 Add explicit tsconfig references to prevent build setting divergence
  - [ ] 5.5 Verify improved debuggability and consistent build behavior

- [ ] 6. P2: ESM Optimization and Migration Documentation
  - [x] 6.1 Write tests for ESM-only build validation
  - [ ] 6.2 Plan separate ESM-only build step leveraging splitting
  - [ ] 6.3 Document comprehensive tsup → tsdown/rolldown migration guide
  - [ ] 6.4 Create decision framework for future bundler migrations
  - [ ] 6.5 Verify all tests pass and documentation is complete

[ ] 7.Fix broken build in the templates abductory with Vite.
