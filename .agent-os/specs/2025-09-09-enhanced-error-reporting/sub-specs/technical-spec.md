# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-09-enhanced-error-reporting/spec.md

> Created: 2025-09-09 Version: 1.0.0

## Technical Requirements

### Log Storage Architecture

```
.quality-check/
└── logs/
    ├── errors/          # Error reports from failed checks
    │   ├── eslint-{timestamp}.json
    │   ├── typescript-{timestamp}.json
    │   └── prettier-{timestamp}.json
    └── debug/           # Debug logs and execution traces
        ├── run-{timestamp}.json
        └── performance-{timestamp}.json
```

### Logger Service Enhancements

Extend existing `src/services/Logger.ts` to support dual output modes:

```typescript
interface LoggerConfig {
  console: boolean // Enable/disable console output
  file: boolean // Enable/disable file logging
  silent: boolean // Silent mode for automated tools
  colored: boolean // Enable ANSI colors for console
}

interface ErrorReport {
  timestamp: string
  tool: 'eslint' | 'typescript' | 'prettier'
  status: 'error' | 'warning' | 'success'
  summary: {
    totalErrors: number
    totalWarnings: number
    filesAffected: number
  }
  details: {
    files: Array<{
      path: string
      errors: Array<{
        line: number
        column: number
        message: string
        ruleId?: string
        severity: 'error' | 'warning'
      }>
    }>
  }
  raw: string // Original tool output for debugging
}
```

### OutputFormatter Service

New service for ANSI-colored console output:

```typescript
class OutputFormatter {
  static formatErrorSummary(report: ErrorReport): string
  static formatSuccessSummary(report: ErrorReport): string
  static formatFileList(files: string[]): string
  static colorize(text: string, color: 'red' | 'yellow' | 'green'): string
}
```

### JSON Error Report Schema

Replace XML output with structured JSON:

```json
{
  "timestamp": "2025-09-09T10:30:00.000Z",
  "tool": "eslint",
  "status": "error",
  "summary": {
    "totalErrors": 5,
    "totalWarnings": 2,
    "filesAffected": 3
  },
  "details": {
    "files": [
      {
        "path": "src/example.ts",
        "errors": [
          {
            "line": 42,
            "column": 10,
            "message": "Missing semicolon",
            "ruleId": "semi",
            "severity": "error"
          }
        ]
      }
    ]
  },
  "raw": "<!-- Original ESLint XML output for debugging -->"
}
```

### Claude Facade Integration

Update existing facades to work with new logging system:

1. **ESLint Facade**: Parse ESLint JSON output instead of XML
2. **TypeScript Facade**: Transform TypeScript errors to structured format
3. **Prettier Facade**: Handle Prettier check results consistently
4. **Git Hook Facade**: Support both silent and verbose modes

### File Naming Conventions

- **Error Reports**: `{tool}-{ISO8601-timestamp}.json`
- **Debug Logs**: `run-{ISO8601-timestamp}.json`
- **Performance Logs**: `performance-{ISO8601-timestamp}.json`

### Cleanup Strategy

- Keep last 10 error reports per tool type
- Keep last 5 debug/performance logs
- Clean up on each quality-check run
- Configurable retention via environment variables

## Approach

### Phase 1: Logger Enhancement

1. Extend Logger.ts with dual output support
2. Add JSON file writing capabilities
3. Implement log directory management
4. Add cleanup functionality

### Phase 2: Output Formatting

1. Create OutputFormatter service
2. Implement ANSI color support
3. Design console summary templates
4. Add silent mode support

### Phase 3: Facade Updates

1. Update ESLint facade for JSON parsing
2. Modify TypeScript facade for structured output
3. Update Prettier facade consistency
4. Enhance Git Hook facade for mode support

### Phase 4: Integration & Testing

1. Wire new components together
2. Add comprehensive tests
3. Update CLI argument handling
4. Test with Claude Code scenarios

## External Dependencies

### Required Packages

- `chalk` or `picocolors`: ANSI color support for console output
- `pino` (existing): JSON logging capabilities
- `fs-extra` (existing): File system operations

### Optional Enhancements

- `cli-table3`: Formatted table output for summaries
- `strip-ansi`: Clean output for file storage
- `date-fns`: Enhanced timestamp formatting

## Benefits

### Context Reduction

- **Before**: 2000+ tokens for typical ESLint XML output
- **After**: 50-100 tokens for colored summary
- **Reduction**: 95-98% context savings

### Developer Experience

- Clean, readable console output
- Immediate error understanding
- Organized log storage
- No context pollution

### Claude Agent Efficiency

- Structured JSON access
- Minimal context usage
- Precise error targeting
- Fast analysis capabilities

### Maintainability

- Centralized logging logic
- Consistent error formats
- Automated cleanup
- Debug-friendly raw data storage
