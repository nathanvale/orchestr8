# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-08-31-dx-cleanup-code-smells/spec.md

> Created: 2025-08-31 Version: 1.0.0

## Technical Requirements

### Type Safety Requirements

- **Eliminate all `any` types** across the entire codebase
- **Add explicit return types** to every function and method
- **Implement strict boolean expressions** per ESLint configuration
- **Create type guards** for runtime type checking
- **Use discriminated unions** instead of boolean flags
- **Replace type assertions** with proper type narrowing

### Script Organization Requirements

- **Categorize 94+ scripts** into logical groups (dev, test, build, release, dx,
  security)
- **Create interactive help system** using inquirer or similar
- **Implement command aliases** for common workflows
- **Add script documentation** inline and in README
- **Create unified commands** for multi-service operations
- **Implement port conflict detection** for development servers

### Error Handling Requirements

- **Create base error classes** for different error categories
- **Implement structured logging** with consistent format
- **Add error recovery strategies** for network failures
- **Create error boundary patterns** for React components
- **Standardize error messages** with actionable suggestions
- **Implement retry logic** with exponential backoff

### Security Requirements

- **Fix SBOM generation** ESM/CommonJS compatibility issue
- **Implement supply chain scanning** with multiple databases
- **Add input sanitization** for all user inputs
- **Prevent command injection** in script execution
- **Create security baseline** tracking system
- **Implement vulnerability alerting** for new CVEs

### Performance Requirements

- **Achieve <5s test execution** for unit tests
- **Maintain <10min CI/CD runs** with optimization
- **Implement <10s context recovery** via dx:status
- **Create <2s build times** for warm builds
- **Achieve >85% Turbo cache hit rate** in CI
- **Maintain 85% minimum test coverage** with ratcheting

## Approach Options

### Type Safety Approach

**Option A: Manual Type Fixes**

- Pros: Full control over each change, educational for team
- Cons: Time-consuming, prone to human error, inconsistent patterns

**Option B: Automated Type Migration with Manual Review** (Selected)

- Pros: Consistent patterns, faster execution, comprehensive coverage
- Cons: Requires careful review, may need manual adjustments

**Rationale:** Automated migration ensures consistency across the large codebase
while manual review ensures quality and catches edge cases.

### Script Organization Approach

**Option A: Flat Script Structure**

- Pros: Simple, no additional tooling needed
- Cons: Doesn't solve discoverability problem

**Option B: Hierarchical Categories with Interactive Explorer** (Selected)

- Pros: Excellent discoverability, reduces cognitive load, ADHD-friendly
- Cons: Requires additional tooling setup

**Rationale:** The interactive explorer directly addresses the ADHD developer
persona's needs and dramatically improves script discoverability.

### Error Handling Approach

**Option A: Ad-hoc Error Handling**

- Pros: Flexible, minimal overhead
- Cons: Inconsistent, hard to maintain

**Option B: Centralized Error Handling with Custom Classes** (Selected)

- Pros: Consistent patterns, better debugging, easier maintenance
- Cons: Initial setup overhead

**Rationale:** Centralized error handling provides the consistency needed for
enterprise-grade applications and improves debugging efficiency.

## External Dependencies

### New Development Dependencies

- **@typescript-eslint/parser** - Enhanced TypeScript parsing for better type
  checking
  - **Justification:** Required for strict type checking rules

- **inquirer** - Interactive command-line user interfaces
  - **Justification:** Needed for script discovery system

- **chalk** - Terminal string styling
  - **Justification:** Visual feedback for ADHD-friendly output

- **ora** - Elegant terminal spinners
  - **Justification:** Progress indicators for long operations

### Security Dependencies

- **@cyclonedx/cdxgen** - SBOM generation tool (update to latest)
  - **Justification:** Fix ESM compatibility issues

- **osv-scanner** - Google's OSV vulnerability scanner
  - **Justification:** Additional vulnerability database coverage

