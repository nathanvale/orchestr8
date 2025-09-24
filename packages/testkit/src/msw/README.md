# MSW Domain (Testkit)

High‑level entrypoint for API mocking utilities built atop Mock Service Worker.
See the full guide in `docs/guides/msw-testkit.md` for deep coverage. This
README lists the public surface and quick usage patterns.

## Recent Changes (Behavioral Notes)

- `createMSWServer` now rebuilds the server if you pass a different handler set
  (previously identical calls with new handlers were ignored).
- Passing a config object to `startMSWServer` persists the merged config so
  `getMSWConfig()` reflects live state.
- `updateMSWConfig` will auto‑restart the server if `onUnhandledRequest` mode
  changes to apply the new policy immediately.
- Pagination: `createPaginatedHandler` clamps invalid/zero/negative `page` and
  `pageSize` values to safe minimums (page→1, size→default).
- Randomized handlers (`createUnreliableHandler`, `createNetworkIssueHandler`)
  accept an `rng` function for deterministic tests and configurable timeout.

## Install & Import

Already bundled as part of `@template/testkit` (development only). Import via
subpath:

```ts
import { setupMSW, http, createSuccessResponse } from '@template/testkit/msw'
```

## Quick Start

```ts
import { setupMSW, http, createSuccessResponse } from '@template/testkit/msw'

setupMSW([http.get('*/health', () => createSuccessResponse({ status: 'ok' }))])
```

## Setup Helpers

| Helper                   | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `setupMSW`               | Vitest lifecycle (beforeAll/afterEach/afterAll) server management |
| `quickSetupMSW`          | Fire‑and‑forget startup (no auto reset/teardown)                  |
| `setupMSWGlobal`         | For use in `vitest.globalSetup.ts` (shared server)                |
| `setupMSWManual`         | Imperative start/stop/reset/dispose control                       |
| `setupMSWForEnvironment` | Env‑aware wrapper (Wallaby quiet, timeouts)                       |
| `createTestScopedMSW`    | Suite‑scoped isolated handler collection                          |

## Handler Factories

| Factory                     | Notes                                                                   |
| --------------------------- | ----------------------------------------------------------------------- |
| `createSuccessResponse`     | JSON success with status override                                       |
| `createErrorResponse`       | Standard error envelope `{ error: { ... } }`                            |
| `createDelayedResponse`     | Latency simulation (Promise + delay)                                    |
| `createUnreliableHandler`   | Random failure injection (options: `{ rng }`)                           |
| `createPaginatedHandler`    | Page + metadata computation (clamped inputs)                            |
| `createAuthHandlers`        | `/auth/login`, `/auth/me`, `/auth/logout` set                           |
| `createCRUDHandlers`        | In‑memory REST resource                                                 |
| `createNetworkIssueHandler` | Timeout/unavailable/error patterns (options: `{ rng, timeoutDelayMs }`) |
| `defaultHandlers`           | Basic health endpoint                                                   |

## Constants & Re‑exports

- `HTTP_STATUS` common numeric codes
- `COMMON_HEADERS` header presets
- Direct re‑exports: `http`, `HttpResponse`, `delay` from MSW

## Configuration

`createMSWConfig(overrides)` adjusts defaults based on env:

- `WALLABY_ENV=true` => quiet logs
- `NODE_ENV=test` => shorter timeout
- `MSW_ON_UNHANDLED_REQUEST` => override strict handling (`error|warn|bypass`)

Live update behavior:

- Calling `startMSWServer({ ... })` merges & persists config.
- `updateMSWConfig` with changed `onUnhandledRequest` triggers an automatic
  restart; other fields update in place.

## Runtime Utilities

| Function                   | Description                                             |
| -------------------------- | ------------------------------------------------------- |
| `addMSWHandlers(...h)`     | Append handlers at runtime                              |
| `resetMSWHandlers()`       | Reset to initial baseHandlersSnapshot                   |
| `restoreMSWHandlers()`     | Restore initial handlers (remove one‑time overrides)    |
| `getMSWServer()`           | Access underlying server (null if not created)          |
| `getMSWConfig()`           | Current resolved config                                 |
| `updateMSWConfig(partial)` | Merge + validate config (auto‑restart on policy change) |
| `disposeMSWServer()`       | Full cleanup (server + config)                          |

## Backwards Compatibility

- `setupMSWLegacy` alias of `setupMSW`
- `createMockHandler` deprecated (prefer `http.get/post` + response helpers)

## Examples

See `packages/testkit/examples/msw` for runnable tests demonstrating pagination,
auth, CRUD, unreliability, and network issue patterns. For deterministic tests
with unreliable handlers:

```ts
import { createUnreliableHandler } from '@template/testkit/msw'

const deterministic = createUnreliableHandler(
  '*/path',
  { ok: true },
  0.5,
  'get',
  {
    rng: () => 0.75, // always succeed (> 0.5)
  },
)
```

## Recommended Defaults

- Keep `onUnhandledRequest: 'error'` during development
- Group related handlers in arrays for clarity (auth, CRUD resources)
- Supply a fixed RNG for flaky simulation tests if asserting success/failure

## Troubleshooting

| Symptom                             | Likely Cause                         | Action                                                 |
| ----------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| Handlers not changing after rebuild | Same handler set passed              | Provide new array or restart with modified definitions |
| Config not reflected                | Using old pattern before start patch | Re-run with new version; start merges config now       |
| Pagination negative page            | User input < 1                       | Value auto‑clamped to 1 (document assumption)          |
| Random test flake                   | Non‑deterministic RNG                | Inject deterministic `rng` in handler options          |

---

For deeper narrative and design rationale: `docs/guides/msw-testkit.md`.
