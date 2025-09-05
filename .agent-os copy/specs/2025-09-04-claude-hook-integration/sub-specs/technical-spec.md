# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-04-claude-hook-integration/spec.md

> Created: 2025-09-04 Version: 1.0.0

## Technical Requirements

### Performance Requirements

- **Hook Execution Time**: Must complete within 2000ms for ADHD-optimized
  workflow
- **Silent Success Mode**: Zero console output for auto-fixed issues (logging
  only to files)
- **Memory Usage**: Under 50MB peak memory consumption
- **File Processing**: Handle files up to 5MB without performance degradation

### Integration Requirements

- **Claude Code Compatibility**: Support PostToolUse hook JSON payload format
- **Existing Architecture**: Integrate with current multi-facade pattern without
  modifications
- **Exit Code Compliance**: Return appropriate codes (0 for continue, 2 for
  block)
- **Configuration Flexibility**: Honor existing .claude/settings.json patterns

## Approach Options

**Option A: New Claude Facade (Current Approach)**

- Pros: Clean separation of concerns, follows existing pattern, maintainable
- Cons: Requires new file creation, slight duplication of entry logic

**Option B: Extend Existing Hook Mode**

- Pros: No new files, reuses existing logic
- Cons: Couples Claude-specific logic with general hook processing, breaks
  separation

**Option C: Direct CLI Integration**

- Pros: Minimal code changes
- Cons: Breaks facade pattern, makes testing harder

**Selected: Option A - New Claude Facade**

**Rationale:** Maintains architectural consistency with existing CLI and
git-hook facades, provides clean testing interface, and allows Claude-specific
optimizations without affecting other consumers.

## Implementation Architecture

### Hook Integration Flow

```
Claude Code PostToolUse Event
        ↓
hooks/claude-hook.js (New - ~50 lines)
        ↓
packages/quality-check/dist/facades/claude.js (Existing)
        ↓
Core QualityChecker + ErrorClassifier
        ↓
Three-Tier Decision Logic
```

### NPM Binary Distribution Approach

**Production Implementation: NPM Binary (`bin/claude-hook`)**

```javascript
#!/usr/bin/env node
/**
 * Claude Code PostToolUse Hook Binary
 * Distributed via @template/quality-check npm package
 * Production-ready with proper error handling
 * ~20 lines
 */

import { runClaudeHook } from '../dist/facades/claude.js'

async function main() {
  try {
    // Call existing Claude facade with proper environment
    await runClaudeHook()
    process.exit(0)
  } catch (error) {
    // Facade handles its own exit codes and messaging
    process.exit(error.exitCode || error.status || 2)
  }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('Claude hook error:', error.message)
  process.exit(2)
})

process.on('unhandledRejection', (error) => {
  console.error('Claude hook rejection:', error)
  process.exit(2)
})

main()
```

**Package.json Configuration:**

```json
{
  "name": "@template/quality-check",
  "bin": {
    "quality-check": "./bin/quality-check",
    "quality-check-claude-hook": "./bin/claude-hook"
  },
  "files": ["dist", "bin", "README.md"]
}
```

**Development Alternative: Local Hook File**

For rapid development and testing, a local hook file can still be used:

```javascript
// hooks/claude-hook.js (development only)
#!/usr/bin/env node
import { execSync } from 'child_process'

const HOOK_COMMAND = 'quality-check-claude-hook'

try {
  execSync(HOOK_COMMAND, { stdio: 'inherit', timeout: 2000 })
  process.exit(0)
} catch (error) {
  process.exit(error.status || 2)
}
```

### Three-Tier Classification System

#### Tier 1: Auto-Fixable (Silent Success)

Issues that can be safely fixed without human oversight:

```javascript
const AUTO_FIXABLE_RULES = new Set([
  // Prettier formatting
  'prettier/prettier',

  // Basic ESLint rules
  'semi',
  'quotes',
  'comma-dangle',
  'indent',
  'no-trailing-spaces',
  'eol-last',

  // Import organization
  'import/order',
  'sort-imports',

  // TypeScript formatting
  '@typescript-eslint/type-annotation-spacing',
  '@typescript-eslint/member-delimiter-style'
])

// Classification logic in ErrorClassifier
classifyError(issue) {
  if (AUTO_FIXABLE_RULES.has(issue.ruleId)) {
    return {
      tier: 'auto-fixable',
      action: 'silent-fix',
      shouldBlock: false,
      shouldEducate: false
    }
  }

  if (CLAUDE_FIXABLE_RULES.has(issue.ruleId)) {
    return {
      tier: 'claude-fixable',
      action: 'block-and-fix',
      shouldBlock: true,
      shouldEducate: false,
      instructions: getClaudeInstructions(issue.ruleId)
    }
  }

  return {
    tier: 'human-required',
    action: 'stop-and-educate',
    shouldBlock: true,
    shouldEducate: true,
    explanation: getEducationalContent(issue.ruleId)
  }
}
```

