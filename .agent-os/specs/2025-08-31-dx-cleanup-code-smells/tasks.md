# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-08-31-dx-cleanup-code-smells/spec.md

> Created: 2025-08-31 Status: Ready for Implementation

## Tasks

- [ ] 1. Fix Critical Security Issues
  - [ ] 1.1 Write tests for SBOM generation fix
  - [ ] 1.2 Implement direct cdxgen execution without eval (lines 707-717 of
        security-scan.ts)
  - [ ] 1.3 Add fallback methods for cdxgen execution
  - [ ] 1.4 Validate SBOM output has >300 components
  - [ ] 1.5 Create command sanitization utilities in
        scripts/lib/command-utils.ts
  - [ ] 1.6 Implement path traversal prevention in scripts/lib/path-utils.ts
  - [ ] 1.7 Add vulnerability scanning with OSV.dev API
  - [ ] 1.8 Verify all security tests pass

- [ ] 2. Implement Type Safety Improvements
  - [ ] 2.1 Write tests for type guards and validators
  - [ ] 2.2 Replace all `any` types in turborepo-validation.test.ts
  - [ ] 2.3 Fix test-utils.tsx generic types in packages/utils
  - [ ] 2.4 Add explicit return types to all functions
  - [ ] 2.5 Implement strict boolean expressions
  - [ ] 2.6 Create type guard utilities in scripts/lib/type-guards.ts
  - [ ] 2.7 Add Result<T, E> discriminated union pattern
  - [ ] 2.8 Fix floating promises with proper handling
  - [ ] 2.9 Verify TypeScript strict mode passes

- [ ] 3. Create Error Handling Infrastructure
  - [ ] 3.1 Write tests for custom error classes
  - [ ] 3.2 Create base error hierarchy in scripts/lib/errors.ts
  - [ ] 3.3 Implement structured logger in scripts/lib/logger.ts
  - [ ] 3.4 Add retry utility with exponential backoff in scripts/lib/retry.ts
  - [ ] 3.5 Create global error handlers in scripts/lib/process-handler.ts
  - [ ] 3.6 Add React error boundaries in
        apps/app/src/components/ErrorBoundary.tsx
  - [ ] 3.7 Update all scripts to use new error handling patterns
  - [ ] 3.8 Verify error handling tests pass

- [ ] 4. Refactor and Organize Scripts
  - [ ] 4.1 Write tests for script organization system
  - [ ] 4.2 Create script categories in package.json (dev, test, build, dx,
        security)
  - [ ] 4.3 Implement interactive help system using inquirer
  - [ ] 4.4 Build dx:help command for script discovery
  - [ ] 4.5 Refactor security-scan.ts into modular components
  - [ ] 4.6 Create unified validation pipeline
  - [ ] 4.7 Add command aliases for common workflows
  - [ ] 4.8 Verify all scripts work after reorganization

- [ ] 5. Optimize CI/CD Pipeline
  - [ ] 5.1 Write tests for CI optimization
  - [ ] 5.2 Update turbo.jsonc with precise input patterns
  - [ ] 5.3 Configure Turbo remote caching with Vercel
  - [ ] 5.4 Implement GitHub Actions matrix parallelization
  - [ ] 5.5 Create reusable workflow actions in .github/actions/
  - [ ] 5.6 Optimize Docker builds with multi-stage Dockerfile
  - [ ] 5.7 Add test sharding for parallel execution
  - [ ] 5.8 Implement affected package detection
  - [ ] 5.9 Verify CI runs complete in <10 minutes

## Validation

After completing all tasks:

- [ ] Run full validation checklist from sub-specs/validation-checklist.md
- [ ] Ensure all tests pass with ≥85% coverage
- [ ] Verify no TypeScript errors remain
- [ ] Confirm SBOM generation works correctly
- [ ] Check CI/CD runs in <10 minutes
- [ ] Validate all performance targets met

## Success Criteria

- **Type Safety**: 0 `any` types remaining, all functions have return types
- **Error Handling**: Comprehensive error classes, structured logging, retry
  logic
- **Script Organization**: <30 top-level scripts, interactive help system
- **Security**: SBOM generation fixed, >300 components, vulnerability scanning
- **Performance**: <5s test execution, <2s builds, <10min CI runs
- **Coverage**: ≥85% test coverage with ratcheting enabled

## Notes

- Follow TDD approach: write tests first for each component
- Use the detailed guides in sub-specs/ for implementation patterns
- Ensure all changes are backward compatible
- Document any breaking changes if absolutely necessary
- Run validation checklist after each major task completion
