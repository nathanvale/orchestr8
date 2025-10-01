# Setup Guide

A comprehensive guide to setting up @orchestr8/testkit in your project.

## Table of Contents

1. [Installation & Initial Setup](#1-installation--initial-setup)
2. [Configuration](#2-configuration)
3. [Project Structure Setup](#3-project-structure-setup)
4. [First Test Setup](#4-first-test-setup)
5. [Feature-Specific Setup](#5-feature-specific-setup)
6. [Common Scenarios](#6-common-scenarios)
7. [Verification](#7-verification)
8. [Next Steps](#8-next-steps)

## 1. Installation & Initial Setup

### Fresh Project Setup

```bash
# Initialize your project
npm init -y

# Install core dependencies
npm install --save-dev @orchestr8/testkit @vitest/ui vitest

# Install TypeScript (recommended)
npm install --save-dev typescript @types/node
```

### Adding to Existing Project

```bash
# Install core dependencies
npm install --save-dev @orchestr8/testkit @vitest/ui vitest

# Or with pnpm
pnpm add -D @orchestr8/testkit @vitest/ui vitest

# Or with yarn
yarn add -D @orchestr8/testkit @vitest/ui vitest
```

### Peer Dependency Installation

The testkit requires `vitest` and `@vitest/ui` as peer dependencies:

```json
{
  "devDependencies": {
    "@orchestr8/testkit": "^1.0.0",
    "@vitest/ui": "^3.2.4",
    "vitest": "^3.2.4"
  }
}
```

### Optional Dependency Installation

Install only the optional dependencies you need based on features you'll use:

```bash
# For MSW mock server testing
npm install --save-dev msw happy-dom

# For SQLite testing
npm install --save-dev better-sqlite3 @types/better-sqlite3

# For container testing (Docker required)
npm install --save-dev testcontainers

# For MySQL container testing
npm install --save-dev testcontainers mysql2 @types/mysql2

# For PostgreSQL container testing
npm install --save-dev testcontainers pg @types/pg

# For Convex testing
npm install --save-dev convex-test

# Install all optional features
npm install --save-dev msw happy-dom better-sqlite3 @types/better-sqlite3 convex-test testcontainers mysql2 @types/mysql2 pg @types/pg
```

## 2. Configuration

### Vitest Configuration (Basic)

Create `vitest.config.ts` in your project root:

```typescript
import { defineConfig } from 'vitest/config'
import { createVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createVitestConfig({
    test: {
      globals: true,
      environment: 'node',
    },
  })
)
```

### Vitest Configuration (Advanced)

For more control over your test configuration:

```typescript
import { defineConfig } from 'vitest/config'
import { createVitestConfig } from '@orchestr8/testkit/config'

export default defineConfig(
  createVitestConfig({
    test: {
      globals: true,
      environment: 'happy-dom', // requires happy-dom for DOM testing
      setupFiles: ['@orchestr8/testkit/register'],
      include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/*.test.ts',
          '**/*.spec.ts',
        ],
      },
      testTimeout: 10000,
      hookTimeout: 10000,
    },
  })
)
```

### TypeScript Configuration

Update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "node"]
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Package.json Scripts

Add test scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  }
}
```

### IDE Setup

#### VSCode

Install the Vitest extension:

1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Vitest"
4. Install "Vitest" by Vitest

Create `.vscode/settings.json`:

```json
{
  "vitest.enable": true,
  "vitest.commandLine": "npm run test",
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

#### WebStorm

1. Go to Settings > Languages & Frameworks > JavaScript > Testing
2. Select Vitest as the test runner
3. Point to your `vitest.config.ts`

## 3. Project Structure Setup

### Recommended Test Directory Structure

```
your-project/
├── src/
│   ├── utils/
│   │   ├── math.ts
│   │   └── math.test.ts          # Co-located unit tests
│   └── api/
│       ├── users.ts
│       └── users.test.ts
├── tests/
│   ├── integration/               # Integration tests
│   │   ├── api.test.ts
│   │   └── database.test.ts
│   ├── e2e/                      # End-to-end tests
│   │   └── user-flow.test.ts
│   └── fixtures/                 # Test fixtures
│       ├── users.json
│       └── test-data.ts
├── vitest.config.ts
└── package.json
```

### Test File Naming Conventions

Follow these naming patterns:

- **Unit tests**: `*.test.ts` or `*.spec.ts` (co-located with source)
- **Integration tests**: `*.integration.test.ts`
- **E2E tests**: `*.e2e.test.ts`
- **Examples**: `*.example.ts` (excluded from test runs)

### Setup Files Location

Create a setup file for global test configuration:

```typescript
// tests/setup.ts
import { beforeAll, afterAll } from 'vitest'

beforeAll(() => {
  // Global setup
  console.log('Starting test suite')
})

afterAll(() => {
  // Global cleanup
  console.log('Test suite complete')
})
```

Reference it in `vitest.config.ts`:

```typescript
export default defineConfig(
  createVitestConfig({
    test: {
      setupFiles: ['./tests/setup.ts'],
    },
  })
)
```

## 4. First Test Setup

### Simple Unit Test Example

Create `src/utils/math.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

function add(a: number, b: number): number {
  return a + b
}

describe('Math utilities', () => {
  it('should add two numbers', () => {
    expect(add(2, 3)).toBe(5)
  })

  it('should handle negative numbers', () => {
    expect(add(-1, 1)).toBe(0)
  })
})
```

Run it:

```bash
npm test
```

### Integration Test Example

Create `tests/integration/api.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTempDirectory } from '@orchestr8/testkit'

describe('API Integration Tests', () => {
  let tempDir: ReturnType<typeof createTempDirectory>

  beforeEach(() => {
    tempDir = createTempDirectory()
  })

  afterEach(async () => {
    await tempDir.cleanup()
  })

  it('should handle file operations', async () => {
    const testFile = `${tempDir.path}/test.txt`
    await fs.writeFile(testFile, 'test content')
    const content = await fs.readFile(testFile, 'utf-8')
    expect(content).toBe('test content')
  })
})
```

### Container Test Example (Docker Required)

Create `tests/integration/database.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createPostgresContext } from '@orchestr8/testkit/containers'

describe('Database Integration Tests', () => {
  let context: Awaited<ReturnType<typeof createPostgresContext>>

  beforeAll(async () => {
    context = await createPostgresContext({
      database: 'testdb',
      username: 'testuser',
      password: 'testpass',
    })
  }, 60000) // Container startup needs longer timeout

  afterAll(async () => {
    await context.cleanup()
  })

  it('should connect to database', async () => {
    const result = await context.db.query('SELECT 1 as value')
    expect(result.rows[0].value).toBe(1)
  })
})
```

Note: Container tests require Docker Desktop to be running.

## 5. Feature-Specific Setup

### SQLite Testing Setup

1. **Install dependencies**:

```bash
npm install --save-dev better-sqlite3 @types/better-sqlite3
```

2. **Create test file** `tests/sqlite.test.ts`:

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import {
  createFileDatabase,
  applyRecommendedPragmas,
  type FileDatabase,
} from '@orchestr8/testkit/sqlite'
import Database from 'better-sqlite3'

describe('SQLite Tests', () => {
  let db: Database.Database
  let fileDb: FileDatabase

  beforeEach(async () => {
    // Create fresh database
    fileDb = await createFileDatabase('test.db')
    db = new Database(fileDb.path)

    // Apply recommended settings
    await applyRecommendedPragmas(db, {
      journalMode: 'WAL',
      foreignKeys: true,
      busyTimeoutMs: 5000,
    })

    // Create schema
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )
    `)
  })

  afterEach(async () => {
    db.close()
    await fileDb.cleanup()
  })

  test('should insert and query', () => {
    db.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get('Alice')
    expect(user).toBeDefined()
  })
})
```

### Container Testing Setup (testcontainers)

1. **Prerequisites**:

   - Docker Desktop installed and running
   - Docker daemon accessible

2. **Install dependencies**:

```bash
npm install --save-dev testcontainers pg @types/pg
```

3. **Create test file** `tests/postgres.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createPostgresContext } from '@orchestr8/testkit/containers'

describe('PostgreSQL Tests', () => {
  let context: Awaited<ReturnType<typeof createPostgresContext>>

  beforeAll(async () => {
    context = await createPostgresContext({
      database: 'testdb',
      username: 'testuser',
      password: 'testpass',
    })

    // Run migrations
    await context.db.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      )
    `)
  }, 60000)

  afterAll(async () => {
    await context.cleanup()
  })

  it('should perform CRUD operations', async () => {
    await context.db.query('INSERT INTO users (name) VALUES ($1)', ['Alice'])
    const result = await context.db.query('SELECT * FROM users WHERE name = $1', [
      'Alice',
    ])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].name).toBe('Alice')
  })
})
```

### MSW Mock Server Setup

1. **Install dependencies**:

```bash
npm install --save-dev msw happy-dom
```

2. **Update vitest config** to use happy-dom:

```typescript
export default defineConfig(
  createVitestConfig({
    test: {
      environment: 'happy-dom',
    },
  })
)
```

3. **Create test file** `tests/msw.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createSuccessResponse, http, setupMSW } from '@orchestr8/testkit/msw'

// Setup mock server
setupMSW([
  http.get('*/api/users', () =>
    createSuccessResponse([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ])
  ),
])

describe('MSW Tests', () => {
  it('should mock API endpoints', async () => {
    const response = await fetch('http://localhost:3000/api/users')
    const users = await response.json()
    expect(users).toHaveLength(2)
    expect(users[0].name).toBe('Alice')
  })
})
```

### Convex Testing Setup

1. **Install dependencies**:

```bash
npm install --save-dev convex-test
```

2. **Create test file** `tests/convex.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createConvexTestHarness } from '@orchestr8/testkit/convex'

