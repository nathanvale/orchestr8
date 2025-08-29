# Spec: Runtime Adapter & Unified Vitest Migration (Option A)

Date: 2025-08-29 Status: Proposed Owner: @nathanvale Related PR: (link when
opened) Decision ID: DEC-012 (supersedes DEC-008 Mixed Runners)

## 1. Goal

Unify all tests (including `apps/server`) under a single Vitest invocation (Node
runtime) while keeping Bun for production execution. Eliminate dual runners,
flaky esbuild/EPIPE issues, and reduce cognitive/context switching overhead.

## 2. Non-Goals

- Replacing Bun with Fastify or another framework
- Refactoring business logic beyond minimal seams
- Implementing advanced HTTP features (streaming, websockets, TLS)
- Performance micro-optimizations (handled later if needed)

## 3. Current Pain Points

| Issue                                                     | Impact                                    |
| --------------------------------------------------------- | ----------------------------------------- |
| Bun test runner separate from Vitest                      | Split coverage + CI complexity            |
| Bun+Vitest instability (worker/tinypool / dispose issues) | Migration blocked (See Upstream Issues)   |
| Direct `Bun.serve` dependency                             | Prevents running under plain Node/Vitest  |
| ADHD context switching                                    | Slows iteration; lowers feedback dopamine |

## 4. High-Level Approach

Introduce a thin runtime abstraction layer that exposes a neutral interface used
by `startServer()`. In production it delegates to `Bun.serve`. In tests
(Node/Vitest) we provide a lightweight compatibility implementation using Node's
`http` module. This enables Vitest to execute server tests without Bun, while
production keeps Bun-specific performance and semantics.

## 5. Architecture Diagram (Conceptual)

```text
                +-----------------------------+
                |   Server Logic (index.ts)   |
                |  - handlers (root, health)  |
                +---------------+-------------+
                                |
                                v
                     +--------------------+
                     | Runtime Adapter    |
                     | createRuntime()    |
                     +---------+----------+
                               |
             +-----------------+------------------+
             |                                    |
             v                                    v
   +--------------------+             +-------------------------+
   | Bun Implementation |             | Node Test Implementation|
   | uses Bun.serve()   |             | uses http.createServer()|
   +--------------------+             +-------------------------+
```

## 6. Interface Design

```ts
// apps/server/src/runtime/types.ts
export interface RuntimeServer {
  port: number
  hostname: string
  stop: () => void | Promise<void>
}

export interface ServeOptions {
  port: number | string
  fetch: (request: Request) => Promise<Response> | Response
}

export interface Runtime {
  serve: (options: ServeOptions) => RuntimeServer
}
```

Factory:

```ts
export function createRuntime(): Runtime {
  if (typeof (globalThis as any).Bun?.serve === 'function') {
    return bunRuntime()
  }
  return nodeRuntime()
}
```

## 7. Bun Adapter

```ts
function bunRuntime(): Runtime {
  return {
    serve({ port, fetch }) {
      const server = Bun.serve({ port: Number(port), fetch })
      return {
        port: server.port,
        hostname: 'localhost',
        stop: () => server.stop(),
      }
    },
  }
}
```

## 8. Node Adapter (Test Shim)

Constraints: Only features needed by current tests (JSON/text bodies, basic
headers, status codes). No streaming.

```ts
import http from 'node:http'

function nodeRuntime(): Runtime {
  return {
    serve({ port, fetch }) {
      const server = http.createServer(async (nodeReq, nodeRes) => {
        try {
          const url = `http://localhost:${(nodeReq.socket.address() as any).port}${nodeReq.url}`
          const method = nodeReq.method || 'GET'
          const headers = new Headers()
          for (const [k, v] of Object.entries(nodeReq.headers)) {
            if (Array.isArray(v)) headers.set(k, v.join(', '))
            else if (v !== undefined) headers.set(k, v)
          }
          const bodyChunks: Buffer[] = []
          nodeReq.on('data', (c) => bodyChunks.push(c))
          nodeReq.on('end', async () => {
            const body = Buffer.concat(bodyChunks)
            const request = new Request(url, {
              method,
              headers,
              body: body.length ? body : undefined,
            })
            let response: Response
            try {
              response = await fetch(request)
            } catch (err) {
              response = new Response(
                JSON.stringify({
                  error: 'Internal error',
                  details: (err as Error).message,
                }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            }
            // Write response
            nodeRes.statusCode = response.status
            nodeRes.statusMessage = response.statusText
            response.headers.forEach((value, key) =>
              nodeRes.setHeader(key, value),
            )
            const respBody = await response.arrayBuffer()
            nodeRes.end(Buffer.from(respBody))
          })
        } catch (err) {
          nodeRes.statusCode = 500
          nodeRes.setHeader('Content-Type', 'application/json')
          nodeRes.end(
            JSON.stringify({
              error: 'Unhandled',
              details: (err as Error).message,
            }),
          )
        }
      })
      server.listen(port)
      const address = server.address() as any
      return {
        port: typeof address?.port === 'number' ? address.port : Number(port),
        hostname: 'localhost',
        stop: () => server.close(),
      }
    },
  }
}
```

## 9. Refactor `startServer`

Current direct `Bun.serve` call replaced by runtime factory:

```ts
import { createRuntime } from './runtime'

