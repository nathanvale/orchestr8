# API Specification

This is the API specification for the spec detailed in
@.agent-os/specs/2025-08-30-claude-code-ai-hooks-system/spec.md

> Created: 2025-08-30 Version: 2.0.0 - MVP Focused

## Claude Code Hook Handlers API (MVP)

### PostToolUse Hook Handler (Primary MVP Focus)

**Purpose:** Process file changes after Write/Edit/MultiEdit operations and
provide structured ESLint + Prettier validation feedback to Claude Code.

**Command:** `npx snapcheck post-tool-use`

**Input:** JSON via stdin from Claude Code hook system

```typescript
interface PostToolUseInput {
  session_id: string
  transcript_path: string
  cwd: string
  hook_event_name: 'PostToolUse'
  tool_name: 'Write' | 'Edit' | 'MultiEdit'
  tool_input: {
    file_path: string
    content?: string
    old_string?: string
    new_string?: string
    edits?: Array<{
      old_string: string
      new_string: string
    }>
  }
  tool_response: {
    success: boolean
    filePath?: string
    error?: string
  }
}
```

**Processing Logic (MVP Simplified):**

1. Extract file path from tool_input
2. Run ESLint validation using programmatic API (no shell spawning)
3. Run Prettier validation using in-memory API (no shell spawning)
4. Format results using AI-optimized compact schema
5. Generate Claude-specific feedback

**Output Options:**

**Option A: No Issues Found**

```bash
exit 0  # Success, continue processing
```

**Option B: Validation Issues Found**

```json
{
  "decision": "block",
  "reason": "Found 2 validation issues that should be addressed",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "ESLint: 1 error (no-unused-vars), 1 warning (prefer-const)\nPrettier: Formatting issues detected\n\nSuggested fixes:\n• Remove unused variable on line 15\n• Add const declaration for variable on line 23\n• Run prettier --write to fix formatting"
  }
}
```

**Exit Code:** 0 (with JSON output to provide context to Claude)

**Option C: Critical Issues Found**

```bash
echo "CRITICAL: Syntax errors prevent compilation" >&2
exit 2  # Block with feedback to Claude
```

### Future Hook Handlers (Post-MVP)

**The following hook handlers are planned for future phases:**

- **PreToolUse Hook Handler** - Security validation (Phase 5)
- **SessionStart Hook Handler** - Context injection (Phase 5)
- **UserPromptSubmit Hook Handler** - Prompt filtering (Phase 5)

**MVP Focus:** Only PostToolUse hook handler for immediate validation feedback.

## CLI API

### Initialization Command (MVP)

**Endpoint:** `npx snapcheck init [options]`

**Purpose:** Setup Claude Code integration with explicit ESLint and Prettier
command configuration.

**Parameters:**

- `--eslint-cmd <cmd>` - Specify ESLint command (e.g., "pnpm eslint")
- `--prettier-cmd <cmd>` - Specify Prettier command (e.g., "pnpm prettier")
- `--force` - Overwrite existing configuration

**Response:** Generates `.claude/settings.json` with appropriate hook
configuration

**Example Output:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "npx snapcheck post-tool-use",
            "timeout": 10
          }
        ]
      }
    ]
  },
  "snapcheck": {
    "eslint": {
      "command": ["pnpm", "eslint", "--format", "json"],
      "enabled": true
    },
    "prettier": {
      "command": ["pnpm", "prettier", "--check"],
      "enabled": true
    }
  }
}
```

### Validation Command (MVP)

**Endpoint:** `npx snapcheck validate [options]`

**Purpose:** Manual validation execution with ESLint + Prettier support.

**Parameters:**

- `--file <path>` - Validate specific file
- `--format <format>` - Output format (ai|human)
- `--output <path>` - Save results to file

**Response Formats:**

**AI Format (--format=ai):**

```json
{
  "ts": 1693401234,
  "tool": "eslint",
  "dur": 1250,
  "files": 15,
  "issues": [
    {
      "f": "src/app.ts",
      "l": 23,
      "c": 5,
      "r": "no-unused-vars",
      "s": 2,
      "m": "Variable 'unused' is defined but never used"
    },
    {
      "f": "src/utils.ts",
      "l": 45,
      "c": 12,
      "r": "prefer-const",
      "s": 1,
      "m": "Variable should be const",
      "fix": "const"
    }
  ],
  "summary": {
    "total": 2,
    "errors": 1,
    "warnings": 1,
    "rules": { "no-unused-vars": 1, "prefer-const": 1 },
    "fixes": 1
  }
}
```

**Claude Format (--format=claude):**

```text
Found 2 validation issues in 15 files (1.25s):