#### Tier 2: Claude-Fixable (Block + Fix Instructions)

Issues Claude can fix with specific guidance:

```javascript
const CLAUDE_FIXABLE_RULES = new Map([
  ['@typescript-eslint/no-unused-vars', {
    instruction: 'Remove unused variables or prefix with underscore',
    example: 'Change `const data = ...` to `const _data = ...` if intentionally unused'
  }],
  ['@typescript-eslint/no-explicit-any', {
    instruction: 'Replace any with specific type or unknown',
    example: 'Change `data: any` to `data: User | null` or `data: unknown`'
  }],
  ['react-hooks/exhaustive-deps', {
    instruction: 'Add missing dependencies to useEffect array',
    example: 'Add all used variables to dependency array: [userId, fetchData]'
  }]
])

// Claude instruction generation
generateClaudeInstructions(issue) {
  const rule = CLAUDE_FIXABLE_RULES.get(issue.ruleId)

  return {
    message: `Claude, please fix this ${issue.ruleId} error:`,
    instruction: rule.instruction,
    example: rule.example,
    location: `${issue.filePath}:${issue.line}:${issue.column}`,
    code: issue.source
  }
}
```

#### Tier 3: Human-Required (Stop + Educate)

Complex issues requiring human understanding:

```javascript
const HUMAN_REQUIRED_PATTERNS = {
  complexity: {
    explanation:
      'This function is too complex. Consider breaking it into smaller functions.',
    learningPath: 'Read about Single Responsibility Principle',
    nextSteps: 'Extract helper functions or use composition patterns',
  },
  security: {
    explanation: 'Potential security vulnerability detected.',
    learningPath: 'Review OWASP security guidelines',
    nextSteps: 'Consult security team or use secure alternatives',
  },
  architecture: {
    explanation: 'This change affects system architecture.',
    learningPath: 'Discuss with tech lead or architect',
    nextSteps: 'Consider design review before implementation',
  },
}
```

## Hook Payload Processing

### Claude Code Payload Structure

```json
{
  "operation": "write_file",
  "file_path": "/path/to/file.ts",
  "content": "export const example = () => {\n  return 'hello'\n}",
  "metadata": {
    "tool_name": "Write",
    "timestamp": "2025-09-04T10:30:00Z"
  }
}
```

### Payload Processing Logic

```javascript
async function processClaudePayload() {
  const stdinData = await readStdin()

  try {
    const payload = JSON.parse(stdinData)

    // Validate payload structure
    if (!payload.operation || !payload.file_path) {
      throw new Error('Invalid hook payload structure')
    }

    // Extract file for quality checking
    const filePath = payload.file_path

    // Only process supported file types
    if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) {
      return { action: 'skip', reason: 'unsupported-file-type' }
    }

    return {
      action: 'check',
      filePath,
      operation: payload.operation,
    }
  } catch (error) {
    throw new Error(`Payload parsing failed: ${error.message}`)
  }
}
```

## External Dependencies

### Required Dependencies (Already Available)

- **execSync from child_process** - For executing quality-check facade
- **resolve from path** - For building absolute paths to quality-check
- **Existing quality-check package** - Core functionality already implemented

### No New Dependencies Required

The implementation leverages the existing quality-check infrastructure without
requiring additional npm packages, maintaining the lightweight approach.

## Performance Optimizations

### ADHD-Specific Optimizations

- **2s Timeout**: Hard limit prevents hanging and context switching
- **Silent Success**: No output reduces cognitive load for auto-fixed issues
- **Immediate Feedback**: Block immediately for issues requiring attention
- **Zero Configuration**: Works with existing .claude/settings.json setup

### Resource Management

```javascript
// Memory optimization in hook
process.on('exit', () => {
  // Cleanup handled by child process
})

// CPU optimization
const execOptions = {
  timeout: 2000,
  maxBuffer: 1024 * 1024, // 1MB buffer limit
  env: {
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=64', // Limit memory
  },
}
```

## Integration with Existing Architecture

### Multi-Facade Pattern Compliance

The Claude hook maintains the established pattern:

- **CLI Facade**: `packages/quality-check/src/facades/cli.ts`
- **Git Hook Facade**: `packages/quality-check/src/facades/git-hook.ts`
- **Claude Facade**: `packages/quality-check/src/facades/claude.ts` (existing)
- **Hook Wrapper**: `hooks/claude-hook.js` (new, lightweight)

### Production Configuration

**Clean NPM Binary Configuration (Recommended):**

```json
// .claude/settings.json (production)
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
// .claude/settings.json (development)
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

**Key Advantages:**

- **Clean Command**: No path complexity, just `quality-check-claude-hook`
- **Version Management**: Controlled via package.json dependencies
- **Team Consistency**: Same version across all developers
- **Easy Updates**: `npm update @template/quality-check`
- **Cross-Platform**: npm handles OS differences

The implementation provides comprehensive Claude Code integration while
maintaining the established architectural patterns and performance requirements.
