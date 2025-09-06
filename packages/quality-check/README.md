# @template/quality-check

Fast, lightweight quality checking for ESLint, Prettier, and TypeScript with <2s
execution time. Designed for ADHD-optimized developer workflows with instant
feedback and zero configuration complexity.

## Features

- ⚡ **Sub-300ms Warm Performance** - TypeScript 5.7+ incremental compilation
  with persistent cache
- 🔄 **Parallel Execution** - Run ESLint, Prettier, and TypeScript checks
  simultaneously
- 🛡️ **Atomic File Operations** - Safe auto-fixes with backup/restore capability
- 🔍 **Smart Auto-Detection** - Automatically detects Claude Code hook mode via
  stdin
- 📊 **Correlation IDs** - Track operations across the validation pipeline
- 🎯 **Exit Code Strategy** - Clear communication via standardized exit codes
  (0=ok, 1=issues, 2=error)
- 🚀 **Zero Global Install** - Works directly with `npx` - no PATH configuration
  needed
- 🏗️ **Three-Tier System** - Progressive quality enforcement (pre-commit,
  Claude, CI/CD)
- 📋 **JSON Output Mode** - Structured output for CI/CD integration
- 🎨 **Stylish Formatter** - ESLint-style human-readable output
- 🚄 **ESLint v9 Support** - Flat config support with built-in caching
- 💅 **Prettier Node API** - Direct API integration for maximum performance
- 📈 **Performance Monitoring** - Built-in performance tracking and reporting
- 🤖 **Enhanced Autopilot** - Intelligent classification of fixable issues with
  TypeScript error code support
- 📝 **Rich Diagnostics** - Structured issue format with engine, severity,
  line/column, and suggestion data

## Installation

```bash
# As a dev dependency
pnpm add -D @template/quality-check

# Or use directly with npx (no installation required)
npx @template/quality-check --file src/index.ts
```

## Usage

### CLI Mode - Direct File Checking

```bash
# Check a single file
npx @template/quality-check --file src/index.ts

# Check with auto-fix enabled
npx @template/quality-check --file src/index.ts --fix

# Check with specific tools only
npx @template/quality-check --file src/index.ts --no-eslint --no-prettier

# Debug mode with verbose logging
npx @template/quality-check --file src/index.ts --debug
```

### Claude Code PostToolUse Hook

The quality-check package includes full Claude Code hook integration. Run the
setup script to configure:

```bash
# Setup Claude hooks automatically
bash scripts/setup-claude-hooks.sh

# Or configure manually by creating ~/.claude/hooks.json:
```

```json
{
  "hooks": {
    "post_tool_use": {
      "enabled": true,
      "command": "/path/to/project/packages/quality-check/bin/claude-hook",
      "timeout": 5000,
      "operations": ["write_file", "edit_file", "multi_edit", "create_file"],
      "description": "Quality check for TypeScript, ESLint, and Prettier"
    }
  }
}
```

The hook automatically:

- ✅ Checks TypeScript, ESLint, and Prettier on file operations
- 🔧 Auto-fixes safe issues silently
- 📝 Reports unfixable issues to Claude Code
- 🚀 Works seamlessly in the background

Test the hook manually:

```bash
# Test with valid code (silent pass)
echo '{"operation":"write_file","file_path":"test.ts","content":"const x = 1;"}' | ./packages/quality-check/bin/claude-hook

# Test with issues (will auto-fix or report)
echo '{"operation":"write_file","file_path":"test.ts","content":"const x:any=1;console.log(x)"}' | ./packages/quality-check/bin/claude-hook
```

### Programmatic Usage

```typescript
import { QualityChecker } from '@template/quality-check'
import { createLogger } from '@orchestr8/logger'

const logger = await createLogger({ name: 'my-app' })

const checker = new QualityChecker(
  'src/index.ts',
  {
    eslint: true,
    prettier: true,
    typescript: true,
    fix: false,
    parallel: true,
    timeout: 5000,
    correlationId: 'my-check-123',
  },
  logger,
)

const result = await checker.check()
console.log(result)
// {
//   success: true,
//   errors: [],
//   warnings: [],
//   autofixes: [],
//   correlationId: 'my-check-123',
//   duration: 847,
//   checkers: { ... }
// }
```

## Command Line Options

