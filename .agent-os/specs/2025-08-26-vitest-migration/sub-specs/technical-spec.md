# Technical Specification - Vitest Migration

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-26-vitest-migration/spec.md

> Created: 2025-08-26
> Version: 1.0.0

## Technical Requirements

- Maintain Bun runtime for optimal performance while using Vitest as the test framework
- Achieve sub-50ms test feedback loops through optimized configuration
- Full Wallaby.js integration with inline VS Code feedback
- Complete MSW integration for API mocking with proper module resolution
- Maintain 100% backward compatibility with existing test patterns
- Support both individual test execution and full suite runs
- Coverage reporting with configurable thresholds (minimum 80%)
- CI/CD pipeline compatibility with existing GitHub Actions workflows

## 1. Vitest Configuration

### Complete vitest.config.ts

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Environment configuration
    environment: 'happy-dom', // Faster than jsdom for DOM testing
    
    // Performance optimizations for 2025
    pool: 'forks', // Use forks instead of threads for better Bun compatibility
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: false, // Better performance with Bun
        minForks: 1,
        maxForks: process.env.CI ? 4 : undefined // Limit in CI, unlimited locally
      }
    },
    
    // File patterns
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      'build',
      'coverage',
      '.turbo',
      '**/.bun/**'
    ],
    
    // Module resolution fixes for MSW and ES modules
    deps: {
      moduleDirectories: ['node_modules'],
      external: [
        // Exclude Bun-specific modules from transformation
        /^bun:/
      ]
    },
    
    // Setup files
    setupFiles: ['./vitest.setup.ts'],
    
    // Global configuration
    globals: true, // Enable global test functions (describe, it, expect)
    clearMocks: true, // Auto-clear mocks between tests
    mockReset: true, // Reset mock state between tests
    restoreMocks: true, // Restore original implementation after tests
    
    // Coverage configuration with 2025 optimizations
    coverage: {
      provider: 'v8', // Faster than istanbul, better Bun compatibility
      reporter: [
        'text',
        'text-summary',
        'html',
        'lcov',
        'json-summary'
      ],
      reportsDirectory: './coverage',
      exclude: [
        'coverage/**',
        'dist/**',
        'build/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/*.config.{js,ts,mjs}',
        '**/.{eslint,prettier}rc.{js,cjs,yml,yaml,json}',
        'vitest.setup.ts',
        'wallaby.js'
      ],
      include: [
        'src/**/*.{js,ts,jsx,tsx}'
      ],
      // Configurable thresholds
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      // Skip coverage collection in watch mode for performance
      enabled: !process.env.VITEST_WATCH,
      skipFull: false
    },
    
    // Watch mode optimizations
    watchExclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/.bun/**'
    ],
    
    // Timeout configurations
    testTimeout: 10000, // 10 seconds for individual tests
    hookTimeout: 10000, // 10 seconds for hooks
    teardownTimeout: 5000, // 5 seconds for teardown
    
    // Reporter configuration
    reporter: process.env.CI ? ['verbose', 'junit'] : ['verbose'],
    outputFile: {
      junit: './coverage/junit.xml'
    },
    
    // Snapshot configuration
    snapshotFormat: {
      printBasicPrototype: false
    },
    
    // Advanced options for ADHD-optimized feedback
    passWithNoTests: true,
    logHeapUsage: process.env.NODE_ENV === 'development',
    
    // UI mode configuration (for development)
    ui: process.env.VITEST_UI === 'true',
    open: false // Don't auto-open browser
  },
  
  // Vite configuration for better module resolution
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@tests': new URL('./tests', import.meta.url).pathname,
      '@types': new URL('./types', import.meta.url).pathname,
      '@utils': new URL('./src/utils', import.meta.url).pathname,
      '@config': new URL('./config', import.meta.url).pathname
    }
  },
  
  // ESBuild configuration for TypeScript processing
  esbuild: {
    target: 'esnext',
    keepNames: true
  }
})
```

### Thread Pool Performance Configuration

The 2025 optimized configuration uses:
- **Fork pool**: Better isolation and Bun compatibility than threads
- **Dynamic fork allocation**: Unlimited locally for development speed, limited in CI for resource management
- **Isolation disabled**: Better performance with Bun runtime
- **V8 coverage provider**: Native performance advantage with Bun's JavaScriptCore engine

## 2. Wallaby.js Configuration

### Complete wallaby.js Configuration

```javascript
module.exports = function () {
  return {
    // Use Bun as the runtime for maximum performance
    testRunner: {
      kind: 'bun-test',
      config: {
        // Use vitest command instead of bun test
        testCommand: 'bun run vitest run --reporter=verbose --no-coverage'
      }
    },
    
    // Alternative: Use Vitest directly (recommended for 2025)
    testFramework: {
      type: 'vitest',
      config: {
        configFile: './vitest.config.ts'
      }
    },
    
    // File patterns
    files: [
      'src/**/*.{js,ts,jsx,tsx}',
      'vitest.config.ts',
      'vitest.setup.ts',
      'tsconfig.json',
      'package.json',
      // Include MSW handlers
      'src/mocks/**/*.ts'
    ],
    
    tests: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,ts,jsx,tsx}'
    ],
    
    // Environment configuration
    env: {
      type: 'node',
      runner: 'bun', // Use Bun as the runtime
      params: {
        runner: '--bun' // Pass Bun flag to test runner
      }
    },
    
    // Setup function for MSW and global configuration
    setup: function (wallaby) {
      // Set environment variables for optimal performance
      process.env.NODE_ENV = 'test'
      process.env.VITEST_WALLABY = 'true'
      
      // Configure module resolution for MSW
      const path = require('path')
      const { pathsToModuleNameMapper } = require('ts-jest')
      const { compilerOptions } = require('./tsconfig.json')
      
      // Setup module aliases to match vitest.config.ts
      const moduleNameMapper = pathsToModuleNameMapper(
        compilerOptions.paths || {},
        { prefix: path.join(wallaby.projectCacheDir, '/') }
      )
      
      return {
        moduleNameMapper
      }
    },
    
    // Debugging and logging
    debug: false,
    trace: true, // Enable for debugging module resolution
    
    // Performance optimizations
    workers: {
      initial: 1,
      regular: 4,
      recycle: false // Better performance with Bun
    },
    
    // File change detection
    filesWithNoCoverageCalculated: [
      'vitest.setup.ts',
      'src/mocks/**/*.ts'
    ],
    
    // Preprocessing configuration
    preprocessors: {
      '**/*.{js,jsx,ts,tsx}': file => {
        // Use Bun's built-in TypeScript transformation
        return file.content
      }
    },
    
    // Report configuration for VS Code integration
    reports: {
      textCoverage: true,
      htmlCoverage: true
    },
    
    // Hints for better VS Code integration
    hints: {
      allowIgnoringCoverageInTests: true,
      ignoreCoverageForFile: /\.test\.|\.spec\./,
      maxConsoleMessagesPerTest: 100
    }
  }
}
```

### VS Code Integration Settings

Add to `.vscode/settings.json`:

```json
{
  "wallaby.startAutomatically": true,
  "wallaby.codeLensFeature": {
    "runTest": true,
    "debugTest": true,
    "runTestFile": true
  },
  "wallaby.testStats": {
    "runningTestCountThreshold": 3
  },
  "editor.inlineSuggest.enabled": true,
  "testing.automaticallyOpenPeekView": "failureInVisibleDocument",
  "vitest.enable": true,
  "vitest.commandLine": "bun run vitest"
}
```

## 3. MSW and Mocking Setup

### Complete vitest.setup.ts

```typescript
import { beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { rest } from 'msw'
import type { RestHandler } from 'msw'

// Mock handlers for common API patterns
const defaultHandlers: RestHandler[] = [
  // Example API handlers
  rest.get('/api/health', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ status: 'ok' }))
  }),
  
  rest.get('/api/user/:id', (req, res, ctx) => {
    const { id } = req.params
    return res(
      ctx.status(200),
      ctx.json({
        id,
        name: `Test User ${id}`,
        email: `test${id}@example.com`
      })
    )
  }),
  
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        token: 'mock-jwt-token',
        user: { id: '1', name: 'Test User' }
      })
    )
  })
]

