# Task 006 Analysis: Configure Vitest base settings

## Current State Assessment

**Existing Implementation Found**:

- `packages/testkit/src/config/vitest.base.ts` already exists with comprehensive
  configuration
- Environment detection fully implemented in
  `packages/testkit/src/config/environment.ts`
- Pool strategy already set to 'forks' for stability
- Wallaby compatibility integrated

## Parallel Streams

### Stream A: Package Migration & Integration

- **Files**: All `vitest.config.ts` files across packages
- **Work**: Update packages to extend from base configuration
- **Dependencies**: None
- **Estimated Time**: 1-2 hours

### Stream B: Configuration Templates

- **Files**: `src/config/presets/*.ts`
- **Work**: Create preset configurations (unit, integration, e2e)
- **Dependencies**: None
- **Estimated Time**: 1 hour

### Stream C: Documentation & Examples

- **Files**: `docs/vitest-config.md`, `examples/vitest-configs/*`
- **Work**: Migration guide, best practices, example configurations
- **Dependencies**: None (can run parallel)
- **Estimated Time**: 1-2 hours

### Stream D: Testing & Validation

- **Files**: `src/config/__tests__/*.test.ts`
- **Work**: Test configuration merging, environment detection, Wallaby
  integration
- **Dependencies**: Streams A & B should complete first
- **Estimated Time**: 2 hours

### Stream E: Performance Optimization

- **Files**: `src/config/performance.ts`, `benchmarks/*`
- **Work**: Optimize worker counts, memory limits, pool strategies per
  environment
- **Dependencies**: None
- **Estimated Time**: 1-2 hours

## Dependencies Graph

````mermaid
graph TD
    A[Stream A: Migration] --> D[Stream D: Testing]
    B[Stream B: Templates] --> D
    C[Stream C: Documentation]
    E[Stream E: Performance]
```text

## Configuration Features Already Implemented

### Base Configuration

```typescript
export function defineVitestConfig(overrides?: InlineConfig): InlineConfig {
  const env = getTestEnvironment()
  const baseConfig: InlineConfig = {
    test: {
      globals: true,
      environment: 'node',
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: env.isWallaby,
          isolate: true,
        },
      },
      isolate: true,
      clearMocks: true,
      mockReset: true,
      restoreMocks: true,
      testTimeout: env.timeouts.test,
      hookTimeout: env.timeouts.hook,
      teardownTimeout: env.timeouts.teardown,
    },
  }
}
````

### Environment Detection

- CI detection (GitHub Actions, Jenkins, CircleCI, etc.)
- Wallaby detection via WALLABY_ENV (set to 'true')
- Vitest/Jest detection
- Debug mode detection

## Integration Points

1. **Package Setup**: All packages import from `@workspace/testkit/config`
2. **Wallaby Config**: Auto-detection ensures compatibility
3. **CI Pipeline**: Environment-specific optimizations
4. **Coverage Tools**: Integrated coverage configuration

## File Patterns

```
packages/testkit/
├── src/config/
│   ├── vitest.base.ts      [DONE]
│   ├── environment.ts      [DONE]
│   ├── presets/           [Stream B]
│   │   ├── unit.ts
│   │   ├── integration.ts
│   │   └── e2e.ts
│   ├── performance.ts     [Stream E]
│   └── __tests__/        [Stream D]
├── docs/
│   └── vitest-config.md  [Stream C]
└── examples/
    └── vitest-configs/    [Stream C]
```

## Implementation Strategy

### Quick Migration Path

```typescript
// Before: Custom configuration in each package
export default defineConfig({
  test: {
    /* custom config */
  },
})

// After: Extend from base
import { defineVitestConfig } from '@workspace/testkit/config'
export default defineVitestConfig({
  // Only overrides needed
})
```

### Environment-Aware Settings

```typescript
// Automatic optimization based on environment
if (env.isCi) {
  config.reporters = ['default', 'junit']
  config.bail = 1
} else if (env.isWallaby) {
  config.pool = 'forks'
  config.poolOptions.forks.singleFork = true
}
```

## Risk Mitigation

- **Risk**: Breaking existing test suites during migration
  - **Mitigation**: Incremental migration with backward compatibility
- **Risk**: Performance regression
  - **Mitigation**: Benchmark before/after, environment-specific tuning
- **Risk**: Wallaby incompatibility
  - **Mitigation**: Already tested and validated in current implementation

## Success Metrics

- All packages using base configuration
- Test execution time maintained or improved
- Zero configuration drift between packages
- Wallaby providing < 1 second feedback
