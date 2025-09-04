# ADHD-Optimized Vitest & Wallaby.js Testing Configuration Guide

## 🎯 Executive Summary (TL;DR)
**What you get:** Sub-second test feedback, zero distractions, visual clarity
**Setup time:** 15 minutes
**Key benefit:** Tests run so fast you never lose focus

---

## 🚀 Quick Start (Copy-Paste Ready)

### Step 1: Wallaby Configuration (wallaby.js)
```javascript
// wallaby.js - ADHD-optimized for instant feedback
module.exports = function (wallaby) {
  const includeIntegration = process.env.WALLABY_INCLUDE_INTEGRATION === 'true';
  
  return {
    autoDetect: ['vitest'],
    
    files: [
      'packages/**/src/**/*.{ts,tsx,js,jsx}',
      '!packages/**/*.{integration,e2e,slow}.{test,spec}.{ts,tsx}',
      '!**/node_modules/**',
      '!**/dist/**'
    ],
    
    tests: [
      // Only fast unit tests for instant feedback
      'packages/**/*.unit.{test,spec}.{ts,tsx}',
      'packages/**/*.{test,spec}.{ts,tsx}', // Legacy support
      
      // Exclude slow tests that break focus
      '!packages/**/*.integration.{test,spec}.{ts,tsx}',
      '!packages/**/*.e2e.{test,spec}.{ts,tsx}',
      '!packages/**/*.slow.{test,spec}.{ts,tsx}',
      
      // Debug override when needed
      ...(includeIntegration ? ['packages/**/*.integration.{test,spec}.{ts,tsx}'] : []),
    ],
    
    workers: {
      initial: 6,  // Fast startup
      regular: 2,  // Preserve CPU for IDE
      restart: false // Keep workers warm
    },
    
    delays: {
      run: 300 // 300ms delay = less jumpiness
    },
    
    // ADHD-friendly output
    hints: {
      ignoreCoverage: true, // Less visual noise
      showConsoleLog: true  // See debug output immediately
    },
    
    runMode: 'onsave', // Run on save, not on type
    
    reportConsoleErrorAsError: true,
    lowCoverageColors: {
      low: '#ffcc00',    // Warm yellow (not harsh red)
      medium: '#66bb6a',  // Calming green
      high: '#4caf50'     // Success green
    }
  };
};
```

### Step 2: Vitest Configuration (vitest.config.ts)
```typescript
// vitest.config.ts - Optimized for focus & fast feedback
import { defineConfig } from 'vitest/config';
import { cpus } from 'node:os';

export default defineConfig({
  test: {
    // 🧠 ADHD-Optimized Settings
    
    // Pool configuration for stability
    pool: 'forks', // More stable than threads
    poolOptions: {
      forks: {
        maxForks: Math.max(1, cpus().length - 2), // Leave CPU for your brain
        minForks: 1,
        isolate: true, // Prevent test pollution
      }
    },
    
    // Instant feedback configuration
    watch: {
      // Only rerun tests for changed files
      mode: 'typecheck',
      useFsEvents: true,
      ignorePermissionErrors: true
    },
    
    // Clear, minimal output
    reporters: process.env.CI 
      ? ['default'] 
      : [['default', { 
          summary: false,     // No summary clutter
          hideSkipped: true,  // Hide skipped tests
        }]],
    
    // UI mode configuration
    ui: {
      port: 51204,
      open: false // Don't auto-open browser (distracting)
    },
    
    // Test organization
    sequence: {
      shuffle: false,  // Predictable order
      hooks: 'stack'   // Run setup/teardown in order
    },
    
    // Timeouts that respect ADHD time blindness
    testTimeout: 5000,    // 5s max for unit tests
    hookTimeout: 10000,   // 10s for setup/teardown
    
    // Smart retries (CI only, not during dev)
    retry: process.env.CI ? 2 : 0,
    
    // Focus helpers
    allowOnly: true,  // Allow test.only() for hyperfocus
    passWithNoTests: true, // Don't fail on empty suites
    
    // Coverage (optional, can be distracting)
    coverage: {
      enabled: false, // Turn on only when needed
      provider: 'v8',
      reporter: ['text-summary'], // Minimal output
      thresholds: {
        autoUpdate: true, // Auto-update thresholds
      }
    },
    
    // Exclude slow tests from watch mode
    exclude: [
      '**/node_modules/**',
      '**/*.integration.test.{ts,tsx}',
      '**/*.e2e.test.{ts,tsx}',
      '**/*.slow.test.{ts,tsx}'
    ],
    
    // Include pattern for different modes
    include: process.env.TEST_MODE === 'integration' 
      ? ['**/*.integration.test.{ts,tsx}']
      : process.env.TEST_MODE === 'e2e'
      ? ['**/*.e2e.test.{ts,tsx}']
      : ['**/*.unit.test.{ts,tsx}', '**/*.test.{ts,tsx}']
  }
});
```

