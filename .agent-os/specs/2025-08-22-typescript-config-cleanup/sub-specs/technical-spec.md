# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-22-typescript-config-cleanup/spec.md

> Created: 2025-08-22
> Version: 1.0.0

## Technical Requirements

### TypeScript Configuration Standardization

- Remove all TypeScript project references from tsconfig.json files in packages and root
- Eliminate all tsconfig.typecheck.json files (currently in 5 packages: agent-base, cli, core, resilience, testing)
- Standardize type-checking to use `tsc --noEmit` across all packages
- Ensure customConditions: ["development"] inheritance works properly in root tsconfig.json
- Fix CJS build configurations to avoid customConditions conflicts (TS5098 errors)

### Build System Requirements

- Maintain dual package consumption (ESM/CJS) without breaking changes
- Preserve development condition exports pointing to source files
- Ensure all packages build independently without dependency pre-builds
- Fix turbo.json task dependencies to remove type-check dependency on ^build

### Module Resolution Requirements

- Use "bundler" moduleResolution in development (root tsconfig)
- Use "node" moduleResolution for CJS builds
- Maintain proper import/export resolution for internal packages
- Ensure no self-referential dependencies in package.json files

## Approach Options

**Option A:** Gradual migration keeping some typecheck configs temporarily

- Pros: Lower risk, easier rollback
- Cons: Maintains inconsistency during transition

**Option B:** Complete standardization in single change (Selected)

- Pros: Eliminates all inconsistencies, aligns with industry best practices
- Cons: Larger change surface, requires comprehensive testing

**Option C:** Keep TypeScript project references with path mappings

- Pros: Familiar pattern
- Cons: Goes against Turborepo recommendations, causes the original build errors

**Rationale:** Option B is selected because the current inconsistent state is causing build errors and developer friction. A complete standardization following Turborepo's documented "Internal Package Development" pattern will resolve all issues and provide a stable foundation.

## Implementation Strategy

### Phase 1: Remove TypeScript Project References

- Update root tsconfig.json to remove "references" array
- Remove all "references" from package tsconfig.json files
- Verify customConditions inheritance works properly

### Phase 2: Standardize Type-Checking

- Delete all tsconfig.typecheck.json files from packages
- Update package.json scripts to use "tsc --noEmit" instead of typecheck configs
- Ensure all packages have consistent type-check script format

### Phase 3: Fix Build Configurations

- Review and fix CJS build configs that inherit customConditions
- Create standalone configs where needed (like logger package)
- Verify all dual builds (ESM/CJS) work correctly

### Phase 4: Optimize Turbo Configuration

- Remove type-check dependency on ^build in turbo.json
- Ensure proper caching configuration for independent tasks
- Verify pipeline runs efficiently with parallel type-checking

## External Dependencies

No new external dependencies required. This is purely a configuration cleanup using existing tools:

- **TypeScript Compiler (tsc)** - Already in use, no version changes needed
- **Turborepo** - Configuration optimization only
- **pnpm** - Workspace configuration remains unchanged

## Risk Mitigation

### Build Validation

- Run complete build process after each phase
- Verify dual package consumption with test imports
- Check all packages individually and in dependency order

### Rollback Strategy

- Git commit each phase separately for easy rollback
- Maintain backup of current working configuration
- Test CI/CD pipeline behavior before merging

### Testing Coverage

- Automated build verification across all packages
- Type-checking validation for development and production
- Turbo cache effectiveness testing