## Implementation Strategy

### Phase 1: Critical Fixes (Day 1)

1. Fix SBOM generation ESM issue
2. Replace high-risk `any` types
3. Create unified dev command

### Phase 2: Type Safety (Days 2-3)

1. Systematic `any` elimination
2. Add return types to all functions
3. Implement type guards

### Phase 3: Script Organization (Days 4-5)

1. Categorize all scripts
2. Create interactive explorer
3. Add documentation

### Phase 4: Error Handling (Days 6-7)

1. Create error utilities
2. Refactor error handling
3. Add logging framework

### Phase 5: Build Optimization (Days 8-9)

1. Optimize CI/CD pipeline
2. Improve caching strategies
3. Consolidate configurations

## Code Smell Patterns to Address

### Pattern 1: Excessive `any` Usage

```typescript
// ❌ BEFORE - Code Smell
function processData(data: any): any {
  return data.map((item: any) => item.value)
}

// ✅ AFTER - Type Safe
interface DataItem {
  value: string
  timestamp: number
}

function processData(data: DataItem[]): string[] {
  return data.map((item) => item.value)
}
```

### Pattern 2: Missing Error Handling

```typescript
// ❌ BEFORE - Code Smell
execSync(`npm install ${packageName}`)

// ✅ AFTER - Proper Error Handling
try {
  const result = execSync(`npm install ${packageName}`, {
    encoding: 'utf-8',
    timeout: 30000,
  })
  logger.info(`Package ${packageName} installed successfully`)
  return result
} catch (error) {
  if (error instanceof Error) {
    throw new PackageInstallError(
      `Failed to install ${packageName}: ${error.message}`,
      { cause: error, package: packageName },
    )
  }
  throw error
}
```

### Pattern 3: Complex Unorganized Scripts

```typescript
// ❌ BEFORE - Code Smell
// 94+ scripts in flat structure in package.json
"scripts": {
  "test": "vitest",
  "test:watch": "vitest watch",
  "build": "turbo build",
  "dev": "turbo dev",
  // ... 90 more scripts
}

// ✅ AFTER - Organized Categories
"scripts": {
  // Core Development
  "dev": "turbo dev",
  "dev:all": "node scripts/dev-orchestrator.js",
  "build": "turbo build",
  "test": "vitest",

  // DX Tools
  "dx:status": "node scripts/dx-status.js",
  "dx:help": "node scripts/interactive-help.js",

  // Organized with clear categories
}
```

### Pattern 4: Inconsistent Boolean Expressions

```typescript
// ❌ BEFORE - Code Smell
if (value) { ... }
if (array.length) { ... }

// ✅ AFTER - Explicit Checks
if (value != null && value !== '') { ... }
if (array.length > 0) { ... }
```

## Success Metrics

### Quantitative Metrics

- 0 `any` types remaining (from ~20+)
- 85% test coverage maintained
- <10 minute CI/CD runs (from ~15 min)
- <5 second test execution (warm)
- > 300 components in SBOM (from 0)

### Qualitative Metrics

- Improved code maintainability score
- Reduced cognitive load for developers
- Enhanced security posture
- Better error debugging experience
- Faster onboarding for new developers

## Risk Mitigation

### Risk: Breaking Changes During Cleanup

**Mitigation:** Comprehensive test coverage before changes, incremental changes
with validation

### Risk: Performance Regression

**Mitigation:** Benchmark critical paths, use performance profiling, maintain
metrics

### Risk: Team Resistance to New Patterns

**Mitigation:** Clear documentation, gradual rollout, team training sessions

## Validation Strategy

### Pre-Implementation Validation

- Run full test suite
- Capture baseline metrics
- Document current state

### During Implementation Validation

- Test after each change
- Validate type safety with strict mode
- Check performance metrics

### Post-Implementation Validation

- Full regression testing
- Security scan validation
- Performance benchmarking
- Developer satisfaction survey