describe('Convex Tests', () => {
  it('should test Convex functions', async () => {
    const harness = await createConvexTestHarness()
    // Use harness to test your Convex functions
    await harness.cleanup()
  })
})
```

### Resource Management Setup

The testkit includes automatic resource management:

```typescript
import { describe, it, expect } from 'vitest'
import { createTempDirectory } from '@orchestr8/testkit'

describe('Resource Management', () => {
  it('automatically cleans up resources', () => {
    // Resources are tracked and cleaned up automatically
    const tempDir = createTempDirectory()

    // Use tempDir...

    // Cleanup happens automatically after test
  })
})
```

## 6. Common Scenarios

### Monorepo Setup

For a monorepo structure, create a shared config:

```typescript
// packages/testkit-config/vitest.base.ts
import { defineConfig } from 'vitest/config'
import { createVitestConfig } from '@orchestr8/testkit/config'

export function createSharedConfig(overrides = {}) {
  return createVitestConfig({
    test: {
      globals: true,
      environment: 'node',
      ...overrides,
    },
  })
}
```

Use it in each package:

```typescript
// packages/my-package/vitest.config.ts
import { defineConfig } from 'vitest/config'
import { createSharedConfig } from '@repo/testkit-config'

export default defineConfig(
  createSharedConfig({
    test: {
      name: 'my-package',
    },
  })
)
```

### CI/CD Integration

#### GitHub Actions

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Generate coverage
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

#### Environment Variables for CI

The testkit automatically detects CI environments. You can customize behavior:

```typescript
// vitest.config.ts
export default defineConfig(
  createVitestConfig({
    test: {
      testTimeout: process.env.CI ? 30000 : 10000,
      hookTimeout: process.env.CI ? 20000 : 10000,
    },
  })
)
```

### Local Development Workflow

1. **Watch mode for rapid feedback**:

```bash
npm run test:watch
```

2. **UI mode for interactive testing**:

```bash
npm run test:ui
```

3. **Run specific test files**:

```bash
npm test -- path/to/test.ts
```

4. **Filter tests by name**:

```bash
npm test -- -t "should handle errors"
```

### Docker/Docker Desktop Setup

For container testing, ensure Docker is properly configured:

1. **Install Docker Desktop**:

   - Download from [docker.com](https://www.docker.com/products/docker-desktop/)
   - Follow installation instructions for your OS

2. **Verify Docker is running**:

```bash
docker info
```

3. **Configure testcontainers** (optional):

Create `.testcontainers.properties`:

```properties
docker.client.strategy=org.testcontainers.dockerclient.EnvironmentAndSystemPropertyClientProviderStrategy
testcontainers.reuse.enable=true
```

4. **Common Docker issues**:

   - **Permission denied**: Add your user to docker group
   - **Cannot connect**: Ensure Docker daemon is running
   - **Slow startup**: Increase Docker memory allocation in settings

## 7. Verification

### How to Verify Setup is Correct

Run these checks to ensure your setup is working:

1. **Check TypeScript compilation**:

```bash
npm run typecheck
```

2. **Run a simple test**:

```bash
npm test
```

3. **Verify optional dependencies** (if installed):

```typescript
// tests/verify-setup.test.ts
import { describe, it } from 'vitest'