// Setup MSW server
export const server = setupServer(...defaultHandlers)

// Global setup and teardown
beforeAll(() => {
  // Start MSW server
  server.listen({
    onUnhandledRequest: 'warn' // Log unhandled requests in development
  })
  
  // Mock common browser APIs
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  
  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
  
  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
  
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  })
  
  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock
  })
  
  // Mock fetch (fallback if MSW doesn't handle it)
  global.fetch = vi.fn()
  
  // Setup console mocking for cleaner test output
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks()
  vi.clearAllTimers()
})

afterEach(() => {
  // Reset any request handlers that may have been added during tests
  server.resetHandlers()
})

afterAll(() => {
  // Clean up MSW server
  server.close()
  
  // Restore all mocks
  vi.restoreAllMocks()
})

// Utility functions for test setup
export const mockApiResponse = (url: string, response: any, status = 200) => {
  server.use(
    rest.get(url, (req, res, ctx) => {
      return res(ctx.status(status), ctx.json(response))
    })
  )
}

export const mockApiError = (url: string, status = 500, message = 'Server Error') => {
  server.use(
    rest.get(url, (req, res, ctx) => {
      return res(ctx.status(status), ctx.json({ error: message }))
    })
  )
}

// React Testing Library configuration (if using React)
import '@testing-library/jest-dom/vitest' // Add jest-dom matchers

