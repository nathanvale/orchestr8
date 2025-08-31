# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-08-30-claude-code-ai-hooks-system/spec.md

> Created: 2025-08-30 Version: 2.0.0 - MVP Focused

## Technical Requirements

### Core Package Architecture (MVP)

**Package Name:** `@claude-hooks/snapcheck` **Target Environment:** Node.js 20
LTS+, TypeScript 5.7+ **Package Manager Support:** npm, pnpm, yarn
**Installation Method:** `npm install --save-dev @claude-hooks/snapcheck`

#### Simplified Package Structure (MVP)

```
@claude-hooks/snapcheck/
├── package.json                          # Main package configuration
├── bin/
│   └── snapcheck                         # CLI executable
├── src/
│   ├── cli.ts                           # CLI entry point
│   ├── handlers/
│   │   └── post-tool-handler.ts         # PostToolUse hook processor (MVP focus)
│   ├── validators/
│   │   ├── eslint-validator.ts          # ESLint programmatic API integration
│   │   ├── prettier-validator.ts        # Prettier in-memory API integration
│   │   └── base-validator.ts            # Abstract base validator
│   ├── formatters/
│   │   ├── ai-compact.ts               # Token-efficient JSON formatter
│   │   └── human-readable.ts           # Human-friendly output formatter
│   └── types/
│       ├── claude-hooks.ts             # Claude Code hook interfaces
│       ├── validation-results.ts       # Validation result schemas
│       └── config.ts                   # Configuration types
├── templates/
│   └── settings.json                   # Claude settings template
└── docs/                               # Essential documentation
```

### Claude Code Hooks API Integration (MVP Focus)

#### PostToolUse Hook Input Protocol Compliance

**Input Schema Processing (PostToolUse only):**

```typescript
interface ClaudePostToolUseInput {
  session_id: string
  transcript_path: string
  cwd: string
  hook_event_name: 'PostToolUse'
  tool_name?: string
  tool_input?: Record<string, unknown>
  tool_response?: Record<string, unknown>
}
```

**Environment Integration:**

- Use `$CLAUDE_PROJECT_DIR` for project-relative paths
- Respect `cwd` for command execution context
- Handle 60-second timeout constraint with <2s completion targets
- Focus on single file validation when tool_input contains file paths

#### Hook Output Protocol Compliance

**Exit Code Strategy:**

```typescript
enum HookExitCode {
  SUCCESS = 0, // Continue processing, show stdout to user
  BLOCK_WITH_FEEDBACK = 2, // Block and send stderr to Claude
  NON_BLOCKING_ERROR = 1, // Show error to user but continue
}
```

**JSON Response Format:**

```typescript
interface HookResponse {
  continue?: boolean // Whether Claude should continue
  stopReason?: string // Message when continue = false
  suppressOutput?: boolean // Hide from transcript mode
  systemMessage?: string // Warning to user
  decision?: 'block' | 'approve' | 'ask' // Flow control decision
  reason?: string // Explanation for decision
  hookSpecificOutput?: {
    hookEventName: string
    permissionDecision?: 'allow' | 'deny' | 'ask'
    permissionDecisionReason?: string
    additionalContext?: string // Context for Claude
  }
}
```

### Tool Integration Requirements (MVP - Explicit Configuration)

#### Explicit Configuration System

```typescript
interface ExplicitToolConfig {
  eslint: {
    command: string[] // User-provided: ["pnpm", "eslint", "--format", "json"]
    enabled: boolean
  }
  prettier: {
    command: string[] // User-provided: ["pnpm", "prettier", "--check"]
    enabled: boolean
  }
}

// No auto-detection - user provides explicit commands in settings.json
```

#### Validation Pipeline

```typescript
interface ValidationPipeline {
  validateFile(filePath: string, tools?: string[]): Promise<ValidationResult>
  validateProject(tools?: string[]): Promise<ValidationResult[]>
  formatForAI(results: ValidationResult[]): CompactValidationResult
  formatForClaude(results: ValidationResult[]): ClaudeValidationFeedback
}
```

### Token-Optimized JSON Schema

#### Compact Issue Format

```typescript
interface CompactIssue {
  f: string // file (relative path, max 100 chars)
  l: number // line number
  c: number // column number
  r: string // rule/error code (max 50 chars)
  s: 1 | 2 | 3 // severity (1=info, 2=warning, 3=error)
  m: string // message (truncated to max 150 chars)
  fix?: string // auto-fix suggestion (max 100 chars)
  cat?: string // category (style|logic|security|performance)
}
```

#### Aggregated Results Format

```typescript
interface CompactValidationResult {
  ts: number // timestamp (Unix)
  sid?: string // session_id (if available)
  tool: string // validator name
  dur: number // duration in ms
  files: number // files checked
  issues: CompactIssue[] // array of issues
  summary: {
    total: number // total issue count
    errors: number // error count
    warnings: number // warning count
    info: number // info count
    rules: Record<string, number> // rule frequency
    fixes: number // auto-fixable count
  }
  baseline?: {
    new: number // new issues since baseline
    resolved: number // resolved since baseline
    unchanged: number // unchanged issues
  }
}
```

