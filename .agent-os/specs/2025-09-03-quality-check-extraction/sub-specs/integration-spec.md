# Integration Specification

This is the integration specification for the spec detailed in
@.agent-os/specs/2025-09-03-quality-check-extraction/spec.md

> Created: 2025-09-03  
> Version: 2.0.0

## Claude Code PostToolUse Hook Integration

### Enhanced Hook Configuration (No-Bin Architecture)

Claude Code users will configure the PostToolUse hook in their
`.claude/settings.json` using npx:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "npx @template/quality-check",
            "timeout": 50,
            "env": {
              "QUALITY_CHECK_CACHE": "$CLAUDE_PROJECT_DIR/.cache",
              "QUALITY_CHECK_MODE": "auto-fix",
              "QUALITY_CHECK_LOG_LEVEL": "info"
            },
            "stdin": true,
            "continueOnError": false
          }
        ]
      }
    ]
  }
}
```

### Claude Code Version Requirements

#### Minimum Requirements

- **Claude Code Version**: v1.0.56 or higher
- **Node.js Version**: 18.0.0 or higher (20+ recommended)
- **Operating System**: Unix-like (Linux, macOS), Windows via WSL2

#### Feature Compatibility Matrix

| Feature                 | Claude Code Version | Notes                        |
| ----------------------- | ------------------- | ---------------------------- |
| PostToolUse hooks       | v1.0.40+            | Basic support                |
| JSON stdin input        | v1.0.45+            | Stable implementation        |
| Exit code 2 handling    | v1.0.56+            | Auto-correction support      |
| Parallel hook execution | v1.0.50+            | Resource management required |
| CLAUDE_PROJECT_DIR      | v1.0.30+            | Environment variable         |
| Timeout configuration   | v1.0.48+            | Per-hook timeout support     |

#### Known Limitations

- Hook modifications require session restart
- 60-second hard timeout per hook execution
- JSON output processing bug (#3983) - use exit codes instead
- Parallel hooks share resource pool

### JSON Input Format Handling

The quality check package must handle both Claude Code PostToolUse event
formats:

#### Format 1: Claude Code Production Format

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../transcript.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.ts",
    "content": "file content"
  },
  "tool_response": {
    "filePath": "/path/to/file.ts",
    "success": true
  }
}
```

#### Format 2: Legacy/Test Format

```json
{
  "type": "PostToolUse",
  "data": {
    "file_path": "/path/to/file.ts"
  }
}
```

### File Path Extraction Logic

```typescript
interface PostToolUseInput {
  // Claude Code production format
  hook_event_name?: string
  tool_input?: {
    file_path?: string
    path?: string
    notebook_path?: string
  }
  // Legacy format
  type?: string
  data?: {
    file_path?: string
  }
}

export function extractFilePath(input: PostToolUseInput): string | null {
  // Handle Claude Code production format
  if (input.hook_event_name === 'PostToolUse' && input.tool_input) {
    return (
      input.tool_input.file_path ||
      input.tool_input.path ||
      input.tool_input.notebook_path ||
      null
    )
  }

  // Handle legacy/test format
  if (input.type === 'PostToolUse' && input.data) {
    return input.data.file_path || null
  }

  return null
}
```

## Exit Code Specification

The quality check tool uses specific exit codes to communicate with Claude Code:

| Exit Code | Meaning                            | Claude Code Behavior                    |
| --------- | ---------------------------------- | --------------------------------------- |
| 0         | Success - all checks passed        | Continue normally                       |
| 1         | Errors found - manual fix required | Block operation, show errors            |
| 2         | Auto-fixable issues found          | Claude receives feedback for correction |
| 3         | Configuration error                | Show config guidance                    |
| 4         | File access error                  | Log and continue                        |
| 5         | Timeout exceeded                   | Warn and continue                       |
| 124       | Hard timeout (killed)              | System error                            |

### Implementation Example

```typescript
export enum ExitCodes {
  SUCCESS = 0,
  ERRORS_FOUND = 1,
  AUTO_FIXABLE = 2,
  CONFIG_ERROR = 3,
  FILE_ACCESS_ERROR = 4,
  TIMEOUT_EXCEEDED = 5,
  HARD_TIMEOUT = 124,
}

// Usage for auto-correction flow
if (autoFixableIssues.length > 0) {
  console.error(formatAutoFixableIssues(autoFixableIssues))
  process.exit(ExitCodes.AUTO_FIXABLE)
}
```

