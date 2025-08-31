# Build System Modernization Specification

> **Spec:** Build System Optimization & ESM Migration **Created:** 2025-08-31  
> **Status:** Ready for Implementation  
> **Priority:** P0 (Critical Path)

## Overview

Modernize the current tsup-based build system to eliminate strategic risks,
reduce cognitive load, and align with 2025 Node.js + ESM best practices. This
migration will remove dual-format complexity, standardize on pure ESM, and
simplify the build pipeline while maintaining ADHD-optimized developer
experience.

**Strategic Goals:**

- Eliminate dependency on unmaintained tsup tooling
- Reduce build complexity and cognitive overhead
- Maintain <2s build times for flow state protection
- Align with 2025 Node.js + Turborepo ecosystem standards

## User Stories

### Primary Developer Experience Story

As a **developer working in the monorepo**, I want **simple, fast, predictable
builds** so that **I can maintain flow state without cognitive overhead from
complex tooling**.

**Detailed Workflow:**

1. Developer runs `pnpm build` and gets consistent behavior across all packages
2. Build completes in <2s for incremental changes
3. Source maps and type navigation work perfectly in IDE
4. No configuration complexity or dual-format confusion
5. Clear error messages when builds fail

### Package Consumer Story

As a **consumer of published packages**, I want **clean ESM packages with proper
types** so that **my bundler can tree-shake effectively and I get accurate
IntelliSense**.

**Detailed Workflow:**

1. Import package using modern ESM syntax
2. Bundler tree-shakes unused code effectively
3. TypeScript provides accurate type information
4. Source maps point to readable source code
5. No CommonJS/ESM interop issues

### Maintainer Story

As a **project maintainer**, I want **unified build configuration** so that **I
can easily understand, debug, and modify the build process**.

**Detailed Workflow:**

1. All packages follow same build pattern
2. Configuration is explicit and discoverable
3. Adding new packages requires minimal setup
4. Build issues are easy to diagnose
5. Migration path is clear for future changes

## Spec Scope

1. **Remove tsup abstraction layer** - Eliminate `tooling/build/tsup.base.ts`
   and per-package tsup configs
2. **Standardize on pure ESM** - Drop CommonJS dual-format builds for internal
   packages
3. **Implement tsc-first builds** - Use TypeScript compiler directly for
   internal packages
4. **Add selective bundling** - Use `unbuild` only for packages requiring
   distribution optimization
5. **Optimize Turborepo integration** - Update task definitions and caching for
   new build system

## Out of Scope

- Multi-runtime edge/browser bundling (future consideration)
- Backward compatibility with Node < 18 (current baseline is Node 20+)
- Size-critical serverless single-file optimization (not current requirement)
- CommonJS support (unless proven external consumer requirement emerges)

## Expected Deliverable

1. **All packages build with <2s incremental time** using simplified toolchain
2. **Zero tsup dependencies** in the codebase with clean migration
3. **Pure ESM output** with proper type declarations and source maps
4. **Turborepo tasks optimized** for new build system with proper caching
5. **Documentation updated** with new build patterns and migration rationale

---

# Technical Specification

This is the technical specification for the build system modernization detailed
above.

> Created: 2025-08-31  
> Version: 1.0.0

## Technical Requirements

### Build Performance Requirements

- **Incremental build time**: <2s for single package changes
- **Full monorepo build**: <10s cold, <5s warm (Turborepo cache)
- **Memory usage**: No increase from current baseline
- **Output size**: Reduce total dist artifact size by 30-40%

### Output Format Requirements

- **Module format**: ESM only (`type: "module"`)
- **Type declarations**: Always emit `.d.ts` + `.d.ts.map`
- **Source maps**: Always emit for debugging
- **Tree-shaking**: Preserve for downstream bundlers

### Integration Requirements

- **Turborepo compatibility**: Full task graph and caching support
- **IDE compatibility**: Preserve go-to-definition and symbol navigation
- **CI/CD compatibility**: No changes to existing pipeline structure
- **Package.json exports**: Proper subpath exports for all packages

## Architecture Decision

**Selected Approach: tsc-first with selective bundling**

### For Internal Packages (packages/utils, etc.)

```typescript
// Use pure TypeScript compiler
"scripts": {
  "build": "tsc -p tsconfig.json",
  "typecheck": "tsc --noEmit -p tsconfig.json"
}
```

**Rationale**: Simplest approach, best developer experience, optimal
tree-shaking for consumers.

### For Published Libraries (if needed)

```typescript
// build.config.ts using unbuild
import { defineBuildConfig } from 'unbuild'
export default defineBuildConfig({
  entries: ['src/index'],
  outDir: 'dist',
  declaration: true,
  clean: true,
  rollup: { emitCJS: false },
})
```