| Option                   | Description                                 | Default   |
| ------------------------ | ------------------------------------------- | --------- |
| `--file, -f <path>`      | Check a specific file                       | -         |
| `--fix`                  | Enable auto-fix for ESLint and Prettier     | `false`   |
| `--no-eslint`            | Skip ESLint checks                          | `false`   |
| `--no-prettier`          | Skip Prettier checks                        | `false`   |
| `--no-typescript`        | Skip TypeScript checks                      | `false`   |
| `--debug`                | Enable debug logging                        | `false`   |
| `--silent`               | Suppress output                             | `false`   |
| `--sequential`           | Run checks sequentially instead of parallel | `false`   |
| `--timeout <ms>`         | Set timeout in milliseconds                 | `3000`    |
| `--format <type>`        | Output format: stylish or json              | `stylish` |
| `--staged`               | Check only staged files (git)               | `false`   |
| `--since <ref>`          | Check files changed since git ref           | -         |
| `--typescript-cache-dir` | TypeScript cache directory                  | OS temp   |
| `--eslint-cache-dir`     | ESLint cache directory                      | `.cache`  |
| `--help, -h`             | Show help message                           | -         |

## Exit Codes

The package uses standardized exit codes for clear communication:

| Code | Description                              |
| ---- | ---------------------------------------- |
| `0`  | Success - all checks passed              |
| `1`  | Issues found (linting/formatting errors) |
| `2`  | Internal error or misconfiguration       |

## Hook Payload Formats

The package supports both modern and legacy Claude Code payload formats:

### Modern Format

```json
{
  "tool": "Write",
  "path": "src/index.ts",
  "projectDir": "/path/to/project"
}
```

### Legacy Format

```json
{
  "tool": "Write",
  "filePath": "src/index.ts"
}
```

## Performance

All quality checks are optimized for sub-300ms warm performance:

- **TypeScript 5.7+**: File-scoped incremental compilation with persistent
  tsBuildInfo cache
- **ESLint v9**: Flat config support with built-in caching mechanism
- **Prettier Node API**: Direct API integration with resolveConfig() and
  format()
- **Parallel Execution**: All checkers run simultaneously by default

Typical execution times:

- Cold run (first check): ~500-900ms
- Warm run (with cache): <300ms median
- With all three checkers: <500ms warm
- With auto-fix enabled: <600ms warm

### Performance Monitoring

The package includes built-in performance monitoring:

```typescript
import { PerformanceMonitor } from '@template/quality-check'

const monitor = new PerformanceMonitor()
monitor.startSession()

// Track operations
await monitor.trackOperation('typescript', 'check', async () => {
  // Your check operation
})

const report = monitor.generateReport()
monitor.printSummary(report)
```

## Security Features

- **Atomic File Operations**: All file modifications use atomic writes with
  backup/restore
- **File Locking**: Prevents concurrent modifications with proper-lockfile
- **Path Validation**: Protection against path traversal attacks
- **Input Sanitization**: Safe handling of file paths and payloads
- **Resource Limits**: File size limits (10MB default) and timeout protection

## Logging

The package uses @orchestr8/logger for structured logging with correlation IDs:

```bash
# Enable debug logging
DEBUG=* npx @template/quality-check --file src/index.ts

# Or use the --debug flag
npx @template/quality-check --file src/index.ts --debug
```

Each operation is tracked with a correlation ID (format:
`qc-{timestamp}-{random}`) for full observability across the validation
pipeline.

## Requirements

- Node.js 18+
- TypeScript 5.7+ (for incremental compilation features)
- ESLint 9.0+ (for flat config support)
- Prettier 3.3+ (already compatible)

Checks are gracefully skipped if tools are not found.

## Three-Tier Quality System

This package implements a comprehensive three-tier quality enforcement system:

1. **Tier 1: Pre-commit** - Catches issues before commit (strict)
2. **Tier 2: Claude Hook** - Auto-fixes safe issues during AI development
   (smart)
3. **Tier 3: CI/CD** - Final validation before merge (comprehensive)

📚 **[Full Documentation](../docs/THREE-TIER-QUALITY-SYSTEM.md)**

## ADHD-Optimized Design

This package is specifically designed for ADHD-optimized developer workflows:

- **<2s Feedback Loop**: Maintains flow state without cognitive interruption
- **Zero Configuration**: Works immediately with sensible defaults
- **Clear Exit Codes**: Instant understanding of what went wrong
- **Parallel by Default**: Maximizes speed to minimize waiting
- **Correlation IDs**: Never lose track of what's happening
- **Smart Auto-Detection**: Reduces decision fatigue

## Contributing

This package is part of the bun-changesets-template monorepo. Contributions are
welcome!

## License

MIT