## Error Handling Matrix

### Error Classification and Recovery

| Error Type           | Exit Code | Recovery Strategy         | User Message                                |
| -------------------- | --------- | ------------------------- | ------------------------------------------- |
| ESLint Errors        | 1         | Show errors, block        | "ESLint errors found - manual fix required" |
| ESLint Warnings      | 0         | Log warnings, continue    | "ESLint warnings found (non-blocking)"      |
| Prettier Differences | 2         | Auto-fix and retry        | "Formatting issues auto-fixed"              |
| TypeScript Errors    | 1         | Show errors, block        | "TypeScript compilation errors"             |
| File Not Found       | 4         | Skip file, continue       | "File not found, skipping"                  |
| Permission Denied    | 4         | Skip file, warn           | "Permission denied for file"                |
| File Too Large       | 4         | Skip file, warn           | "File exceeds size limit"                   |
| Timeout              | 5         | Partial results           | "Quality check timed out"                   |
| Memory Limit         | 5         | Restart with lower limits | "Memory limit exceeded, retrying"           |
| Config Error         | 3         | Use defaults, warn        | "Configuration error, using defaults"       |
| Cache Corruption     | 0         | Clear cache, retry        | "Cache corrupted, rebuilding"               |
| Lock Timeout         | 4         | Skip file                 | "File lock timeout"                         |
| Git Error            | 0         | Process anyway            | "Git integration unavailable"               |
| Network Error        | 0         | Use offline mode          | "Network unavailable, offline mode"         |

### Error Response Format

```typescript
interface QualityCheckError {
  code: string
  message: string
  file?: string
  line?: number
  column?: number
  severity: 'error' | 'warning' | 'info'
  source: 'eslint' | 'prettier' | 'typescript' | 'system'
  fixable: boolean
  suggestion?: string
}

// Example error output
{
  "errors": [
    {
      "code": "TS2322",
      "message": "Type 'number' is not assignable to type 'string'",
      "file": "/src/component.tsx",
      "line": 42,
      "column": 15,
      "severity": "error",
      "source": "typescript",
      "fixable": false,
      "suggestion": "Change the type or value to match"
    }
  ],
  "warnings": [],
  "fixed": [],
  "stats": {
    "filesChecked": 1,
    "duration": 1247,
    "fromCache": false
  }
}
```

## Environment Variable Integration

### Claude Code Provided Variables

- **CLAUDE_PROJECT_DIR**: Absolute path to the project root directory
  - Example: `/Users/developer/projects/my-app`
  - Used for: Resolving relative paths, finding configuration files

```typescript
export function resolveProjectPath(relativePath: string): string {
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  return path.resolve(projectRoot, relativePath)
}
```

### Configuration Resolution Strategy

1. **Project-specific config**: Look for `.quality-check.json` in
   `$CLAUDE_PROJECT_DIR`
2. **Package.json config**: Check `qualityCheck` field in package.json
3. **Default configuration**: Use opinionated defaults for immediate
   functionality

```typescript
interface QualityCheckConfig {
  eslint?: {
    enabled?: boolean
    autofix?: boolean
    configFile?: string
  }
  prettier?: {
    enabled?: boolean
    configFile?: string
  }
  typescript?: {
    enabled?: boolean
    strict?: boolean
  }
}

export async function loadConfig(): Promise<QualityCheckConfig> {
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()

  // Try project-specific config
  const configPath = path.join(projectRoot, '.quality-check.json')
  if (await fileExists(configPath)) {
    return JSON.parse(await readFile(configPath, 'utf-8'))
  }

  // Try package.json config
  const packagePath = path.join(projectRoot, 'package.json')
  if (await fileExists(packagePath)) {
    const pkg = JSON.parse(await readFile(packagePath, 'utf-8'))
    if (pkg.qualityCheck) {
      return pkg.qualityCheck
    }
  }

  // Return defaults
  return {
    eslint: { enabled: true, autofix: true },
    prettier: { enabled: true },
    typescript: { enabled: true, strict: false },
  }
}
```