### Step 3: Package.json Scripts
```json
{
  "scripts": {
    // 🎯 Primary Commands (use these daily)
    "test": "vitest run",
    "test:ui": "vitest --ui",
    "test:focus": "vitest watch --changed HEAD~1",
    
    // 🏃 Speed-Optimized Commands
    "test:unit": "vitest run **/*.unit.test.*",
    "test:unit:watch": "vitest watch **/*.unit.test.*",
    "test:quick": "vitest run --pool=threads --no-coverage",
    
    // 🐢 Slow Test Commands (run separately)
    "test:integration": "TEST_MODE=integration vitest run",
    "test:e2e": "TEST_MODE=e2e vitest run",
    "test:all": "vitest run --no-exclude",
    
    // 🔍 Focus & Debug Commands
    "test:failed": "vitest run --changed --onlyFailures",
    "test:debug": "vitest --inspect-brk --pool=threads --poolOptions.threads.singleThread",
    "test:related": "vitest watch --changed",
    
    // 📊 Analysis Commands
    "test:performance": "vitest run --reporter=verbose | grep -E '\\([0-9]+ms\\)' | sort -rn | head -20",
    "test:find-slow": "vitest run **/*.unit.test.* --reporter=verbose | grep -E '\\([5-9][0-9][0-9]ms|\\([0-9]{4,}ms\\)'",
    "test:coverage": "vitest run --coverage"
  }
}
```

## 🎨 Test Naming Convention (Critical for Focus)

```typescript
// ✅ FAST - Runs in Wallaby (instant feedback)
auth.unit.test.ts        // Unit test
auth.test.ts            // Default (legacy) - assumed unit

// ❌ SLOW - Excluded from Wallaby (run separately)  
auth.integration.test.ts // Database/API tests
auth.e2e.test.ts        // Browser tests
auth.slow.test.ts       // Known slow tests
```

## 🧠 ADHD-Specific Optimizations

### 1. Instant Visual Feedback
```typescript
// vitest.setup.ts - Enhanced console output
import { beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';

let testStartTime: number;

beforeEach(({ task }) => {
  testStartTime = performance.now();
  console.log(chalk.dim(`→ ${task.name}`));
});

afterEach(({ task }) => {
  const duration = performance.now() - testStartTime;
  const emoji = duration < 100 ? '⚡' : duration < 500 ? '✓' : '🐢';
  console.log(chalk.green(`${emoji} ${task.name} (${duration.toFixed(0)}ms)`));
});
```

### 2. Focus Mode Testing
```typescript
// test-utils/focus.ts
export function focusTest(name: string, fn: () => void) {
  const isFocusMode = process.env.FOCUS === 'true';
  
  if (isFocusMode && !name.includes('[FOCUS]')) {
    test.skip(name, fn);
  } else {
    test(name, fn);
  }
}

// Usage: Mark tests you're actively working on
focusTest('[FOCUS] should handle auth', () => {
  // This test runs in focus mode
});
```

### 3. Smart Test Prioritization
```javascript
// vitest.config.ts addition
export default defineConfig({
  test: {
    // Run failed tests first
    sequence: {
      hooks: 'stack',
      setupFiles: 'list',
      shuffle: false,
      concurrent: false
    },
    
    // Custom sequencer for smart ordering
    sequencer: class Sequencer {
      async sort(files) {
        // Recently modified files first
        const stats = await Promise.all(
          files.map(async (file) => ({
            file,
            mtime: (await fs.stat(file)).mtime.getTime()
          }))
        );
        
        return stats
          .sort((a, b) => b.mtime - a.mtime)
          .map(({ file }) => file);
      }
    }
  }
});
```

### 4. Minimal Noise Configuration
```typescript
// vitest.reporters.ts - Custom minimal reporter
export default class ADHDReporter {
  onFinished(files, errors) {
    if (errors.length > 0) {
      console.log('❌ Tests failed - see above for details');
    } else {
      console.log('✅ All tests passed');
    }
    // No verbose summaries, no tables, just results
  }
}
```