describe('Setup Verification', () => {
  it('can import core utilities', () => {
    const { delay, retry } = require('@orchestr8/testkit')
    expect(delay).toBeDefined()
    expect(retry).toBeDefined()
  })

  it('can import SQLite utilities (if installed)', () => {
    try {
      const { createFileDatabase } = require('@orchestr8/testkit/sqlite')
      expect(createFileDatabase).toBeDefined()
    } catch (e) {
      console.log('SQLite not installed (optional)')
    }
  })

  it('can import MSW utilities (if installed)', () => {
    try {
      const { setupMSW } = require('@orchestr8/testkit/msw')
      expect(setupMSW).toBeDefined()
    } catch (e) {
      console.log('MSW not installed (optional)')
    }
  })
})
```

### Running First Tests

Start with a simple test to verify everything works:

```typescript
// tests/hello-world.test.ts
import { describe, it, expect } from 'vitest'
import { delay } from '@orchestr8/testkit'

describe('Hello World', () => {
  it('should run a basic test', () => {
    expect(true).toBe(true)
  })

  it('should use testkit utilities', async () => {
    const start = Date.now()
    await delay(100)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(100)
  })
})
```

Run with:

```bash
npm test tests/hello-world.test.ts
```

### Troubleshooting Common Setup Issues

#### Issue: "Cannot find module '@orchestr8/testkit'"

**Solution**:

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Issue: "Module not found: @orchestr8/testkit/sqlite"

**Solution**: Install the optional dependency:

```bash
npm install --save-dev better-sqlite3 @types/better-sqlite3
```

#### Issue: TypeScript errors with globals

**Solution**: Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "node"]
  }
}
```