ERRORS (1):
• src/app.ts:23:5 - Variable 'unused' is defined but never used (no-unused-vars)

WARNINGS (1):
• src/utils.ts:45:12 - Variable should be const (prefer-const) [auto-fixable]

Suggested actions:
1. Remove unused variable in src/app.ts line 23
2. Run ESLint with --fix to auto-correct const issues
```

### Status Command (MVP)

**Endpoint:** `npx snapcheck status [options]`

**Purpose:** Show current validation status and integration health.

**Parameters:**

- `--json` - JSON output format

**Response:**

```json
{
  "enabled": true,
  "tools": {
    "eslint": {
      "enabled": true,
      "command": ["pnpm", "eslint", "--format", "json"]
    },
    "prettier": {
      "enabled": true,
      "command": ["pnpm", "prettier", "--check"]
    }
  },
  "lastValidation": {
    "timestamp": 1693401234,
    "duration": 1200,
    "totalIssues": 2,
    "errors": 1,
    "warnings": 1
  }
}
```

### Configuration Command (MVP)

**Endpoint:** `npx snapcheck config [options]`

**Purpose:** Manage ESLint and Prettier command configuration.

**Parameters:**

- `--eslint-cmd <cmd>` - Update ESLint command
- `--prettier-cmd <cmd>` - Update Prettier command
- `--show` - Display current configuration

**Response:** Configuration updated successfully or current configuration
display

## Future API Endpoints (Post-MVP)

**The following API endpoints are planned for future phases:**

- **Observability Server API** - Analytics and trend tracking (Phase 4)
- **WebSocket API** - Real-time updates (Phase 4)
- **Dashboard API** - Team dashboard (Phase 4)

**MVP Focus:** CLI and PostToolUse hook handler only.

## Error Handling

### Hook Handler Error Responses

**Validation Tool Not Found:**

```json
{
  "continue": true,
  "systemMessage": "ESLint not found in project, skipping linting validation"
}
```

**Hook Execution Timeout:**

```bash
echo "Validation timeout exceeded (>30s), continuing without results" >&2
exit 1  # Non-blocking error
```

**Critical System Error:**

```bash
echo "SYSTEM ERROR: Unable to access project files" >&2
exit 2  # Block with feedback
```

### CLI Error Responses

**Invalid Arguments:**

```bash
echo "Error: Unknown option --invalid-flag" >&2
echo "Use: npx snapcheck --help for usage information" >&2
exit 1
```

**Configuration Error:**

```bash
echo "Error: No validation tools detected in project" >&2
echo "Run: npx snapcheck init --help for setup instructions" >&2
exit 1
```

### API Error Responses

**Invalid Request Format:**

```json
{
  "error": "INVALID_REQUEST",
  "message": "Request body must be valid JSON",
  "statusCode": 400
}
```

**Server Unavailable:**

```json
{
  "error": "SERVER_UNAVAILABLE",
  "message": "Observability server temporarily unavailable",
  "statusCode": 503,
  "retryAfter": 30
}
```

This simplified API specification ensures compatibility with Claude Code's hook
system while focusing on the MVP requirements: ESLint + Prettier validation with
PostToolUse hook integration and <2s performance targets.
