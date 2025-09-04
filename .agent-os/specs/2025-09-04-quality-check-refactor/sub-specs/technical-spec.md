# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-04-quality-check-refactor/spec.md

> Created: 2025-09-04 Version: 1.0.0

## Technical Requirements

### Core Architecture

- Facade pattern with shared core logic (~200 lines)
- Four thin facades (~50 lines each): CLI, Hook, Pre-commit, API
- Adapters for extensibility (Autopilot, future additions)
- Simple conditional logic instead of complex routers
- TypeScript with full type safety

### Performance Criteria

- <2s processing time for typical file operations
- Minimal memory footprint
- Zero dependencies on external services
- Graceful degradation on errors

### Integration Requirements

- Works with existing ESLint, Prettier, TypeScript configurations
- Compatible with git hooks infrastructure
- Stdin/stdout interface for Claude hook
- Programmatic API returns structured results

## Approach Options

**Option A:** Complete rewrite from scratch

- Pros: Clean slate, perfect architecture
- Cons: Throws away working code, risky, time-consuming

**Option B:** Refactor in place (Selected)

- Pros: Preserves working logic, lower risk, faster delivery
- Cons: Need to carefully extract and reorganize

**Rationale:** We have working quality checking logic. The issue is organization
and complexity, not functionality. Refactoring preserves what works while
simplifying the structure.

## Implementation Details

### Directory Structure

```
packages/quality-check/
├── src/
│   ├── core/
│   │   ├── quality-checker.ts      # Main checking logic (~150 lines)
│   │   └── types.ts                 # Shared types (~50 lines)
│   ├── facades/
│   │   ├── cli.ts                   # CLI entry point (~50 lines)
│   │   ├── hook.ts                  # Git hook facade (~50 lines)
│   │   ├── pre-commit.ts            # Pre-commit facade (~50 lines)
│   │   └── api.ts                   # Programmatic API (~50 lines)
│   ├── adapters/
│   │   └── autopilot.ts             # Classification & auto-fix (~100 lines)
│   └── index.ts                     # Public exports (~40 lines)
```

### Core Logic Extraction

```typescript
// core/quality-checker.ts
export class QualityChecker {
  async check(files: string[], options: CheckOptions): Promise<CheckResult> {
    // Run ESLint, Prettier, TypeScript checks
    // Return structured results
  }

  async fix(files: string[], options: FixOptions): Promise<FixResult> {
    // Apply safe fixes
    // Return what was fixed
  }
}
```

### Facade Pattern

```typescript
// facades/cli.ts
export async function runCLI(args: string[]): Promise<void> {
  const checker = new QualityChecker()
  const files = parseArgs(args)
  const result = await checker.check(files, { fix: args.includes('--fix') })

  if (result.hasErrors && !args.includes('--fix')) {
    console.error(formatErrors(result.errors))
    process.exit(1)
  }

  if (args.includes('--fix')) {
    const fixed = await checker.fix(files, { safe: true })
    console.log(`Fixed ${fixed.count} issues`)
  }
}
```

### Autopilot Classification

```typescript
// adapters/autopilot.ts
export class Autopilot {
  private safeRules = [
    'prettier/prettier',
    'indent',
    'quotes',
    'semi',
    'comma-dangle',
    // ... other safe auto-fix rules
  ]

  classify(error: QualityError): 'safe' | 'needs-review' | 'critical' {
    if (this.safeRules.includes(error.rule)) return 'safe'
    if (error.severity === 'error') return 'critical'
    return 'needs-review'
  }

  async autoFix(errors: QualityError[]): Promise<FixResult> {
    const safeErrors = errors.filter((e) => this.classify(e) === 'safe')
    // Apply fixes only for safe errors
  }
}
```

## External Dependencies

No new dependencies required. Uses existing:

- **ESLint** - Already installed, for linting
- **Prettier** - Already installed, for formatting
- **TypeScript** - Already installed, for type checking

## Migration Path

1. Create new directory structure alongside existing code
2. Extract core logic from current implementation
3. Build facades one by one, testing each
4. Replace current index.ts with new facade exports
5. Delete old enforcement/ directory
6. Update tests to use new structure