#### Issue: Tests timeout in CI

**Solution**: Increase timeouts for CI:

```typescript
export default defineConfig(
  createVitestConfig({
    test: {
      testTimeout: process.env.CI ? 30000 : 10000,
    },
  })
)
```

#### Issue: Docker containers fail to start

**Solutions**:

- Ensure Docker Desktop is running
- Check Docker has sufficient memory (4GB+ recommended)
- Verify network connectivity
- Try pulling images manually: `docker pull postgres:latest`

#### Issue: "happy-dom is not installed"

**Solution**: Install for DOM testing:

```bash
npm install --save-dev happy-dom
```

Update config:

```typescript
export default defineConfig(
  createVitestConfig({
    test: {
      environment: 'happy-dom',
    },
  })
)
```

## 8. Next Steps

Now that you have testkit set up, explore these resources:

- **[Getting Started Guide](./README.md)** - Learn about core features and usage
- **[API Reference](./API.md)** - Detailed API documentation
- **[Migration Guide](./MIGRATION.md)** - Upgrading from previous versions
- **[Troubleshooting Guide](./TROUBLESHOOTING.md)** - Common issues and solutions

### Learning Path

1. Start with **core utilities** (delay, retry, temp directories)
2. Add **environment management** for environment-specific behavior
3. Integrate **MSW** for API mocking
4. Add **SQLite testing** for database tests
5. Use **container testing** for integration tests
6. Explore **advanced features** (resource management, concurrency control)

### Example Projects

Check out the `examples/` directory for complete working examples:

- `examples/cli/` - CLI testing examples
- `examples/fs/` - File system testing examples
- `examples/msw/` - MSW mock server examples
- `examples/sqlite/` - SQLite database testing examples

### Community and Support

- **Issues**: Report bugs on GitHub
- **Discussions**: Ask questions in GitHub Discussions
- **Contributing**: See CONTRIBUTING.md for guidelines

### Best Practices

- Use `beforeEach`/`afterEach` for test isolation
- Always clean up resources (databases, files, containers)
- Use appropriate timeouts for different test types
- Leverage environment detection for CI-specific behavior
- Keep tests focused and independent
- Use descriptive test names
- Mock external dependencies
- Test error cases, not just happy paths
