---
task: 020
name: Policy and metrics enforcement
status: open
priority: low
created: 2025-09-23T15:00:00Z
updated: 2025-09-23T15:00:00Z
---

# Task 020: Policy and metrics enforcement

## Status: ❌ NOT STARTED

## Requirements (from Review)

Implement mocking policy enforcement and metrics collection.

### Planned Components

#### 1. Mock Density Metrics

```typescript
// src/metrics/mock-density.ts
export interface MockMetrics {
  totalMocks: number
  spyCount: number
  stubCount: number
  mocksByType: Record<string, number>
}

export function collectMockMetrics(): MockMetrics
export function reportMockDensity(): void
```

#### 2. Policy Enforcement

```typescript
// src/policy/enforcement.ts
export interface PolicyConfig {
  maxMocksPerTest?: number
  allowedMockTypes?: string[]
  requireRealImplementations?: string[]
}

export function enforceMockingPolicy(config: PolicyConfig): void
```

#### 3. CI Reporting

- Generate mock density reports
- Fail builds on policy violations
- Track trends over time
- Integration with GitHub Actions

### Features

- Count mocks/spies per test
- Warn when TESTKIT_MAX_MOCKS exceeded
- Generate policy violation reports
- Lint rule integration options
- Dashboard metrics export

### Implementation Tasks

1. Create metrics collection system
2. Add policy configuration
3. Implement enforcement hooks
4. Create CI reporter
5. Add lint rules (optional)
6. Build metrics dashboard

## Use Cases

- Enforce "mock trust boundaries only" policy
- Prevent over-mocking
- Track testing health metrics
- Guide refactoring efforts

## Priority

Low - Nice to have for mature teams
