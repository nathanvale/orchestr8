# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-08-29-runtime-adapter-vitest-unification/spec.md

> Created: 2025-08-29 Version: 1.0.0

## Technical Requirements

- **Runtime Abstraction Layer:** Create a thin adapter that provides unified
  interface for Bun.serve in production and Node.js http.createServer in tests
- **Zero Breaking Changes:** Existing server logic and API endpoints must remain
  unchanged
- **Single Test Runner:** All tests (including apps/server) must run under
  Vitest with Node.js runtime
- **Coverage Integration:** Server code must be included in unified coverage
  reports
- **Performance Constraint:** Node.js test adapter must handle current test
  scenarios without streaming complexity

## Approach Options

**Option A:** Runtime Factory Pattern (Selected)

- Pros: Clean abstraction, runtime detection, minimal refactoring, future
  extensible
- Cons: New layer of indirection, need to maintain two implementations

**Option B:** Conditional Import/Mock Pattern

- Pros: Simpler implementation, direct mocking
- Cons: Test code complexity, less maintainable, harder to extend

**Option C:** Complete Migration to Node.js Framework

- Pros: Single runtime, mature ecosystem
- Cons: Loses Bun performance benefits, major refactoring needed

**Rationale:** Option A provides the cleanest separation of concerns while
preserving Bun's production benefits and enabling unified testing.

## External Dependencies

- **No New Dependencies Required**
- Utilizes existing Node.js `http` module for test adapter
- Leverages existing Vitest configuration and globals
- Preserves Bun.serve for production runtime

## Implementation Architecture

```
apps/server/src/
├── runtime/
│   ├── index.ts          # Runtime factory + exports
│   ├── types.ts          # Interface definitions
│   ├── bun-adapter.ts    # Bun.serve wrapper
│   └── node-adapter.ts   # Node.js http adapter
├── index.ts              # Server logic (modified to use runtime)
└── index.test.ts         # Tests (converted to Vitest)
```

## Interface Contracts

```typescript
interface RuntimeServer {
  port: number
  hostname: string
  stop: () => void | Promise<void>
}

interface ServeOptions {
  port: number | string
  fetch: (request: Request) => Promise<Response> | Response
}

interface Runtime {
  serve: (options: ServeOptions) => RuntimeServer
}
```

## Error Handling Strategy

- **Production (Bun):** Preserve existing error handling and logging
- **Tests (Node):** Uniform 500 JSON responses for unhandled errors
- **Request Processing:** Wrap adapter logic with try/catch to prevent test
  failures
- **Graceful Degradation:** Runtime detection fails safe to Node.js
  implementation

## Upstream Issues Context

| Reference    | Impacted Layer               | Issue Summary                                                                                                                     | Mitigation in This Spec                                |
| ------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Bun #21581   | Bun runtime + Vitest workers | [`dispose ReferenceError` during Vitest execution under Bun 1.2.x](https://github.com/oven-sh/bun/issues/21581)                   | Avoid running Vitest inside Bun; use Node adapter      |
| Vitest #8232 | Vitest worker lifecycle      | Ordering / disposal bug causing above ReferenceError ([vitest-dev/vitest#8232](https://github.com/vitest-dev/vitest/issues/8232)) | Wait for upstream fix; abstraction keeps swap cost low |

These justify the adapter approach instead of further Bun/Vitest patching. A
future evaluation task can remove the Node adapter if both issues close and
stability verified.
