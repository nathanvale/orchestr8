# Environment Variables for Test Noise Reduction

This project implements intelligent noise reduction through environment-aware configuration. Use these environment variables to control test output verbosity.

## Quick Start

```bash
# Minimal output (recommended for development)
export VITEST_SILENT=true
pnpm test

# CI mode (errors only)
export CI=true
pnpm test

# Debug mode (full verbosity)
export DEBUG=true MEMORY_DEBUG=true
pnpm test
```

## Environment Variables

### Test Output Control

| Variable | Values | Description | Effect |
|----------|--------|-------------|--------|
| `VITEST_SILENT` | `true` / `false` | Controls Vitest output verbosity | When `true`, shows only failed tests and summary |
| `NODE_ENV` | `test` / `development` / `production` | Node environment | `test` automatically reduces noise |
| `CI` | `true` / `false` | CI environment detection | Shows only errors and failures |
| `DEBUG` | `true` / `false` | Debug mode | Preserves full verbosity when `true` |
| `MEMORY_DEBUG` | `true` / `false` | Memory monitoring output | Shows memory usage details when `true` |
| `VERBOSE` | `true` / `false` | Verbose reporter | Shows detailed test output |

### Logger Control

| Variable | Values | Description | Effect |
|----------|--------|-------------|--------|
| `CLAUDE_HOOK_SILENT` | `true` / `false` | Quality check hook output | Suppresses hook output when `true` |
| `CLAUDE_HOOK_DEBUG` | `true` / `false` | Quality check debug logging | Shows detailed debug logs |
| `CLAUDE_HOOK_LOG_FILE` | File path | Log file location | Writes logs to specified file |

### Turborepo Output

Turborepo output is controlled through `turbo.json` configuration:
- **lint/typecheck**: `errors-only` - Shows only errors
- **test**: `new-only` - Shows only new failures
- **format**: `none` - No output for formatting

## Usage Examples

### Development (Minimal Noise)
```bash
# <15 lines of output
export VITEST_SILENT=true
pnpm test
```

### CI Pipeline (Errors Only)
```bash
# Only failures and critical errors
export CI=true NODE_ENV=test
pnpm test
```

### Debugging (Full Output)
```bash
# All logs, memory usage, and verbose output
export DEBUG=true MEMORY_DEBUG=true VERBOSE=true
pnpm test
```

### Quality Check Hooks
```bash
# Silent quality checks during commits
export CLAUDE_HOOK_SILENT=true
git commit -m "feat: add feature"
```

## Output Comparison

### Before (200+ lines)
```
> vitest run
RUN  v3.2.4 /path/to/project
[tons of package manager output]
[memory monitoring logs]
[verbose test descriptions]
[detailed timing information]
...
```

### After (<15 lines)
```
> vitest run
RUN  v3.2.4 /path/to/project
✓ 150 tests passed
✓ 0 tests failed
Done in 5.2s
```

## npm/pnpm Configuration

The project includes `.npmrc` with `loglevel=warn` to reduce package manager noise.

## Best Practices

1. **Local Development**: Use `VITEST_SILENT=true` for focused work
2. **CI/CD**: Set `CI=true` in your pipeline configuration
3. **Debugging**: Enable `DEBUG=true` only when investigating issues
4. **Memory Issues**: Use `MEMORY_DEBUG=true` to track memory leaks
5. **Git Hooks**: Keep `CLAUDE_HOOK_SILENT=true` for clean commit workflows

## Troubleshooting

If you're not seeing expected output reduction:
1. Check that environment variables are properly exported
2. Verify `turbo.json` has correct `outputLogs` settings
3. Ensure `.npmrc` exists with `loglevel=warn`
4. Confirm latest changes are built (`pnpm build`)