# API Specification

This is the API specification for the spec detailed in
@.agent-os/specs/2025-09-04-claude-hook-integration/spec.md

> Created: 2025-09-04 Version: 1.0.0

## Hook Integration API

### Claude Code PostToolUse Hook Interface

**Purpose:** Integrate quality checking into Claude Code's file operation
workflow **Trigger:** After Write, Edit, MultiEdit, or Create operations
**Communication:** JSON payload via stdin, exit codes for response

## Payload Specifications

### Input Payload Format (from Claude Code PostToolUse)

**Official Claude Code Hook Input Structure:**

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/nathanvale/code/bun-changesets-template",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write" | "Edit" | "MultiEdit",
  "tool_input": {
    "file_path": "/absolute/path/to/file.ts",
    "content": "export const example = () => {\n  return 'hello'\n}"
  },
  "tool_response": {
    "filePath": "/absolute/path/to/file.ts",
    "success": true
  }
}
```

**Key Fields:**

- **session_id**: Unique identifier for the Claude session
- **transcript_path**: Path to conversation JSON for context
- **cwd**: Current working directory when hook is invoked
- **hook_event_name**: Always "PostToolUse" for our integration
- **tool_name**: The specific tool that triggered the hook
- **tool_input**: Original parameters passed to the tool
- **tool_response**: Result of the tool execution

### Legacy Payload Support

```javascript
// Support for older Claude Code versions
const LEGACY_FORMATS = [
  // Simple string payload
  '/path/to/file.ts',

  // Basic object payload
  {
    file: '/path/to/file.ts',
    action: 'write',
  },
]

// Payload normalization
function normalizePayload(rawPayload) {
  if (typeof rawPayload === 'string') {
    return {
      operation: 'write_file',
      file_path: rawPayload,
      content: null, // Will be read from disk
    }
  }

  if (rawPayload.file && !rawPayload.file_path) {
    return {
      ...rawPayload,
      file_path: rawPayload.file,
      operation: rawPayload.action || 'write_file',
    }
  }

  return rawPayload
}
```

## Exit Code API

### Standard Exit Codes

| Code | Meaning       | Claude Behavior   | Use Case                                |
| ---- | ------------- | ----------------- | --------------------------------------- |
| 0    | Success       | Continue normally | Auto-fixed issues, no errors found      |
| 1    | General Error | Stop execution    | System errors, parsing failures         |
| 2    | Quality Block | Stop with message | Claude-fixable or Human-required issues |

### Exit Code Implementation

```javascript
// In hooks/claude-hook.js
try {
  execSync(HOOK_COMMAND, execOptions)
  // Child process succeeded - continue Claude execution
  process.exit(0)
} catch (error) {
  // Propagate child process exit code
  const exitCode = error.status || 1
  process.exit(exitCode)
}
```

```javascript
// In packages/quality-check/src/facades/claude.js
function determineExitCode(classificationResult) {
  switch (classificationResult.tier) {
    case 'auto-fixable':
      // Silent success - Claude continues
      return 0

    case 'claude-fixable':
      // Block with fix instructions
      return 2

    case 'human-required':
      // Block with education
      return 2

    default:
      // System error
      return 1
  }
}
```

## Configuration API

### Hook Configuration in .claude/settings.json

**Production Configuration (NPM Binary - Recommended):**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "quality-check-claude-hook",
            "timeout": 2
          }
        ]
      }
    ]
  },
  "env": {
    "QUALITY_CHECK_MODE": "claude-hook",
    "NODE_NO_WARNINGS": "1",
    "QUALITY_CHECK_LOG_LEVEL": "error"
  }
}
```

**Development Configuration Alternative:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/hooks/claude-hook.js",
            "timeout": 2
          }
        ]
      }
    ]
  }
}
```

**Distribution Advantages:**

- **Clean Binary**: `quality-check-claude-hook` command with no path
  dependencies
- **Version Management**: Installed via `npm install @template/quality-check`
- **Automatic PATH Resolution**: npm/node handles binary discovery
- **Team Consistency**: Same version across all developers via package.json
- **Easy Updates**: Standard npm update workflow

### Environment Variables API

```bash
# Quality check behavior
QUALITY_CHECK_MODE=claude-hook    # Sets Claude-specific behavior
NODE_NO_WARNINGS=1               # Suppress Node.js warnings
WALLABY_INCLUDE_INTEGRATION=false # Exclude integration tests

# Performance tuning
QUALITY_CHECK_TIMEOUT=2000        # Hook timeout in milliseconds
QUALITY_CHECK_MEMORY_LIMIT=64     # Memory limit in MB

# Logging control
QUALITY_CHECK_LOG_LEVEL=error     # Only log errors in Claude mode
QUALITY_CHECK_LOG_FILE=/tmp/qc.log # Log file location
```

## Response Message API

### Auto-Fixable Response (Exit Code 0)

```
# No console output - silent success
# Logging only to file:
{"level":"info","msg":"Auto-fixed 3 formatting issues in file.ts","timestamp":"2025-09-04T10:30:00Z"}
```

### Claude-Fixable Response (Exit Code 2)

```
🔧 Quality issues found that Claude can fix:

📁 src/components/Button.ts:15:8

