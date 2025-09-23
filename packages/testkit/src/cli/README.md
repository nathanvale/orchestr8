# CLI command mocking utilities

Reliable, deterministic CLI command mocking for tests. Provides a factory- based
mock for Node's child_process APIs with a unified registry, import-order safe
bootstrap, and helpers for common patterns.

Works with Vitest and integrates with `@template/testkit/register` so mocks are
hoisted before your code imports child_process.

## Quick start

1. Ensure the register file runs before tests (hoists mocks):

- If you use `@template/testkit` defaults, it's already wired. For a custom
  project, add this to your vitest config setupFiles:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['@template/testkit/register'],
  },
})
```

2. In your tests, register mocks and run your code:

```ts
import { exec } from 'node:child_process'
import { processHelpers } from '@template/testkit'

processHelpers.mockSuccess('git status', 'nothing to commit\n')

exec('git status', (err, stdout) => {
  expect(err).toBeNull()
  expect(stdout).toContain('nothing to commit')
})
```

## Why this approach

- Single authoritative mock factory for child_process methods
- Unified singleton registry prevents parallel/duplicate state
- Hexa-register pattern: one registration covers all 6 methods (spawn/exec/execSync/fork/execFile/execFileSync)
- Import-order safe: mocks are hoisted in a bootstrap module
- Deterministic outputs and failure modes for anti-flake tests

## Exports

From `@template/testkit`:

- Factory/mocking lifecycle
  - `createProcessMocker()`
  - `getGlobalProcessMocker()`
  - `setupProcessMocking()`
  - `processHelpers` (quick helpers)
- Spawn-oriented utilities
  - `spawnUtils`
  - `commonCommands`
  - `mockSpawn(command)` → `SpawnMockBuilder`
  - `quickMocks` (registers for all 6 child_process methods)
- Types/classes
  - `MockStream`, `MockChildProcess`
  - `SpawnMockBuilder`
  - `type ProcessMockConfig`, `type SpawnTestOptions`, `type SpawnTestResult`

Note: child_process is mocked automatically by `@template/testkit/register` via
an internal bootstrap. You don’t need to call `vi.mock(...)` yourself.

## Import-order and bootstrap

Vitest hoists `vi.mock()` declarations. We ensure hoisting by importing a
bootstrap module first. Always include `@template/testkit/register` as a setup
file (or import it at the very top of your test entry) so child_process is
mocked before any code under test is imported.

Internally, `@template/testkit/register` does:

- Import `./bootstrap` first to hoist `vi.mock('node:child_process')` and
  `vi.mock('child_process')`
- Install cleanup hooks via `setupProcessMocking()` to clear call history after
  each test while keeping your registered mocks intact

## API overview

### processHelpers

- `mockSuccess(command, stdout, exitCode?)`
- `mockFailure(command, stderr, exitCode?)`
- `mockError(command, error)`
- `mockDelayed(command, delayMs, stdout?, exitCode?)`
- `getMocker()` → access the `ProcessMocker` for advanced inspection
- `clearCalls()`, `clear()`, `restore()`

Example:

```ts
import { exec } from 'node:child_process'
import { processHelpers } from '@template/testkit'

processHelpers.mockFailure('git status', 'fatal: not a git repository', 128)

exec('git status', (err, _stdout, stderr) => {
  expect(err?.code).toBe(128)
  expect(String(stderr)).toContain('not a git repository')
})
```

### spawnUtils and builders

- `spawnUtils.mockCommandSuccess(command, stdout?, stderr?, exitCode?)`
- `spawnUtils.mockCommandFailure(command, stderr?, exitCode?, stdout?)`
- `spawnUtils.mockCommandError(command, error)`
- `spawnUtils.mockLongRunningCommand(command, delayMs, stdout?, exitCode?)`
- `spawnUtils.mockInteractiveCommand(command, responses, finalOutput?, exitCode?)`
- `mockSpawn(command).stdout(...).stderr(...).exitCode(...).forMethods([...]).mock()`

These register for all 6 child_process methods by default (hexa-register: spawn, exec, execSync, fork, execFile, execFileSync).

### Verifying calls

Use the global mocker for inspection:

```ts
import { processHelpers } from '@template/testkit/cli'

const mocker = processHelpers.getMocker()

// After your code runs...
const execCalls = mocker.getExecCalls()
expect(execCalls.some((c) => c.command.includes('git status'))).toBe(true)

const spawns = mocker.getSpawnedProcesses()
expect(spawns.length).toBeGreaterThan(0)
```

## Cookbook

See runnable examples in `packages/testkit/examples/cli/`.

Common scenarios:

1. Basic success with stdout
2. Non-zero exit with stderr and assertion
3. Argument pattern matching (use RegExp)
4. Verifying that a command was executed
5. Simulating long-running processes (delay)
6. Interactive command transcript

## Troubleshooting

- Imports happen before mocks
  - Ensure `@template/testkit/register` is in `setupFiles`, or imported at the
    very top of your test entry before importing your code-under-test.
- A mock didn’t match
  - Use normalization-friendly strings (extra spaces/quotes are normalized) or
    prefer `RegExp` for flexible matching.
- Tests leak state
  - `setupProcessMocking()` clears call history after each test. If you need to
    clear mock registrations too, call `processHelpers.clear()` in `afterEach`.
- Async exec vs sync behavior
  - `exec` and `execFile` simulate async callbacks; `execSync` / `execFileSync`
    return data or throw synchronously.

## Anti-flake guidance

- Register explicit outputs and exit codes; avoid implicit success paths
- Prefer deterministic assertions: check known stdout substrings, exit codes
- Use RegExp patterns when arguments vary
- Isolate imports: make sure bootstrap runs before importing code under test

## Delay Behavior

Note that delay simulation differs between synchronous methods:
- `execSync`: Simulates synchronous delay using a busy-wait loop
- `execFileSync`: Returns immediately without delay simulation
- Async methods (`spawn`, `exec`, `execFile`, `fork`): Properly simulate async delays

This design avoids blocking test execution unnecessarily while still allowing delay testing for methods that support it.

## Fallback Precedence

When a command is not found in a method-specific registry, the system checks in this order:
1. Primary map (method-specific registry)
2. `execFile` map
3. `execSync` map
4. `spawn` map
5. `fork` map
6. `execFileSync` map

If a command is registered differently for multiple methods, the fallback may match a different method's config. Use method-specific registration when different behaviors are intended.

## Environment Variables

The CLI mocking system supports several environment variables for fine-tuning behavior:

- `DEBUG_TESTKIT`: Enable verbose logging of mock operations
- `ALLOW_SYNC_DELAY=true`: Allow synchronous delay simulation in execSync (capped at 250ms)
- `STRICT_PROCESS_MOCKS=1`: Warn when mocks are found via fallback instead of primary registry
- `STRICT_PROCESS_MOCKS=throw`: Throw error when fallback would be used (ultra-strict mode)
- `RANDOM_PIDS=true`: Use random PIDs instead of deterministic incremental PIDs

## References

- Source: `packages/testkit/src/cli/` (mock-factory, process-mock, registry,
  spawn utilities)
- Bootstrap: `packages/testkit/src/bootstrap.ts`
