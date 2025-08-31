# Error Handling Patterns (Lean)

> Purpose: Consistent, low-friction error + log hygiene. No over-engineering.
> Keep surface area minimal; only build what enforcement gates use.

## Scope (Must / Defer)

| Item                         | Status | Notes                                       |
| ---------------------------- | ------ | ------------------------------------------- |
| Minimal typed error base     | Must   | Single file `scripts/lib/errors.ts`         |
| Structured logger            | Must   | JSON-friendly output (no heavy styling)     |
| Retry helper                 | Must   | Exponential backoff + cap                   |
| Global process handlers      | Must   | Uncaught + unhandled rejection              |
| Script exit code unification | Must   | Single exit path per script                 |
| React ErrorBoundary          | Defer  | Implement only if UI starts handling errors |
| Fancy color/spinner          | Defer  | Not needed for correctness                  |
| External error SaaS          | Defer  | Add only with real incident volume          |

## Fast Model

| Dimension | Standard                                       |
| --------- | ---------------------------------------------- |
| Throw     | Throw typed error (not raw Error)              |
| Log       | logger.level(message, { context })             |
| Context   | Only fields aiding triage (< 8 keys)           |
| Code      | Upper snake (e.g. `FILE_NOT_FOUND`)            |
| Recovery  | Use `retry()` for transient IO/network         |
| Exit      | Exactly one place decides `process.exit(code)` |

## Minimal Error Module Template

```ts
// scripts/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = code
  }
}

export class ValidationError extends AppError {
  constructor(msg: string, field?: string, ctx: Record<string, unknown> = {}) {
    super(msg, 'VALIDATION_ERROR', { field, ...ctx })
  }
}

export class ScriptError extends AppError {
  constructor(
    msg: string,
    script: string,
    exit?: number,
    ctx: Record<string, unknown> = {},
  ) {
    super(msg, 'SCRIPT_ERROR', { script, exit, ...ctx })
  }
}

export class FileError extends AppError {
  constructor(
    msg: string,
    path: string,
    op: string,
    ctx: Record<string, unknown> = {},
  ) {
    super(msg, 'FILE_ERROR', { path, op, ...ctx })
  }
}

export class NetworkError extends AppError {
  constructor(
    msg: string,
    url: string,
    status?: number,
    ctx: Record<string, unknown> = {},
  ) {
    super(msg, 'NETWORK_ERROR', { url, status, ...ctx })
  }
}
```

Anything beyond these 5: justify with >2 real occurrences.

## Logger (Slim)

```ts
// scripts/lib/logger.ts
export interface LogMeta {
  [k: string]: unknown
}
type Level = 'error' | 'warn' | 'info' | 'debug'

const current: Level = (process.env.LOG_LEVEL as Level) ?? 'info'
const order: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 }

function emit(level: Level, msg: string, meta?: LogMeta, err?: unknown) {
  if (order[level] > order[current]) return
  const base: any = { t: new Date().toISOString(), level, msg }
  if (meta) base.meta = meta
  if (err instanceof Error)
    base.error = { name: err.name, message: err.message }
  // single line JSON for grepability
  process.stderr.write(JSON.stringify(base) + '\n')
}

export const logger = {
  error: (m: string, e?: unknown, meta?: LogMeta) => emit('error', m, meta, e),
  warn: (m: string, meta?: LogMeta) => emit('warn', m, meta),
  info: (m: string, meta?: LogMeta) => emit('info', m, meta),
  debug: (m: string, meta?: LogMeta) => emit('debug', m, meta),
}
```

No colors; CI-safe.

## Retry Helper

```ts
// scripts/lib/retry.ts
import { logger } from './logger'

export async function retry<T>(
  fn: () => Promise<T>,
  opts?: {
    attempts?: number
    delayMs?: number
    factor?: number
    maxDelay?: number
  },
): Promise<T> {
  const attempts = opts?.attempts ?? 3
  const factor = opts?.factor ?? 2
  const maxDelay = opts?.maxDelay ?? 30_000
  let delay = opts?.delayMs ?? 300
  let last: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (i === attempts) break
      logger.warn('retry_attempt_failed', {
        attempt: i,
        error: e instanceof Error ? e.message : String(e),
      })
      await new Promise((r) => setTimeout(r, delay))
      delay = Math.min(delay * factor, maxDelay)
    }
  }
  throw last
}
```

