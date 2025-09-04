# Testing Guide - Vitest + Wallaby.js (2025)

## Quick Start

### Running Tests
```bash
# Run all tests once
pnpm test

# Watch mode (ADHD-friendly: instant feedback)
pnpm test:watch

# Focus on changed files only
pnpm test:focus

# Run with coverage
pnpm test:coverage

# Visual test UI (great for ADHD brains)
pnpm test:ui

# Debug mode with enhanced logging
pnpm test:debug
```

## Configuration Overview

### Modern 2025 Setup
- **Threading**: Using `threads` pool for optimal performance (30-50% faster than `forks`)
- **Auto-discovery**: Projects automatically discovered via `projects: ['packages/*']` pattern
- **ADHD-friendly**: Minimal output, fast feedback loops, visual indicators
- **Wallaby integration**: Auto-detection with debug mode support

### Key Files
- `vitest.config.ts` - Main workspace configuration
- `vitest.shared.ts` - Shared configuration base for packages
- `wallaby.cjs` - Wallaby.js integration with auto-detection
- `package.json` - Enhanced test scripts

## Wallaby.js Integration

### Setup
Wallaby should auto-detect your configuration. If you're having issues:

1. **Enable debug mode**: Set `WALLABY_TRACE=true` environment variable
2. **Check Wallaby version**: Ensure you have v1.0.1369+ for best Vitest support
3. **Verify auto-detection**: Wallaby automatically finds `vitest.config.ts`

### Troubleshooting Wallaby

#### "Wallaby did not detect that any vitest tasks were executed"
**Problem**: Most common Vitest 3.x integration issue
**Solutions**:
1. **Check Wallaby version**: Ensure v1.0.1369+ for Vitest 3.x support
2. **Restart Wallaby**: Stop and restart Wallaby completely
3. **Check dependencies**: Ensure Vitest versions match across packages
4. **Use single worker**: Set `workers: { initial: 1, regular: 1 }` (already configured)

#### "Cannot find package 'json5'"
**Problem**: Missing dependency for turborepo validation
**Solution**: Already fixed - `pnpm add -D -w json5`

#### "Failed to initialize wallaby vitest"
**Problem**: Wallaby core version incompatibility
**Solutions**:
1. Update Wallaby core (auto-updates typically)
2. Check if using correct Node.js version (20+)
3. Ensure vitest.config.ts is valid TypeScript

#### Tests not showing in Wallaby
**Problem**: File pattern mismatch or exclusion rules
**Solutions**:
1. Check test file patterns match: `**/*.{test,spec}.{ts,tsx}`
2. Verify files aren't in node_modules or build directories
3. Check tsconfig.json includes test files

#### Auto-detection not working
**Problem**: Wallaby can't find or parse vitest.config.ts
**Fallback**: Explicit configuration (already applied)
```javascript
testFramework: {
  configFile: './vitest.config.ts'
}
```

#### Vitest dependency conflicts
**Problem**: Version mismatches between packages
**Solutions**:
1. Check all packages use same Vitest version: `pnpm list vitest`
2. Update all Vitest-related packages together:
   ```bash
   pnpm update vitest @vitest/coverage-v8 @vitest/ui
   ```

### Debug Mode
```bash
# Enable enhanced Wallaby logging
WALLABY_TRACE=true pnpm test:debug
```

## Performance Optimization

### Threading Configuration
The configuration automatically optimizes workers based on your CPU:
- **Max threads**: CPU cores - 1 (leaves resources for system)
- **Min threads**: 1 (prevents over-allocation)

### ADHD-Friendly Features

#### Minimal Cognitive Load
- **Clean output**: Summary disabled by default (less noise)
- **Fast feedback**: Sub-second test reruns in watch mode
- **Visual indicators**: Color-coded test status in Wallaby
- **Focus mode**: `test:focus` runs only changed files

#### Quick Commands
```bash
# Instant test rerun on any change
pnpm test:watch

# Only test files you've modified
pnpm test:focus

# Visual dashboard (great for visual learners)
pnpm test:ui
```

## Common Issues & Solutions