export function startServer(port: number | string = PORT): ServerInstance {
  const runtime = createRuntime()
  const server = runtime.serve({
    port,
    fetch: async (request) => {
      /* existing switch logic preserved */
    },
  })
  // Logging & endpoints announcement unchanged
  return server
}
```

## 10. Test Migration

- Remove:
  `import { describe, test, expect, beforeAll, afterAll } from 'bun:test'`
- Rely on Vitest globals (already enabled) or explicitly
  `import { describe, it, expect, beforeAll, afterAll } from 'vitest'`.
- Keep identical assertions.
- Verify dynamic port from adapter still supplied.

## 11. Coverage & CI Impact

- Server code now instrumented by single Vitest run.
- Remove any Bun-only coverage scripts.
- Adjust thresholds if previously excluding server (should increase global line
  counts slightly).

## 12. Incremental Rollout Steps (Time-Boxed Sprints)

| Step | Action                            | Exit Criteria                                       |
| ---- | --------------------------------- | --------------------------------------------------- |
| 1    | Add runtime types + adapters      | `nodeRuntime` & `bunRuntime` compiled w/o errors    |
| 2    | Refactor `startServer`            | Tests still pass under Bun (`bun test` temporarily) |
| 3    | Convert test file to Vitest       | `vitest run apps/server/src/index.test.ts` green    |
| 4    | Integrate into root test run      | Root `vitest` shows server tests counted            |
| 5    | Remove Bun test script (optional) | `pnpm test` (or bun run test) single pipeline       |
| 6    | Update README + Decision log      | DEC-012 documented                                  |
| 7    | Clean & commit                    | PR touches minimal files; CI green                  |

## 13. Edge Cases & Handling

| Case               | Strategy                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Large request body | Not needed now; add streaming later if required                                                                   |
| Server start race  | Node adapter listens before returning; safe to issue fetch after beforeAll                                        |
| Error in handler   | Response fallback 500 JSON uniform                                                                                |
| Parallel tests     | Current suite serial; if future parallel hits metrics, consider isolation per test or reset metrics in beforeEach |

## 14. Risks & Mitigations

| Risk                            | Mitigation                                          |
| ------------------------------- | --------------------------------------------------- |
| Undetected Bun-only usage later | Keep adapter pattern; add lint rule later if needed |
| Adapter drift                   | Contract documented; unit test optional (future)    |
| Developer confusion             | README section + code comments                      |

## 15. Success Metrics

- All tests run via single Vitest invocation (<1s added to runtime vs dual)
- 0 Bun-specific test imports remain
- Coverage includes `apps/server/src/index.ts` (>0 lines covered)
- No regression in existing test assertions

## 16. Rollback Plan

If instability discovered:

1. Restore original `Bun.serve` code (leave adapter files unused).
2. Revert test import to `bun:test`.
3. Keep adapter folder as dormant (future re-attempt).

Rollback complexity: Low (≤10 lines change).

## 17. Future Enhancements (Out of Scope Now)

- Add Fastify adapter for richer plugin ecosystem
- Add request streaming & chunked responses
- Add OpenAPI generator / contract tests
- Merge metrics & log persistence into optional plugin system

## 18. File Changes Summary

New:

- `apps/server/src/runtime/index.ts` (exports createRuntime and adapters)
- (Optional) `apps/server/src/runtime/types.ts` if separated

Modified:

- `apps/server/src/index.ts` (swap to runtime)
- `apps/server/src/index.test.ts` (Vitest imports)

Docs:

- `apps/server/README.md` (decision update)
- This spec file (added)

## 19. Code Style & Conventions

- Keep existing no-semicolon style (Prettier)
- Use explicit interfaces (`RuntimeServer`, not single-letter generics)
- Maintain 80 char line width where reasonable

## 20. Open Questions

None blocking. If future need for streaming emerges, extend adapter with async
iterator handling.

## 21. Upstream Issues (Rationale Evidence)

| Reference          | Summary                                                                                                                                                                                                            | Relevance                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Bun Issue #21581   | ["Bun fails vitest with dispose ReferenceError"](https://github.com/oven-sh/bun/issues/21581) – failing worker lifecycle producing `ReferenceError: Cannot access 'dispose' before initialization` in Vitest chunk | Demonstrates instability running Vitest directly under Bun runtime (worker/tinypool interaction) |
| Vitest Issue #8232 | Linked from Bun #21581 – underlying cause in Vitest worker / threads disposal ordering ([vitest-dev/vitest#8232](https://github.com/vitest-dev/vitest/issues/8232))                                                | Confirms issue is not project-specific, reducing ROI of deeper Bun/Vitest debugging now          |

Decision DEC-012 defers attempting a pure Bun-hosted Vitest environment until
BOTH issues are closed or mitigated by official guidance.

## Spec Documentation

- Tasks: @.agent-os/specs/2025-08-29-runtime-adapter-vitest-unification/tasks.md
- Technical Specification:
  @.agent-os/specs/2025-08-29-runtime-adapter-vitest-unification/sub-specs/technical-spec.md
- Tests Specification:
  @.agent-os/specs/2025-08-29-runtime-adapter-vitest-unification/sub-specs/tests.md

---

Implementation can proceed immediately following Step 1 in the table above.