## NPM Distribution (No-Bin Architecture)

### Installation Options

```bash
# Option 1: Local installation (Recommended)
npm install --save-dev @template/quality-check

# Option 2: Using npx directly (No installation required)
npx @template/quality-check

# Option 3: Global installation (Not required for hook usage)
npm install -g @template/quality-check
```

### Command Usage Patterns

```bash
# Hook mode - Auto-detected when piped (stdin not TTY)
echo '{"hook_event_name":"PostToolUse","tool_input":{"file_path":"test.ts"}}' | npx @template/quality-check

# Direct file mode
npx @template/quality-check --file ./src/components/Button.tsx

# Pre-commit mode
npx @template/quality-check --pre-commit

# Help and version
npx @template/quality-check --help
npx @template/quality-check --version
```

### Alternative Hook Configurations

#### Option 1: Using npx (Recommended)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "command": "npx @template/quality-check"
      }
    ]
  }
}
```

#### Option 2: Using node directly (if installed locally)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "command": "node node_modules/@template/quality-check/dist/index.js"
      }
    ]
  }
}
```

#### Option 3: Using package.json script

```json
// package.json
{
  "scripts": {
    "quality-check": "node node_modules/@template/quality-check/dist/index.js"
  }
}

// .claude/settings.json
{
  "hooks": {
    "PostToolUse": [{
      "command": "npm run quality-check"
    }]
  }
}
```

## Git Integration

### Git-Aware File Processing

```typescript
import { simpleGit, SimpleGit } from 'simple-git'
import ignore from 'ignore'

export class GitIntegration {
  private git: SimpleGit
  private gitignore: ReturnType<typeof ignore>

  constructor(private readonly projectRoot: string) {
    this.git = simpleGit(projectRoot)
    this.gitignore = this.loadGitignore()
  }

  private loadGitignore(): ReturnType<typeof ignore> {
    const ig = ignore()

    // Load .gitignore files
    const gitignorePaths = [
      path.join(this.projectRoot, '.gitignore'),
      path.join(this.projectRoot, '.git/info/exclude'),
    ]

    for (const gitignorePath of gitignorePaths) {
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf-8')
        ig.add(content)
      }
    }

    // Add default ignores
    ig.add(['node_modules/', '.git/', '*.log', '.DS_Store', 'Thumbs.db'])

    return ig
  }

  async shouldProcessFile(filepath: string): Promise<boolean> {
    const relativePath = path.relative(this.projectRoot, filepath)

    // Check if ignored by git
    if (this.gitignore.ignores(relativePath)) {
      return false
    }

    // Check if file is tracked
    try {
      const status = await this.git.status([filepath])

      // Process if:
      // - File is tracked and modified
      // - File is staged
      // - File is new but staged
      return (
        status.modified.includes(relativePath) ||
        status.staged.includes(relativePath) ||
        status.created.includes(relativePath)
      )
    } catch {
      // Not a git repository, process all files
      return true
    }
  }
}
```

### Pre-commit Mode