❌ @typescript-eslint/no-unused-vars
   Remove unused variable 'event' or prefix with underscore

   // Current:
   const handleClick = (event, data) => {

   // Fix:
   const handleClick = (_event, data) => {

💡 Claude: Please remove the unused 'event' parameter or prefix it with underscore to indicate intentional non-use.
```

### Human-Required Response (Exit Code 2)

```
🛑 Quality issue requires human attention:

📁 src/services/UserService.ts:42:12

❌ complexity
   Function complexity (15) exceeds maximum allowed (10)

📚 Learning Context:
   Complex functions are harder to test, debug, and maintain.
   Consider breaking this function into smaller, focused functions.

🎯 Next Steps:
   1. Extract helper functions for data validation
   2. Use composition patterns for business logic
   3. Consider moving to separate service classes

💭 This helps build better software architecture skills.
```

## Integration Endpoints

### Quality Check Facade Integration

```javascript
// Integration with existing QualityChecker using official Claude Code hook format
async function runClaudeHook() {
  const hookPayload = await parseClaudeHookPayload()

  // Validate and extract file information
  if (!hookPayload || !shouldProcessHook(hookPayload)) {
    exitWithCode(0) // Skip processing
    return
  }

  const filePath = hookPayload.tool_input.file_path
  const checker = new QualityChecker()
  const classifier = new ErrorClassifier()

  // Run quality check on the file that was just modified
  const issues = await checker.checkFile(filePath)

  if (issues.length === 0) {
    exitWithCode(0) // No issues found - continue silently
    return
  }

  // Process through three-tier classification system
  const classificationResult = classifier.classifyIssues(issues)

  switch (classificationResult.tier) {
    case 'auto-fixable':
      await silentlyFixIssues(issues, filePath)
      exitWithCode(0) // Silent success - Claude continues
      break

    case 'claude-fixable':
      outputClaudeInstructions(classificationResult)
      exitWithCode(2) // Block with instructions for Claude
      break

    case 'human-required':
      outputEducationalContent(classificationResult)
      exitWithCode(2) // Block with educational content
      break
  }
}

// Parse official Claude Code hook payload
async function parseClaudeHookPayload() {
  const stdinData = await readStdin()

  try {
    const payload = JSON.parse(stdinData)

    // Validate official Claude Code hook structure
    if (
      payload.hook_event_name !== 'PostToolUse' ||
      !['Write', 'Edit', 'MultiEdit'].includes(payload.tool_name) ||
      !payload.tool_input?.file_path
    ) {
      return null // Skip invalid or non-file-modification hooks
    }

    return payload
  } catch (error) {
    console.error('Failed to parse hook payload:', error.message)
    return null
  }
}

function shouldProcessHook(hookPayload) {
  const filePath = hookPayload.tool_input.file_path

  // Only process supported file types
  if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) {
    return false
  }

  // Check if tool execution was successful
  if (!hookPayload.tool_response?.success) {
    return false
  }

  return true
}
```

### Error Classification API

```javascript
// Classification decision logic
class ErrorClassifier {
  async classifyIssues(issues) {
    const classifications = issues.map((issue) =>
      this.classifySingleIssue(issue),
    )

    // Determine overall tier (highest severity wins)
    const tiers = ['human-required', 'claude-fixable', 'auto-fixable']
    const highestTier = tiers.find((tier) =>
      classifications.some((c) => c.tier === tier),
    )

    return {
      tier: highestTier,
      issues: classifications,
      autoFixableCount: classifications.filter((c) => c.tier === 'auto-fixable')
        .length,
      claudeFixableCount: classifications.filter(
        (c) => c.tier === 'claude-fixable',
      ).length,
      humanRequiredCount: classifications.filter(
        (c) => c.tier === 'human-required',
      ).length,
    }
  }

  classifySingleIssue(issue) {
    // Auto-fixable: Safe formatting and style fixes
    if (this.isAutoFixable(issue)) {
      return {
        tier: 'auto-fixable',
        issue,
        action: 'silent-fix',
      }
    }

    // Claude-fixable: Clear rule violations with specific fixes
    if (this.isClaudeFixable(issue)) {
      return {
        tier: 'claude-fixable',
        issue,
        action: 'block-and-instruct',
        instructions: this.generateClaudeInstructions(issue),
      }
    }

    // Human-required: Complex issues requiring understanding
    return {
      tier: 'human-required',
      issue,
      action: 'stop-and-educate',
      education: this.generateEducationalContent(issue),
    }
  }
}
```

## Communication Protocol

### Stdin Reading Implementation

```javascript
async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = ''

    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })

    process.stdin.on('end', () => {
      resolve(data.trim())
    })

    process.stdin.on('error', reject)

    // Timeout after 1s if no data
    setTimeout(() => {
      reject(new Error('Stdin timeout - no data received'))
    }, 1000)
  })
}
```

### Response Output Format

```javascript
// Silent success (auto-fixable)
function exitSilentSuccess() {
  // No console output
  process.exit(0)
}

// Block with Claude instructions (claude-fixable)
function exitWithClaudeInstructions(instructions) {
  console.log(formatClaudeMessage(instructions))
  process.exit(2)
}

// Block with education (human-required)
function exitWithEducation(education) {
  console.log(formatEducationalMessage(education))
  process.exit(2)
}
```

The API specification provides complete integration guidance for the Claude Code
hook system, ensuring seamless communication between Claude and the
quality-check infrastructure.
