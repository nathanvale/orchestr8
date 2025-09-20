---
created: 2025-09-18T07:32:12Z
last_updated: 2025-09-20T10:32:00Z
version: 1.1
author: Claude Code PM System + Nathan Vale
---

# System Patterns

## Architectural Style

- **Monorepo Architecture:** Turborepo-managed workspace
- **Package-Oriented Design:** Shared libraries with clear boundaries
- **Plugin Architecture:** Extensible through packages
- **Convention over Configuration:** Opinionated defaults

## Design Patterns

### Structural Patterns

#### Monorepo Workspace Pattern

- Centralized dependency management via pnpm
- Shared configuration inheritance
- Cross-package type safety
- Unified build orchestration

#### Package Export Pattern

```typescript
// Standard package exports structure
export * from './module-a'
export * from './module-b'
export { default } from './main'
```

#### Configuration Inheritance

- Base configs extended by packages
- `tsconfig.json` → `tsconfig.base.json`
- `vitest.shared.js` → `vitest.config.ts`
- Reduces duplication, ensures consistency

### Behavioral Patterns

#### Progressive Enhancement

- Smoke tests → Integration tests → E2E tests
- Quick validation → Deep validation
- Fail fast on critical paths

#### ADHD-Optimized Feedback Loop

```
Developer Action → <2s feedback → Stay in flow
                 ↓
           >2s feedback → Context switch risk
```

#### Error Suppression Pattern

- Console mocking in tests
- Silent mode for CI/production
- Verbose mode for debugging
- Graduated error visibility

### Creational Patterns

#### Builder Pattern for Test Config

- Fluent API for test configuration
- Chainable methods for setup
- Sensible defaults with overrides

## Data Flow Patterns

### Unidirectional Build Flow

```
Source → TypeScript → tsup → dist/
      ↓
    Tests → Vitest → Coverage → Reports
```

### Dependency Graph

```
@template/utils (foundation)
    ↓
@claude-hooks/quality-check (tooling)
    ↓
Applications (consumers)
```

### Cache Strategy

- Turborepo: Build output caching
- Vitest: Test result caching
- Voice-vault: Audio file caching
- Git: Ignored build artifacts

## Testing Patterns

### Test Organization

```
tests/
├── unit/        # Isolated component tests
├── integration/ # Component interaction tests
├── e2e/         # Full workflow tests
└── smoke/       # Critical path validation
```

### Mocking Patterns (Strict)

#### Mock When

- At **trust boundaries**: external APIs, 3rd-party SDKs, payments, email
- For **nondeterminism**: time, timers, randomness, UUIDs, environment
- For **hostile platform APIs**: Canvas, WebGL in jsdom
- For **CLI unit tests**: stub `child_process.exec`

#### Do Not Mock

- Domain/business modules
- Database drivers (use SQLite or Testcontainers instead)
- Global `fetch` or `fs` (use MSW/tmp dirs)

#### Promotion Heuristic

- If a test uses **>2 mocks** or **>3 spy assertions**, promote to
  **integration**.

#### Scenario-Specific Solutions

- **HTTP**: MSW for unit/integration, stub 3P APIs in E2E only
- **Databases**: SQLite/convex-test for unit, Testcontainers for integration
- **CLI**: stub exec in unit, run in tmp dir for integration, full CLI in E2E
- **File System**: memfs/tmp dirs for unit, tmp real dirs for integration, real
  disk asserts in E2E
- **Time/Timers**: `vi.useFakeTimers`, `vi.setSystemTime`
- **Randomness**: stub `Math.random`, `crypto.randomUUID`
- **3rd-Party SDKs**: wrap in adapters, fake in unit, test sandbox in
  integration

### Mock Avoidance Pattern

- Prefer real implementations
- Use test databases/services
- Mock only external APIs
- Validate actual behavior

### Test Fixture Pattern

- Shared test setup utilities
- Reusable test data
- Consistent test environments
- Teardown guarantees

## Configuration Patterns

### Environment-Based Config

```javascript
const isCI = process.env.CI === 'true'
const isDebug = process.env.DEBUG === 'true'
const config = isCI ? ciConfig : isDebug ? debugConfig : defaultConfig
```

### Feature Flags

```typescript
// Progressive feature enablement
const features = {
  silentMode: process.env.VITEST_SILENT === 'true',
  memoryMonitoring: !isCI,
  verboseLogging: isDebug,
}
```

## Performance Patterns

### Lazy Loading

- Dynamic imports for heavy dependencies
- On-demand package loading
- Code splitting in applications

### Resource Pooling

- Thread pool for test execution
- Connection pooling for databases
- Reusable worker processes

### Memory Management

```javascript
// Explicit memory limits
NODE_OPTIONS = '--max-old-space-size=4096'

// Cleanup patterns
afterEach(() => cleanup())
afterAll(() => teardown())
```

## Error Handling Patterns

### Fail-Fast Pattern

- Critical errors stop execution
- Non-critical errors logged and continued
- Clear error boundaries

### Graceful Degradation

```typescript
try {
  await primaryProvider.process()
} catch (error) {
  logger.warn('Primary failed, using fallback')
  await fallbackProvider.process()
}
```

### Error Recovery

- Automatic retries with backoff
- Circuit breaker for external services
- Fallback to cached data

## Security Patterns

### Dependency Security

- Regular dependency updates
- Security audit in CI
- Lock file integrity checks

### Environment Isolation

- Separate test/dev/prod configs
- No secrets in code
- Environment variable validation

## Development Workflow Patterns

### Continuous Validation

```
Code → Pre-commit hooks → Local tests → CI validation → Merge
```

### Incremental Development

- Small, focused commits
- Feature flags for gradual rollout
- Backwards compatibility

### Documentation as Code

- README-driven development
- Inline code documentation
- Generated API docs from types