````typescript
export async function preCommitMode(): Promise<void> {
  const git = new GitIntegration(process.env.CLAUDE_PROJECT_DIR!)
  const stagedFiles = await git.getStagedFiles()

  // Filter for supported file types
  const filesToCheck = stagedFiles.filter(f =>
    ['.ts', '.tsx', '.js', '.jsx'].some(ext => f.endsWith(ext))
  )

  if (filesToCheck.length === 0) {
    console.log('No files to check')
    process.exit(0)
  }

  const results = await Promise.all(
    filesToCheck.map(file => runQualityChecks(file))
  )

  const hasErrors = results.some(r => r.errors.length > 0)
  if (hasErrors) {
    console.error('Commit blocked: Quality check failures')
    process.exit(1)
  }
}
```

### Hook Mode Implementation

```typescript
export async function hookMode(): Promise<void> {
  const correlationId = generateCorrelationId()
  const logger = createLogger({ correlationId })

  try {
    // Read JSON input from stdin
    const input = await readStdinAsJSON()

    // Extract file path from hook payload
    const filePath = extractFilePath(input)
    if (!filePath) {
      logger.warn('No file path found in hook input', { input })
      process.exit(0)
    }

    // Validate file exists and is supported
    if (!(await fileExists(filePath))) {
      logger.info('File does not exist, skipping validation', { filePath })
      process.exit(0)
    }

    if (!isSupportedFile(filePath)) {
      logger.info('File type not supported, skipping validation', { filePath })
      process.exit(0)
    }

    // Run quality checks
    const startTime = Date.now()
    const result = await runQualityChecks(filePath, { logger })
    const duration = Date.now() - startTime

    // Log results
    logger.info('Quality check completed', {
      filePath,
      duration,
      errors: result.errors.length,
      warnings: result.warnings.length,
      autoFixes: result.autoFixes.length,
    })

    // Output results to Claude Code
    if (result.errors.length > 0) {
      console.error(
        `❌ Found ${result.errors.length} issue(s) in ${path.basename(filePath)}`,
      )
      result.errors.forEach((error) => console.error(`  - ${error}`))
      process.exit(1)
    }

    if (result.autoFixes.length > 0) {
      console.log(
        `✅ Applied ${result.autoFixes.length} auto-fix(es) to ${path.basename(filePath)}`,
      )
    } else {
      console.log(`✅ ${path.basename(filePath)} passed all quality checks`)
    }
  } catch (error) {
    logger.error('Hook mode execution failed', { error: error.message })
    console.error(`❌ Quality check failed: ${error.message}`)
    process.exit(1)
  }
}

async function readStdinAsJSON(): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')

    process.stdin.on('data', (chunk) => {
      data += chunk
    })

    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data))
      } catch (error) {
        reject(new Error(`Invalid JSON input: ${error.message}`))
      }
    })

    process.stdin.on('error', reject)
  })
}
```

## Output Format Integration

### Success Output (Exit Code 0)

```
✅ Button.tsx passed all quality checks
```

### Auto-fix Output (Exit Code 0)

```
✅ Applied 3 auto-fix(es) to Button.tsx
  - Fixed indentation (Prettier)
  - Removed unused imports (ESLint)
  - Added missing semicolons (ESLint)
```

### Error Output (Exit Code 1)

```
❌ Found 2 issue(s) in Button.tsx
  - TypeScript: Property 'onClick' is missing in type 'Props'
  - ESLint: 'useState' is defined but never used
```

### Performance Logging

All operations log structured performance data for monitoring:

```json
{
  "timestamp": "2025-09-03T06:56:19.123Z",
  "correlationId": "qc-a1b2c3-d4e5f6",
  "level": "info",
  "message": "Quality check completed",
  "filePath": "/path/to/Button.tsx",
  "duration": 1247,
  "errors": 0,
  "warnings": 1,
  "autoFixes": 2,
  "checkers": {
    "eslint": { "duration": 456, "errors": 0, "fixes": 2 },
    "prettier": { "duration": 123, "errors": 0, "fixes": 0 },
    "typescript": { "duration": 668, "errors": 0, "warnings": 1 }
  }
}
```

## Error Handling Integration

### File Access Errors

- **File not found**: Exit 0 (Claude Code may delete files)
- **Permission denied**: Exit 1 with clear error message
- **Unsupported file type**: Exit 0 (skip gracefully)

### Performance Timeout

- **Timeout exceeded**: Exit 1 with timeout message
- **Memory limit**: Exit 1 with memory limit message

### Configuration Errors

- **Invalid config**: Exit 1 with validation message
- **Missing dependencies**: Exit 1 with installation guidance

### Hook Integration Error Handling

```typescript
export function handleHookError(error: Error, correlationId: string): void {
  const logger = createLogger({ correlationId })

  logger.error('Hook execution failed', {
    error: error.message,
    stack: error.stack,
  })

  // Provide user-friendly error messages
  if (error.message.includes('ENOENT')) {
    console.error('❌ File not found or permission denied')
  } else if (error.message.includes('timeout')) {
    console.error('❌ Quality check timed out (>5s)')
  } else if (error.message.includes('EMFILE')) {
    console.error('❌ Too many open files - try reducing concurrent operations')
  } else {
    console.error(`❌ Quality check failed: ${error.message}`)
  }

  process.exit(1)
}
```
````