### Performance Requirements (MVP)

#### ADHD Performance Targets (Simplified)

- **Validation Execution:** <2 seconds for typical file changes
- **JSON Generation:** <500ms for formatting results
- **Memory Usage:** <30MB for typical repository validation
- **ESLint Execution:** Use programmatic API (no shell spawning)
- **Prettier Execution:** Use in-memory API (no shell spawning)

#### Simplified Optimization Strategies (MVP)

```typescript
interface MVPPerformanceOptimizations {
  // Focus on changed file when available from hook context
  singleFileValidation: boolean

  // Use programmatic APIs instead of command spawning
  programmaticAPIs: boolean

  // Basic timeout handling
  timeoutMs: number // Default: 2000ms
}
```

### Integration with Existing DX System (Future Enhancement)

#### Post-MVP Integration Opportunities

```typescript
// Future Phase 2+ features:
interface FutureDXIntegration {
  // dx:status command enhancement (post-MVP)
  getBasicValidationStatus(): Promise<BasicValidationStatus>
}

interface BasicValidationStatus {
  enabled: boolean
  lastRun: number
  errorCount: number
  warningCount: number
}
```

## Approach Options (MVP)

### Selected Approach: Lean MVP Package

**Description:** Single npm package with ESLint + Prettier validation only **MVP
Pros:**

- Minimal installation and setup
- Focused scope reduces complexity
- Faster development and testing
- Clear success criteria
- Foundation for future expansion

**MVP Cons:**

- Limited initial functionality
- Requires explicit configuration
- No auto-detection convenience

**Rationale:** Focus on proving core value (AI-friendly validation feedback)
before expanding scope. Explicit configuration reduces complexity while still
providing essential functionality for ADHD-optimized workflows.

## External Dependencies (MVP Simplified)

### Core Runtime Dependencies

- **@types/node** (^20.0.0) - Node.js type definitions
- **tsx** (^4.19.0) - TypeScript execution runtime
- **commander** (^11.0.0) - CLI argument parsing

### Tool Integration Dependencies (MVP)

- **eslint** (^9.0.0) - ESLint programmatic API (peer dependency)
- **prettier** (^3.0.0) - Prettier in-memory API (peer dependency)

### Removed Dependencies (Post-MVP)

- **fast-glob** - Removed (no auto-detection needed)
- **chokidar** - Removed (no file watching needed)
- **typescript** - Removed (MVP scope)
- **vitest** - Removed (MVP scope)
- **express** - Removed (observability server post-MVP)
- **sqlite3** - Removed (baseline tracking post-MVP)
- **ws** - Removed (real-time updates post-MVP)

### Justification for Dependencies

**tsx:** Required for running TypeScript directly in hook handlers without
compilation step, essential for performance and simplicity

**commander:** Standard CLI framework providing consistent argument parsing and
help generation

**fast-glob:** High-performance file matching required for tool detection and
file filtering

**chokidar:** Cross-platform file watching for real-time validation feedback

**Peer Dependencies Strategy:** ESLint, Prettier, TypeScript, and Vitest are
peer dependencies to avoid version conflicts with user projects

## Security Considerations

### Input Validation

```typescript
interface SecurityValidation {
  validateFilePaths(paths: string[]): boolean
  sanitizeToolOutput(output: string): string
  validateConfigurationFiles(config: unknown): boolean
  preventPathTraversal(path: string): boolean
}
```

### Safe Command Execution

```typescript
interface CommandSecurity {
  // Never execute user-provided commands directly
  whitelistedCommands: string[]

  // Validate all tool configurations before execution
  validateToolConfig(config: ToolConfig): boolean

  // Sandbox tool execution with restricted permissions
  executeTool(tool: string, args: string[]): Promise<ToolResult>
}
```

### Data Privacy

- No sensitive file contents sent to external services
- Observability data anonymized by default
- Optional telemetry with explicit user consent
- Local baseline storage with encryption option

## Future Enhancement Opportunities (Post-MVP)

### Phase 2: Baseline Tracking

- Local baseline storage and delta comparison
- "New/resolved/unchanged" issue categorization

### Phase 3: Additional Tool Support

- TypeScript compiler integration
- Vitest test runner integration
- Auto-detection system

### Phase 4: Observability Server

- Express.js server with analytics
- Validation trend tracking
- Team dashboard capabilities

### Phase 5: Advanced Hook Support

- PreToolUse security validation
- SessionStart context injection
- UserPromptSubmit content filtering

This simplified technical specification focuses on the MVP requirements:
ESLint + Prettier validation with PostToolUse hook integration, achieving <2s
performance targets through explicit configuration and programmatic APIs.