// Custom render function for React components (example)
import { render as rtlRender, type RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Wrapper component for providers (customize as needed)
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  // Add your providers here (Router, Theme, Context, etc.)
  return <>{children}</>
}

export const render = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => rtlRender(ui, { wrapper: AllTheProviders, ...options })

// Export all testing utilities
export * from '@testing-library/react'
export { userEvent } from '@testing-library/user-event'
```

### Mock Handlers Examples

Create `src/mocks/handlers.ts`:

```typescript
import { rest } from 'msw'

export const handlers = [
  // User management
  rest.get('/api/users', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
      ])
    )
  }),
  
  rest.post('/api/users', async (req, res, ctx) => {
    const newUser = await req.json()
    return res(
      ctx.status(201),
      ctx.json({
        id: Date.now(),
        ...newUser
      })
    )
  }),
  
  rest.put('/api/users/:id', async (req, res, ctx) => {
    const { id } = req.params
    const updates = await req.json()
    return res(
      ctx.status(200),
      ctx.json({
        id: Number(id),
        ...updates
      })
    )
  }),
  
  rest.delete('/api/users/:id', (req, res, ctx) => {
    return res(ctx.status(204))
  }),
  
  // Authentication
  rest.post('/api/auth/login', async (req, res, ctx) => {
    const { email, password } = await req.json()
    
    if (email === 'admin@example.com' && password === 'password') {
      return res(
        ctx.status(200),
        ctx.json({
          token: 'mock-jwt-token',
          user: {
            id: 1,
            name: 'Admin User',
            email: 'admin@example.com',
            role: 'admin'
          }
        })
      )
    }
    
    return res(
      ctx.status(401),
      ctx.json({ error: 'Invalid credentials' })
    )
  }),
  
  // File upload
  rest.post('/api/upload', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        url: 'https://example.com/uploaded-file.jpg',
        id: 'file-123'
      })
    )
  }),
  
  // Paginated data
  rest.get('/api/posts', (req, res, ctx) => {
    const page = Number(req.url.searchParams.get('page') || 1)
    const limit = Number(req.url.searchParams.get('limit') || 10)
    
    const posts = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      title: `Post ${i + 1}`,
      content: `Content for post ${i + 1}`
    }))
    
    const start = (page - 1) * limit
    const end = start + limit
    
    return res(
      ctx.status(200),
      ctx.json({
        data: posts.slice(start, end),
        pagination: {
          page,
          limit,
          total: posts.length,
          totalPages: Math.ceil(posts.length / limit)
        }
      })
    )
  })
]
```

### Vi.* Utilities Usage Examples

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Mock utilities examples', () => {
  describe('Function mocking', () => {
    it('should mock a function', () => {
      const mockFn = vi.fn()
      mockFn('test')
      
      expect(mockFn).toHaveBeenCalledWith('test')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })
    
    it('should mock with implementation', () => {
      const mockFn = vi.fn().mockImplementation((x: number) => x * 2)
      const result = mockFn(5)
      
      expect(result).toBe(10)
    })
    
    it('should mock return values', () => {
      const mockFn = vi.fn()
        .mockReturnValueOnce('first')
        .mockReturnValueOnce('second')
        .mockReturnValue('default')
      
      expect(mockFn()).toBe('first')
      expect(mockFn()).toBe('second')
      expect(mockFn()).toBe('default')
    })
  })
  
  describe('Module mocking', () => {
    it('should mock an entire module', () => {
      vi.mock('lodash', () => ({
        debounce: vi.fn().mockImplementation((fn) => fn),
        throttle: vi.fn().mockImplementation((fn) => fn)
      }))
    })
    
    it('should partially mock a module', () => {
      vi.mock('../utils/api', async () => {
        const actual = await vi.importActual('../utils/api')
        return {
          ...actual,
          fetchUser: vi.fn().mockResolvedValue({ id: 1, name: 'Test User' })
        }
      })
    })
  })
  
  describe('Timer mocking', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    
    it('should mock setTimeout', async () => {
      const callback = vi.fn()
      setTimeout(callback, 1000)
      
      await vi.advanceTimersByTime(1000)
      
      expect(callback).toHaveBeenCalled()
    })
    
    it('should mock Date', () => {
      const mockDate = new Date('2025-01-01T00:00:00.000Z')
      vi.setSystemTime(mockDate)
      
      expect(new Date().toISOString()).toBe('2025-01-01T00:00:00.000Z')
    })
  })
  
  describe('Spy utilities', () => {
    it('should spy on object methods', () => {
      const obj = {
        method: (x: number) => x + 1
      }
      
      const spy = vi.spyOn(obj, 'method')
      obj.method(5)
      
      expect(spy).toHaveBeenCalledWith(5)
    })
    
    it('should spy on console methods', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      console.log('test message')
      
      expect(consoleSpy).toHaveBeenCalledWith('test message')
    })
  })
})
```