## Script Wrapper Pattern

```ts
// pattern
import { logger } from './lib/logger'
import { ScriptError } from './lib/errors'

async function main() {
  // ...logic that may throw
}

main().catch((err) => {
  if (!(err instanceof ScriptError)) {
    logger.error('unhandled_error', err)
  } else {
    logger.error(err.code, err, err.context)
  }
  process.exit(1)
})
```

## Global Handlers

```ts
// scripts/lib/process-handlers.ts
import { logger } from './logger'
export function setupGlobal() {
  process.on('unhandledRejection', (r) =>
    logger.error('unhandled_rejection', r),
  )
  process.on('uncaughtException', (e) => {
    logger.error('uncaught_exception', e)
    process.exit(1)
  })
}
```

Call once per CLI entry before work starts.

## Placement Rules

| Concern     | Where Lives                       | Notes                   |
| ----------- | --------------------------------- | ----------------------- |
| Error types | `scripts/lib/errors.ts`           | Single file             |
| Logger      | `scripts/lib/logger.ts`           | No transitive deps      |
| Retry       | `scripts/lib/retry.ts`            | Pure + side-effect free |
| Handlers    | `scripts/lib/process-handlers.ts` | Init early              |

## Anti-Patterns (Remove On Touch)

| Smell                        | Replacement                      |
| ---------------------------- | -------------------------------- |
| `console.log` for errors     | `logger.error(...)`              |
| Swallow `catch {}`           | Log + rethrow or map to AppError |
| Multiple `process.exit()`    | Single tail handler only         |
| Giant custom hierarchy       | Keep to the 5 canonical errors   |
| Retry without backoff        | Use central `retry()`            |
| Inline JSON.parse inside try | Extract + validate separately    |

## Lightweight Validation Pattern

```ts
function ensure(condition: any, msg: string, ctx?: Record<string, unknown>) {
  if (!condition) throw new ValidationError(msg, undefined, ctx)
}
```

## Minimal Coverage Gate Example

```ts
import { promises as fs } from 'fs'
import { ValidationError, FileError } from './lib/errors'

export async function loadCoverage(path = 'coverage/summary.json') {
  try {
    const raw = await fs.readFile(path, 'utf8')
    const data = JSON.parse(raw)
    if (!data?.total?.lines?.pct)
      throw new ValidationError('bad_coverage_shape')
    return data
  } catch (e: any) {
    if (e.code === 'ENOENT')
      throw new FileError('coverage_missing', path, 'read')
    throw e
  }
}
```

## Rollout Order (Fast)

1. Add shared modules (errors, logger, retry, handlers)
1. Update top 3 critical scripts to use wrapper pattern
1. Remove stray `console.*` in touched scripts
1. Add 1 test: custom error context + retry success
1. Wire global handlers into any long-running dev entry if present

## Refactor Checklist

| Check                      | ✅  |
| -------------------------- | --- |
| Uses canonical error types |     |
| No raw `console.error`     |     |
| Single exit path           |     |
| Retry used where transient |     |
| Logger JSON lines only     |     |
| Error context ≤ 8 keys     |     |

## Success Signals

| Signal             | Evidence                              |
| ------------------ | ------------------------------------- |
| Faster triage      | Log lines copy/paste into issues      |
| Fewer silent fails | No empty catch blocks in grep         |
| Stable scripts     | Reduced flakes post retry integration |
| Small surface      | Error module < 120 LOC                |

## Deferred (Create Issue If Needed)

| Idea                           | Reason Deferred                |
| ------------------------------ | ------------------------------ |
| React boundary                 | Not core to script reliability |
| Full stack traces in prod logs | Noise vs signal                |
| Rich color logger              | CI noise + parsing complexity  |

---

If adding new error type: show ≥2 real-world examples + why existing types fail.
Otherwise reject.