**Rationale**: Minimal bundling only where needed, maintains ESM-first approach.

## External Dependencies

### Remove Dependencies

- **tsup** - No longer needed, replaced by native tsc
- **@types/node** versions conflicts - Standardize on single version

### Add Dependencies (Root Level)

- **unbuild** - Only if publishable packages require bundling
- **tsx** - For running TypeScript scripts directly

**Justification**: Reduces dependency surface area while adding minimal,
well-maintained tooling only where needed.

## Implementation Examples

### 1. Minimal tsconfig.json (Internal Packages)

```json
{
  "extends": "../../tooling/tsconfig/base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "declaration": true,
    "declarationMap": true,
    "verbatimModuleSyntax": true,
    "strict": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules"]
}
```

### 2. Package.json Exports (ESM Only)

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./*": {
      "types": "./dist/*.d.ts",
      "import": "./dist/*.js"
    }
  }
}
```

### 3. Analysis Script (Optional)

```typescript
// scripts/analyze-build.ts
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/index.ts'],
  platform: 'node',
  format: 'esm',
  bundle: true,
  metafile: true,
  write: false,
})

console.log(
  await import('esbuild').then((m) =>
    m.analyzeMetafile(result.metafile!, { verbose: false }),
  ),
)
```

### 4. Unbuild Config (Published Packages)

```typescript
// build.config.ts
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['src/index'],
  clean: true,
  declaration: true,
  outDir: 'dist',
  rollup: {
    emitCJS: false,
    preserveModules: true,
  },
})
```

### 5. Updated Turbo Tasks

```json
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"],
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "outputs": [],
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

---

# Migration Tasks

## Phase 1: Foundation Cleanup (P0)

_Timeline: Day 1 - Critical path items_

### Task 1.1: Remove tsup Infrastructure

**Effort: 30 minutes**

- [ ] 1.1.1 Delete `tooling/build/tsup.base.ts`
- [ ] 1.1.2 Remove all `tsup.config.ts` files from packages
- [ ] 1.1.3 Remove tsup dependency from package.json files
- [ ] 1.1.4 Update .gitignore to remove tsup-specific patterns
- [ ] 1.1.5 Commit removal with clear message

### Task 1.2: Audit Package Structure

**Effort: 45 minutes**

- [ ] 1.2.1 Identify all packages in workspace
- [ ] 1.2.2 Classify as internal vs publishable
- [ ] 1.2.3 Document current build scripts per package
- [ ] 1.2.4 Note any custom tsup configurations
- [ ] 1.2.5 Create migration checklist per package

### Task 1.3: Standardize TypeScript Configuration

**Effort: 1 hour**

- [ ] 1.3.1 Update base tsconfig with ESM settings
- [ ] 1.3.2 Add `verbatimModuleSyntax` for clarity
- [ ] 1.3.3 Ensure `declaration: true` and `declarationMap: true`
- [ ] 1.3.4 Set consistent `target: "ES2022"`
- [ ] 1.3.5 Validate configuration compiles without errors

## Phase 2: Package Migration (P0)

_Timeline: Day 1-2 - Core build system_

### Task 2.1: Migrate packages/utils (Pilot Package)

**Effort: 1.5 hours**

- [ ] 2.1.1 Replace build script with `tsc -p tsconfig.json`
- [ ] 2.1.2 Update package.json exports to ESM-only
- [ ] 2.1.3 Add proper `type: "module"` declaration
- [ ] 2.1.4 Test build output structure matches expectations
- [ ] 2.1.5 Verify TypeScript declarations emit correctly
- [ ] 2.1.6 Run dependent package tests to ensure compatibility
- [ ] 2.1.7 Compare bundle size impact in consuming apps

### Task 2.2: Migrate Remaining Internal Packages

**Effort: 2 hours**

- [ ] 2.2.1 Apply same pattern to apps/server
- [ ] 2.2.2 Update any custom configurations
- [ ] 2.2.3 Fix any package-specific build issues
- [ ] 2.2.4 Ensure all packages follow same pattern
- [ ] 2.2.5 Test full monorepo build completes

### Task 2.3: Update Package Exports

**Effort: 1 hour**

- [ ] 2.3.1 Standardize exports field across all packages
- [ ] 2.3.2 Remove CommonJS conditional exports
- [ ] 2.3.3 Add proper subpath exports where needed
- [ ] 2.3.4 Validate import resolution works correctly
- [ ] 2.3.5 Test with consuming applications

## Phase 3: Optimization & Validation (P1)

_Timeline: Day 2-3 - Performance and quality_

### Task 3.1: Turborepo Integration

**Effort: 1 hour**

- [ ] 3.1.1 Update turbo.json task definitions
- [ ] 3.1.2 Optimize outputs and inputs patterns
- [ ] 3.1.3 Add proper dependsOn relationships
- [ ] 3.1.4 Test cache effectiveness
- [ ] 3.1.5 Verify parallel execution works correctly

### Task 3.2: Performance Validation

**Effort: 45 minutes**

- [ ] 3.2.1 Measure build times before/after migration
- [ ] 3.2.2 Compare output file sizes and structure
- [ ] 3.2.3 Test incremental build performance
- [ ] 3.2.4 Verify Turborepo cache hit rates
- [ ] 3.2.5 Document performance improvements

### Task 3.3: Developer Experience Validation

**Effort: 1 hour**

- [ ] 3.3.1 Test IDE go-to-definition functionality
- [ ] 3.3.2 Verify source map accuracy
- [ ] 3.3.3 Test TypeScript IntelliSense quality
- [ ] 3.3.4 Validate error message clarity
- [ ] 3.3.5 Ensure debugging experience maintained

## Phase 4: Documentation & Cleanup (P1)

_Timeline: Day 3 - Knowledge transfer_

### Task 4.1: Update Documentation

**Effort: 1 hour**

- [ ] 4.1.1 Update README with new build instructions
- [ ] 4.1.2 Document rationale for changes
- [ ] 4.1.3 Add troubleshooting guide
- [ ] 4.1.4 Update contributing guidelines
- [ ] 4.1.5 Create migration notes for future reference

### Task 4.2: Optional Bundling Setup

**Effort: 1.5 hours**

- [ ] 4.2.1 Add unbuild dependency if needed
- [ ] 4.2.2 Create bundling template for publishable packages
- [ ] 4.2.3 Add analysis scripts for bundle inspection
- [ ] 4.2.4 Document when to use bundling vs raw tsc
- [ ] 4.2.5 Test bundled package installation

### Task 4.3: CI/CD Validation

**Effort: 30 minutes**

- [ ] 4.3.1 Verify CI builds pass with new system
- [ ] 4.3.2 Check cache effectiveness in CI environment
- [ ] 4.3.3 Validate artifact generation works correctly
- [ ] 4.3.4 Test any deployment pipelines
- [ ] 4.3.5 Document any CI configuration changes needed

## Rollback Plan

If critical issues arise during migration:

1. **Immediate Rollback** (< 5 minutes)
   - Revert to previous commit
   - Run `pnpm install` to restore tsup dependencies
   - Verify builds work as before

2. **Partial Rollback** (< 15 minutes)
   - Keep successfully migrated packages
   - Restore tsup config for problematic packages
   - Document issues for future resolution

3. **Issue Resolution**
   - Create focused task for specific issue
   - Test fix in isolation
   - Re-attempt migration incrementally

## Success Criteria

✅ **Build Performance**

- All builds complete in <2s incremental, <10s full cold build
- Turborepo cache hit rate >85%
- Total artifact size reduced by 30%

✅ **Developer Experience**

- IDE functionality unchanged (go-to-definition, IntelliSense)
- Source maps point to readable source
- Error messages clear and actionable

✅ **Code Quality**

- All tests pass without modification
- Type checking works correctly
- No regression in consuming applications

✅ **Maintainability**

- Configuration is explicit and discoverable
- Build process is consistent across packages
- Documentation is complete and accurate

---

## Risk Mitigation

| Risk                               | Probability | Impact | Mitigation                                             |
| ---------------------------------- | ----------- | ------ | ------------------------------------------------------ |
| Breaking changes in consuming apps | Medium      | High   | Test with existing apps; provide compatibility guide   |
| IDE integration issues             | Low         | Medium | Validate source maps and type resolution thoroughly    |
| Build performance regression       | Low         | High   | Measure before/after; optimize Turborepo configuration |
| Missing external dependencies      | Medium      | Medium | Audit and document all external requirements           |

## Validation Checklist

### Pre-Migration Validation

- [ ] Document current build times and artifact sizes
- [ ] Identify all packages and their build requirements
- [ ] Test current IDE functionality as baseline
- [ ] Verify all tests pass with existing system

### Post-Migration Validation

- [ ] All packages build successfully with new system
- [ ] Build performance meets or exceeds targets
- [ ] IDE functionality preserved (go-to-definition, etc.)
- [ ] All tests continue to pass
- [ ] Consuming applications work without changes
- [ ] Documentation reflects new system accurately