### 1. "Dynamic require" Errors
**Problem**: `Dynamic require of "os" is not supported`
**Solution**: Already fixed - using proper ES imports

### 2. Coverage Directory Errors
**Problem**: `ENOENT: no such file or directory, open '.../coverage/.tmp/...`
**Solution**: Coverage directory auto-created, but you may need to run:
```bash
mkdir -p test-results/coverage
```

### 3. Deprecated Reporters
**Problem**: `'basic' reporter is deprecated`
**Solution**: Already updated to use `[['default', { summary: false }]]`

### 4. Tests Running Slowly
**Problem**: Tests feel sluggish
**Solutions**:
- Ensure using `threads` pool (not `forks`)
- Check worker configuration matches your CPU
- Use `test:focus` for changed files only
- Consider test isolation settings

### 5. Wallaby Not Detecting Changes
**Problem**: Wallaby isn't picking up file changes
**Solutions**:
- Check file patterns in `wallaby.cjs`
- Ensure files aren't in `.gitignore` or excluded patterns
- Try restarting Wallaby
- Enable debug mode with `WALLABY_TRACE=true`

## Package-Level Configuration

### Adding Vitest to New Packages
For packages that need custom Vitest settings:

```typescript
// packages/your-package/vitest.config.ts
import { createVitestConfig } from '../../vitest.shared'

export default createVitestConfig({
  test: {
    environment: 'jsdom', // For React components
    coverage: {
      enabled: true,
      threshold: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
```

### Browser Testing
For packages that need browser environment:
```typescript
export default createVitestConfig({
  test: {
    environment: 'happy-dom', // or 'jsdom'
    setupFiles: ['./test-setup.ts'],
  },
})
```

## Best Practices

### ADHD-Friendly Testing Workflow
1. **Start with `test:watch`** - Instant feedback as you code
2. **Use Wallaby** - Visual test results directly in editor
3. **Focus on one feature** - Use `test:focus` for changed files
4. **Quick validation** - `pnpm test` before commits
5. **Visual dashboard** - `test:ui` for comprehensive overview

### Test Organization
```
packages/
├── your-package/
│   ├── src/
│   │   ├── component.ts
│   │   └── component.test.ts  ✓ Co-located tests
│   └── vitest.config.ts       ✓ Package-specific config
└── shared/
    ├── vitest.shared.ts       ✓ Common configuration
    └── test-utils.ts          ✓ Shared test utilities
```

### Performance Tips
- **Parallel execution**: Automatically enabled with threads pool
- **Smart caching**: Vitest caches unchanged files
- **Selective testing**: Use `test:focus` for active development
- **Visual feedback**: Wallaby provides instant inline results

## Migration from Old Setup

### Key Changes Made
- ✅ **Threads over forks**: 30-50% performance improvement
- ✅ **Project auto-discovery**: Simplified configuration
- ✅ **Wallaby auto-detection**: Reduced manual configuration
- ✅ **ADHD-friendly scripts**: Fast, focused, visual testing options
- ✅ **Shared configuration**: Consistent settings across packages

### Breaking Changes
- **Reporter**: Changed from 'basic' to 'default' with minimal summary
- **Pool**: Switched from 'forks' to 'threads'
- **Patterns**: Simplified include/exclude patterns

## Getting Help

### Debug Information
When reporting issues, include:
```bash
# Vitest version and dependency check
pnpm vitest --version
pnpm list vitest

# Configuration validation
pnpm vitest --config vitest.config.ts --run --reporter=verbose

# Wallaby debug output
WALLABY_TRACE=true pnpm test:debug

# Check for conflicting dependencies
pnpm ls | grep vitest
```

### Useful Commands
```bash
# Check configuration is valid
pnpm vitest --config vitest.config.ts --reporter=verbose --run

# Test a specific file
pnpm vitest run path/to/test.test.ts

# Run tests with maximum verbosity
pnpm vitest --reporter=verbose --coverage --ui
```

---

This setup prioritizes developer experience with ADHD-friendly features: fast feedback, minimal cognitive load, and visual indicators for rapid context switching.