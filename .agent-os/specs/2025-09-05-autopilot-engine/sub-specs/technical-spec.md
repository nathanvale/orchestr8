# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-05-autopilot-engine/spec.md

> Created: 2025-09-05 Version: 1.0.0 Time Estimate: 4-6 hours

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
- **Automation Rate** - >80% of common issues fixed automatically
- **False Positives** - 0% through conservative unknown rule handling

### Integration Requirements

- **Type Safety** - Full TypeScript coverage with explicit interfaces for
  AutopilotDecision and Classification
- **Error Handling** - Graceful degradation on unknown rules (default to
  conservative/unsafe)
- **API Compatibility** - Clean integration with existing CheckResult interface
  from quality-checker
- **Exit Strategies** - Process.exit(0) for silent success, appropriate exit
  codes for reporting

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

## Implementation Details

### Complete Rule Sets Definition

#### Tier 1: Always Safe Rules (54 total)

**Formatting Rules (28):**

```typescript
;('prettier/prettier',
  'indent',
  'semi',
  'semi-spacing',
  'semi-style',
  'quotes',
  'quote-props',
  'jsx-quotes',
  'comma-dangle',
  'comma-spacing',
  'comma-style',
  'space-before-blocks',
  'space-before-function-paren',
  'space-in-parens',
  'space-infix-ops',
  'space-unary-ops',
  'object-curly-spacing',
  'array-bracket-spacing',
  'computed-property-spacing',
  'func-call-spacing',
  'key-spacing',
  'keyword-spacing',
  'no-trailing-spaces',
  'no-whitespace-before-property',
  'padded-blocks',
  'padding-line-between-statements',
  'eol-last',
  'linebreak-style',
  'no-multiple-empty-lines')
```

**Import Organization (4):**

```typescript
;('import/order',
  'import/newline-after-import',
  'import/no-duplicates',
  'sort-imports')
```

**Safe Modernization (11):**

```typescript
;('prefer-const',
  'prefer-template',
  'template-curly-spacing',
  'prefer-arrow-callback',
  'arrow-spacing',
  'arrow-parens',
  'arrow-body-style',
  'object-shorthand',
  'prefer-destructuring',
  'no-useless-rename')
```

**Dead Code Removal (6):**

```typescript
;('no-unused-vars',
  'no-unreachable',
  'no-empty',
  'no-useless-return',
  'no-useless-catch',
  'no-useless-constructor')
```

**Simplification (9):**

```typescript
;('no-extra-boolean-cast',
  'no-extra-parens',
  'no-extra-semi',
  'yoda',
  'no-unneeded-ternary',
  'no-else-return',
  'no-lonely-if',
  'operator-assignment',
  'prefer-numeric-literals')
```

#### Tier 2: Context-Dependent Rules (5 total)

```typescript
;('no-console', // Safe to remove in production, keep in test/dev
  'no-debugger', // Always safe to remove
  'no-alert', // Safe to remove in Node.js, check for browser
  '@typescript-eslint/no-explicit-any', // Safe to convert to unknown
  'no-var') // Safe to modernize to let/const
```

#### Tier 3: Never Auto Rules (11+)

```typescript
;('no-undef', // Undefined variables
  'no-unused-expressions', // Might be intentional
  'complexity', // Requires refactoring
  'max-lines-per-function', // Requires decomposition
  'max-depth', // Requires restructuring
  'max-statements', // Requires splitting
  'security/detect-object-injection', // Security issue
  'security/detect-non-literal-regexp', // Security issue
  '@typescript-eslint/no-unsafe-assignment', // Type safety
  '@typescript-eslint/no-unsafe-call', // Type safety
  '@typescript-eslint/no-unsafe-member-access') // Type safety
```

### Context Analysis Logic

```typescript
// File type detection patterns:
const isTestFile =
  file.includes('.test.') ||
  file.includes('.spec.') ||
  file.includes('__tests__')

const isDevFile =
  file.includes('.dev.') ||
  file.includes('debug') ||
  file.includes('development')

const isUIFile =
  file.endsWith('.tsx') ||
  file.endsWith('.jsx')

// Context-specific decisions:
'no-console': isTestFile || isDevFile ? KEEP : REMOVE
'no-debugger': ALWAYS_REMOVE
'no-alert': isUIFile ? KEEP : REMOVE
'@typescript-eslint/no-explicit-any': CONVERT_TO_UNKNOWN
'no-var': CONVERT_TO_LET_CONST
```

### Decision Flow Algorithm

1. **Input**: CheckResult with array of issues
2. **Classify**: Each issue into autoFixable, contextFixable, or unfixable
3. **Context Check**: For context-dependent rules, analyze file path
4. **Decision**: Return appropriate action with confidence level
5. **Output**: Structured decision object for facade consumption

```typescript
if (allAutoFixable) return 'FIX_SILENTLY'
if (hasAutoFixable && hasUnfixable) return 'FIX_AND_REPORT'
if (hasUnfixable) return 'REPORT_ONLY'
return 'CONTINUE'
```

### Error Handling Strategy

- **Unknown Rules** - Default to unfixable (conservative approach)
- **Context Analysis Failure** - Assume production file (safer choice)
- **Classification Errors** - Log and continue with unfixable classification
- **Never Crash** - All methods have proper error boundaries
- **Fix Verification** - Trust ESLint's fixable flag for always-safe rules

## Type Definitions

```typescript
export interface AutopilotDecision {
  action: 'FIX_SILENTLY' | 'FIX_AND_REPORT' | 'REPORT_ONLY' | 'CONTINUE'
  fixes?: Issue[]
  issues?: Issue[]
  confidence: number
}

export interface Classification {
  autoFixable: Issue[]
  contextFixable: Issue[]
  unfixable: Issue[]
  allAutoFixable: boolean
  hasAutoFixable: boolean
  hasUnfixable: boolean
}

export interface Issue {
  rule: string
  fixable: boolean
  file: string
  message?: string
  severity?: 'error' | 'warning'
}
```

## Integration Patterns

### Claude Facade Integration

```typescript
const autopilot = new Autopilot()
const decision = autopilot.decide(result)

switch (decision.action) {
  case 'FIX_SILENTLY':
    await applyFixes(decision.fixes)
    process.exit(0) // Silent success

  case 'FIX_AND_REPORT':
    await applyFixes(decision.fixes)
    reportIssues(decision.issues)
    process.exit(0)

  case 'REPORT_ONLY':
    reportIssues(decision.issues)
    process.exit(0)
}
```

### CLI Integration (Optional)

```typescript
if (options.autopilot) {
  const decision = autopilot.decide(result)

  if (decision.action === 'FIX_SILENTLY') {
    console.log('✅ Auto-fixed all issues')
  } else {
    console.log(
      `⚠️ ${decision.fixes?.length || 0} fixed, ${decision.issues?.length || 0} need attention`,
    )
  }
}
```

## Key Design Decisions

### Why These Safe Rules?

- Based on ESLint's own --fix confidence levels
- Only style/formatting changes, no semantic changes
- Thousands of hours of community testing and validation

### Why Context Checking?

- console.log is useful in tests but not production
- Different rules for different file types improves accuracy
- Smarter than blanket rules reduces false positives

### Why Conservative on Unknown?

- Better to report than break code
- Can add rules as confidence grows through usage
- User trust is paramount for adoption

## External Dependencies

None - this is a zero-dependency implementation using only built-in
JavaScript/TypeScript features and standard library functions.
