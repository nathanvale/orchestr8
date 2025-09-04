# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-04-autopilot-engine/spec.md

> Created: 2025-09-04 Version: 1.0.0

## Technical Requirements

### Core Components

- **Autopilot Class** - Main decision engine (~100 lines) with rule
  classification and decision logic
- **Rule Sets** - Three immutable sets containing rule categories: ALWAYS_SAFE
  (54 rules), CONTEXT_DEPENDENT (5 rules), NEVER_AUTO (11+ rules)
- **Classification Engine** - Method to categorize issues based on rule type and
  context analysis
- **Context Analyzer** - File path analysis to determine if files are tests,
  development, or production code
- **Decision Logic** - Returns structured decisions: FIX_SILENTLY,
  FIX_AND_REPORT, REPORT_ONLY, or CONTINUE

### Performance Criteria

- **Classification Speed** - Complete analysis in <10ms for typical file with
  5-10 issues
- **Memory Usage** - Stateless design with minimal memory footprint (<1MB)
- **CPU Efficiency** - Simple rule lookup using Set.has() for O(1) performance

### Integration Requirements

- **Type Safety** - Full TypeScript coverage with explicit interfaces for
  AutopilotDecision and Classification
- **Error Handling** - Graceful degradation on unknown rules (default to
  conservative/unsafe)
- **API Compatibility** - Clean integration with existing CheckResult interface
  from quality-checker

## Approach Options

**Option A: Machine Learning Classification**

- Pros: Could learn from patterns, potentially more accurate over time
- Cons: Complex implementation, training data needed, black box decisions,
  performance overhead

**Option B: Rule-Based Classification with Static Sets** (Selected)

- Pros: Transparent decisions, fast performance, zero dependencies, predictable
  behavior
- Cons: Requires manual rule maintenance, cannot adapt without code changes

**Option C: Configurable Rule System**

- Pros: User customization, team-specific rules
- Cons: Complexity overhead, configuration management, potential for
  misconfiguration

**Rationale:** Option B provides the right balance of simplicity, performance,
and safety. The rule sets are based on years of ESLint community experience and
can be updated through package releases as needed.

## External Dependencies

**None Required**

- **Justification:** The autopilot operates on existing CheckResult data from
  the quality-checker, requires no additional packages, and uses only built-in
  TypeScript/JavaScript features for maximum reliability and minimal attack
  surface.

## Implementation Details

### Rule Classification Strategy

```typescript
// Always Safe - 54 rules covering:
- Formatting (28 rules): spaces, commas, quotes, indentation
- Import organization (4 rules): ordering, duplicates, newlines
- Safe modernization (11 rules): ES6+ transformations that are equivalent
- Dead code removal (6 rules): unused variables, unreachable code
- Simplification (9 rules): equivalent but cleaner syntax

// Context-Dependent - 5 rules requiring file analysis:
- no-console: Safe in production files, keep in test/dev files
- no-debugger: Always safe to remove
- no-alert: Unsafe in browser UI files
- @typescript-eslint/no-explicit-any: Safe to convert to unknown
- no-var: Safe to modernize to let/const

// Never Auto - 11+ rules requiring human judgment:
- Type safety issues
- Security vulnerabilities
- Complexity/architecture issues
- Undefined references
```

### Context Analysis Logic

```typescript
// File type detection:
- Test files: .test., .spec., __tests__ in path
- Dev files: .dev., debug, development in path
- UI files: .tsx, .jsx extensions
- Production files: everything else
```

### Decision Flow

1. **Input**: CheckResult with array of issues
2. **Classify**: Each issue into autoFixable, contextFixable, or unfixable
3. **Context Check**: For context-dependent rules, analyze file path
4. **Decision**: Return appropriate action with confidence level
5. **Output**: Structured decision object for facade consumption

### Error Handling Strategy

- **Unknown Rules** - Default to unfixable (conservative approach)
- **Context Analysis Failure** - Assume production file (safer choice)
- **Classification Errors** - Log and continue with unfixable classification
- **Never Crash** - All methods have proper error boundaries