## 4. Package.json Scripts

### Complete Test Scripts Configuration

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:ui": "vitest ui",
    "test:coverage": "vitest run --coverage",
    "test:coverage:watch": "vitest watch --coverage",
    "test:coverage:open": "vitest run --coverage && open coverage/index.html",
    "test:coverage:upload": "codecov -f coverage/lcov.info",
    "test:changed": "vitest run --changed",
    "test:related": "vitest run --changed HEAD~1",
    "test:affected": "vitest run --changed --reporter=verbose",
    "test:file": "vitest run --reporter=verbose",
    "test:debug": "vitest run --reporter=verbose --no-coverage --run",
    "test:inspect": "vitest run --inspect-brk",
    "test:wallaby": "echo 'Use Wallaby extension in VS Code'",
    "test:performance": "hyperfine --warmup 3 'bun run test' --export-markdown test-perf.md",
    "test:benchmark": "vitest bench",
    "test:e2e": "echo 'E2E tests not configured in this migration'",
    "test:integration": "vitest run --config vitest.config.integration.ts",
    "test:unit": "vitest run src/**/*.test.ts",
    "test:clear-cache": "vitest run --clearCache",
    "test:reporter:json": "vitest run --reporter=json --outputFile=test-results.json",
    "test:reporter:junit": "vitest run --reporter=junit --outputFile=junit.xml",
    "test:ci": "vitest run --coverage --reporter=verbose --reporter=junit --outputFile=junit.xml",
    "test:ci:coverage": "vitest run --coverage --reporter=verbose && codecov",
    "validate": "bun run lint:check && bun run format:check && bun run typecheck && bun run test:ci"
  }
}
```

### Command Structure Best Practices

- **Use `bun run` prefix**: Ensures consistent execution through Bun's package manager
- **Avoid `bun x` for tests**: Direct script execution is faster for frequently run commands
- **Separate CI and development scripts**: Different reporting needs and performance optimizations
- **Include performance testing**: Benchmark test execution speed for ADHD-optimized feedback

## 5. Performance Optimizations

### Parallel Test Execution Configuration

```typescript
// vitest.config.performance.ts
import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    // Optimize for CI/CD performance
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true, // Better isolation in CI
        minForks: 2,
        maxForks: process.env.CI ? 8 : 4 // More aggressive parallelization in CI
      }
    },
    
    // Memory optimization
    maxMemoryLimit: '1GB',
    
    // Timeout optimizations for CI
    testTimeout: 15000, // Longer timeout in CI
    hookTimeout: 15000,
    
    // Disable UI and coverage in CI for speed
    ui: false,
    coverage: {
      ...baseConfig.test?.coverage,
      enabled: true,
      skipFull: true // Skip full coverage collection for speed
    }
  }
})
```

### Memory Optimization Settings

```typescript
// Memory-conscious configuration for large test suites
export const memoryOptimizedConfig = {
  test: {
    // Limit concurrent tests to prevent memory issues
    poolOptions: {
      forks: {
        maxForks: 2, // Reduce for memory-constrained environments
        singleFork: false,
        isolate: true
      }
    },
    
    // Clear mocks more aggressively
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    
    // Garbage collection hints
    pool: 'forks', // Better memory isolation
    
    // Disable features that consume memory
    coverage: {
      enabled: false // Disable in development for memory savings
    }
  }
}
```

### Caching Strategies

```typescript
// vitest.config.cache.ts - Caching optimizations
export const cacheConfig = {
  test: {
    // Cache test results for faster re-runs
    cache: {
      dir: 'node_modules/.vitest'
    },
    
    // File watching optimizations
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.git/**',
      '**/.bun/**'
    ],
    
    // Dependency handling for better caching
    deps: {
      external: [
        /^bun:/,
        /^node:/
      ],
      // Cache external dependencies
      fallbackCJS: true
    }
  }
}
```

## 6. Migration Patterns

### Bun Test to Vitest API Migration

#### Before (Bun Test)
```typescript
import { expect, test, describe, beforeAll, afterAll } from 'bun:test'
import { mock } from 'bun:test'

describe('User service', () => {
  const mockFetch = mock()
  
  beforeAll(() => {
    global.fetch = mockFetch
  })
  
  test('should fetch user data', async () => {
    mockFetch.mockReturnValue(Promise.resolve({
      json: () => Promise.resolve({ id: 1, name: 'Test User' })
    }))
    
    const user = await fetchUser(1)
    expect(user.name).toBe('Test User')
  })
})
```

#### After (Vitest)
```typescript
import { expect, test, describe, beforeAll, afterAll, vi } from 'vitest'

describe('User service', () => {
  const mockFetch = vi.fn()
  
  beforeAll(() => {
    global.fetch = mockFetch
  })
  
  test('should fetch user data', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ id: 1, name: 'Test User' })
    })
    
    const user = await fetchUser(1)
    expect(user.name).toBe('Test User')
  })
})
```

### Mock System Conversion

#### Before (Bun Mocking)
```typescript
import { mock } from 'bun:test'

// Bun-style mocking
const mockLogger = mock()
mockLogger.mockReturnValue(undefined)

// Module mocking in Bun
mock.module('./logger', () => ({
  log: mockLogger
}))
```

#### After (Vitest Mocking)
```typescript
import { vi } from 'vitest'

// Vitest-style mocking
const mockLogger = vi.fn()
mockLogger.mockReturnValue(undefined)

// Module mocking in Vitest
vi.mock('./logger', () => ({
  log: mockLogger
}))
```

### Timer Mock Updates

#### Before (Bun Timers)
```typescript
import { setSystemTime, mock } from 'bun:test'

test('timer test', async () => {
  const originalDate = Date
  setSystemTime(new Date('2025-01-01'))
  
  // Test code with mocked time
  
  setSystemTime(originalDate) // Reset
})
```

#### After (Vitest Timers)
```typescript
import { vi } from 'vitest'

test('timer test', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2025-01-01'))
  
  // Test code with mocked time
  
  vi.useRealTimers() // Reset
})
```

### Assertion Updates

#### Before (Bun Assertions)
```typescript
import { expect } from 'bun:test'

// Bun's expect API
expect(result).toEqual(expected)
expect(mockFn).toHaveBeenCalledWith(args)
```

#### After (Vitest Assertions)
```typescript
import { expect } from 'vitest'

// Vitest's expect API (compatible with Jest)
expect(result).toEqual(expected)
expect(mockFn).toHaveBeenCalledWith(args)

// Additional Vitest-specific matchers
expect(result).toMatchSnapshot()
expect(mockFn).toHaveBeenCalledOnce()
```

## 7. Troubleshooting Guide

### Common MSW Module Resolution Errors

#### Error: MSW handlers not working
**Symptoms**: API calls not being intercepted by MSW handlers
**Solution**: 
```typescript
// Ensure proper module resolution in vitest.config.ts
export default defineConfig({
  test: {
    deps: {
      external: [/^node:/, /^bun:/],
      inline: ['msw']
    },
    setupFiles: ['./vitest.setup.ts']
  }
})

// In vitest.setup.ts, ensure server is started before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
```

#### Error: "Cannot resolve module" for MSW
**Symptoms**: Import errors when importing MSW modules
**Solution**:
```bash
# Install MSW with proper peer dependencies
bun add -d msw @types/node

# Ensure MSW is properly configured for Node.js
# In package.json, add:
"msw": {
  "workerDirectory": "public"
}
```

### Wallaby Debugging Tips

#### Issue: Wallaby not showing test results
**Diagnosis**:
```javascript
// Add to wallaby.js for debugging
module.exports = function () {
  return {
    // ... other config
    debug: true,
    trace: true,
    
    // Enable detailed logging
    reportConsoleErrorAsError: true,
    reportUnhandledPromises: false,
    
    // Check file patterns
    files: [
      { pattern: 'src/**/*.{js,ts,jsx,tsx}', load: true },
      { pattern: 'vitest.config.ts', load: true }
    ]
  }
}
```

#### Issue: Module resolution problems in Wallaby
**Solution**:
```javascript
// Enhanced wallaby.js with better module resolution
module.exports = function (wallaby) {
  return {
    env: {
      type: 'node',
      runner: 'bun',
      params: {
        env: 'NODE_OPTIONS=--loader=tsx/esm'
      }
    },
    
    // Better file processing
    preprocessors: {
      '**/*.{ts,tsx}': file => {
        // Use Bun's built-in TypeScript processing
        return require('bun').transpiler.transformSync(file.content, {
          loader: file.path.endsWith('.tsx') ? 'tsx' : 'ts'
        })
      }
    }
  }
}
```

### Performance Tuning

#### Slow test execution
**Diagnosis**:
```bash
# Profile test execution
bun run vitest run --reporter=verbose --logHeapUsage

