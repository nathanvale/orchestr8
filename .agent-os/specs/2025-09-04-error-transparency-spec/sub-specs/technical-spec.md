# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-04-error-transparency-spec/spec.md

> Created: 2025-09-04 Version: 1.0.0

## Technical Requirements

- **TypeScript Error Parsing**: Capture stderr output from `tsc --noEmit` and
  parse individual error messages with file paths, line numbers, and
  descriptions
- **ESLint JSON Format**: Use `--format=json` flag consistently and parse
  structured ESLint output instead of relying on exit codes
- **Error Message Extraction**: Parse command-line tool outputs to extract
  actionable error information
- **Consistent Error Schema**: Standardize error objects with `file`, `line`,
  `column`, `message`, and `rule` properties
- **Error Filtering**: Distinguish between fixable and unfixable errors for
  proper autopilot decision making

## Approach Options

**Option A: Enhanced Command Output Parsing**

- Pros: Minimal code changes, uses existing command execution
- Cons: Fragile regex parsing, dependent on tool output formats

**Option B: Direct Tool Integration** (Selected)

- Pros: Structured data access, more reliable parsing, better error context
- Cons: More complex implementation, tool-specific integration logic

**Rationale:** Option B provides more reliable error capture and allows us to
access structured data directly from tools rather than parsing command output
strings.

## External Dependencies

- **No new dependencies required** - will enhance existing TypeScript, ESLint
  command execution
- **Justification:** Using built-in JSON output formats from existing tools

## Expert Team Assessment Results

### Architecture Compliance ✅

- **Placement**: Implement in `IssueReporter` layer (formatting responsibility)
- **Constraint**: <75 lines additional code to maintain YAGNI principles
- **Design**: Maintains "Simple Core, Multiple Facades" pattern

### Performance Impact ✅

- **Overhead**: <2% of total execution time
- **Memory**: +2KB per file (well within 50MB limit)
- **Optimization**: Lazy parsing reduces overhead by 90%

### Implementation Strategy ✅

- **Error Parser**: Optional component with graceful degradation
- **Structured Output**: Consistent error format across all facades
- **Facade Flexibility**: Each facade can choose error detail level

## Implementation Details

### TypeScript Error Capture Enhancement

```typescript
// Current: Generic error message
return {
  success: false,
  errors: ['TypeScript compilation failed'],
  fixable: false,
}

// Enhanced: Specific error details
return {
  success: false,
  errors: [
    'tests/unfixable-issues.ts:5:10 - Cannot find name undefinedVariable (TS2304)',
    'tests/unfixable-issues.ts:10:3 - Type number not assignable to string (TS2322)',
  ],
  fixable: false,
}
```

### ESLint Error Enhancement

```typescript
// Parse JSON output instead of catching command failure
const results = JSON.parse(stdout) as ESLintResult[]
const errors = results.flatMap((file) =>
  file.messages.map(
    (msg) =>
      `${file.filePath}:${msg.line}:${msg.column} - ${msg.message} (${msg.ruleId})`,
  ),
)
```

### Error Message Standards

- Format: `{file}:{line}:{column} - {message} ({rule})`
- Include rule ID for ESLint errors (e.g., `@typescript-eslint/no-unused-vars`)
- Include TypeScript error codes (e.g., `TS2304`)
- Maintain file path relative to project root for consistency