## 🔧 VS Code Integration

### settings.json (Workspace)
```json
{
  // Wallaby settings
  "wallaby.startAutomatically": true,
  "wallaby.showFailuresInline": true,
  "wallaby.showTestNames": false,
  "wallaby.compactMessageOutput": true,
  
  // Visual clarity
  "editor.codeLens": false,
  "editor.minimap.enabled": false,
  
  // Test explorer
  "testing.automaticallyOpenPeekView": "never",
  "testing.followRunningTest": false,
  "testing.showAllMessages": false,
  
  // Reduce distractions
  "workbench.editor.enablePreview": false,
  "workbench.tips.enabled": false
}
```

### Recommended Extensions
```json
{
  "recommendations": [
    "WallabyJs.wallaby-vscode",      // Wallaby.js
    "vitest.explorer",                // Vitest UI
    "usernamehw.errorlens",          // Inline errors
    "streetsidesoftware.code-spell-checker", // Catch typos
    "aaron-bond.better-comments"      // Color-coded comments
  ]
}
```

## 🎯 Workflow for Maximum Focus

### Daily Development Flow
```bash
# 1. Start your day - see what's broken
pnpm test:failed

# 2. Work on a feature - instant feedback
pnpm test:unit:watch

# 3. Before commit - run related tests
pnpm test:related

# 4. Before push - full test suite
pnpm test:all
```

### Debugging Workflow
```bash
# 1. Find the slow test
pnpm test:find-slow

# 2. Debug specific test
pnpm test:debug path/to/test.ts

# 3. Fix and verify
pnpm test:focus
```

## 🚦 Flaky Test Prevention

### Configuration for Deterministic Tests
```typescript
// test-setup.ts
import { beforeAll, afterEach } from 'vitest';

beforeAll(() => {
  // Fixed time for consistent snapshots
  vi.setSystemTime(new Date('2024-01-01'));
  
  // Stable random numbers
  Math.random = vi.fn(() => 0.5);
  
  // Predictable IDs
  let idCounter = 0;
  globalThis.generateId = () => `test-id-${++idCounter}`;
});

afterEach(() => {
  // Clean up after each test
  vi.clearAllMocks();
  vi.clearAllTimers();
});
```

### Retry Strategy for Flaky Tests
```typescript
// Mark known flaky tests
test.retry(3)('flaky database test', async () => {
  // This will retry up to 3 times
});
```

## 📊 Performance Monitoring

### Weekly Health Check Script
```bash
#!/bin/bash
# test-health.sh

echo "🔍 Test Health Report"
echo "===================="

echo "\n⚡ Fastest Tests:"
pnpm test:unit --reporter=verbose | grep -E '\([0-9]+ms\)' | sort -n | head -5

echo "\n🐢 Slowest Tests:"
pnpm test:unit --reporter=verbose | grep -E '\([0-9]+ms\)' | sort -rn | head -5

echo "\n❌ Flaky Tests (last 7 days):"
git log --since="7 days ago" --grep="fix.*test\|flaky" --oneline

echo "\n📈 Test Count:"
find . -name "*.test.ts" -o -name "*.spec.ts" | wc -l
```

## 🎉 Success Metrics

Your setup is ADHD-optimized when:
- ⚡ Unit tests complete in < 2 seconds
- 🎯 Wallaby shows results in < 500ms
- 🧠 Zero configuration decisions during coding
- 📝 Test output fits on one screen
- 🔇 No notifications unless tests fail
- ✅ Can stay in flow state for 25+ minutes

## 🆘 Troubleshooting Quick Fixes

```bash
# Tests running slow?
pnpm test:quick

# Too much output?
pnpm test --reporter=dot

# Lost focus?
pnpm test:focus

# Overwhelmed?
pnpm test:unit -- --testNamePattern="one specific test"

# Need a break?
pnpm test:ui  # Visual mode, less terminal stress
```

## 📚 Remember: Less is More

- **Don't optimize prematurely** - Start with basic config
- **Don't test everything** - Focus on critical paths
- **Don't chase 100% coverage** - 80% is plenty
- **Don't run all tests always** - Use focused testing
- **Don't fight the tools** - If it's hard, you're doing it wrong

---

**Final Note:** This configuration prioritizes developer happiness and sustained focus over perfect coverage. Ship code, stay focused, and maintain your flow. The best test suite is one that actually gets run.