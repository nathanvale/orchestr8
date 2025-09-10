# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-09-fix-first-hooks-architecture/spec.md

> Created: 2025-09-09 Version: 1.0.0

## Technical Requirements

### Core Architecture Changes

1. **QualityChecker Flow Restructure** - Change orchestration from
   check-decide-fix to fix-check pattern
2. **Engine Integration Optimization** - Use built-in engine fix capabilities
   instead of external execSync calls
3. **Auto-staging Implementation** - Automatically stage fixed files using git
   add after successful fixes
4. **Error Reporting Filter** - Only surface unfixable issues to reduce Claude
   feedback noise by 99%+

### Performance Requirements

- **50% execution time reduction** by eliminating duplicate ESLint/Prettier runs
- **Sub-second response time** for most fix operations
- **Memory efficiency** by avoiding double tool instantiation

### Git Integration Requirements

- **Atomic fix commits** - Include fixes in the same commit as feature changes
- **Clean history preservation** - Eliminate separate "style:" commits
- **Staging automation** - Auto-stage successfully fixed files

## Approach

### Current Architecture (Problematic)

```
File Edit → QualityChecker → [ESLint.check(), Prettier.check(), TypeScript.check()]
→ Autopilot.analyze() → Fixer.execSync('eslint --fix') → Report remaining issues
```

**Problems:**

- Double tool execution (check mode + fix mode)
- All issues reported initially (including fixable ones)
- Manual git staging required after fixes
- Complex result format conversion (V1/V2)

### New Fix-First Architecture

```
File Edit → QualityChecker → [ESLint.check({fix:true}), Prettier.check({fix:true})]
→ Git.add(fixedFiles) → TypeScript.check() → Report unfixable only
```

**Benefits:**

- Single tool execution with immediate fixes
- Only unfixable issues reported to Claude
- Automatic git staging of fixes
- Simplified result handling

### Implementation Strategy

#### Phase 1: Core Flow Restructure

- Modify `QualityChecker.execute()` to run fixable engines with fix flag enabled
- Update engine execution order: fix-capable engines first, then check-only
  engines
- Implement auto-staging logic for modified files

#### Phase 2: Engine Integration

- Update `ESLintEngine.check()` to accept and use fix parameter
- Update `PrettierEngine.check()` to accept and use fix parameter
- Remove external execSync calls from `Fixer` adapter

#### Phase 3: Reporting Optimization

- Filter out fixed issues from final report
- Simplify result format handling
- Update IssueReporter to handle fix-first results

### Key File Modifications

1. **quality-checker.ts** - Main orchestration changes
2. **eslint-engine.ts** - Built-in fix mode integration
3. **prettier-engine.ts** - Built-in fix mode integration
4. **fixer.ts** - Simplification or elimination
5. **git-hook.ts** - Auto-staging implementation

### Backward Compatibility

- Maintain existing hook interface contracts
- Preserve current error reporting format for non-fix scenarios
- Keep existing Autopilot decision rules intact
- Support fallback to check-then-fix for edge cases

## External Dependencies

No new external dependencies required. The implementation leverages existing
capabilities:

- **ESLint** - Already supports --fix flag and programmatic fix mode
- **Prettier** - Already supports --write flag and programmatic formatting
- **Git** - Standard git add command for auto-staging