# Check for memory leaks
bun run vitest run --coverage --maxWorkers=1
```

**Solutions**:
```typescript
// Optimize vitest.config.ts for performance
export default defineConfig({
  test: {
    // Reduce parallelization if memory-constrained
    maxWorkers: process.env.CI ? 4 : 2,
    
    // Disable expensive features during development
    coverage: {
      enabled: process.env.CI === 'true'
    },
    
    // Optimize file watching
    watchExclude: [
      '**/node_modules/**',
      '**/coverage/**'
    ]
  }
})
```

### Bun Compatibility Issues

#### Issue: ESM import problems
**Symptoms**: "Cannot use import statement outside a module"
**Solution**:
```json
// Ensure package.json has:
{
  "type": "module",
  
  // And tsconfig.json has:
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

#### Issue: Bun runtime conflicts with Vitest
**Symptoms**: Tests fail with runtime errors
**Solution**:
```typescript
// Create separate configs for different environments
// vitest.config.bun.ts
export default defineConfig({
  test: {
    environment: 'bun', // Use Bun environment
    pool: 'forks'
  }
})

// vitest.config.node.ts
export default defineConfig({
  test: {
    environment: 'node', // Use Node.js environment for compatibility
    pool: 'threads'
  }
})
```

## 8. Integration Points

### VS Code Settings Updates

```json
{
  // .vscode/settings.json
  "vitest.enable": true,
  "vitest.commandLine": "bun run vitest",
  "vitest.rootConfig": "./vitest.config.ts",
  
  // Wallaby integration
  "wallaby.startAutomatically": true,
  "wallaby.codeLensFeature": {
    "runTest": true,
    "debugTest": true
  },
  
  // Testing integration
  "testing.openTesting": "neverOpen",
  "testing.followRunningTest": false,
  
  // Performance settings
  "editor.quickSuggestions": {
    "other": true,
    "comments": false,
    "strings": false
  },
  
  // File associations
  "files.associations": {
    "*.test.ts": "typescript",
    "*.spec.ts": "typescript"
  }
}
```

### ESLint Configuration for Vitest

```javascript
// eslint.config.js updates
import vitest from 'eslint-plugin-vitest'

export default [
  // ... existing config
  {
    files: ['**/*.test.{js,ts,jsx,tsx}', '**/*.spec.{js,ts,jsx,tsx}'],
    plugins: {
      vitest
    },
    rules: {
      ...vitest.configs.recommended.rules,
      
      // Vitest-specific rules
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error',
      'vitest/prefer-to-be': 'error',
      'vitest/prefer-to-have-length': 'error',
      'vitest/valid-expect': 'error',
      
      // Allow test-specific patterns
      '@typescript-eslint/no-explicit-any': 'off',
      'sonarjs/no-duplicate-string': 'off'
    },
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly'
      }
    }
  }
]
```

### TypeScript Types Configuration

```json
{
  "compilerOptions": {
    "types": [
      "bun-types",
      "vitest/globals",
      "@testing-library/jest-dom",
      "node"
    ]
  },
  "include": [
    "src/**/*",
    "tests/**/*",
    "vitest.config.ts",
    "vitest.setup.ts"
  ]
}
```

### Git Hooks Updates

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run linting
bun run lint:check

# Run type checking
bun run typecheck

# Run tests (fast subset)
bun run test:changed

# Run formatting check
bun run format:check
```

## Implementation Checklist

- [ ] Install Vitest and related dependencies
- [ ] Create vitest.config.ts with optimized settings
- [ ] Create vitest.setup.ts with MSW integration
- [ ] Configure Wallaby.js for VS Code integration
- [ ] Update package.json scripts
- [ ] Migrate existing tests from Bun test to Vitest
- [ ] Update ESLint configuration for Vitest
- [ ] Update VS Code settings for better integration
- [ ] Configure CI/CD pipeline for Vitest
- [ ] Test Wallaby integration and real-time feedback
- [ ] Verify coverage reporting and thresholds
- [ ] Performance benchmark compared to Bun test
- [ ] Documentation updates for team members

This comprehensive technical specification provides all the necessary code and configuration for migrating from Bun's native test runner to Vitest while maintaining optimal performance and developer experience.